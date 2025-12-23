const runtime = require('../config/runtime');
const Budget = require('../models/Budget');
const JsonBudgets = require('../services/jsonBudgetService');

function currentMonthYear() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

// GET /api/budgets?month=&year=
exports.getBudgets = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (runtime.storage.mongoConnected) {
      const q = { user: req.user.id };
      if (month) q.month = Number(month);
      if (year) q.year = Number(year);
      const budgets = await Budget.find(q).sort({ year: -1, month: -1, category: 1 });
      return res.json(budgets);
    }

    const budgets = await JsonBudgets.listForUser(req.user.id, { month, year });
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/budgets (upsert)
exports.upsertBudget = async (req, res) => {
  try {
    const { category, limit, month, year } = req.body;
    const fallback = currentMonthYear();

    if (!category || typeof category !== 'string') return res.status(400).json({ message: 'category is required' });
    if (typeof limit === 'undefined' || Number.isNaN(Number(limit)) || Number(limit) <= 0) {
      return res.status(400).json({ message: 'limit must be a positive number' });
    }

    const m = month ? Number(month) : fallback.month;
    const y = year ? Number(year) : fallback.year;
    if (m < 1 || m > 12) return res.status(400).json({ message: 'month must be 1-12' });
    if (!y || y < 2000) return res.status(400).json({ message: 'year must be valid' });

    if (runtime.storage.mongoConnected) {
      const updated = await Budget.findOneAndUpdate(
        { user: req.user.id, category, month: m, year: y },
        { $set: { limit: Number(limit) } },
        { new: true, upsert: true }
      );
      return res.status(201).json(updated);
    }

    const record = await JsonBudgets.upsertForUser(req.user.id, { category, limit, month: m, year: y });
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE /api/budgets/:id
exports.deleteBudget = async (req, res) => {
  try {
    if (runtime.storage.mongoConnected) {
      const budget = await Budget.findById(req.params.id);
      if (!budget) return res.status(404).json({ message: 'Budget not found' });
      if (budget.user.toString() !== req.user.id) return res.status(401).json({ message: 'User not authorized' });
      await budget.deleteOne();
      return res.json({ id: req.params.id });
    }

    const result = await JsonBudgets.deleteForUser(req.user.id, req.params.id);
    if (!result.ok) {
      if (result.reason === 'not_found') return res.status(404).json({ message: 'Budget not found' });
      if (result.reason === 'not_authorized') return res.status(401).json({ message: 'User not authorized' });
      return res.status(400).json({ message: 'Failed to delete budget' });
    }

    res.json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
