const runtime = require('../config/runtime');
const Transaction = require('../models/Transaction');
const JsonTransactions = require('../services/jsonTransactionService');

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// GET /api/export/transactions.csv
exports.exportTransactionsCsv = async (req, res) => {
  try {
    const txs = runtime.storage.mongoConnected
      ? await Transaction.find({ user: req.user.id }).sort({ date: -1 })
      : await JsonTransactions.listByUserId(req.user.id);

    const header = ['date', 'type', 'title', 'category', 'amount', 'paymentMethod', 'description'];
    const rows = txs.map(t => [
      new Date(t.date).toISOString(),
      t.type,
      t.title,
      t.category,
      Number(t.amount),
      t.paymentMethod || '',
      t.description || ''
    ]);

    const csv = [header.join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
