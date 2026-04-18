'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Shield, CheckCircle, Clock, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import Link from 'next/link';

const STATUS_CONFIG = {
  none:     { icon: Shield,        color: 'text-white/40',   bg: 'bg-white/5',         label: 'Not Submitted',    desc: 'Submit KYC to enable withdrawals' },
  pending:  { icon: Clock,         color: 'text-yellow-400', bg: 'bg-yellow-400/10',   label: 'Under Review',     desc: 'Your KYC is being reviewed (1-2 business days)' },
  approved: { icon: CheckCircle,   color: 'text-green-400',  bg: 'bg-green-400/10',    label: 'Verified ✓',       desc: 'Your KYC is verified. Withdrawals are enabled.' },
  rejected: { icon: XCircle,       color: 'text-red-400',    bg: 'bg-red-400/10',      label: 'Rejected',         desc: 'Your KYC was rejected. Please resubmit.' },
};

export default function KycPage() {
  const { user, isHydrated } = useAuthStore();
  const router = useRouter();

  const [kycData, setKycData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    full_name: '', dob: '', pan_number: '', aadhaar_last4: '',
    bank_name: '', account_number: '', ifsc_code: '', account_holder: '',
  });

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) { router.push('/login'); return; }
    fetchKyc();
  }, [isHydrated, user]);

  const fetchKyc = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/kyc/status');
      setKycData(data);
      // pre-fill form if resubmitting after rejection
      if (data.submission) {
        setForm({
          full_name: data.submission.full_name || '',
          dob: data.submission.dob?.split('T')[0] || '',
          pan_number: data.submission.pan_number || '',
          aadhaar_last4: data.submission.aadhaar_last4 || '',
          bank_name: data.submission.bank_name || '',
          account_number: data.submission.account_number || '',
          ifsc_code: data.submission.ifsc_code || '',
          account_holder: data.submission.account_holder || '',
        });
      } else {
        setForm(f => ({ ...f, full_name: user?.name || '' }));
      }
      // auto-show form if not submitted yet or rejected
      if (!data.submission || data.kyc_status === 'rejected') setShowForm(true);
    } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.dob || !form.bank_name || !form.account_number || !form.ifsc_code || !form.account_holder) {
      toast.error('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/kyc/submit', form);
      toast.success('KYC submitted! We will review within 1-2 business days.');
      fetchKyc();
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  if (loading) return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-4">
      <div className="skeleton h-32 rounded-2xl" />
      <div className="skeleton h-96 rounded-2xl" />
    </div>
  );

  const status = kycData?.kyc_status || 'none';
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  const StatusIcon = cfg.icon;
  const sub = kycData?.submission;

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-5">

      {/* Status Card */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0', cfg.bg)}>
            <StatusIcon className={clsx('w-6 h-6', cfg.color)} />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-700 text-white">KYC Verification</h1>
            <div className={clsx('text-sm font-semibold mt-1', cfg.color)}>{cfg.label}</div>
            <p className="text-white/40 text-sm mt-1">{cfg.desc}</p>
            {sub?.rejection_reason && status === 'rejected' && (
              <div className="mt-3 rounded-xl px-4 py-3 text-sm text-red-300"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <span className="font-semibold">Reason:</span> {sub.rejection_reason}
              </div>
            )}
          </div>
        </div>

        {sub && status !== 'none' && (
          <div className="mt-5 pt-5 border-t border-white/5 text-xs text-white/30 flex gap-4">
            <span>Submitted: {format(new Date(sub.submitted_at), 'dd MMM yyyy')}</span>
            {sub.reviewed_at && <span>Reviewed: {format(new Date(sub.reviewed_at), 'dd MMM yyyy')}</span>}
          </div>
        )}
      </div>

      {/* Why KYC? */}
      {status === 'none' && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> Why is KYC required?
          </h2>
          <ul className="space-y-2 text-sm text-white/50">
            {['RBI mandates KYC for wallet withdrawals to bank accounts', 'Prevents fraud and money laundering', 'One-time process — verify once, withdraw anytime', 'Your data is encrypted and secure'].map(item => (
              <li key={item} className="flex items-start gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-primary-400 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Approved summary */}
      {status === 'approved' && sub && (
        <div className="glass-card rounded-2xl p-5 space-y-0 divide-y divide-white/5">
          <h2 className="font-semibold text-white text-sm pb-3">Verified Details</h2>
          {[
            { label: 'Full Name',       value: sub.full_name },
            { label: 'Bank',            value: sub.bank_name },
            { label: 'Account Number',  value: `••••${sub.account_number.slice(-4)}` },
            { label: 'IFSC Code',       value: sub.ifsc_code },
            { label: 'Account Holder',  value: sub.account_holder },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-2.5">
              <span className="text-white/40 text-sm">{label}</span>
              <span className="text-white/80 text-sm font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* KYC Form */}
      {(status === 'none' || status === 'rejected') && (
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-white">
            {status === 'rejected' ? 'Resubmit KYC' : 'Submit KYC'}
          </h2>

          {/* Personal Details */}
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Personal Details</p>
            <div className="space-y-3">
              <Field label="Full Name *" value={form.full_name} onChange={set('full_name')} placeholder="As per Aadhaar / PAN" />
              <Field label="Date of Birth *" value={form.dob} onChange={set('dob')} type="date" placeholder="" />
              <Field label="PAN Number" value={form.pan_number} onChange={set('pan_number')} placeholder="ABCDE1234F" maxLength={10}
                hint="Required for withdrawals above ₹50,000" />
              <Field label="Aadhaar (last 4 digits)" value={form.aadhaar_last4} onChange={set('aadhaar_last4')} placeholder="1234" maxLength={4} />
            </div>
          </div>

          {/* Bank Details */}
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Bank Account Details</p>
            <div className="space-y-3">
              <Field label="Bank Name *" value={form.bank_name} onChange={set('bank_name')} placeholder="e.g. State Bank of India" />
              <Field label="Account Number *" value={form.account_number} onChange={set('account_number')} placeholder="Your bank account number" />
              <Field label="IFSC Code *" value={form.ifsc_code} onChange={set('ifsc_code')} placeholder="e.g. SBIN0001234" maxLength={11} />
              <Field label="Account Holder Name *" value={form.account_holder} onChange={set('account_holder')} placeholder="Name on bank account" />
            </div>
          </div>

          <div className="rounded-xl px-4 py-3 text-xs text-white/40 leading-relaxed"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            By submitting, you confirm that all details are accurate. False information may result in account suspension.
          </div>

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#6366f1' }}>
            {submitting ? 'Submitting...' : 'Submit KYC for Verification'}
          </button>
        </div>
      )}

      {/* Pending — no form */}
      {status === 'pending' && (
        <div className="glass-card rounded-2xl p-6 text-center">
          <Clock className="w-10 h-10 text-yellow-400/60 mx-auto mb-3" />
          <p className="text-white/60 text-sm">Your documents are being reviewed.</p>
          <p className="text-white/30 text-xs mt-1">We'll notify you within 1-2 business days.</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', maxLength, hint }: {
  label: string; value: string; onChange: any; placeholder: string;
  type?: string; maxLength?: number; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs text-white/50 block mb-1.5">{label}</label>
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} maxLength={maxLength}
        className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
      />
      {hint && <p className="text-xs text-white/25 mt-1">{hint}</p>}
    </div>
  );
}
