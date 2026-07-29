
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { mongoose } from '../config/db.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';
import Option from '../models/Option.js';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import Notification from '../models/Notification.js';
import fetch from 'node-fetch';
import { getEffectiveUserId, resolvePermissions, hasPermission } from '../middleware/auth.js';
import { pushMessagesToWhatsApp } from '../utils/whatsappSender.js';
import eventBus from '../utils/eventBus.js';
import { buildConversationClosedHistoryEntry, buildConversationClosedSetFragment } from '../utils/conversationActions.js';

const SSE_SECRET_KEY = 'dfghjukiolp;[p0o9i8uytgbhnjmk,l.;p9876543t4rre2asd';
const CASE1_REMINDER_MINUTES = 30;
// const CASE1_REMINDER_MINUTES = 2;
const CASE1_REMINDER_MS = CASE1_REMINDER_MINUTES * 60 * 1000;
const CASE2_REMINDER_MINUTES = 30;
// const CASE2_REMINDER_MINUTES = 2;
const CASE2_REMINDER_MS = CASE2_REMINDER_MINUTES * 60 * 1000;
// One-time rep notification fired earlier than the 30-minute bot-trigger stage.
const CASE2_NOTIFY_MINUTES = 10;
const CASE2_NOTIFY_MS = CASE2_NOTIFY_MINUTES * 60 * 1000;
const CASE1_TICK_MS = 60 * 1000;
const CASE1_CLAIM_MS = 55 * 1000;
const CASE1_ENABLED = process.env.SESSION_REMINDER_CASE1_ENABLED !== 'false';
const CASE2_ENABLED = process.env.SESSION_REMINDER_CASE2_ENABLED !== 'false';

const toDateSafe = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getHistoryCreatedAt = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  return toDateSafe(entry.created || entry.timestamp || entry.createdAt || entry.updatedAt);
};

const getLastRelevantSpeaker = (history = []) => {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    const sender = String(entry?.sender || '').toLowerCase();
    if (sender !== 'agent' && sender !== 'user') continue;
    return {
      sender,
      createdAt: getHistoryCreatedAt(entry),
      agentUserId: sender === 'agent'
        ? String(entry?.agent_user_id || entry?.from_user_id || '').trim() || null
        : null
    };
  }
  return null;
};

const emitSessionUpdateForReminder = (session, actorUserId = null) => {
  const ownerId = String(session?.user_id || '').trim();
  const phone = String(session?.sender || session?.customer_phone || '');
  if (ownerId) {
    eventBus.emit('session:update', { userId: ownerId, phone });
  }
  if (actorUserId && String(actorUserId) !== ownerId) {
    eventBus.emit('session:update', { userId: String(actorUserId), phone });
  }
};

const buildReminderClaimQuery = (reminderKey, nowDate) => ({
  is_agent: true,
  status: { $in: ['waiting', 'handling'] },
  $and: [
    {
      $or: [
        { [`${reminderKey}.next_due_at`]: { $lte: nowDate } },
        { [`${reminderKey}.next_due_at`]: { $exists: false } },
        { [`${reminderKey}.next_due_at`]: null }
      ]
    },
    {
      $or: [
        { [`${reminderKey}.claim_until`]: { $lte: nowDate } },
        { [`${reminderKey}.claim_until`]: { $exists: false } },
        { [`${reminderKey}.claim_until`]: null }
      ]
    }
  ]
});

const buildCase2Recipients = async (session) => {
  const recipients = new Set();
  const ownerId = String(session?.user_id || '').trim();
  const sessionPhone = String(session?.sender || session?.customer_phone || '').trim();

  if (String(session?.rep_user_id || '').trim()) {
    recipients.add(String(session.rep_user_id));
  }

  if (String(session?.rep_group_id || '').trim()) {
    const groupReps = await User.find({ rep_group_ids: String(session.rep_group_id) }).select('_id').lean();
    groupReps.forEach(rep => recipients.add(String(rep._id)));
  }

  if (ownerId && sessionPhone) {
    const contactDoc = await Contact.findOne({ user_id: ownerId, phone: sessionPhone }).select('assigned_to').lean();
    (contactDoc?.assigned_to || []).forEach(userId => recipients.add(String(userId)));
  }

  return [...recipients].filter(Boolean);
};

const replaceRuntimeParameters = (text, parameters = {}) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/--(.+?)--/g, (match, paramName) => {
    const value = parameters[paramName];
    return value !== undefined ? String(value) : 'null';
  });
};

const findNextEdgeTarget = (edges, sourceId, sourceHandle = null) => {
  const edge = edges.find(e => e.source === sourceId && (sourceHandle ? e.sourceHandle === sourceHandle : !e.sourceHandle));
  return edge ? edge.target : null;
};

const buildCase2TriggerFlowGraph = async (session) => {
  const flowId = String(session?.flow_id || '').trim();
  if (!flowId) return { nodesById: new Map(), edges: [] };

  const widgets = await Widget.find({
    flow_id: flowId,
    $or: [{ standard_process_id: null }, { isStandardProcess: 1 }]
  }).lean();
  if (!widgets.length) return { nodesById: new Map(), edges: [] };

  const options = await Option.find({ widget_id: { $in: widgets.map(w => w.id) } }).lean();
  const nodesById = new Map();
  const edges = [];

  for (const w of widgets) {
    const metadata = w.image_file || {};
    const wOptions = options.filter(o => o.widget_id === w.id);
    const conditionalOptions = w.type === 'action_web_service'
      ? wOptions.filter(o => o.operator !== 'default')
      : wOptions;

    const runtimeNode = {
      id: w.id,
      type: w.type,
      data: {
        ...metadata,
        label: metadata.label !== undefined ? metadata.label : (w.value || ''),
        content: metadata.content !== undefined ? metadata.content : (w.value || ''),
        options: conditionalOptions.length > 0 ? conditionalOptions.map(o => o.value) : [],
        optionOperators: conditionalOptions.length > 0 ? conditionalOptions.map(o => o.operator || 'eq') : []
      }
    };

    if (w.type === 'output_menu') {
      runtimeNode.data.options = wOptions.filter(o => o.operator !== 'default').map(o => o.value);
    }

    if (w.next) {
      edges.push({ source: w.id, target: w.next });
    }

    if (w.type === 'action_time_routing') {
      let rangeIndex = 0;
      wOptions.forEach((o) => {
        if (o.next) {
          const sourceHandle = o.operator === 'default' ? 'option-default' : `option-${rangeIndex}`;
          edges.push({ source: w.id, sourceHandle, target: o.next });
        }
        if (o.operator === 'time_range' || o.operator === 'date_range' || o.operator === 'weekday_range') rangeIndex += 1;
      });
    } else if (w.type === 'action_web_service') {
      const defaultOpts = wOptions.filter(o => o.operator === 'default');
      const conditionalOptsWs = wOptions.filter(o => o.operator !== 'default');
      conditionalOptsWs.forEach((o, i) => {
        if (o.next) edges.push({ source: w.id, sourceHandle: `option-${i}`, target: o.next });
      });
      defaultOpts.forEach((o) => {
        if (o.next) edges.push({ source: w.id, sourceHandle: 'default', target: o.next });
      });
    } else if (w.type === 'output_menu') {
      const defaultOpts = wOptions.filter(o => o.operator === 'default');
      const conditionalOptsMenu = wOptions.filter(o => o.operator !== 'default');
      conditionalOptsMenu.forEach((o, i) => {
        if (o.next) edges.push({ source: w.id, sourceHandle: `option-${i}`, target: o.next });
      });
      defaultOpts.forEach((o) => {
        if (o.next) edges.push({ source: w.id, sourceHandle: 'option-default', target: o.next });
      });
    } else if (w.type === 'automatic_responses') {
      const triggerOpt = wOptions.find(o => o.operator === 'system_trigger');
      if (triggerOpt?.next) {
        edges.push({ source: w.id, sourceHandle: 'option-system-case2', target: triggerOpt.next });
      }
      const conditionalOptsAuto = wOptions.filter(o => o.operator !== 'system_trigger' && o.operator !== 'default');
      conditionalOptsAuto.forEach((o, i) => {
        if (o.next) edges.push({ source: w.id, sourceHandle: `option-${i}`, target: o.next });
      });
    } else {
      wOptions.forEach((o, i) => {
        if (o.next) edges.push({ source: w.id, sourceHandle: `option-${i}`, target: o.next });
      });
    }

    nodesById.set(w.id, runtimeNode);
  }

  return { nodesById, edges };
};

// Walks the case2-trigger flow graph starting at `startNodeId`, collecting the
// outbound WhatsApp messages generated along the way. Stops at the first node
// that requires customer interaction (menu/input) or at a node type this
// lightweight walker doesn't support, so the caller can decide whether it's
// safe to hand the session back to the interactive bot engine at that node.
// Returns { messages, stopNodeId, waitingTextInput, supported }.
const buildCase2TriggerMessages = async (session, startNodeId) => {
  const { nodesById, edges } = await buildCase2TriggerFlowGraph(session);
  if (!startNodeId || !nodesById.has(startNodeId)) {
    return { messages: [], stopNodeId: null, waitingTextInput: false, supported: false };
  }

  const params = session?.parameters || {};
  const messages = [];
  let currentNodeId = startNodeId;
  let depth = 0;
  const MAX_DEPTH = 120;

  while (currentNodeId && depth < MAX_DEPTH) {
    depth += 1;
    const node = nodesById.get(currentNodeId);
    if (!node) break;

    const nodeData = node.data || {};
    switch (node.type) {
      case 'start': {
        currentNodeId = findNextEdgeTarget(edges, currentNodeId);
        break;
      }
      case 'output_text': {
        const text = replaceRuntimeParameters(nodeData.content || '', params);
        messages.push({ type: 'Text', text, created: new Date().toISOString() });
        currentNodeId = findNextEdgeTarget(edges, currentNodeId);
        break;
      }
      case 'output_image': {
        const url = replaceRuntimeParameters(nodeData.url || '', params);
        const mediaType = nodeData.mediaType || 'image';
        const caption = replaceRuntimeParameters(nodeData.caption || '', params);
        messages.push({
          type: mediaType === 'video' ? 'Video' : mediaType === 'pdf' ? 'Document' : 'Image',
          url,
          created: new Date().toISOString()
        });
        if (caption && caption.trim()) {
          messages.push({ type: 'Text', text: caption, created: new Date().toISOString() });
        }
        currentNodeId = findNextEdgeTarget(edges, currentNodeId);
        break;
      }
      case 'output_link': {
        const text = replaceRuntimeParameters(nodeData.linkLabel || 'קישור', params);
        const url = replaceRuntimeParameters(nodeData.url || '', params);
        messages.push({ type: 'URL', text, url, created: new Date().toISOString() });
        currentNodeId = findNextEdgeTarget(edges, currentNodeId);
        break;
      }
      case 'output_menu': {
        const menuText = replaceRuntimeParameters(nodeData.content || '', params);
        const options = Array.isArray(nodeData.options)
          ? nodeData.options.filter(opt => String(opt) !== 'default').map(opt => String(opt))
          : [];
        messages.push({ type: 'Options', text: menuText || '', options, created: new Date().toISOString() });
        return { messages, stopNodeId: node.id, waitingTextInput: false, supported: true };
      }
      case 'action_time_routing': {
        const routingMode = nodeData.routingMode || 'time';
        const now = new Date();
        const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
        let matchedIndex = -1;

        if (routingMode === 'date') {
          const israelDateStr = [
            israelTime.getFullYear(),
            String(israelTime.getMonth() + 1).padStart(2, '0'),
            String(israelTime.getDate()).padStart(2, '0')
          ].join('-');
          const dateRanges = Array.isArray(nodeData.dateRanges) ? nodeData.dateRanges : [];
          for (let i = 0; i < dateRanges.length; i += 1) {
            const range = dateRanges[i];
            if (range?.fromDate && range?.toDate && israelDateStr >= range.fromDate && israelDateStr <= range.toDate) {
              matchedIndex = i;
              break;
            }
          }
        } else if (routingMode === 'weekday') {
          const israelDay = israelTime.getDay();
          const weekdayRanges = Array.isArray(nodeData.weekdayRanges) ? nodeData.weekdayRanges : [];
          for (let i = 0; i < weekdayRanges.length; i += 1) {
            const range = weekdayRanges[i] || {};
            const fromDay = Number.isInteger(range.fromDay) ? range.fromDay : 0;
            const toDay = Number.isInteger(range.toDay) ? range.toDay : 6;
            const inRange = fromDay <= toDay
              ? (israelDay >= fromDay && israelDay <= toDay)
              : (israelDay >= fromDay || israelDay <= toDay);
            if (inRange) {
              matchedIndex = i;
              break;
            }
          }
        } else {
          const israelHour = israelTime.getHours();
          const timeRanges = Array.isArray(nodeData.timeRanges) ? nodeData.timeRanges : [];
          for (let i = 0; i < timeRanges.length; i += 1) {
            const range = timeRanges[i] || {};
            const fromHour = parseInt(range.fromHour, 10) || 0;
            const toHour = parseInt(range.toHour, 10) || 23;
            const inRange = fromHour <= toHour
              ? (israelHour >= fromHour && israelHour < toHour)
              : (israelHour >= fromHour || israelHour < toHour);
            if (inRange) {
              matchedIndex = i;
              break;
            }
          }
        }

        currentNodeId = matchedIndex >= 0
          ? findNextEdgeTarget(edges, currentNodeId, `option-${matchedIndex}`)
          : findNextEdgeTarget(edges, currentNodeId, 'option-default');
        break;
      }
      case 'action_wait': {
        // Ticker path is background and should stay non-blocking.
        currentNodeId = findNextEdgeTarget(edges, currentNodeId);
        break;
      }
      case 'input_text':
      case 'input_date':
      case 'input_file': {
        // Send the input prompt so the customer knows what to reply with, then
        // stop here — the customer's next message will be handled as an
        // interactive answer to this node once the session is handed back to
        // the bot engine.
        const promptText = replaceRuntimeParameters(nodeData.label || '', params);
        if (promptText && promptText.trim()) {
          messages.push({ type: 'Text', text: promptText, created: new Date().toISOString() });
        }
        return { messages, stopNodeId: node.id, waitingTextInput: true, supported: true };
      }
      case 'action_web_service':
      case 'fixed_process':
      case 'automatic_responses':
      default:
        // Not supported by this lightweight walker — stop without handing
        // interactive control back to the bot (legacy one-shot behavior).
        return { messages, stopNodeId: node.id, waitingTextInput: false, supported: false };
    }
  }

  return { messages, stopNodeId: currentNodeId, waitingTextInput: false, supported: false };
};

