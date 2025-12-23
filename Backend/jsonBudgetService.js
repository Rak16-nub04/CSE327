const path = require('path');
const { readArray, writeArray } = require('../storage/jsonDb');

const BUDGETS_FILE = path.join(__dirname, '../data/budgets.json');

function nowIso() {
  return new Date().toISOString();
}

async function listForUser(userId, { month, year } = {}) {
  const all = readArray(BUDGETS_FILE);
  return all
    .filter(b => b.user === userId)
    .filter(b => (month ? b.month === Number(month) : true))
    .filter(b => (year ? b.year === Number(year) : true));
}

async function upsertForUser(userId, input) {
  const all = readArray(BUDGETS_FILE);
  const month = Number(input.month);
  const year = Number(input.year);

  const idx = all.findIndex(b => b.user === userId && b.category === input.category && b.month === month && b.year === year);
  const record = {
    _id: idx === -1 ? `${Date.now()}_${Math.random().toString(16).slice(2)}` : all[idx]._id,
    user: userId,
    category: input.category,
    limit: Number(input.limit),
    month,
    year,
    updatedAt: nowIso(),
    createdAt: idx === -1 ? nowIso() : all[idx].createdAt
  };

  if (idx === -1) all.push(record);
  else all[idx] = record;

  writeArray(BUDGETS_FILE, all);
  return record;
}

async function deleteForUser(userId, id) {
  const all = readArray(BUDGETS_FILE);
  const idx = all.findIndex(b => b._id === id);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  if (all[idx].user !== userId) return { ok: false, reason: 'not_authorized' };
  all.splice(idx, 1);
  writeArray(BUDGETS_FILE, all);
  return { ok: true };
}

module.exports = {
  listForUser,
  upsertForUser,
  deleteForUser
};
