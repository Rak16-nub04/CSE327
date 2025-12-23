const path = require('path');
const bcrypt = require('bcryptjs');
const { readArray, writeArray } = require('../storage/jsonDb');

const USERS_FILE = path.join(__dirname, '../data/users.json');

function safeUser(user) {
  if (!user) return null;
  // Return without password hash
  const { password, ...rest } = user;
  return rest;
}

async function findByEmail(email) {
  const users = readArray(USERS_FILE);
  return users.find(u => (u.email || '').toLowerCase() === (email || '').toLowerCase()) || null;
}

async function findById(id) {
  const users = readArray(USERS_FILE);
  return users.find(u => u._id === id) || null;
}

async function updateUser(userId, patch) {
  const users = readArray(USERS_FILE);
  const idx = users.findIndex(u => u._id === userId);
  if (idx === -1) return { ok: false, reason: 'not_found' };

  // Prevent email collisions
  if (typeof patch.email === 'string') {
    const emailLower = patch.email.toLowerCase();
    const conflict = users.find(u => u._id !== userId && (u.email || '').toLowerCase() === emailLower);
    if (conflict) return { ok: false, reason: 'email_in_use' };
  }

  // Prevent username collisions
  if (typeof patch.username === 'string') {
    const conflict = users.find(u => u._id !== userId && (u.username || '').toLowerCase() === patch.username.toLowerCase());
    if (conflict) return { ok: false, reason: 'username_in_use' };
  }

  const current = users[idx];
  const updated = {
    ...current,
    username: typeof patch.username === 'string' ? patch.username : current.username,
    email: typeof patch.email === 'string' ? patch.email.toLowerCase() : current.email,
    settings: {
      ...(current.settings || {}),
      ...(patch.settings || {})
    },
    updatedAt: new Date().toISOString()
  };

  users[idx] = updated;
  writeArray(USERS_FILE, users);
  return { ok: true, user: updated };
}

async function setPassword(userId, newPassword) {
  const users = readArray(USERS_FILE);
  const idx = users.findIndex(u => u._id === userId);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  users[idx] = {
    ...users[idx],
    password: await bcrypt.hash(newPassword, 10),
    updatedAt: new Date().toISOString()
  };
  writeArray(USERS_FILE, users);
  return { ok: true };
}

async function createUser({ username, email, password }) {
  const users = readArray(USERS_FILE);

  const now = new Date();
  const user = {
    _id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    username,
    email: (email || '').toLowerCase(),
    password: await bcrypt.hash(password, 10),
    createdAt: now.toISOString(),
    settings: {
      currency: '$',
      theme: 'light'
    }
  };

  users.push(user);
  writeArray(USERS_FILE, users);
  return user;
}

async function validatePassword(user, enteredPassword) {
  return bcrypt.compare(enteredPassword, user.password);
}

module.exports = {
  safeUser,
  findByEmail,
  findById,
  createUser,
  validatePassword,
  updateUser,
  setPassword
};
