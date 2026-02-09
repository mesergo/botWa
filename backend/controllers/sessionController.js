
import BotSession from '../models/BotSession.js';

export const startSession = async (req, res) => {
  const userId = req.user.id;
  const { customer_phone, widget_id } = req.body;
  try {
    const session = await BotSession.create({
      user_id: userId,
      customer_phone: customer_phone || 'Simulated',
      widget_id: widget_id,
      parameters: {},
      process_history: []
    });
    res.json({ sessionId: session._id.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSessionParameters = async (req, res) => {
  const { sessionId, parameters } = req.body;
  try {
    await BotSession.updateOne(
      { _id: sessionId },
      { $set: { parameters: parameters } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
