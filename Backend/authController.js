const jwt = require('jsonwebtoken');
const runtime = require('../config/runtime');
const JsonUsers = require('../services/jsonUserService');
const User = require('../models/User');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'username, email and password are required' });
  }

  try {
    let user;

    if (runtime.storage.mongoConnected) {
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
      }

      user = await User.create({
        username,
        email,
        password,
      });
    } else {
      const existing = await JsonUsers.findByEmail(email);
      if (existing) {
        return res.status(400).json({ message: 'User already exists' });
      }

      user = await JsonUsers.createUser({ username, email, password });
    }

    if (user) {
      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  try {
    let user;
    let passwordOk = false;

    if (runtime.storage.mongoConnected) {
      user = await User.findOne({ email });
      passwordOk = !!(user && (await user.matchPassword(password)));
    } else {
      user = await JsonUsers.findByEmail(email);
      passwordOk = !!(user && (await JsonUsers.validatePassword(user, password)));
    }

    if (user && passwordOk) {
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    if (runtime.storage.mongoConnected) {
      const user = await User.findById(req.user.id).select('-password');
      if (user) {
        res.json(user);
      } else {
        res.status(404).json({ message: 'User not found' });
      }
      return;
    }

    const user = await JsonUsers.findById(req.user.id);
    if (user) {
      res.json(JsonUsers.safeUser(user));
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
  try {
    const { username, email, settings } = req.body;

    if (typeof username !== 'undefined' && (typeof username !== 'string' || !username.trim())) {
      return res.status(400).json({ message: 'username must be a non-empty string' });
    }
    if (typeof email !== 'undefined' && (typeof email !== 'string' || !email.trim())) {
      return res.status(400).json({ message: 'email must be a non-empty string' });
    }
    if (typeof settings !== 'undefined' && settings !== null && typeof settings !== 'object') {
      return res.status(400).json({ message: 'settings must be an object' });
    }

    if (runtime.storage.mongoConnected) {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (typeof username === 'string') user.username = username;
      if (typeof email === 'string') user.email = email;
      if (settings && typeof settings === 'object') {
        user.settings = { ...(user.settings || {}), ...settings };
      }
      const saved = await user.save();
      return res.json({
        _id: saved._id,
        username: saved.username,
        email: saved.email,
        settings: saved.settings
      });
    }

    const result = await JsonUsers.updateUser(req.user.id, { username, email, settings });
    if (!result.ok) {
      if (result.reason === 'email_in_use') return res.status(400).json({ message: 'Email already in use' });
      if (result.reason === 'username_in_use') return res.status(400).json({ message: 'Username already in use' });
      return res.status(404).json({ message: 'User not found' });
    }

    const u = result.user;
    return res.json({ _id: u._id, username: u.username, email: u.email, settings: u.settings });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ message: 'newPassword must be at least 6 characters' });
    }

    if (runtime.storage.mongoConnected) {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const ok = await user.matchPassword(currentPassword);
      if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });
      user.password = newPassword;
      await user.save();
      return res.json({ ok: true });
    }

    const user = await JsonUsers.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const ok = await JsonUsers.validatePassword(user, currentPassword);
    if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });
    await JsonUsers.setPassword(req.user.id, newPassword);
    return res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
