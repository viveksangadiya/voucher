/**
 * Migration - Google OAuth
 * Run: node src/config/migrate_google_auth.js
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS google_id VARCHAR(100) UNIQUE,
        ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local',
        ADD COLUMN IF NOT EXISTS avatar_url TEXT
    `);

    // password can be null for Google-only users
    await client.query(`
      ALTER TABLE users ALTER COLUMN password DROP NOT NULL
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
      ON users(google_id) WHERE google_id IS NOT NULL
    `);

    await client.query('COMMIT');
    console.log('✅ Google auth migration done');
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
