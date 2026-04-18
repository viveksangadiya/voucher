/**
 * Migration — Reviews & Ratings
 * Run: node src/config/migrate_reviews.js
 *
 * The reviews table already exists from v1 migration.
 * This adds the missing columns needed for full review functionality.
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add missing columns to reviews table
    await client.query(`
      ALTER TABLE reviews
        ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES vouchers(id),
        ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS reply TEXT,
        ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP
    `);

    // One review per transaction only
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_transaction
      ON reviews(transaction_id)
    `);

    // Fast lookup by seller
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_user
      ON reviews(reviewed_user_id, created_at DESC)
    `);

    // Fast lookup by reviewer
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reviews_reviewer
      ON reviews(reviewer_id)
    `);

    await client.query('COMMIT');
    console.log('✅ Reviews migration completed');
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
