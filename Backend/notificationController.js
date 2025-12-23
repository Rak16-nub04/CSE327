const runtime = require('../config/runtime');
const Notification = require('../models/Notification');
const JsonNotifications = require('../services/jsonNotificationService');

// GET /api/notifications?unreadOnly=true
exports.getNotifications = async (req, res) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';

    if (runtime.storage.mongoConnected) {
      const q = { user: req.user.id };
      if (unreadOnly) q.read = false;
      const notifications = await Notification.find(q).sort({ createdAt: -1 }).limit(50);
      return res.json(notifications);
    }

    const notifications = await JsonNotifications.listForUser(req.user.id, { unreadOnly });
    res.json(notifications.slice(0, 50));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    if (runtime.storage.mongoConnected) {
      const n = await Notification.findById(req.params.id);
      if (!n) return res.status(404).json({ message: 'Notification not found' });
      if (n.user.toString() !== req.user.id) return res.status(401).json({ message: 'User not authorized' });
      n.read = true;
      await n.save();
      return res.json({ id: req.params.id, read: true });
    }

    const result = await JsonNotifications.markRead(req.user.id, req.params.id);
    if (!result.ok) {
      if (result.reason === 'not_found') return res.status(404).json({ message: 'Notification not found' });
      if (result.reason === 'not_authorized') return res.status(401).json({ message: 'User not authorized' });
    }

    res.json({ id: req.params.id, read: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
