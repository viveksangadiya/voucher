'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, Building2 } from 'lucide-react';
import clsx from 'clsx';

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<any>(null);
  const [formData, setFormData] = useState({ action: 'approve', rejection_reason: '', razorpay_payout_id: '' });
  const [processing, setProcessing] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/withdrawals', { params: { status: tab } });
      setWithdrawals(data.withdrawals);
      setTotal(data.total);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [tab]);

  const handleProcess = async () => {
    if (formData.action === 'reject' && !formData.rejection_reason.trim()) {
      toast.error('Rejection reason required'); return;
    }
    setProcessing(true);
    try {
      const { data } = await api.post(`/admin/withdrawals/${modal.id}/process`, formData);
      toast.success(data.message);
      setModal(null);
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setProcessing(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-700 text-white">Withdrawals</h1>
        <p className="text-white/30 text-sm mt-1">{total} requests</p>
      </div>

      <div className="flex gap-1 glass-card rounded-xl p-1 w-fit">
        {['pending', 'processing', 'completed', 'rejected', 'all'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 rounded-lg text-sm capitalize transition-all', tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70')}>
            {t}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['User', 'Amount', 'Bank Account', 'IFSC', 'Requested', 'Status', 'Action'].map(h => (
                <th key={h} className="text-left text-xs text-white/30 font-medium px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>)}
                </tr>
              ))
            ) : withdrawals.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-white/30 text-sm">No withdrawals</td></tr>
            ) : withdrawals.map(w => (
              <tr key={w.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-sm text-white">{w.user_name}</div>
                  <div className="text-xs text-white/30">{w.user_email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-display font-700 text-white">₹{parseFloat(w.amount).toFixed(2)}</div>
                </td>
                <td className="px-4 py-3 text-sm text-white/60 font-mono">
                  ****{w.bank_account?.slice(-4)}
                  <div className="text-xs text-white/30">{w.account_name}</div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-white/60">{w.ifsc_code}</td>
                <td className="px-4 py-3 text-xs text-white/30">{format(new Date(w.created_at), 'dd MMM, HH:mm')}</td>
                <td className="px-4 py-3">
                  <span className={clsx('badge text-xs', {
                    'bg-yellow-500/15 text-yellow-400': w.status === 'pending',
                    'bg-blue-500/15 text-blue-400': w.status === 'processing',
                    'bg-green-500/15 text-green-400': w.status === 'completed',
                    'bg-red-500/15 text-red-400': w.status === 'rejected',
                  })}>{w.status}</span>
                  {w.rejection_reason && (
                    <div className="text-xs text-red-400/60 mt-1 max-w-[120px] truncate">{w.rejection_reason}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {['pending', 'processing'].includes(w.status) && (
                    <button onClick={() => { setModal(w); setFormData({ action: 'approve', rejection_reason: '', razorpay_payout_id: '' }); }}
                      className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                      Process
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Process Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-700 text-white mb-1">Process Withdrawal</h3>
            <p className="text-white/40 text-sm mb-5">
              {modal.user_name} · ₹{parseFloat(modal.amount).toFixed(2)} → ****{modal.bank_account?.slice(-4)} ({modal.ifsc_code})
            </p>

            <div className="flex gap-2 mb-4">
              {['approve', 'reject'].map(a => (
                <button key={a} onClick={() => setFormData(f => ({ ...f, action: a }))}
                  className={clsx('flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all', formData.action === a
                    ? a === 'approve' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    : 'glass-card text-white/40 hover:text-white/70')}>
                  {a === 'approve' ? <span className="flex items-center justify-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Approve</span>
                    : <span className="flex items-center justify-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Reject</span>}
                </button>
              ))}
            </div>

            {/* {formData.action === 'approve' && (
              <div className="mb-4">
                <label className="text-xs text-white/40 mb-1.5 block">Razorpay Payout ID (optional)</label>
                <input type="text" value={formData.razorpay_payout_id}
                  onChange={e => setFormData(f => ({ ...f, razorpay_payout_id: e.target.value }))}
                  className="input-base text-sm" placeholder="pout_xxxxxxxxxxxxxxxx" />
                <p className="text-xs text-white/20 mt-1.5">
                  Transfer manually via Razorpay Dashboard, then enter the payout ID here.
                </p>
              </div>
            )} */}

            {formData.action === 'reject' && (
              <div className="mb-4">
                <label className="text-xs text-white/40 mb-1.5 block">Rejection Reason *</label>
                <textarea value={formData.rejection_reason}
                  onChange={e => setFormData(f => ({ ...f, rejection_reason: e.target.value }))}
                  rows={3} className="input-base resize-none text-sm"
                  placeholder="e.g. Invalid IFSC code, please update bank details" />
                <p className="text-xs text-white/20 mt-1.5">Funds will be returned to user's wallet automatically.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleProcess} disabled={processing}
                className={clsx('flex-1 font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-50', formData.action === 'approve' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white')}>
                {/* {processing ? 'Processing...' : formData.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'} */}
                {processing ? 'Sending Payout...' : formData.action === 'approve' ? 'Approve & Send Payout' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
