/**
 * Migration — Notifications + KYC
 * Run: node src/config/migrate_v5.js
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── NOTIFICATIONS ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
        type        VARCHAR(50) NOT NULL,
        title       VARCHAR(255) NOT NULL,
        message     TEXT NOT NULL,
        data        JSONB DEFAULT '{}',
        is_read     BOOLEAN DEFAULT false,
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user
      ON notifications(user_id, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_unread
      ON notifications(user_id, is_read) WHERE is_read = false
    `);

    // ── KYC ──────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS kyc_submissions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        full_name       VARCHAR(255) NOT NULL,
        dob             DATE NOT NULL,
        pan_number      VARCHAR(10),
        aadhaar_last4   VARCHAR(4),
        bank_name       VARCHAR(100) NOT NULL,
        account_number  VARCHAR(20) NOT NULL,
        ifsc_code       VARCHAR(11) NOT NULL,
        account_holder  VARCHAR(255) NOT NULL,
        status          VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected')),
        rejection_reason TEXT,
        submitted_at    TIMESTAMP DEFAULT NOW(),
        reviewed_at     TIMESTAMP,
        reviewed_by     UUID REFERENCES users(id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_kyc_status
      ON kyc_submissions(status, submitted_at DESC)
    `);

    // Add kyc_status column to users
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'none'
          CHECK (kyc_status IN ('none','pending','approved','rejected'))
    `);

    await client.query('COMMIT');
    console.log('✅ V5 migration (notifications + KYC) completed');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
};

migrate().catch(console.error);
