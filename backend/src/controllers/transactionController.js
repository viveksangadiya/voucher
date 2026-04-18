const pool = require('../config/db');
const { sendEmail } = require('../services/emailService');
const { notifyVoucherSold, notifyVoucherPurchased, notifyWalletCredit, notifyWalletDebit, notifyWithdrawalApproved, notifyWithdrawalRejected } = require('../services/notificationService');

const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE) || 0.20;

const purchaseVoucher = async (req, res) => {
  const { voucher_id, payment_method = 'wallet' } = req.body;
  const buyer_id = req.user.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const voucherResult = await client.query(
      'SELECT * FROM vouchers WHERE id = $1 AND status = $2 FOR UPDATE',
      [voucher_id, 'active']
    );
    const voucher = voucherResult.rows[0];
    if (!voucher) return res.status(404).json({ error: 'Voucher not available' });
    if (voucher.seller_id === buyer_id) return res.status(400).json({ error: 'Cannot buy your own voucher' });

    if (voucher.expiry_date && new Date(voucher.expiry_date) < new Date()) {
      await client.query("UPDATE vouchers SET status = 'expired' WHERE id = $1", [voucher_id]);
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Voucher has expired' });
    }

    const amount = parseFloat(voucher.selling_price);
    const commission = parseFloat((amount * COMMISSION_RATE).toFixed(2));
    const seller_earning = parseFloat((amount - commission).toFixed(2));

    const buyerResult = await client.query(
      'SELECT balance, name, email FROM users WHERE id = $1 FOR UPDATE',
      [buyer_id]
    );
    const buyer = buyerResult.rows[0];
    if (parseFloat(buyer.balance) < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Insufficient wallet balance',
        required: amount,
        available: parseFloat(buyer.balance),
      });
    }

    await client.query(
      'UPDATE users SET balance = balance - $1, total_bought = total_bought + 1 WHERE id = $2',
      [amount, buyer_id]
    );

    const sellerResult = await client.query(
      'UPDATE users SET balance = balance + $1, total_sold = total_sold + 1 WHERE id = $2 RETURNING name, email',
      [seller_earning, voucher.seller_id]
    );
    const seller = sellerResult.rows[0];

    await client.query("UPDATE vouchers SET status = 'sold', updated_at = NOW() WHERE id = $1", [voucher_id]);

    const txResult = await client.query(
      `INSERT INTO transactions (voucher_id, buyer_id, seller_id, amount, commission, seller_earning, status, payment_method, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, NOW()) RETURNING *`,
      [voucher_id, buyer_id, voucher.seller_id, amount, commission, seller_earning, payment_method]
    );
    const tx = txResult.rows[0];

    await client.query(
      "INSERT INTO wallet_transactions (user_id, type, amount, description, reference_id) VALUES ($1, 'debit', $2, $3, $4)",
      [buyer_id, amount, `Purchase: ${voucher.title}`, tx.id]
    );
    await client.query(
      "INSERT INTO wallet_transactions (user_id, type, amount, description, reference_id) VALUES ($1, 'credit', $2, $3, $4)",
      [voucher.seller_id, seller_earning, `Sale: ${voucher.title} (after 20% commission)`, tx.id]
    );

    await client.query('COMMIT');
    // Fire notifications (after commit — non-blocking)
const buyerRes = await pool.query('SELECT name FROM users WHERE id = $1', [buyer_id]);
const sellerVoucherRes = await pool.query('SELECT title, brand FROM vouchers WHERE id = $1', [voucher_id]);

notifyVoucherSold(
  voucher.seller_id,
  buyerRes.rows[0]?.name || 'A buyer',
  voucher.title,
  amount,
  voucher_id,
  txResult.rows[0].id
);
notifyVoucherPurchased(
  buyer_id,
  voucher.title,
  voucher.brand,
  amount,
  voucher_id
);

    // Send emails — non-blocking, fire and forget
    sendEmail('purchase_success', buyer.email, {
      buyerName: buyer.name,
      voucherTitle: voucher.title,
      brand: voucher.brand,
      amount,
      code: voucher.code,
      transactionId: tx.id,
    }, buyer_id, tx.id).catch(() => {});

    sendEmail('sale_success', seller.email, {
      sellerName: seller.name,
      buyerName: buyer.name,
      voucherTitle: voucher.title,
      amount,
      commission,
      sellerEarning: seller_earning,
    }, voucher.seller_id, tx.id).catch(() => {});

    res.json({
      transaction: tx,
      voucher_code: voucher.code,
      message: 'Purchase successful! Voucher code revealed.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Transaction failed' });
  } finally {
    client.release();
  }
};

const getMyTransactions = async (req, res) => {
  const { role = 'buyer' } = req.query;
  try {
    const userField = role === 'seller' ? 'seller_id' : 'buyer_id';
    const result = await pool.query(
      `SELECT t.*, v.title as voucher_title, v.brand as voucher_brand, v.image_url,
        buyer.name as buyer_name, seller.name as seller_name
       FROM transactions t
       LEFT JOIN vouchers v ON t.voucher_id = v.id
       LEFT JOIN users buyer ON t.buyer_id = buyer.id
       LEFT JOIN users seller ON t.seller_id = seller.id
       WHERE t.${userField} = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Legacy addFunds — kept for manual admin credits, Razorpay handles real top-ups now
const addFunds = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0 || amount > 100000) return res.status(400).json({ error: 'Invalid amount' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [amount, req.user.id]
    );
    await client.query(
      "INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES ($1, 'credit', $2, 'Manual wallet credit')",
      [req.user.id, amount]
    );
    await client.query('COMMIT');
    res.json({ balance: result.rows[0].balance, message: 'Funds added successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

const getWalletHistory = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const [userResult, salesResult, purchasesResult, activeVouchersResult, walletResult] = await Promise.all([
      pool.query('SELECT balance, total_sold, total_bought, rating FROM users WHERE id = $1', [req.user.id]),
      pool.query('SELECT COALESCE(SUM(seller_earning), 0) as total_earned, COUNT(*) as sales_count FROM transactions WHERE seller_id = $1 AND status = $2', [req.user.id, 'completed']),
      pool.query('SELECT COALESCE(SUM(amount), 0) as total_spent FROM transactions WHERE buyer_id = $1 AND status = $2', [req.user.id, 'completed']),
      pool.query("SELECT COUNT(*) as active_listings FROM vouchers WHERE seller_id = $1 AND status = 'active'", [req.user.id]),
      pool.query('SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5', [req.user.id]),
    ]);

    res.json({
      balance: parseFloat(userResult.rows[0].balance),
      rating: userResult.rows[0].rating,
      total_sold: userResult.rows[0].total_sold,
      total_bought: userResult.rows[0].total_bought,
      total_earned: parseFloat(salesResult.rows[0].total_earned),
      sales_count: parseInt(salesResult.rows[0].sales_count),
      total_spent: parseFloat(purchasesResult.rows[0].total_spent),
      active_listings: parseInt(activeVouchersResult.rows[0].active_listings),
      recent_wallet: walletResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { purchaseVoucher, getMyTransactions, addFunds, getWalletHistory, getDashboardStats };
