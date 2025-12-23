const path = require('path');
const { readArray, writeArray } = require('../storage/jsonDb');
const defaults = require('./defaultCategories');

const CATEGORIES_FILE = path.join(__dirname, '../data/categories.json');

function nowIso() {
  return new Date().toISOString();
}

function ensureSeeded() {
  const cats = readArray(CATEGORIES_FILE);
  if (cats.length > 0) return;

  const seeded = [];
  for (const type of ['expense', 'income']) {
    for (const c of defaults[type]) {
      seeded.push({
        _id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        user: null,
        name: c.name,
        type,
        color: c.color,
        icon: c.icon,
        createdAt: nowIso()
      });
    }
  }

  writeArray(CATEGORIES_FILE, seeded);
}

async function listForUser(userId, { type } = {}) {
  ensureSeeded();
  const all = readArray(CATEGORIES_FILE);
  return all
    .filter(c => c.user === null || c.user === userId)
    .filter(c => (type ? c.type === type : true))
    .sort((a, b) => (a.type + a.name).localeCompare(b.type + b.name));
}

async function createForUser(userId, input) {
  ensureSeeded();
  const all = readArray(CATEGORIES_FILE);

  const cat = {
    _id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    user: userId,
    name: input.name,
    type: input.type,
    color: input.color || '#cccccc',
    icon: input.icon || 'fa-tag',
    createdAt: nowIso()
  };

  all.push(cat);
  writeArray(CATEGORIES_FILE, all);
  return cat;
}

async function updateForUser(userId, id, patch) {
  ensureSeeded();
  const all = readArray(CATEGORIES_FILE);
  const idx = all.findIndex(c => c._id === id);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  if (all[idx].user !== userId) return { ok: false, reason: 'not_authorized' };

  const updated = {
    ...all[idx],
    name: typeof patch.name === 'string' ? patch.name : all[idx].name,
    color: typeof patch.color === 'string' ? patch.color : all[idx].color,
    icon: typeof patch.icon === 'string' ? patch.icon : all[idx].icon
  };

  all[idx] = updated;
  writeArray(CATEGORIES_FILE, all);
  return { ok: true, category: updated };
}

async function deleteForUser(userId, id) {
  ensureSeeded();
  const all = readArray(CATEGORIES_FILE);
  const idx = all.findIndex(c => c._id === id);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  if (all[idx].user !== userId) return { ok: false, reason: 'not_authorized' };
  all.splice(idx, 1);
  writeArray(CATEGORIES_FILE, all);
  return { ok: true };
}

module.exports = {
  listForUser,
  createForUser,
  updateForUser,
  deleteForUser
};
