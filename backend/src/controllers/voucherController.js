const pool = require('../config/db');
const {
  hashCode,
  checkDuplicateCode,
  validateCodeFormat,
  checkSellerHistory,
} = require('../services/voucherFraudService');

const getVouchers = async (req, res) => {
  const { category, brand, minPrice, maxPrice, search, sort = 'newest', page = 1, limit = 12 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let conditions = ["v.status = 'active'", "v.verification_status = 'approved'"];
    let params = [];
    let idx = 1;
    if (category) { conditions.push(`c.slug = $${idx++}`); params.push(category); }
    if (brand) { conditions.push(`LOWER(v.brand) LIKE $${idx++}`); params.push(`%${brand.toLowerCase()}%`); }
    if (minPrice) { conditions.push(`v.selling_price >= $${idx++}`); params.push(minPrice); }
    if (maxPrice) { conditions.push(`v.selling_price <= $${idx++}`); params.push(maxPrice); }
    if (search) {
      conditions.push(`(LOWER(v.title) LIKE $${idx} OR LOWER(v.brand) LIKE $${idx} OR LOWER(v.description) LIKE $${idx})`);
      params.push(`%${search.toLowerCase()}%`);
      idx++;
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const orderBy = { newest: 'v.created_at DESC', price_asc: 'v.selling_price ASC', price_desc: 'v.selling_price DESC', discount: '((v.original_value - v.selling_price) / v.original_value) DESC' }[sort] || 'v.created_at DESC';
    const countRes = await pool.query(`SELECT COUNT(*) FROM vouchers v LEFT JOIN categories c ON v.category_id = c.id ${where}`, params);
    const result = await pool.query(
      `SELECT v.*, c.name as category_name, c.slug as category_slug,
         u.name as seller_name, u.rating as seller_rating, u.total_sold as seller_total_sold,
         ROUND(((v.original_value - v.selling_price) / v.original_value * 100)::numeric, 0) as discount_percent
       FROM vouchers v
       LEFT JOIN categories c ON v.category_id = c.id
       LEFT JOIN users u ON v.seller_id = u.id
       ${where} ORDER BY ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    res.json({ vouchers: result.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), pages: Math.ceil(parseInt(countRes.rows[0].count) / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const getVoucher = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, c.name as category_name, c.slug as category_slug,
         u.name as seller_name, u.rating as seller_rating,
         u.total_sold as seller_total_sold, u.is_verified as seller_verified,
         ROUND(((v.original_value - v.selling_price) / v.original_value * 100)::numeric, 0) as discount_percent
       FROM vouchers v
       LEFT JOIN categories c ON v.category_id = c.id
       LEFT JOIN users u ON v.seller_id = u.id
       WHERE v.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Voucher not found' });
    const voucher = result.rows[0];
    if (!req.user || req.user.id !== voucher.buyer_id) delete voucher.code;
    res.json(voucher);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createVoucher = async (req, res) => {
  const { title, description, brand, original_value, selling_price, code, expiry_date, category_id, image_url } = req.body;
  const sellerId = req.user.id;

  if (!title || !brand || !original_value || !selling_price || !code) {
    return res.status(400).json({ error: 'title, brand, original_value, selling_price, code are required' });
  }
  if (parseFloat(selling_price) >= parseFloat(original_value)) {
    return res.status(400).json({ error: 'Selling price must be less than original value' });
  }
  if ((1 - selling_price / original_value) * 100 < 5) {
    return res.status(400).json({ error: 'Minimum 5% discount required' });
  }

  try {
    // FRAUD CHECK 1: Code format — catches obviously fake codes instantly
    const formatCheck = validateCodeFormat(code, brand);
    if (!formatCheck.valid) {
      return res.status(400).json({
        error: 'Voucher code appears invalid: ' + formatCheck.issues.join('. '),
        fraud: true,
      });
    }

    // FRAUD CHECK 2: Seller history — blocks flagged/banned sellers
    const historyCheck = await checkSellerHistory(sellerId);
    if (!historyCheck.allowed) {
      return res.status(403).json({ error: historyCheck.reason });
    }

    // FRAUD CHECK 3: Duplicate code — catches same code listed twice
    const dupCheck = await checkDuplicateCode(code, sellerId);
    if (dupCheck.isDuplicate) {
      return res.status(400).json({ error: dupCheck.message, fraud: true });
    }

    // Insert with hash stored for future duplicate detection
    const result = await pool.query(
      `INSERT INTO vouchers
         (seller_id, category_id, title, description, brand,
          original_value, selling_price, code, code_hash,
          expiry_date, image_url, status, verification_status, fraud_checked)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending','pending_review',true)
       RETURNING *`,
      [sellerId, category_id, title, description, brand, original_value, selling_price, code, dupCheck.hash, expiry_date || null, image_url || null]
    );

    const voucher = result.rows[0];

    res.status(201).json({
      ...voucher,
      code: undefined, // never return code in listing response
      warning: historyCheck.warning_message || null,
      message: 'Voucher submitted for review. It will go live once approved.',
    });
  } catch (err) {
    // DB-level duplicate catch (belt & suspenders)
    if (err.code === '23505' && err.constraint?.includes('code_hash')) {
      return res.status(400).json({ error: 'This voucher code has already been listed on VouchEx.', fraud: true });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateVoucher = async (req, res) => {
  const { title, description, selling_price, image_url } = req.body;
  try {
    const result = await pool.query(
      `UPDATE vouchers SET title=COALESCE($1,title), description=COALESCE($2,description),
       selling_price=COALESCE($3,selling_price), image_url=COALESCE($4,image_url), updated_at=NOW()
       WHERE id=$5 AND seller_id=$6 AND status='active' RETURNING *`,
      [title, description, selling_price, image_url, req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Voucher not found or cannot be edited' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteVoucher = async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM vouchers WHERE id=$1 AND seller_id=$2 AND status IN ('active','pending') RETURNING id",
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Voucher not found or cannot be deleted' });
    res.json({ message: 'Voucher deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getMyVouchers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, c.name as category_name FROM vouchers v
       LEFT JOIN categories c ON v.category_id = c.id
       WHERE v.seller_id=$1 ORDER BY v.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getVouchers, getVoucher, createVoucher, updateVoucher, deleteVoucher, getMyVouchers };
