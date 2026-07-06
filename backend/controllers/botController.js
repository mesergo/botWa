import mongoose from 'mongoose';
import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';
import Option from '../models/Option.js';
import BotSession from '../models/BotSession.js';
import Contact from '../models/Contact.js';
import Group from '../models/Group.js';
import GroupRemovalLog from '../models/GroupRemovalLog.js';
import RepGroup from '../models/RepGroup.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { handleWebService, findMatchingOption } from '../utils/webserviceHandler.js';
import { normalizePhone } from '../utils/phone.js';
import { getEffectiveRemovalConfig, matchRemovalKeywordWithLang, DEFAULT_REMOVAL_CONFIG } from '../utils/removalConfig.js';
import { pushMessagesToWhatsApp } from '../utils/whatsappSender.js';
import eventBus from '../utils/eventBus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Detect media type from a URL by its file extension.
// Returns 'Image', 'Video', 'Document', or null (for plain text).
const detectMediaType = (text) => {
  if (!text || typeof text !== 'string') return null;
  // Only consider URLs (must start with http/https)
  if (!/^https?:\/\//i.test(text.trim())) return null;
  const ext = text.split('?')[0].split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'Image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'Video';
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip'].includes(ext)) return 'Document';
  if (['oga', 'ogg', 'mp3', 'wav', 'm4a', 'aac', 'opus'].includes(ext)) return 'Audio';
  console.log(`[detectMediaType] 🔍 URL has unknown extension: .${ext} — treating as text | url=${text.substring(0, 80)}`);
  return null;
};

// Helper: Convert base64 to URL
const convertBase64ToUrl = (base64Data, req) => {
  if (!base64Data || !base64Data.startsWith('data:image')) {
    return base64Data; // Return as-is if not base64
  }

  try {
    const matches = base64Data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches) return base64Data;

    const ext = matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, 'base64');

    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    fs.writeFileSync(filepath, buffer);

    // Return URL
    const protocol = req?.protocol || 'http';
    const host = req?.get('host') || 'localhost:3001';
    return `${protocol}://${host}/uploads/${filename}`;
  } catch (error) {
    console.error('[convertBase64ToUrl] Error:', error);
    return base64Data; // Return original if conversion fails
  }
};

// Helper: Replace parameters in text
const replaceParameters = (text, parameters) => {
  if (!text) return '';
  return text.replace(/--(.+?)--/g, (match, paramName) => {
    const value = parameters[paramName];
    return value !== undefined ? String(value) : 'null';
  });
};

// Helper: Evaluate condition
const evaluateCondition = (operator, value, target) => {
  if (value === null || value === undefined) return false;
 
  const v = isNaN(Number(value)) ? String(value).toLowerCase() : Number(value);
  const t = isNaN(Number(target)) ? String(target).toLowerCase() : Number(target);
 
  switch(operator) {
    case 'gt': return typeof v === 'number' && typeof t === 'number' ? v > t : false;
    case 'gte': return typeof v === 'number' && typeof t === 'number' ? v >= t : false;
    case 'lt': return typeof v === 'number' && typeof t === 'number' ? v < t : false;
    case 'lte': return typeof v === 'number' && typeof t === 'number' ? v <= t : false;
    case 'cont':
    case 'contains': {
      const vStr = String(value).toLowerCase();
      const tStr = String(target).toLowerCase();
      return vStr.includes(tStr) || tStr.includes(vStr);
    }
    case 'contains_any': {
      const words = String(target).toLowerCase().split(/[ ,]+/);
      const valStr = String(value).toLowerCase();
      return words.some(w => w.trim() && (valStr.includes(w.trim()) || w.trim().includes(valStr)));
    }
    case 'contains_all': {
      const words = String(target).toLowerCase().split(/[ ,]+/);
      const valStr = String(value).toLowerCase();
      return words.every(w => !w.trim() || valStr.includes(w.trim()));
    }
    case 'eq':
    default: return String(value).toLowerCase() === String(target).toLowerCase();
  }
};

// Helper: Validate Israeli ID (9-digit Luhn-style checksum)
const validateIsraeliID = (id) => {
  const str = String(id).trim().replace(/[-\s]/g, '').padStart(9, '0');
  if (!/^\d{9}$/.test(str)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let val = parseInt(str[i]) * ((i % 2) + 1);
    if (val > 9) val -= 9;
    sum += val;
  }
  return sum % 10 === 0;
};

// Helper: Validate input by validation type
const validateInput = (type, value) => {
  const v = String(value || '').trim();
  switch (type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    case 'phone': {
      const digits = v.replace(/[-\s()]/g, '');
      return /^(\+972|0)([5][0-9]{8}|[2-9][0-9]{7,8})$/.test(digits);
    }
    case 'id':
      return validateIsraeliID(v);
    case 'url':
      return /^https?:\/\/.+\..+/.test(v);
    default:
      return true;
  }
};

const validateDateTimeInput = (mode, value) => {
  const v = String(value || '').trim();
  if (mode === 'time') {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
  } else if (mode === 'datetime') {
    return /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4} ([01]\d|2[0-3]):([0-5]\d)$/.test(v);
  } else {
    return /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(v);
  }
};

// Helper: Get flow data (nodes + edges)
const getFlowData = async (flowId, processId = null) => {
  let query = {};
 
  // Ensure flowId is a string
  const flowIdStr = flowId ? String(flowId) : null;
 
  if (processId) {
    // Get content widgets of this process AND nested fixed_process references living inside it.
    // Supports two storage formats:
    //   NEW: parent_process_id = this process, standard_process_id = child
    //   OLD (legacy): standard_process_id = this process, isStandardProcess=1, flow_id=null
    query.$or = [
      { standard_process_id: processId, isStandardProcess: 0 },
      { parent_process_id: processId },
      { standard_process_id: processId, isStandardProcess: 1, flow_id: null }
    ];
  } else if (flowIdStr) {
    // When we have a specific flow_id, only get widgets for that flow
    query.flow_id = flowIdStr;
    // Only include widgets that are NOT references to standard processes
    query.$or = [{ standard_process_id: null }, { isStandardProcess: 1 }];
  } else {
    // No flow_id - this shouldn't happen, but handle it
    console.error('[getFlowData] ❌ No flowId or processId provided!');
    return { nodes: [], edges: [] };
  }

  const widgets = await Widget.find(query);
  const options = await Option.find({
    widget_id: { $in: widgets.map(w => w.id) }
  });
 
  const nodes = widgets.map(w => {
    let metadata = w.image_file || {};
    const nodeOptions = options.filter(o => o.widget_id === w.id);

    // Reconstruct timeRanges / dateRanges for action_time_routing
    if (w.type === 'action_time_routing') {
      const routingMode = metadata.routingMode || 'time';
      let ranges = {};
      if (routingMode === 'date') {
        ranges.dateRanges = nodeOptions
          .filter(o => o.operator === 'date_range')
          .map(o => {
            const [fromDate, toDate] = o.value.split('|');
            return { fromDate, toDate };
          });
      } else {
        ranges.timeRanges = nodeOptions
          .filter(o => o.operator === 'time_range')
          .map(o => {
            const [fromHour, toHour] = o.value.split('-').map(Number);
            return { fromHour, toHour };
          });
      }
      return {
        id: w.id,
        type: w.type,
        position: { x: w.pos_x, y: w.pos_y },
        data: { ...metadata, ...ranges }
      };
    }
   
    // For action_web_service: exclude the 'default' option from the conditional options
    // so that findMatchingOption uses the correct indices (matching flowController behaviour).
    const conditionalOptions = w.type === 'action_web_service'
      ? nodeOptions.filter(o => o.operator !== 'default')
      : nodeOptions;

    return {
      id: w.id,
      type: w.type,
      position: { x: w.pos_x, y: w.pos_y },
      data: {
        ...metadata,
        label: metadata.label !== undefined ? metadata.label : (w.value || ''),
        content: metadata.content !== undefined ? metadata.content : (w.value || ''),
        options: conditionalOptions.length > 0 ? conditionalOptions.map(o => o.value) : undefined,
        optionOperators: conditionalOptions.length > 0 ? conditionalOptions.map(o => o.operator || 'eq') : undefined,
        optionImages: conditionalOptions.length > 0 ? conditionalOptions.map(o => o.image_url) : undefined,
        url: metadata.url,
        linkLabel: metadata.linkLabel,
        variableName: metadata.variableName,
        waitTime: metadata.waitTime,
        groupId: metadata.groupId,
        removeFromGroupMode: metadata.removeFromGroupMode,
        removeGroupId: metadata.removeGroupId,
        // For nested fixed_process refs: old format stores child processId in image_file,
        // new format stores it in standard_process_id (parent_process_id holds the parent).
        processId: (w.type === 'fixed_process' ? (metadata.processId || w.standard_process_id) : w.standard_process_id),
        isStandardProcess: w.isStandardProcess ? true : false
      }
    };
  });

  const edges = [];
  widgets.forEach(w => {
    if (w.next) {
      edges.push({ id: `e-${w.id}-${w.next}`, source: w.id, target: w.next });
    }
    const wOptions = options.filter(o => o.widget_id === w.id);

    // Special handling for time routing: use correct sourceHandle names
    if (w.type === 'action_time_routing') {
      let rangeIndex = 0;
      wOptions.forEach((o) => {
        if (o.next) {
          const sourceHandle = o.operator === 'default' ? 'option-default' : `option-${rangeIndex}`;
          edges.push({ id: `e-${w.id}-${sourceHandle}-${o.next}`, source: w.id, sourceHandle, target: o.next });
        }
        if (o.operator === 'time_range' || o.operator === 'date_range') rangeIndex++;
      });
    } else if (w.type === 'action_web_service') {
      // For action_web_service: build conditional option edges with sequential indices
      // (excluding 'default'), and build the default exit edge with sourceHandle='default'
      // so that findNextNode(wsId, edges, 'default') can locate it correctly.
      const defaultOpts = wOptions.filter(o => o.operator === 'default');
      const conditionalOpts = wOptions.filter(o => o.operator !== 'default');
      console.log(`[getFlowData] action_web_service node=${w.id} | DB options (${wOptions.length}): ${wOptions.map(o => o.operator + '→' + (o.next || 'null')).join(', ')}`);
      conditionalOpts.forEach((o, i) => {
        if (o.next) {
          edges.push({ id: `e-${w.id}-opt-${i}`, source: w.id, sourceHandle: `option-${i}`, target: o.next });
          console.log(`[getFlowData]   conditional edge option-${i} → ${o.next}`);
        }
      });
      defaultOpts.forEach(o => {
        if (o.next) {
          edges.push({ id: `e-${w.id}-default-${o.next}`, source: w.id, sourceHandle: 'default', target: o.next });
          console.log(`[getFlowData]   default edge → ${o.next}`);
        } else {
          console.log(`[getFlowData]   ⚠️ default option exists but next=null (not connected in editor!)`);
        }
      });
      if (defaultOpts.length === 0) {
        console.log(`[getFlowData]   ⚠️ NO default option found in DB for WS node ${w.id} — default exit will be null!`);
      }
    } else {
      wOptions.forEach((o, i) => {
        if (o.next) {
          edges.push({ id: `e-${w.id}-opt-${i}`, source: w.id, sourceHandle: `option-${i}`, target: o.next });
        }
      });
    }
  });

  return { nodes, edges };
};

// Helper: Find next node
const findNextNode = (nodeId, edges, handleId = null) => {
  const edge = edges.find(e =>
    e.source === nodeId && (!handleId || e.sourceHandle === handleId)
  );
  return edge ? edge.target : null;
};

// Helper: Add to history
const addToHistory = (session, message, nodeId) => {
  const history = session.process_history || [];
  const isUser = nodeId === 'user';
  history.push({
    ...message,
    node_id: nodeId,
    sender: isUser ? 'user' : 'bot',
    name: isUser ? 'משתמש' : 'בוט',
    created: new Date().toISOString()
  });
  session.process_history = history;
};

