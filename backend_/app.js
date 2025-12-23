document.addEventListener('DOMContentLoaded', () => {
    const transactionForm = document.getElementById('transaction-form');
    const transactionList = document.getElementById('transaction-list');
    const typeRadios = document.querySelectorAll('input[name="type"]');
    const categorySelect = document.getElementById('category');
    const paymentMethodSelect = document.getElementById('paymentMethod');
    
    // Dashboard Elements
    const totalIncomeEl = document.getElementById('total-income');
    const totalExpensesEl = document.getElementById('total-expenses');
    const totalBalanceEl = document.getElementById('total-balance');

    // Budget Elements
    const budgetInput = document.getElementById('budget-limit');
    const setBudgetBtn = document.getElementById('set-budget-btn');
    const budgetStatus = document.getElementById('budget-status');
    const budgetDisplay = document.getElementById('budget-display');
    const budgetProgress = document.getElementById('budget-progress');

    const budgetCategorySelect = document.getElementById('budget-category');
    const budgetList = document.getElementById('budget-list');

    const reportStart = document.getElementById('report-start');
    const reportEnd = document.getElementById('report-end');
    const refreshReportsBtn = document.getElementById('refresh-reports');
    const exportCsvBtn = document.getElementById('export-csv');

    const currencySelect = document.getElementById('currency');
    const themeSelect = document.getElementById('theme');
    const saveSettingsBtn = document.getElementById('save-settings');

    const notificationsEl = document.getElementById('notifications');
    const notificationsCountEl = document.getElementById('notifications-count');

    let settings = { currency: '$', theme: 'light' };
    let categories = { expense: [], income: [] };

    // Initialize
    (async () => {
        try {
            await loadSettings();
            await loadCategories();
            populateCategories('expense');
            populateBudgetCategories();
            await loadTransactions();
            await loadDashboardSummary();
            await loadReports();
            await loadNotifications();
        } catch (e) {
            // If auth expired, api.js clears user and auth.js redirects.
            console.error(e);
        }
    })();

    // Toggle Categories based on Type
    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            populateCategories(e.target.value);
        });
    });

    function populateCategories(type) {
        categorySelect.innerHTML = '';
        (categories[type] || []).forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name || cat;
            option.textContent = cat.name || cat;
            categorySelect.appendChild(option);
        });
    }

    function populateBudgetCategories() {
        if (!budgetCategorySelect) return;
        budgetCategorySelect.innerHTML = '';
        (categories.expense || []).forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name || cat;
            option.textContent = cat.name || cat;
            budgetCategorySelect.appendChild(option);
        });
    }

    // Handle form submission
    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('title').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const type = document.querySelector('input[name="type"]:checked').value;
        const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'Cash';

        if (title && amount > 0) {
            try {
                const newTransaction = { title, amount, category, type, paymentMethod };
                await api.addTransaction(newTransaction);
                
                transactionForm.reset();
                // Reset category to correct type default
                populateCategories(document.querySelector('input[name="type"]:checked').value);
                
                await loadTransactions();
                await loadDashboardSummary();
                await loadReports();
                await loadNotifications();
            } catch (error) {
                alert(error.message || 'Failed to add transaction.');
            }
        }
    });

    async function loadTransactions() {
        const transactions = await api.getTransactions({ sort: '-date' });
        renderTransactions(transactions);
        updateDashboard(transactions);
        if (typeof renderExpenseChart === 'function') {
            renderExpenseChart(transactions);
        }
    }

    function renderTransactions(transactions) {
        transactionList.innerHTML = '';
        
        const sorted = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        sorted.forEach(t => {
            const li = document.createElement('li');
            li.className = 'transaction-item';
            
            const date = new Date(t.date).toLocaleDateString();
            const amountClass = t.type === 'income' ? 'amount-income' : 'amount-expense';
            const sign = t.type === 'income' ? '+' : '-';

            li.innerHTML = `
                <div class="transaction-info">
                    <span class="transaction-title">${t.title} <span class="badge">${t.category}</span></span>
                    <span class="transaction-meta">${date}</span>
                </div>
                <div class="transaction-amount ${amountClass}">${sign}${settings.currency || '$'}${Number(t.amount).toFixed(2)}</div>
            `;
            transactionList.appendChild(li);
        });
    }

    function updateDashboard(transactions) {
        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const expenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const balance = income - expenses;

        totalIncomeEl.textContent = `${settings.currency || '$'}${income.toFixed(2)}`;
        totalExpensesEl.textContent = `${settings.currency || '$'}${expenses.toFixed(2)}`;
        totalBalanceEl.textContent = `${settings.currency || '$'}${balance.toFixed(2)}`;
    }

    // Budget Logic (category-wise, current month)
    if (setBudgetBtn) {
        setBudgetBtn.addEventListener('click', async () => {
            const amount = parseFloat(budgetInput.value);
            const category = budgetCategorySelect ? budgetCategorySelect.value : null;
            if (!category) return alert('Select a category');

            if (amount > 0) {
                try {
                    const now = new Date();
                    await api.upsertBudget(category, amount, now.getMonth() + 1, now.getFullYear());
                    await loadDashboardSummary();
                    await loadNotifications();
                    alert('Budget saved successfully!');
                } catch (e) {
                    alert(e.message || 'Failed to save budget');
                }
            }
        });
    }

    async function loadDashboardSummary() {
        try {
            const summary = await api.getDashboardSummary();
            if (Array.isArray(summary.budgetStatuses) && summary.budgetStatuses.length > 0) {
                const totalLimit = summary.budgetStatuses.reduce((s, b) => s + Number(b.limit || 0), 0);
                const totalUsed = summary.budgetStatuses.reduce((s, b) => s + Number(b.used || 0), 0);
                const percentage = totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;

                budgetDisplay.textContent = `Budget (category total): ${settings.currency || '$'}${totalLimit.toFixed(2)}`;
                budgetStatus.textContent = `${Math.round(percentage)}% Used`;
                budgetProgress.style.width = `${percentage}%`;

                // Render list
                if (budgetList) {
                    budgetList.innerHTML = '';
                    summary.budgetStatuses.forEach(b => {
                        const li = document.createElement('li');
                        li.className = 'budget-item';
                        li.textContent = `${b.category}: ${settings.currency || '$'}${Number(b.used).toFixed(2)} / ${settings.currency || '$'}${Number(b.limit).toFixed(2)} (${b.percentUsed}%)`;
                        budgetList.appendChild(li);
                    });
                }

            } else {
                budgetDisplay.textContent = 'No Budgets Set';
                budgetProgress.style.width = '0%';
                if (budgetList) budgetList.innerHTML = '';
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function loadReports() {
        if (!refreshReportsBtn) return;
        try {
            const params = {
                startDate: reportStart && reportStart.value ? reportStart.value : undefined,
                endDate: reportEnd && reportEnd.value ? reportEnd.value : undefined
            };
            const r = await api.getReports(params);
            if (typeof renderMonthlyExpensesChart === 'function') {
                renderMonthlyExpensesChart(r.monthlyExpenses || {}, r.monthlyIncome || {});
            }
            if (typeof renderDailyTrendChart === 'function') {
                renderDailyTrendChart(r.dailyExpenses || {});
            }
        } catch (e) {
            console.error(e);
        }
    }

    if (refreshReportsBtn) {
        refreshReportsBtn.addEventListener('click', async () => {
            await loadReports();
        });
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', async () => {
            try {
                const blob = await api.exportTransactionsCsv();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'transactions.csv';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            } catch (e) {
                alert(e.message || 'Export failed');
            }
        });
    }

    async function loadSettings() {
        try {
            settings = await api.getSettings();
            if (!settings || typeof settings !== 'object') settings = { currency: '$', theme: 'light' };
        } catch {
            settings = { currency: '$', theme: 'light' };
        }

        if (currencySelect && settings.currency) currencySelect.value = settings.currency;
        if (themeSelect && settings.theme) themeSelect.value = settings.theme;
        applyTheme(settings.theme);
        applyCurrencyLabel();
    }

    function applyCurrencyLabel() {
        const amountLabel = document.querySelector('label[for="amount"]');
        if (!amountLabel) return;
        const sym = (settings && settings.currency) ? settings.currency : '$';
        amountLabel.textContent = `Amount (${sym})`;
    }

    function applyTheme(theme) {
        document.body.classList.toggle('theme-dark', theme === 'dark');
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            try {
                const patch = {
                    currency: currencySelect ? currencySelect.value : '$',
                    theme: themeSelect ? themeSelect.value : 'light'
                };
                settings = await api.updateSettings(patch);
                applyTheme(settings.theme);
                applyCurrencyLabel();
                await loadTransactions();
                await loadDashboardSummary();
                await loadReports();
                alert('Settings saved');
            } catch (e) {
                alert(e.message || 'Failed to save settings');
            }
        });
    }

    async function loadCategories() {
        const expense = await api.getCategories('expense');
        const income = await api.getCategories('income');
        categories = { expense, income };
    }

    async function loadNotifications() {
        if (!notificationsEl || !notificationsCountEl) return;
        try {
            const notifications = await api.getNotifications(true);
            notificationsCountEl.textContent = String(notifications.length);
            notificationsEl.innerHTML = '';
            notifications.slice(0, 5).forEach(n => {
                const div = document.createElement('div');
                div.className = 'notification-item';
                div.textContent = n.message;
                notificationsEl.appendChild(div);
            });
        } catch (e) {
            console.error(e);
        }
    }
});
