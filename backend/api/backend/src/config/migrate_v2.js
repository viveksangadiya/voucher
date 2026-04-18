/**
 * Migration V2 — run AFTER migrate.js
 * Adds: admin roles, voucher verification flow, disputes, cron audit log
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add role & status fields to users
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'
          CHECK (role IN ('user', 'admin', 'super_admin')),
        ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP
    `);

    // 2. Voucher verification workflow
    // status: pending_review → approved / rejected → (then active/sold/expired)
    await client.query(`
      ALTER TABLE vouchers
        ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending_review'
          CHECK (verification_status IN ('pending_review','approved','rejected')),
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS verification_notes TEXT
    `);

    // Existing active listings are already approved
    await client.query(`
      UPDATE vouchers SET verification_status = 'approved'
      WHERE verification_status = 'pending_review' AND status != 'pending'
    `);

    // 3. Disputes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES transactions(id),
        raised_by UUID REFERENCES users(id),
        against_user UUID REFERENCES users(id),
        type VARCHAR(30) CHECK (type IN ('voucher_invalid','not_received','fraud','other')),
        description TEXT NOT NULL,
        evidence_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'open'
          CHECK (status IN ('open','under_review','resolved','dismissed')),
        resolution TEXT,
        resolved_by UUID REFERENCES users(id),
        refund_issued BOOLEAN DEFAULT false,
        refund_amount DECIMAL(10,2),
        priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      )
    `);

    // 4. Dispute messages (thread)
    await client.query(`
      CREATE TABLE IF NOT EXISTS dispute_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dispute_id UUID REFERENCES disputes(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id),
        message TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 5. Cron job audit log
    await client.query(`
      CREATE TABLE IF NOT EXISTS cron_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_name VARCHAR(100) NOT NULL,
        status VARCHAR(20) CHECK (status IN ('running','success','failed')),
        records_affected INTEGER DEFAULT 0,
        message TEXT,
        duration_ms INTEGER,
        ran_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 6. Platform revenue summary (materialized/updated on transactions)
    await client.query(`
      CREATE TABLE IF NOT EXISTS revenue_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE UNIQUE NOT NULL,
        transaction_count INTEGER DEFAULT 0,
        gross_volume DECIMAL(12,2) DEFAULT 0,
        total_commission DECIMAL(12,2) DEFAULT 0,
        refunds_issued DECIMAL(12,2) DEFAULT 0,
        net_revenue DECIMAL(12,2) DEFAULT 0,
        new_users INTEGER DEFAULT 0,
        new_listings INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 7. Admin activity log
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50),
        target_id UUID,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vouchers_verification ON vouchers(verification_status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disputes_transaction ON disputes(transaction_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cron_logs_job ON cron_logs(job_name, ran_at DESC)`);

    await client.query('COMMIT');
    console.log('✅ V2 migration completed');
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
