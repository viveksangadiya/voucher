/**
 * Migration V3
 * Adds: razorpay_orders, withdrawal_requests, email_logs tables
 * Run: node src/config/migrate_v3.js
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Razorpay deposit orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS razorpay_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        razorpay_order_id VARCHAR(100) UNIQUE NOT NULL,
        razorpay_payment_id VARCHAR(100),
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        status VARCHAR(20) DEFAULT 'created'
          CHECK (status IN ('created','paid','failed','refunded')),
        receipt VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP
      )
    `);

    // Seller withdrawal requests
    await client.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending'
          CHECK (status IN ('pending','processing','completed','rejected')),
        bank_account VARCHAR(20),
        ifsc_code VARCHAR(15),
        account_name VARCHAR(100),
        razorpay_payout_id VARCHAR(100),
        rejection_reason TEXT,
        processed_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP
      )
    `);

    // Email notification log
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        to_email VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        subject VARCHAR(255),
        status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent','failed','queued')),
        error_message TEXT,
        reference_id UUID,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('✅ V3 migration completed');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
};

migrate().catch(console.error);