// Main: Walk through nodes chain
const walkChain = async (startNodeId, nodes, edges, session, flowId, req = null) => {
  const messages = [];
  let currentNodeId = startNodeId;
  let depth = 0;
  const maxDepth = 250;

  console.log(`\n${'▶'.repeat(60)}`);
  console.log(`[WALK] 🚀 START | startNodeId=${startNodeId}`);
  console.log(`[WALK]    nodes (${nodes.length}): ${nodes.map(n => n.type + '(' + n.id + ')').join(', ')}`);
  console.log(`[WALK]    edges (${edges.length}): ${edges.map(e => e.source + (e.sourceHandle ? '[' + e.sourceHandle + ']' : '') + '→' + e.target).join(', ')}`);
  console.log(`${'▶'.repeat(60)}`);

  // Helper: end of sub-flow → return to automatic_responses (keep session alive)
  // Mirrors simulator behaviour: flow end does NOT close the session.
  const returnToMenu = () => {
    const autoNode = nodes.find(n => n.type === 'automatic_responses');
    if (autoNode) {
      session.current_node_id   = autoNode.id;
      session.waiting_text_input = false;
      session.waiting_webservice = false;
      session.execution_stack   = [];
    } else {
      session.is_active         = false;
      session.current_node_id   = null;
      session.waiting_text_input = false;
    }
  };

  while (currentNodeId && depth < maxDepth) {
    depth++;

    console.log(`[WALK] ➡️  depth=${depth} | currentNodeId=${currentNodeId}`);
   
    const node = nodes.find(n => n.id === currentNodeId);
    if (!node) {
      console.log(`[WALK] ❌ Node NOT FOUND in nodes array: ${currentNodeId}`);
      break;
    }

    const nodeType = node.type;
    const nodeData = node.data;
    const params = session.parameters || {};

    console.log(`[WALK]    type=${nodeType} | data.content="${String(nodeData.content || '').substring(0, 60)}"`);

    // Handle different node types
    switch (nodeType) {
      case 'start':
        currentNodeId = findNextNode(currentNodeId, edges);
        break;

      case 'automatic_responses':
        // Stop here - waiting for user input to match
        session.current_node_id = currentNodeId;
        session.waiting_text_input = false;
        return messages;

      case 'output_text': {
        const text = replaceParameters(nodeData.content || '', params);
        const msg = { type: 'Text', text, created: new Date().toISOString() };
        messages.push(msg);
        addToHistory(session, msg, currentNodeId);
       
        // Check if this is the last node (no outgoing edges)
        const nextNode = findNextNode(currentNodeId, edges);
        console.log(`[WALK]    output_text → nextNode=${nextNode || '(none — last node)'}`);
        if (!nextNode) {
          console.log(`[WALK]    ⏹ output_text: no outgoing edge → returnToMenu()`);
          returnToMenu();
          return messages;
        }
        currentNodeId = nextNode;
        break;
      }

      case 'output_image': {
        let url = replaceParameters(nodeData.url || '', params);
        // Convert base64 to URL if needed
        url = convertBase64ToUrl(url, req);
       
        const mediaType = nodeData.mediaType || 'image';
        const caption = replaceParameters(nodeData.caption || '', params);
       
        // Send media message
        const mediaMsg = {
          type: mediaType === 'video' ? 'Video' : mediaType === 'pdf' ? 'Document' : 'Image',
          url,
          created: new Date().toISOString()
        };
        messages.push(mediaMsg);
        addToHistory(session, mediaMsg, currentNodeId);
       
        // Send caption as separate text message if exists
        if (caption && caption.trim()) {
          const textMsg = { type: 'Text', text: caption, created: new Date().toISOString() };
          messages.push(textMsg);
          addToHistory(session, textMsg, currentNodeId);
        }
       
        // Check if this is the last node (no outgoing edges)
        const nextNode = findNextNode(currentNodeId, edges);
        if (!nextNode) {
          returnToMenu();
          return messages;
        }
        currentNodeId = nextNode;
        break;
      }

      case 'output_link': {
        const text = replaceParameters(nodeData.linkLabel || 'קישור', params);
        // --varName-- placeholders in url are resolved via replaceParameters
        const url = replaceParameters(nodeData.url || '', params);
        const msg = { type: 'URL', text, url, created: new Date().toISOString() };
        messages.push(msg);
        addToHistory(session, msg, currentNodeId);
       
        // Check if this is the last node (no outgoing edges)
        const nextNode = findNextNode(currentNodeId, edges);
        if (!nextNode) {
          returnToMenu();
          return messages;
        }
        currentNodeId = nextNode;
        break;
      }

     case 'output_menu': {
        const text = replaceParameters(nodeData.content || '', params);
       
        // Build options as simple string array
        const rawOptions = nodeData.options || [];
        const options = rawOptions
          .filter(opt => opt !== 'default')
          .map(opt => String(opt));
       
        // הטקסט נשלח פעם אחת בלבד — כחלק מהודעת Options עם הכפתורים (לא נפרד)
        const optionsMsg = { type: 'Options', text: text || '', options, created: new Date().toISOString() };
        messages.push(optionsMsg);
        addToHistory(session, optionsMsg, currentNodeId);
       
        // Stop here and wait for user selection
        session.current_node_id = currentNodeId;
        session.waiting_text_input = false;
        return messages;
      }

      case 'input_text':
      case 'input_date':
      case 'input_file': {
        // Send prompt if exists
        if (nodeData.label) {
          const text = replaceParameters(nodeData.label, params);
          const msg = { type: 'Text', text, created: new Date().toISOString() };
          messages.push(msg);
          addToHistory(session, msg, currentNodeId);
        }
       
        // Stop and wait for input
        session.current_node_id = currentNodeId;
        session.waiting_text_input = true;
        return messages;
      }

      case 'action_wait': {
        const waitTime = parseInt(nodeData.waitTime) || 1;
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        currentNodeId = findNextNode(currentNodeId, edges);
        break;
      }

      case 'action_add_to_group': {
        // Unified add/remove from group node. If groupActionMode === 'remove',
        // delegate to the same logic used by action_remove_from_group.
        if (nodeData.groupActionMode === 'remove') {
          const waPhone = normalizePhone(session.parameters?.waPhone);
          const isSimulated = !waPhone || waPhone === 'Simulated' || waPhone.toLowerCase() === 'simulator';
          console.log(`[BOT] action_add_to_group(remove) | waPhone=${waPhone} | isSimulated=${isSimulated} | mode=${nodeData.removeFromGroupMode} | removeGroupId=${nodeData.removeGroupId}`);
          const userId = String(session.user_id);
          const removeMode = nodeData.removeFromGroupMode || 'specific';
          let removedGroupName = null;
          try {
            if (removeMode === 'specific' && nodeData.removeGroupId) {
              const group = await Group.findOne({ _id: nodeData.removeGroupId, user_id: userId });
              if (group) {
                removedGroupName = group.name;
                if (!isSimulated) {
                  const contact = await Contact.findOne({ user_id: userId, phone: waPhone });
                  if (contact) {
                    const beforeCount = group.contact_ids.length;
                    group.contact_ids = group.contact_ids.filter(id => String(id) !== String(contact._id));
                    if (group.contact_ids.length < beforeCount) {
                      await group.save();
                      console.log(`[BOT] ✅ Removed ${waPhone} from group "${group.name}"`);
                      try {
                        await GroupRemovalLog.create({
                          user_id: userId,
                          group_id: group._id,
                          group_name: group.name,
                          is_blocklist: !!group.is_blocklist,
                          contact_id: contact._id,
                          phone: contact.phone || waPhone,
                          full_name: contact.full_name || '',
                          whatsapp_name: contact.whatsapp_name || '',
                          email: contact.email || '',
                          reason: String(nodeData.removalReason || '').trim(),
                          removed_by: 'בוט (תרשים זרימה)',
                        });
                      } catch (logErr) {
                        console.error('[BOT] action_add_to_group(remove) failed to write removal log:', logErr.message);
                      }
                    } else {
                      console.log(`[BOT] action_add_to_group(remove): ${waPhone} not found in group "${group.name}", skipping`);
                    }
                  } else {
                    console.log(`[BOT] action_add_to_group(remove): contact ${waPhone} not found, skipping`);
                  }
                }
              } else {
                console.warn(`[BOT] action_add_to_group(remove): group ${nodeData.removeGroupId} not found`);
              }
            } else if (removeMode === 'all') {
              removedGroupName = 'רשימת הסרה';
              if (!isSimulated) {
                let blocklist = await Group.findOne({ user_id: userId, is_blocklist: true });
                if (!blocklist) {
                  blocklist = await Group.create({ user_id: userId, name: 'רשימת הסרה', is_blocklist: true, contact_ids: [], phones: [] });
                }
                let contact = await Contact.findOne({ user_id: userId, phone: waPhone });
                if (!contact) {
                  contact = await Contact.create({ user_id: userId, phone: waPhone });
                }
                const result = await Group.updateOne(
                  { _id: blocklist._id },
                  { $addToSet: { phones: waPhone, contact_ids: contact._id } }
                );
                if (result.modifiedCount > 0) {
                  console.log(`[BOT] ✅ Added ${waPhone} to blocklist (רשימת הסרה)`);
                } else {
                  console.log(`[BOT] action_add_to_group(remove): ${waPhone} already in blocklist`);
                }
              }
            }
          } catch (err) {
            console.error('[BOT] action_add_to_group(remove) error:', err.message);
          }
          if (removedGroupName) {
            session.parameters = { ...(session.parameters || {}), removeGroup: removedGroupName };
            session.markModified('parameters');
          }
          currentNodeId = findNextNode(currentNodeId, edges);
          break;
        }

        const waPhone = normalizePhone(session.parameters?.waPhone);
        // In simulator mode waPhone is absent or 'Simulated' — skip silently
        const isSimulated = !waPhone || waPhone === 'Simulated' || waPhone.toLowerCase() === 'simulator';
        let addedGroupName = null;
        if (nodeData.groupId) {
          try {
            const userId = String(session.user_id);
            const group = await Group.findOne({ _id: nodeData.groupId, user_id: userId });
            if (group) {
              addedGroupName = group.name;
              if (!isSimulated) {
                let contact = await Contact.findOne({ user_id: userId, phone: waPhone });
                if (!contact) {
                  contact = await Contact.create({ user_id: userId, phone: waPhone });
                }
                const existing = new Set((group.contact_ids || []).map(String));
                existing.add(String(contact._id));
                group.contact_ids = Array.from(existing).map(id => new mongoose.Types.ObjectId(id));
                await group.save();
                console.log(`[BOT] ✅ Added ${waPhone} to group "${group.name}"`);
              }
            } else {
              console.warn(`[BOT] action_add_to_group: group ${nodeData.groupId} not found`);
            }
          } catch (err) {
            console.error('[BOT] action_add_to_group error:', err.message);
          }
        } else {
          console.log(`[BOT] action_add_to_group: skipping (no groupId)`);
        }
        if (addedGroupName) {
          session.parameters = { ...(session.parameters || {}), addGroup: addedGroupName };
          session.markModified('parameters');
        }
        currentNodeId = findNextNode(currentNodeId, edges);
        break;
      }

      case 'action_remove_from_group': {
        const waPhone = normalizePhone(session.parameters?.waPhone);
        const isSimulated = !waPhone || waPhone === 'Simulated' || waPhone.toLowerCase() === 'simulator';
        console.log(`[BOT] action_remove_from_group | waPhone=${waPhone} | isSimulated=${isSimulated} | mode=${nodeData.removeFromGroupMode} | removeGroupId=${nodeData.removeGroupId}`);
        const userId = String(session.user_id);
        const removeMode = nodeData.removeFromGroupMode || 'specific';
        let removedGroupName = null;
        try {
          if (removeMode === 'specific' && nodeData.removeGroupId) {
            const group = await Group.findOne({ _id: nodeData.removeGroupId, user_id: userId });
            if (group) {
              removedGroupName = group.name;
              if (!isSimulated) {
                const contact = await Contact.findOne({ user_id: userId, phone: waPhone });
                if (contact) {
                  const beforeCount = group.contact_ids.length;
                  group.contact_ids = group.contact_ids.filter(id => String(id) !== String(contact._id));
                  if (group.contact_ids.length < beforeCount) {
                    await group.save();
                    console.log(`[BOT] ✅ Removed ${waPhone} from group "${group.name}"`);
                    try {
                      await GroupRemovalLog.create({
                        user_id: userId,
                        group_id: group._id,
                        group_name: group.name,
                        is_blocklist: !!group.is_blocklist,
                        contact_id: contact._id,
                        phone: contact.phone || waPhone,
                        full_name: contact.full_name || '',
                        whatsapp_name: contact.whatsapp_name || '',
                        email: contact.email || '',
                        reason: String(nodeData.removalReason || '').trim(),
                        removed_by: 'בוט (תרשים זרימה)',
                      });
                    } catch (logErr) {
                      console.error('[BOT] action_remove_from_group failed to write removal log:', logErr.message);
                    }
                  } else {
                    console.log(`[BOT] action_remove_from_group: ${waPhone} not found in group "${group.name}", skipping`);
                  }
                } else {
                  console.log(`[BOT] action_remove_from_group: contact ${waPhone} not found, skipping`);
                }
              }
            } else {
              console.warn(`[BOT] action_remove_from_group: group ${nodeData.removeGroupId} not found`);
            }
          } else if (removeMode === 'all') {
            removedGroupName = 'רשימת הסרה';
            if (!isSimulated) {
              let blocklist = await Group.findOne({ user_id: userId, is_blocklist: true });
              if (!blocklist) {
                blocklist = await Group.create({ user_id: userId, name: 'רשימת הסרה', is_blocklist: true, contact_ids: [], phones: [] });
              }
              let contact = await Contact.findOne({ user_id: userId, phone: waPhone });
              if (!contact) {
                contact = await Contact.create({ user_id: userId, phone: waPhone });
              }
              const result = await Group.updateOne(
                { _id: blocklist._id },
                {
                  $addToSet: {
                    phones: waPhone,
                    contact_ids: contact._id,
                  }
                }
              );
              if (result.modifiedCount > 0) {
                console.log(`[BOT] ✅ Added ${waPhone} to blocklist (רשימת הסרה)`);
              } else {
                console.log(`[BOT] action_remove_from_group: ${waPhone} already in blocklist`);
              }
            }
          }
        } catch (err) {
          console.error('[BOT] action_remove_from_group error:', err.message);
        }
        if (removedGroupName) {
          session.parameters = { ...(session.parameters || {}), removeGroup: removedGroupName };
          session.markModified('parameters');
        }
        currentNodeId = findNextNode(currentNodeId, edges);
        break;
      }

      case 'action_transfer_to_agent': {
        // Hand the conversation off to a human agent.
        // - Mark the session as is_agent=true with a fresh agent_since (bot pauses for 30 min)
        // - Store the selected RepGroup so a rep from that group can pick up the conversation
        // - Optionally store a specific rep_user_id if the editor configured "specific rep"
        // - Stop the flow execution (terminal node)
        const repGroupId = nodeData.repGroupId || null;
        const repAssignmentMode = nodeData.repAssignmentMode === 'specific' ? 'specific' : 'any';
        const repUserId = repAssignmentMode === 'specific' ? (nodeData.repUserId || null) : null;

        // ── Availability check ──────────────────────────────────────────────
        // Check if any member of the target group / the specific rep is available.
        // If no one is available, send the group's unavailableMessage to the customer.
        let someoneAvailable = true;
        let unavailableMsg = '';
        try {
          if (repAssignmentMode === 'specific' && repUserId) {
            // Check specific rep's availability
            const targetRep = await User.findById(repUserId).select('availability_status').lean();
            someoneAvailable = targetRep?.availability_status === 'available';
            if (!someoneAvailable && repGroupId) {
              const grp = await RepGroup.findById(repGroupId).select('unavailableMessage').lean();
              unavailableMsg = grp?.unavailableMessage || '';
            }
          } else if (repGroupId) {
            // Check if any rep in the group is available
            const groupDoc = await RepGroup.findById(repGroupId).select('unavailableMessage').lean();
            unavailableMsg = groupDoc?.unavailableMessage || '';
            const availableRep = await User.findOne({
              rep_group_ids: repGroupId,
              availability_status: 'available'
            }).select('_id').lean();
            someoneAvailable = !!availableRep;
          }
        } catch (availErr) {
          console.error('[BOT] action_transfer_to_agent: availability check failed:', availErr.message);
        }

        if (!someoneAvailable && unavailableMsg) {
          // Send the unavailable message to the customer before transferring
          const unavailMsgEntry = {
            type: 'SendItem',
            text: unavailableMsg,
            sender: 'bot',
            name: 'מערכת',
            created: new Date().toISOString()
          };
          messages.push(unavailMsgEntry);
          addToHistory(session, unavailMsgEntry, currentNodeId);
          console.log(`[BOT] ⚠️ action_transfer_to_agent | no one available — sending unavailableMessage`);
        }
        // ───────────────────────────────────────────────────────────────────

        session.is_agent = true;
        session.agent_since = new Date();
        session.status = 'waiting';
        // If a specific rep was chosen, only that rep should see the conversation —
        // store rep_user_id and null out rep_group_id. Otherwise keep rep_group_id so
        // all reps in the selected group can pick it up.
        if (repAssignmentMode === 'specific' && repUserId) {
          session.rep_group_id = null;
          session.rep_user_id = repUserId;
        } else {
          session.rep_group_id = repGroupId;
          session.rep_user_id = null;
        }
        session.current_node_id = currentNodeId;
        session.waiting_text_input = false;

        addToHistory(
          session,
          {
            type: 'System',
            text: 'השיחה הועברה לנציג',
            sender: 'system',
            name: 'מערכת',
            created: new Date().toISOString()
          },
          currentNodeId
        );

        console.log(`[BOT] ✅ action_transfer_to_agent | session=${session._id} | rep_group_id=${repGroupId} | rep_user_id=${repUserId} | someoneAvailable=${someoneAvailable} | bot paused for 30 minutes`);
        return messages;
      }

      case 'action_time_routing': {
        // Get current date/time in Israel timezone (handles DST automatically)
        const now = new Date();
        const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
        const routingMode = nodeData.routingMode || 'time';

        let matchedIndex = -1;

        if (routingMode === 'date') {
          const israelDateStr = [
            israelTime.getFullYear(),
            String(israelTime.getMonth() + 1).padStart(2, '0'),
            String(israelTime.getDate()).padStart(2, '0'),
          ].join('-');

          const dateRanges = nodeData.dateRanges || [];
          for (let i = 0; i < dateRanges.length; i++) {
            const range = dateRanges[i];
            if (range.fromDate && range.toDate && israelDateStr >= range.fromDate && israelDateStr <= range.toDate) {
              matchedIndex = i;
              break;
            }
          }
        } else {
          const israelHour = israelTime.getHours();
          const timeRanges = nodeData.timeRanges || [];
          for (let i = 0; i < timeRanges.length; i++) {
            const range = timeRanges[i];
            const fromHour = parseInt(range.fromHour) || 0;
            const toHour = parseInt(range.toHour) || 23;

            let inRange = false;
            if (fromHour <= toHour) {
              inRange = israelHour >= fromHour && israelHour < toHour;
            } else {
              inRange = israelHour >= fromHour || israelHour < toHour;
            }

            if (inRange) {
              matchedIndex = i;
              break;
            }
          }
        }

        // Route to matched option or default
        if (matchedIndex >= 0) {
          currentNodeId = findNextNode(currentNodeId, edges, `option-${matchedIndex}`);
        } else {
          currentNodeId = findNextNode(currentNodeId, edges, 'option-default');
        }
        break;
      }

      case 'action_web_service': {
        // If we're continuing from a previous webservice call with user input
        const userInput = session.waiting_webservice ? session.last_user_input : null;
       
        // Call webservice
        const wsResult = await handleWebService(node, session, userInput);
       
        // Add messages to response
        messages.push(...wsResult.messages);
        wsResult.messages.forEach(msg => addToHistory(session, msg, currentNodeId));
       
        // If waiting for input, stop here (even if this is the last node)
        if (wsResult.waitingInput) {
          console.log(`[WALK]    action_web_service → waitingInput=true → STOP`);
          session.current_node_id = currentNodeId;
          session.waiting_webservice = true;
          session.waiting_text_input = true;
          return messages;
        }

        // If Goto action: navigate to node by label
        if (wsResult.gotoLabel) {
          const gotoNode = nodes.find(n => n.data.label === wsResult.gotoLabel);
          if (gotoNode) {
            console.log(`[WALK]    action_web_service → Goto "${wsResult.gotoLabel}" (${gotoNode.id})`);
            session.waiting_webservice = false;
            currentNodeId = gotoNode.id;
            break;
          }
          console.warn(`[WALK]    action_web_service → Goto target NOT FOUND: "${wsResult.gotoLabel}"`);
        }
       
        // If we have a return value, find matching option
        if (wsResult.returnValue !== null && wsResult.returnValue !== undefined) {
          console.log(`[WALK]    action_web_service → returnValue=${wsResult.returnValue}`);
          console.log(`[WALK]    node.data.options=${JSON.stringify(node.data.options)} | node.data.optionOperators=${JSON.stringify(node.data.optionOperators)}`);
          const edgesFromWs = edges.filter(e => e.source === currentNodeId);
          console.log(`[WALK]    edges from WS node: ${edgesFromWs.map(e => (e.sourceHandle || 'no-handle') + '→' + e.target).join(', ')}`);
          const matchedIdx = findMatchingOption(node, wsResult.returnValue);
          if (matchedIdx !== -1) {
            const nextIdAfterWs = findNextNode(currentNodeId, edges, `option-${matchedIdx}`);
            console.log(`[WALK]    ✅ Matched option-${matchedIdx} → nextNode=${nextIdAfterWs}`);
            currentNodeId = nextIdAfterWs;
            session.waiting_webservice = false;
            break;
          }
          console.log(`[WALK]    ⚠️ No option matched returnValue=${wsResult.returnValue} → falling through to default exit`);
        }
       
        // No match or no return value - take default exit
        session.waiting_webservice = false;
        const allWsEdges = edges.filter(e => e.source === currentNodeId);
        console.log(`[WALK]    action_web_service → all edges from this node: ${allWsEdges.map(e => (e.sourceHandle || 'no-handle') + '→' + e.target).join(', ')}`);
        const nextNode = findNextNode(currentNodeId, edges, 'default');
        console.log(`[WALK]    action_web_service → default exit → nextNode=${nextNode || '(none)'}`);
       
        if (!nextNode) {
          console.log(`[WALK]    ⏹ action_web_service: no default edge → returnToMenu()`);
          returnToMenu();
          return messages;
        }
       
        currentNodeId = nextNode;
        break;
      }

      case 'fixed_process': {
        // Load subprocess
        const processId = nodeData.processId;
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`[SUB-FLOW] ▶ ENTER fixed_process | fpNode=${currentNodeId} | processId=${processId || '(none)'} | flowId=${flowId}`);
        console.log(`[SUB-FLOW]   session._id=${session._id} | current_node BEFORE=${session.current_node_id} | stack_before=${JSON.stringify(session.execution_stack || [])}`);
        if (processId) {
          const subFlow = await getFlowData(flowId, processId);
          console.log(`[SUB-FLOW]   getFlowData(flowId=${flowId}, processId=${processId}) → ${subFlow.nodes.length} nodes, ${subFlow.edges.length} edges`);
          console.log(`[SUB-FLOW]   node types in sub-flow: ${subFlow.nodes.map(n => n.type + '(' + n.id + ')').join(', ')}`);
          console.log(`[SUB-FLOW]   edges in sub-flow: ${subFlow.edges.map(e => e.source + '->' + e.target + (e.sourceHandle ? '[' + e.sourceHandle + ']' : '')).join(', ')}`);
          const startNode = subFlow.nodes.find(n => n.type === 'start');
          console.log(`[SUB-FLOW]   startNode: ${startNode ? startNode.id : '❌ NOT FOUND — sub-flow will be SKIPPED'}`);
         
          if (startNode) {
            // Save parent context
            const returnToId = findNextNode(currentNodeId, edges);
            const stack = session.execution_stack || [];
            stack.push({ nodeId: currentNodeId, returnTo: returnToId });
            session.execution_stack = stack;
            session.markModified('execution_stack');
            console.log(`[SUB-FLOW]   pushed execution_stack | nodeId=${currentNodeId} | returnTo=${returnToId} | stackSize=${stack.length}`);
           
            // Process subprocess
            console.log(`[SUB-FLOW]   calling walkChain from startNode=${startNode.id}`);
            const subMessages = await walkChain(startNode.id, subFlow.nodes, subFlow.edges, session, flowId, req);
            console.log(`[SUB-FLOW]   walkChain RETURNED | msgs=${subMessages.length} | waiting_text=${session.waiting_text_input} | waiting_ws=${session.waiting_webservice} | current_node=${session.current_node_id}`);
            messages.push(...subMessages);
           
            // If subprocess finished, return to parent.
            // NOTE: output_menu pauses with waiting_text_input=false, so we must
            // also check whether the sub-flow stopped at an output_menu node.
            const currentSubNode = subFlow.nodes.find(n => n.id === session.current_node_id);
            const pausedAtMenu = currentSubNode?.type === 'output_menu';
            if (!session.waiting_text_input && !session.waiting_webservice && !pausedAtMenu) {
              const returnTo = stack.pop()?.returnTo;
              session.execution_stack = stack;
              session.markModified('execution_stack');
              console.log(`[SUB-FLOW]   ✅ sub-flow DONE — popped stack | returnTo=${returnTo} | stackSize=${stack.length}`);
              console.log(`${'─'.repeat(60)}\n`);
              currentNodeId = returnTo;
            } else {
              console.log(`[SUB-FLOW]   ⏸ sub-flow PAUSED — waiting for user input${pausedAtMenu ? ' (output_menu)' : ''}`);
              console.log(`[SUB-FLOW]   session.current_node_id=${session.current_node_id} | waiting_text=${session.waiting_text_input} | waiting_ws=${session.waiting_webservice} | pausedAtMenu=${pausedAtMenu}`);
              console.log(`[SUB-FLOW]   stack saved to DB: ${JSON.stringify(session.execution_stack)}`);
              console.log(`${'─'.repeat(60)}\n`);
              return messages;
            }
          } else {
            console.warn(`[SUB-FLOW] ❌ no start node in sub-flow for processId=${processId} — SKIPPING`);
            console.log(`${'─'.repeat(60)}\n`);
          }
        } else {
          console.warn(`[SUB-FLOW] ❌ no processId on fixed_process node=${currentNodeId} — SKIPPING`);
          console.log(`${'─'.repeat(60)}\n`);
          currentNodeId = findNextNode(currentNodeId, edges);
        }
        break;
      }

      default:
        currentNodeId = findNextNode(currentNodeId, edges);
    }
  }

  // End of chain
  if (depth >= maxDepth) {
    console.error('[WALK] ⚠️ Max depth reached');
  } else if (!currentNodeId) {
    console.log(`[WALK] 🏁 currentNodeId=null → returnToMenu()`);
    returnToMenu();
  }

  console.log(`[WALK] 🏁 END | depth=${depth} | messages=${messages.length} | currentNodeId=${currentNodeId}`);
  return messages;
};

