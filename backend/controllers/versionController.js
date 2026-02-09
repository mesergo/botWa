
import User from '../models/User.js';
import Version from '../models/Version.js';

const ACCOUNTS_CONFIG = {
  Basic: { maxBots: 3, maxVersions: 5, versionPrice: 5, botPrice: 30 },
  Premium: { maxBots: 6, maxVersions: 10, versionPrice: 5, botPrice: 30 }
};

export const publishVersion = async (req, res) => {
  const userId = req.user.id;
  const { name, nodes, edges, flow_id, standard_process_id = null } = req.body;
  
  try {
    const user = await User.findById(userId);
    const accountType = user.account_type || 'Basic';
    const limits = ACCOUNTS_CONFIG[accountType];
    const normalizedProcessId = (standard_process_id === "null" || !standard_process_id) ? null : standard_process_id;

    // Count currently "visible" versions (the logic for visibility is handled in getVersions, 
    // but here we check if the user can add another one without error)
    const existingVersions = await Version.find({ 
      user_id: userId, 
      flow_id: flow_id, 
      standard_process_id: normalizedProcessId 
    }).sort({ created_at: -1 });

    if (existingVersions.length >= limits.maxVersions) {
      // Check if there is at least one unlocked version we can "bump"
      const hasUnlocked = existingVersions.some(v => !v.isLocked);
      if (!hasUnlocked) {
        return res.status(403).json({ 
          error: 'MAX_VERSIONS_LOCKED', 
          message: 'כל הגרסאות שלך נעולות. הגעת למכסה המקסימלית.',
          price: limits.versionPrice
        });
      }
    }

    const version = await Version.create({
      name: name,
      user_id: userId,
      flow_id: flow_id,
      standard_process_id: normalizedProcessId,
      created_at: new Date().toISOString(),
      isLocked: false,
      data: { nodes, edges }
    });
    
    res.json({ id: version._id.toString(), name, created_at: new Date().toISOString(), isLocked: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getVersions = async (req, res) => {
  const userId = req.user.id;
  const { flow_id, standard_process_id = null } = req.query;
  
  try {
    const user = await User.findById(userId);
    const accountType = user.account_type || 'Basic';
    const limits = ACCOUNTS_CONFIG[accountType];

    const normalizedProcessId = (standard_process_id === "null" || !standard_process_id) ? null : standard_process_id;
    const query = { user_id: userId, flow_id: flow_id, standard_process_id: normalizedProcessId };
    
    // Fetch ALL versions to apply the visibility logic
    const allVersions = await Version.find(query).sort({ created_at: -1 });
    
    // Logic: 
    // 1. Keep all locked versions.
    // 2. Keep the newest unlocked versions until the total count reaches the limit.
    // This effectively "hides" the oldest unlocked versions.
    
    let visibleVersions = [];
    let lockedVersions = allVersions.filter(v => v.isLocked);
    let unlockedVersions = allVersions.filter(v => !v.isLocked);
    
    // Always show locked ones
    visibleVersions = [...lockedVersions];
    
    // Fill the rest with newest unlocked until we hit the limit
    for (const uv of unlockedVersions) {
      if (visibleVersions.length < limits.maxVersions) {
        visibleVersions.push(uv);
      }
    }
    
    // Sort back by date
    visibleVersions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(visibleVersions.map(v => ({
      id: v._id.toString(),
      name: v.name,
      created_at: v.created_at,
      isLocked: !!v.isLocked,
      data: v.data
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const toggleVersionLock = async (req, res) => {
  const { id } = req.params;
  const { isLocked } = req.body;
  const userId = req.user.id;
  try {
    await Version.updateOne(
      { _id: id, user_id: userId },
      { $set: { isLocked: isLocked } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteVersion = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    await Version.deleteOne({ _id: id, user_id: userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
