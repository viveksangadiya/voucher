const express = require('express');
const router = express.Router();
const { auth, optionalAuth, requireAdmin, logAdminAction } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────
const { register, login, googleAuth, getMe, updateProfile, changePassword } = require('../controllers/authController');
const { getVouchers, getVoucher, createVoucher, updateVoucher, deleteVoucher, getMyVouchers } = require('../controllers/voucherController');
const { purchaseVoucher, getMyTransactions, addFunds, getWalletHistory, getDashboardStats } = require('../controllers/transactionController');
const { getCategories } = require('../controllers/categoryController');
const { createDepositOrder, verifyDeposit, requestWithdrawal, listWithdrawals, processWithdrawal, getMyWithdrawals } = require('../controllers/razorpayController');
const { createReview, getSellerReviews, checkReviewed, editReview, markHelpful, replyToReview, getMyReviews, adminDeleteReview } = require('../controllers/reviewController');
const { reportInvalidVoucher, reviewFraudReport, listFraudReports, getSellerFraudProfile } = require('../services/voucherFraudService');
const { getNotifications, getUnreadCount, markRead, markAllRead, deleteNotification, clearAll, broadcast } = require('../controllers/notificationController');
const { submitKyc, getKycStatus, listKyc, approveKyc, rejectKyc } = require('../controllers/kycController');
const adminVoucher  = require('../controllers/adminVoucherController');
const adminDispute  = require('../controllers/adminDisputeController');
const adminRevenue  = require('../controllers/adminRevenueController');
const { expireVouchers, snapshotRevenue, escalateStaleDisputes } = require('../jobs/cronJobs');

// ═════════════════════════════════════════════════════════════════════════════
// AUTH
// ═════════════════════════════════════════════════════════════════════════════
router.post('/auth/register',         register);
router.post('/auth/login',            login);
router.post('/auth/google',           googleAuth);
router.get('/auth/me',                auth, getMe);
router.put('/auth/profile',           auth, updateProfile);
router.put('/auth/change-password',   auth, changePassword);

// ═════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═════════════════════════════════════════════════════════════════════════════
router.get('/categories', getCategories);

// ═════════════════════════════════════════════════════════════════════════════
// VOUCHERS
// ═════════════════════════════════════════════════════════════════════════════
router.get('/vouchers',               optionalAuth, getVouchers);
router.get('/vouchers/mine',          auth,         getMyVouchers);
router.get('/vouchers/:id',           optionalAuth, getVoucher);
router.post('/vouchers',              auth,         createVoucher);
router.put('/vouchers/:id',           auth,         updateVoucher);
router.delete('/vouchers/:id',        auth,         deleteVoucher);
router.post('/vouchers/:id/report',   auth,         reportInvalidVoucher);

// ═════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ═════════════════════════════════════════════════════════════════════════════
router.post('/transactions/purchase', auth, purchaseVoucher);
router.get('/transactions',           auth, getMyTransactions);

// ═════════════════════════════════════════════════════════════════════════════
// WALLET
// ═════════════════════════════════════════════════════════════════════════════
router.get('/wallet/history',         auth, getWalletHistory);
router.get('/wallet/withdrawals',     auth, getMyWithdrawals);
router.post('/wallet/add-funds',      auth, addFunds);
router.post('/wallet/create-order',   auth, createDepositOrder);
router.post('/wallet/verify-payment', auth, verifyDeposit);
router.post('/wallet/withdraw',       auth, requestWithdrawal);

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
router.get('/dashboard/stats',        auth, getDashboardStats);

// ═════════════════════════════════════════════════════════════════════════════
// REVIEWS
// ═════════════════════════════════════════════════════════════════════════════
router.post('/reviews',                       auth,         createReview);
router.get('/reviews/mine',                   auth,         getMyReviews);
router.get('/reviews/check/:transactionId',   auth,         checkReviewed);
router.get('/reviews/seller/:userId',         optionalAuth, getSellerReviews);
router.put('/reviews/:id',                    auth,         editReview);
router.post('/reviews/:id/helpful',           auth,         markHelpful);
router.post('/reviews/:id/reply',             auth,         replyToReview);

// ═════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════════════════
router.get('/notifications',              auth, getNotifications);
router.get('/notifications/unread-count', auth, getUnreadCount);
router.post('/notifications/read-all',    auth, markAllRead);
router.delete('/notifications/clear-all', auth, clearAll);
router.post('/notifications/:id/read',    auth, markRead);
router.delete('/notifications/:id',       auth, deleteNotification);