// ─── Proactive WhatsApp push ──────────────────────────────────────────────────
// pushMessagesToWhatsApp is now imported from ../utils/whatsappSender.js
// (shared with sessionController for agent media messages)
// ─────────────────────────────────────────────────────────────────────────────
const _UNUSED_pushMessagesToWhatsApp_MOVED = async (phone, messages, user = null) => {
  if (!messages.length) return false;

  // Prefer the bot owner's dialog360 credentials (matches sendAgentMessage logic).
  let endpoint;
  let waToken;
  if (user && user.dialog360_bot_id) {
    endpoint = `dialog360/${user.dialog360_bot_id}`;
    waToken = crypto.createHash('sha1').update(user.dialog360_bot_id + 'moomoo').digest('hex');
  } else {
    endpoint = null;
    waToken = null;
  }
  if (!endpoint) return false;

  // Normalize phone: strip non-digits, replace leading 0 with 972
  const normalizedPhone = String(phone).replace(/[^0-9]/g, '').replace(/^0/, '972').replace(/^972972/, '972');

  console.log(`[WA-PUSH] 📞 Sending to phone=${normalizedPhone} via endpoint=${endpoint}${user && user.dialog360_bot_id ? ' (user dialog360_bot_id)' : ' (fallback)'}`);

  // Returns true on success, false on failure
  const sendOne = async (body) => {
    try {
      const res = await fetch(`https://wa.message.co.il/api/${endpoint}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
          'token': waToken,
        },
        body: JSON.stringify({ ...body, phone: normalizedPhone, fromMe: 1 }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[WA-PUSH] ❌ HTTP ${res.status} | body: ${JSON.stringify(body).substring(0, 100)} | resp: ${errText.substring(0, 200)}`);
        return false;
      } else {
        const kind = body.image ? 'image' : body.video ? 'video' : body.file ? 'file' : body.buttons ? 'buttons' : 'text';
        console.log(`[WA-PUSH] ✅ Sent ${kind} to ${normalizedPhone}`);
        return true;
      }
    } catch (err) {
      console.error('[WA-PUSH] ❌ Exception:', err.message);
      return false;
    }
  };

  let textBuffer = '';
  let anySuccess = false;

  for (const msg of messages) {
    switch (msg.type) {
      case 'Text':
        if (msg.text) textBuffer += msg.text + '\n';
        break;

      case 'Options': {
        // Group accumulated text + options → buttons (≤3) or list (>3)
        // Prefer accumulated textBuffer; fall back to text embedded in the Options message.
        const headerText = textBuffer.trim() || (msg.text && msg.text.trim()) || '';
        if (headerText) {
          if (await sendOne({ text: headerText, buttons: msg.options })) anySuccess = true;
        } else {
          // No body text — WhatsApp requires non-empty body; send options as plain text list
          const fallbackText = msg.options.join('\n');
          if (fallbackText && await sendOne({ text: fallbackText })) anySuccess = true;
        }
        textBuffer = '';
        await _sleep(400);
        break;
      }

      case 'Image': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
        if (await sendOne({ image: msg.url, text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'Video': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
        if (await sendOne({ video: msg.url, text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'Document': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
        if (await sendOne({ file: msg.url, filename: msg.filename || 'file', text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'URL':
        // Append URL to text buffer — dialog360 linkifies plain URLs in text
        textBuffer += `${msg.text ? msg.text + '\n' : ''}${msg.url}\n`;
        break;

      case 'SendItem': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
        const itemText = [msg.title, msg.subtitle].filter(Boolean).join('\n');
        const btnList = (msg.options || []).map(o =>
          typeof o === 'string' ? o : (o.label || o.text || o.value || String(o))
        );
        if (await sendOne(btnList.length > 0 ? { text: itemText, buttons: btnList } : { text: itemText })) anySuccess = true;
        await _sleep(400);
        break;
      }

      default:
        break;
    }
  }

  // Flush any remaining accumulated text
  if (textBuffer.trim()) {
    if (await sendOne({ text: textBuffer.trim() })) anySuccess = true;
  }

  // Only return true if at least one message was actually delivered.
  // If false, the caller will fall back to returning messages in the JSON response
  // so that dialog360 can handle sending via its own handleShamirResponse.
  console.log(`[WA-PUSH] 🏁 anySuccess=${anySuccess}`);
  return anySuccess;
};

// Helper: attempt auto-removal-from-group based on opt-out keywords.
// Returns { matched, outMessages } when the sender was added to the blocklist,
// or null when no keyword matched / feature is disabled / simulator request.
// Caller is responsible for short-circuiting the response when this returns truthy.
const performAutoRemoval = async (user, sender, phone, text, name = '') => {
  try {
    const inboundText = String(text || '').trim();
    if (!inboundText) return null;
    sender = normalizePhone(sender);
    const isSimulatedSender = !sender || sender === 'Simulated' || String(sender).toLowerCase() === 'simulator';
    if (isSimulatedSender) return null;

    const removalCfg = await getEffectiveRemovalConfig(user);
    if (!removalCfg || removalCfg.enabled === false) return null;

    const removalMatch = matchRemovalKeywordWithLang(inboundText, removalCfg);
    if (!removalMatch) return null;
    const { matched, lang } = removalMatch;

    console.log(`[BOT] 🛑 removal keyword matched: "${matched}" | phone=${sender}`);
    const userId = String(user._id);
    let blocklist = await Group.findOne({ user_id: userId, is_blocklist: true });
    if (!blocklist) {
      blocklist = await Group.create({ user_id: userId, name: 'רשימת הסרה', is_blocklist: true, contact_ids: [], phones: [] });
    }
    let contact = await Contact.findOne({ user_id: userId, phone: sender });
    if (!contact) {
      contact = await Contact.create({ user_id: userId, phone: sender });
    }
    const updateRes = await Group.updateOne(
      { _id: blocklist._id },
      { $addToSet: { phones: sender, contact_ids: contact._id } }
    );
    if (updateRes.modifiedCount > 0) {
      try {
        await GroupRemovalLog.create({
          user_id: userId,
          group_id: blocklist._id,
          group_name: blocklist.name,
          is_blocklist: true,
          contact_id: contact?._id || null,
          phone: sender,
          full_name: contact?.full_name || '',
          whatsapp_name: contact?.whatsapp_name || name || '',
          email: contact?.email || '',
          reason: `מילת מפתח: ${matched}`,
          removed_by: 'auto-keyword'
        });
      } catch (logErr) {
        console.error('[BOT] removal-keyword log write failed:', logErr.message);
      }
    }
 
    try {
      await BotSession.updateMany(
        { $or: [{ sender }, { customer_phone: phone }], is_active: true },
        { $set: { is_active: false } }
      );
    } catch (sessErr) {
      console.error('[BOT] failed to close sessions after removal:', sessErr.message);
    }

    const confirmText = lang === 'en'
      ? (String(removalCfg.message_en || '').trim() || String(DEFAULT_REMOVAL_CONFIG.message_en || '').trim() || 'You have been successfully removed from our mailing list. Thank you!')
      : (String(removalCfg.message_he || '').trim() || String(DEFAULT_REMOVAL_CONFIG.message_he || '').trim() || 'הוסרת בהצלחה מרשימת התפוצה. לא נשלח אליך יותר הודעות. תודה!');
    console.log(`[BOT] 📤 sending removal confirmation to ${sender}: "${confirmText.substring(0, 80)}"`);
    const outMessages = [{ type: 'Text', text: confirmText, created: new Date().toISOString() }];
    return { matched, outMessages };
  } catch (err) {
    console.error('[BOT] performAutoRemoval failed:', err.message);
    return null;
  }
};

// Main API endpoint
export const respondToMessage = async (req, res) => {
  const reqStartedAt = Date.now();
  try {
    // Support both GET (query params) and POST (body) requests
    const isGetRequest = req.method === 'GET';
    const source = (isGetRequest ? req.query : req.body) || {};
   
    const { phone, text = '', sender: rawSender = 'unknown', token: tokenParam, bot_id, name = '' } = source;
    const sender = normalizePhone(rawSender);
    const token = req.headers.authorization?.replace('Bearer ', '') || tokenParam;

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`[BOT] 📩 INCOMING MESSAGE @ ${new Date().toISOString()}`);
    console.log(`[BOT]    method   = ${req.method}`);
    // dialog360 webhook convention:
    //   sender = the CUSTOMER who sent the message (used as conversation key)
    //   phone  = the BUSINESS WhatsApp number that received the message
    console.log(`[BOT]    👤 CUSTOMER (sender) = "${sender}"`);
    console.log(`[BOT]    🏢 BUSINESS (phone)  = "${phone}"`);
    console.log(`[BOT]    name     = "${name}"`);
    console.log(`[BOT]    text     = "${String(text).substring(0, 200)}"${String(text).length > 200 ? '…' : ''}`);
    console.log(`[BOT]    token    = ${token ? token.substring(0, 8) + '…' : '(missing)'}`);
    console.log(`[BOT]    ip       = ${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`);

    if (!phone || !token) {
      console.log(`[BOT] ❌ Rejected — missing phone or token`);
      console.log(`${'═'.repeat(80)}\n`);
      return res.status(400).json({
        StatusId: 0,
        StatusDescription: 'Missing phone or token'
      });
    }

    // Find bot directly by its public_id (used as the API token)
    const tokenBot = await BotFlow.findOne({ public_id: token });
    if (!tokenBot) {
      console.log(`[BOT] ❌ Bot not found for token=${token.substring(0, 8)}…`);
      console.log(`${'═'.repeat(80)}\n`);
      return res.status(404).json({
        StatusId: 0,
        StatusDescription: 'Bot not found'
      });
    }
    const user = await User.findById(tokenBot.user_id);
    if (!user) {
      console.log(`[BOT] ❌ User not found for bot=${tokenBot._id} (user_id=${tokenBot.user_id})`);
      console.log(`${'═'.repeat(80)}\n`);
      return res.status(404).json({
        StatusId: 0,
        StatusDescription: 'User not found'
      });
    }
    console.log(`[BOT] 🤖 Bot identified | _id=${tokenBot._id} | name="${tokenBot.name || '(unnamed)'}" | owner=${user.email || user._id}`);

    // Scope all session lookups to this specific bot so that the same customer
    // talking to multiple bots doesn't share state across them.
    const botFlowId = tokenBot._id.toString();

    // ── Agent mode bypass ────────────────────────────────────────────────────
    // If a human agent has taken over THIS bot's conversation with this customer
    // (is_agent=true, activated within the last 30 minutes), save the incoming
    // message but suppress the bot. Scoped by sender + flow_id so the same customer
    // can be in agent-mode on one bot and bot-mode on another.
    const agentCheckSession = await BotSession.findOne({
      sender,
      flow_id: botFlowId,
      is_agent: true
    }).sort({ updatedAt: -1 });

    if (agentCheckSession) {
      const agentAgeMinutes = (Date.now() - new Date(agentCheckSession.agent_since).getTime()) / 60000;
      if (agentAgeMinutes <= 30) {
        // Active agent — record user message only, return empty bot response
        agentCheckSession.process_history = agentCheckSession.process_history || [];
        const mediaType = detectMediaType(String(text));
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`[BOT-MEDIA] 📨 Incoming from customer (AGENT MODE)`);
        console.log(`[BOT-MEDIA]    sender      : ${sender}`);
        console.log(`[BOT-MEDIA]    session id  : ${agentCheckSession._id}`);
        console.log(`[BOT-MEDIA]    text/url    : ${String(text).substring(0, 120)}`);
        console.log(`[BOT-MEDIA]    detected as : ${mediaType || 'plain text (UserInput)'}`);
        agentCheckSession.process_history.push(
          mediaType
            ? { type: mediaType, url: String(text), sender: 'user', name: 'משתמש', node_id: 'user', created: new Date().toISOString() }
            : { type: 'UserInput', text: String(text), sender: 'user', name: 'משתמש', node_id: 'user', created: new Date().toISOString() }
        );
        console.log(`[BOT-MEDIA] ✅ Saved to process_history as ${mediaType || 'UserInput'}`);
        agentCheckSession.markModified('process_history');
        // If the conversation was marked as resolved, reopen it so the rep sees it again
        if (agentCheckSession.status === 'resolved') {
          agentCheckSession.status = 'waiting';
        }
        await agentCheckSession.save();
        eventBus.emit('session:update', { userId: String(user._id), phone: sender });
        console.log(`[BOT] 🙋 AGENT MODE active for sessionId=${agentCheckSession._id} phone=${phone} — bot suppressed, message recorded`);
        console.log(`${'═'.repeat(80)}\n`);
        return res.json({ StatusId: 1, StatusDescription: 'Agent mode active', sender, messages: [], agentMode: true });
      } else {
        // Agent mode expired — close this session entirely so the next request
        // is treated as a brand-new conversation (matches openers → falls back to
        // free-text default option-0). This avoids resuming the bot mid-menu in
        // a stale state after the human conversation ended.
        agentCheckSession.is_agent = false;
        agentCheckSession.agent_since = null;
        agentCheckSession.is_active = false;
        agentCheckSession.current_node_id = null;
        agentCheckSession.waiting_text_input = false;
        agentCheckSession.waiting_webservice = false;
        if (agentCheckSession.status === 'waiting' || agentCheckSession.status === 'handling') {
          agentCheckSession.status = 'bot';
        }
        await agentCheckSession.save();
        console.log(`[BOT] 🔓 Agent mode expired — closed session ${agentCheckSession._id}, will create fresh session for ${sender}`);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Find or create session — scoped by (sender + flow_id) so that the same
    // customer talking to different bots doesn't end up sharing one session,
    // and so we never overwrite customer_phone with another conversation's value.
    let session = await BotSession.findOne({
      sender,
      flow_id: botFlowId,
      is_active: true
    }).sort({ updatedAt: -1 });
   
    console.log(`[BOT] 🔎 Session search (sender="${sender}" + flow_id=${botFlowId}) → ${session ? 'FOUND' : 'NOT FOUND'}`);
    if (session) {
      console.log(`[BOT]    Session ID: ${session._id}`);
      console.log(`[BOT]    Session sender (customer): "${session.sender}"`);
      console.log(`[BOT]    Session phone (business):  "${session.customer_phone}"`);
    }

    let isNewSession = false;
    let messages = [];
    let control = null;

    // Check if session exists and is within the inactivity window (20 min).
    // After 20 minutes with no reply, treat the next message as a brand-new
    // conversation (re-match openers / fall back to free-text default).
    const SESSION_IDLE_MINUTES = 20;
    if (session) {
      const diffMinutes = (new Date() - new Date(session.updatedAt)) / (1000 * 60);
      if (diffMinutes > SESSION_IDLE_MINUTES) {
        console.log(`[BOT] session expired (${diffMinutes.toFixed(1)} min > ${SESSION_IDLE_MINUTES}) - resetting`);
        session.is_active = false;
        await session.save();
        session = null;
      } else {
        console.log(`[BOT] 📝 Existing session found - BEFORE update:`);
        console.log(`[BOT]    DB sender: ${session.sender}, DB phone: ${session.customer_phone}`);
        console.log(`[BOT]    Request sender: ${sender}, Request phone: ${phone}`);
       
        // Update sender and phone if changed
        if (session.sender !== sender) {
          console.log(`[BOT] ⚠️  Updating sender from "${session.sender}" to "${sender}"`);
          session.sender = sender;
        }
        if (session.customer_phone !== phone) {
          console.log(`[BOT] ⚠️  Updating phone from "${session.customer_phone}" to "${phone}"`);
          session.customer_phone = phone;
        }
       
        console.log(`[BOT] 📝 AFTER update:`);
        console.log(`[BOT]    DB sender: ${session.sender}, DB phone: ${session.customer_phone}`);
       
        // Merge botParams into existing session if missing (handles sessions created before this fix)
        try {
          const existingBot = await BotFlow.findById(session.flow_id);
          if (existingBot && existingBot.botParams) {
            const existingParams = session.parameters || {};
            const enriched = { ...existingParams };
            let changed = false;
            const applyBotParams = (map) => {
              if (typeof map.forEach === 'function') {
                map.forEach((val, key) => { if (enriched[key] === undefined) { enriched[key] = val; changed = true; } });
              } else if (typeof map === 'object') {
                Object.keys(map).forEach(key => { if (enriched[key] === undefined) { enriched[key] = map[key]; changed = true; } });
              }
            };
            applyBotParams(existingBot.botParams);
            if (changed) {
              session.parameters = enriched;
              session.markModified('parameters');
            }
          }
        } catch(e) {
          console.error('[BOT] Failed to enrich existing session with botParams:', e);
        }
      }
    }

    // Create new session if needed
    if (!session) {
      console.log('[BOT] creating new session');
      // Bot is already identified from the token (public_id)
      const bot = tokenBot;
     
      const flowData = await getFlowData(bot._id);

      // Find automatic_responses node
      const autoResponseNode = flowData.nodes.find(n => n.type === 'automatic_responses');
     
      if (!autoResponseNode) {
        console.error('[BOT] ❌ No automatic_responses node found for bot:', bot._id);
        return res.status(404).json({
          StatusId: 0,
          StatusDescription: 'No automatic responses configured'
        });
      }

      // Merge bot-level template params (filled in the web form) into the session
      // so that --variableName-- placeholders are resolved in all nodes.
      const botParamsObj = {};
      if (bot.botParams) {
        try {
          if (typeof bot.botParams.forEach === 'function') {
            // Mongoose Map
            bot.botParams.forEach((val, key) => { botParamsObj[key] = val; });
          } else if (typeof bot.botParams === 'object') {
            Object.assign(botParamsObj, bot.botParams);
          }
        } catch(e) {
          console.error('[BOT] Failed to parse botParams for new session:', e);
        }
      }
     
      console.log(`[BOT] 🆕 Creating NEW session with:`);
      console.log(`[BOT]    customer_phone: "${phone}"`);
      console.log(`[BOT]    sender: "${sender}"`);
     
      // If WHATSAPP_BOT_ID env var is set, inject _simulatorId so that webservice
      // nodes whose URL contains --_simulatorId-- receive a valid value (instead of null).
      const waSimulatorId = process.env.WHATSAPP_BOT_ID || null;

      session = await BotSession.create({
        user_id: user._id,
        flow_id: bot._id.toString(),
        customer_phone: phone,
        sender,
        current_node_id: autoResponseNode.id,
        is_active: true,
        parameters: { ...botParamsObj, waPhone: sender, waName: name || '', ...(waSimulatorId ? { _simulatorId: waSimulatorId } : {}) },
        process_history: []
      });
     
      console.log(`[BOT] ✅ Session created with ID: ${session._id}`);
      console.log(`[BOT]    Saved sender: "${session.sender}"`);
      console.log(`[BOT]    Saved phone: "${session.customer_phone}"`);

      // Auto-add contact — only for real WhatsApp numbers (not simulator)
      const isSimulatedPhone = !sender || sender === 'Simulated' || sender.toLowerCase() === 'simulator';
      if (!isSimulatedPhone && sender) {
        const contactSet = {};
        const contactSetOnInsert = { full_name: '', email: '' };
        // Always update whatsapp_name if a name was provided
        if (name && name.trim()) {
          contactSet.whatsapp_name = name.trim();
        } else {
          contactSetOnInsert.whatsapp_name = '';
        }
        const updateOp = Object.keys(contactSet).length > 0
          ? { $set: contactSet, $setOnInsert: contactSetOnInsert }
          : { $setOnInsert: { ...contactSetOnInsert, whatsapp_name: '' } };
        Contact.findOneAndUpdate(
          { user_id: String(user._id), phone: sender },
          updateOp,
          { upsert: true, new: true }
        ).catch(err => console.error('[BOT] Failed to upsert contact:', err.message));
      }

      isNewSession = true;
    }

    // Save user message to history (always — including first message of new/reset sessions)
    if (text) {
      const mediaType = detectMediaType(text);
      if (mediaType) {
        // Customer sent a media file via WhatsApp — store as Image/Video/Document and
        // return immediately without advancing the bot flow (caption arrives separately).
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`[BOT-MEDIA] 📨 Incoming from customer (BOT MODE)`);
        console.log(`[BOT-MEDIA]    sender      : ${sender}`);
        console.log(`[BOT-MEDIA]    session id  : ${session._id}`);
        console.log(`[BOT-MEDIA]    session status: ${session.status || 'bot'}`);
        console.log(`[BOT-MEDIA]    url         : ${text.substring(0, 120)}`);
        console.log(`[BOT-MEDIA]    detected as : ${mediaType}`);
        addToHistory(session, { type: mediaType, url: text }, 'user');
        session.markModified('process_history');
        await session.save();
        eventBus.emit('session:update', { userId: String(user._id), phone: sender });
        console.log(`[BOT-MEDIA] ✅ Saved to process_history as ${mediaType} | bot flow NOT advanced`);
        console.log(`${'═'.repeat(60)}\n`);
        return res.json({ StatusId: 1, StatusDescription: 'Media recorded', sender, messages: [] });
      }
      addToHistory(session, { type: 'UserInput', text }, 'user');
      session.markModified('process_history');
      session.last_user_input = text; // Save for webservice
    }

    // Load current flow
    const flowData = await getFlowData(session.flow_id);
    let currentNode = flowData.nodes.find(n => n.id === session.current_node_id);

    // If the node is not found in the main flow, it may be inside a fixed_process sub-flow.
    // This happens when an input_text is the last node inside a fixed_process.
    let subFlowContext = null; // { nodes, edges, returnTo }
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[SUB-FLOW] 🔎 RESUME CHECK`);
    console.log(`[SUB-FLOW]   session._id=${session._id}`);
    console.log(`[SUB-FLOW]   current_node_id in DB = ${session.current_node_id}`);
    console.log(`[SUB-FLOW]   currentNode found in mainFlow = ${currentNode ? currentNode.type + '(' + currentNode.id + ')' : '❌ NOT FOUND'}`);
    console.log(`[SUB-FLOW]   waiting_text_input = ${session.waiting_text_input}`);
    console.log(`[SUB-FLOW]   waiting_webservice = ${session.waiting_webservice}`);
    console.log(`[SUB-FLOW]   execution_stack (${(session.execution_stack || []).length} entries) = ${JSON.stringify(session.execution_stack || [])}`);
    // Load sub-flow context when the execution stack is non-empty.
    // This covers both input_text (waiting_text_input=true) AND output_menu
    // (waiting_text_input=false) nodes that live inside a fixed_process.
    if ((session.execution_stack || []).length > 0) {
      const stack = session.execution_stack;
      const lastEntry = stack[stack.length - 1];
      console.log(`[SUB-FLOW]   stack non-empty → looking for lastEntry.nodeId=${lastEntry.nodeId} in main flow`);
      // lastEntry.nodeId is the fixed_process node in the parent (main) flow
      const fpNode = flowData.nodes.find(n => n.id === lastEntry.nodeId);
      console.log(`[SUB-FLOW]   fpNode in main flow: ${fpNode ? fpNode.type + '(' + fpNode.id + ') processId=' + fpNode.data?.processId : '❌ NOT FOUND — cannot load sub-flow'}`);
      if (fpNode && fpNode.data && fpNode.data.processId) {
        console.log(`[SUB-FLOW]   loading sub-flow: getFlowData(flow_id=${session.flow_id}, processId=${fpNode.data.processId})`);
        const subFlow = await getFlowData(session.flow_id, fpNode.data.processId);
        console.log(`[SUB-FLOW]   sub-flow loaded: ${subFlow.nodes.length} nodes | types: ${subFlow.nodes.map(n => n.type + '(' + n.id + ')').join(', ')}`);
        console.log(`[SUB-FLOW]   sub-flow edges: ${subFlow.edges.map(e => e.source + '->' + e.target + (e.sourceHandle ? '[' + e.sourceHandle + ']' : '')).join(', ')}`);
        console.log(`[SUB-FLOW]   looking for session.current_node_id=${session.current_node_id} inside sub-flow`);
        const nodeInSub = subFlow.nodes.find(n => n.id === session.current_node_id);
        console.log(`[SUB-FLOW]   nodeInSub: ${nodeInSub ? '✅ ' + nodeInSub.type + '(' + nodeInSub.id + ')' : '❌ NOT FOUND in sub-flow nodes'}`);
        if (nodeInSub) {
          currentNode = nodeInSub;
          subFlowContext = { nodes: subFlow.nodes, edges: subFlow.edges, returnTo: lastEntry.returnTo };
          console.log(`[SUB-FLOW]   ✅ subFlowContext SET | returnTo=${lastEntry.returnTo}`);
        } else {
          console.warn(`[SUB-FLOW]   ⚠️ node ${session.current_node_id} not found in sub-flow — will use main flow node (may be wrong)`);
        }
      } else if (!fpNode) {
        console.warn(`[SUB-FLOW]   ⚠️ fpNode not found in main flow for nodeId=${lastEntry.nodeId} — execution_stack may be stale`);
      }
    } else {
      console.log(`[SUB-FLOW]   execution_stack empty → no sub-flow resume needed`);
      if (!currentNode) {
        console.error(`[SUB-FLOW]   ❌ currentNode NOT FOUND and no stack — session may be in bad state`);
      }
    }
    console.log(`${'─'.repeat(60)}\n`);

    if (!currentNode) {
      console.error('[BOT] ❌ Current node not found:', session.current_node_id);
      return res.status(404).json({
        StatusId: 0,
        StatusDescription: 'Current node not found'
      });
    }
    console.log(`[BOT] node=${currentNode.type} (${currentNode.id}) | newSession=${isNewSession} | waitText=${session.waiting_text_input} | waitWS=${session.waiting_webservice}`);

    const params = session.parameters || {};

    // ── Flow interrupt (mirrors Simulator flow-interrupt) ──────────────────────
    // If we are mid-flow (not a new session, not already at automatic_responses,
    // ── Flow interrupt ────────────────────────────────────────────────────────
    // Mirrors the simulator: any message that matches an option from a previously
    // shown menu (output_menu) or automatic_responses jumps back to that node,
    // even if the flow has already advanced or ended.
    // Fired whenever we are NOT explicitly waiting for free-text input.
    // Do NOT interrupt when inside a sub-flow (execution_stack non-empty) — the
    // sub-flow must handle the response via its own edges, not the main-flow interrupt.
    if (!isNewSession && text && !session.waiting_text_input && (session.execution_stack || []).length === 0) {

      // 1. Check all output_menu nodes in the flow for a match
      // Always check the current node first to avoid matching an identically-named
      // option in a different menu branch (e.g. "רשימה מלאה" appearing in multiple menus).
      const interruptMenuNodes = flowData.nodes.filter(n => n.type === 'output_menu');
      const interruptMenuNodesSorted = [
        ...interruptMenuNodes.filter(n => n.id === session.current_node_id),
        ...interruptMenuNodes.filter(n => n.id !== session.current_node_id)
      ];
      for (const menuNode of interruptMenuNodesSorted) {
        const menuOptions = (menuNode.data.options || []).filter(o => o !== 'default');
        const matchedMenuIdx = menuOptions.findIndex(
          opt => String(opt).trim().toLowerCase() === text.trim().toLowerCase()
        );

        // Determine which edge to follow: matched option or default
        const isCurrentMenuNode = menuNode.id === session.current_node_id;
        const useDefault = matchedMenuIdx === -1 && isCurrentMenuNode;
        const edgeHandle = matchedMenuIdx !== -1
          ? `option-${matchedMenuIdx}`
          : (useDefault ? 'option-default' : null);

        if (edgeHandle) {
          const interruptNextId = findNextNode(menuNode.id, flowData.edges, edgeHandle);
          if (interruptNextId) {
            if (matchedMenuIdx !== -1) {
              console.log(`[BOT] ⚡ interrupt: output_menu "${menuNode.id}" option ${matchedMenuIdx}`);
            } else {
              console.log(`[BOT] ⚡ interrupt: output_menu "${menuNode.id}" no match → option-default`);
            }
            session.execution_stack    = [];
            session.markModified('execution_stack');
            session.waiting_webservice = false;
            session.waiting_text_input = false;

            // Save the newly selected option to session parameters
            {
              const interruptParams = session.parameters || {};
              if (menuNode.data.variableName && matchedMenuIdx !== -1) {
                interruptParams[menuNode.data.variableName] = text.trim();
              }
              interruptParams['waOpen'] = text.trim();
              session.parameters = interruptParams;
              session.markModified('parameters');
            }

            messages = await walkChain(interruptNextId, flowData.nodes, flowData.edges, session, session.flow_id, req);
            await session.save();
            const waPushedInterrupt1 = await pushMessagesToWhatsApp(sender, messages, user, tokenBot);
            return res.json({ StatusId: 1, StatusDescription: 'Success', sender, messages: waPushedInterrupt1 ? [] : messages, control: null, ...(waPushedInterrupt1 && { wa_pushed: true }) });
          }
        }
      }

      // 2. Check automatic_responses options (only when not already at automatic_responses)
      if (currentNode.type !== 'automatic_responses') {
        const autoNode = flowData.nodes.find(n => n.type === 'automatic_responses');
        if (autoNode) {
          const arOptions   = autoNode.data.options         || [];
          const arOperators = autoNode.data.optionOperators || arOptions.map(() => 'eq');

          let interruptIdx = -1;
          for (let i = 1; i < arOptions.length; i++) {
            if (evaluateCondition(arOperators[i], text, arOptions[i])) {
              interruptIdx = i;
              break;
            }
          }

          if (interruptIdx !== -1) {
            console.log(`[BOT] ⚡ interrupt: automatic_responses option ${interruptIdx}`);
            session.execution_stack    = [];
            session.markModified('execution_stack');
            session.waiting_webservice = false;
            session.waiting_text_input = false;
            {
              const interruptParams = session.parameters || {};
              interruptParams['waOpen'] = text.trim();
              session.parameters = interruptParams;
              session.markModified('parameters');
            }

            const interruptNextId = findNextNode(autoNode.id, flowData.edges, `option-${interruptIdx}`);
            if (interruptNextId) {
              messages = await walkChain(interruptNextId, flowData.nodes, flowData.edges, session, session.flow_id, req);
              await session.save();
              const waPushedInterrupt2 = await pushMessagesToWhatsApp(sender, messages, user, tokenBot);
              return res.json({ StatusId: 1, StatusDescription: 'Success', sender, messages: waPushedInterrupt2 ? [] : messages, control: null, ...(waPushedInterrupt2 && { wa_pushed: true }) });
            }
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Global auto-removal check for users "stuck" mid-flow (input_text / output_menu / action_web_service).
    // In automatic_responses we let opener options win first, so the check is run inside that branch instead.
    if (currentNode && currentNode.type !== 'automatic_responses') {
      const removalResult = await performAutoRemoval(user, sender, phone, text, name);
      if (removalResult) {
        try {
          session.is_active = false;
          session.current_node_id = null;
          session.waiting_text_input = false;
          session.waiting_webservice = false;
          await session.save();
        } catch (sessSaveErr) {
          console.error('[BOT] failed to close current session after removal:', sessSaveErr.message);
        }
        const waPushed = removalResult.outMessages.length > 0
          ? await pushMessagesToWhatsApp(sender, removalResult.outMessages, user, tokenBot)
          : false;
        return res.json({
          StatusId: 1,
          StatusDescription: 'Removed by keyword',
          sender,
          messages: waPushed ? [] : removalResult.outMessages,
          control: null,
          removed: true,
          matchedKeyword: removalResult.matched,
          ...(waPushed && { wa_pushed: true })
        });
      }
    }

    // Handle based on current node type
    if (isNewSession && currentNode.type === 'automatic_responses') {
      // Match user message to options
      const options = currentNode.data.options || [];
      const operators = currentNode.data.optionOperators || options.map(() => 'eq');
     
      console.log(`[BOT] 🆕 NEW SESSION - matching "${text}" against options:`, options);

      let matchedIdx = -1;
      for (let i = 1; i < options.length; i++) {
        const matches = evaluateCondition(operators[i], text, options[i]);
        console.log(`[BOT]   option[${i}]="${options[i]}" op=${operators[i]} → ${matches}`);
        if (matches) {
          matchedIdx = i;
          break;
        }
      }

      // If no opener option matched, try removal keywords before falling back
      // to the free-text default (option-0).
      if (matchedIdx === -1) {
        const removalResult = await performAutoRemoval(user, sender, phone, text, name);
        if (removalResult) {
          try {
            session.is_active = false;
            session.current_node_id = null;
            session.waiting_text_input = false;
            session.waiting_webservice = false;
            await session.save();
          } catch (sessSaveErr) {
            console.error('[BOT] failed to close current session after removal:', sessSaveErr.message);
          }
          const waPushed = removalResult.outMessages.length > 0
            ? await pushMessagesToWhatsApp(sender, removalResult.outMessages, user, tokenBot)
            : false;
          return res.json({
            StatusId: 1,
            StatusDescription: 'Removed by keyword',
            sender,
            messages: waPushed ? [] : removalResult.outMessages,
            control: null,
            removed: true,
            matchedKeyword: removalResult.matched,
            ...(waPushed && { wa_pushed: true })
          });
        }
      }

      // Default to first option (כניסה) if no match
      const finalIdx = matchedIdx !== -1 ? matchedIdx : 0;
      params['waOpen'] = text.trim();
      session.parameters = params;
      session.markModified('parameters');
      const nextNodeId = findNextNode(currentNode.id, flowData.edges, `option-${finalIdx}`);
      console.log(`[BOT] 🎯 Matched option-${finalIdx} → nextNodeId=${nextNodeId}`);
      if (nextNodeId) {
        messages = await walkChain(nextNodeId, flowData.nodes, flowData.edges, session, session.flow_id, req);
        console.log(`[BOT] 📦 walkChain returned ${messages.length} messages:`, messages.map(m => `[${m.type}]${m.text ? ' "'+m.text.substring(0,40)+'"' : ''}`)  );
      }
    } else if (session.waiting_webservice && currentNode.type === 'action_web_service') {
      // User is responding to a webservice InputText request
     
      // Save user input
      session.last_user_input = text;
     
      // Re-call the webservice with the user input
      messages = await walkChain(currentNode.id, flowData.nodes, flowData.edges, session, session.flow_id, req);
    } else if (currentNode.type === 'input_text' || currentNode.type === 'input_date' || currentNode.type === 'input_file') {
      console.log(`[SUB-FLOW] 📝 input_text/date/file branch | node=${currentNode.id} | subFlowContext=${subFlowContext ? 'YES (returnTo=' + subFlowContext.returnTo + ')' : 'NO'} | varName=${currentNode.data.variableName || '(none)'}`);
      // Validate input type if configured on input_text nodes
      const validationType = currentNode.data.validationType;
      if (currentNode.type === 'input_text' && validationType && !validateInput(validationType, text)) {
        // Invalid input — notify user and re-prompt without advancing
        messages.push({ type: 'Text', text: 'הערך שהוזן אינו חוקי, אנא הזן ערך מתאים.', created: new Date().toISOString() });
        if (currentNode.data.label) {
          messages.push({ type: 'Text', text: replaceParameters(currentNode.data.label, params), created: new Date().toISOString() });
        }
        session.waiting_text_input = true;
        // current_node_id stays unchanged — fall through to session.save()
      } else if (currentNode.type === 'input_date' && !validateDateTimeInput(currentNode.data.dateTimeMode || 'date', text)) {
        const dtMode = currentNode.data.dateTimeMode || 'date';
        const formatHint = dtMode === 'time'     ? 'HH:MM (לדוגמה: 14:30)' :
                           dtMode === 'datetime' ? 'DD/MM/YYYY HH:MM (לדוגמה: 25/06/2025 14:30)' :
                                                   'DD/MM/YYYY (לדוגמה: 25/06/2025)';
        messages.push({ type: 'Text', text: `הפורמט שהוזן אינו תקין. אנא הזן בפורמט ${formatHint}`, created: new Date().toISOString() });
        if (currentNode.data.label) {
          messages.push({ type: 'Text', text: replaceParameters(currentNode.data.label, params), created: new Date().toISOString() });
        }
        session.waiting_text_input = true;
        // current_node_id stays unchanged — fall through to session.save()
      } else {
      // We received the answer — no longer waiting
      session.waiting_text_input = false;

      // Save input to parameters
      const varName = currentNode.data.variableName;
      if (varName) {
        params[varName] = text;
      }
      params['waOpen'] = text;
      session.parameters = params;
      session.markModified('parameters');

      // Save to contact custom_field_values if flagged
      if (currentNode.data.saveToContact) {
        // contactFieldKey (field _id) takes precedence; fall back to varName for legacy flows
        const contactKey = currentNode.data.contactFieldKey || varName;
        // session.sender is the customer's phone; session.customer_phone is the bot's phone
        const contactPhone = session.sender || session.customer_phone;
        if (contactKey && contactPhone) {
          Contact.findOneAndUpdate(
            { user_id: session.user_id, phone: contactPhone },
            { $set: { [`custom_field_values.${contactKey}`]: text } },
            { upsert: true, new: true }
          ).catch(err => console.error('[BOT] Failed to save contact field:', err));
        }
      }

      // Use sub-flow edges if the node lives inside a fixed_process
      const activeNodes = subFlowContext ? subFlowContext.nodes : flowData.nodes;
      const activeEdges = subFlowContext ? subFlowContext.edges : flowData.edges;
      console.log(`[SUB-FLOW]   activeEdges source: ${subFlowContext ? 'sub-flow' : 'main flow'} | ${activeEdges.length} edges`);

      const nextNodeId = findNextNode(currentNode.id, activeEdges);
      console.log(`[SUB-FLOW]   nextNodeId after input = ${nextNodeId || '(none — last node in flow)'}`);
      if (nextNodeId) {
        // There is a next node inside the same (sub-)flow — continue normally
        console.log(`[SUB-FLOW]   → continuing sub-flow from ${nextNodeId}`);
        messages = await walkChain(nextNodeId, activeNodes, activeEdges, session, session.flow_id, req);
      } else if (subFlowContext) {
        // Last node in sub-flow — pop execution stack and continue in parent flow
        console.log(`[SUB-FLOW]   last node in sub-flow — popping stack and returning to parent`);
        const newStack = [...session.execution_stack];
        newStack.pop();
        session.execution_stack = newStack;
        session.markModified('execution_stack');
        if (subFlowContext.returnTo) {
          console.log(`[SUB-FLOW]   🔁 Sub-flow input done, returning to parent node: ${subFlowContext.returnTo}`);
          messages = await walkChain(subFlowContext.returnTo, flowData.nodes, flowData.edges, session, session.flow_id, req);
        } else {
          // No return node — go back to main menu
          const autoNode = flowData.nodes.find(n => n.type === 'automatic_responses');
          if (autoNode) {
            session.current_node_id   = autoNode.id;
            session.waiting_webservice = false;
            session.execution_stack   = [];
            session.markModified('execution_stack');
          } else {
            session.is_active       = false;
            session.current_node_id = null;
          }
        }
      } else {
        // Last node in main flow — return to main menu or close session
        const autoNode = flowData.nodes.find(n => n.type === 'automatic_responses');
        if (autoNode) {
          session.current_node_id   = autoNode.id;
          session.waiting_webservice = false;
          session.execution_stack   = [];
          session.markModified('execution_stack');
        } else {
          session.is_active         = false;
          session.current_node_id   = null;
        }
      }
      }
    } else if (currentNode.type === 'output_menu') {
      // Handle menu selection — we are mid-session inside an active menu.
      // Behaviour:
      //   1. Exact match on an option → follow that option's edge
      //   2. No match but `option-default` edge exists → follow default
      //   3. Otherwise → short error message (DO NOT restart the flow,
      //      the user is intentionally inside this menu)
      // Use sub-flow edges/nodes when the menu is inside a fixed_process sub-flow.
      const menuActiveNodes = subFlowContext ? subFlowContext.nodes : flowData.nodes;
      const menuActiveEdges = subFlowContext ? subFlowContext.edges : flowData.edges;
      console.log(`[SUB-FLOW] 📋 output_menu branch | node=${currentNode.id} | subFlowContext=${subFlowContext ? 'YES (returnTo=' + subFlowContext.returnTo + ')' : 'NO'}`);
      console.log(`[SUB-FLOW]   menuActiveEdges source: ${subFlowContext ? 'sub-flow' : 'main flow'} | ${menuActiveEdges.length} edges`);
      console.log(`[SUB-FLOW]   menu options: ${JSON.stringify(currentNode.data.options || [])}`);
      console.log(`[SUB-FLOW]   user sent: "${text.trim()}"`);

      const selectedValue = text.trim();
      const options = currentNode.data.options || [];
      const selectedIdx = options.findIndex(opt => opt.trim() === selectedValue);
      console.log(`[SUB-FLOW]   selectedIdx=${selectedIdx} | edgesFromThisNode: ${menuActiveEdges.filter(e => e.source === currentNode.id).map(e => e.sourceHandle + '->' + e.target).join(', ')}`);

      if (selectedIdx !== -1) {
        if (currentNode.data.variableName) {
          params[currentNode.data.variableName] = selectedValue;
        }
        params['waOpen'] = selectedValue;
        session.parameters = params;
        session.markModified('parameters');

        const nextNodeId = findNextNode(currentNode.id, menuActiveEdges, `option-${selectedIdx}`);
        console.log(`[SUB-FLOW]   matched option-${selectedIdx} → nextNodeId=${nextNodeId || '(none)'}`);
        if (nextNodeId) {
          messages = await walkChain(nextNodeId, menuActiveNodes, menuActiveEdges, session, session.flow_id, req);
          console.log(`[SUB-FLOW]   walkChain after menu: msgs=${messages.length} | waiting_text=${session.waiting_text_input} | waiting_ws=${session.waiting_webservice}`);
          // If sub-flow finished (not waiting), pop stack and continue in parent
          if (subFlowContext && !session.waiting_text_input && !session.waiting_webservice) {
            const newStack = [...session.execution_stack];
            newStack.pop();
            session.execution_stack = newStack;
            session.markModified('execution_stack');
            if (subFlowContext.returnTo) {
              console.log(`[SUB-FLOW]   🔁 Sub-flow menu done, returning to parent node: ${subFlowContext.returnTo}`);
              const parentMsgs = await walkChain(subFlowContext.returnTo, flowData.nodes, flowData.edges, session, session.flow_id, req);
              messages.push(...parentMsgs);
            }
          } else if (subFlowContext) {
            console.log(`[SUB-FLOW]   ⏸ sub-flow menu still waiting — not returning to parent yet`);
          }
        } else {
          console.warn(`[SUB-FLOW]   ⚠️ no edge found for option-${selectedIdx} from node ${currentNode.id}`);
        }
      } else {
        const defaultNextId = findNextNode(currentNode.id, menuActiveEdges, 'option-default');
        console.log(`[SUB-FLOW]   no match for "${selectedValue}" → defaultNextId=${defaultNextId || '(none)'}`);
        if (defaultNextId) {
          console.log(`[SUB-FLOW]   routing to option-default → ${defaultNextId}`);
          params['waOpen'] = selectedValue;
          session.parameters = params;
          session.markModified('parameters');
          messages = await walkChain(defaultNextId, menuActiveNodes, menuActiveEdges, session, session.flow_id, req);
          console.log(`[SUB-FLOW]   walkChain after default: msgs=${messages.length} | waiting_text=${session.waiting_text_input} | waiting_ws=${session.waiting_webservice}`);
          // If sub-flow finished (not waiting), pop stack and continue in parent
          if (subFlowContext && !session.waiting_text_input && !session.waiting_webservice) {
            const newStack = [...session.execution_stack];
            newStack.pop();
            session.execution_stack = newStack;
            session.markModified('execution_stack');
            if (subFlowContext.returnTo) {
              console.log(`[SUB-FLOW]   🔁 Sub-flow menu default done, returning to parent node: ${subFlowContext.returnTo}`);
              const parentMsgs = await walkChain(subFlowContext.returnTo, flowData.nodes, flowData.edges, session, session.flow_id, req);
              messages.push(...parentMsgs);
            }
          } else if (subFlowContext) {
            console.log(`[SUB-FLOW]   ⏸ sub-flow menu default still waiting — not returning to parent yet`);
          }
        } else {
          messages.push({
            type: 'Text',
            text: '⚠️ לא נמצאה אפשרות תואמת לתשובה שלך.',
            created: new Date().toISOString()
          });
        }
      }
    } else if (currentNode.type === 'automatic_responses' && !isNewSession) {
      // Re-match on automatic responses
      const options = currentNode.data.options || [];
      const operators = currentNode.data.optionOperators || options.map(() => 'eq');
     
      let matchedIdx = -1;
      for (let i = 1; i < options.length; i++) {
        const matches = evaluateCondition(operators[i], text, options[i]);
        if (matches) {
          matchedIdx = i;
          break;
        }
      }

      // If no opener option matched, try removal keywords before falling back
      // to the free-text default (option-0).
      if (matchedIdx === -1) {
        const removalResult = await performAutoRemoval(user, sender, phone, text, name);
        if (removalResult) {
          try {
            session.is_active = false;
            session.current_node_id = null;
            session.waiting_text_input = false;
            session.waiting_webservice = false;
            await session.save();
          } catch (sessSaveErr) {
            console.error('[BOT] failed to close current session after removal:', sessSaveErr.message);
          }
          const waPushed = removalResult.outMessages.length > 0
            ? await pushMessagesToWhatsApp(sender, removalResult.outMessages, user, tokenBot)
            : false;
          return res.json({
            StatusId: 1,
            StatusDescription: 'Removed by keyword',
            sender,
            messages: waPushed ? [] : removalResult.outMessages,
            control: null,
            removed: true,
            matchedKeyword: removalResult.matched,
            ...(waPushed && { wa_pushed: true })
          });
        }
      }

      params['waOpen'] = text.trim();
      session.parameters = params;
      session.markModified('parameters');
      const finalIdx = matchedIdx !== -1 ? matchedIdx : 0;
      const nextNodeId = findNextNode(currentNode.id, flowData.edges, `option-${finalIdx}`);
      if (nextNodeId) {
        messages = await walkChain(nextNodeId, flowData.nodes, flowData.edges, session, session.flow_id, req);
      }
    }

    // Save session
    console.log(`[BOT] 💾 Saving session - sender: ${session.sender}, phone: ${session.customer_phone}`);
    await session.save();
    eventBus.emit('session:update', { userId: String(user._id), phone: sender });
    console.log(`[eventBus] emitted session:update userId=${String(user._id)} phone=${sender}`);

    // Build control object if needed
    // Reload the waiting node from the updated session.current_node_id (may have changed inside walkChain)
    const waitingNode = flowData.nodes.find(n => n.id === session.current_node_id);
    if (session.waiting_text_input && waitingNode?.data?.variableName) {
      control = {
        type: 'InputText',
        name: waitingNode.data.variableName
      };
    }

    console.log(`[BOT] → ${messages.length} messages | node=${session.current_node_id} | active=${session.is_active}`);
    console.log(`[BOT] 📤 RESPONSE - sender: ${sender}, session.sender: ${session.sender}, session.customer_phone: ${session.customer_phone}`);
    console.log(`[BOT] 📋 Messages summary:`, messages.map(m => `[${m.type}]${m.text ? ' "'+m.text.substring(0,60)+'"' : ''}`));
    console.log(`[BOT] 🌐 WHATSAPP_ENDPOINT=${process.env.WHATSAPP_ENDPOINT || '(not set)'}`);

    // Proactively push messages to WhatsApp via dialog360 /send endpoint.
    // Uses the bot's endpoint when available, falling back to user credentials or env vars.
    // When push succeeds, return an empty messages array so dialog360 does NOT double-send.
    const waPushed = await pushMessagesToWhatsApp(sender, messages, user, tokenBot);
    console.log(`[BOT] 🚀 pushMessagesToWhatsApp → waPushed=${waPushed}`);

    const elapsedMs = Date.now() - reqStartedAt;
    console.log(`[BOT] ✅ DONE | phone=${phone} | sender=${sender} | sessionId=${session._id} | msgs=${messages.length} | waPushed=${waPushed} | elapsed=${elapsedMs}ms`);
    console.log(`${'═'.repeat(80)}\n`);

    return res.json({
      StatusId: 1,
      StatusDescription: 'Success',
      sender,
      messages: waPushed ? [] : messages,
      control,
      ...(waPushed && { wa_pushed: true }),
    });

  } catch (error) {
    const elapsedMs = Date.now() - reqStartedAt;
    console.error(`[BOT] ❌ ERROR after ${elapsedMs}ms:`, error);
    console.log(`${'═'.repeat(80)}\n`);
    return res.status(500).json({
      StatusId: 0,
      StatusDescription: error.message
    });
  }
};

/**
 * GET/POST /api/360/:wa_id/send
 *
 * Steps performed:
 *   1. Find bot by wa_id (endpoint match) → resolve user_id
 *   2. Normalise phone
 *   3. Flatten params[] + extract header media URL
 *   4. Fetch template definition → substitute {{1}}…{{N}} with real values
 *   5. Forward request as-is to https://wa.message.co.il/api/360/:wa_id/send
 *   6. Ensure a Contact record exists for this phone (create if missing)
 *   7. Append history entry to existing active BotSession or create a new one
 */
export const sendTemplateExternal = async (req, res) => {
  try {
    const { wa_id } = req.params;
    const isGet = req.method === 'GET';
    const source = isGet ? req.query : (req.body || {});
    const { phone, template, token } = source;

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`[360-TEMPLATE] 🚀 START | ${req.method} | wa_id=${wa_id}`);
    console.log(`[360-TEMPLATE]    phone=${phone} | template=${template} | token=${token ? String(token).substring(0, 8) + '…' : '(missing)'}`);

    if (!phone || !template || !token) {
      console.log(`[360-TEMPLATE] ❌ Missing required params (phone / template / token)`);
      return res.status(400).json({ success: false, error: 'phone, template and token are required' });
    }

    // ── Step 1: Find bot by wa_id ────────────────────────────────────────────
    console.log(`[360-TEMPLATE] 🔍 STEP 1 — Looking up bot for wa_id=${wa_id}`);
    const bot = await BotFlow.findOne({
      $or: [{ endpoint: wa_id }, { endpoint: `dialog360/${wa_id}` }],
    }).select('_id user_id endpoint name').lean();

    let userId = null;
    if (bot) {
      userId = bot.user_id?.toString();
      console.log(`[360-TEMPLATE]    ✅ Bot found: "${bot.name}" (${bot._id}) | user_id=${userId}`);
    } else {
      const userByBotId = await User.findOne({ dialog360_bot_id: wa_id }).lean();
      if (userByBotId) {
        userId = userByBotId._id.toString();
        console.log(`[360-TEMPLATE]    ✅ User found by dialog360_bot_id | email=${userByBotId.email} | userId=${userId}`);
      } else {
        console.log(`[360-TEMPLATE]    ⚠️ No bot or user found for wa_id=${wa_id} — will proxy but skip history`);
      }
    }

    // ── Step 2: Normalise phone ──────────────────────────────────────────────
    console.log(`[360-TEMPLATE] 📞 STEP 2 — Normalising phone: ${phone}`);
    let normalizedPhone = String(phone).replace(/[^0-9]/g, '');
    normalizedPhone = normalizedPhone.replace(/^972972/, '972');
    if (!normalizedPhone.startsWith('972')) {
      normalizedPhone = normalizedPhone.replace(/^0+/, '');
      normalizedPhone = '972' + normalizedPhone;
    }
    console.log(`[360-TEMPLATE]    → ${normalizedPhone}`);

    // ── Step 3: Flatten params[] and extract header media ────────────────────
    console.log(`[360-TEMPLATE] 🔢 STEP 3 — Parsing params and header`);
    const rawParams = source.params || {};
    let paramsArray;
    if (Array.isArray(rawParams)) {
      paramsArray = rawParams.map(String);
    } else if (rawParams && typeof rawParams === 'object') {
      paramsArray = Object.keys(rawParams)
        .sort((a, b) => Number(a) - Number(b))
        .map(k => String(rawParams[k]));
    } else {
      paramsArray = [];
    }
    console.log(`[360-TEMPLATE]    params (${paramsArray.length}): ${JSON.stringify(paramsArray)}`);

    // Walk any nested structure to find media URL + type inside header[...]
    let mediaUrl = null;
    let mediaType = 'image';
    const rawHeader = source.header;
    if (rawHeader) {
      const walkNode = (node) => {
        if (!node) return;
        if (typeof node === 'string' && /^https?:\/\//i.test(node)) {
          mediaUrl = mediaUrl || node;
        } else if (typeof node === 'object') {
          if (node.link && typeof node.link === 'string') mediaUrl = mediaUrl || node.link;
          for (const v of Object.values(node)) walkNode(v);
        }
      };
      walkNode(rawHeader);
      const typeStrings = [];
      const collectStr = (node) => {
        if (typeof node === 'string') typeStrings.push(node.toLowerCase());
        else if (node && typeof node === 'object') Object.values(node).forEach(collectStr);
      };
      collectStr(rawHeader);
      const found = ['image', 'video', 'document'].find(t => typeStrings.includes(t));
      if (found) mediaType = found;
    }
    console.log(`[360-TEMPLATE]    header: mediaUrl=${mediaUrl || '(none)'} | mediaType=${mediaType}`);

    // ── Step 4: Fetch template definition → resolve body text ────────────────
    console.log(`[360-TEMPLATE] 📋 STEP 4 — Fetching template definition for "${template}"`);
    let displayText = paramsArray.length > 0
      ? `[${template}]: ${paramsArray.join(' | ')}`
      : `[${template}]`;

    try {
      const apiToken = crypto.createHash('sha1').update(wa_id + 'moomoo').digest('hex');
      const templatesUrl = `https://app.chatgo.live/api/dialog360/${wa_id}/message_templates`;
      console.log(`[360-TEMPLATE]    GET ${templatesUrl}`);
      const tplRes = await fetch(templatesUrl, { headers: { token: apiToken } });
      console.log(`[360-TEMPLATE]    templates API status=${tplRes.status}`);

      if (tplRes.ok) {
        const tplData = await tplRes.json();
        const allTemplates = tplData?.data || tplData?.waba_templates || [];
        console.log(`[360-TEMPLATE]    total templates returned: ${allTemplates.length}`);
        const tplDef = allTemplates.find(t => t.name === template || t.elementName === template);

        if (tplDef) {
          console.log(`[360-TEMPLATE]    ✅ Template matched: "${tplDef.name}" | status=${tplDef.status} | components: ${(tplDef.components || []).map(c => c.type).join(', ')}`);
          const components = tplDef.components || [];
          const bodyComp = components.find(c => c.type === 'BODY');
          if (bodyComp?.text) {
            let bodyText = bodyComp.text;
            paramsArray.forEach((val, idx) => {
              bodyText = bodyText.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
            });
            const footerComp = components.find(c => c.type === 'FOOTER');
            if (footerComp?.text) bodyText += `\n\n― ${footerComp.text}`;
            displayText = bodyText;
            console.log(`[360-TEMPLATE]    📝 Resolved text: "${displayText.substring(0, 120)}${displayText.length > 120 ? '…' : ''}"`);
          }
          // Fallback header URL from template example if not supplied in the request
          if (!mediaUrl) {
            const headerComp = components.find(c => c.type === 'HEADER');
            if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
              const ex = headerComp.example || {};
              const exLink = (Array.isArray(ex.header_handle) ? ex.header_handle[0] : ex.header_handle)
                          || (Array.isArray(ex.header_url) ? ex.header_url[0] : ex.header_url) || '';
              if (exLink) {
                mediaUrl = exLink;
                mediaType = headerComp.format.toLowerCase();
                console.log(`[360-TEMPLATE]    📎 Header URL from template example: ${mediaUrl}`);
              }
            }
          }
        } else {
          console.log(`[360-TEMPLATE]    ⚠️ Template "${template}" not found in list — using fallback display text`);
        }
      } else {
        console.warn(`[360-TEMPLATE]    ⚠️ templates API returned ${tplRes.status} — using fallback display text`);
      }
    } catch (tplErr) {
      console.warn(`[360-TEMPLATE]    ⚠️ Template fetch error: ${tplErr.message} — using fallback display text`);
    }

    // ── Step 5: Forward to wa.message.co.il ─────────────────────────────────
    console.log(`[360-TEMPLATE] 📡 STEP 5 — Forwarding to wa.message.co.il`);
    let waSent = false;
    let waError = null;
    let waResponseBody = null;
    try {
      let waRes;
      if (isGet) {
        const rawQuery = req.originalUrl.split('?')[1] || '';
        const waUrl = `https://wa.message.co.il/api/360/${wa_id}/send?${rawQuery}`;
        console.log(`[360-TEMPLATE]    GET → ${waUrl}`);
        waRes = await fetch(waUrl, { method: 'GET' });
      } else {
        const waUrl = `https://wa.message.co.il/api/360/${wa_id}/send`;
        console.log(`[360-TEMPLATE]    POST → ${waUrl} | body=${JSON.stringify(source).substring(0, 200)}`);
        waRes = await fetch(waUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Accept: 'application/json',
            token: String(token),
          },
          body: JSON.stringify(source),
        });
      }
      const waResText = await waRes.text();
      try { waResponseBody = JSON.parse(waResText); } catch { waResponseBody = waResText; }
      if (waRes.ok) {
        waSent = true;
        console.log(`[360-TEMPLATE]    ✅ WA OK | status=${waRes.status}`);
      } else {
        waError = `HTTP ${waRes.status}: ${waResText}`;
        console.error(`[360-TEMPLATE]    ❌ WA failed | ${waError}`);
      }
    } catch (waErr) {
      waError = waErr.message;
      console.error(`[360-TEMPLATE]    ❌ WA exception: ${waErr.message}`);
    }

    // ── Step 6: Ensure Contact record exists ─────────────────────────────────
    if (userId) {
      console.log(`[360-TEMPLATE] 👤 STEP 6 — Ensuring contact for phone=${normalizedPhone} user=${userId}`);
      try {
        const existing = await Contact.findOne({ user_id: userId, phone: normalizedPhone }).lean();
        if (existing) {
          console.log(`[360-TEMPLATE]    ✅ Contact already exists (_id=${existing._id})`);
        } else {
          const created = await Contact.create({ user_id: userId, phone: normalizedPhone, full_name: '', whatsapp_name: '', email: '', custom_field_values: {} });
          console.log(`[360-TEMPLATE]    ✅ Contact created (_id=${created._id})`);
        }
      } catch (contactErr) {
        console.warn(`[360-TEMPLATE]    ⚠️ Contact upsert error: ${contactErr.message}`);
      } 
    } else {
      console.log(`[360-TEMPLATE] ⏭ STEP 6 — Skipping contact (no userId)`);
    }

    // ── Step 7: Save history to BotSession ───────────────────────────────────
    const now = new Date();
    const historyEntry = {
      type: mediaUrl ? (mediaType === 'video' ? 'Video' : mediaType === 'document' ? 'Document' : 'Image') : 'Text',
      text: displayText,
      ...(mediaUrl ? { url: mediaUrl } : {}),
      sender: 'agent',
      name: 'הודעה יוצאת',
      node_id: 'outgoing_template',
      template_name: String(template),
      template_params: paramsArray,
      wa_sent: waSent,
      created: now.toISOString(),
    };

    if (userId) {
      console.log(`[360-TEMPLATE] 💾 STEP 7 — Saving to BotSession | type=${historyEntry.type} | mediaUrl=${mediaUrl || '(none)'}`);
      const collection = mongoose.connection.collection('BotSession');
      const existingSession = await collection.findOne(
        {
          $or: [{ sender: normalizedPhone }, { customer_phone: normalizedPhone }],
          user_id: userId,
          is_active: { $ne: false },
        },
        { sort: { created_at: -1 } }
      );

      if (existingSession) {
        await collection.updateOne(
          { _id: existingSession._id },
          { $push: { process_history: historyEntry } }
        );
        console.log(`[360-TEMPLATE]    ✅ Appended to existing session=${existingSession._id}`);
      } else {
        const result = await collection.insertOne({
          sender: normalizedPhone,
          customer_phone: normalizedPhone,
          user_id: userId,
          flow_id: bot?._id?.toString() || null,
          is_agent: true,
          agent_since: now,
          status: 'waiting',
          is_active: true,
          created_at: now,
          process_history: [historyEntry],
        });
        console.log(`[360-TEMPLATE]    ✅ Created new session=${result.insertedId}`);
      }
    } else {
      console.log(`[360-TEMPLATE] ⏭ STEP 7 — Skipping history save (no userId)`);
    }

    console.log(`[360-TEMPLATE] ✅ DONE | waSent=${waSent} | phone=${normalizedPhone} | waError=${waError || 'none'}`);
    console.log(`${'═'.repeat(80)}\n`);
    if (waResponseBody !== null) {
      return res.status(waSent ? 200 : 400).json(waResponseBody);
    }
    res.json({ success: true, waSent, waError, phone: normalizedPhone });
  } catch (err) {
    console.error('[360-TEMPLATE] ❌ FATAL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
