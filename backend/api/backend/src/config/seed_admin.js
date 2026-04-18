/**
 * Creates a super_admin user.
 * Run: node src/config/seed_admin.js
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@vouchex.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Super Admin';

async function seed() {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
    if (existing.rows[0]) {
      // Upgrade to super_admin if exists
      await client.query("UPDATE users SET role = 'super_admin' WHERE email = $1", [ADMIN_EMAIL]);
      console.log(`✅ Upgraded ${ADMIN_EMAIL} to super_admin`);
    } else {
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await client.query(
        "INSERT INTO users (name, email, password, role, is_verified) VALUES ($1, $2, $3, 'super_admin', true)",
        [ADMIN_NAME, ADMIN_EMAIL, hashed]
      );
      console.log(`✅ Admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    }
  } finally {
    client.release();
    pool.end();
  }
}

seed().catch(console.error);
