'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { Shield, CheckCircle, XCircle, Clock, Eye, X } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

const STATUS_TABS = ['pending', 'approved', 'rejected', 'all'];

function ReviewModal({ kyc, onClose, onDone }: { kyc: any; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const approve = async () => {
    setLoading(true);
    try {
      await api.post(`/admin/kyc/${kyc.id}/approve`);
      toast.success('KYC approved');
      onDone();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setLoading(false); }
  };

  const reject = async () => {
    if (!reason.trim()) { toast.error('Please enter a rejection reason'); return; }
    setLoading(true);
    try {
      await api.post(`/admin/kyc/${kyc.id}/reject`, { reason });
      toast.success('KYC rejected');
      onDone();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setLoading(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl shadow-2xl" style={{ backgroundColor: '#16162a', border: '1px solid rgba(255,255,255,0.12)' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 pb-4">
            <h3 className="font-bold text-white text-base">Review KYC — {kyc.user_name}</h3>
            <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 pb-6 space-y-4">
            {/* Details */}
            <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {[
                ['User', `${kyc.user_name} (${kyc.user_email})`],
                ['Full Name', kyc.full_name],
                ['Date of Birth', kyc.dob?.split('T')[0]],
                ['PAN', kyc.pan_number || '—'],
                ['Aadhaar Last 4', kyc.aadhaar_last4 || '—'],
                ['Bank', kyc.bank_name],
                ['Account Number', kyc.account_number],
                ['IFSC', kyc.ifsc_code],
                ['Account Holder', kyc.account_holder],
                ['Submitted', format(new Date(kyc.submitted_at), 'dd MMM yyyy HH:mm')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-white/40">{k}</span>
                  <span className="text-white/80 font-medium text-right max-w-[60%] truncate">{v}</span>
                </div>
              ))}
            </div>

            {kyc.status === 'pending' && (
              <>
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Rejection reason (required if rejecting)</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                    placeholder="e.g. IFSC code does not match bank, PAN details mismatch..."
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:ring-1 focus:ring-white/20"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
                <div className="flex gap-3">
                  <button onClick={reject} disabled={loading}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                    style={{ backgroundColor: '#ef4444' }}>
                    {loading ? '...' : 'Reject'}
                  </button>
                  <button onClick={approve} disabled={loading}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                    style={{ backgroundColor: '#22c55e' }}>
                    {loading ? '...' : '✓ Approve KYC'}
                  </button>
                </div>
              </>
            )}

            {kyc.status !== 'pending' && (
              <div className={clsx('rounded-xl px-4 py-3 text-sm font-medium text-center',
                kyc.status === 'approved' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10')}>
                {kyc.status === 'approved' ? '✓ Approved' : `Rejected: ${kyc.rejection_reason}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AdminKycPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/kyc?status=${status}`);
      setSubmissions(data.submissions);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [status]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-700 text-white">KYC Management</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-card rounded-xl p-1 w-fit">
        {STATUS_TABS.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all',
              status === s ? 'bg-primary-500 text-white' : 'text-white/50 hover:text-white')}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-white/30 text-sm">Loading...</div>
        ) : submissions.length === 0 ? (
          <div className="p-10 text-center">
            <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No {status} KYC submissions</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-xs text-white/30">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Bank</th>
                <th className="text-left px-4 py-3">Submitted</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm text-white font-medium">{s.user_name}</div>
                    <div className="text-xs text-white/30">{s.user_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-white/70">{s.bank_name}</div>
                    <div className="text-xs text-white/30">••••{s.account_number.slice(-4)} · {s.ifsc_code}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40">
                    {format(new Date(s.submitted_at), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs font-medium px-2 py-1 rounded-full',
                      s.status === 'approved' ? 'bg-green-400/15 text-green-400'
                      : s.status === 'rejected' ? 'bg-red-400/15 text-red-400'
                      : 'bg-yellow-400/15 text-yellow-400')}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(s)}
                      className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium">
                      <Eye className="w-3.5 h-3.5" /> Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <ReviewModal kyc={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); fetch(); }} />
      )}
    </div>
  );
}
