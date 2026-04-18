const pool = require('../config/db');
const { sendEmail } = require('../services/emailService');

const listVouchers = async (req, res) => {
  const { verification_status = 'pending_review', status, page = 1, limit = 20, search } = req.query;
  const offset = (page - 1) * limit;

  try {
    let conditions = [];
    let params = [];
    let idx = 1;

    if (verification_status !== 'all') {
      conditions.push(`v.verification_status = $${idx++}`);
      params.push(verification_status);
    }
    if (status) { conditions.push(`v.status = $${idx++}`); params.push(status); }
    if (search) {
      conditions.push(`(LOWER(v.title) LIKE $${idx} OR LOWER(v.brand) LIKE $${idx} OR LOWER(u.email) LIKE $${idx})`);
      params.push(`%${search.toLowerCase()}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM vouchers v LEFT JOIN users u ON v.seller_id = u.id ${where}`,
      params
    );

    const result = await pool.query(
      `SELECT v.*, c.name as category_name,
         u.name as seller_name, u.email as seller_email, u.rating as seller_rating,
         reviewer.name as reviewed_by_name
       FROM vouchers v
       LEFT JOIN categories c ON v.category_id = c.id
       LEFT JOIN users u ON v.seller_id = u.id
       LEFT JOIN users reviewer ON v.reviewed_by = reviewer.id
       ${where}
       ORDER BY CASE v.verification_status WHEN 'pending_review' THEN 0 ELSE 1 END, v.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      vouchers: result.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const getVoucher = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, c.name as category_name,
         u.name as seller_name, u.email as seller_email, u.total_sold, u.rating as seller_rating,
         reviewer.name as reviewed_by_name
       FROM vouchers v
       LEFT JOIN categories c ON v.category_id = c.id
       LEFT JOIN users u ON v.seller_id = u.id
       LEFT JOIN users reviewer ON v.reviewed_by = reviewer.id
       WHERE v.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const approveVoucher = async (req, res) => {
  const { verification_notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE vouchers
       SET verification_status = 'approved', status = 'active',
           reviewed_by = $1, reviewed_at = NOW(), verification_notes = $2,
           rejection_reason = NULL, updated_at = NOW()
       WHERE id = $3 AND verification_status = 'pending_review'
       RETURNING *, (SELECT name FROM users WHERE id = seller_id) as seller_name,
                   (SELECT email FROM users WHERE id = seller_id) as seller_email`,
      [req.user.id, verification_notes, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Voucher not found or already reviewed' });

    const v = result.rows[0];
    // Email seller
    sendEmail('voucher_approved', v.seller_email, {
      sellerName: v.seller_name,
      voucherTitle: v.title,
    }, v.seller_id, v.id).catch(() => {});

    res.json({ message: 'Voucher approved and now live', voucher: v });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const rejectVoucher = async (req, res) => {
  const { rejection_reason, verification_notes } = req.body;
  if (!rejection_reason) return res.status(400).json({ error: 'Rejection reason required' });

  try {
    const result = await pool.query(
      `UPDATE vouchers
       SET verification_status = 'rejected', status = 'pending',
           rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW(),
           verification_notes = $3, updated_at = NOW()
       WHERE id = $4 AND verification_status = 'pending_review'
       RETURNING *, (SELECT name FROM users WHERE id = seller_id) as seller_name,
                   (SELECT email FROM users WHERE id = seller_id) as seller_email`,
      [rejection_reason, req.user.id, verification_notes, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Voucher not found or already reviewed' });

    const v = result.rows[0];
    sendEmail('voucher_rejected', v.seller_email, {
      sellerName: v.seller_name,
      voucherTitle: v.title,
      reason: rejection_reason,
    }, v.seller_id, v.id).catch(() => {});

    res.json({ message: 'Voucher rejected', voucher: v });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getPendingCount = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM vouchers WHERE verification_status = 'pending_review'"
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { listVouchers, getVoucher, approveVoucher, rejectVoucher, getPendingCount };
