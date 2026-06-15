
import crypto from 'crypto';
import { mongoose } from '../config/db.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import fetch from 'node-fetch';
import { getEffectiveUserId, resolvePermissions, hasPermission } from '../middleware/auth.js';

export const startSession = async (req, res) => {
  // Safe extraction: explicitly check for req.user to avoid 'undefined' values in DB insert
  const userId = (req.user && req.user.id) ? req.user.id : null;
  const { customer_phone, widget_id, simulator_id } = req.body;

  if (!widget_id) {
    return res.status(400).json({ error: 'Missing widget_id' });
  }

  try {
    // Ensure mongoose is connected
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
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
    res.json({ sessionId: result.insertedId.toString() });
  } catch (err) {
    console.error("Start Session Error:", err);
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
      {
        $group: {
          _id: '$contactKey',
          sessionCount: { $sum: 1 },
          lastSeen: { $max: '$_date' },
          widgetIds: { $addToSet: '$widget_id' }
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
        bots: [...usedBotIds].map(id => ({ id, name: botNameMap[id] }))
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
      finalResult = finalResult.filter(c => c.assigned_to.includes(repId));
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
  const userId = req.user.id;
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
        agent_since: s.agent_since || null
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

const getSessionWithOwnership = async (id, userId) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'Invalid session ID', status: 400 };
  const collection = mongoose.connection.collection('BotSession');
  const session = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
  if (!session) return { error: 'Session not found', status: 404 };

  const userBots = await BotFlow.find({ user_id: userId }).lean();
  const botIds = userBots.map(b => b._id.toString());
  const userWidgets = await Widget.find({ flow_id: { $in: botIds } }).select('id').lean();
  const widgetIds = userWidgets.map(w => w.id).filter(Boolean);

  const owned =
    session.user_id === userId ||
    session.user_id === String(userId) ||
    widgetIds.includes(session.widget_id);

  if (!owned) return { error: 'Access denied', status: 403 };
  return { session, collection };
};

export const setAgentMode = async (req, res) => {
  try {
    const { id } = req.params;
    const { session, collection, error, status } = await getSessionWithOwnership(id, req.user.id);
    if (error) return res.status(status).json({ error });

    const agent_since = new Date();
    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { is_agent: true, agent_since } }
    );
    res.json({ success: true, agent_since: agent_since.toISOString() });
  } catch (err) {
    console.error('setAgentMode error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const clearAgentMode = async (req, res) => {
  try {
    const { id } = req.params;
    const { collection, error, status } = await getSessionWithOwnership(id, req.user.id);
    if (error) return res.status(status).json({ error });

    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { is_agent: false, agent_since: null } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('clearAgentMode error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const sendAgentMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, isTemplate, templateData } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    const { session, collection, error, status } = await getSessionWithOwnership(id, req.user.id);
    if (error) return res.status(status).json({ error });

    const msgText = String(message).trim();
    const now = new Date();
    const created = now.toISOString(); // for process_history

    // Get user to access Dialog360 credentials
    const user = await User.findById(req.user.id);
    
    // Build WhatsApp API endpoint and token
    let endpoint, waToken;
    if (user && user.dialog360_bot_id) {
      endpoint = `dialog360/${user.dialog360_bot_id}`;
      waToken = crypto.createHash('sha1').update(user.dialog360_bot_id + 'moomoo').digest('hex');
    } else {
      endpoint = process.env.WHATSAPP_ENDPOINT || 'dialog360/65aec7ebf1a1d64f29645fd9';
      waToken = process.env.WHATSAPP_API_TOKEN || crypto.createHash('sha1').update(endpoint + 'moomoo').digest('hex');
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
    } else {
      // Regular text message
      console.log(`[sendAgentMessage] 💬 Sending TEXT | phone=${normalizedPhone}`);
      waBody = {
        phone: normalizedPhone,
        text: msgText,
        fromMe: 1
      };
    }

    let waSent = false;
    let waError = null;
    console.log(`[sendAgentMessage] 📤 Sending | endpoint=${endpoint} | phone=${normalizedPhone}`);
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

    // Always save to history (for audit trail), but mark if not delivered
    let historyEntry = {
      sender: 'agent',
      name: 'נציג',
      node_id: 'agent',
      created,
      wa_sent: waSent
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
    } else {
      // Regular text message
      historyEntry.type = 'Text';
      historyEntry.text = msgText;
    }
    
    console.log(`[sendAgentMessage] 💾 Saving history entry:`, JSON.stringify(historyEntry, null, 2));
    
    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $push: { process_history: historyEntry } }
    );

    res.json({ success: true, waSent, waError, created, historyEntry });
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

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let endpoint, waToken;
    if (user.dialog360_bot_id) {
      endpoint = `dialog360/${user.dialog360_bot_id}`;
      waToken = crypto.createHash('sha1').update(user.dialog360_bot_id + 'moomoo').digest('hex');
    } else {
      endpoint = process.env.WHATSAPP_ENDPOINT || 'dialog360/65aec7ebf1a1d64f29645fd9';
      waToken = process.env.WHATSAPP_API_TOKEN || crypto.createHash('sha1').update(endpoint + 'moomoo').digest('hex');
    }

    // Normalize phone: ensure 972 country code
    let normalizedPhone = String(phone).replace(/[^0-9]/g, '');
    normalizedPhone = normalizedPhone.replace(/^972972/, '972');
    if (!normalizedPhone.startsWith('972')) {
      normalizedPhone = normalizedPhone.replace(/^0+/, '');
      normalizedPhone = '972' + normalizedPhone;
    }

    console.log(`[sendTemplateToPhone] 📤 phone=${phone} → normalized=${normalizedPhone} | template=${templateData.name} | lang=${templateData.language || 'he'}`);

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
    const collection = mongoose.connection.collection('BotSession');
    const sessionDoc = {
      sender: normalizedPhone,
      customer_phone: normalizedPhone,
      user_id: req.user.id,
      is_agent: true,
      agent_since: now,
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

    // Build WhatsApp API endpoint and token
    let endpoint, waToken;
    if (user.dialog360_bot_id) {
      endpoint = `dialog360/${user.dialog360_bot_id}`;
      waToken = crypto.createHash('sha1').update(user.dialog360_bot_id + 'moomoo').digest('hex');
    } else {
      // Fallback to env variables
      endpoint = process.env.WHATSAPP_ENDPOINT || 'dialog360/65aec7ebf1a1d64f29645fd9';
      waToken = process.env.WHATSAPP_API_TOKEN || crypto.createHash('sha1').update(endpoint + 'moomoo').digest('hex');
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

  console.log('[sendExternalMessage] Request:', { sessionId, message, simulator_id });

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  if (!message || !message.content) {
    return res.status(400).json({ error: 'Missing message content' });
  }

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId format' });
  }

  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection not ready' });
    }

    const collection = mongoose.connection.collection('BotSession');

    // Verify session exists and is active
    const session = await collection.findOne({ 
      _id: new mongoose.Types.ObjectId(sessionId) 
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

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
    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(sessionId) },
      { 
        $push: { process_history: entry },
        $set: { updatedAt: new Date() }
      }
    );

    console.log('[sendExternalMessage] Message added successfully to session:', sessionId);
    res.json({ success: true, message: 'Message added to session' });
  } catch (err) {
    console.error('sendExternalMessage Error:', err);
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
