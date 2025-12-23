const runtime = require('../config/runtime');
const User = require('../models/User');
const JsonUsers = require('../services/jsonUserService');

// GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    if (runtime.storage.mongoConnected) {
      const user = await User.findById(req.user.id).select('settings');
      return res.json(user?.settings || {});
    }

    const user = await JsonUsers.findById(req.user.id);
    return res.json((user && user.settings) || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/settings
exports.updateSettings = async (req, res) => {
  try {
    const { currency, theme, notificationsEnabled } = req.body;
    const patch = { settings: {} };

    if (typeof currency !== 'undefined') {
      if (typeof currency !== 'string' || currency.length > 4) return res.status(400).json({ message: 'currency must be a short string' });
      patch.settings.currency = currency;
    }

    if (typeof theme !== 'undefined') {
      if (theme !== 'light' && theme !== 'dark') return res.status(400).json({ message: "theme must be 'light' or 'dark'" });
      patch.settings.theme = theme;
    }

    if (typeof notificationsEnabled !== 'undefined') {
      patch.settings.notificationsEnabled = !!notificationsEnabled;
    }

    if (runtime.storage.mongoConnected) {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.settings = { ...(user.settings || {}), ...(patch.settings || {}) };
      await user.save();
      return res.json(user.settings);
    }

    const result = await JsonUsers.updateUser(req.user.id, patch);
    if (!result.ok) return res.status(404).json({ message: 'User not found' });
    res.json(result.user.settings || {});
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
