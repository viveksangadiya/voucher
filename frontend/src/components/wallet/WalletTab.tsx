'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  ArrowDownLeft, ArrowUpRight, CreditCard, Building2,
  RefreshCw, Clock, CheckCircle, XCircle, Shield, AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';

declare global { interface Window { Razorpay: any; } }

const loadRazorpay = (): Promise<boolean> =>
  new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

// ── KYC status banner shown inside the withdraw panel ────────────────────────
function KycBanner({ status }: { status: string }) {
  if (status === 'approved') return null;

  const configs = {
    none: {
      icon: Shield,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      border: 'border-yellow-400/20',
      title: 'KYC Required for Withdrawals',
      desc: 'Complete your KYC verification to withdraw funds to your bank account.',
      cta: 'Complete KYC →',
    },
    pending: {
      icon: Clock,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      border: 'border-blue-400/20',
      title: 'KYC Under Review',
      desc: 'Your KYC is being reviewed. Withdrawals will be enabled once approved (1–2 business days).',
      cta: 'View KYC Status →',
    },
    rejected: {
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-400/10',
      border: 'border-red-400/20',
      title: 'KYC Rejected — Resubmit Required',
      desc: 'Your KYC was rejected. Please resubmit with correct details to enable withdrawals.',
      cta: 'Resubmit KYC →',
    },
  };

  const cfg = configs[status as keyof typeof configs] || configs.none;
  const Icon = cfg.icon;

  return (
    <div className={clsx('rounded-xl p-4 border flex gap-3', cfg.bg, cfg.border)}>
      <Icon className={clsx('w-5 h-5 shrink-0 mt-0.5', cfg.color)} />
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-semibold', cfg.color)}>{cfg.title}</p>
        <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{cfg.desc}</p>
        <Link href="/kyc" className={clsx('text-xs font-semibold mt-2 inline-block', cfg.color)}>
          {cfg.cta}
        </Link>
      </div>
    </div>
  );
}

