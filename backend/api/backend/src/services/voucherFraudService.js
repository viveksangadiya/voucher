const crypto = require('crypto');
const pool = require('../config/db');
const { sendEmail } = require('./emailService');

// ─────────────────────────────────────────────────────────────────────────────
// STRIKE THRESHOLDS
// 3 warnings  → account flagged for review
// 2 strikes   → account suspended automatically
// ─────────────────────────────────────────────────────────────────────────────
const THRESHOLDS = {
  warnings_before_flag: 3,
  strikes_before_suspend: 2,
  invalid_rate_threshold: 0.3, // 30% of vouchers reported invalid = auto-strike
};

// ─────────────────────────────────────────────────────────────────────────────
// HASH a voucher code — stored in DB, never the raw code
// Normalise: trim + lowercase + remove spaces/dashes so "ABC-123" == "abc123"
// ─────────────────────────────────────────────────────────────────────────────
const hashCode = (code) =>
  crypto
    .createHash('sha256')
    .update(code.trim().toLowerCase().replace(/[\s\-_]/g, ''))
    .digest('hex');

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 1: DUPLICATE CODE
// Called when seller submits a new voucher
// Returns { isDuplicate, message, existingVoucherId }
// ─────────────────────────────────────────────────────────────────────────────
const checkDuplicateCode = async (code, sellerId) => {
  const hash = hashCode(code);

  const existing = await pool.query(
    `SELECT v.id, v.status, v.seller_id, u.name as seller_name
     FROM vouchers v
     JOIN users u ON v.seller_id = u.id
     WHERE v.code_hash = $1
     LIMIT 1`,
    [hash]
  );

  if (!existing.rows[0]) {
    return { isDuplicate: false, hash };
  }

  const prev = existing.rows[0];
  const isSameSeller = prev.seller_id === sellerId;

  // Log fraud event on seller
  await issueFraudFlag(sellerId, null, 'duplicate_code',
    isSameSeller
      ? 'Tried to list a voucher code they already listed before'
      : `Tried to list a code already listed by another seller (${prev.seller_name})`,
    'warning'
  );

  return {
    isDuplicate: true,
    message: isSameSeller
      ? 'You have already listed this voucher code. Each code can only be listed once.'
      : 'This voucher code has already been listed on VouchEx by another seller.',
    existingVoucherId: prev.id,
    existingStatus: prev.status,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 2: FORMAT VALIDATION
// Catches obviously fake codes before they even reach admin review
// ─────────────────────────────────────────────────────────────────────────────
const validateCodeFormat = (code, brand) => {
  const issues = [];
  const clean = code.trim();

  // Too short or too long
  if (clean.length < 4) issues.push('Code is too short (minimum 4 characters)');
  if (clean.length > 64) issues.push('Code is too long (maximum 64 characters)');

  // All same character — "AAAAAAAA" is clearly fake
  if (/^(.)\1+$/.test(clean)) issues.push('Code appears to be invalid (all same character)');

  // Sequential characters — "12345678" is suspicious
  const isSequential = [...clean].every((c, i, arr) =>
    i === 0 || c.charCodeAt(0) - arr[i - 1].charCodeAt(0) === 1
  );
  if (clean.length >= 6 && isSequential) issues.push('Code appears to be sequential — likely invalid');

  // Common test/placeholder strings
  const fakePatterns = ['test', 'sample', 'demo', 'fake', 'xxxx', 'null', '0000', '1234'];
  if (fakePatterns.some(p => clean.toLowerCase().includes(p))) {
    issues.push('Code contains placeholder text and appears to be fake');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 3: SELLER HISTORY CHECK
// Checks the seller's track record before allowing listing
// ─────────────────────────────────────────────────────────────────────────────
const checkSellerHistory = async (sellerId) => {
  const result = await pool.query(
    `SELECT
       u.total_sold,
       u.total_invalid_vouchers,
       u.fraud_score,
       u.is_flagged,
       COUNT(DISTINCT ss.id) FILTER (WHERE ss.severity = 'warning') as warnings,
       COUNT(DISTINCT ss.id) FILTER (WHERE ss.severity = 'strike') as strikes,
       COUNT(DISTINCT vfr.id) FILTER (WHERE vfr.status = 'confirmed') as confirmed_fraud_reports
     FROM users u
     LEFT JOIN seller_strikes ss ON ss.seller_id = u.id
     LEFT JOIN voucher_fraud_reports vfr ON vfr.seller_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [sellerId]
  );

  const s = result.rows[0];
  if (!s) return { allowed: true };

  const warnings = parseInt(s.warnings) || 0;
  const strikes = parseInt(s.strikes) || 0;

  // Blocked sellers cannot list
  if (s.is_flagged && strikes >= THRESHOLDS.strikes_before_suspend) {
    return {
      allowed: false,
      reason: 'Your account has been flagged for suspicious activity. Contact support.',
    };
  }

  // High invalid rate check
  if (s.total_sold >= 5) {
    const invalidRate = (s.total_invalid_vouchers || 0) / s.total_sold;
    if (invalidRate > THRESHOLDS.invalid_rate_threshold) {
      return {
        allowed: false,
        reason: `Too many of your vouchers have been reported invalid (${Math.round(invalidRate * 100)}%). Account restricted.`,
      };
    }
  }

  return {
    allowed: true,
    warnings,
    strikes,
    fraud_score: s.fraud_score,
    // Warn seller but don't block
    warning_message: warnings > 0
      ? `Warning: You have ${warnings} previous warning(s) for invalid vouchers.`
      : null,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORT INVALID VOUCHER (called by buyer after purchase)
// POST /api/vouchers/:id/report
// ─────────────────────────────────────────────────────────────────────────────
const reportInvalidVoucher = async (req, res) => {
  const { reason, description, evidence, transaction_id } = req.body;
  const buyerId = req.user.id;
  const voucherId = req.params.id;

  const validReasons = ['already_used', 'expired', 'wrong_code', 'invalid_format', 'fake'];
  if (!validReasons.includes(reason)) {
    return res.status(400).json({ error: 'Invalid reason. Choose: ' + validReasons.join(', ') });
  }

  try {
    // Verify the buyer actually purchased this voucher
    const txCheck = await pool.query(
      `SELECT t.id, t.seller_id, v.title, v.brand, v.seller_id as voucher_seller_id
       FROM transactions t
       JOIN vouchers v ON v.id = t.voucher_id
       WHERE t.voucher_id = $1 AND t.buyer_id = $2 AND t.status = 'completed'
       LIMIT 1`,
      [voucherId, buyerId]
    );

    if (!txCheck.rows[0]) {
      return res.status(403).json({ error: 'You can only report vouchers you have purchased' });
    }

    const tx = txCheck.rows[0];

    // Check not already reported by this buyer
    const alreadyReported = await pool.query(
      'SELECT id FROM voucher_fraud_reports WHERE voucher_id = $1 AND reported_by = $2',
      [voucherId, buyerId]
    );
    if (alreadyReported.rows[0]) {
      return res.status(400).json({ error: 'You have already reported this voucher' });
    }

    // Create the report
    const reportRes = await pool.query(
      `INSERT INTO voucher_fraud_reports
         (voucher_id, transaction_id, reported_by, seller_id, reason, description, evidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [voucherId, transaction_id || txCheck.rows[0].id, buyerId, tx.voucher_seller_id, reason, description, evidence]
    );

    // Increment reported count on voucher
    await pool.query(
      'UPDATE vouchers SET reported_invalid_count = reported_invalid_count + 1 WHERE id = $1',
      [voucherId]
    );

    // Auto-block voucher if reported 2+ times
    const voucherRes = await pool.query(
      'SELECT reported_invalid_count FROM vouchers WHERE id = $1',
      [voucherId]
    );

    if (voucherRes.rows[0].reported_invalid_count >= 2) {
      await pool.query(
        "UPDATE vouchers SET status = 'pending', auto_blocked = true, verification_status = 'pending_review' WHERE id = $1",
        [voucherId]
      );
      console.log(`[fraud] Auto-blocked voucher ${voucherId} — ${voucherRes.rows[0].reported_invalid_count} reports`);
    }

    // Notify admin
    notifyAdminOfReport(reportRes.rows[0], tx, req.user).catch(() => {});

    res.json({
      message: 'Report submitted. Our team will review within 24 hours.',
      report_id: reportRes.rows[0].id,
    });
  } catch (err) {
    console.error('[fraud-report] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: REVIEW A FRAUD REPORT
// POST /api/admin/fraud-reports/:id/review
// ─────────────────────────────────────────────────────────────────────────────
const reviewFraudReport = async (req, res) => {
  const { action, admin_note } = req.body;
  // action: 'confirm' | 'dismiss'

  if (!['confirm', 'dismiss'].includes(action)) {
    return res.status(400).json({ error: 'Action must be confirm or dismiss' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reportRes = await client.query(
      `SELECT fr.*, v.title, v.brand, v.seller_id,
         buyer.name as buyer_name, buyer.email as buyer_email,
         seller.name as seller_name, seller.email as seller_email,
         t.amount
       FROM voucher_fraud_reports fr
       JOIN vouchers v ON fr.voucher_id = v.id
       JOIN users buyer ON fr.reported_by = buyer.id
       JOIN users seller ON fr.seller_id = seller.id
       LEFT JOIN transactions t ON fr.transaction_id = t.id
       WHERE fr.id = $1 AND fr.status = 'pending'`,
      [req.params.id]
    );

    const report = reportRes.rows[0];
    if (!report) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Report not found or already reviewed' });
    }

    if (action === 'confirm') {
      // Mark report confirmed
      await client.query(
        `UPDATE voucher_fraud_reports
         SET status = 'confirmed', reviewed_by = $1, reviewed_at = NOW()
         WHERE id = $2`,
        [req.user.id, req.params.id]
      );

      // Keep voucher blocked
      await client.query(
        "UPDATE vouchers SET status = 'pending', verification_status = 'rejected', rejection_reason = $1 WHERE id = $2",
        [`Fraud confirmed: ${report.reason}. ${admin_note || ''}`, report.voucher_id]
      );

      // Increment seller's invalid voucher count
      await client.query(
        'UPDATE users SET total_invalid_vouchers = total_invalid_vouchers + 1 WHERE id = $1',
        [report.seller_id]
      );

      // Issue strike to seller
      const strikeSeverity = await issueFraudFlag(
        report.seller_id, report.voucher_id,
        `confirmed_fraud_${report.reason}`,
        `Fraud confirmed: buyer reported "${report.reason}" for voucher "${report.title}"`,
        null, // auto-determined
        client
      );

      // Refund buyer automatically
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [report.amount, report.reported_by]
      );
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, description, reference_id)
         VALUES ($1, 'credit', $2, $3, $4)`,
        [report.reported_by, report.amount,
         `Refund: Invalid voucher confirmed (${report.brand} — ${report.reason})`,
         report.transaction_id]
      );

      // Deduct from seller
      await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [report.amount, report.seller_id]
      );
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, description)
         VALUES ($1, 'debit', $2, $3)`,
        [report.seller_id, report.amount,
         `Fraud penalty: Invalid voucher refunded to buyer (${report.title})`]
      );

      await client.query('COMMIT');

      // Emails
      sendEmail('fraud_report_confirmed_buyer', report.buyer_email, {
        buyerName: report.buyer_name,
        voucherTitle: report.title,
        brand: report.brand,
        refundAmount: report.amount,
        reason: report.reason,
      }).catch(() => {});

      sendEmail('fraud_report_confirmed_seller', report.seller_email, {
        sellerName: report.seller_name,
        voucherTitle: report.title,
        reason: report.reason,
        penalty: report.amount,
        strikeSeverity,
      }).catch(() => {});

      res.json({ message: 'Fraud confirmed — buyer refunded, seller penalised', strike: strikeSeverity });

    } else {
      // Dismiss — unblock the voucher
      await client.query(
        `UPDATE voucher_fraud_reports
         SET status = 'dismissed', reviewed_by = $1, reviewed_at = NOW()
         WHERE id = $2`,
        [req.user.id, req.params.id]
      );

      await client.query(
        "UPDATE vouchers SET status = 'active', auto_blocked = false, verification_status = 'approved' WHERE id = $1",
        [report.voucher_id]
      );

      await client.query('COMMIT');

      sendEmail('fraud_report_dismissed', report.buyer_email, {
        buyerName: report.buyer_name,
        voucherTitle: report.title,
        reason: report.reason,
      }).catch(() => {});

      res.json({ message: 'Report dismissed — voucher restored' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[review-report] error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE FRAUD FLAG / STRIKE / BAN to seller
// Automatically escalates: warning → strike → ban
// ─────────────────────────────────────────────────────────────────────────────
const issueFraudFlag = async (sellerId, voucherId, strikeType, description, forceSeverity = null, client = null) => {
  const db = client || pool;

  // Count existing strikes
  const countRes = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE severity = 'warning') as warnings,
       COUNT(*) FILTER (WHERE severity = 'strike') as strikes
     FROM seller_strikes WHERE seller_id = $1`,
    [sellerId]
  );

  const warnings = parseInt(countRes.rows[0].warnings) || 0;
  const strikes = parseInt(countRes.rows[0].strikes) || 0;

  // Auto-escalate severity
  let severity = forceSeverity;
  if (!severity) {
    if (strikes >= THRESHOLDS.strikes_before_suspend - 1) severity = 'ban';
    else if (warnings >= THRESHOLDS.warnings_before_flag - 1) severity = 'strike';
    else severity = 'warning';
  }

  // Insert strike record
  await db.query(
    `INSERT INTO seller_strikes (seller_id, voucher_id, strike_type, severity, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [sellerId, voucherId, strikeType, severity, description]
  );

  // Update fraud score
  const scoreIncrease = severity === 'ban' ? 50 : severity === 'strike' ? 25 : 10;
  await db.query(
    'UPDATE users SET fraud_score = LEAST(fraud_score + $1, 100) WHERE id = $2',
    [scoreIncrease, sellerId]
  );

  if (severity === 'ban' || severity === 'strike') {
    await db.query(
      `UPDATE users
       SET is_flagged = true, flagged_at = NOW(),
           flagged_reason = $1,
           is_suspended = $2,
           suspension_reason = $3
       WHERE id = $4`,
      [
        description,
        severity === 'ban',
        severity === 'ban' ? `Auto-banned: ${description}` : null,
        sellerId,
      ]
    );
  }

  console.log(`[fraud] ${severity.toUpperCase()} issued to seller ${sellerId}: ${description}`);
  return severity;
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: List fraud reports
// GET /api/admin/fraud-reports
// ─────────────────────────────────────────────────────────────────────────────
const listFraudReports = async (req, res) => {
  const { status = 'pending', page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const where = status !== 'all' ? 'WHERE fr.status = $1' : '';
    const params = status !== 'all' ? [status, limit, offset] : [limit, offset];
    const idx = status !== 'all' ? 2 : 1;

    const result = await pool.query(
      `SELECT
         fr.*,
         v.title as voucher_title, v.brand, v.selling_price,
         buyer.name as buyer_name, buyer.email as buyer_email,
         seller.name as seller_name, seller.email as seller_email,
         seller.fraud_score, seller.total_invalid_vouchers,
         COUNT(ss.id) as seller_strikes
       FROM voucher_fraud_reports fr
       JOIN vouchers v ON fr.voucher_id = v.id
       JOIN users buyer ON fr.reported_by = buyer.id
       JOIN users seller ON fr.seller_id = seller.id
       LEFT JOIN seller_strikes ss ON ss.seller_id = seller.id
       ${where}
       GROUP BY fr.id, v.title, v.brand, v.selling_price,
                buyer.name, buyer.email,
                seller.name, seller.email, seller.fraud_score, seller.total_invalid_vouchers
       ORDER BY fr.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM voucher_fraud_reports fr ${where}`,
      status !== 'all' ? [status] : []
    );

    res.json({
      reports: result.rows,
      total: parseInt(countRes.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Get seller fraud profile
// GET /api/admin/sellers/:id/fraud-profile
// ─────────────────────────────────────────────────────────────────────────────
const getSellerFraudProfile = async (req, res) => {
  try {
    const [userRes, strikesRes, reportsRes] = await Promise.all([
      pool.query(
        `SELECT id, name, email, fraud_score, total_invalid_vouchers,
                is_flagged, flagged_reason, flagged_at, is_suspended,
                total_sold, created_at
         FROM users WHERE id = $1`,
        [req.params.id]
      ),
      pool.query(
        'SELECT * FROM seller_strikes WHERE seller_id = $1 ORDER BY created_at DESC',
        [req.params.id]
      ),
      pool.query(
        `SELECT fr.*, v.title, v.brand
         FROM voucher_fraud_reports fr
         JOIN vouchers v ON fr.voucher_id = v.id
         WHERE fr.seller_id = $1
         ORDER BY fr.created_at DESC LIMIT 20`,
        [req.params.id]
      ),
    ]);

    if (!userRes.rows[0]) return res.status(404).json({ error: 'Seller not found' });

    const user = userRes.rows[0];
    const invalidRate = user.total_sold > 0
      ? ((user.total_invalid_vouchers / user.total_sold) * 100).toFixed(1)
      : 0;

    res.json({
      seller: user,
      invalid_rate: `${invalidRate}%`,
      risk_level: user.fraud_score >= 75 ? 'critical'
        : user.fraud_score >= 50 ? 'high'
        : user.fraud_score >= 25 ? 'medium' : 'low',
      strikes: strikesRes.rows,
      reports: reportsRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Helper — notify admin email of new fraud report
const notifyAdminOfReport = async (report, tx, reporter) => {
  const adminRes = await pool.query(
    "SELECT email FROM users WHERE role IN ('admin','super_admin') LIMIT 1"
  );
  if (!adminRes.rows[0]) return;

  await sendEmail('admin_fraud_alert', adminRes.rows[0].email, {
    reportId: report.id.slice(0, 8).toUpperCase(),
    voucherTitle: tx.title,
    brand: tx.brand,
    reason: report.reason,
    reporterName: reporter.name,
    amount: tx.amount,
  });
};

module.exports = {
  hashCode,
  checkDuplicateCode,
  validateCodeFormat,
  checkSellerHistory,
  reportInvalidVoucher,
  reviewFraudReport,
  listFraudReports,
  getSellerFraudProfile,
  issueFraudFlag,
};
