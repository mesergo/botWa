
import { mongoose } from '../config/db.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';

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
