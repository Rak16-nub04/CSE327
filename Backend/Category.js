const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Null means global default category
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  color: {
    type: String,
    default: '#cccccc'
  },
  icon: {
    type: String,
    default: 'fa-tag'
  }
});

module.exports = mongoose.model('Category', categorySchema);