const runCase2SystemTrigger = async (session, systemTrigger, nowDate) => {
  const nextNodeId = String(systemTrigger?.nextNodeId || '').trim();
  if (!nextNodeId) return { sentCount: 0, waPushed: false, modeSwitched: false };

  const sessionPhone = String(session?.sender || session?.customer_phone || '').trim();
  if (!sessionPhone) return { sentCount: 0, waPushed: false, modeSwitched: false };

  const { messages: waMessages, stopNodeId, waitingTextInput, supported } = await buildCase2TriggerMessages(session, nextNodeId);
  if (!waMessages.length) return { sentCount: 0, waPushed: false, modeSwitched: false };

  const user = await User.findById(session.user_id).lean();
  const bot = await BotFlow.findById(session.flow_id).select('_id endpoint public_id user_id').lean();
  const { anySuccess: waPushed, wamidPerMsg } = await pushMessagesToWhatsApp(sessionPhone, waMessages, user, bot);

  const created = nowDate.toISOString();
  const historyEntries = waMessages.map((msg, i) => ({
    ...msg,
    sender: 'bot',
    name: 'בוט',
    node_id: 'system_case2_trigger',
    trigger_type: systemTrigger.type,
    created,
    wa_sent: waPushed,
    wamid: wamidPerMsg?.[i] || null,
    deliveryStatus: null
  }));

  const update = { $push: { process_history: { $each: historyEntries } } };

  // Hand the conversation back to the interactive bot engine so the customer
  // can actually respond to the menu/input step the trigger landed on. We
  // snapshot the current rep assignment so the "extend_30m" rep action can
  // restore it later (state machine: waiting → bot → waiting).
  const modeSwitched = !!(supported && stopNodeId);
  if (modeSwitched) {
    update.$set = {
      bot_override: {
        active: true,
        reason: 'case2_waiting_30m',
        started_at: nowDate,
        prev_rep_group_id: session.rep_group_id || null,
        prev_rep_user_id: session.rep_user_id || null,
        prev_status: session.status || 'waiting'
      },
      is_agent: false,
      agent_since: null,
      status: 'bot',
      current_node_id: stopNodeId,
      waiting_text_input: waitingTextInput,
      waiting_webservice: false,
      execution_stack: []
    };
  }

  await mongoose.connection.collection('BotSession').updateOne(
    { _id: session._id },
    update
  );

  if (String(session?.user_id || '').trim()) {
    eventBus.emit('session:update', {
      userId: String(session.user_id),
      phone: sessionPhone
    });
  }

  return { sentCount: historyEntries.length, waPushed, modeSwitched };
};

const getCase2SystemTriggerConfig = async (session) => {
  if (!session?.flow_id) return null;
  try {
    const autoNode = await Widget.findOne({
      flow_id: String(session.flow_id),
      user_id: String(session.user_id || ''),
      type: 'automatic_responses'
    }).lean();
    const triggerType = autoNode?.image_file?.systemTriggerType || autoNode?.data?.systemTriggerType;
    if (triggerType === 'case2_waiting_30m') {
      const triggerOption = autoNode?.id
        ? await Option.findOne({
          widget_id: autoNode.id,
          operator: 'system_trigger',
          value: triggerType
        }).lean()
        : null;
      return {
        type: triggerType,
        label: 'תגובה לאחר המתנה ללא מענה נציג',
        nextNodeId: triggerOption?.next || null
      };
    }
  } catch (err) {
    console.error('[sessionCase2Trigger] lookup error:', err.message);
  }
  return null;
};

const processCase1ReminderCandidate = async (candidate, now) => {
  const collection = mongoose.connection.collection('BotSession');
  const nowDate = new Date(now);
  const claimUntil = new Date(now + CASE1_CLAIM_MS);
  const reminderBlock = candidate.reminder_case1 || {};

  const claimed = await collection.findOneAndUpdate(
    {
      _id: candidate._id,
      ...buildReminderClaimQuery('reminder_case1', nowDate)
    },
    {
      $set: { 'reminder_case1.claim_until': claimUntil }
    },
    { returnDocument: 'after' }
  );
  if (!claimed) return;

  const history = Array.isArray(claimed.process_history) ? claimed.process_history : [];
  const lastSpeaker = getLastRelevantSpeaker(history);

  if (!lastSpeaker || lastSpeaker.sender !== 'agent') {
    await collection.updateOne(
      { _id: claimed._id },
      {
        $set: {
          'reminder_case1.next_due_at': new Date(now + CASE1_REMINDER_MS),
          'reminder_case1.claim_until': null
        }
      }
    );
    return;
  }

  const repMessageAt = lastSpeaker.createdAt;
  if (!repMessageAt) {
    await collection.updateOne(
      { _id: claimed._id },
      {
        $set: {
          'reminder_case1.next_due_at': new Date(now + CASE1_REMINDER_MS),
          'reminder_case1.claim_until': null
        }
      }
    );
    return;
  }

  const silenceMs = now - repMessageAt.getTime();
  const recipientUserId = lastSpeaker.agentUserId || String(claimed.rep_user_id || '').trim() || null;

  if (silenceMs < CASE1_REMINDER_MS || !recipientUserId) {
    const nextDueAt = silenceMs < CASE1_REMINDER_MS
      ? new Date(repMessageAt.getTime() + CASE1_REMINDER_MS)
      : new Date(now + CASE1_REMINDER_MS);
    await collection.updateOne(
      { _id: claimed._id },
      {
        $set: {
          'reminder_case1.last_rep_message_at': repMessageAt,
          'reminder_case1.last_rep_user_id': recipientUserId,
          'reminder_case1.next_due_at': nextDueAt,
          'reminder_case1.claim_until': null
        }
      }
    );
    return;
  }

  const nextDueAt = new Date(now + CASE1_REMINDER_MS);
  const notif = await Notification.create({
    user_id: recipientUserId,
    session_id: String(claimed._id),
    session_phone: String(claimed.sender || claimed.customer_phone || ''),
    from_user_name: 'מערכת',
    target_label: 'תזכורת המשך טיפול',
    is_simulator: String(claimed.sender || claimed.customer_phone || '').toLowerCase() === 'simulated',
    type: 'session_case1_reminder',
    actions: ['close', 'extend_30m'],
    reminder_case: 1,
    reminder_next_due_at: nextDueAt,
    reminder_count: Number(reminderBlock.reminded_count || 0) + 1
  });

  eventBus.emit('notification:new', { userId: recipientUserId, notification: notif.toObject() });

  await collection.updateOne(
    { _id: claimed._id },
    {
      $set: {
        'reminder_case1.last_rep_message_at': repMessageAt,
        'reminder_case1.last_rep_user_id': recipientUserId,
        'reminder_case1.last_notified_at': nowDate,
        'reminder_case1.next_due_at': nextDueAt,
        'reminder_case1.claim_until': null
      },
      $inc: { 'reminder_case1.reminded_count': 1 }
    }
  );
};

const processCase2ReminderCandidate = async (candidate, now) => {
  const collection = mongoose.connection.collection('BotSession');
  const nowDate = new Date(now);
  const claimUntil = new Date(now + CASE1_CLAIM_MS);
  const reminderBlock = candidate.reminder_case2 || {};

  const claimed = await collection.findOneAndUpdate(
    {
      _id: candidate._id,
      ...buildReminderClaimQuery('reminder_case2', nowDate)
    },
    {
      $set: { 'reminder_case2.claim_until': claimUntil }
    },
    { returnDocument: 'after' }
  );
  if (!claimed) return;

  const history = Array.isArray(claimed.process_history) ? claimed.process_history : [];
  const lastSpeaker = getLastRelevantSpeaker(history);

  if (!lastSpeaker || lastSpeaker.sender !== 'user') {
    // Rep already answered (or no relevant messages yet) — clear the one-time
    // notification flag so the next silent stretch gets a fresh notification.
    await collection.updateOne(
      { _id: claimed._id },
      {
        $set: {
          'reminder_case2.next_due_at': new Date(now + CASE2_REMINDER_MS),
          'reminder_case2.claim_until': null,
          'reminder_case2.notified_at': null
        }
      }
    );
    return;
  }

  const customerMessageAt = lastSpeaker.createdAt;
  if (!customerMessageAt) {
    await collection.updateOne(
      { _id: claimed._id },
      {
        $set: {
          'reminder_case2.next_due_at': new Date(now + CASE2_NOTIFY_MS),
          'reminder_case2.claim_until': null
        }
      }
    );
    return;
  }

  const silenceMs = now - customerMessageAt.getTime();
  const alreadyNotified = !!reminderBlock.notified_at;

  // ── Stage 1: one-time rep notification after CASE2_NOTIFY_MINUTES (10m) of
  // unanswered customer silence. Fires only once per silent stretch — cleared
  // above whenever a rep replies.
  if (!alreadyNotified) {
    if (silenceMs < CASE2_NOTIFY_MS) {
      await collection.updateOne(
        { _id: claimed._id },
        {
          $set: {
            'reminder_case2.last_customer_message_at': customerMessageAt,
            'reminder_case2.next_due_at': new Date(customerMessageAt.getTime() + CASE2_NOTIFY_MS),
            'reminder_case2.claim_until': null
          }
        }
      );
      return;
    }

    const recipients = await buildCase2Recipients(claimed);
    const sessionPhone = String(claimed.sender || claimed.customer_phone || '');
    const isSimulatorSession = sessionPhone === 'Simulated' || sessionPhone === 'simulator' || sessionPhone.toLowerCase() === 'simulated';
    for (const recipientUserId of recipients) {
      // eslint-disable-next-line no-await-in-loop
      const notif = await Notification.create({
        user_id: recipientUserId,
        session_id: String(claimed._id),
        session_phone: sessionPhone,
        from_user_name: 'מערכת',
        target_label: 'המשתמש מחכה למענה',
        is_simulator: isSimulatorSession,
        type: 'session_case2_waiting',
        actions: [],
        reminder_case: 2,
        reminder_next_due_at: new Date(customerMessageAt.getTime() + CASE2_REMINDER_MS),
        reminder_count: Number(reminderBlock.reminded_count || 0) + 1
      });
      eventBus.emit('notification:new', { userId: recipientUserId, notification: notif.toObject() });
    }

    await collection.updateOne(
      { _id: claimed._id },
      {
        $set: {
          'reminder_case2.last_customer_message_at': customerMessageAt,
          'reminder_case2.notified_at': nowDate,
          'reminder_case2.last_notified_at': nowDate,
          'reminder_case2.next_due_at': new Date(customerMessageAt.getTime() + CASE2_REMINDER_MS),
          'reminder_case2.claim_until': null
        },
        $inc: { 'reminder_case2.reminded_count': 1 }
      }
    );
    return;
  }

  // ── Stage 2: after CASE2_REMINDER_MINUTES (30m) of total silence, fire the
  // "automatic responses" system trigger connected to the
  // "תגובה לאחר המתנה ללא מענה נציג" option — only if a node is actually
  // connected to that handle (Option.next). The one-time rep notification
  // already went out at the 10m mark, so this stage never sends another one.
  if (silenceMs < CASE2_REMINDER_MS) {
    await collection.updateOne(
      { _id: claimed._id },
      {
        $set: {
          'reminder_case2.next_due_at': new Date(customerMessageAt.getTime() + CASE2_REMINDER_MS),
          'reminder_case2.claim_until': null
        }
      }
    );
    return;
  }

  const systemTrigger = await getCase2SystemTriggerConfig(claimed);
  if (systemTrigger?.nextNodeId) {
    const triggerHistoryEntry = {
      type: 'System',
      text: `טריגר מערכת הופעל: ${systemTrigger.label}`,
      sender: 'system',
      name: 'מערכת',
      node_id: 'system',
      event: 'case2_system_trigger_detected',
      trigger_type: systemTrigger.type,
      created: nowDate.toISOString()
    };
    await collection.updateOne(
      { _id: claimed._id },
      { $push: { process_history: triggerHistoryEntry } }
    );
    try {
      const triggerResult = await runCase2SystemTrigger(claimed, systemTrigger, nowDate);
      if (triggerResult?.modeSwitched) {
        // Session was handed back to the interactive bot — it's no longer
        // rep-waiting, so clear both reminder timers.
        await collection.updateOne(
          { _id: claimed._id },
          {
            $set: {
              'reminder_case1.next_due_at': null,
              'reminder_case1.claim_until': null,
              'reminder_case2.next_due_at': null,
              'reminder_case2.claim_until': null,
              'reminder_case2.notified_at': null
            }
          }
        );
        return;
      }
    } catch (err) {
      console.error('[sessionCase2Trigger] execution error:', err.message);
    }
  }

  // No node is connected to the system-trigger option (or none configured) —
  // there's nothing left to send automatically for this stretch. The one-time
  // notification already went out at the 10m mark, so avoid rechecking every
  // minute; re-check once a day in case a trigger gets connected later while
  // the customer is still waiting.
  await collection.updateOne(
    { _id: claimed._id },
    {
      $set: {
        'reminder_case2.next_due_at': new Date(now + 24 * 60 * 60 * 1000),
        'reminder_case2.claim_until': null
      }
    }
  );
};

const runCase1ReminderTicker = async () => {
  if (!CASE1_ENABLED) return;
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;

  const nowDate = new Date();
  const collection = mongoose.connection.collection('BotSession');
  const candidates = await collection.find(
    {
      ...buildReminderClaimQuery('reminder_case1', nowDate)
    },
    {
      projection: {
        _id: 1,
        user_id: 1,
        sender: 1,
        customer_phone: 1,
        rep_user_id: 1,
        process_history: 1,
        reminder_case1: 1
      }
    }
  )
    .sort({ 'reminder_case1.next_due_at': 1, updatedAt: 1 })
    .limit(150)
    .toArray();

  for (const candidate of candidates) {
    try {
      // Sequential by design to keep DB contention and duplicate risk low.
      // eslint-disable-next-line no-await-in-loop
      await processCase1ReminderCandidate(candidate, nowDate.getTime());
    } catch (err) {
      console.error('[sessionCase1Reminder] candidate error:', err.message);
    }
  }
};

const runCase2ReminderTicker = async () => {
  if (!CASE2_ENABLED) return;
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;

  const nowDate = new Date();
  const collection = mongoose.connection.collection('BotSession');
  const candidates = await collection.find(
    {
      ...buildReminderClaimQuery('reminder_case2', nowDate)
    },
    {
      projection: {
        _id: 1,
        user_id: 1,
        sender: 1,
        customer_phone: 1,
        rep_user_id: 1,
        rep_group_id: 1,
        process_history: 1,
        reminder_case2: 1
      }
    }
  )
    .sort({ 'reminder_case2.next_due_at': 1, updatedAt: 1 })
    .limit(150)
    .toArray();

  for (const candidate of candidates) {
    try {
      // Sequential by design to keep DB contention and duplicate risk low.
      // eslint-disable-next-line no-await-in-loop
      await processCase2ReminderCandidate(candidate, nowDate.getTime());
    } catch (err) {
      console.error('[sessionCase2Reminder] candidate error:', err.message);
    }
  }
};

setInterval(() => {
  runCase1ReminderTicker().catch((err) => {
    console.error('[sessionCase1Reminder] ticker error:', err.message);
  });
  runCase2ReminderTicker().catch((err) => {
    console.error('[sessionCase2Reminder] ticker error:', err.message);
  });
}, CASE1_TICK_MS);

