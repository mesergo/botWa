
import crypto from 'crypto';
import { mongoose } from '../config/db.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import fetch from 'node-fetch';
import { getEffectiveUserId, resolvePermissions, hasPermission } from '../middleware/auth.js';
import { pushMessagesToWhatsApp } from '../utils/whatsappSender.js';

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
    return res.status(400).json({ error: 'Missing widget_id' });
  }

  try {
    // Ensure mongoose is connected
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      console.log(`[startSession] ❌ DB not ready (state=${mongoose.connection?.readyState})`);
      console.log(`${'─'.repeat(80)}\n`);
      return res.status(503).json({ error: 'Database connection not ready' });
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
    return res.status(400).json({ error: 'Invalid sessionId format' });
  }

  try {
    // Ensure mongoose is connected
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      console.error('[updateSessionParameters] Database not connected, readyState:', mongoose.connection?.readyState);
      return res.status(503).json({ error: 'Database connection not ready' });
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
  try {
    // Get all bots owned by this user
    const userBots = await BotFlow.find({ user_id: userId });
    const botNameMap = {};
    userBots.forEach(b => { botNameMap[b._id.toString()] = b.name; });
    const botIds = userBots.map(b => b._id.toString());

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
            { widget_id: { $in: widgetIds } }
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
          repGroupIds: { $addToSet: '$rep_group_id' },
          repUserIds: { $addToSet: '$rep_user_id' },
          customerPhones: { $addToSet: '$customer_phone' },
          // Status of the most recent session for this contact
          latestStatus: { $first: '$status' },
          latestSessionDate: { $first: '$_date' }
        }
      }, 
      { $sort: { lastSeen: -1 } }
    ];

    const contacts = await collection.aggregate(pipeline).toArray();

    // Map widget_ids → bot names via widgetFlowMap
    const result = contacts.map(c => {
      const usedBotIds = new Set(
        (c.widgetIds || [])
          .map(wid => widgetFlowMap[wid])
          .filter(fid => fid && botNameMap[fid])
      );
      return {
        phone: c._id,
        sessionCount: c.sessionCount,
        lastSeen: c.lastSeen,
        bots: [...usedBotIds].map(id => ({ id, name: botNameMap[id] })),
        botPhones: (c.customerPhones || []).filter(p => p && p !== 'Simulated' && p !== 'simulated'),
        repGroupIds: (c.repGroupIds || []).filter(Boolean).map(String),
        repUserIds: (c.repUserIds || []).filter(Boolean).map(String),
        status: c.latestStatus || 'bot'
      };
    });

    // Enrich with assigned_to from Contact collection
    const phones = result.map(c => c.phone);
    const contactDocs = await Contact.find({ user_id: userId, phone: { $in: phones } }).select('phone assigned_to').lean();
    const assignedToMap = {};
    contactDocs.forEach(c => { assignedToMap[c.phone] = (c.assigned_to || []).map(id => id.toString()); });

    let finalResult = result.map(c => ({ ...c, assigned_to: assignedToMap[c.phone] || [] }));

    // If user has view_assigned_only permission (but NOT view_all), filter to assigned contacts only
    const userDoc = await User.findById(req.userId).lean();
    const perms = await resolvePermissions(userDoc || { role: req.user?.role });
    const viewOnlyAssigned = hasPermission(perms, 'sessions.view_assigned_only') && !hasPermission(perms, 'sessions.view_all');
    if (viewOnlyAssigned) {
      const repId = req.userId;
      const repUser = await User.findById(repId).select('rep_group_ids').lean();
      const repGroupSet = new Set(((repUser?.rep_group_ids) || []).map(id => id.toString()));
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
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  try {
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

    const collection = mongoose.connection.collection('BotSession');

    const sessions = await collection.aggregate([
      {
  $match: {
    $and: [
      { $or: [{ customer_phone: phone }, { sender: phone }] },
      {
        $or: [
          { user_id: userId },
          { user_id: userId.toString() },
          { widget_id: { $in: widgetIds } }
        ]
      }
    ]
  }
},
      { $addFields: { _sortDate: { $ifNull: ['$created_at', '$createdAt'] } } },
      { $sort: { _sortDate: 1 } }
    ]).toArray();

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
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    const collection = mongoose.connection.collection('BotSession');
    const result = await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { is_active: false, ended_at: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Session not found' });
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
// For reps (role === 'rep'): in addition to the company match, the rep must be
// involved in the session — either explicitly assigned (rep_user_id === me),
// or the session belongs to a rep group the rep is a member of.
const getSessionWithOwnership = async (id, req) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'Invalid session ID', status: 400 };
  const collection = mongoose.connection.collection('BotSession');
  const session = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
  if (!session) return { error: 'Session not found', status: 404 };

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

  if (!owned) return { error: 'Access denied', status: 403 };

  // Additional rep involvement guard.
  if (req.user?.role === 'rep') {
    const repId = String(req.userId);
    const me = await User.findById(repId).select('rep_group_ids').lean();
    const myGroups = new Set(((me?.rep_group_ids) || []).map(g => g.toString()));
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
      { $set: { is_agent: true, agent_since, status: newStatus } }
    );
    res.json({ success: true, agent_since: agent_since.toISOString(), status: newStatus });
  } catch (err) {
    console.error('setAgentMode error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const clearAgentMode = async (req, res) => {
  try {
    const { id } = req.params;
    const { collection, error, status } = await getSessionWithOwnership(id, req);
    if (error) return res.status(status).json({ error });

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { is_agent: false, agent_since: null, status: 'bot' } }
    );
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
    const { collection, error, status } = await getSessionWithOwnership(id, req);
    if (error) return res.status(status).json({ error });

    const now = new Date();
    const historyEntry = {
      type: 'System',
      text: 'השיחה הסתיימה',
      sender: 'system',
      name: 'מערכת',
      node_id: 'system',
      event: 'conversation_closed',
      created: now.toISOString()
    };

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: { is_agent: false, agent_since: null, status: 'closed', ended_at: now },
        $push: { process_history: historyEntry }
      }
    );
    res.json({ success: true, status: 'closed', historyEntry });
  } catch (err) {
    console.error('closeConversation error:', err);
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
    const { targetType, targetId, groupId, note } = req.body || {};

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
    if (!session) return res.status(404).json({ error: 'Session not found' });

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
    if (!owned) return res.status(403).json({ error: 'Access denied' });

    // Additional guard for reps: a rep may only transfer conversations they
    // are currently involved in (assigned via rep_user_id, or via one of
    // their rep groups).
    if (req.user?.role === 'rep') {
      const me = await User.findById(req.userId).select('rep_group_ids').lean();
      const myGroups = new Set(((me?.rep_group_ids) || []).map(x => x.toString()));
      const involved =
        String(session.rep_user_id || '') === String(req.userId) ||
        (session.rep_group_id && myGroups.has(String(session.rep_group_id)));
      if (!involved) return res.status(403).json({ error: 'אינך משויך לשיחה זו' });
    }

    // Validate target belongs to the same company.
    let targetLabel = '';
    const update = { is_agent: true, agent_since: new Date(), status: 'waiting' };
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
    const historyEntry = {
      type: 'System',
      text: `השיחה הועברה ע"י ${fromName} ל${targetLabel}${noteText}`,
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
      return res.status(400).json({ error: 'message or media is required' });
    }
    const { session, collection, error, status } = await getSessionWithOwnership(id, req);
    if (error) return res.status(status).json({ error });

    const msgText = String(message || '').trim();
    const now = new Date();
    const created = now.toISOString(); // for process_history

    // Get user (effective company manager) to access Dialog360 credentials
    const user = await User.findById(getEffectiveUserId(req));

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
      return res.status(400).json({ error: 'Session has no phone number' });
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
            if (headerComponent.format === 'IMAGE' && headerComponent.example?.header_handle) {
              waBody.header = [{
                type: 'image',
                image: { link: headerComponent.example.header_handle[0] || '' }
              }];
            } else if (headerComponent.format === 'VIDEO' && headerComponent.example?.header_handle) {
              waBody.header = [{
                type: 'video',
                video: { link: headerComponent.example.header_handle[0] || '' }
              }];
            } else if (headerComponent.format === 'DOCUMENT' && headerComponent.example?.header_handle) {
              waBody.header = [{
                type: 'document',
                document: { link: headerComponent.example.header_handle[0] || '' }
              }];
            }
          }
        }
      }
      // Final fallback: params were provided but had no header URL — try template example
      if (!waBody.header && templateData.components && Array.isArray(templateData.components)) {
        const headerComp = templateData.components.find(c => c.type === 'HEADER');
        if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
          const handles = headerComp.example?.header_handle;
          if (handles && handles.length > 0) {
            const mediaType = headerComp.format.toLowerCase();
            waBody.header = [{ type: mediaType, [mediaType]: { link: handles[0] } }];
            console.log(`[sendAgentMessage] ⚠️ No header URL in params — using template example: ${handles[0]}`);
          }
        }
      }
    }
    // (text and media messages are sent via pushMessagesToWhatsApp below)

    let waSent = false;
    let waError = null;

    if (isTemplate && templateData) {
      // Templates use a different body structure — send directly
      console.log(`[sendAgentMessage] 📤 Sending TEMPLATE | endpoint=${endpoint} | phone=${normalizedPhone}`);
      console.log(`[sendAgentMessage] 📤 Body:`, JSON.stringify(waBody, null, 2));
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
          console.log(`[sendAgentMessage] ✅ WhatsApp OK | phone=${normalizedPhone} | status=${waRes.status} | response=${responseBody}`);
        } else {
          waError = `HTTP ${waRes.status}: ${await waRes.text()}`;
          console.error(`[sendAgentMessage] ❌ WhatsApp FAILED | phone=${normalizedPhone} | ${waError}`);
        }
      } catch (waErr) {
        waError = waErr.message;
        console.error(`[sendAgentMessage] ❌ WhatsApp exception:`, waErr.message);
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
        waSent = await pushMessagesToWhatsApp(normalizedPhone, waMessages, user, bot);
        console.log(`[AGENT-SEND] ${waSent ? '✅ WhatsApp delivered' : '❌ WhatsApp delivery FAILED'}`);
        console.log(`${'─'.repeat(60)}\n`);
        if (!waSent) waError = 'WhatsApp delivery failed';
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
      node_id: 'agent',
      created,
      wa_sent: waSent,
      wa_error: waError || null
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

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      update
    );

    res.json({ success: true, waSent, waError, created, historyEntry, status: newStatus });
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
      return res.status(400).json({ error: 'phone is required' });
    }
    if (!templateData) {
      return res.status(400).json({ error: 'templateData is required' });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const user = await User.findById(getEffectiveUserId(req));
    if (!user) return res.status(404).json({ error: 'User not found' });

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
        const handles = headerComp.example?.header_handle;
        if (handles && handles.length > 0) {
          const mediaType = headerComp.format.toLowerCase();
          waBody.header = [{ type: mediaType, [mediaType]: { link: handles[0] } }];
          console.log(`[sendTemplateToPhone] ⚠️ No header URL provided — using template example: ${handles[0]}`);
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
      process_history: [historyEntry]
    };
    const insertResult = await collection.insertOne(sessionDoc);
    const sessionId = insertResult.insertedId.toString();
    console.log(`[sendTemplateToPhone] 💾 Created BotSession ${sessionId} for phone=${normalizedPhone}`);

    res.json({ success: true, waSent, waError, sessionId, historyEntry, created, phone: normalizedPhone });
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
      return res.status(400).json({ error: 'sessionId is required' });
    }
    
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ error: 'Invalid sessionId format' });
    }

    const collection = mongoose.connection.collection('BotSession');
    const session = await collection.findOne({ _id: new mongoose.Types.ObjectId(sessionId) });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const msgText = String(message).trim();
    const now = new Date();
    const created = now.toISOString();

    // Get user's Dialog360 credentials
    const user = await User.findById(session.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

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
            if (headerComponent.format === 'IMAGE' && headerComponent.example?.header_handle) {
              waBody.header = [{
                type: 'image',
                image: { link: headerComponent.example.header_handle[0] || '' }
              }];
            } else if (headerComponent.format === 'VIDEO' && headerComponent.example?.header_handle) {
              waBody.header = [{
                type: 'video',
                video: { link: headerComponent.example.header_handle[0] || '' }
              }];
            } else if (headerComponent.format === 'DOCUMENT' && headerComponent.example?.header_handle) {
              waBody.header = [{
                type: 'document',
                document: { link: headerComponent.example.header_handle[0] || '' }
              }];
            }
          }
        }
      }
      // Final fallback: params were provided but had no header URL — try template example
      if (!waBody.header && templateData.components && Array.isArray(templateData.components)) {
        const headerComp = templateData.components.find(c => c.type === 'HEADER');
        if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
          const handles = headerComp.example?.header_handle;
          if (handles && handles.length > 0) {
            const mediaType = headerComp.format.toLowerCase();
            waBody.header = [{ type: mediaType, [mediaType]: { link: handles[0] } }];
            console.log(`[sendAdminMessageToSession] ⚠️ No header URL in params — using template example: ${handles[0]}`);
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
      node_id: 'agent',
      created,
      wa_sent: waSent
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
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  if (!message || !message.content) {
    console.log(`[sendExternalMessage] ❌ Missing message content`);
    console.log(`${'─'.repeat(80)}\n`);
    return res.status(400).json({ error: 'Missing message content' });
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
      targetSimulatorId: simulator_id || null // Target specific simulator or all
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
    return res.status(400).json({ error: 'Invalid sessionId' });
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