// ═════════════════════════════════════════════════════════════════════════════
// KYC
// ═════════════════════════════════════════════════════════════════════════════
router.post('/kyc/submit',  auth, submitKyc);
router.get('/kyc/status',   auth, getKycStatus);

// ═════════════════════════════════════════════════════════════════════════════
// DISPUTES (user-facing)
// ═════════════════════════════════════════════════════════════════════════════
router.post('/disputes', auth, adminDispute.raiseDispute);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN
// ═════════════════════════════════════════════════════════════════════════════

// Voucher verification
router.get('/admin/vouchers',                 auth, requireAdmin, adminVoucher.listVouchers);
router.get('/admin/vouchers/pending-count',   auth, requireAdmin, adminVoucher.getPendingCount);
router.get('/admin/vouchers/:id',             auth, requireAdmin, adminVoucher.getVoucher);
router.post('/admin/vouchers/:id/approve',    auth, requireAdmin, logAdminAction('approve_voucher','voucher'), adminVoucher.approveVoucher);
router.post('/admin/vouchers/:id/reject',     auth, requireAdmin, logAdminAction('reject_voucher','voucher'),  adminVoucher.rejectVoucher);

// Disputes
router.get('/admin/disputes',                 auth, requireAdmin, adminDispute.listDisputes);
router.get('/admin/disputes/:id',             auth, requireAdmin, adminDispute.getDispute);
router.post('/admin/disputes/:id/message',    auth, requireAdmin, adminDispute.sendMessage);
router.post('/admin/disputes/:id/resolve',    auth, requireAdmin, logAdminAction('resolve_dispute','dispute'), adminDispute.resolveDispute);
router.put('/admin/disputes/:id/priority',    auth, requireAdmin, adminDispute.updatePriority);

// Revenue & Users
router.get('/admin/revenue/overview',         auth, requireAdmin, adminRevenue.getOverview);
router.get('/admin/revenue/chart',            auth, requireAdmin, adminRevenue.getChart);
router.get('/admin/users',                    auth, requireAdmin, adminRevenue.listUsers);
router.post('/admin/users/:id/suspend',       auth, requireAdmin, logAdminAction('suspend_user','user'),   adminRevenue.suspendUser);
router.post('/admin/users/:id/unsuspend',     auth, requireAdmin, logAdminAction('unsuspend_user','user'), adminRevenue.unsuspendUser);
router.get('/admin/stats/counts',             auth, requireAdmin, adminRevenue.getCounts);

// Withdrawals
router.get('/admin/withdrawals',              auth, requireAdmin, listWithdrawals);
router.post('/admin/withdrawals/:id/process', auth, requireAdmin, logAdminAction('process_withdrawal','withdrawal'), processWithdrawal);

// Fraud reports
router.get('/admin/fraud-reports',            auth, requireAdmin, listFraudReports);
router.post('/admin/fraud-reports/:id/review',auth, requireAdmin, logAdminAction('review_fraud_report','fraud_report'), reviewFraudReport);
router.get('/admin/sellers/:id/fraud-profile',auth, requireAdmin, getSellerFraudProfile);

// Reviews moderation
router.delete('/admin/reviews/:id',           auth, requireAdmin, logAdminAction('delete_review','review'), adminDeleteReview);

// KYC management
router.get('/admin/kyc',                      auth, requireAdmin, listKyc);
router.post('/admin/kyc/:id/approve',         auth, requireAdmin, logAdminAction('approve_kyc','kyc'), approveKyc);
router.post('/admin/kyc/:id/reject',          auth, requireAdmin, logAdminAction('reject_kyc','kyc'),  rejectKyc);

// Notifications broadcast
router.post('/admin/notifications/broadcast', auth, requireAdmin, broadcast);

// Cron triggers
router.post('/admin/cron/expire-vouchers',    auth, requireAdmin, async (req, res) => {
  try { const count = await expireVouchers(); res.json({ expired: count }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/admin/cron/snapshot-revenue',   auth, requireAdmin, async (req, res) => {
  try { const result = await snapshotRevenue(); res.json(result); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/admin/cron/escalate-disputes',  auth, requireAdmin, async (req, res) => {
  try { const count = await escalateStaleDisputes(); res.json({ escalated: count }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/admin/cron/logs',                auth, requireAdmin, async (req, res) => {
  const pool = require('../config/db');
  try { const r = await pool.query('SELECT * FROM cron_logs ORDER BY ran_at DESC LIMIT 100'); res.json(r.rows); }
  catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
