const { Pool } = require('pg');
require('dotenv').config();

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
// });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
// ✅ fix here
(async () => {
  try {
    await pool.query('SET search_path TO public');
    console.log("✅ Schema set to public");
  } catch (err) {
    console.error("❌ Error setting schema:", err);
  }
})();

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('📦 Connected to PostgreSQL');
  }
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

module.exports = pool;
