const Razorpay = require('razorpay');
const crypto = require('crypto');
const pool = require('../config/db');
const { sendEmail } = require('../services/emailService');
const { notifyWithdrawalRejected, notifyWithdrawalApproved, notifyWalletCredit } = require('../services/notificationService');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// DEPOSIT — Step 1: Create Razorpay order
// POST /api/wallet/create-order
// ─────────────────────────────────────────────────────────────────────────────
const createDepositOrder = async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount < 10 || amount > 100000) {
    return res.status(400).json({ error: 'Amount must be between ₹10 and ₹1,00,000' });
  }

  try {
    const amountInPaise = Math.round(parseFloat(amount) * 100); // Razorpay uses paise
    const receipt = `rcpt_${req.user.id.slice(0, 8)}_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        user_id: req.user.id,
        user_email: req.user.email,
      },
    });

    // Save order to DB
    await pool.query(
      `INSERT INTO razorpay_orders (user_id, razorpay_order_id, amount, receipt)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, order.id, amount, receipt]
    );

    res.json({
      order_id: order.id,
      amount: amountInPaise,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID,
      name: 'VouchEx',
      description: 'Wallet Top-up',
      prefill: {
        name: req.user.name,
        email: req.user.email,
      },
    });
  } catch (err) {
    console.error('[razorpay] create order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DEPOSIT — Step 2: Verify payment signature & credit wallet
// POST /api/wallet/verify-payment
// ─────────────────────────────────────────────────────────────────────────────
const verifyDeposit = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Verify signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification failed — invalid signature' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the order
    const orderRes = await client.query(
      `SELECT * FROM razorpay_orders
       WHERE razorpay_order_id = $1 AND user_id = $2 AND status = 'created'
       FOR UPDATE`,
      [razorpay_order_id, req.user.id]
    );

    const order = orderRes.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order not found or already processed' });
    }

    const amount = parseFloat(order.amount);

    // Credit wallet
    const balanceRes = await client.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance, name, email',
      [amount, req.user.id]
    );
    const { balance: newBalance, name, email } = balanceRes.rows[0];

    // Update order status
    await client.query(
      `UPDATE razorpay_orders
       SET status = 'paid', razorpay_payment_id = $1, paid_at = NOW()
       WHERE razorpay_order_id = $2`,
      [razorpay_payment_id, razorpay_order_id]
    );

    // Wallet transaction log
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, description, reference_id)
       VALUES ($1, 'credit', $2, $3, $4)`,
      [req.user.id, amount, `Wallet top-up via Razorpay (${razorpay_payment_id})`, order.id]
    );

    await client.query('COMMIT');

    // Send email (non-blocking)
    sendEmail('wallet_topup', email, {
      userName: name,
      amount,
      newBalance,
      paymentId: razorpay_payment_id,
    }, req.user.id).catch(() => {});
    notifyWalletCredit(req.user.id, amount, 'via Razorpay deposit');

    res.json({
      success: true,
      amount,
      new_balance: newBalance,
      message: `₹${amount} added to your wallet!`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[razorpay] verify payment error:', err);
    res.status(500).json({ error: 'Failed to process payment' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// WITHDRAWAL — User requests withdrawal to bank
// POST /api/wallet/withdraw
// ─────────────────────────────────────────────────────────────────────────────
const requestWithdrawal = async (req, res) => {
  const { amount, bank_account, ifsc_code, account_name } = req.body;

  if (!amount || amount < 100) {
    return res.status(400).json({ error: 'Minimum withdrawal is ₹100' });
  }
  if (!bank_account || !ifsc_code || !account_name) {
    return res.status(400).json({ error: 'Bank account details are required' });
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid IFSC code format' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check balance
    const balRes = await client.query(
      'SELECT balance, name, email FROM users WHERE id = $1 FOR UPDATE',
      [req.user.id]
    );
    const { balance, name, email } = balRes.rows[0];

    if (parseFloat(balance) < parseFloat(amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Check no pending withdrawal exists
    const pendingRes = await client.query(
      "SELECT id FROM withdrawal_requests WHERE user_id = $1 AND status IN ('pending','processing')",
      [req.user.id]
    );
    if (pendingRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You already have a pending withdrawal request' });
    }

    // Deduct from wallet immediately (hold funds)
    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, req.user.id]
    );

    // Wallet debit log
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, description)
       VALUES ($1, 'debit', $2, 'Withdrawal request — funds on hold')`,
      [req.user.id, amount]
    );

    // Create withdrawal request
    const wdRes = await client.query(
      `INSERT INTO withdrawal_requests
         (user_id, amount, bank_account, ifsc_code, account_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, amount, bank_account, ifsc_code.toUpperCase(), account_name]
    );

    await client.query('COMMIT');

    // Email user
    const accountLast4 = bank_account.slice(-4);
    sendEmail('withdrawal_requested', email, {
      userName: name,
      amount,
      accountLast4,
    }, req.user.id, wdRes.rows[0].id).catch(() => {});

    res.json({
      message: 'Withdrawal request submitted. Processing in 1-3 business days.',
      withdrawal: wdRes.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[withdrawal] error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — List all withdrawal requests
// GET /api/admin/withdrawals
// ─────────────────────────────────────────────────────────────────────────────
const listWithdrawals = async (req, res) => {
  const { status = 'pending', page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let where = status !== 'all' ? "WHERE wr.status = $1" : '';
    const params = status !== 'all' ? [status, limit, offset] : [limit, offset];
    const limitIdx = status !== 'all' ? 2 : 1;

    const result = await pool.query(
      `SELECT wr.*, u.name as user_name, u.email as user_email, u.balance as current_balance
       FROM withdrawal_requests wr
       LEFT JOIN users u ON wr.user_id = u.id
       ${where}
       ORDER BY wr.created_at ASC
       LIMIT $${limitIdx} OFFSET $${limitIdx + 1}`,
      params
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM withdrawal_requests wr ${where}`,
      status !== 'all' ? [status] : []
    );

    res.json({
      withdrawals: result.rows,
      total: parseInt(countRes.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Process a withdrawal (approve/reject)
// POST /api/admin/withdrawals/:id/process
// ─────────────────────────────────────────────────────────────────────────────
const processWithdrawal1 = async (req, res) => {
  const { action, rejection_reason, razorpay_payout_id } = req.body;
  // action: 'approve' | 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve or reject' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const wdRes = await client.query(
      `SELECT * FROM withdrawal_requests
       WHERE id = $1 AND status IN ('pending','processing')
       FOR UPDATE`,
      [req.params.id]
    );
    
    const wd = wdRes.rows[0];
    if (!wd) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Withdrawal not found or already processed' });
    }
    
    // Fetch user details separately (no join needed for lock)
    const userRes = await client.query(
      'SELECT name, email FROM users WHERE id = $1',
      [wd.user_id]
    );
    wd.name = userRes.rows[0]?.name;
    wd.email = userRes.rows[0]?.email;

    if (action === 'approve') {
      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'completed', processed_by = $1, processed_at = NOW(),
             razorpay_payout_id = $2
         WHERE id = $3`,
        [req.user.id, razorpay_payout_id || null, req.params.id]
      );

      await client.query('COMMIT');

      sendEmail('withdrawal_completed', wd.email, {
        userName: wd.name,
        amount: wd.amount,
        payoutId: razorpay_payout_id,
      }, wd.user_id, wd.id).catch(() => {});

      res.json({ message: 'Withdrawal approved and marked completed' });

    } else {
      // Reject — refund the held amount back to wallet
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [wd.amount, wd.user_id]
      );
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, description)
         VALUES ($1, 'credit', $2, $3)`,
        [wd.user_id, wd.amount, `Withdrawal rejected — funds returned: ${rejection_reason || 'N/A'}`]
      );
      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'rejected', processed_by = $1, processed_at = NOW(), rejection_reason = $2
         WHERE id = $3`,
        [req.user.id, rejection_reason, req.params.id]
      );

      await client.query('COMMIT');

      sendEmail('withdrawal_rejected', wd.email, {
        userName: wd.name,
        amount: wd.amount,
        reason: rejection_reason,
      }, wd.user_id, wd.id).catch(() => {});

      res.json({ message: 'Withdrawal rejected and funds returned to wallet' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[withdrawal] process error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};
const processWithdrawal = async (req, res) => {
  const { action, rejection_reason } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve or reject' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the withdrawal row
    const wdRes = await client.query(
      `SELECT * FROM withdrawal_requests
       WHERE id = $1 AND status IN ('pending','processing')
       FOR UPDATE`,
      [req.params.id]
    );

    const wd = wdRes.rows[0];
    if (!wd) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Withdrawal not found or already processed' });
    }

    // Fetch user separately
    const userRes = await client.query(
      'SELECT name, email FROM users WHERE id = $1',
      [wd.user_id]
    );
    wd.name = userRes.rows[0]?.name;
    wd.email = userRes.rows[0]?.email;

    if (action === 'approve') {
      // Mark as processing first
      await client.query(
        `UPDATE withdrawal_requests SET status = 'processing' WHERE id = $1`,
        [req.params.id]
      );
      await client.query('COMMIT');
      client.release();
      notifyWithdrawalApproved(withdrawal.user_id, withdrawal.amount);


      try {
        // Step 1: Create or fetch contact
        const contact = await razorpay.contacts.create({
          name: wd.account_name,
          email: wd.email,
          type: 'vendor',
          reference_id: wd.user_id,
        });

        // Step 2: Create fund account (bank account)
        const fundAccount = await razorpay.fundAccount.create({
          contact_id: contact.id,
          account_type: 'bank_account',
          bank_account: {
            name: wd.account_name,
            ifsc: wd.ifsc_code,
            account_number: wd.bank_account,
          },
        });

        // Step 3: Trigger payout
        const payout = await razorpay.payouts.create({
          account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
          fund_account_id: fundAccount.id,
          amount: Math.round(parseFloat(wd.amount) * 100), // convert to paise
          currency: 'INR',
          mode: 'IMPS',  // IMPS = instant transfer
          purpose: 'payout',
          queue_if_low_balance: false,
          reference_id: wd.id,
          narration: 'VouchEx Withdrawal',
        });

        // Step 4: Mark completed with payout ID
        await pool.query(
          `UPDATE withdrawal_requests
           SET status = 'completed', processed_by = $1,
               processed_at = NOW(), razorpay_payout_id = $2
           WHERE id = $3`,
          [req.user.id, payout.id, req.params.id]
        );

        // Send success email
        sendEmail('withdrawal_completed', wd.email, {
          userName: wd.name,
          amount: wd.amount,
          payoutId: payout.id,
        }, wd.user_id, wd.id).catch(() => {});

        res.json({
          message: 'Payout triggered successfully',
          payout_id: payout.id,
          status: payout.status,
        });

      } catch (payoutErr) {
        // Payout API failed — refund wallet, mark rejected
        console.error('[razorpay] payout error:', payoutErr);

        const reason = payoutErr?.error?.description || payoutErr.message || 'Razorpay payout failed';

        // Refund wallet
        await pool.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [wd.amount, wd.user_id]
        );
        await pool.query(
          `INSERT INTO wallet_transactions (user_id, type, amount, description)
           VALUES ($1, 'credit', $2, $3)`,
          [wd.user_id, wd.amount, `Withdrawal failed — funds returned: ${reason}`]
        );
        await pool.query(
          `UPDATE withdrawal_requests
           SET status = 'rejected', processed_by = $1,
               processed_at = NOW(), rejection_reason = $2
           WHERE id = $3`,
          [req.user.id, reason, req.params.id]
        );

        sendEmail('withdrawal_rejected', wd.email, {
          userName: wd.name,
          amount: wd.amount,
          reason,
        }, wd.user_id, wd.id).catch(() => {});

        res.status(500).json({ error: `Payout failed: ${reason}` });
      }

    } else {
      // Reject — return funds to wallet
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [wd.amount, wd.user_id]
      );
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, description)
         VALUES ($1, 'credit', $2, $3)`,
        [wd.user_id, wd.amount, `Withdrawal rejected — funds returned: ${rejection_reason || 'N/A'}`]
      );
      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'rejected', processed_by = $1,
             processed_at = NOW(), rejection_reason = $2
         WHERE id = $3`,
        [req.user.id, rejection_reason, req.params.id]
      );

      await client.query('COMMIT');
      notifyWithdrawalRejected(withdrawal.user_id, withdrawal.amount, reason);

      sendEmail('withdrawal_rejected', wd.email, {
        userName: wd.name,
        amount: wd.amount,
        reason: rejection_reason,
      }, wd.user_id, wd.id).catch(() => {});

      res.json({ message: 'Withdrawal rejected and funds returned to wallet' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[withdrawal] process error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    // Only release if not already released above (approve path releases early)
    try { client.release(); } catch {}
  }
};

// Get user's own withdrawals
const getMyWithdrawals = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM withdrawal_requests WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createDepositOrder,
  verifyDeposit,
  requestWithdrawal,
  listWithdrawals,
  processWithdrawal,
  getMyWithdrawals,
};
