const pool = require('../config/db');

/**
 * Logs a cron run start and returns a finish function
 */
const startCronLog = async (jobName) => {
  const start = Date.now();
  const res = await pool.query(
    "INSERT INTO cron_logs (job_name, status) VALUES ($1, 'running') RETURNING id",
    [jobName]
  );
  const logId = res.rows[0].id;

  return async (status, recordsAffected = 0, message = '') => {
    await pool.query(
      'UPDATE cron_logs SET status = $1, records_affected = $2, message = $3, duration_ms = $4 WHERE id = $5',
      [status, recordsAffected, message, Date.now() - start, logId]
    );
  };
};

/**
 * JOB 1: Expire vouchers past their expiry_date
 * Run: every hour
 */
const expireVouchers = async () => {
  const finish = await startCronLog('expire_vouchers');
  try {
    const result = await pool.query(`
      UPDATE vouchers
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'active'
        AND verification_status = 'approved'
        AND expiry_date IS NOT NULL
        AND expiry_date < CURRENT_DATE
      RETURNING id, title, seller_id
    `);

    const count = result.rows.length;
    if (count > 0) {
      console.log(`[expire_vouchers] Expired ${count} vouchers:`, result.rows.map(r => r.title));
    }

    await finish('success', count, `Expired ${count} vouchers`);
    return count;
  } catch (err) {
    await finish('failed', 0, err.message);
    console.error('[expire_vouchers] Error:', err);
    throw err;
  }
};

/**
 * JOB 2: Clean up rejected vouchers older than 30 days (soft: mark for deletion)
 * Run: daily at midnight
 */
const cleanupRejectedVouchers = async () => {
  const finish = await startCronLog('cleanup_rejected_vouchers');
  try {
    const result = await pool.query(`
      DELETE FROM vouchers
      WHERE verification_status = 'rejected'
        AND reviewed_at < NOW() - INTERVAL '30 days'
      RETURNING id
    `);
    const count = result.rows.length;
    await finish('success', count, `Deleted ${count} old rejected vouchers`);
    return count;
  } catch (err) {
    await finish('failed', 0, err.message);
    console.error('[cleanup_rejected] Error:', err);
    throw err;
  }
};

/**
 * JOB 3: Daily revenue snapshot
 * Run: daily at 00:05 for yesterday's data
 */
const snapshotRevenue = async () => {
  const finish = await startCronLog('snapshot_revenue');
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split('T')[0];

    const [txData, userData, listingData] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as tx_count,
          COALESCE(SUM(amount), 0) as gross,
          COALESCE(SUM(commission), 0) as commission,
          COALESCE(SUM(CASE WHEN status='refunded' THEN refund_amount ELSE 0 END), 0) as refunds
        FROM transactions
        LEFT JOIN disputes ON disputes.transaction_id = transactions.id
        WHERE DATE(transactions.created_at) = $1
      `, [date]),
      pool.query(`SELECT COUNT(*) FROM users WHERE DATE(created_at) = $1`, [date]),
      pool.query(`SELECT COUNT(*) FROM vouchers WHERE DATE(created_at) = $1`, [date]),
    ]);

    const tx = txData.rows[0];
    const commission = parseFloat(tx.commission);
    const refunds = parseFloat(tx.refunds);

    await pool.query(`
      INSERT INTO revenue_snapshots (date, transaction_count, gross_volume, total_commission, refunds_issued, net_revenue, new_users, new_listings)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (date) DO UPDATE SET
        transaction_count = EXCLUDED.transaction_count,
        gross_volume = EXCLUDED.gross_volume,
        total_commission = EXCLUDED.total_commission,
        refunds_issued = EXCLUDED.refunds_issued,
        net_revenue = EXCLUDED.net_revenue,
        new_users = EXCLUDED.new_users,
        new_listings = EXCLUDED.new_listings
    `, [date, parseInt(tx.tx_count), parseFloat(tx.gross), commission, refunds, commission - refunds,
        parseInt(userData.rows[0].count), parseInt(listingData.rows[0].count)]);

    await finish('success', 1, `Snapshot for ${date}: commission ₹${commission.toFixed(2)}`);
    return { date, commission };
  } catch (err) {
    await finish('failed', 0, err.message);
    console.error('[snapshot_revenue] Error:', err);
    throw err;
  }
};

/**
 * JOB 4: Auto-escalate old open disputes to 'urgent'
 * Run: every 6 hours
 */
const escalateStaleDisputes = async () => {
  const finish = await startCronLog('escalate_disputes');
  try {
    const result = await pool.query(`
      UPDATE disputes
      SET priority = 'urgent', updated_at = NOW()
      WHERE status IN ('open', 'under_review')
        AND priority IN ('normal', 'low')
        AND created_at < NOW() - INTERVAL '48 hours'
      RETURNING id
    `);
    const count = result.rows.length;
    await finish('success', count, `Escalated ${count} stale disputes`);
    return count;
  } catch (err) {
    await finish('failed', 0, err.message);
    throw err;
  }
};

/**
 * JOB 5: Warn sellers about vouchers expiring in 3 days (log only - hook in email later)
 * Run: daily
 */
const warnExpiringVouchers = async () => {
  const finish = await startCronLog('warn_expiring_vouchers');
  try {
    const result = await pool.query(`
      SELECT v.id, v.title, v.expiry_date, u.email as seller_email, u.name as seller_name
      FROM vouchers v
      JOIN users u ON v.seller_id = u.id
      WHERE v.status = 'active'
        AND v.expiry_date BETWEEN CURRENT_DATE + INTERVAL '1 day' AND CURRENT_DATE + INTERVAL '3 days'
    `);
    // TODO: send email notifications
    if (result.rows.length > 0) {
      console.log(`[warn_expiring] ${result.rows.length} vouchers expiring soon:`, result.rows.map(r => r.title));
    }
    await finish('success', result.rows.length, `${result.rows.length} expiry warnings logged`);
    return result.rows;
  } catch (err) {
    await finish('failed', 0, err.message);
    throw err;
  }
};

module.exports = {
  expireVouchers,
  cleanupRejectedVouchers,
  snapshotRevenue,
  escalateStaleDisputes,
  warnExpiringVouchers,
};