export const startSession = async (req, res) => {
  // Safe extraction: explicitly check for req.user to avoid 'undefined' values in DB insert
  const userId = (req.user && req.user.id) ? req.user.id : null;
  const { customer_phone, widget_id, simulator_id } = req.body;

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`[startSession] 🆕 New session request @ ${new Date().toISOString()}`);
  console.log(`[startSession]    customer_phone = ${customer_phone || '(none)'}`);
  console.log(`[startSession]    widget_id      = ${widget_id || '(none)'}`);
  console.log(`[startSession]    simulator_id   = ${simulator_id || '(none)'}`);
  console.log(`[startSession]    user_id        = ${userId || '(guest)'}`);
  console.log(`[startSession]    ip             = ${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`);

  if (!widget_id) {
    console.log(`[startSession] ❌ Missing widget_id — rejected`);
    console.log(`${'─'.repeat(80)}\n`);
    return res.status(400).json({ error: 'חסר מזהה ווידג\'ט' });
  }

  try {
    // Ensure mongoose is connected
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      console.log(`[startSession] ❌ DB not ready (state=${mongoose.connection?.readyState})`);
      console.log(`${'─'.repeat(80)}\n`);
      return res.status(503).json({ error: 'החיבור למסד הנתונים אינו מוכן' });
    }
    
    const collection = mongoose.connection.collection('BotSession');
    
    const sessionData = {
      user_id: userId, // Will be null if guest, which is valid for MongoDB
      customer_phone: customer_phone || 'Simulated',
      widget_id: widget_id,
      parameters: simulator_id ? { _simulatorId: simulator_id } : {},
      process_history: [],
      created_at: new Date()
    };
    
    // Add simulator_id as a top-level field for easy filtering
    if (simulator_id) {
      sessionData.simulator_id = simulator_id;
    }
    
    const result = await collection.insertOne(sessionData);
    const sessionId = result.insertedId.toString();
    console.log(`[startSession] ✅ Session created | sessionId=${sessionId} | phone=${sessionData.customer_phone} | widget=${widget_id}`);
    console.log(`${'─'.repeat(80)}\n`);
    res.json({ sessionId });
  } catch (err) {
    console.error(`[startSession] ❌ Error creating session for phone=${customer_phone || '(none)'} widget=${widget_id}:`, err);
    console.log(`${'─'.repeat(80)}\n`);
    res.status(500).json({ error: err.message });
  }
};

