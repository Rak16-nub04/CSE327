const runtime = require('../config/runtime');
const Transaction = require('../models/Transaction');
const JsonTransactions = require('../services/jsonTransactionService');

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function weekKey(d) {
  // ISO-ish week key: YYYY-Www (simple week starting Monday approximation)
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function withinRange(d, start, end) {
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

async function loadUserTransactions(userId) {
  if (runtime.storage.mongoConnected) {
    return Transaction.find({ user: userId }).sort({ date: 1 });
  }
  return JsonTransactions.listByUserId(userId);
}

// GET /api/reports?startDate=&endDate=&type=expense|income
exports.getReports = async (req, res) => {
  try {
    const startDate = parseDate(req.query.startDate);
    const endDate = parseDate(req.query.endDate);
    const type = req.query.type;
    if (type && type !== 'income' && type !== 'expense') {
      return res.status(400).json({ message: "type must be 'income' or 'expense'" });
    }

    const txs = await loadUserTransactions(req.user.id);

    const filtered = txs
      .map(t => ({
        ...t,
        date: new Date(t.date)
      }))
      .filter(t => (type ? t.type === type : true))
      .filter(t => withinRange(t.date, startDate, endDate));

    // Pie: expenses by category
    const expenseByCategory = {};
    for (const t of filtered) {
      if (t.type !== 'expense') continue;
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + Number(t.amount);
    }

    // Bar: monthly expenses total
    const monthlyExpenses = {};
    const monthlyIncome = {};
    for (const t of filtered) {
      const key = monthKey(t.date);
      if (t.type === 'expense') {
        monthlyExpenses[key] = (monthlyExpenses[key] || 0) + Number(t.amount);
      } else if (t.type === 'income') {
        monthlyIncome[key] = (monthlyIncome[key] || 0) + Number(t.amount);
      }
    }

    // Weekly: expenses total
    const weeklyExpenses = {};
    for (const t of filtered) {
      if (t.type !== 'expense') continue;
      const key = weekKey(t.date);
      weeklyExpenses[key] = (weeklyExpenses[key] || 0) + Number(t.amount);
    }

    // Line: daily spending trend (expenses)
    const dailyExpenses = {};
    for (const t of filtered) {
      if (t.type !== 'expense') continue;
      const key = t.date.toISOString().slice(0, 10);
      dailyExpenses[key] = (dailyExpenses[key] || 0) + Number(t.amount);
    }

    res.json({
      expenseByCategory,
      monthlyExpenses,
      monthlyIncome,
      weeklyExpenses,
      dailyExpenses,
      count: filtered.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
