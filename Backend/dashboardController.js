const runtime = require('../config/runtime');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const JsonTransactions = require('../services/jsonTransactionService');
const JsonBudgets = require('../services/jsonBudgetService');
const JsonNotifications = require('../services/jsonNotificationService');
const Notification = require('../models/Notification');

function currentMonthYear() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function isSameMonth(d, month, year) {
  return d.getFullYear() === year && (d.getMonth() + 1) === month;
}

async function createNotification(userId, type, message) {
  if (runtime.storage.mongoConnected) {
    const existing = await Notification.findOne({ user: userId, type, message });
    if (existing) return existing;
    return Notification.create({ user: userId, type, message });
  }

  const existingList = await JsonNotifications.listForUser(userId, { unreadOnly: false });
  const existing = existingList.find(n => n.type === type && n.message === message);
  if (existing) return existing;
  return JsonNotifications.createForUser(userId, { type, message });
}

// GET /api/dashboard/summary
exports.getSummary = async (req, res) => {
  try {
    const { month, year } = currentMonthYear();

    const txs = runtime.storage.mongoConnected
      ? await Transaction.find({ user: req.user.id }).sort({ date: -1 })
      : await JsonTransactions.listByUserId(req.user.id);

    const incomeTotal = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expenseTotal = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const balance = incomeTotal - expenseTotal;

    const monthExpenses = txs
      .filter(t => t.type === 'expense')
      .filter(t => isSameMonth(new Date(t.date), month, year));

    const expenseByCategory = monthExpenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {});

    const budgets = runtime.storage.mongoConnected
      ? await Budget.find({ user: req.user.id, month, year })
      : await JsonBudgets.listForUser(req.user.id, { month, year });

    const budgetStatuses = budgets.map(b => {
      const used = expenseByCategory[b.category] || 0;
      const pct = b.limit > 0 ? (used / b.limit) * 100 : 0;
      return {
        ...b,
        used,
        percentUsed: Math.round(pct)
      };
    });

    // Budget alert notifications (simple + de-duped by day/category/threshold)
    const todayKey = new Date().toISOString().slice(0, 10);
    for (const st of budgetStatuses) {
      if (!st.limit || st.limit <= 0) continue;

      if (st.percentUsed >= 100) {
        await createNotification(req.user.id, 'budget_exceeded', `[${todayKey}] Budget exceeded for ${st.category}: ${st.used.toFixed(2)} / ${st.limit.toFixed(2)}`);
      } else if (st.percentUsed >= 80) {
        await createNotification(req.user.id, 'budget_warning', `[${todayKey}] Budget at ${st.percentUsed}% for ${st.category}: ${st.used.toFixed(2)} / ${st.limit.toFixed(2)}`);
      }
    }

    res.json({
      incomeTotal,
      expenseTotal,
      balance,
      month,
      year,
      budgetStatuses
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
