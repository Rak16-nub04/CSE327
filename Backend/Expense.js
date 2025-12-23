const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/expenses.json');

class Expense {
  static getAll() {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  }

  static create(newExpense) {
    const expenses = this.getAll();
    const expenseWithId = {
      _id: Date.now().toString(), // Simple ID generation
      date: new Date(),
      category: 'General',
      type: 'expense',
      ...newExpense
    };
    expenses.push(expenseWithId);
    fs.writeFileSync(DATA_FILE, JSON.stringify(expenses, null, 2));
    return expenseWithId;
  }
  
  // Method to satisfy the controller's expectation of a Promise-like interface if needed,
  // but since we are replacing the controller logic too, we can keep it synchronous or make it async.
  // For simplicity with existing controller structure, let's wrap in Promises in the model wrapper below.
}

// Wrapper to mimic Mongoose model behavior for minimal controller changes
module.exports = {
  find: () => Promise.resolve(Expense.getAll()),
  create: (data) => Promise.resolve(Expense.create(data))
};
