
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
    const search = (req.query.search || '').trim().toLowerCase();

    const userBots = await BotFlow.find({ user_id: userId });
    const botNameMap = {};
    userBots.forEach(b => { botNameMap[b._id.toString()] = b.name; });
    const botIds = userBots.map(b => b._id.toString());

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

    const allSessions = await collection.find({
      $or: [
        { user_id: userId },
        { user_id: userId.toString() },
        { widget_id: { $in: widgetIds } }
      ]
    }).sort({ created_at: -1 }).toArray();

    const mapped = allSessions.map(s => {
      const flowId = widgetFlowMap[s.widget_id];
      const botName = flowId ? botNameMap[flowId] : null;
      return {
        id: s._id.toString(),
        phone: s.customer_phone || s.sender || 'לא ידוע',
        widget_id: s.widget_id,
        bot_name: botName || 'לא ידוע',
        created_at: s.created_at,
        parameters: s.parameters || {},
        process_history: s.process_history || []
      };
    });

    const filtered = search
      ? mapped.filter(s =>
          s.phone.toLowerCase().includes(search) ||
          s.bot_name.toLowerCase().includes(search)
        )
      : mapped;

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const sessions = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
    const search = (req.query.search || '').trim().toLowerCase();

    const collection = mongoose.connection.collection('BotSession');

    // Build lookup maps once
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

    // Pull all raw sessions sorted by date (no limit yet – we need to filter first)
    // For large datasets this could be optimized with text index, but for now
    // we fetch in batches until we have enough matching records.
    // Simple approach: fetch all IDs + phone fields, filter, then paginate.
    const allRaw = await collection
      .find({}, { projection: { customer_phone: 1, sender: 1, widget_id: 1, user_id: 1, created_at: 1, parameters: 1, process_history: 1 } })
      .sort({ created_at: -1 })
      .toArray();

    // Map and filter
    const mapped = allRaw.map(s => {
      const flowId = widgetFlowMap[s.widget_id];
      const botName = flowId ? botNameMap[flowId] : null;
      const ownerId = flowId ? botUserMap[flowId] : s.user_id?.toString();
      const ownerName = ownerId ? userNameMap[ownerId] : null;
      return {
        id: s._id.toString(),
        phone: s.customer_phone || s.sender || 'לא ידוע',
        widget_id: s.widget_id,
        bot_name: botName || 'לא ידוע',
        user_name: ownerName || 'לא ידוע',
        created_at: s.created_at,
        parameters: s.parameters || {},
        process_history: s.process_history || []
      };
    });

    const filtered = search
      ? mapped.filter(s =>
          s.phone.toLowerCase().includes(search) ||
          s.bot_name.toLowerCase().includes(search) ||
          s.user_name.toLowerCase().includes(search)
        )
      : mapped;

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const sessions = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    res.json({ sessions, total, page: safePage, totalPages });
  } catch (err) {
    console.error('getAllSessions error:', err);
    res.status(500).json({ error: err.message });
  }
};
