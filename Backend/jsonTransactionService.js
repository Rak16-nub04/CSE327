const path = require('path');
const { readArray, writeArray } = require('../storage/jsonDb');

const TRANSACTIONS_FILE = path.join(__dirname, '../data/transactions.json');

function normalizeDate(value) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

async function listByUserId(userId) {
  const all = readArray(TRANSACTIONS_FILE);
  return all
    .filter(t => t.user === userId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function createForUserId(userId, input) {
  const all = readArray(TRANSACTIONS_FILE);

  const tx = {
    _id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    user: userId,
    title: input.title,
    amount: Number(input.amount),
    category: input.category,
    type: input.type,
    date: normalizeDate(input.date),
    description: input.description,
    paymentMethod: input.paymentMethod || 'Cash'
  };

  all.push(tx);
  writeArray(TRANSACTIONS_FILE, all);
  return tx;
}

async function deleteForUserId(userId, id) {
  const all = readArray(TRANSACTIONS_FILE);
  const idx = all.findIndex(t => t._id === id);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  if (all[idx].user !== userId) return { ok: false, reason: 'not_authorized' };
  all.splice(idx, 1);
  writeArray(TRANSACTIONS_FILE, all);
  return { ok: true };
}

async function updateForUserId(userId, id, patch) {
  const all = readArray(TRANSACTIONS_FILE);
  const idx = all.findIndex(t => t._id === id);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  if (all[idx].user !== userId) return { ok: false, reason: 'not_authorized' };

  const current = all[idx];
  const updated = {
    ...current,
    title: typeof patch.title === 'string' ? patch.title : current.title,
    amount: typeof patch.amount !== 'undefined' ? Number(patch.amount) : current.amount,
    category: typeof patch.category === 'string' ? patch.category : current.category,
    type: (patch.type === 'income' || patch.type === 'expense') ? patch.type : current.type,
    date: typeof patch.date !== 'undefined' ? normalizeDate(patch.date) : current.date,
    description: typeof patch.description === 'string' ? patch.description : current.description,
    paymentMethod: typeof patch.paymentMethod === 'string' ? patch.paymentMethod : current.paymentMethod,
    updatedAt: new Date().toISOString()
  };

  all[idx] = updated;
  writeArray(TRANSACTIONS_FILE, all);
  return { ok: true, transaction: updated };
}

module.exports = {
  listByUserId,
  createForUserId,
  deleteForUserId,
  updateForUserId
};
