const pool = require('../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reviews
// Buyer submits a review after a completed purchase
// ─────────────────────────────────────────────────────────────────────────────
const createReview = async (req, res) => {
  const { transaction_id, rating, comment } = req.body;
  const reviewer_id = req.user.id;

  if (!transaction_id || !rating) {
    return res.status(400).json({ error: 'transaction_id and rating are required' });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number between 1 and 5' });
  }
  if (comment && comment.trim().length > 1000) {
    return res.status(400).json({ error: 'Review cannot exceed 1000 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify buyer actually completed this transaction
    const txRes = await client.query(
      `SELECT t.*, v.title as voucher_title, v.id as voucher_id,
              u.name as seller_name
       FROM transactions t
       JOIN vouchers v ON t.voucher_id = v.id
       JOIN users u ON t.seller_id = u.id
       WHERE t.id = $1 AND t.buyer_id = $2 AND t.status = 'completed'`,
      [transaction_id, reviewer_id]
    );

    const tx = txRes.rows[0];
    if (!tx) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only review vouchers you have purchased' });
    }

    // Check not already reviewed
    const existing = await client.query(
      'SELECT id FROM reviews WHERE transaction_id = $1',
      [transaction_id]
    );
    if (existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already reviewed this purchase' });
    }

    // Insert review
    const reviewRes = await client.query(
      `INSERT INTO reviews
         (transaction_id, voucher_id, reviewer_id, reviewed_user_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [transaction_id, tx.voucher_id, reviewer_id, tx.seller_id,
       rating, comment?.trim() || null]
    );

    // Recalculate seller's average rating from all their reviews
    await client.query(
      `UPDATE users
       SET rating = (
         SELECT ROUND(AVG(rating)::numeric, 2)
         FROM reviews
         WHERE reviewed_user_id = $1
       )
       WHERE id = $1`,
      [tx.seller_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      review: reviewRes.rows[0],
      message: 'Review submitted successfully',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[createReview]', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reviews/seller/:userId
// Get all reviews for a seller (public)
// ─────────────────────────────────────────────────────────────────────────────
const getSellerReviews = async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10, sort = 'newest' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const orderBy = {
    newest:   'r.created_at DESC',
    oldest:   'r.created_at ASC',
    highest:  'r.rating DESC',
    lowest:   'r.rating ASC',
    helpful:  'r.helpful_count DESC',
  }[sort] || 'r.created_at DESC';

  try {
    const [reviewsRes, statsRes, sellerRes] = await Promise.all([
      pool.query(
        `SELECT
           r.*,
           u.name as reviewer_name,
           u.avatar as reviewer_avatar,
           u.avatar_url as reviewer_avatar_url,
           v.title as voucher_title,
           v.brand as voucher_brand
         FROM reviews r
         JOIN users u ON r.reviewer_id = u.id
         LEFT JOIN vouchers v ON r.voucher_id = v.id
         WHERE r.reviewed_user_id = $1
         ORDER BY ${orderBy}
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      // Rating breakdown (how many 1★, 2★ ... 5★)
      pool.query(
        `SELECT
           COUNT(*) as total,
           ROUND(AVG(rating)::numeric, 2) as average,
           COUNT(*) FILTER (WHERE rating = 5) as five_star,
           COUNT(*) FILTER (WHERE rating = 4) as four_star,
           COUNT(*) FILTER (WHERE rating = 3) as three_star,
           COUNT(*) FILTER (WHERE rating = 2) as two_star,
           COUNT(*) FILTER (WHERE rating = 1) as one_star
         FROM reviews
         WHERE reviewed_user_id = $1`,
        [userId]
      ),
      pool.query(
        'SELECT id, name, avatar, avatar_url, rating, total_sold, is_verified FROM users WHERE id = $1',
        [userId]
      ),
    ]);

    const stats = statsRes.rows[0];
    const total = parseInt(stats.total) || 0;

    res.json({
      seller: sellerRes.rows[0],
      reviews: reviewsRes.rows,
      stats: {
        total,
        average: parseFloat(stats.average) || 0,
        breakdown: {
          5: parseInt(stats.five_star) || 0,
          4: parseInt(stats.four_star) || 0,
          3: parseInt(stats.three_star) || 0,
          2: parseInt(stats.two_star) || 0,
          1: parseInt(stats.one_star) || 0,
        },
      },
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('[getSellerReviews]', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reviews/check/:transactionId
// Check if buyer has already reviewed — used to show/hide review button
// ─────────────────────────────────────────────────────────────────────────────
const checkReviewed = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, rating, comment FROM reviews WHERE transaction_id = $1 AND reviewer_id = $2',
      [req.params.transactionId, req.user.id]
    );
    res.json({ reviewed: !!result.rows[0], review: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/reviews/:id
// Buyer edits their review (within 7 days)
// ─────────────────────────────────────────────────────────────────────────────
const editReview = async (req, res) => {
  const { rating, comment } = req.body;

  if (rating && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM reviews WHERE id = $1 AND reviewer_id = $2',
      [req.params.id, req.user.id]
    );

    const review = existing.rows[0];
    if (!review) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Review not found' });
    }

    // Only editable within 7 days
    const daysSince = (Date.now() - new Date(review.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 7) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Reviews can only be edited within 7 days of posting' });
    }

    const updated = await client.query(
      `UPDATE reviews
       SET rating = COALESCE($1, rating),
           comment = COALESCE($2, comment),
           is_edited = true,
           edited_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [rating || null, comment?.trim() || null, req.params.id]
    );

    // Recalculate seller rating
    await client.query(
      `UPDATE users
       SET rating = (
         SELECT ROUND(AVG(rating)::numeric, 2)
         FROM reviews WHERE reviewed_user_id = $1
       )
       WHERE id = $1`,
      [review.reviewed_user_id]
    );

    await client.query('COMMIT');
    res.json({ review: updated.rows[0], message: 'Review updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reviews/:id/helpful
// Mark a review as helpful (toggle)
// ─────────────────────────────────────────────────────────────────────────────
const markHelpful = async (req, res) => {
  try {
    // Simple increment — in production you'd track who marked helpful
    await pool.query(
      'UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Marked as helpful' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reviews/:id/reply
// Seller replies to a review on their listing
// ─────────────────────────────────────────────────────────────────────────────
const replyToReview = async (req, res) => {
  const { reply } = req.body;
  if (!reply?.trim()) return res.status(400).json({ error: 'Reply cannot be empty' });
  if (reply.trim().length > 500) return res.status(400).json({ error: 'Reply cannot exceed 500 characters' });

  try {
    const reviewRes = await pool.query(
      'SELECT * FROM reviews WHERE id = $1',
      [req.params.id]
    );
    const review = reviewRes.rows[0];
    if (!review) return res.status(404).json({ error: 'Review not found' });

    // Only the reviewed seller can reply
    if (review.reviewed_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the seller can reply to this review' });
    }
    if (review.reply) {
      return res.status(400).json({ error: 'You have already replied to this review' });
    }

    const updated = await pool.query(
      `UPDATE reviews SET reply = $1, replied_at = NOW() WHERE id = $2 RETURNING *`,
      [reply.trim(), req.params.id]
    );
    res.json({ review: updated.rows[0], message: 'Reply posted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reviews/mine
// All reviews the logged-in user has written
// ─────────────────────────────────────────────────────────────────────────────
const getMyReviews = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.name as seller_name, v.title as voucher_title, v.brand
       FROM reviews r
       JOIN users u ON r.reviewed_user_id = u.id
       LEFT JOIN vouchers v ON r.voucher_id = v.id
       WHERE r.reviewer_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/reviews/:id
// Admin deletes an abusive review
// ─────────────────────────────────────────────────────────────────────────────
const adminDeleteReview = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reviewRes = await client.query(
      'SELECT * FROM reviews WHERE id = $1',
      [req.params.id]
    );
    const review = reviewRes.rows[0];
    if (!review) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Review not found' });
    }

    await client.query('DELETE FROM reviews WHERE id = $1', [req.params.id]);

    // Recalculate seller rating after deletion
    await client.query(
      `UPDATE users
       SET rating = COALESCE(
         (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE reviewed_user_id = $1),
         5.00
       )
       WHERE id = $1`,
      [review.reviewed_user_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Review deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = {
  createReview,
  getSellerReviews,
  checkReviewed,
  editReview,
  markHelpful,
  replyToReview,
  getMyReviews,
  adminDeleteReview,
};