export const updateSessionParameters = async (req, res) => {
  const { sessionId, parameters } = req.body;
  
  console.log('[updateSessionParameters] Request:', { sessionId, parametersKeys: Object.keys(parameters || {}) });
  
  if (!sessionId) {
    console.log('[updateSessionParameters] No sessionId provided, skipping update');
    return res.json({ success: true, skipped: true });
  }
  
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    console.error('[updateSessionParameters] Invalid sessionId format:', sessionId);
    return res.status(400).json({ error: 'פורמט מזהה שיחה אינו תקין' });
  }

  try {
    // Ensure mongoose is connected
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      console.error('[updateSessionParameters] Database not connected, readyState:', mongoose.connection?.readyState);
      return res.status(503).json({ error: 'החיבור למסד הנתונים אינו מוכן' });
    }
    
    const collection = mongoose.connection.collection('BotSession');
    
    const result = await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(sessionId) },
      { $set: { parameters: parameters || {} } }
    );
    
    console.log('[updateSessionParameters] Update result:', { matched: result.matchedCount, modified: result.modifiedCount });
    res.json({ success: true });
  } catch (err) {
    console.error("Update Parameters Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const addHistoryMessage = async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId) return res.json({ success: true, skipped: true });

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId format' });
  }

  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection not ready' });
    }

    const collection = mongoose.connection.collection('BotSession');

    const entry = {
      ...message,
      created: message.created || new Date().toISOString()
    };

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(sessionId) },
      { $push: { process_history: entry } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("addHistoryMessage Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getContacts = async (req, res) => {
  const userId = getEffectiveUserId(req);
  console.log(`[getContacts] userId=${userId} | reqUserId=${req.userId} | role=${req.user?.role} | manager_id=${req.user?.manager_id}`);
  try {
    // Get all bots owned by this user
    const userBots = await BotFlow.find({ user_id: userId });
    const botNameMap = {};
    userBots.forEach(b => { botNameMap[b._id.toString()] = b.name; });
    const botIds = userBots.map(b => b._id.toString());
    console.log(`[getContacts] userBots=${userBots.length} | botIds=${JSON.stringify(botIds)}`);

    // Get all widget_ids that belong to the user's bots
    // (covers historical sessions saved before user_id was stored properly)
    const userWidgets = await Widget.find({
      $or: [
        { user_id: userId },
        { user_id: userId.toString() },
        { flow_id: { $in: botIds } }
      ]
    }).select('id flow_id');

    const widgetIds = userWidgets.map(w => w.id).filter(Boolean);
    const widgetFlowMap = {};
    userWidgets.forEach(w => { if (w.id) widgetFlowMap[w.id] = w.flow_id; });

    const collection = mongoose.connection.collection('BotSession');

    const pipeline = [
      {
        $match: {
          $or: [
            { user_id: userId },
            { user_id: userId.toString() },
            { widget_id: { $in: widgetIds } },
            { flow_id: { $in: botIds } }
          ]
        }
      },
      {
        // $addFields: {
// <<<<<<< HEAD
//           phone: { $ifNull: ['$customer_phone', { $ifNull: ['$sender', 'לא ידוע'] }] },
//           _date: { $ifNull: ['$created_at', '$createdAt'] }
// =======
//           // Group by sender (the person who sent the message), not by phone (bot's number)
//           contactKey: { $ifNull: ['$sender', { $ifNull: ['$customer_phone', 'לא ידוע'] }] }
// >>>>>>> 262e9fa241deec57219c8eb135b28d23f0979710
        // }
        $addFields: {
  // מקבץ לפי השולח (האדם שיצר קשר), לא לפי מספר הבוט
  contactKey: { $ifNull: ['$sender', { $ifNull: ['$customer_phone', 'לא ידוע'] }] },
  _date: { $ifNull: ['$created_at', '$createdAt'] }
}
      },
      // Sort newest-first so $first inside $group returns the latest session's status
      { $sort: { _date: -1 } },
      {
        $group: {
          _id: '$contactKey',
          sessionCount: { $sum: 1 },
          lastSeen: { $max: '$_date' },
          widgetIds: { $addToSet: '$widget_id' },
          flowIds: { $addToSet: '$flow_id' },
          repGroupIds: { $addToSet: '$rep_group_id' },
          repUserIds: { $addToSet: '$rep_user_id' },
          customerPhones: { $addToSet: '$customer_phone' },
          // Status of the most recent session for this contact
          latestStatus: { $first: '$status' },
          latestSessionDate: { $first: '$_date' },
          latestWantsPhone: { $first: '$wants_phone' }
        }
      }, 
      { $sort: { lastSeen: -1 } }
    ];

    const contacts = await collection.aggregate(pipeline).toArray();
    console.log(`[getContacts] aggregation returned ${contacts.length} contacts`);

    // Map widget_ids → bot names via widgetFlowMap, with fallback to session flow_id
    // (WhatsApp sessions created via respondToMessage set flow_id but NOT widget_id)
    const result = contacts.map(c => {
      const usedBotIds = new Set([
        ...(c.widgetIds || [])
          .map(wid => widgetFlowMap[wid])
          .filter(fid => fid && botNameMap[fid]),
        ...(c.flowIds || [])
          .filter(fid => fid && botNameMap[fid])
      ]);
      return {
        phone: c._id,
        sessionCount: c.sessionCount,
        lastSeen: c.lastSeen,
        bots: [...usedBotIds].map(id => ({ id, name: botNameMap[id] })),
        botPhones: (c.customerPhones || []).filter(p => p && p !== 'Simulated' && p !== 'simulated'),
        repGroupIds: (c.repGroupIds || []).filter(Boolean).map(String),
        repUserIds: (c.repUserIds || []).filter(Boolean).map(String),
        status: c.latestStatus || 'bot',
        wants_phone: !!c.latestWantsPhone
      };
    });

    // Enrich with assigned_to from Contact collection
    const phones = result.map(c => c.phone);
    const contactDocs = await Contact.find({ user_id: userId, phone: { $in: phones } }).select('phone assigned_to whatsapp_name full_name').lean();
    const assignedToMap = {};
    const whatsappNameMap = {};
    const fullNameMap = {};
    contactDocs.forEach(c => {
      assignedToMap[c.phone] = (c.assigned_to || []).map(id => id.toString());
      whatsappNameMap[c.phone] = c.whatsapp_name || '';
      fullNameMap[c.phone] = c.full_name || '';
    });

    let finalResult = result.map(c => ({
      ...c,
      assigned_to: assignedToMap[c.phone] || [],
      whatsapp_name: whatsappNameMap[c.phone] || '',
      full_name: fullNameMap[c.phone] || '',
    }));

    // Fetch rep user doc once (used for both restrictions below)
    const userDoc = await User.findById(req.userId).lean();
    const perms = await resolvePermissions(userDoc || { role: req.user?.role });

    // If rep has allowed_bot_ids restriction, keep only contacts whose sessions belong to those bots
    const repAllowedBotIds = (userDoc?.allowed_bot_ids || []).map(id => id.toString());
    console.log(`[getContacts] repAllowedBotIds=${JSON.stringify(repAllowedBotIds)} | finalResult before filter=${finalResult.length}`);
    console.log(`[getContacts] sample bots:`, finalResult.slice(0,3).map(c=>({phone:c.phone, bots:c.bots})));
    if (repAllowedBotIds.length > 0) {
      const allowedBotSet = new Set(repAllowedBotIds);
      finalResult = finalResult.filter(c =>
        (c.bots || []).some(b => allowedBotSet.has(b.id))
      );
    }

    // Restrict to assigned-only conversations based on the actual granted permission
    // (view_assigned_only without view_all) — NOT the raw role. Some accounts use a
    // custom user type whose base role is 'rep' but has been explicitly granted
    // view_all by the account admin (used to build a fuller shift-manager role), and
    // that grant must be respected.
    const viewOnlyAssigned = hasPermission(perms, 'sessions.view_assigned_only') && !hasPermission(perms, 'sessions.view_all');
    console.log(`[getContacts] perms.sessions=${JSON.stringify(perms?.sessions)} | viewOnlyAssigned=${viewOnlyAssigned} | finalResult=${finalResult.length}`);
    if (viewOnlyAssigned) {
      const repId = req.userId;
      const repGroupSet = new Set(((userDoc?.rep_group_ids) || []).map(id => id.toString()));
      finalResult = finalResult.filter(c =>
        c.assigned_to.includes(repId) ||
        (c.repUserIds || []).includes(repId) ||
        (c.repGroupIds || []).some(gid => repGroupSet.has(gid))
      );
    }

    res.json(finalResult);
  } catch (err) {
    console.error('getContacts error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── Search message content ─────────────────────────────────────────────────────
// GET /api/sessions/search-messages?q=<text>&mode=basic|advanced&from=<date>&to=<date>
// mode=basic  → search within the 50 most recent messages across last 30 sessions
// mode=advanced → search within a custom date range (max 6 months)
export const searchMessageContent = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const q = (req.query.q || '').trim();
  const mode = req.query.mode || 'basic';
  if (!q || q.length < 2) return res.json([]);

  try {
    const userBots = await BotFlow.find({ user_id: userId });
    const botIds = userBots.map(b => b._id.toString());
    const userWidgets = await Widget.find({
      $or: [
        { user_id: userId },
        { user_id: userId.toString() },
        { flow_id: { $in: botIds } }
      ]
    }).select('id flow_id');
    const widgetIds = userWidgets.map(w => w.id).filter(Boolean);

    const collection = mongoose.connection.collection('BotSession');
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const userFilter = {
      $or: [
        { user_id: userId },
        { user_id: userId.toString() },
        { widget_id: { $in: widgetIds } },
        { flow_id: { $in: botIds } }
      ]
    };

    let sessions = [];

    if (mode === 'basic') {
      // Fetch the 30 most recent sessions and search within last 50 messages total
      const recentSessions = await collection
        .find(userFilter, { projection: { customer_phone: 1, sender: 1, process_history: 1, created_at: 1 } })
        .sort({ created_at: -1 })
        .limit(30)
        .toArray();

      let totalMsgs = 0;
      for (const s of recentSessions) {
        if (totalMsgs >= 50) break;
        const remaining = 50 - totalMsgs;
        const slicedHistory = (s.process_history || []).slice(-remaining);
        totalMsgs += slicedHistory.length;
        if (slicedHistory.some(h => regex.test(h.text || h.content || ''))) {
          sessions.push({ ...s, process_history: slicedHistory });
        }
      }
    } else {
      // Advanced: validate and apply date range (max 6 months)
      const sixMonthsMs = 183 * 24 * 60 * 60 * 1000;
      const since = req.query.from ? new Date(req.query.from) : new Date(Date.now() - sixMonthsMs);
      const until = req.query.to ? new Date(req.query.to) : new Date();
      if (since >= until) return res.status(400).json({ error: 'תאריך התחלה חייב להיות לפני תאריך סיום' });
      if ((until.getTime() - since.getTime()) > sixMonthsMs) {
        return res.status(400).json({ error: 'טווח תאריכים מקסימלי הוא 6 חודשים' });
      }
      sessions = await collection.find({
        $and: [
          userFilter,
          { $or: [{ created_at: { $gte: since, $lte: until } }, { createdAt: { $gte: since, $lte: until } }] },
          { process_history: { $elemMatch: { $or: [{ text: regex }, { content: regex }] } } }
        ]
      }, { projection: { customer_phone: 1, sender: 1, process_history: 1, created_at: 1 } }).limit(300).toArray();
    }

    // Enrich with contact names
    const phones = [...new Set(sessions.map(s => s.sender || s.customer_phone).filter(Boolean))];
    const contactDocs = await Contact.find({ user_id: userId, phone: { $in: phones } })
      .select('phone whatsapp_name full_name').lean();
    const nameMap = {};
    contactDocs.forEach(c => { nameMap[c.phone] = { whatsapp_name: c.whatsapp_name || '', full_name: c.full_name || '' }; });

    // Group by contact phone, extract best matching snippet
    const byPhone = {};
    for (const s of sessions) {
      const phone = s.sender || s.customer_phone;
      if (!phone) continue;
      if (!byPhone[phone]) byPhone[phone] = { phone, snippet: null, matchCount: 0, ...nameMap[phone] };
      for (const h of (s.process_history || [])) {
        const txt = h.text || h.content || '';
        if (regex.test(txt)) {
          byPhone[phone].matchCount++;
          if (!byPhone[phone].snippet) {
            const idx = txt.search(regex);
            const start = Math.max(0, idx - 20);
            const end = Math.min(txt.length, idx + q.length + 40);
            byPhone[phone].snippet = (start > 0 ? '...' : '') + txt.slice(start, end) + (end < txt.length ? '...' : '');
          }
        }
      }
    }

    res.json(Object.values(byPhone));
  } catch (err) {
    console.error('searchMessageContent error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getUserSessions = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const PAGE_SIZE = 10;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const search = (req.query.search || '').trim();

    // Build lookup maps
    const [userBots, userWidgets] = await Promise.all([
      BotFlow.find({ user_id: userId }).lean(),
      Widget.find({
        $or: [
          { user_id: userId },
          { user_id: userId.toString() }
        ]
      }).select('id flow_id').lean()
    ]);

    const botNameMap = {};
    userBots.forEach(b => { botNameMap[b._id.toString()] = b.name; });
    const botIds = userBots.map(b => b._id.toString());

    // Also include widgets whose flow belongs to the user
    const botWidgets = await Widget.find({ flow_id: { $in: botIds } }).select('id flow_id').lean();
    const allWidgets = [...userWidgets, ...botWidgets];
    const widgetIds = [...new Set(allWidgets.map(w => w.id).filter(Boolean))];
    const widgetFlowMap = {};
    allWidgets.forEach(w => { if (w.id) widgetFlowMap[w.id] = w.flow_id; });

    const collection = mongoose.connection.collection('BotSession');

    const matchStage = {
      $or: [
        { user_id: userId },
        { user_id: userId.toString() },
        { widget_id: { $in: widgetIds } },
        { flow_id: { $in: botIds } }
      ]
    };

    const pipeline = [
      { $match: matchStage },
      // Normalise the date field — documents use either created_at or createdAt
      { $addFields: { _sortDate: { $ifNull: ['$created_at', '$createdAt'] } } },
      { $sort: { _sortDate: -1 } },
      // Inline search filter (regex on phone field)
      ...(search ? [{
        $match: {
          $or: [
            { customer_phone: { $regex: search, $options: 'i' } },
            { sender: { $regex: search, $options: 'i' } },
            { widget_id: { $in: widgetIds.filter(id => {
              const fid = widgetFlowMap[id];
              return fid && botNameMap[fid]?.toLowerCase().includes(search.toLowerCase());
            }) } }
          ]
        }
      }] : []),
      // Count + paginate in one pass using $facet
      {
        $facet: {
          meta: [{ $count: 'total' }],
          data: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }]
        }
      }
    ];

    const [result] = await collection.aggregate(pipeline).toArray();
    const total = result.meta[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);

    const sessions = result.data.map(s => {
      const flowId = widgetFlowMap[s.widget_id] || s.flow_id;
      const botName = flowId ? botNameMap[flowId] : null;
      return {
        id: s._id.toString(),
        phone: s.sender || s.customer_phone || 'לא ידוע', // Display sender first
        sender: s.sender || null,
        customer_phone: s.customer_phone || null,
        widget_id: s.widget_id,
        bot_name: botName || 'לא ידוע',
        created_at: s.created_at || s.createdAt,
        parameters: s.parameters || {},
        process_history: s.process_history || []
      };
    });

    res.json({ sessions, total, page: safePage, totalPages });
  } catch (err) {
    console.error('getUserSessions error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getAllSessions = async (req, res) => {
  // Admin-only: returns paginated sessions with optional search
  try {
    const PAGE_SIZE = 6;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const search = (req.query.search || '').trim();

    const collection = mongoose.connection.collection('BotSession');

    // Build lookup maps once (parallel)
    const [allBots, allWidgets, allUsers] = await Promise.all([
      BotFlow.find({}).lean(),
      Widget.find({}).select('id flow_id user_id').lean(),
      User.find({}).select('_id name email').lean()
    ]);

    const botNameMap = {};
    const botUserMap = {};
    allBots.forEach(b => {
      botNameMap[b._id.toString()] = b.name;
      botUserMap[b._id.toString()] = b.user_id?.toString();
    });

    const widgetFlowMap = {};
    allWidgets.forEach(w => { if (w.id) widgetFlowMap[w.id] = w.flow_id; });

    const userNameMap = {};
    allUsers.forEach(u => { userNameMap[u._id.toString()] = u.name || u.email; });

    // Build DB-level match conditions that cover phone, bot name, and user name
    let matchStage = null;
    if (search) {
      const searchLower = search.toLowerCase();

      // Bot IDs whose name matches the search
      const matchingBotIds = allBots
        .filter(b => b.name?.toLowerCase().includes(searchLower))
        .map(b => b._id.toString());

      // User IDs whose name/email matches the search
      const matchingUserIds = allUsers
        .filter(u => (u.name || u.email || '').toLowerCase().includes(searchLower))
        .map(u => u._id.toString());

      // Also include bots owned by matching users
      const botIdsFromUsers = allBots
        .filter(b => matchingUserIds.includes(b.user_id?.toString()))
        .map(b => b._id.toString());

      const allMatchingBotIds = [...new Set([...matchingBotIds, ...botIdsFromUsers])];

      // Widget IDs that map to matching bots
      const matchingWidgetIds = allWidgets
        .filter(w => allMatchingBotIds.includes(w.flow_id?.toString()))
        .map(w => w.id);

      const orConditions = [
        { sender: { $regex: search, $options: 'i' } },
        { customer_phone: { $regex: search, $options: 'i' } },
      ];
      if (matchingWidgetIds.length > 0) {
        orConditions.push({ widget_id: { $in: matchingWidgetIds } });
      }
      if (allMatchingBotIds.length > 0) {
        orConditions.push({ flow_id: { $in: allMatchingBotIds } });
      }

      matchStage = { $or: orConditions };
    }

    const pipeline = [
      {
        $addFields: {
          _sortDate: { $ifNull: ['$created_at', '$createdAt'] },
          _phone: { $ifNull: ['$sender', { $ifNull: ['$customer_phone', 'לא ידוע'] }] }
        }
      },
      { $sort: { _sortDate: -1 } },
      ...(matchStage ? [{ $match: matchStage }] : []),
      {
        $facet: {
          meta: [{ $count: 'total' }],
          data: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }]
        }
      }
    ];

    const [result] = await collection.aggregate(pipeline).toArray();
    const rawData = result.data ?? [];
    const total = result.meta[0]?.total ?? 0;

    // Resolve bot / user names from lookup maps
    const sessions = rawData.map(s => {
      const flowId = widgetFlowMap[s.widget_id] || s.flow_id;
      const botName = flowId ? botNameMap[flowId] : null;
      const ownerId = flowId ? botUserMap[flowId] : s.user_id?.toString();
      const ownerName = ownerId ? userNameMap[ownerId] : null;
      return {
        id: s._id.toString(),
        phone: s._phone,
        sender: s.sender || null,
        widget_id: s.widget_id,
        bot_name: botName || 'לא ידוע',
        user_name: ownerName || 'לא ידוע',
        created_at: s.created_at || s.createdAt,
        parameters: s.parameters || {},
        process_history: s.process_history || [],
        is_active: s.is_active !== false
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);

    res.json({ sessions, total, page: safePage, totalPages });
  } catch (err) {
    console.error('getAllSessions error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getSessionsByPhone = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const phone = req.query.phone || '';
  const botId = req.query.botId || ''; // optional: filter to a specific bot/flow
  if (!phone) return res.status(400).json({ error: 'מספר טלפון הוא שדה חובה' });

  try {
    // Restricted to assigned-only conversations based on the actual granted permission
    // (view_assigned_only without view_all), matching the same rule enforced in
    // getContacts / getSessionWithOwnership. This also guards against reaching an
    // unassigned conversation directly (e.g. via a deep link) instead of only through
    // one's own filtered contacts list.
    const userDoc = await User.findById(req.userId).select('rep_group_ids role user_type_id').lean();
    const perms = await resolvePermissions(userDoc || { role: req.user?.role });
    const viewOnlyAssigned = hasPermission(perms, 'sessions.view_assigned_only') && !hasPermission(perms, 'sessions.view_all');

    let allowedByAssignment = true;
    let repGroupSet = null;
    if (viewOnlyAssigned) {
      const repId = req.userId;
      repGroupSet = new Set(((userDoc?.rep_group_ids) || []).map(id => id.toString()));
      const contactDoc = await Contact.findOne({ user_id: userId, phone }).select('assigned_to').lean();
      const assignedToRep = (contactDoc?.assigned_to || []).map(x => x.toString()).includes(repId);
      allowedByAssignment = assignedToRep; // may still be true via a session's own rep_user_id/rep_group_id, checked below
    }

    const [userBots, userWidgets] = await Promise.all([
      BotFlow.find({ user_id: userId }).lean(),
      Widget.find({ $or: [{ user_id: userId }, { user_id: userId.toString() }] }).select('id flow_id').lean()
    ]);

    const botNameMap = {};
    userBots.forEach(b => { botNameMap[b._id.toString()] = b.name; });
    const botIds = userBots.map(b => b._id.toString());

    const botWidgets = await Widget.find({ flow_id: { $in: botIds } }).select('id flow_id').lean();
    const allWidgets = [...userWidgets, ...botWidgets];
    const widgetIds = [...new Set(allWidgets.map(w => w.id).filter(Boolean))];
    const widgetFlowMap = {};
    allWidgets.forEach(w => { if (w.id) widgetFlowMap[w.id] = w.flow_id; });

    // If botId provided, compute widget IDs that belong specifically to that bot
    const botWidgetIds = botId
      ? allWidgets.filter(w => w.flow_id?.toString() === botId).map(w => w.id).filter(Boolean)
      : null;

    const collection = mongoose.connection.collection('BotSession');

    // Build match: contact phone + user ownership + optional bot filter
    const matchConditions = [
      { $or: [{ customer_phone: phone }, { sender: phone }] },
      {
        $or: [
          { user_id: userId },
          { user_id: userId.toString() },
          { widget_id: { $in: widgetIds } }
        ]
      }
    ];

    if (botId && botWidgetIds !== null) {
      // Filter to sessions belonging to this specific bot (by flow_id or widget_id)
      const botOrConditions = [{ flow_id: botId }];
      if (botWidgetIds.length > 0) botOrConditions.push({ widget_id: { $in: botWidgetIds } });
      matchConditions.push({ $or: botOrConditions });
    }

    const sessions = await collection.aggregate([
      { $match: { $and: matchConditions } },
      { $addFields: { _sortDate: { $ifNull: ['$created_at', '$createdAt', { $toDate: '$_id' }] } } },
      { $sort: { _sortDate: 1 } }
    ]).toArray();

    // Reps restricted to their own assignments: also allow if any session in this
    // conversation is pinned to them directly or to one of their rep groups.
    if (viewOnlyAssigned && !allowedByAssignment) {
      const repId = req.userId;
      allowedByAssignment = sessions.some(s =>
        String(s.rep_user_id || '') === repId ||
        (s.rep_group_id && repGroupSet.has(String(s.rep_group_id)))
      );
    }
    if (viewOnlyAssigned && !allowedByAssignment) {
      return res.json([]);
    }

    const result = sessions.map(s => {
      const flowId = widgetFlowMap[s.widget_id] || s.flow_id;
      const botName = flowId ? botNameMap[flowId] : null;
      return {
        id: s._id.toString(),
        phone: s.customer_phone || s.sender || phone,
        sender: s.sender || null,
        widget_id: s.widget_id,
        bot_name: botName || 'לא ידוע',
        created_at: s.created_at || s.createdAt,
        parameters: s.parameters || {},
        process_history: s.process_history || [],
        is_agent: s.is_agent || false,
        agent_since: s.agent_since || null,
        status: s.status || 'bot'
      };
    });

    res.json(result);
  } catch (err) {
    console.error('getSessionsByPhone error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const deactivateSession = async (req, res) => {
  // Public: mark a specific session as inactive (e.g., when user resets the simulator)
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'מזהה שיחה לא תקין' });
    }
    const collection = mongoose.connection.collection('BotSession');
    const result = await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { is_active: false, ended_at: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'השיחה לא נמצאה' });
    res.json({ success: true });
  } catch (err) {
    console.error('deactivateSession error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── Agent mode helpers ───────────────────────────────────────────────────────

// Resolves a session and verifies the requester can manage it.
// For company managers / admins / rep_managers: matches by user_id or by a widget
// belonging to one of the company's bots.
// For reps restricted to their own assignments (permission `sessions.view_assigned_only`
// without `sessions.view_all` — mirrors the same check used by getContacts so the
// conversations shown in the list match what the user is actually allowed to act on):
// the rep must additionally be involved in the session — either explicitly assigned
// (rep_user_id === me), the session's rep group, or Contact.assigned_to.
const getSessionWithOwnership = async (id, req) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'מזהה שיחה לא תקין', status: 400 };
  const collection = mongoose.connection.collection('BotSession');
  const session = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
  if (!session) return { error: 'השיחה לא נמצאה', status: 404 };

  // Effective owner = manager id for reps, own id for everyone else.
  const ownerId = getEffectiveUserId(req);

  const userBots = await BotFlow.find({ user_id: ownerId }).lean();
  const botIds = userBots.map(b => b._id.toString());
  const userWidgets = await Widget.find({ flow_id: { $in: botIds } }).select('id').lean();
  const widgetIds = userWidgets.map(w => w.id).filter(Boolean);

  const owned =
    session.user_id === ownerId ||
    session.user_id === String(ownerId) ||
    widgetIds.includes(session.widget_id);

  if (!owned) return { error: 'גישה נדחית', status: 403 };

  // Additional involvement guard — only for users actually restricted to their own
  // assignments (permission `sessions.view_assigned_only` without `sessions.view_all`),
  // matching the same rule enforced in getContacts. Based on the resolved permission
  // (custom user types included), not just the raw role.
  const userDoc = await User.findById(req.userId).select('rep_group_ids role user_type_id').lean();
  const perms = await resolvePermissions(userDoc || { role: req.user?.role });
  const viewOnlyAssigned = hasPermission(perms, 'sessions.view_assigned_only') && !hasPermission(perms, 'sessions.view_all');

  if (viewOnlyAssigned) {
    const repId = String(req.userId);
    const myGroups = new Set(((userDoc?.rep_group_ids) || []).map(g => g.toString()));
    const involvedDirect = String(session.rep_user_id || '') === repId;
    const involvedGroup =
      session.rep_group_id && myGroups.has(String(session.rep_group_id));
    // Also allow when the contact (phone) is assigned to this rep via Contact.assigned_to
    let involvedByAssignment = false;
    if (!involvedDirect && !involvedGroup) {
      const phone = session.sender || session.customer_phone;
      if (phone) {
        const contactDoc = await Contact.findOne({ user_id: ownerId, phone })
          .select('assigned_to').lean();
        const assigned = (contactDoc?.assigned_to || []).map(x => x.toString());
        involvedByAssignment = assigned.includes(repId);
      }
    }
    if (!involvedDirect && !involvedGroup && !involvedByAssignment) {
      return { error: 'אינך משויך לשיחה זו', status: 403 };
    }
  }

  return { session, collection };
};

export const setAgentMode = async (req, res) => {
  try {
    const { id } = req.params;
    const { session, collection, error, status } = await getSessionWithOwnership(id, req);
    if (error) return res.status(status).json({ error });

    const agent_since = new Date();
    // Setting agent mode marks the conversation as waiting for a rep response
    // (unless a rep already started handling it).
    const newStatus = session.status === 'handling' ? 'handling' : 'waiting';
    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          is_agent: true,
          agent_since,
          status: newStatus,
          'reminder_case1.next_due_at': null,
          'reminder_case1.claim_until': null,
          'reminder_case2.next_due_at': null,
          'reminder_case2.claim_until': null
        }
      }
    );
    eventBus.emit('session:update', { userId: String(req.userId), phone: String(session.sender || session.customer_phone || '') });
    res.json({ success: true, agent_since: agent_since.toISOString(), status: newStatus });
  } catch (err) {
    console.error('setAgentMode error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const clearAgentMode = async (req, res) => {
  try {
    const { id } = req.params;
    const { session, collection, error, status } = await getSessionWithOwnership(id, req);
    if (error) return res.status(status).json({ error });

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          is_agent: false,
          agent_since: null,
          status: 'bot',
          wants_phone: false,
          'reminder_case1.next_due_at': null,
          'reminder_case1.claim_until': null,
          'reminder_case2.next_due_at': null,
          'reminder_case2.claim_until': null
        }
      }
    );
    eventBus.emit('session:update', { userId: String(req.userId), phone: String(session.sender || session.customer_phone || '') });
    res.json({ success: true, status: 'bot' });
  } catch (err) {
    console.error('clearAgentMode error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Mark a conversation as closed by the representative (סיום שיחה).
// Also clears agent mode so the bot can resume on the next customer message.
export const closeConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { session, collection, error, status } = await getSessionWithOwnership(id, req);
    if (error) return res.status(status).json({ error });

    const now = new Date();
    const historyEntry = buildConversationClosedHistoryEntry(now);

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: buildConversationClosedSetFragment(now),
        $push: { process_history: historyEntry }
      }
    );
    eventBus.emit('session:update', { userId: String(req.userId), phone: String(session.sender || session.customer_phone || '') });
    res.json({ success: true, status: 'closed', historyEntry });
  } catch (err) {
    console.error('closeConversation error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const applyCase1ReminderAction = async ({ notificationId, userId, action }) => {
  if (!mongoose.Types.ObjectId.isValid(String(notificationId || ''))) {
    return { ok: false, status: 400, error: 'notification id לא תקין' };
  }
  if (!['close', 'extend_30m'].includes(String(action || ''))) {
    return { ok: false, status: 400, error: 'action לא תקין' };
  }

  const notif = await Notification.findOne({
    _id: String(notificationId),
    user_id: String(userId),
    dismissed: false,
    type: 'session_case1_reminder'
  });

  if (!notif) {
    return { ok: false, status: 404, error: 'התזכורת לא נמצאה' };
  }

  const sessionId = String(notif.session_id || '');
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    await Notification.updateOne({ _id: notif._id }, { $set: { dismissed: true } });
    return { ok: false, status: 400, error: 'session id בהתראה אינו תקין' };
  }

  const collection = mongoose.connection.collection('BotSession');
  const session = await collection.findOne({ _id: new mongoose.Types.ObjectId(sessionId) });
  if (!session) {
    await Notification.updateOne({ _id: notif._id }, { $set: { dismissed: true } });
    return { ok: false, status: 404, error: 'השיחה לא נמצאה' };
  }

  const now = new Date();
  let status = String(session.status || 'waiting');
  let historyEntry;

  if (action === 'close') {
    status = 'closed';
    historyEntry = {
      type: 'System',
      text: 'השיחה הסתיימה (מתוך תזכורת חוסר פעילות)',
      sender: 'system',
      name: 'מערכת',
      node_id: 'system',
      event: 'conversation_closed_by_reminder',
      reminder_case: 1,
      action_by_user_id: String(userId),
      created: now.toISOString()
    };

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(sessionId) },
      {
        $set: {
          is_agent: false,
          agent_since: null,
          status: 'closed',
          ended_at: now,
          'reminder_case1.next_due_at': null,
          'reminder_case1.claim_until': null,
          'reminder_case2.next_due_at': null,
          'reminder_case2.claim_until': null
        },
        $push: { process_history: historyEntry }
      }
    );
  } else {
    const nextDueAt = new Date(now.getTime() + CASE1_REMINDER_MS);
    historyEntry = {
      type: 'System',
      text: 'זמן ההמתנה הוארך ב-30 דקות',
      sender: 'system',
      name: 'מערכת',
      node_id: 'system',
      event: 'conversation_wait_extended_by_reminder',
      reminder_case: 1,
      action_by_user_id: String(userId),
      created: now.toISOString()
    };

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(sessionId) },
      {
        $set: {
          'reminder_case1.next_due_at': nextDueAt,
          'reminder_case1.claim_until': null,
          'reminder_case1.last_notified_at': now,
          'reminder_case2.next_due_at': null,
          'reminder_case2.claim_until': null
        },
        $push: { process_history: historyEntry }
      }
    );
  }

  await Notification.updateMany(
    {
      session_id: sessionId,
      user_id: String(userId),
      dismissed: false,
      type: 'session_case1_reminder'
    },
    { $set: { dismissed: true } }
  );

  const refreshed = await collection.findOne({ _id: new mongoose.Types.ObjectId(sessionId) });
  emitSessionUpdateForReminder(refreshed || session, String(userId));

  return {
    ok: true,
    statusCode: 200,
    data: {
      success: true,
      action,
      status,
      session_id: sessionId,
      next_due_at: action === 'extend_30m' ? new Date(now.getTime() + CASE1_REMINDER_MS).toISOString() : null,
      historyEntry
    }
  };
};

