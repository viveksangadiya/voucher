const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(500),
        balance DECIMAL(10,2) DEFAULT 0.00,
        total_sold INTEGER DEFAULT 0,
        total_bought INTEGER DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 5.00,
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        icon VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Vouchers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
        category_id UUID REFERENCES categories(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        brand VARCHAR(100) NOT NULL,
        original_value DECIMAL(10,2) NOT NULL,
        selling_price DECIMAL(10,2) NOT NULL,
        discount_percentage INTEGER GENERATED ALWAYS AS (
          ROUND(((original_value - selling_price) / original_value * 100))
        ) STORED,
        code VARCHAR(500),
        expiry_date DATE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'expired', 'pending')),
        image_url VARCHAR(500),
        views INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voucher_id UUID REFERENCES vouchers(id),
        buyer_id UUID REFERENCES users(id),
        seller_id UUID REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        commission DECIMAL(10,2) NOT NULL,
        seller_earning DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'disputed')),
        payment_method VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    // Reviews table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES transactions(id),
        reviewer_id UUID REFERENCES users(id),
        reviewed_user_id UUID REFERENCES users(id),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Watchlist table
    await client.query(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, voucher_id)
      )
    `);

    // Wallet transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        type VARCHAR(20) CHECK (type IN ('credit', 'debit')),
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        reference_id UUID,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert default categories
    await client.query(`
      INSERT INTO categories (name, slug, icon, description) VALUES
        ('Food & Dining', 'food-dining', '🍕', 'Restaurant vouchers, food delivery, and dining experiences'),
        ('Shopping', 'shopping', '🛍️', 'Retail stores, online shopping, and fashion'),
        ('Travel', 'travel', '✈️', 'Hotels, flights, and travel experiences'),
        ('Entertainment', 'entertainment', '🎬', 'Movies, games, streaming services'),
        ('Health & Beauty', 'health-beauty', '💄', 'Spa, wellness, and beauty services'),
        ('Electronics', 'electronics', '💻', 'Tech gadgets and electronics stores'),
        ('Sports & Fitness', 'sports-fitness', '🏋️', 'Gyms, sports gear, and outdoor activities'),
        ('Education', 'education', '📚', 'Online courses, books, and learning platforms')
      ON CONFLICT (slug) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
};

migrate().catch(console.error);
