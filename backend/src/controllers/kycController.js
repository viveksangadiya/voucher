const pool = require('../config/db');
const { notifyKycApproved, notifyKycRejected } = require('../services/notificationService');

// POST /api/kyc/submit
const submitKyc = async (req, res) => {
  const {
    full_name, dob, pan_number, aadhaar_last4,
    bank_name, account_number, ifsc_code, account_holder,
  } = req.body;

  // Basic validation
  if (!full_name || !dob || !bank_name || !account_number || !ifsc_code || !account_holder) {
    return res.status(400).json({ error: 'All bank details and full name are required' });
  }
  if (ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid IFSC code format (e.g. SBIN0001234)' });
  }
  if (pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan_number.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid PAN number format (e.g. ABCDE1234F)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check current status
    const existing = await client.query(
      'SELECT status FROM kyc_submissions WHERE user_id = $1',
      [req.user.id]
    );

    if (existing.rows[0]) {
      const { status } = existing.rows[0];
      if (status === 'approved') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Your KYC is already approved' });
      }
      if (status === 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Your KYC is already under review' });
      }
      // status === 'rejected' — allow resubmission
      await client.query(
        `UPDATE kyc_submissions
         SET full_name=$1, dob=$2, pan_number=$3, aadhaar_last4=$4,
             bank_name=$5, account_number=$6, ifsc_code=$7, account_holder=$8,
             status='pending', rejection_reason=NULL, submitted_at=NOW(), reviewed_at=NULL
         WHERE user_id=$9`,
        [full_name, dob, pan_number?.toUpperCase() || null, aadhaar_last4 || null,
         bank_name, account_number, ifsc_code.toUpperCase(), account_holder, req.user.id]
      );
    } else {
      await client.query(
        `INSERT INTO kyc_submissions
           (user_id, full_name, dob, pan_number, aadhaar_last4, bank_name, account_number, ifsc_code, account_holder)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [req.user.id, full_name, dob, pan_number?.toUpperCase() || null, aadhaar_last4 || null,
         bank_name, account_number, ifsc_code.toUpperCase(), account_holder]
      );
    }

    await client.query(
      "UPDATE users SET kyc_status = 'pending' WHERE id = $1",
      [req.user.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'KYC submitted successfully. We will review within 1-2 business days.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[kyc submit]', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// GET /api/kyc/status
const getKycStatus = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, status, full_name, dob, bank_name, account_number, ifsc_code,
              account_holder, pan_number, aadhaar_last4, rejection_reason, submitted_at, reviewed_at
       FROM kyc_submissions WHERE user_id = $1`,
      [req.user.id]
    );
    const userRes = await pool.query('SELECT kyc_status FROM users WHERE id = $1', [req.user.id]);

    res.json({
      kyc_status: userRes.rows[0]?.kyc_status || 'none',
      submission: result.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ── ADMIN ──────────────────────────────────────────────────────────────────

// GET /api/admin/kyc?status=pending
const listKyc = async (req, res) => {
  const { status = 'pending', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const result = await pool.query(
      `SELECT k.*, u.name as user_name, u.email as user_email, u.total_sold, u.balance
       FROM kyc_submissions k
       JOIN users u ON k.user_id = u.id
       ${status !== 'all' ? 'WHERE k.status = $1' : ''}
       ORDER BY k.submitted_at DESC
       LIMIT ${status !== 'all' ? '$2' : '$1'} OFFSET ${status !== 'all' ? '$3' : '$2'}`,
      status !== 'all' ? [status, limit, offset] : [limit, offset]
    );
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM kyc_submissions ${status !== 'all' ? 'WHERE status = $1' : ''}`,
      status !== 'all' ? [status] : []
    );
    res.json({ submissions: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/admin/kyc/:id/approve
const approveKyc = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const kycRes = await client.query('SELECT * FROM kyc_submissions WHERE id = $1', [req.params.id]);
    const kyc = kycRes.rows[0];
    if (!kyc) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'KYC not found' }); }
    if (kyc.status === 'approved') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already approved' }); }

    await client.query(
      `UPDATE kyc_submissions SET status='approved', reviewed_at=NOW(), reviewed_by=$1 WHERE id=$2`,
      [req.user.id, req.params.id]
    );
    await client.query(
      `UPDATE users SET kyc_status='approved', is_verified=true WHERE id=$1`,
      [kyc.user_id]
    );

    await client.query('COMMIT');
    await notifyKycApproved(kyc.user_id);
    res.json({ message: 'KYC approved' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// POST /api/admin/kyc/:id/reject
const rejectKyc = async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const kycRes = await client.query('SELECT * FROM kyc_submissions WHERE id = $1', [req.params.id]);
    const kyc = kycRes.rows[0];
    if (!kyc) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'KYC not found' }); }

    await client.query(
      `UPDATE kyc_submissions SET status='rejected', rejection_reason=$1, reviewed_at=NOW(), reviewed_by=$2 WHERE id=$3`,
      [reason, req.user.id, req.params.id]
    );
    await client.query(
      `UPDATE users SET kyc_status='rejected', is_verified=false WHERE id=$1`,
      [kyc.user_id]
    );

    await client.query('COMMIT');
    await notifyKycRejected(kyc.user_id, reason);
    res.json({ message: 'KYC rejected' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = { submitKyc, getKycStatus, listKyc, approveKyc, rejectKyc };
