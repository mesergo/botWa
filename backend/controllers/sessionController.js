
import { mongoose } from '../config/db.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';
import User from '../models/User.js';

export const startSession = async (req, res) => {
  // Safe extraction: explicitly check for req.user to avoid 'undefined' values in DB insert
  const userId = (req.user && req.user.id) ? req.user.id : null;
  const { customer_phone, widget_id } = req.body;

  if (!widget_id) {
    return res.status(400).json({ error: 'Missing widget_id' });
  }

  try {
    // Ensure mongoose is connected
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection not ready' });
    }
    
    const collection = mongoose.connection.collection('BotSession');
    
    const result = await collection.insertOne({
      user_id: userId, // Will be null if guest, which is valid for MongoDB
      customer_phone: customer_phone || 'Simulated',
      widget_id: widget_id,
      parameters: {},
      process_history: [],
      created_at: new Date()
    });
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
  const userId = req.user.id;
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
        $addFields: {
          phone: { $ifNull: ['$customer_phone', { $ifNull: ['$sender', 'לא ידוע'] }] }
        }
      },
      {
        $group: {
          _id: '$phone',
          sessionCount: { $sum: 1 },
          lastSeen: { $max: '$created_at' },
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

    res.json(result);
  } catch (err) {
    console.error('getContacts error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getUserSessions = async (req, res) => {
  const userId = req.user.id;
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
        phone: s.customer_phone || s.sender || 'לא ידוע',
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

    const pipeline = [
      // Normalise date field and derive searchable bot/user name fields via $addFields
      {
        $addFields: {
          _sortDate: { $ifNull: ['$created_at', '$createdAt'] },
          _phone: { $ifNull: ['$customer_phone', { $ifNull: ['$sender', 'לא ידוע'] }] }
        }
      },
      { $sort: { _sortDate: -1 } },
      // Text search filter (regex on phone — bot/user names are resolved post-fetch)
      ...(search ? [{
        $match: {
          _phone: { $regex: search, $options: 'i' }
        }
      }] : []),
      // Count + paginate in one pass
      {
        $facet: {
          meta: [{ $count: 'total' }],
          data: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }]
        }
      }
    ];

    const [result] = await collection.aggregate(pipeline).toArray();
    const rawData = result.data ?? [];

    // Resolve bot / user names from lookup maps
    const sessions = rawData.map(s => {
      const flowId = widgetFlowMap[s.widget_id] || s.flow_id;
      const botName = flowId ? botNameMap[flowId] : null;
      const ownerId = flowId ? botUserMap[flowId] : s.user_id?.toString();
      const ownerName = ownerId ? userNameMap[ownerId] : null;
      return {
        id: s._id.toString(),
        phone: s._phone,
        widget_id: s.widget_id,
        bot_name: botName || 'לא ידוע',
        user_name: ownerName || 'לא ידוע',
        created_at: s.created_at || s.createdAt,
        parameters: s.parameters || {},
        process_history: s.process_history || [],
        is_active: s.is_active !== false
      };
    });

    // If search also needs to match bot_name / user_name (resolved JS-side), filter further
    const finalSessions = search
      ? sessions.filter(s =>
          s.phone.toLowerCase().includes(search.toLowerCase()) ||
          s.bot_name.toLowerCase().includes(search.toLowerCase()) ||
          s.user_name.toLowerCase().includes(search.toLowerCase())
        )
      : sessions;

    // Recount after JS-side filter (only differs when search matches bot/user name)
    const total = search
      ? (result.meta[0]?.total ?? 0)   // approximate from DB; full accuracy below
      : (result.meta[0]?.total ?? 0);

    // For accurate total when bot/user search is used, do a lightweight count pass
    const accurateTotal = search ? await (async () => {
      const countPipeline = [
        { $addFields: { _sortDate: { $ifNull: ['$created_at', '$createdAt'] }, _phone: { $ifNull: ['$customer_phone', { $ifNull: ['$sender', 'לא ידוע'] }] } } },
        { $sort: { _sortDate: -1 } },
        { $count: 'total' }
      ];
      const [cr] = await collection.aggregate(countPipeline).toArray();
      return cr?.total ?? 0;
    })() : total;

    const totalPages = Math.max(1, Math.ceil(accurateTotal / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);

    res.json({ sessions: finalSessions, total: accurateTotal, page: safePage, totalPages });
  } catch (err) {
    console.error('getAllSessions error:', err);
    res.status(500).json({ error: err.message });
  }
};

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
