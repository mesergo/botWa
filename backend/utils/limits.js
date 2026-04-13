// Helper to get active limits for a user
import SystemSetting from '../models/SystemSetting.js';

// Default configuration if DB is empty
const DEFAULT_CONFIG = {
  Trial: { maxBots: 1, maxVersions: 0, versionPrice: 0, botPrice: 0, canPublish: false, trialDays: 30 },
  Basic: { maxBots: 3, maxVersions: 5, versionPrice: 5, botPrice: 30, canPublish: true },
  Premium: { maxBots: 6, maxVersions: 10, versionPrice: 5, botPrice: 30, canPublish: true }
};

export const getUserLimits = async (user) => {
  // 1. Get global settings
  let accountsConfig = DEFAULT_CONFIG;
  try {
    const setting = await SystemSetting.findOne({ key: 'accounts_config' });
    if (setting) {
      accountsConfig = setting.value;
    }
  } catch (err) {
    console.error('Failed to load system settings, using defaults', err);
  }

  // 2. Get user's plan limits (merge DB config over defaults, so Trial always has its defaults)
  const mergedConfig = { ...DEFAULT_CONFIG, ...accountsConfig };
  const accountType = user.account_type || 'Basic';
  const planLimits = mergedConfig[accountType] || mergedConfig['Basic'];

  // Check if trial has expired
  if (accountType === 'Trial' && user.trial_expires_at) {
    const now = new Date();
    if (now > new Date(user.trial_expires_at)) {
      return { ...planLimits, maxBots: 0, maxVersions: 0, canPublish: false, trialExpired: true };
    }
  }

  // 3. Apply custom overrides (if any)
  const limits = { ...planLimits };
  
  if (user.custom_limits) {
    if (user.custom_limits.max_bots !== null) limits.maxBots = user.custom_limits.max_bots;
    if (user.custom_limits.max_versions !== null) limits.maxVersions = user.custom_limits.max_versions;
    if (user.custom_limits.version_price !== null) limits.versionPrice = user.custom_limits.version_price;
    if (user.custom_limits.bot_price !== null) limits.botPrice = user.custom_limits.bot_price;
  }

  return limits;
};
