const express = require('express');
const router = express.Router();
const {
  addExpense,
  getExpenses
} = require('../controllers/expenseController');

router.post('/', addExpense);
router.get('/', getExpenses);

module.exports = router;
