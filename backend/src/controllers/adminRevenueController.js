const pool = require('../config/db');

// GET /admin/revenue/overview
const getOverview = async (req, res) => {
  try {
    const [totals, today, thisMonth, topSellers, topBrands, recentTx] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total_transactions,
          COALESCE(SUM(amount), 0) as gross_volume,
          COALESCE(SUM(commission), 0) as total_commission,
          COALESCE(SUM(CASE WHEN status = 'refunded' THEN commission ELSE 0 END), 0) as refunded_commission
        FROM transactions WHERE status IN ('completed','refunded')
      `),
      pool.query(`
        SELECT
          COUNT(*) as tx_count,
          COALESCE(SUM(amount), 0) as volume,
          COALESCE(SUM(commission), 0) as commission
        FROM transactions
        WHERE DATE(created_at) = CURRENT_DATE AND status = 'completed'
      `),
      pool.query(`
        SELECT
          COUNT(*) as tx_count,
          COALESCE(SUM(amount), 0) as volume,
          COALESCE(SUM(commission), 0) as commission
        FROM transactions
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
          AND status = 'completed'
      `),
      pool.query(`
        SELECT u.id, u.name, u.email, u.total_sold, u.rating,
          COALESCE(SUM(t.seller_earning), 0) as total_earned,
          COALESCE(SUM(t.commission), 0) as commission_generated
        FROM users u
        LEFT JOIN transactions t ON t.seller_id = u.id AND t.status = 'completed'
        GROUP BY u.id ORDER BY commission_generated DESC LIMIT 10
      `),
      pool.query(`
        SELECT v.brand, COUNT(*) as sales, COALESCE(SUM(t.commission), 0) as commission
        FROM transactions t
        JOIN vouchers v ON t.voucher_id = v.id
        WHERE t.status = 'completed'
        GROUP BY v.brand ORDER BY commission DESC LIMIT 10
      `),
      pool.query(`
        SELECT t.*, v.title as voucher_title, v.brand,
          b.name as buyer_name, s.name as seller_name
        FROM transactions t
        LEFT JOIN vouchers v ON t.voucher_id = v.id
        LEFT JOIN users b ON t.buyer_id = b.id
        LEFT JOIN users s ON t.seller_id = s.id
        ORDER BY t.created_at DESC LIMIT 10
      `),
    ]);

    res.json({
      totals: totals.rows[0],
      today: today.rows[0],
      this_month: thisMonth.rows[0],
      top_sellers: topSellers.rows,
      top_brands: topBrands.rows,
      recent_transactions: recentTx.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /admin/revenue/chart?days=30
const getChart = async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 365);
  try {
    const result = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as transactions,
        COALESCE(SUM(amount), 0) as volume,
        COALESCE(SUM(commission), 0) as commission
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /admin/users
const listUsers = async (req, res) => {
  const { search, role, is_suspended, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let conditions = [];
    let params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(LOWER(u.name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx})`);
      params.push(`%${search.toLowerCase()}%`);
      idx++;
    }
    if (role) { conditions.push(`u.role = $${idx++}`); params.push(role); }
    if (is_suspended !== undefined) { conditions.push(`u.is_suspended = $${idx++}`); params.push(is_suspended === 'true'); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM users u ${where}`, params);

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.balance, u.total_sold, u.total_bought,
         u.rating, u.is_verified, u.is_suspended, u.suspension_reason, u.created_at,
         (SELECT COUNT(*) FROM vouchers WHERE seller_id = u.id AND verification_status = 'pending_review') as pending_vouchers,
         (SELECT COUNT(*) FROM disputes WHERE raised_by = u.id) as disputes_raised
       FROM users u ${where}
       ORDER BY u.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      users: result.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /admin/users/:id/suspend
const suspendUser = async (req, res) => {
  const { reason } = req.body;
  try {
    await pool.query(
      'UPDATE users SET is_suspended = true, suspension_reason = $1 WHERE id = $2',
      [reason, req.params.id]
    );
    res.json({ message: 'User suspended' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /admin/users/:id/unsuspend
const unsuspendUser = async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_suspended = false, suspension_reason = NULL WHERE id = $1', [req.params.id]);
    res.json({ message: 'User unsuspended' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /admin/stats/counts - for dashboard badges
const getCounts = async (req, res) => {
  try {
    const [pending, openDisputes, suspendedUsers, totalUsers] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM vouchers WHERE verification_status = 'pending_review'"),
      pool.query("SELECT COUNT(*) FROM disputes WHERE status IN ('open','under_review')"),
      pool.query('SELECT COUNT(*) FROM users WHERE is_suspended = true'),
      pool.query('SELECT COUNT(*) FROM users'),
    ]);
    res.json({
      pending_vouchers: parseInt(pending.rows[0].count),
      open_disputes: parseInt(openDisputes.rows[0].count),
      suspended_users: parseInt(suspendedUsers.rows[0].count),
      total_users: parseInt(totalUsers.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getOverview, getChart, listUsers, suspendUser, unsuspendUser, getCounts };
