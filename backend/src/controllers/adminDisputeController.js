const pool = require('../config/db');

// GET /admin/disputes
const listDisputes = async (req, res) => {
  const { status = 'open', priority, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let conditions = [];
    let params = [];
    let idx = 1;

    if (status !== 'all') { conditions.push(`d.status = $${idx++}`); params.push(status); }
    if (priority) { conditions.push(`d.priority = $${idx++}`); params.push(priority); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM disputes d ${where}`, params);

    const result = await pool.query(
      `SELECT d.*,
         t.amount as transaction_amount, t.commission,
         v.title as voucher_title, v.brand as voucher_brand,
         raiser.name as raised_by_name, raiser.email as raised_by_email,
         accused.name as against_user_name, accused.email as against_user_email,
         resolver.name as resolved_by_name
       FROM disputes d
       LEFT JOIN transactions t ON d.transaction_id = t.id
       LEFT JOIN vouchers v ON t.voucher_id = v.id
       LEFT JOIN users raiser ON d.raised_by = raiser.id
       LEFT JOIN users accused ON d.against_user = accused.id
       LEFT JOIN users resolver ON d.resolved_by = resolver.id
       ${where}
       ORDER BY
         CASE d.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         d.created_at ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      disputes: result.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /admin/disputes/:id
const getDispute = async (req, res) => {
  try {
    const [disputeRes, messagesRes] = await Promise.all([
      pool.query(
        `SELECT d.*,
           t.amount as transaction_amount, t.commission, t.seller_earning, t.status as tx_status,
           v.title as voucher_title, v.brand, v.original_value, v.selling_price, v.code as voucher_code,
           raiser.name as raised_by_name, raiser.email as raised_by_email,
           accused.name as against_user_name, accused.email as against_user_email,
           resolver.name as resolved_by_name
         FROM disputes d
         LEFT JOIN transactions t ON d.transaction_id = t.id
         LEFT JOIN vouchers v ON t.voucher_id = v.id
         LEFT JOIN users raiser ON d.raised_by = raiser.id
         LEFT JOIN users accused ON d.against_user = accused.id
         LEFT JOIN users resolver ON d.resolved_by = resolver.id
         WHERE d.id = $1`,
        [req.params.id]
      ),
      pool.query(
        `SELECT dm.*, u.name as sender_name, u.role as sender_role
         FROM dispute_messages dm
         LEFT JOIN users u ON dm.sender_id = u.id
         WHERE dm.dispute_id = $1 ORDER BY dm.created_at ASC`,
        [req.params.id]
      ),
    ]);

    if (!disputeRes.rows[0]) return res.status(404).json({ error: 'Dispute not found' });
    res.json({ dispute: disputeRes.rows[0], messages: messagesRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /admin/disputes/:id/message
const sendMessage = async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
  try {
    const result = await pool.query(
      'INSERT INTO dispute_messages (dispute_id, sender_id, message, is_admin) VALUES ($1, $2, $3, true) RETURNING *',
      [req.params.id, req.user.id, message]
    );
    // Update dispute status to under_review if still open
    await pool.query(
      "UPDATE disputes SET status = 'under_review', updated_at = NOW() WHERE id = $1 AND status = 'open'",
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /admin/disputes/:id/resolve
const resolveDispute = async (req, res) => {
  const { resolution, outcome, refund_amount } = req.body;
  // outcome: 'favor_buyer' | 'favor_seller' | 'split' | 'dismissed'
  if (!resolution || !outcome) return res.status(400).json({ error: 'Resolution and outcome required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const disputeRes = await client.query(
      `SELECT d.*, t.buyer_id, t.seller_id, t.amount, t.commission
       FROM disputes d
       LEFT JOIN transactions t ON d.transaction_id = t.id
       WHERE d.id = $1 AND d.status NOT IN ('resolved','dismissed')
       FOR UPDATE`,
      [req.params.id]
    );
    const dispute = disputeRes.rows[0];
    if (!dispute) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Dispute not found or already resolved' }); }

    let refundIssued = false;
    let actualRefund = 0;

    // Handle refund if buyer wins
    if ((outcome === 'favor_buyer' || outcome === 'split') && refund_amount > 0) {
      actualRefund = parseFloat(refund_amount);
      // Deduct from seller, credit buyer
      await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [actualRefund, dispute.seller_id]);
      await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [actualRefund, dispute.buyer_id]);
      await client.query(
        "INSERT INTO wallet_transactions (user_id, type, amount, description, reference_id) VALUES ($1, 'debit', $2, $3, $4)",
        [dispute.seller_id, actualRefund, `Dispute refund: ${req.params.id}`, dispute.transaction_id]
      );
      await client.query(
        "INSERT INTO wallet_transactions (user_id, type, amount, description, reference_id) VALUES ($1, 'credit', $2, $3, $4)",
        [dispute.buyer_id, actualRefund, `Dispute refund received: ${req.params.id}`, dispute.transaction_id]
      );
      refundIssued = true;
    }

    const status = outcome === 'dismissed' ? 'dismissed' : 'resolved';
    await client.query(
      `UPDATE disputes SET
         status = $1, resolution = $2, resolved_by = $3, resolved_at = NOW(),
         refund_issued = $4, refund_amount = $5, updated_at = NOW()
       WHERE id = $6`,
      [status, resolution, req.user.id, refundIssued, actualRefund || null, req.params.id]
    );

    // Update transaction status if refunded
    if (refundIssued) {
      await client.query("UPDATE transactions SET status = 'refunded' WHERE id = $1", [dispute.transaction_id]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Dispute resolved', refund_issued: refundIssued, refund_amount: actualRefund });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// POST /admin/disputes/:id/priority
const updatePriority = async (req, res) => {
  const { priority } = req.body;
  if (!['low', 'normal', 'high', 'urgent'].includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  try {
    await pool.query('UPDATE disputes SET priority = $1, updated_at = NOW() WHERE id = $2', [priority, req.params.id]);
    res.json({ message: 'Priority updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// User raises a dispute (non-admin)
const raiseDispute = async (req, res) => {
  const { transaction_id, type, description, evidence_url } = req.body;
  if (!transaction_id || !type || !description) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const txRes = await pool.query(
      'SELECT * FROM transactions WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)',
      [transaction_id, req.user.id]
    );
    const tx = txRes.rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const existing = await pool.query(
      "SELECT id FROM disputes WHERE transaction_id = $1 AND status NOT IN ('resolved','dismissed')",
      [transaction_id]
    );
    if (existing.rows[0]) return res.status(400).json({ error: 'Dispute already open for this transaction' });

    const against = tx.buyer_id === req.user.id ? tx.seller_id : tx.buyer_id;
    const result = await pool.query(
      'INSERT INTO disputes (transaction_id, raised_by, against_user, type, description, evidence_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [transaction_id, req.user.id, against, type, description, evidence_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { listDisputes, getDispute, sendMessage, resolveDispute, updatePriority, raiseDispute };
