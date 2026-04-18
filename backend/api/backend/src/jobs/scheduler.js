const cron = require('node-cron');
const jobs = require('./cronJobs');

/**
 * Initialize all cron jobs.
 * Call this once from server startup.
 */
const initCronScheduler = () => {
  console.log('⏰ Initializing cron scheduler...');

  // Every hour at minute 0 → expire vouchers
  cron.schedule('0 * * * *', async () => {
    console.log('[cron] Running: expire_vouchers');
    try { await jobs.expireVouchers(); } catch {}
  });

  // Every day at 00:05 → daily revenue snapshot
  cron.schedule('5 0 * * *', async () => {
    console.log('[cron] Running: snapshot_revenue');
    try { await jobs.snapshotRevenue(); } catch {}
  });

  // Every day at 02:00 → cleanup old rejected vouchers
  cron.schedule('0 2 * * *', async () => {
    console.log('[cron] Running: cleanup_rejected_vouchers');
    try { await jobs.cleanupRejectedVouchers(); } catch {}
  });

  // Every 6 hours → escalate stale disputes
  cron.schedule('0 */6 * * *', async () => {
    console.log('[cron] Running: escalate_disputes');
    try { await jobs.escalateStaleDisputes(); } catch {}
  });

  // Every day at 09:00 → warn expiring vouchers
  cron.schedule('0 9 * * *', async () => {
    console.log('[cron] Running: warn_expiring_vouchers');
    try { await jobs.warnExpiringVouchers(); } catch {}
  });

  console.log('✅ Cron jobs scheduled:');
  console.log('   • expire_vouchers      → every hour');
  console.log('   • snapshot_revenue     → daily 00:05');
  console.log('   • cleanup_rejected     → daily 02:00');
  console.log('   • escalate_disputes    → every 6h');
  console.log('   • warn_expiring        → daily 09:00');
};

module.exports = { initCronScheduler };
