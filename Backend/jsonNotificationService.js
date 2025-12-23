const path = require('path');
const { readArray, writeArray } = require('../storage/jsonDb');

const NOTIFICATIONS_FILE = path.join(__dirname, '../data/notifications.json');

function nowIso() {
  return new Date().toISOString();
}

async function listForUser(userId, { unreadOnly } = {}) {
  const all = readArray(NOTIFICATIONS_FILE);
  return all
    .filter(n => n.user === userId)
    .filter(n => (unreadOnly ? !n.read : true))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function createForUser(userId, { type, message }) {
  const all = readArray(NOTIFICATIONS_FILE);
  const n = {
    _id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    user: userId,
    type,
    message,
    read: false,
    createdAt: nowIso()
  };
  all.push(n);
  writeArray(NOTIFICATIONS_FILE, all);
  return n;
}

async function markRead(userId, id) {
  const all = readArray(NOTIFICATIONS_FILE);
  const idx = all.findIndex(n => n._id === id);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  if (all[idx].user !== userId) return { ok: false, reason: 'not_authorized' };
  all[idx] = { ...all[idx], read: true };
  writeArray(NOTIFICATIONS_FILE, all);
  return { ok: true };
}

module.exports = {
  listForUser,
  createForUser,
  markRead
};
