const Transaction = require('../models/Transaction');
const runtime = require('../config/runtime');
const JsonTransactions = require('../services/jsonTransactionService');

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseNumber(value) {
  if (typeof value === 'undefined' || value === null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const {
      type,
      category,
      q,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sort
    } = req.query;

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const min = parseNumber(minAmount);
    const max = parseNumber(maxAmount);
    const sortKey = typeof sort === 'string' ? sort : '-date';

    if (type && type !== 'income' && type !== 'expense') {
      return res.status(400).json({ message: "type must be 'income' or 'expense'" });
    }

    if (runtime.storage.mongoConnected) {
      const query = { user: req.user.id };
      if (type) query.type = type;
      if (category) query.category = category;
      if (start || end) {
        query.date = {};
        if (start) query.date.$gte = start;
        if (end) query.date.$lte = end;
      }
      if (min !== null || max !== null) {
        query.amount = {};
        if (min !== null) query.amount.$gte = min;
        if (max !== null) query.amount.$lte = max;
      }
      if (q) {
        query.$or = [
          { title: { $regex: q, $options: 'i' } },
          { category: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ];
      }

      const sortObj = {};
      const sortField = sortKey.startsWith('-') ? sortKey.slice(1) : sortKey;
      sortObj[sortField] = sortKey.startsWith('-') ? -1 : 1;
      const transactions = await Transaction.find(query).sort(sortObj);
      return res.json(transactions);
    }

    let transactions = await JsonTransactions.listByUserId(req.user.id);
    if (type) transactions = transactions.filter(t => t.type === type);
    if (category) transactions = transactions.filter(t => t.category === category);
    if (start || end) {
      transactions = transactions.filter(t => {
        const d = new Date(t.date);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }
    if (min !== null || max !== null) {
      transactions = transactions.filter(t => {
        const a = Number(t.amount);
        if (min !== null && a < min) return false;
        if (max !== null && a > max) return false;
        return true;
      });
    }
    if (q) {
      const qLower = String(q).toLowerCase();
      transactions = transactions.filter(t => {
        return (
          String(t.title || '').toLowerCase().includes(qLower) ||
          String(t.category || '').toLowerCase().includes(qLower) ||
          String(t.description || '').toLowerCase().includes(qLower)
        );
      });
    }

    const desc = sortKey.startsWith('-');
    const field = desc ? sortKey.slice(1) : sortKey;
    transactions.sort((a, b) => {
      const av = field === 'date' ? new Date(a.date).getTime() : Number.isFinite(Number(a[field])) ? Number(a[field]) : String(a[field] ?? '');
      const bv = field === 'date' ? new Date(b.date).getTime() : Number.isFinite(Number(b[field])) ? Number(b[field]) : String(b[field] ?? '');
      if (av < bv) return desc ? 1 : -1;
      if (av > bv) return desc ? -1 : 1;
      return 0;
    });

    return res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add transaction
// @route   POST /api/transactions
// @access  Private
exports.addTransaction = async (req, res) => {
  try {
    const { title, amount, category, type, date } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ message: 'title is required' });
    }
    if (typeof amount === 'undefined' || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }
    if (!category || typeof category !== 'string') {
      return res.status(400).json({ message: 'category is required' });
    }
    if (type !== 'income' && type !== 'expense') {
      return res.status(400).json({ message: "type must be 'income' or 'expense'" });
    }

    if (runtime.storage.mongoConnected) {
      const transaction = await Transaction.create({
        title,
        amount,
        category,
        type,
        date,
        user: req.user.id
      });

      res.status(201).json(transaction);
      return;
    }

    const transaction = await JsonTransactions.createForUserId(req.user.id, {
      title,
      amount,
      category,
      type,
      date
    });
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
exports.updateTransaction = async (req, res) => {
  try {
    const { title, amount, category, type, date, description, paymentMethod } = req.body;

    if (typeof title !== 'undefined' && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({ message: 'title must be a non-empty string' });
    }
    if (typeof amount !== 'undefined' && (Number.isNaN(Number(amount)) || Number(amount) <= 0)) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }
    if (typeof category !== 'undefined' && (typeof category !== 'string' || !category.trim())) {
      return res.status(400).json({ message: 'category must be a non-empty string' });
    }
    if (typeof type !== 'undefined' && type !== 'income' && type !== 'expense') {
      return res.status(400).json({ message: "type must be 'income' or 'expense'" });
    }

    if (runtime.storage.mongoConnected) {
      const tx = await Transaction.findById(req.params.id);
      if (!tx) return res.status(404).json({ message: 'Transaction not found' });
      if (tx.user.toString() !== req.user.id) return res.status(401).json({ message: 'User not authorized' });

      if (typeof title === 'string') tx.title = title;
      if (typeof amount !== 'undefined') tx.amount = Number(amount);
      if (typeof category === 'string') tx.category = category;
      if (typeof type === 'string') tx.type = type;
      if (typeof date !== 'undefined') tx.date = new Date(date);
      if (typeof description !== 'undefined') tx.description = description;
      if (typeof paymentMethod !== 'undefined') tx.paymentMethod = paymentMethod;

      const saved = await tx.save();
      return res.json(saved);
    }

    const result = await JsonTransactions.updateForUserId(req.user.id, req.params.id, {
      title,
      amount,
      category,
      type,
      date,
      description,
      paymentMethod
    });
    if (!result.ok) {
      if (result.reason === 'not_found') return res.status(404).json({ message: 'Transaction not found' });
      if (result.reason === 'not_authorized') return res.status(401).json({ message: 'User not authorized' });
      return res.status(400).json({ message: 'Failed to update transaction' });
    }
    return res.json(result.transaction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
exports.deleteTransaction = async (req, res) => {
  try {
    if (runtime.storage.mongoConnected) {
      const transaction = await Transaction.findById(req.params.id);

      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      // Check for user
      if (transaction.user.toString() !== req.user.id) {
        return res.status(401).json({ message: 'User not authorized' });
      }

      await transaction.deleteOne();
      res.json({ id: req.params.id });
      return;
    }

    const result = await JsonTransactions.deleteForUserId(req.user.id, req.params.id);
    if (!result.ok) {
      if (result.reason === 'not_found') return res.status(404).json({ message: 'Transaction not found' });
      if (result.reason === 'not_authorized') return res.status(401).json({ message: 'User not authorized' });
      return res.status(400).json({ message: 'Failed to delete transaction' });
    }

    res.json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
