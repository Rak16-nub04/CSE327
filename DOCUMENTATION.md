# Personal Finance Tracker for Students — Project Documentation

This workspace is a portfolio-grade full‑stack finance tracker designed for students to track income and expenses, set budgets, and view reports.

## 1) Feature List (Implemented)

- Authentication: register, login, logout (JWT)
- User profile: view profile, update profile, change password
- Transactions: add, edit, delete, view (income/expense)
- Categories: default categories + custom user categories (color + icon fields)
- Budgets: category-wise monthly budgets, usage tracking, alerts
- Dashboard: totals (income, expenses, balance), budget progress
- Reports: category spend (pie), monthly expenses (bar), daily expense trend (line)
- Reports: weekly expense totals, monthly income vs expense totals
- Notifications: budget warning/exceeded alerts list
- Search/filter/sort: query params on transactions
- Settings: currency symbol + theme (light/dark)
- Export: CSV export of transactions

## 2) System Architecture

### Frontend
- Static HTML/CSS/Vanilla JS served by the backend from `frontend/`.
- Main modules:
  - `frontend/js/api.js`: REST client + JWT header handling
  - `frontend/js/auth.js`: login/register/logout + route protection
  - `frontend/js/app.js`: dashboard logic
  - `frontend/js/charts.js`: Chart.js visualizations

### Backend
- Express REST API served from `backend/server.js`.
- MVC-ish layout:
  - `backend/routes/*`: REST routes
  - `backend/controllers/*`: request handlers
  - `backend/models/*`: Mongoose models (when MongoDB is available)
  - `backend/services/*`: JSON fallback storage, defaults

### Database
- Primary: MongoDB (Atlas/local) via Mongoose.
- Fallback: JSON file storage in `backend/data/*.json`.
  - This keeps the app usable even when MongoDB TLS/whitelisting blocks connectivity.

## 3) REST API Design (Key Endpoints)

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `PUT /api/auth/profile`
- `PUT /api/auth/password`

### Transactions (Income + Expenses)
- `GET /api/transactions` with query params:
  - `type=income|expense`, `category=`, `q=`, `startDate=`, `endDate=`, `minAmount=`, `maxAmount=`, `sort=-date|-amount|date|amount`
- `POST /api/transactions`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`

### Categories
- `GET /api/categories?type=income|expense`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

### Budgets
- `GET /api/budgets?month=&year=`
- `POST /api/budgets` (upsert)
- `DELETE /api/budgets/:id`

### Dashboard / Reports / Notifications
- `GET /api/dashboard/summary`
- `GET /api/reports?startDate=&endDate=`
  - Response includes: `expenseByCategory`, `monthlyExpenses`, `monthlyIncome`, `weeklyExpenses`, `dailyExpenses`
- `GET /api/notifications?unreadOnly=true`
- `PUT /api/notifications/:id/read`

### Export
- `GET /api/export/transactions.csv`

## 4) Database Schema (Normalized Collections)

### User
- `_id`
- `username` (unique)
- `email` (unique)
- `password` (hashed)
- `settings`: `{ currency, theme, notificationsEnabled }`

### Transaction
- `_id`
- `user` (ref User)
- `type`: `income|expense`
- `title`, `amount`, `category`, `date`
- `paymentMethod`, `description`

### Category
- `_id`
- `user`: ref User or `null` for global default
- `name`, `type` (income/expense)
- `color`, `icon`

### Budget
- `_id`
- `user` (ref User)
- `category` (string)
- `limit` (number)
- `month`, `year`

### Notification
- `_id`
- `user` (ref User)
- `type` (e.g. `budget_warning`, `budget_exceeded`)
- `message`
- `read`, `createdAt`

## 5) Use Case Diagram (Explanation)

Actors:
- Student User

Use cases:
- Register/Login/Logout
- Add income/expense
- Edit/delete entries
- Manage categories
- Set category budgets
- View dashboard + reports
- Export CSV
- View notifications and act on alerts

## 6) ER Diagram (Explanation)

- User 1—N Transaction
- User 1—N Budget
- User 1—N Notification
- User 1—N Category (custom)
- Category can also be global (user = null)

## 7) Security & Validation

- Password hashing: bcrypt
- Stateless auth: JWT bearer token
- Protected routes: `protect` middleware
- Input validation: controller checks (type, amount, dates)
- Basic NoSQL injection mitigation: strict query building (no direct spreading of request into Mongo queries)

## 8) Future Enhancements

- PDF export (server-side PDFKit or client-side jsPDF)
- Scheduled notifications (cron) for daily reminders / monthly summaries
- Admin role + admin dashboard
- Recurring transactions
- Advanced report filters + saved reports
- Multi-currency with exchange rates
