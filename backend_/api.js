const API_URL = (() => {
    // Prefer same-origin when frontend is served by the backend.
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return `${window.location.origin}/api`;
    }
    return 'http://localhost:5000/api';
})();

function getAuthHeaders() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.token) return null;
    return { 'Authorization': `Bearer ${user.token}` };
}

async function readJsonOrNull(response) {
    return await response.json().catch(() => null);
}

function handleAuthFailure(status) {
    if (status === 401) {
        localStorage.removeItem('user');
    }
}

const api = {
    // Auth
    async login(email, password) {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        return data;
    },

    async register(username, email, password) {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        return data;
    },

    // Profile
    async getProfile() {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/auth/profile`, { headers });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to load profile');
        }
        return data;
    },

    async updateProfile(patch) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(patch || {})
        });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to update profile');
        }
        return data;
    },

    async changePassword(currentPassword, newPassword) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/auth/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to change password');
        }
        return data;
    },

    // Expenses / Transactions
    async getExpenses() {
        // Backwards-compatible alias
        return this.getTransactions();
    },

    async getTransactions(params) {
        const headers = getAuthHeaders();
        if (!headers) return [];

        const url = new URL(`${API_URL}/transactions`);
        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([k, v]) => {
                if (typeof v !== 'undefined' && v !== null && v !== '') url.searchParams.set(k, v);
            });
        }

        const response = await fetch(url.toString(), { headers });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to load transactions');
        }
        return data || [];
    },

    async addExpense(transaction) {
        // Backwards-compatible alias
        return this.addTransaction(transaction);
    },

    async addTransaction(transaction) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');

        const response = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify(transaction)
        });

        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to add transaction');
        }
        return data;

    },

    async updateTransaction(id, patch) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(patch || {})
        });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to update transaction');
        }
        return data;
    },

    async deleteTransaction(id) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'DELETE',
            headers
        });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to delete transaction');
        }
        return data;
    },

    // Categories
    async getCategories(type) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const url = new URL(`${API_URL}/categories`);
        if (type) url.searchParams.set('type', type);
        const response = await fetch(url.toString(), { headers });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to load categories');
        }
        return data || [];
    },

    async createCategory(category) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(category || {})
        });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to create category');
        }
        return data;
    },

    // Budgets
    async getBudgets(month, year) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const url = new URL(`${API_URL}/budgets`);
        if (month) url.searchParams.set('month', month);
        if (year) url.searchParams.set('year', year);
        const response = await fetch(url.toString(), { headers });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to load budgets');
        }
        return data || [];
    },

    async upsertBudget(category, limit, month, year) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/budgets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ category, limit, month, year })
        });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to save budget');
        }
        return data;
    },

    // Dashboard/Reports
    async getDashboardSummary() {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/dashboard/summary`, { headers });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to load dashboard');
        }
        return data;
    },

    async getReports(params) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const url = new URL(`${API_URL}/reports`);
        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([k, v]) => {
                if (typeof v !== 'undefined' && v !== null && v !== '') url.searchParams.set(k, v);
            });
        }
        const response = await fetch(url.toString(), { headers });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to load reports');
        }
        return data;
    },

    // Settings
    async getSettings() {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/settings`, { headers });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to load settings');
        }
        return data || {};
    },

    async updateSettings(patch) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(patch || {})
        });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to update settings');
        }
        return data || {};
    },

    // Notifications
    async getNotifications(unreadOnly) {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const url = new URL(`${API_URL}/notifications`);
        if (unreadOnly) url.searchParams.set('unreadOnly', 'true');
        const response = await fetch(url.toString(), { headers });
        const data = await readJsonOrNull(response);
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error((data && data.message) || 'Failed to load notifications');
        }
        return data || [];
    },

    // Export
    async exportTransactionsCsv() {
        const headers = getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/export/transactions.csv`, { headers });
        if (!response.ok) {
            handleAuthFailure(response.status);
            throw new Error('Failed to export CSV');
        }
        return await response.blob();
    }
};
