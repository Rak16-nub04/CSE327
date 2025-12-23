let expenseChartInstance = null;
let monthlyChartInstance = null;
let trendChartInstance = null;

function renderExpenseChart(transactions) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    // Filter only expenses for the pie chart
    const expenses = transactions.filter(t => t.type === 'expense');
    
    // Group by category
    const categoryTotals = expenses.reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
        return acc;
    }, {});

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const colors = [
        '#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c'
    ];

    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }

    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: 'Expense Breakdown'
                }
            }
        }
    });
}

function renderMonthlyExpensesChart(monthlyExpenses, monthlyIncome) {
    const el = document.getElementById('monthlyChart');
    if (!el) return;
    const ctx = el.getContext('2d');

    const exp = monthlyExpenses || {};
    const inc = monthlyIncome || {};
    const labels = Array.from(new Set([...Object.keys(exp), ...Object.keys(inc)])).sort();
    const expData = labels.map(k => exp[k] || 0);
    const incData = labels.map(k => inc[k] || 0);

    if (monthlyChartInstance) {
        monthlyChartInstance.destroy();
    }

    monthlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Income',
                    data: incData,
                    backgroundColor: '#2ecc71'
                },
                {
                    label: 'Expenses',
                    data: expData,
                    backgroundColor: '#e74c3c'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: 'Monthly Income vs Expenses' }
            }
        }
    });
}

function renderDailyTrendChart(dailyExpenses) {
    const el = document.getElementById('trendChart');
    if (!el) return;
    const ctx = el.getContext('2d');

    const labels = Object.keys(dailyExpenses || {}).sort();
    const data = labels.map(k => dailyExpenses[k]);

    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Daily Expenses',
                data,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Expense Trend' }
            }
        }
    });
}
