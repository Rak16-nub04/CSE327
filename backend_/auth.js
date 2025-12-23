document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const logoutBtn = document.getElementById('logout-btn');

    // Handle Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const data = await api.login(email, password);
                localStorage.setItem('user', JSON.stringify(data));
                window.location.href = 'index.html';
            } catch (error) {
                alert(error.message || 'Login failed');
            }
        });
    }

    // Handle Register
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const data = await api.register(username, email, password);
                localStorage.setItem('user', JSON.stringify(data));
                window.location.href = 'index.html';
            } catch (error) {
                alert(error.message || 'Registration failed');
            }
        });
    }

    // Handle Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }

    // Protect Routes (Redirect to login if not authenticated)
    if (!document.body.classList.contains('auth-body')) {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.token) {
            window.location.href = 'login.html';
        }
    }
});
