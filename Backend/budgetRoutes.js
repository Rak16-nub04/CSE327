const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getBudgets, upsertBudget, deleteBudget } = require('../controllers/budgetController');

router.get('/', protect, getBudgets);
router.post('/', protect, upsertBudget);
router.delete('/:id', protect, deleteBudget);

module.exports = router;
