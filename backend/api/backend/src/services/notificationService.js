const pool = require('../config/db');

/**
 * Notification Types:
 *  voucher_sold       — seller: your voucher was purchased
 *  voucher_purchased  — buyer: you bought a voucher
 *  wallet_credit      — funds added to wallet
 *  wallet_debit       — funds deducted
 *  withdrawal_approved / withdrawal_rejected
 *  kyc_approved / kyc_rejected
 *  fraud_report_confirmed / fraud_report_dismissed
 *  dispute_update
 *  review_received    — seller got a new review
 *  review_reply       — buyer: seller replied to your review
 *  system             — generic admin broadcast
 */

const createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, type, title, message, JSON.stringify(data)]
    );
    return result.rows[0];
  } catch (err) {
    // Never crash the calling function if notification fails
    console.error('[notifications] createNotification failed:', err.message);
    return null;
  }
};

// ── Helpers — call these from controllers ────────────────────────────────────

const notifyVoucherSold = (sellerId, buyerName, voucherTitle, amount, voucherId, transactionId) =>
  createNotification(sellerId, 'voucher_sold', 'Voucher Sold! 🎉',
    `${buyerName} purchased your "${voucherTitle}" for ₹${parseFloat(amount).toFixed(2)}`,
    { voucher_id: voucherId, transaction_id: transactionId, amount }
  );

const notifyVoucherPurchased = (buyerId, voucherTitle, brand, amount, voucherId) =>
  createNotification(buyerId, 'voucher_purchased', 'Purchase Successful ✅',
    `You purchased "${voucherTitle}" by ${brand} for ₹${parseFloat(amount).toFixed(2)}. Check your dashboard for the code.`,
    { voucher_id: voucherId, amount }
  );

const notifyWalletCredit = (userId, amount, description) =>
  createNotification(userId, 'wallet_credit', 'Wallet Credited 💰',
    `₹${parseFloat(amount).toFixed(2)} has been added to your wallet. ${description || ''}`,
    { amount }
  );

const notifyWalletDebit = (userId, amount, description) =>
  createNotification(userId, 'wallet_debit', 'Wallet Debited',
    `₹${parseFloat(amount).toFixed(2)} has been deducted from your wallet. ${description || ''}`,
    { amount }
  );

const notifyWithdrawalApproved = (userId, amount) =>
  createNotification(userId, 'withdrawal_approved', 'Withdrawal Approved ✅',
    `Your withdrawal of ₹${parseFloat(amount).toFixed(2)} has been approved and will be credited to your bank within 2-3 business days.`,
    { amount }
  );

const notifyWithdrawalRejected = (userId, amount, reason) =>
  createNotification(userId, 'withdrawal_rejected', 'Withdrawal Rejected',
    `Your withdrawal of ₹${parseFloat(amount).toFixed(2)} was rejected. Reason: ${reason || 'Please contact support.'}. The amount has been refunded to your wallet.`,
    { amount, reason }
  );

const notifyKycApproved = (userId) =>
  createNotification(userId, 'kyc_approved', 'KYC Verified ✅',
    'Your KYC has been approved! You can now withdraw funds to your bank account.',
    {}
  );

const notifyKycRejected = (userId, reason) =>
  createNotification(userId, 'kyc_rejected', 'KYC Rejected',
    `Your KYC was rejected. Reason: ${reason}. Please resubmit with correct details.`,
    { reason }
  );

const notifyFraudReportConfirmed = (buyerId, voucherTitle, amount) =>
  createNotification(buyerId, 'fraud_report_confirmed', 'Refund Issued 💸',
    `Your fraud report for "${voucherTitle}" has been confirmed. ₹${parseFloat(amount).toFixed(2)} has been refunded to your wallet.`,
    { amount }
  );

const notifyFraudReportDismissed = (buyerId, voucherTitle) =>
  createNotification(buyerId, 'fraud_report_dismissed', 'Report Dismissed',
    `Your fraud report for "${voucherTitle}" was reviewed and dismissed after investigation.`,
    {}
  );

const notifyReviewReceived = (sellerId, reviewerName, rating, voucherTitle) =>
  createNotification(sellerId, 'review_received', 'New Review Received ⭐',
    `${reviewerName} gave you ${rating} star${rating !== 1 ? 's' : ''} for "${voucherTitle}".`,
    { rating }
  );

const notifyReviewReply = (buyerId, sellerName, voucherTitle) =>
  createNotification(buyerId, 'review_reply', 'Seller Replied to Your Review',
    `${sellerName} replied to your review for "${voucherTitle}".`,
    {}
  );

module.exports = {
  createNotification,
  notifyVoucherSold,
  notifyVoucherPurchased,
  notifyWalletCredit,
  notifyWalletDebit,
  notifyWithdrawalApproved,
  notifyWithdrawalRejected,
  notifyKycApproved,
  notifyKycRejected,
  notifyFraudReportConfirmed,
  notifyFraudReportDismissed,
  notifyReviewReceived,
  notifyReviewReply,
};
