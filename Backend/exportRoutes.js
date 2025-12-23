const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { exportTransactionsCsv } = require('../controllers/exportController');

router.get('/transactions.csv', protect, exportTransactionsCsv);

module.exports = router;
