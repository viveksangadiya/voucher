# VouchEx - Voucher Marketplace Platform

A full-stack marketplace where users can **buy and sell unused vouchers** with a **20% platform commission** on each transaction.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, TypeScript, TailwindCSS |
| State | Zustand |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Auth | JWT (Bearer tokens) |
| Payments | In-app Wallet system |

---

## Features

### For Buyers
- Browse & search vouchers by category, brand, price range
- Sort by newest, best discount, price, popularity
- Secure purchase with in-app wallet
- Voucher code revealed only after successful payment
- Purchase history in dashboard

### For Sellers
- List vouchers with pricing, expiry, and category
- Real-time earning calculator showing 20% commission deducted
- Manage active listings
- Sales dashboard with earnings tracking

### Platform
- **20% commission** on every transaction (auto-calculated)
- Wallet system with top-up functionality
- Full transaction history
- Escrow-style flow: buyer pays → platform takes 20% → seller credited 80%
- Ratings & seller reputation

---

## Revenue Model

```
Buyer pays: ₹100
Platform takes: ₹20 (20%)
Seller receives: ₹80 (80%)
```

---

## Project Structure

```
vouchermarket/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js          # PostgreSQL pool
│   │   │   └── migrate.js     # DB schema & seed
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── voucherController.js
│   │   │   ├── transactionController.js
│   │   │   └── categoryController.js
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT middleware
│   │   ├── routes/
│   │   │   └── index.js       # All API routes
│   │   └── index.js           # Express entry point
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx           # Homepage
    │   │   ├── layout.tsx         # Root layout
    │   │   ├── globals.css        # Design system
    │   │   ├── login/page.tsx
    │   │   ├── register/page.tsx
    │   │   ├── sell/page.tsx      # List voucher
    │   │   ├── dashboard/page.tsx # User dashboard
    │   │   └── vouchers/
    │   │       ├── page.tsx       # Browse vouchers
    │   │       └── [id]/page.tsx  # Voucher detail + purchase
    │   ├── components/
    │   │   ├── layout/Navbar.tsx
    │   │   └── ui/VoucherCard.tsx
    │   ├── lib/api.ts             # Axios client
    │   └── store/authStore.ts     # Zustand auth store
    ├── tailwind.config.js
    └── package.json
```

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Clone & Install
```bash
git clone <your-repo>
cd vouchermarket
npm run install:all
```

### 2. Configure Backend
```bash
cd backend
cp .env.example .env
```
Edit `.env`:
```
PORT=5000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/vouchermarket
JWT_SECRET=your_long_random_secret_key
JWT_EXPIRE=7d
COMMISSION_RATE=0.20
NODE_ENV=development
```

### 3. Configure Frontend
```bash
cd frontend
cp .env.local.example .env.local
```
Edit `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 4. Create Database & Run Migration
```bash
# Create the database first
psql -U postgres -c "CREATE DATABASE vouchermarket;"

# Run migrations (from project root)
npm run migrate
```

### 5. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend && npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend && npm run dev
# Runs on http://localhost:3000
```

---

## API Endpoints

### Auth
```
POST   /api/auth/register    - Create account
POST   /api/auth/login       - Login
GET    /api/auth/me          - Get current user
PUT    /api/auth/profile     - Update profile
```

### Vouchers
```
GET    /api/vouchers             - Browse (filters: category, brand, minPrice, maxPrice, search, sort, page)
GET    /api/vouchers/mine        - My listings (auth)
GET    /api/vouchers/:id         - Voucher detail
POST   /api/vouchers             - Create listing (auth)
PUT    /api/vouchers/:id         - Update listing (auth, owner)
DELETE /api/vouchers/:id         - Delete listing (auth, owner)
```

### Transactions & Wallet
```
POST   /api/transactions/purchase  - Buy a voucher (auth)
GET    /api/transactions           - My transactions (auth) ?role=buyer|seller
POST   /api/wallet/add-funds       - Top up wallet (auth)
GET    /api/wallet/history         - Wallet history (auth)
GET    /api/dashboard/stats        - Dashboard stats (auth)
```

### Categories
```
GET    /api/categories    - All categories with voucher count
```

---

## Database Schema

- **users** - Accounts with balance, ratings, stats
- **categories** - 8 pre-seeded categories
- **vouchers** - Listings with pricing, codes, status
- **transactions** - Purchase records with commission breakdown
- **wallet_transactions** - Debit/credit ledger
- **reviews** - Seller ratings
- **watchlist** - Saved vouchers

---

## Deployment (Production)

### Backend (Railway / Render / Fly.io)
1. Set environment variables
2. Set `NODE_ENV=production`
3. PostgreSQL connection string from your DB provider

### Frontend (Vercel)
1. Connect GitHub repo
2. Set `NEXT_PUBLIC_API_URL=https://your-backend-url.com/api`
3. Deploy

### Database (Supabase / Neon / Railway)
- Create PostgreSQL instance
- Run migration script
- Use connection string in backend `.env`

---

## Scaling Ideas
- Payment gateway (Razorpay/Stripe) to replace wallet top-up simulation
- Email notifications on purchase/sale
- Admin panel for managing disputes, revenue tracking
- Voucher verification before listing goes live
- Expiry auto-cleanup via cron jobs
- Redis for caching popular vouchers