// Mark a conversation as resolved by the representative (טופל).
// The session stays active (is_agent=true, agent_since unchanged) so the
// bot remains paused. If the customer sends a new message within the 30-min
// window the status is automatically flipped back to 'waiting' (handled in
// chatController). A system history entry is recorded for the audit trail.
// PATCH /api/sessions/:id/mark-resolved
export const markResolved = async (req, res) => {
  try {
    const { id } = req.params;
    const { session, collection, error, status } = await getSessionWithOwnership(id, req);
    if (error) return res.status(status).json({ error });

    const now = new Date();
    const historyEntry = {
      type: 'System',
      text: 'השיחה סומנה כטופלה',
      sender: 'system',
      name: 'מערכת',
      node_id: 'system',
      event: 'conversation_resolved',
      created: now.toISOString()
    };

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: { status: 'resolved', wants_phone: false },
        $push: { process_history: historyEntry }
      }
    );
    eventBus.emit('session:update', { userId: String(req.userId), phone: String(session.sender || session.customer_phone || '') });
    res.json({ success: true, status: 'resolved', historyEntry });
  } catch (err) {
    console.error('markResolved error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── Transfer conversation to another group / specific rep / shift manager ───
// PATCH /api/sessions/:id/transfer
// body: { targetType: 'group' | 'rep' | 'shift_manager', targetId: string, groupId?: string }
//
// When targetType='rep' and groupId is supplied (and the rep is a member of
// that group), the session is pinned to that group as well. Used by admins
// and shift managers to pick "group + specific rep" in one step.
//
// Accessible to: company manager, admin, rep_manager, and rep (a rep may
// transfer one of their own conversations to another destination within the
// same company).
export const transferConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetType, targetId, groupId, note, wantsPhone } = req.body || {};

    if (!['group', 'rep', 'shift_manager'].includes(targetType)) {
      return res.status(400).json({ error: 'targetType חייב להיות group / rep / shift_manager' });
    }
    if (!targetId || !mongoose.Types.ObjectId.isValid(String(targetId))) {
      return res.status(400).json({ error: 'targetId לא תקין' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const collection = mongoose.connection.collection('BotSession');
    const session = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!session) return res.status(404).json({ error: 'השיחה לא נמצאה' });

    // Ownership: resolve to the effective company-manager id and verify the
    // session belongs to that company (either by user_id or via a widget that
    // belongs to one of the company's bots).
    const ownerId = getEffectiveUserId(req);
    const userBots = await BotFlow.find({ user_id: ownerId }).select('_id').lean();
    const botIds = userBots.map(b => b._id.toString());
    const userWidgets = await Widget.find({ flow_id: { $in: botIds } }).select('id').lean();
    const widgetIds = userWidgets.map(w => w.id).filter(Boolean);
    const owned =
      session.user_id === ownerId ||
      session.user_id === String(ownerId) ||
      widgetIds.includes(session.widget_id);
    if (!owned) return res.status(403).json({ error: 'גישה נדחית' });

    // Additional guard — only for users actually restricted to their own
    // assignments (permission `sessions.view_assigned_only` without
    // `sessions.view_all`), matching the same rule enforced in getContacts.
    // Based on the resolved permission (custom user types included), not just the raw role.
    const actorDoc = await User.findById(req.userId).select('rep_group_ids role user_type_id').lean();
    const actorPerms = await resolvePermissions(actorDoc || { role: req.user?.role });
    const viewOnlyAssigned = hasPermission(actorPerms, 'sessions.view_assigned_only') && !hasPermission(actorPerms, 'sessions.view_all');
    if (viewOnlyAssigned) {
      const myGroups = new Set(((actorDoc?.rep_group_ids) || []).map(x => x.toString()));
      const involved =
        String(session.rep_user_id || '') === String(req.userId) ||
        (session.rep_group_id && myGroups.has(String(session.rep_group_id)));
      if (!involved) return res.status(403).json({ error: 'אינך משויך לשיחה זו' });
    }

    // Validate target belongs to the same company.
    let targetLabel = '';
    const update = {
      is_agent: true,
      agent_since: new Date(),
      status: 'waiting',
      wants_phone: !!wantsPhone,
      'reminder_case1.next_due_at': null,
      'reminder_case1.claim_until': null
    };
    let groupUnavailableMessage = ''; // group's message when no one is available

    if (targetType === 'group') {
      const RepGroup = (await import('../models/RepGroup.js')).default;
      const group = await RepGroup.findOne({ _id: targetId, manager_id: ownerId }).lean();
      if (!group) return res.status(404).json({ error: 'הקבוצה לא נמצאה' });
      update.rep_group_id = String(targetId);
      update.rep_user_id = null;
      targetLabel = `קבוצה: ${group.name}`;
      groupUnavailableMessage = group.unavailableMessage || '';
    } else if (targetType === 'rep' || targetType === 'shift_manager') {
      const requiredRole = targetType === 'rep' ? 'rep' : 'rep_manager';
      const targetUser = await User.findOne({
        _id: targetId,
        manager_id: ownerId,
        role: requiredRole
      }).select('name email rep_group_ids').lean();
      if (!targetUser) {
        return res.status(404).json({
          error: targetType === 'rep' ? 'הנציג לא נמצא' : 'מנהל המשמרת לא נמצא'
        });
      }
      update.rep_user_id = String(targetId);
      // For a specific rep, also align the group to one of the rep's groups.
      // Priority: explicit groupId from caller (if rep is a member) → keep
      // current group if the rep belongs to it → first of the rep's groups.
      if (targetType === 'rep') {
        const repGroups = (targetUser.rep_group_ids || []).map(g => g.toString());
        const explicitGroup = groupId ? String(groupId) : null;
        const currentGroup = session.rep_group_id ? String(session.rep_group_id) : null;
        if (explicitGroup && repGroups.includes(explicitGroup)) {
          update.rep_group_id = explicitGroup;
        } else if (currentGroup && repGroups.includes(currentGroup)) {
          update.rep_group_id = currentGroup;
        } else {
          update.rep_group_id = repGroups[0] || null;
        }
        // Fetch unavailableMessage from ANY of the rep's groups (prefer the aligned group)
        if (repGroups.length > 0) {
          try {
            const RepGroup = (await import('../models/RepGroup.js')).default;
            // Try the aligned group first, then fall back to any group with a message
            const groupsToCheck = update.rep_group_id
              ? [update.rep_group_id, ...repGroups.filter(g => g !== update.rep_group_id)]
              : repGroups;
            const grpDocs = await RepGroup.find({ _id: { $in: groupsToCheck } }).select('unavailableMessage').lean();
            // Prefer the aligned group's message; otherwise pick first non-empty
            const alignedGrp = grpDocs.find(g => g._id.toString() === update.rep_group_id);
            const fallbackGrp = grpDocs.find(g => g.unavailableMessage?.trim());
            groupUnavailableMessage = alignedGrp?.unavailableMessage?.trim()
              || fallbackGrp?.unavailableMessage?.trim()
              || '';
          } catch (_) {}
        }
      } else {
        // Shift manager — clear group assignment.
        update.rep_group_id = null;
      }
      targetLabel = `${targetType === 'rep' ? 'נציג' : 'מנהל משמרת'}: ${targetUser.name || targetUser.email}`;
    }

    // ── Availability check ──────────────────────────────────────────────────
    // Verify the target has available members and notify the customer if not.
    let someoneAvailable = true;
    const historyEntriesToAdd = [];
    try {
      if (targetType === 'group') {
        const availableRep = await User.findOne({
          rep_group_ids: String(targetId),
          availability_status: 'available'
        }).select('_id').lean();
        someoneAvailable = !!availableRep;
      } else if (targetType === 'rep') {
        const targetRep = await User.findById(targetId).select('availability_status').lean();
        someoneAvailable = targetRep?.availability_status === 'available';
      }
      // shift_manager: skip availability check
    } catch (availErr) {
      console.error('[transferConversation] availability check failed:', availErr.message);
    }

    console.log(`[transferConversation] availability check | targetType=${targetType} | someoneAvailable=${someoneAvailable} | unavailableMessage="${groupUnavailableMessage}"`);

    if (!someoneAvailable && groupUnavailableMessage) {
      // Send the unavailableMessage to the customer via WhatsApp
      try {
        const owner = await User.findById(ownerId);
        // Prefer the bot's own endpoint (from the session's flow_id)
        const transferBot = session.flow_id ? await BotFlow.findById(session.flow_id).select('endpoint').lean() : null;
        let waEndpoint, waToken;
        if (transferBot && transferBot.endpoint) {
          const rawEndpoint = transferBot.endpoint;
          waEndpoint = rawEndpoint.includes('/') ? rawEndpoint : `dialog360/${rawEndpoint}`;
          const botIdPart = waEndpoint.split('/').pop();
          waToken = crypto.createHash('sha1').update(botIdPart + 'moomoo').digest('hex');
        } else if (owner?.dialog360_bot_id) {
          waEndpoint = `dialog360/${owner.dialog360_bot_id}`;
          waToken = crypto.createHash('sha1').update(owner.dialog360_bot_id + 'moomoo').digest('hex');
        } else {
          waEndpoint = null;
          waToken = null;
        }
        const rawPhone = session.sender || session.customer_phone || '';
        let normalizedPhone = rawPhone.replace(/[^0-9]/g, '');
        normalizedPhone = normalizedPhone.replace(/^972972/, '972');
        if (!normalizedPhone.startsWith('972')) {
          normalizedPhone = normalizedPhone.replace(/^0+/, '');
          normalizedPhone = '972' + normalizedPhone;
        }
        if (normalizedPhone && normalizedPhone !== '972') {
          await fetch(`https://wa.message.co.il/api/${waEndpoint}/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Accept': 'application/json',
              token: waToken
            },
            body: JSON.stringify({ phone: normalizedPhone, text: groupUnavailableMessage, fromMe: 1 })
          });
          console.log(`[transferConversation] ⚠️ No one available — sent unavailableMessage to ${normalizedPhone}`);
        }
      } catch (waErr) {
        console.error('[transferConversation] failed to send unavailableMessage via WhatsApp:', waErr.message);
      }
      // Record the unavailable message in session history
      historyEntriesToAdd.push({
        type: 'SendItem',
        text: groupUnavailableMessage,
        sender: 'bot',
        name: 'מערכת',
        event: 'unavailable_message_sent',
        created: new Date().toISOString()
      });
    }
    // ────────────────────────────────────────────────────────────────────────

    const now = new Date();
    const fromName = req.user?.name || req.user?.email || 'נציג';
    const noteText = typeof note === 'string' && note.trim() ? ` — ${note.trim()}` : '';
    const phoneText = wantsPhone ? ' 📞 (טלפוני)' : '';
    const historyEntry = {
      type: 'System',
      text: `השיחה הועברה ע"י ${fromName} ל${targetLabel}${phoneText}${noteText}`,
      wants_phone: !!wantsPhone,
      sender: 'system',
      name: 'מערכת',
      node_id: 'system',
      event: 'conversation_transferred',
      target_type: targetType,
      target_id: String(targetId),
      from_user_id: String(req.userId || ''),
      created: now.toISOString()
    };

    historyEntriesToAdd.push(historyEntry);

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update, $push: { process_history: { $each: historyEntriesToAdd } } }
    );
    eventBus.emit('session:update', { userId: String(ownerId), phone: String(session.sender || session.customer_phone || '') });

    // ── Create notifications for target reps and emit SSE notification events ──
    try {
      const Notification = (await import('../models/Notification.js')).default;
      const sessionPhone = String(session.sender || session.customer_phone || '');
      const isSimulatorSession = sessionPhone === 'Simulated' || sessionPhone === 'simulator' || sessionPhone.toLowerCase() === 'simulated';

      // Determine which user IDs should receive a notification
      let targetUserIds = [];
      if (targetType === 'group') {
        const groupReps = await User.find({ rep_group_ids: String(targetId) }).select('_id').lean();
        targetUserIds = groupReps.map(r => r._id.toString());
      } else {
        // rep or shift_manager — notify that specific user
        targetUserIds = [String(targetId)];
      }

      for (const repId of targetUserIds) {
        const notif = await Notification.create({
          user_id: repId,
          session_id: String(session._id),
          session_phone: sessionPhone,
          from_user_name: fromName,
          target_label: targetLabel,
          is_simulator: isSimulatorSession,
          wants_phone: !!wantsPhone
        });
        eventBus.emit('notification:new', { userId: repId, notification: notif.toObject() });
      }
    } catch (notifErr) {
      console.error('[transferConversation] failed to create notifications:', notifErr.message);
    }
    // ────────────────────────────────────────────────────────────────────────

    res.json({
      success: true,
      status: 'waiting',
      rep_group_id: update.rep_group_id,
      rep_user_id: update.rep_user_id,
      someoneAvailable,
      unavailableMessage: (!someoneAvailable && groupUnavailableMessage) ? groupUnavailableMessage : undefined,
      historyEntry
    });
  } catch (err) {
    console.error('transferConversation error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/sessions/transfer-targets
// Returns groups, reps, and shift managers (rep_managers) belonging to the
// effective company. Accessible to all authenticated users in the company
// (including role='rep').
export const getTransferTargets = async (req, res) => {
  try {
    const ownerId = getEffectiveUserId(req);
    const RepGroup = (await import('../models/RepGroup.js')).default;

    const [groups, reps, shiftManagers] = await Promise.all([
      RepGroup.find({ manager_id: ownerId }).sort({ name: 1 }).lean(),
      User.find({ manager_id: ownerId, role: 'rep' })
        .select('name email rep_group_ids')
        .sort({ name: 1 })
        .lean(),
      User.find({ manager_id: ownerId, role: 'rep_manager' })
        .select('name email')
        .sort({ name: 1 })
        .lean()
    ]);

    let myGroupIds = null;
    if (req.user?.role === 'rep') {
      const me = await User.findById(req.userId).select('rep_group_ids').lean();
      myGroupIds = ((me?.rep_group_ids) || []).map(id => id.toString());
    }

    res.json({
      groups: groups.map(g => ({ id: g._id.toString(), name: g.name })),
      reps: reps.map(r => ({
        id: r._id.toString(),
        name: r.name,
        email: r.email,
        repGroupIds: (r.rep_group_ids || []).map(id => id.toString())
      })),
      shiftManagers: shiftManagers.map(m => ({
        id: m._id.toString(),
        name: m.name,
        email: m.email
      })),
      myGroupIds
    });
  } catch (err) {
    console.error('getTransferTargets error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const sendAgentMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, isTemplate, templateData, mediaType, mediaUrl, mediaFilename } = req.body;
    const hasMedia = !!(mediaType && mediaUrl);
    if (!hasMedia && (!message || !String(message).trim())) {
      return res.status(400).json({ error: 'הודעה או מדיה הם שדה חובה' });
    }
    const { session, collection, error, status } = await getSessionWithOwnership(id, req);
    if (error) return res.status(status).json({ error });

    const msgText = String(message || '').trim();
    const now = new Date();
    const created = now.toISOString(); // for process_history

    // Get user (effective company manager) to access Dialog360 credentials
    const user = await User.findById(getEffectiveUserId(req));
 
    // Actual sender (rep/manager) display name, shown under the timestamp in the chat bubble
    const senderUser = await User.findById(req.userId).select('name email').lean();
    const agentName = senderUser?.name || senderUser?.email || 'נציג';

    // Load the bot associated with this session for per-bot endpoint
    const bot = session.flow_id ? await BotFlow.findById(session.flow_id).select('endpoint').lean() : null;

    // Build WhatsApp API endpoint and token
    let endpoint, waToken;
    if (bot && bot.endpoint) {
      const rawEndpoint = bot.endpoint;
      endpoint = rawEndpoint.includes('/') ? rawEndpoint : `dialog360/${rawEndpoint}`;
      const botIdPart = endpoint.split('/').pop();
      waToken = crypto.createHash('sha1').update(botIdPart + 'moomoo').digest('hex');
    } else if (user && user.dialog360_bot_id) {
      endpoint = `dialog360/${user.dialog360_bot_id}`;
      waToken = crypto.createHash('sha1').update(user.dialog360_bot_id + 'moomoo').digest('hex');
    } else {
      endpoint = null;
      waToken = null;
    }

    // Normalize phone: strip non-digits, ensure 972 country code
    const rawPhone = session.sender || session.customer_phone || '';
    let normalizedPhone = rawPhone.replace(/[^0-9]/g, '');
    normalizedPhone = normalizedPhone.replace(/^972972/, '972');
    if (!normalizedPhone.startsWith('972')) {
      normalizedPhone = normalizedPhone.replace(/^0+/, '');
      normalizedPhone = '972' + normalizedPhone;
    }

    if (!normalizedPhone || normalizedPhone === '972') {
      console.error(`[sendAgentMessage] ❌ Empty phone on session ${id}, aborting`);
      return res.status(400).json({ error: 'לשיחה זו אין מספר טלפון' });
    }

    // Build WhatsApp body - different structure for template vs text
    let waBody;
    
    if (isTemplate && templateData) {
      // Template message structure FOR NODE.JS FUNCTION sendTemplate
      console.log(`[sendAgentMessage] 📋 Sending TEMPLATE | id=${templateData.id} | name=${templateData.name} | lang=${templateData.language}`);
      
      waBody = {
        chat: normalizedPhone,
        template: templateData.name,  // Use NAME not ID!
        language: templateData.language || 'he',
        fromMe: 1
      };
      
      // Add user-provided parameters
      if (templateData.params) {
        // Header media (image/video/document) - sendTemplate expects object format
        if (templateData.params.header && templateData.params.header.url) {
          const mediaType = templateData.params.header.type || 'image';
          waBody.header = [{
            type: mediaType,
            [mediaType]: { link: templateData.params.header.url }
          }];
          console.log(`[sendAgentMessage] 📋 HEADER added:`, waBody.header);
        }
        
        // Body variables {{1}}, {{2}} - sendTemplate expects array of strings
        if (templateData.params.body && Array.isArray(templateData.params.body)) {
          waBody.params = templateData.params.body.filter(p => p && String(p).trim());
          console.log(`[sendAgentMessage] 📋 PARAMS added:`, waBody.params);
        }
      } else {
        // Fallback: try to use example data from template definition
        console.log(`[sendAgentMessage] ⚠️ No params provided, using fallback from template components`);
        if (templateData.components && Array.isArray(templateData.components)) {
          const headerComponent = templateData.components.find(c => c.type === 'HEADER');
          if (headerComponent) {
            const ex = headerComponent.example || {};
            const exLink = (Array.isArray(ex.header_handle) ? ex.header_handle[0] : ex.header_handle)
                        || (Array.isArray(ex.header_url)    ? ex.header_url[0]    : ex.header_url)
                        || '';
            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format) && exLink) {
              const mediaType = headerComponent.format.toLowerCase();
              waBody.header = [{ type: mediaType, [mediaType]: { link: exLink } }];
            }
          }
        }
      }
      // Final fallback: params were provided but had no header URL — try template example
      if (!waBody.header && templateData.components && Array.isArray(templateData.components)) {
        const headerComp = templateData.components.find(c => c.type === 'HEADER');
        if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
          const ex = headerComp.example || {};
          const exLink = (Array.isArray(ex.header_handle) ? ex.header_handle[0] : ex.header_handle)
                      || (Array.isArray(ex.header_url)    ? ex.header_url[0]    : ex.header_url)
                      || '';
          if (exLink) {
            const mediaType = headerComp.format.toLowerCase();
            waBody.header = [{ type: mediaType, [mediaType]: { link: exLink } }];
            console.log(`[sendAgentMessage] ⚠️ No header URL in params — using template example: ${exLink}`);
          }
        }
      }
    }
    // (text and media messages are sent via pushMessagesToWhatsApp below)

    let waSent = false;
    let waError = null;
    let agentWamid = null;
    let waRetryable = false;

    if (isTemplate && templateData) {
      // Templates use a different body structure — send directly
      const WA_SEND_URL = `https://wa.message.co.il/api/${endpoint}/send`;
      const MAX_TEMPLATE_RETRIES = 2;
      const RETRY_DELAY_MS = 3000;
      for (let attempt = 0; attempt <= MAX_TEMPLATE_RETRIES; attempt++) {
        if (attempt > 0) {
          console.log(`[sendAgentMessage] ⏳ Retry ${attempt}/${MAX_TEMPLATE_RETRIES} in ${RETRY_DELAY_MS / 1000}s...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        }
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`[sendAgentMessage] 📤 ATTEMPT ${attempt + 1}/${MAX_TEMPLATE_RETRIES + 1}`);
        console.log(`[sendAgentMessage] 📤 URL:     ${WA_SEND_URL}`);
        console.log(`[sendAgentMessage] 📤 TOKEN:   ${waToken}`);
        console.log(`[sendAgentMessage] 📤 PHONE:   ${normalizedPhone}`);
        console.log(`[sendAgentMessage] 📤 PAYLOAD:\n${JSON.stringify(waBody, null, 2)}`);
        console.log(`${'─'.repeat(60)}`);
        try {
          const waRes = await fetch(WA_SEND_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Accept': 'application/json',
              token: waToken
            },
            body: JSON.stringify(waBody)
          });
          const responseBody = await waRes.text().catch(() => '');
          console.log(`[sendAgentMessage] ⬅️  RESPONSE HTTP ${waRes.status} | body: ${responseBody}`);
          if (waRes.ok) {
            waSent = true;
            waError = null;
            waRetryable = false;
            console.log(`[sendAgentMessage] ✅ WhatsApp OK | attempt=${attempt + 1} | phone=${normalizedPhone}`);
            break;
          } else {
            let errorData = null;
            try { errorData = JSON.parse(responseBody); } catch (_) {}
            waRetryable = errorData?.retryable === true || waRes.status === 502 || waRes.status === 503 || waRes.status === 504;
            waError = `HTTP ${waRes.status}: ${responseBody}`;
            console.error(`[sendAgentMessage] ❌ WhatsApp FAILED | attempt=${attempt + 1}/${MAX_TEMPLATE_RETRIES + 1} | phone=${normalizedPhone} | retryable=${waRetryable} | status=${waRes.status}`);
            if (!waRetryable || attempt >= MAX_TEMPLATE_RETRIES) break;
          }
        } catch (waErr) {
          waError = waErr.message;
          waRetryable = false;
          console.error(`[sendAgentMessage] ❌ WhatsApp exception | attempt=${attempt + 1}:`, waErr.message);
          break; // Network-level errors — don't retry
        }
      }
    } else {
      // Text or media: use shared whatsappSender utility
      const waMessages = hasMedia
        ? [{ type: mediaType === 'video' ? 'Video' : mediaType === 'document' ? 'Document' : 'Image', url: mediaUrl, text: msgText, filename: mediaFilename || 'file' }]
        : [{ type: 'Text', text: msgText }];
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`[AGENT-SEND] 📤 Agent → Customer`);
      console.log(`[AGENT-SEND]    session id : ${id}`);
      console.log(`[AGENT-SEND]    phone      : ${normalizedPhone}`);
      console.log(`[AGENT-SEND]    type       : ${hasMedia ? `MEDIA (${mediaType})` : 'TEXT'}`);
      if (hasMedia) {
        console.log(`[AGENT-SEND]    media url  : ${mediaUrl}`);
        console.log(`[AGENT-SEND]    filename   : ${mediaFilename || '—'}`);
        console.log(`[AGENT-SEND]    caption    : ${msgText || '(none)'}`);
      } else {
        console.log(`[AGENT-SEND]    message    : ${msgText.substring(0, 100)}`);
      }
      console.log(`[AGENT-SEND]    wa payload : ${JSON.stringify(waMessages[0])}`);
      try {
        const pushResult = await pushMessagesToWhatsApp(normalizedPhone, waMessages, user, bot);
        waSent = pushResult.anySuccess;
        agentWamid = pushResult.wamidPerMsg?.find(Boolean) || null;
        console.log(`[AGENT-SEND] ${waSent ? '✅ WhatsApp delivered' : '❌ WhatsApp delivery FAILED'}`);
        console.log(`${'─'.repeat(60)}\n`);
        if (!waSent) waError = 'משלוח ה-WhatsApp נכשל';
      } catch (waErr) {
        waError = waErr.message;
        console.error(`[AGENT-SEND] ❌ WhatsApp exception:`, waErr.message);
        console.log(`${'─'.repeat(60)}\n`);
      }
    }

    // Always save to history (for audit trail), but mark if not delivered
    let historyEntry = {
      sender: 'agent',
      name: 'נציג',
      agent_name: agentName,
      agent_user_id: String(req.userId || ''),
      node_id: 'agent',
      created,
      wa_sent: waSent,
      wa_error: waError || null,
      wamid: agentWamid,
      deliveryStatus: null
    };
    
    // Build display content based on template or text
    console.log(`[sendAgentMessage] 📝 Building history entry | isTemplate=${isTemplate} | hasTemplateData=${!!templateData}`);
    if (isTemplate && templateData) {
      console.log(`[sendAgentMessage] 📝 Template components:`, JSON.stringify(templateData.components, null, 2));
      // Extract text from BODY component and replace variables
      let displayText = '';
      if (templateData.components && Array.isArray(templateData.components)) {
        const bodyComp = templateData.components.find(c => c.type === 'BODY');
        if (bodyComp && bodyComp.text) {
          displayText = bodyComp.text;
          // Replace {{1}}, {{2}} with actual values
          if (templateData.params && templateData.params.body && Array.isArray(templateData.params.body)) {
            templateData.params.body.forEach((val, idx) => {
              displayText = displayText.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
            });
          }
        }
        
        const footerComp = templateData.components.find(c => c.type === 'FOOTER');
        if (footerComp && footerComp.text) {
          displayText += (displayText ? '\n\n' : '') + `― ${footerComp.text}`;
        }
      }
      
      // Check if there's header media — first from params, then from the fallback placed in waBody
      if (templateData.params && templateData.params.header && templateData.params.header.url) {
        const mediaType = templateData.params.header.type || 'image';
        historyEntry.type = mediaType === 'image' ? 'Image' : mediaType === 'video' ? 'Video' : 'Document';
        historyEntry.url = templateData.params.header.url;
        historyEntry.text = displayText;
      } else if (waBody.header && waBody.header[0]) {
        // Fallback image was resolved from template example — save it in history too
        const h = waBody.header[0];
        const mediaType = h.type || 'image';
        historyEntry.type = mediaType === 'image' ? 'Image' : mediaType === 'video' ? 'Video' : 'Document';
        historyEntry.url = h[mediaType]?.link || '';
        historyEntry.text = displayText;
      } else {
        historyEntry.type = 'Text';
        historyEntry.text = displayText || msgText;
      }
      // Extract buttons from BUTTONS component and save for display
      if (templateData.components && Array.isArray(templateData.components)) {
        const buttonsComp = templateData.components.find(c => c.type === 'BUTTONS');
        if (buttonsComp && Array.isArray(buttonsComp.buttons) && buttonsComp.buttons.length > 0) {
          historyEntry.template_buttons = buttonsComp.buttons.map(b => ({
            type: b.type || 'QUICK_REPLY',
            text: b.text || '',
            ...(b.url ? { url: b.url } : {}),
            ...(b.phone_number ? { phone_number: b.phone_number } : {})
          }));
        }
      }
    } else if (hasMedia) {
      const waMediaType = mediaType === 'video' ? 'Video' : mediaType === 'document' ? 'Document' : 'Image';
      historyEntry.type = waMediaType;
      historyEntry.url = mediaUrl;
      historyEntry.text = msgText;
      if (waMediaType === 'Document') historyEntry.filename = mediaFilename || 'file';
    } else {
      historyEntry.type = 'Text';
      historyEntry.text = msgText;
    }
    
    console.log(`[sendAgentMessage] 💾 Saving history entry:`, JSON.stringify(historyEntry, null, 2));

    // A free-text (non-template) reply from the agent moves the conversation
    // into 'handling'. Template messages keep the existing status
    // (e.g. 'waiting') since they're typically opening/notification messages.
    const update = { $push: { process_history: historyEntry } };
    let newStatus = session.status || 'bot';
    if (!isTemplate && waSent) {
      newStatus = 'handling';
      update.$set = { status: 'handling', is_agent: true, agent_since: new Date() };
    }

    const repReplyAt = toDateSafe(created) || new Date();
    update.$set = {
      ...(update.$set || {}),
      'reminder_case1.last_rep_message_at': repReplyAt,
      'reminder_case1.last_rep_user_id': String(req.userId || ''),
      'reminder_case1.next_due_at': new Date(repReplyAt.getTime() + CASE1_REMINDER_MS),
      'reminder_case1.claim_until': null,
      'reminder_case2.next_due_at': null,
      'reminder_case2.claim_until': null
    };

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      update
    );
    eventBus.emit('session:update', { userId: String(getEffectiveUserId(req)), phone: String(session.sender || session.customer_phone || '') });

    res.json({ success: true, waSent, waError, waRetryable, created, historyEntry, status: newStatus });
  } catch (err) {
    console.error('sendAgentMessage error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Send a template message directly to a phone number (no session required — for new contacts)
export const sendTemplateToPhone = async (req, res) => {
  try {
    const { phone, message, templateData } = req.body;
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ error: 'מספר טלפון הוא שדה חובה' });
    }
    if (!templateData) {
      return res.status(400).json({ error: 'נתוני תבנית הם שדה חובה' });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'הודעה היא שדה חובה' });
    }

    const user = await User.findById(getEffectiveUserId(req));
    if (!user) return res.status(404).json({ error: 'המשתמש לא נמצא' });

    // Actual sender (rep/manager) display name, shown under the timestamp in the chat bubble
    const senderUser = await User.findById(req.userId).select('name email').lean();
    const agentName = senderUser?.name || senderUser?.email || 'נציג';

    // Normalize phone first so we can look up the last session
    let normalizedPhone = String(phone).replace(/[^0-9]/g, '');
    normalizedPhone = normalizedPhone.replace(/^972972/, '972');
    if (!normalizedPhone.startsWith('972')) {
      normalizedPhone = normalizedPhone.replace(/^0+/, '');
      normalizedPhone = '972' + normalizedPhone;
    }

    // Find the last session for this phone to determine which bot endpoint to use
    const collection = mongoose.connection.collection('BotSession');
    const lastSession = await collection.findOne(
      { $or: [{ sender: normalizedPhone }, { customer_phone: normalizedPhone }], user_id: String(user._id) },
      { sort: { created_at: -1 } }
    );
    const lastBot = lastSession?.flow_id ? await BotFlow.findById(lastSession.flow_id).select('endpoint').lean() : null;
    console.log(`[sendTemplateToPhone] 🔍 last session=${lastSession?._id || '(none)'} | lastBot.endpoint=${lastBot?.endpoint || '(none)'}`);

    let endpoint, waToken;
    if (lastBot && lastBot.endpoint) {
      const rawEndpoint = lastBot.endpoint;
      endpoint = rawEndpoint.includes('/') ? rawEndpoint : `dialog360/${rawEndpoint}`;
      const botIdPart = endpoint.split('/').pop();
      waToken = crypto.createHash('sha1').update(botIdPart + 'moomoo').digest('hex');
    } else if (user.dialog360_bot_id) {
      endpoint = `dialog360/${user.dialog360_bot_id}`;
      waToken = crypto.createHash('sha1').update(user.dialog360_bot_id + 'moomoo').digest('hex');
    } else {
      endpoint = null;
      waToken = null;
    }

    console.log(`[sendTemplateToPhone] 📤 phone=${phone} → normalized=${normalizedPhone} | template=${templateData.name} | lang=${templateData.language || 'he'} | endpoint=${endpoint}`);

    const waBody = {
      chat: normalizedPhone,
      template: templateData.name,
      language: templateData.language || 'he',
      fromMe: 1
    };

    if (templateData.params) {
      if (templateData.params.header && templateData.params.header.url) {
        const mediaType = templateData.params.header.type || 'image';
        waBody.header = [{ type: mediaType, [mediaType]: { link: templateData.params.header.url } }];
      }
      if (templateData.params.body && Array.isArray(templateData.params.body)) {
        waBody.params = templateData.params.body.filter(p => p && String(p).trim());
      }
    }

    // Fallback: if the template requires a media header but none was supplied,
    // use the example URL embedded in the template's component definition.
    if (!waBody.header && templateData.components && Array.isArray(templateData.components)) {
      const headerComp = templateData.components.find(c => c.type === 'HEADER');
      if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
        const ex = headerComp.example || {};
        const exLink = (Array.isArray(ex.header_handle) ? ex.header_handle[0] : ex.header_handle)
                    || (Array.isArray(ex.header_url)    ? ex.header_url[0]    : ex.header_url)
                    || '';
        if (exLink) {
          const mediaType = headerComp.format.toLowerCase();
          waBody.header = [{ type: mediaType, [mediaType]: { link: exLink } }];
          console.log(`[sendTemplateToPhone] ⚠️ No header URL provided — using template example: ${exLink}`);
        } else {
          console.warn(`[sendTemplateToPhone] ⚠️ Template requires ${headerComp.format} header but no URL and no example available`);
        }
      }
    }

    let waSent = false;
    let waError = null;
    try {
      const waRes = await fetch(`https://wa.message.co.il/api/${endpoint}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json', token: waToken },
        body: JSON.stringify(waBody)
      });
      if (waRes.ok) {
        waSent = true;
        console.log(`[sendTemplateToPhone] ✅ WhatsApp OK | phone=${normalizedPhone} | status=${waRes.status}`);
      } else {
        waError = `HTTP ${waRes.status}: ${await waRes.text()}`;
        console.error(`[sendTemplateToPhone] ❌ WhatsApp FAILED | phone=${normalizedPhone} | ${waError}`);
      }
    } catch (waErr) {
      waError = waErr.message;
      console.error(`[sendTemplateToPhone] ❌ WhatsApp exception:`, waErr.message);
    }

    // Build history entry for display (regardless of waSent, so the message is always visible)
    const now = new Date();
    const created = now.toISOString();
    let displayText = '';
    if (templateData.components && Array.isArray(templateData.components)) {
      const bodyComp = templateData.components.find(c => c.type === 'BODY');
      if (bodyComp && bodyComp.text) {
        displayText = bodyComp.text;
        if (templateData.params && templateData.params.body && Array.isArray(templateData.params.body)) {
          templateData.params.body.forEach((val, idx) => {
            displayText = displayText.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
          });
        }
      }
      const footerComp = templateData.components.find(c => c.type === 'FOOTER');
      if (footerComp && footerComp.text) {
        displayText += (displayText ? '\n\n' : '') + `― ${footerComp.text}`;
      }
    }

    const historyEntry = {
      sender: 'agent',
      name: 'נציג',
      agent_name: agentName,
      node_id: 'agent',
      created,
      wa_sent: waSent,
      type: 'Text',
      text: displayText || message
    };

    // Check if there's header media
    if (templateData.params && templateData.params.header && templateData.params.header.url) {
      const mediaType = templateData.params.header.type || 'image';
      historyEntry.type = mediaType === 'image' ? 'Image' : mediaType === 'video' ? 'Video' : 'Document';
      historyEntry.url = templateData.params.header.url;
    } else if (waBody.header && waBody.header[0]) {
      const h = waBody.header[0];
      const mediaType = h.type || 'image';
      historyEntry.type = mediaType === 'image' ? 'Image' : mediaType === 'video' ? 'Video' : 'Document';
      historyEntry.url = h[mediaType]?.link || '';
    }

    // Drain any group-broadcast messages queued on this contact while no session existed yet
    // (this agent-initiated conversation isn't tied to one specific bot flow, so drain all of them).
    let initialHistory = [historyEntry];
    try {
      const contactWithPending = await Contact.findOne({
        user_id: String(user._id),
        phone: normalizedPhone,
        'pending_history.0': { $exists: true },
      });
      const pending = contactWithPending?.pending_history || [];
      if (pending.length > 0) {
        const sortedPending = [...pending].sort((a, b) => new Date(a.created) - new Date(b.created));
        initialHistory = [...sortedPending, historyEntry];
        await Contact.updateOne({ _id: contactWithPending._id }, { $set: { pending_history: [] } });
        console.log(`[sendTemplateToPhone] 📢 Injected ${sortedPending.length} pending broadcast message(s) into new session for ${normalizedPhone}`);
      }
    } catch (err) {
      console.error('[sendTemplateToPhone] Failed to drain pending broadcast history:', err.message);
    }

    // Create a BotSession so the contact appears in the sessions list and message is saved
    // (collection is already declared above for the lastSession lookup)
    const sessionDoc = {
      sender: normalizedPhone,
      customer_phone: normalizedPhone,
      user_id: getEffectiveUserId(req),
      is_agent: true,
      agent_since: now,
      status: 'waiting',
      is_active: true,
      created_at: now,
      process_history: initialHistory
    };
    const insertResult = await collection.insertOne(sessionDoc);
    const sessionId = insertResult.insertedId.toString();
    console.log(`[sendTemplateToPhone] 💾 Created BotSession ${sessionId} for phone=${normalizedPhone}`);

    res.json({ success: true, waSent, waError, sessionId, historyEntry, processHistory: initialHistory, created, phone: normalizedPhone });
  } catch (err) {
    console.error('sendTemplateToPhone error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Admin sends message to session and activates agent mode (pauses bot for 30 minutes)
export const sendAdminMessageToSession = async (req, res) => {
  try {
    const { sessionId, message, isTemplate, templateData } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'מזהה שיחה הוא שדה חובה' });
    }
    
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'הודעה היא שדה חובה' });
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ error: 'פורמט מזהה שיחה אינו תקין' });
    }

    const collection = mongoose.connection.collection('BotSession');
    const session = await collection.findOne({ _id: new mongoose.Types.ObjectId(sessionId) });
    
    if (!session) {
      return res.status(404).json({ error: 'השיחה לא נמצאה' });
    }

    const msgText = String(message).trim();
    const now = new Date();
    const created = now.toISOString();

    // Get user's Dialog360 credentials
    const user = await User.findById(session.user_id);
    if (!user) {
      return res.status(404).json({ error: 'המשתמש לא נמצא' });
    }

    // Actual sender (admin) display name, shown under the timestamp in the chat bubble
    const senderUser = await User.findById(req.userId).select('name email').lean();
    const agentName = senderUser?.name || senderUser?.email || 'נציג';

    // Load the bot associated with this session for per-bot endpoint
    const adminMsgBot = session.flow_id ? await BotFlow.findById(session.flow_id).select('endpoint').lean() : null;

    // Build WhatsApp API endpoint and token — bot.endpoint takes priority
    let endpoint, waToken;
    if (adminMsgBot && adminMsgBot.endpoint) {
      const rawEndpoint = adminMsgBot.endpoint;
      endpoint = rawEndpoint.includes('/') ? rawEndpoint : `dialog360/${rawEndpoint}`;
      const botIdPart = endpoint.split('/').pop();
      waToken = crypto.createHash('sha1').update(botIdPart + 'moomoo').digest('hex');
    } else if (user.dialog360_bot_id) {
      endpoint = `dialog360/${user.dialog360_bot_id}`;
      waToken = crypto.createHash('sha1').update(user.dialog360_bot_id + 'moomoo').digest('hex');
    } else {
      endpoint = null;
      waToken = null;
    }

    // Normalize phone: ensure 972 country code
    const rawPhone = session.sender || session.customer_phone || '';
    let normalizedPhone = rawPhone.replace(/[^0-9]/g, '');
    normalizedPhone = normalizedPhone.replace(/^972972/, '972');
    if (!normalizedPhone.startsWith('972')) {
      normalizedPhone = normalizedPhone.replace(/^0+/, '');
      normalizedPhone = '972' + normalizedPhone;
    }

    // Build WhatsApp body - different structure for template vs text
    let waBody;
    
    if (isTemplate && templateData) {
      // Template message structure FOR NODE.JS FUNCTION sendTemplate
      console.log(`[sendAdminMessageToSession] 📋 Sending TEMPLATE | id=${templateData.id} | name=${templateData.name} | lang=${templateData.language}`);
      
      waBody = {
        chat: normalizedPhone,
        template: templateData.name,  // Use NAME not ID!
        language: templateData.language || 'he',
        fromMe: 1
      };
      
      // Add user-provided parameters
      if (templateData.params) {
        // Header media (image/video/document) - sendTemplate expects object format
        if (templateData.params.header && templateData.params.header.url) {
          const mediaType = templateData.params.header.type || 'image';
          waBody.header = [{
            type: mediaType,
            [mediaType]: { link: templateData.params.header.url }
          }];
          console.log(`[sendAdminMessageToSession] 📋 HEADER added:`, waBody.header);
        }
        
        // Body variables {{1}}, {{2}} - sendTemplate expects array of strings
        if (templateData.params.body && Array.isArray(templateData.params.body)) {
          waBody.params = templateData.params.body.filter(p => p && String(p).trim());
          console.log(`[sendAdminMessageToSession] 📋 PARAMS added:`, waBody.params);
        }
      } else {
        // Fallback: try to use example data from template definition
        console.log(`[sendAdminMessageToSession] ⚠️ No params provided, using fallback from template components`);
        if (templateData.components && Array.isArray(templateData.components)) {
          const headerComponent = templateData.components.find(c => c.type === 'HEADER');
          if (headerComponent) {
            const ex = headerComponent.example || {};
            const exLink = (Array.isArray(ex.header_handle) ? ex.header_handle[0] : ex.header_handle)
                        || (Array.isArray(ex.header_url)    ? ex.header_url[0]    : ex.header_url)
                        || '';
            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format) && exLink) {
              const mediaType = headerComponent.format.toLowerCase();
              waBody.header = [{ type: mediaType, [mediaType]: { link: exLink } }];
            }
          }
        }
      }
      // Final fallback: params were provided but had no header URL — try template example
      if (!waBody.header && templateData.components && Array.isArray(templateData.components)) {
        const headerComp = templateData.components.find(c => c.type === 'HEADER');
        if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
          const ex = headerComp.example || {};
          const exLink = (Array.isArray(ex.header_handle) ? ex.header_handle[0] : ex.header_handle)
                      || (Array.isArray(ex.header_url)    ? ex.header_url[0]    : ex.header_url)
                      || '';
          if (exLink) {
            const mediaType = headerComp.format.toLowerCase();
            waBody.header = [{ type: mediaType, [mediaType]: { link: exLink } }];
            console.log(`[sendAdminMessageToSession] ⚠️ No header URL in params — using template example: ${exLink}`);
          }
        }
      }
    } else {
      // Regular text message
      console.log(`[sendAdminMessageToSession] 💬 Sending TEXT | phone=${normalizedPhone}`);
      waBody = {
        phone: normalizedPhone,
        text: msgText,
        fromMe: 1
      };
    }

    let waSent = false;
    let waError = null;
    
    console.log(`[sendAdminMessageToSession] 📤 Sending | endpoint=${endpoint} | phone=${normalizedPhone}`);
    console.log(`[sendAdminMessageToSession] 📤 Body:`, JSON.stringify(waBody, null, 2));
    
    try {
      const waRes = await fetch(`https://wa.message.co.il/api/${endpoint}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
          token: waToken
        },
        body: JSON.stringify(waBody)
      });
      
      if (waRes.ok) { 
        waSent = true;
        let responseBody = '';
        try { responseBody = await waRes.text(); } catch (_) {}
        console.log(`[sendAdminMessageToSession] ✅ WhatsApp OK | phone=${normalizedPhone} | status=${waRes.status} | response=${responseBody}`);
      } else {
        waError = `HTTP ${waRes.status}: ${await waRes.text()}`;
        console.error(`[sendAdminMessageToSession] ❌ WhatsApp FAILED | phone=${normalizedPhone} | ${waError}`);
      }
    } catch (waErr) {
      waError = waErr.message;
      console.error(`[sendAdminMessageToSession] ❌ WhatsApp exception:`, waErr.message);
    }

    // Update session: add message to history + activate agent mode (pause bot for 30 minutes)
    let historyEntry = {
      sender: 'agent',
      name: 'נציג',
      agent_name: agentName,
      node_id: 'agent',
      created,
      wa_sent: waSent,
      wamid: null,
      deliveryStatus: null
    };
    
    // Build display content based on template or text
    console.log(`[sendAdminMessageToSession] 📝 Building history entry | isTemplate=${isTemplate} | hasTemplateData=${!!templateData}`);
    if (isTemplate && templateData) {
      console.log(`[sendAdminMessageToSession] 📝 Template components:`, JSON.stringify(templateData.components, null, 2));
      // Extract text from BODY component and replace variables
      let displayText = '';
      if (templateData.components && Array.isArray(templateData.components)) {
        const bodyComp = templateData.components.find(c => c.type === 'BODY');
        if (bodyComp && bodyComp.text) {
          displayText = bodyComp.text;
          // Replace {{1}}, {{2}} with actual values
          if (templateData.params && templateData.params.body && Array.isArray(templateData.params.body)) {
            templateData.params.body.forEach((val, idx) => {
              displayText = displayText.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
            });
          }
        }
        
        const footerComp = templateData.components.find(c => c.type === 'FOOTER');
        if (footerComp && footerComp.text) {
          displayText += (displayText ? '\n\n' : '') + `— ${footerComp.text}`;
        }
      }
      
      // Check if there's header media — first from params, then from the fallback placed in waBody
      if (templateData.params && templateData.params.header && templateData.params.header.url) {
        const mediaType = templateData.params.header.type || 'image';
        historyEntry.type = mediaType === 'image' ? 'Image' : mediaType === 'video' ? 'Video' : 'Document';
        historyEntry.url = templateData.params.header.url;
        historyEntry.text = displayText;
      } else if (waBody.header && waBody.header[0]) {
        // Fallback image was resolved from template example — save it in history too
        const h = waBody.header[0];
        const mediaType = h.type || 'image';
        historyEntry.type = mediaType === 'image' ? 'Image' : mediaType === 'video' ? 'Video' : 'Document';
        historyEntry.url = h[mediaType]?.link || '';
        historyEntry.text = displayText;
      } else {
        historyEntry.type = 'Text';
        historyEntry.text = displayText || msgText;
      }
    } else {
      // Regular text message
      historyEntry.type = 'Text';
      historyEntry.text = msgText;
    }
    
    console.log(`[sendAdminMessageToSession] 💾 Saving history entry:`, JSON.stringify(historyEntry, null, 2));
    
    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(sessionId) },
      {
        $push: { process_history: historyEntry },
        $set: {
          is_agent: true,
          agent_since: now
        }
      }
    );

    console.log(`[sendAdminMessageToSession] ✅ Agent mode activated for 30 minutes | session=${sessionId}`);

    res.json({ success: true, waSent, waError, created, agentMode: true, historyEntry });
  } catch (err) {
    console.error('sendAdminMessageToSession error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

export const toggleSessionActive = async (req, res) => {
  // Admin-only: toggle is_active for a session
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    const collection = mongoose.connection.collection('BotSession');
    const session = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const newActive = session.is_active === false ? true : false;
    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { is_active: newActive } }
    );
    res.json({ success: true, is_active: newActive });
  } catch (err) { 
    console.error('toggleSessionActive error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Send external message to session (e.g., from Filament or after web service)
export const sendExternalMessage = async (req, res) => {
  const { sessionId, message, simulator_id } = req.body;

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`[sendExternalMessage] 📨 External message @ ${new Date().toISOString()}`);
  console.log(`[sendExternalMessage]    sessionId    = ${sessionId || '(missing)'}`);
  console.log(`[sendExternalMessage]    type         = ${message?.type || 'Text'}`);
  console.log(`[sendExternalMessage]    sender       = ${message?.sender || 'bot'}`);
  console.log(`[sendExternalMessage]    content      = "${String(message?.content || '').substring(0, 200)}"`);
  console.log(`[sendExternalMessage]    url          = ${message?.url || '(none)'}`);
  console.log(`[sendExternalMessage]    options      = ${message?.options ? JSON.stringify(message.options) : '(none)'}`);
  console.log(`[sendExternalMessage]    simulator_id = ${simulator_id || '(broadcast to all)'}`);
  console.log(`[sendExternalMessage]    ip           = ${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`);

  if (!sessionId) {
    console.log(`[sendExternalMessage] ❌ Missing sessionId`);
    console.log(`${'─'.repeat(80)}\n`);
    return res.status(400).json({ error: 'חסר מזהה שיחה' });
  }

  if (!message || !message.content) {
    console.log(`[sendExternalMessage] ❌ Missing message content`);
    console.log(`${'─'.repeat(80)}\n`);
    return res.status(400).json({ error: 'חסר תוכן הודעה' });
  }

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    console.log(`[sendExternalMessage] ❌ Invalid sessionId format: ${sessionId}`);
    console.log(`${'─'.repeat(80)}\n`);
    return res.status(400).json({ error: 'Invalid sessionId format' });
  }

  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      console.log(`[sendExternalMessage] ❌ DB not ready (state=${mongoose.connection?.readyState})`);
      console.log(`${'─'.repeat(80)}\n`);
      return res.status(503).json({ error: 'Database connection not ready' });
    }

    const collection = mongoose.connection.collection('BotSession');

    // Verify session exists and is active
    const session = await collection.findOne({ 
      _id: new mongoose.Types.ObjectId(sessionId) 
    });

    if (!session) {
      console.log(`[sendExternalMessage] ❌ Session not found: ${sessionId}`);
      console.log(`${'─'.repeat(80)}\n`);
      return res.status(404).json({ error: 'Session not found' });
    }

    console.log(`[sendExternalMessage] 🔎 Session found | phone=${session.customer_phone || '(n/a)'} | sender=${session.sender || '(n/a)'} | widget=${session.widget_id || '(n/a)'}`);

    // Prepare message entry
    const entry = {
      type: message.type || 'Text',
      sender: message.sender || 'bot',
      name: message.sender === 'user' ? 'משתמש' : 'בוט',
      text: message.content,
      url: message.url,
      options: message.options,
      created: new Date().toISOString(),
      isExternal: true, // Flag to identify external messages
      targetSimulatorId: simulator_id || null, // Target specific simulator or all
      ...((message.sender || 'bot') !== 'user' ? { wamid: null, deliveryStatus: null } : {})
    };

    // Add message to process_history
    const updateRes = await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(sessionId) },
      { 
        $push: { process_history: entry },
        $set: { updatedAt: new Date() }
      }
    );

    console.log(`[sendExternalMessage] ✅ Message stored | sessionId=${sessionId} | phone=${session.customer_phone || '(n/a)'} | matched=${updateRes.matchedCount} | modified=${updateRes.modifiedCount}`);
    console.log(`${'─'.repeat(80)}\n`);
    res.json({ success: true, message: 'Message added to session' });
  } catch (err) {
    console.error(`[sendExternalMessage] ❌ Error for sessionId=${sessionId}:`, err);
    console.log(`${'─'.repeat(80)}\n`);
    res.status(500).json({ error: err.message });
  }
};

// Get new messages for a session (for polling)
export const getSessionMessages = async (req, res) => {
  const { sessionId } = req.params;
  const { since, simulator_id } = req.query; // ISO timestamp of last received message and simulator ID

  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
    return res.status(400).json({ error: 'מזהה שיחה לא תקין' });
  }

  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection not ready' });
    }

    const collection = mongoose.connection.collection('BotSession');
    const session = await collection.findOne({ 
      _id: new mongoose.Types.ObjectId(sessionId) 
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const allMessages = session.process_history || [];
    
    // Filter messages based on criteria
    let messages = allMessages;
    
    // Filter by timestamp if 'since' provided
    if (since) {
      const sinceDate = new Date(since);
      messages = messages.filter(msg => {
        const msgDate = new Date(msg.created);
        return msgDate > sinceDate;
      });
    }
    
    // Filter by simulator_id if provided
    // Only return messages that are either:
    // 1. External with no targetSimulatorId (broadcast to all)
    // 2. External with matching targetSimulatorId
    // Exclude messages that originated from this simulator (to prevent duplicates)
    if (simulator_id) {
      messages = messages.filter(msg => {
        // Skip messages that originated from this simulator
        if (msg.originSimulatorId === simulator_id) return false;
        
        // Non-external messages are excluded (they're already shown locally)
        if (!msg.isExternal) return false;
        
        // External messages with no target are broadcast to all
        if (!msg.targetSimulatorId) return true;
        
        // External messages with matching target
        return msg.targetSimulatorId === simulator_id;
      });
    }

    res.json({ 
      success: true, 
      messages,
      hasNewMessages: messages.length > 0
    });
  } catch (err) {
    console.error('getSessionMessages Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── User Dashboard Stats ──────────────────────────────────────────────────────
// GET /api/sessions/stats
// Returns sessions and message statistics for the current user.
export const getUserStats = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Build user's bots/widgets (same pattern as getUserSessions)
    const [userBots, userWidgets] = await Promise.all([
      BotFlow.find({ user_id: userId }).lean(),
      Widget.find({ $or: [{ user_id: userId }, { user_id: userId.toString() }] }).select('id flow_id').lean()
    ]);

    const botIds = userBots.map(b => b._id.toString());
    const botWidgets = await Widget.find({ flow_id: { $in: botIds } }).select('id flow_id').lean();
    const widgetIds = [...new Set([...userWidgets, ...botWidgets].map(w => w.id).filter(Boolean))];

    const matchStage = {
      $or: [
        { user_id: userId },
        { user_id: userId.toString() },
        { widget_id: { $in: widgetIds } },
        { flow_id: { $in: botIds } }
      ]
    };

    const collection = mongoose.connection.collection('BotSession');

    // Sessions stats (one aggregate pass)
    const [sessionResult] = await collection.aggregate([
      { $match: matchStage },
      { $addFields: { _date: { $ifNull: ['$created_at', '$createdAt'] } } },
      { $facet: {
        today: [{ $match: { _date: { $gte: startOfToday } } }, { $count: 'n' }],
        month: [{ $match: { _date: { $gte: startOfMonth } } }, { $count: 'n' }],
        active: [{ $match: { is_active: true } }, { $count: 'n' }],
        total: [{ $count: 'n' }]
      }}
    ]).toArray();

    // Bot-sent messages stats (unwind process_history)
    const [msgResult] = await collection.aggregate([
      { $match: matchStage },
      { $unwind: '$process_history' },
      { $match: { 'process_history.sender': 'bot' } },
      { $addFields: { _msgDate: { $cond: {
        if: { $eq: [{ $type: '$process_history.created' }, 'string'] },
        then: { $dateFromString: { dateString: '$process_history.created', onError: null } },
        else: '$process_history.created'
      }}}},
      { $match: { _msgDate: { $ne: null } } },
      { $facet: {
        today: [{ $match: { _msgDate: { $gte: startOfToday } } }, { $count: 'n' }],
        week:  [{ $match: { _msgDate: { $gte: startOfWeek } } },  { $count: 'n' }],
        month: [{ $match: { _msgDate: { $gte: startOfMonth } } }, { $count: 'n' }]
      }}
    ]).toArray();

    const totalContacts = await Contact.countDocuments({ user_id: userId });

    res.json({
      sessions: {
        today: sessionResult?.today?.[0]?.n ?? 0,
        month: sessionResult?.month?.[0]?.n ?? 0,
        active: sessionResult?.active?.[0]?.n ?? 0,
        total: sessionResult?.total?.[0]?.n ?? 0
      },
      messages: {
        today: msgResult?.today?.[0]?.n ?? 0,
        week:  msgResult?.week?.[0]?.n ?? 0,
        month: msgResult?.month?.[0]?.n ?? 0
      },
      bots: botIds.length,
      contacts: totalContacts
    });
  } catch (err) {
    console.error('getUserStats error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── SSE: real-time session update stream ─────────────────────────────────────
// GET /api/sessions/stream?token=<jwt>
// Keeps the connection open and pushes a small JSON event whenever any session
// belonging to this user changes. The browser (EventSource) auto-reconnects.
export const streamEvents = (req, res) => {
  const token = req.query.token;
  if (!token) {
    res.status(401).end();
    return;
  }

  let userId;
  let managerIdFromToken;
  try {
    const payload = jwt.verify(token, SSE_SECRET_KEY);
    userId = String(payload.id || payload.userId || '');
    managerIdFromToken = payload.manager_id ? String(payload.manager_id) : null;
  } catch {
    res.status(403).end();
    return;
  }

  if (!userId) {
    res.status(403).end();
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  console.log(`[SSE] client connected userId=${userId} managerIdFromToken=${managerIdFromToken || '(none)'}`);

  // Keepalive comment every 30s to prevent proxy timeouts
  const keepalive = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);

  const handler = (event) => {
    // Allow: own userId, or manager's userId (for reps/rep_managers working under a company)
    const eventUserId = String(event.userId);
    const matches = eventUserId === userId || (managerIdFromToken && eventUserId === managerIdFromToken);
    if (!matches) return;
    console.log(`[SSE] pushing session_update to userId=${userId} phone=${event.phone}`);
    const data = JSON.stringify({ type: 'session_update', phone: event.phone });
    res.write(`data: ${data}\n\n`);
  };

  // Deliver notification events directly to the target rep
  const notifHandler = (event) => {
    if (String(event.userId) !== userId) return;
    console.log(`[SSE] pushing notification to userId=${userId}`);
    const data = JSON.stringify({ type: 'notification', notification: event.notification });
    res.write(`data: ${data}\n\n`);
  };

  eventBus.on('session:update', handler);
  eventBus.on('notification:new', notifHandler);

  req.on('close', () => {
    console.log(`[SSE] client disconnected userId=${userId}`);
    clearInterval(keepalive);
    eventBus.off('session:update', handler);
    eventBus.off('notification:new', notifHandler);
  });
};
