const pool = require('../config/db');

const getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(v.id) FILTER (WHERE v.status = 'active') as voucher_count
       FROM categories c
       LEFT JOIN vouchers v ON v.category_id = c.id
       GROUP BY c.id ORDER BY c.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getCategories };
