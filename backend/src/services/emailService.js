const nodemailer = require('nodemailer');
const pool = require('../config/db');

// Create transporter — supports Gmail, SMTP, or any provider
const createTransporter = () => {
  if (process.env.EMAIL_PROVIDER === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Use Gmail App Password, not your real password
      },
    });
  }

  // Default: generic SMTP (works with Mailgun, SendGrid SMTP, Zoho, etc.)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const transporter = createTransporter();

// Base HTML wrapper
const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VouchEx</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#111118;border-radius:16px 16px 0 0;padding:28px 40px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#f97316;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                          <span style="color:white;font-size:18px;font-weight:bold;">V</span>
                        </td>
                        <td style="padding-left:12px;">
                          <span style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.5px;">VouchEx</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background:#111118;padding:40px;border-radius:0 0 16px 16px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">
                © ${new Date().getFullYear()} VouchEx. All rights reserved.
              </p>
              <p style="color:rgba(255,255,255,0.15);font-size:11px;margin:8px 0 0;">
                You're receiving this because you have an account on VouchEx.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const h1 = (text) => `<h1 style="color:white;font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">${text}</h1>`;
const p = (text) => `<p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.6;margin:0 0 16px;">${text}</p>`;
const highlight = (text) => `<span style="color:#f97316;font-weight:600;">${text}</span>`;
const divider = () => `<div style="border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;"></div>`;
const btn = (text, url) => `
  <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background:#f97316;border-radius:10px;padding:14px 28px;">
        <a href="${url}" style="color:white;font-weight:600;font-size:15px;text-decoration:none;">${text}</a>
      </td>
    </tr>
  </table>
`;
const infoBox = (rows) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;margin:20px 0;">
    ${rows.map(([label, value, orange]) => `
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:rgba(255,255,255,0.35);font-size:13px;">${label}</td>
              <td align="right" style="color:${orange ? '#f97316' : 'white'};font-size:14px;font-weight:${orange ? '700' : '500'};">${value}</td>
            </tr>
          </table>
        </td>
      </tr>
    `).join('')}
  </table>
`;
const codeBox = (code) => `
  <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
    <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Your Voucher Code</p>
    <p style="color:#f97316;font-size:24px;font-weight:700;letter-spacing:4px;font-family:monospace;margin:0;">${code}</p>
  </div>
