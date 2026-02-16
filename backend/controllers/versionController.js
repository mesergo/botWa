
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

    // Get all existing versions for this flow/process combination
    const existingVersions = await Version.find({ 
      user_id: userId, 
      flow_id: flow_id, 
      standard_process_id: normalizedProcessId 
    }).sort({ created_at: -1 });

    // Count locked and unlocked versions
    const lockedVersions = existingVersions.filter(v => v.isLocked);
    const unlockedVersions = existingVersions.filter(v => !v.isLocked);
    
    // If we have reached max versions and all are locked, prevent creation
    if (lockedVersions.length >= limits.maxVersions) {
      return res.status(403).json({ 
        error: 'MAX_VERSIONS_LOCKED', 
        message: `הגעת למגבלת ${limits.maxVersions} גירסאות והכל נעול. כדי לפרסם גרסה חדשה, יש צורך בהרחבת מכסת הגרסאות.`,
        price: limits.versionPrice
      });
    }
    
    // If total versions >= max and there are no unlocked versions to replace
    if (existingVersions.length >= limits.maxVersions && unlockedVersions.length === 0) {
      return res.status(403).json({ 
        error: 'MAX_VERSIONS_LOCKED', 
        message: `הגעת למגבלת ${limits.maxVersions} גרסאות והכל נעול. כדי לפרסם גרסה חדשה, יש צורך בהרחבת מכסת הגרסאות.`,
        price: limits.versionPrice
      });
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

export const publishPaidVersion = async (req, res) => {
  const userId = req.user.id;
  const { name, nodes, edges, flow_id, standard_process_id = null } = req.body;
  
  try {
    const user = await User.findById(userId);
    const accountType = user.account_type || 'Basic';
    const limits = ACCOUNTS_CONFIG[accountType];
    const normalizedProcessId = (standard_process_id === "null" || !standard_process_id) ? null : standard_process_id;

    // Note: Payment will be handled externally via payment gateway
    // This endpoint confirms the publish after payment is verified
    
    // Create new version and lock it automatically (paid version)
    const version = await Version.create({
      name: name,
      user_id: userId,
      flow_id: flow_id,
      standard_process_id: normalizedProcessId,
      created_at: new Date().toISOString(),
      isLocked: true, // Automatically lock paid versions
      data: { nodes, edges }
    });
    
    res.json({ 
      success: true,
      price: limits.versionPrice,
      version: {
        id: version._id.toString(), 
        name, 
        created_at: new Date().toISOString(), 
        isLocked: true 
      }
    });
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

export const getRestorableVersions = async (req, res) => {
  const userId = req.user.id;
  const { flow_id, standard_process_id = null } = req.query;
  
  try {
    const user = await User.findById(userId);
    const accountType = user.account_type || 'Basic';
    const limits = ACCOUNTS_CONFIG[accountType];

    const normalizedProcessId = (standard_process_id === "null" || !standard_process_id) ? null : standard_process_id;
    const query = { user_id: userId, flow_id: flow_id, standard_process_id: normalizedProcessId };
    
    // Fetch ALL versions
    const allVersions = await Version.find(query).sort({ created_at: -1 });
    
    // Calculate which versions are currently visible
    let visibleVersions = [];
    let lockedVersions = allVersions.filter(v => v.isLocked);
    let unlockedVersions = allVersions.filter(v => !v.isLocked);
    
    visibleVersions = [...lockedVersions];
    for (const uv of unlockedVersions) {
      if (visibleVersions.length < limits.maxVersions) {
        visibleVersions.push(uv);
      }
    }
    
    const visibleIds = new Set(visibleVersions.map(v => v._id.toString()));
    
    // Restorable versions are those NOT in the visible list
    const restorableVersions = allVersions.filter(v => !visibleIds.has(v._id.toString()));
    
    res.json({
      count: restorableVersions.length,
      versionPrice: limits.versionPrice,
      versions: restorableVersions.map(v => ({
        id: v._id.toString(),
        name: v.name,
        created_at: v.created_at,
        isLocked: !!v.isLocked
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const restoreVersion = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId);
    const accountType = user.account_type || 'Basic';
    const limits = ACCOUNTS_CONFIG[accountType];
    
    // Find the version to restore
    const versionToRestore = await Version.findOne({ _id: id, user_id: userId });
    if (!versionToRestore) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    // Note: Payment will be handled externally via payment gateway
    // This endpoint confirms the restore after payment is verified
    
    // Mark version as locked to ensure it appears in visible list
    versionToRestore.isLocked = true;
    await versionToRestore.save();
    
    res.json({ 
      success: true,
      price: limits.versionPrice,
      version: {
        id: versionToRestore._id.toString(),
        name: versionToRestore.name,
        created_at: versionToRestore.created_at,
        isLocked: true,
        data: versionToRestore.data
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