export default function WalletTab() {
  const { user, refreshUser } = useAuthStore();
  const [walletHistory, setWalletHistory] = useState<any[]>([]);
  const [withdrawals, setWithdrawals]     = useState<any[]>([]);
  const [kycStatus, setKycStatus]         = useState<string>('none');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing]       = useState(false);
  const [showWithdraw, setShowWithdraw]   = useState(false);
  const [withdrawForm, setWithdrawForm]   = useState({ amount: '', bank_account: '', ifsc_code: '', account_name: '' });
  const [withdrawing, setWithdrawing]     = useState(false);
  const [loading, setLoading]             = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [histRes, wdRes, kycRes] = await Promise.all([
        api.get('/wallet/history'),
        api.get('/wallet/withdrawals'),
        api.get('/kyc/status'),
      ]);
      setWalletHistory(histRes.data);
      setWithdrawals(wdRes.data);
      setKycStatus(kycRes.data.kyc_status || 'none');
    } finally {
      setLoading(false);
    }
  };

  // ── Razorpay deposit ──────────────────────────────────────────────────────
  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount < 10) { toast.error('Minimum deposit is ₹10'); return; }
    setDepositing(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) { toast.error('Failed to load payment gateway'); return; }
      const { data: order } = await api.post('/wallet/create-order', { amount });
      const rzp = new window.Razorpay({
        key: order.key, amount: order.amount, currency: order.currency,
        name: order.name, description: order.description,
        order_id: order.order_id, prefill: order.prefill,
        theme: { color: '#f97316' },
        modal: { ondismiss: () => { setDepositing(false); toast('Payment cancelled', { icon: '⚠️' }); } },
        handler: async (response: any) => {
          try {
            const { data } = await api.post('/wallet/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success(data.message);
            setDepositAmount('');
            await refreshUser();
            fetchData();
          } catch (err: any) {
            toast.error(err.response?.data?.error || 'Payment verification failed');
          } finally { setDepositing(false); }
        },
      });
      rzp.on('payment.failed', (r: any) => { toast.error(`Payment failed: ${r.error.description}`); setDepositing(false); });
      rzp.open();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to initiate payment');
      setDepositing(false);
    }
  };

  // ── Withdrawal ────────────────────────────────────────────────────────────
  const handleWithdraw = async () => {
    // KYC gate
    if (kycStatus !== 'approved') {
      toast.error('KYC verification is required to withdraw funds');
      return;
    }
    const amount = parseFloat(withdrawForm.amount);
    if (!amount || amount < 100) { toast.error('Minimum withdrawal is ₹100'); return; }
    if (amount > parseFloat(user?.balance?.toString() || '0')) { toast.error('Insufficient balance'); return; }
    if (!withdrawForm.bank_account || !withdrawForm.ifsc_code || !withdrawForm.account_name) {
      toast.error('All bank details are required'); return;
    }
    setWithdrawing(true);
    try {
      const { data } = await api.post('/wallet/withdraw', withdrawForm);
      toast.success(data.message);
      setShowWithdraw(false);
      setWithdrawForm({ amount: '', bank_account: '', ifsc_code: '', account_name: '' });
      await refreshUser();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Withdrawal failed');
    } finally { setWithdrawing(false); }
  };

  const balance = parseFloat(user?.balance?.toString() || '0');
  const kycApproved = kycStatus === 'approved';

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Balance Card */}
      <div className="glass-card rounded-2xl p-6 bg-gradient-to-br from-primary-900/20 to-transparent border border-primary-500/10">
        <div className="text-white/40 text-sm mb-1">Wallet Balance</div>
        <div className="font-display text-5xl font-800 text-white mb-6">₹{balance.toFixed(2)}</div>

        <div className="grid sm:grid-cols-2 gap-4">

          {/* ── Add Money ── */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-primary-400" />
              <span className="text-sm font-semibold text-white">Add Money</span>
            </div>
            <input type="number" value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              className="input-base text-sm mb-3" placeholder="Enter amount (min ₹10)" min="10" max="100000" />
            <div className="flex gap-2 mb-3">
              {[500, 1000, 2000, 5000].map(a => (
                <button key={a} onClick={() => setDepositAmount(a.toString())}
                  className="flex-1 glass-card rounded-lg py-1.5 text-xs text-white/50 hover:text-white transition-colors">
                  ₹{a}
                </button>
              ))}
            </div>
            <button onClick={handleDeposit} disabled={depositing || !depositAmount}
              className="btn-primary w-full !py-2.5 !text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {depositing
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                : <><CreditCard className="w-3.5 h-3.5" /> Pay via Razorpay</>}
            </button>
            <p className="text-xs text-white/20 mt-2 text-center">UPI · Cards · Net Banking · Wallets</p>
          </div>

          {/* ── Withdraw to Bank ── */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold text-white">Withdraw to Bank</span>
              {kycApproved && (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                  <Shield className="w-3 h-3" /> KYC Verified
                </span>
              )}
            </div>

            {/* KYC banner if not approved */}
            {!kycApproved ? (
              <KycBanner status={kycStatus} />
            ) : !showWithdraw ? (
              <>
                <p className="text-xs text-white/30 mb-4 leading-relaxed">
                  Transfer your earnings to your bank account. Processed in 1–3 business days.
                </p>
                {withdrawals.find((w: any) => ['pending', 'processing'].includes(w.status)) ? (
                  <div className="text-center py-3">
                    <Clock className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
                    <p className="text-xs text-yellow-400">Withdrawal in progress</p>
                  </div>
                ) : (
                  <button onClick={() => setShowWithdraw(true)} disabled={balance < 100}
                    className="btn-secondary w-full !py-2.5 !text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                    <Building2 className="w-3.5 h-3.5" />
                    {balance < 100 ? 'Min ₹100 required' : 'Request Withdrawal'}
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <input type="number" value={withdrawForm.amount}
                  onChange={e => setWithdrawForm(f => ({ ...f, amount: e.target.value }))}
                  className="input-base text-sm" placeholder={`Amount (max ₹${balance.toFixed(0)})`}
                  max={balance} min="100" />
                <input type="text" value={withdrawForm.account_name}
                  onChange={e => setWithdrawForm(f => ({ ...f, account_name: e.target.value }))}
                  className="input-base text-sm" placeholder="Account holder name" />
                <input type="text" value={withdrawForm.bank_account}
                  onChange={e => setWithdrawForm(f => ({ ...f, bank_account: e.target.value }))}
                  className="input-base text-sm" placeholder="Bank account number" />
                <input type="text" value={withdrawForm.ifsc_code}
                  onChange={e => setWithdrawForm(f => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))}
                  className="input-base text-sm" placeholder="IFSC code (e.g. SBIN0001234)" />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowWithdraw(false)} className="btn-secondary flex-1 !py-2 !text-sm">Cancel</button>
                  <button onClick={handleWithdraw} disabled={withdrawing}
                    className="btn-primary flex-1 !py-2 !text-sm disabled:opacity-50">
                    {withdrawing ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Withdrawal history */}
      {withdrawals.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 text-sm">Withdrawal Requests</h3>
          <div className="space-y-2">
            {withdrawals.map((w: any) => (
              <div key={w.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center shrink-0', {
                  'bg-yellow-500/20 text-yellow-400': ['pending','processing'].includes(w.status),
                  'bg-green-500/20 text-green-400': w.status === 'completed',
                  'bg-red-500/20 text-red-400': w.status === 'rejected',
                })}>
                  {w.status === 'completed' ? <CheckCircle className="w-3.5 h-3.5" />
                    : w.status === 'rejected' ? <XCircle className="w-3.5 h-3.5" />
                    : <Clock className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/70">Withdrawal to ****{w.bank_account?.slice(-4)}</div>
                  <div className="text-xs text-white/30">{format(new Date(w.created_at), 'dd MMM yyyy')}</div>
                  {w.rejection_reason && <div className="text-xs text-red-400 mt-0.5">{w.rejection_reason}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-sm text-white">₹{parseFloat(w.amount).toFixed(2)}</div>
                  <span className={clsx('text-xs capitalize', {
                    'text-yellow-400': ['pending','processing'].includes(w.status),
                    'text-green-400': w.status === 'completed',
                    'text-red-400': w.status === 'rejected',
                  })}>{w.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4 text-sm">Transaction History</h3>
        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
        ) : walletHistory.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {walletHistory.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  t.type === 'credit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                  {t.type === 'credit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/80 truncate">{t.description}</div>
                  <div className="text-xs text-white/30">{format(new Date(t.created_at), 'dd MMM yyyy, HH:mm')}</div>
                </div>
                <span className={clsx('font-semibold text-sm shrink-0',
                  t.type === 'credit' ? 'text-green-400' : 'text-red-400')}>
                  {t.type === 'credit' ? '+' : '-'}₹{parseFloat(t.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