`;

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const templates = {

  // Buyer purchased a voucher
  purchase_success: ({ buyerName, voucherTitle, brand, amount, code, transactionId }) => ({
    subject: `🎉 Your ${brand} voucher is ready!`,
    html: baseTemplate(`
      ${h1(`You got a ${brand} voucher!`)}
      ${p(`Hey ${buyerName}, your purchase was successful. Here's your voucher code — copy it and use it on ${brand}'s platform.`)}
      ${codeBox(code)}
      ${infoBox([
        ['Voucher', voucherTitle],
        ['Brand', brand],
        ['Amount Paid', `₹${parseFloat(amount).toFixed(2)}`],
        ['Transaction ID', transactionId.slice(0, 8).toUpperCase()],
      ])}
      ${p('Keep this code safe. If you face any issues redeeming it, you can raise a dispute from your dashboard.')}
      ${btn('Go to Dashboard', `${process.env.FRONTEND_URL}/dashboard`)}
    `),
  }),

  // Seller made a sale
  sale_success: ({ sellerName, buyerName, voucherTitle, sellerEarning, commission, amount }) => ({
    subject: `💰 You just sold a voucher — ₹${parseFloat(sellerEarning).toFixed(2)} credited!`,
    html: baseTemplate(`
      ${h1('Your voucher sold!')}
      ${p(`Great news ${sellerName}, your voucher was just purchased. Your earnings have been credited to your wallet.`)}
      ${infoBox([
        ['Voucher Sold', voucherTitle],
        ['Buyer', buyerName],
        ['Sale Price', `₹${parseFloat(amount).toFixed(2)}`],
        ['Platform Fee (20%)', `-₹${parseFloat(commission).toFixed(2)}`],
        ['Your Earnings', `₹${parseFloat(sellerEarning).toFixed(2)}`, true],
      ])}
      ${p('Your balance has been updated. You can withdraw your earnings anytime from your dashboard.')}
      ${btn('View Earnings', `${process.env.FRONTEND_URL}/dashboard?tab=wallet`)}
    `),
  }),

  // Wallet top-up via Razorpay
  wallet_topup: ({ userName, amount, newBalance, paymentId }) => ({
    subject: `✅ Wallet topped up — ₹${parseFloat(amount).toFixed(2)} added`,
    html: baseTemplate(`
      ${h1('Funds added to your wallet')}
      ${p(`Hey ${userName}, your payment was successful and your VouchEx wallet has been credited.`)}
      ${infoBox([
        ['Amount Added', `₹${parseFloat(amount).toFixed(2)}`, true],
        ['New Balance', `₹${parseFloat(newBalance).toFixed(2)}`],
        ['Payment ID', paymentId],
      ])}
      ${p('You can now use these funds to purchase vouchers on VouchEx.')}
      ${btn('Browse Vouchers', `${process.env.FRONTEND_URL}/vouchers`)}
    `),
  }),

  // Withdrawal request received
  withdrawal_requested: ({ userName, amount, accountLast4 }) => ({
    subject: `⏳ Withdrawal request received — ₹${parseFloat(amount).toFixed(2)}`,
    html: baseTemplate(`
      ${h1('Withdrawal request received')}
      ${p(`Hey ${userName}, we've received your withdrawal request and it's being processed.`)}
      ${infoBox([
        ['Amount', `₹${parseFloat(amount).toFixed(2)}`, true],
        ['Bank Account', `****${accountLast4}`],
        ['Status', 'Processing'],
        ['Expected', '1-3 business days'],
      ])}
      ${p("We process withdrawals within 1-3 business days. You'll get another email once the transfer is complete.")}
      ${btn('View Wallet', `${process.env.FRONTEND_URL}/dashboard?tab=wallet`)}
    `),
  }),

  // Withdrawal completed
  withdrawal_completed: ({ userName, amount, payoutId }) => ({
    subject: `✅ Withdrawal of ₹${parseFloat(amount).toFixed(2)} completed!`,
    html: baseTemplate(`
      ${h1('Your withdrawal is complete!')}
      ${p(`Hey ${userName}, your withdrawal has been processed and the money is on its way to your bank account.`)}
      ${infoBox([
        ['Amount Transferred', `₹${parseFloat(amount).toFixed(2)}`, true],
        ['Payout ID', payoutId || 'N/A'],
        ['Status', 'Completed'],
      ])}
      ${p('The transfer usually reflects within a few hours depending on your bank. If you don\'t receive it within 3 business days, please contact support.')}
    `),
  }),

  // Withdrawal rejected
  withdrawal_rejected: ({ userName, amount, reason }) => ({
    subject: `❌ Withdrawal request rejected`,
    html: baseTemplate(`
      ${h1('Withdrawal request rejected')}
      ${p(`Hey ${userName}, unfortunately your withdrawal request could not be processed.`)}
      ${infoBox([
        ['Amount', `₹${parseFloat(amount).toFixed(2)}`],
        ['Reason', reason || 'Please contact support'],
      ])}
      ${p('Your funds have been returned to your VouchEx wallet. Please verify your bank details and try again, or contact our support team.')}
      ${btn('View Wallet', `${process.env.FRONTEND_URL}/dashboard?tab=wallet`)}
    `),
  }),

  // Voucher listing approved
  voucher_approved: ({ sellerName, voucherTitle }) => ({
    subject: `✅ Your voucher is now live — "${voucherTitle}"`,
    html: baseTemplate(`
      ${h1('Your voucher is live!')}
      ${p(`Hey ${sellerName}, great news! Your voucher has been reviewed and approved. It's now visible to all buyers on VouchEx.`)}
      ${infoBox([
        ['Voucher', voucherTitle],
        ['Status', 'Live & Active'],
      ])}
      ${p('Share the link with friends to get faster sales. You\'ll get an email as soon as it sells.')}
      ${btn('View My Listings', `${process.env.FRONTEND_URL}/dashboard?tab=listings`)}
    `),
  }),

  // Voucher listing rejected
  voucher_rejected: ({ sellerName, voucherTitle, reason }) => ({
    subject: `❌ Your voucher listing was rejected`,
    html: baseTemplate(`
      ${h1('Voucher listing rejected')}
      ${p(`Hey ${sellerName}, your voucher listing could not be approved at this time.`)}
      ${infoBox([
        ['Voucher', voucherTitle],
        ['Reason', reason],
      ])}
      ${p('Please review the feedback, make the necessary corrections, and submit a new listing.')}
      ${btn('List Again', `${process.env.FRONTEND_URL}/sell`)}
    `),
  }),

  // Dispute opened (to both parties)
  dispute_opened: ({ userName, voucherTitle, disputeId }) => ({
    subject: `⚠️ Dispute opened for "${voucherTitle}"`,
    html: baseTemplate(`
      ${h1('A dispute has been opened')}
      ${p(`Hey ${userName}, a dispute has been raised regarding your transaction for "${voucherTitle}". Our team will review it within 24-48 hours.`)}
      ${infoBox([
        ['Dispute ID', disputeId.slice(0, 8).toUpperCase()],
        ['Status', 'Under Review'],
      ])}
      ${p('Please do not take any action. Our team will reach out if additional information is needed.')}
    `),
  }),

  // Dispute resolved
  dispute_resolved: ({ userName, voucherTitle, resolution, refundAmount }) => ({
    subject: `✅ Dispute resolved for "${voucherTitle}"`,
    html: baseTemplate(`
      ${h1('Your dispute has been resolved')}
      ${p(`Hey ${userName}, our team has reviewed and resolved the dispute for "${voucherTitle}".`)}
      ${infoBox([
        ['Resolution', resolution],
        ...(refundAmount > 0 ? [['Refund Issued', `₹${parseFloat(refundAmount).toFixed(2)}`, true]] : []),
      ])}
      ${p('If you have any further concerns, please contact our support team.')}
      ${btn('Go to Dashboard', `${process.env.FRONTEND_URL}/dashboard`)}
    `),
  }),
  // ─────────────────────────────────────────────────────────────────────────────
// ADD THESE 4 TEMPLATES inside the `templates` object in emailService.js
// ─────────────────────────────────────────────────────────────────────────────

// 1. Buyer gets refund after fraud confirmed
fraud_report_confirmed_buyer: ({ buyerName, voucherTitle, brand, refundAmount, reason }) => ({
  subject: `✅ Refund issued — Invalid voucher confirmed`,
  html: baseTemplate(`
    ${h1('Your report was confirmed')}
    ${p(`Hey ${buyerName}, we investigated your report and confirmed the voucher was invalid. A full refund has been added to your wallet.`)}
    ${infoBox([
      ['Voucher', voucherTitle],
      ['Brand', brand],
      ['Issue', reason.replace(/_/g, ' ')],
      ['Refund Amount', `₹${parseFloat(refundAmount).toFixed(2)}`, true],
    ])}
    ${p('The refund is now in your VouchEx wallet and can be used immediately.')}
    ${btn('Browse Vouchers', `${process.env.FRONTEND_URL}/vouchers`)}
  `),
}),

// 2. Seller gets penalised
fraud_report_confirmed_seller: ({ sellerName, voucherTitle, reason, penalty, strikeSeverity }) => ({
  subject: `⚠️ Fraud report confirmed — ${strikeSeverity === 'ban' ? 'Account banned' : strikeSeverity === 'strike' ? 'Strike issued' : 'Warning issued'}`,
  html: baseTemplate(`
    ${h1(strikeSeverity === 'ban' ? 'Your account has been banned' : strikeSeverity === 'strike' ? 'Strike issued to your account' : 'Warning: Invalid voucher')}
    ${p(`Hey ${sellerName}, a fraud report against your voucher has been confirmed by our team.`)}
    ${infoBox([
      ['Voucher', voucherTitle],
      ['Issue', reason.replace(/_/g, ' ')],
      ['Penalty', `₹${parseFloat(penalty).toFixed(2)} deducted`],
      ['Account Status', strikeSeverity === 'ban' ? 'Banned' : strikeSeverity === 'strike' ? 'Strike added' : 'Warning issued'],
    ])}
    ${strikeSeverity === 'ban'
      ? p('Your account has been permanently banned for repeated fraudulent activity. If you believe this is a mistake, contact support.')
      : p('Please ensure all voucher codes you list are valid and unused. Further violations will result in account suspension.')
    }
  `),
}),

// 3. Report dismissed — buyer told voucher is valid
fraud_report_dismissed: ({ buyerName, voucherTitle, reason }) => ({
  subject: `ℹ️ Fraud report update for "${voucherTitle}"`,
  html: baseTemplate(`
    ${h1('Report reviewed')}
    ${p(`Hey ${buyerName}, we reviewed your report about "${voucherTitle}" and could not confirm it as fraud.`)}
    ${infoBox([
      ['Reported Issue', reason.replace(/_/g, ' ')],
      ['Outcome', 'Report dismissed'],
    ])}
    ${p('If you are still unable to use the voucher, we recommend raising a dispute through your dashboard so we can investigate further.')}
    ${btn('Raise a Dispute', `${process.env.FRONTEND_URL}/dashboard?tab=purchases`)}
  `),
}),

// 4. Admin alert on new fraud report
admin_fraud_alert: ({ reportId, voucherTitle, brand, reason, reporterName, amount }) => ({
  subject: `🚨 New fraud report #${reportId} — ${brand}`,
  html: baseTemplate(`
    ${h1('New Fraud Report Requires Review')}
    ${p('A buyer has flagged a voucher as invalid. Please review and take action.')}
    ${infoBox([
      ['Report ID', reportId],
      ['Voucher', voucherTitle],
      ['Brand', brand],
      ['Reason', reason.replace(/_/g, ' ')],
      ['Reported By', reporterName],
      ['Amount at Risk', `₹${parseFloat(amount).toFixed(2)}`, true],
    ])}
    ${btn('Review in Admin Panel', `${process.env.FRONTEND_URL}/admin/fraud-reports`)}
  `),
}),

};

// ─────────────────────────────────────────────────────────────────────────────
// SEND FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

const sendEmail = async (type, toEmail, data, userId = null, referenceId = null) => {
  const template = templates[type];
  if (!template) {
    console.error(`[email] Unknown template: ${type}`);
    return false;
  }

  const { subject, html } = template(data);

  try {
    await transporter.sendMail({
      from: `"VouchEx" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      html,
    });

    // Log success
    if (userId) {
      await pool.query(
        'INSERT INTO email_logs (user_id, to_email, type, subject, status, reference_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [userId, toEmail, type, subject, 'sent', referenceId]
      ).catch(() => {});
    }

    console.log(`[email] ✅ Sent "${type}" to ${toEmail}`);
    return true;
  } catch (err) {
    console.error(`[email] ❌ Failed to send "${type}" to ${toEmail}:`, err.message);

    if (userId) {
      await pool.query(
        'INSERT INTO email_logs (user_id, to_email, type, subject, status, error_message) VALUES ($1,$2,$3,$4,$5,$6)',
        [userId, toEmail, type, subject, 'failed', err.message]
      ).catch(() => {});
    }

    return false;
  }
};

module.exports = { sendEmail };
