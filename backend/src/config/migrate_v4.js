/**
 * Migration V4 — Voucher Fraud Detection
 * Run: node src/config/migrate_v4.js
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fraud columns on vouchers
    await client.query(`
      ALTER TABLE vouchers
        ADD COLUMN IF NOT EXISTS fraud_checked BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS fraud_flags JSONB DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS code_hash VARCHAR(64),
        ADD COLUMN IF NOT EXISTS reported_invalid_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS auto_blocked BOOLEAN DEFAULT false
    `);

    // Fraud columns on users
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_invalid_vouchers INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
        ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP
    `);

    // Buyer reports an invalid voucher
    await client.query(`
      CREATE TABLE IF NOT EXISTS voucher_fraud_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voucher_id UUID REFERENCES vouchers(id),
        transaction_id UUID REFERENCES transactions(id),
        reported_by UUID REFERENCES users(id),
        seller_id UUID REFERENCES users(id),
        reason VARCHAR(50) NOT NULL
          CHECK (reason IN ('already_used','expired','wrong_code','invalid_format','fake')),
        description TEXT,
        evidence TEXT,
        status VARCHAR(20) DEFAULT 'pending'
          CHECK (status IN ('pending','confirmed','dismissed')),
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Seller strike system
    await client.query(`
      CREATE TABLE IF NOT EXISTS seller_strikes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID REFERENCES users(id),
        voucher_id UUID REFERENCES vouchers(id),
        strike_type VARCHAR(50) NOT NULL,
        severity VARCHAR(10) CHECK (severity IN ('warning','strike','ban')),
        description TEXT,
        auto_generated BOOLEAN DEFAULT true,
        issued_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Unique hash index — DB-level duplicate prevention
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_code_hash
      ON vouchers(code_hash) WHERE code_hash IS NOT NULL
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_fraud_reports_voucher ON voucher_fraud_reports(voucher_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fraud_reports_seller ON voucher_fraud_reports(seller_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_seller_strikes_seller ON seller_strikes(seller_id)`);

    await client.query('COMMIT');
    console.log('V4 voucher fraud detection migration done');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
};

migrate().catch(console.error);
