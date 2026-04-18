'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ShieldAlert, CheckCircle, XCircle, Eye } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';

const REASONS: Record<string, string> = {
  already_used: 'Already Used',
  expired: 'Expired',
  wrong_code: 'Wrong Code',
  invalid_format: 'Invalid Format',
  fake: 'Fake Code',
};

export default function FraudReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/fraud-reports', { params: { status: tab } });
      setReports(data.reports);
      setTotal(data.total);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, [tab]);

  const handleReview = async (action: 'confirm' | 'dismiss') => {
    setProcessing(true);
    try {
      const { data } = await api.post(`/admin/fraud-reports/${modal.id}/review`, {
        action, admin_note: adminNote,
      });
      toast.success(data.message);
      setModal(null);
      setAdminNote('');
      fetchReports();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setProcessing(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-700 text-white flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-red-400" /> Fraud Reports
        </h1>
        <p className="text-white/30 text-sm mt-1">{total} reports</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-card rounded-xl p-1 w-fit">
        {['pending', 'confirmed', 'dismissed', 'all'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 rounded-lg text-sm capitalize transition-all',
              tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70')}>
            {t}
          </button>
        ))}
      </div>

      {/* Reports Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['Voucher', 'Seller', 'Reported By', 'Reason', 'Amount', 'Date', 'Status', ''].map(h => (
                <th key={h} className="text-left text-xs text-white/30 font-medium px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>)}
                </tr>
              ))
            ) : reports.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-white/30 text-sm">No reports</td></tr>
            ) : reports.map(r => (
              <tr key={r.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-sm text-white font-medium truncate max-w-[140px]">{r.voucher_title}</div>
                  <div className="text-xs text-white/30">{r.brand}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-white/70">{r.seller_name}</div>
                  <div className="text-xs text-white/30">{r.seller_email}</div>
                  {/* Seller risk indicators */}
                  <div className="flex gap-1 mt-1">
                    {r.fraud_score > 0 && (
                      <span className={clsx('text-xs px-1.5 py-0.5 rounded', r.fraud_score >= 50 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400')}>
                        Score: {r.fraud_score}
                      </span>
                    )}
                    {r.seller_strikes > 0 && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                        {r.seller_strikes} strike{r.seller_strikes > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-white/70">{r.buyer_name}</div>
                  <div className="text-xs text-white/30">{r.buyer_email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="bg-red-500/15 text-red-400 text-xs px-2 py-1 rounded-lg">
                    {REASONS[r.reason] || r.reason}
                  </span>
                  {r.description && (
                    <div className="text-xs text-white/30 mt-1 max-w-[120px] truncate">{r.description}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-display font-700 text-white text-sm">₹{parseFloat(r.selling_price).toFixed(2)}</div>
                </td>
                <td className="px-4 py-3 text-xs text-white/30">
                  {format(new Date(r.created_at), 'dd MMM, HH:mm')}
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('text-xs px-2 py-1 rounded-lg capitalize', {
                    'bg-yellow-500/15 text-yellow-400': r.status === 'pending',
                    'bg-red-500/15 text-red-400': r.status === 'confirmed',
                    'bg-white/10 text-white/40': r.status === 'dismissed',
                  })}>{r.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {r.status === 'pending' && (
                      <button onClick={() => { setModal(r); setAdminNote(''); }}
                        className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                        Review
                      </button>
                    )}
                    <Link href={`/admin/sellers/${r.seller_id}/fraud-profile`}
                      className="text-xs text-white/30 hover:text-white/60 transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Review Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-700 text-white mb-1">Review Fraud Report</h3>

            {/* Report details */}
            <div className="glass-card rounded-xl p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Voucher</span>
                <span className="text-white">{modal.voucher_title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Seller</span>
                <span className="text-white">{modal.seller_name}
                  {modal.fraud_score > 0 && <span className="text-red-400 ml-2 text-xs">(score: {modal.fraud_score})</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Buyer</span>
                <span className="text-white">{modal.buyer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Reason</span>
                <span className="text-red-400">{REASONS[modal.reason]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Amount</span>
                <span className="text-white font-semibold">₹{parseFloat(modal.selling_price).toFixed(2)}</span>
              </div>
              {modal.description && (
                <div className="pt-2 border-t border-white/5">
                  <div className="text-white/40 text-xs mb-1">Buyer's description</div>
                  <div className="text-white/70 text-sm">{modal.description}</div>
                </div>
              )}
            </div>

            <div className="mb-5">
              <label className="text-xs text-white/40 mb-1.5 block">Admin Note (optional)</label>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                rows={2} className="input-base resize-none text-sm"
                placeholder="Internal note about this decision..." />
            </div>

            {/* What each action does */}
            <div className="glass-card rounded-xl p-3 mb-5 text-xs text-white/40 space-y-1.5">
              <div><span className="text-green-400 font-semibold">Confirm fraud:</span> Buyer gets full refund · Seller penalised · Strike issued · Voucher removed</div>
              <div><span className="text-white/60 font-semibold">Dismiss:</span> No refund · Voucher restored · No penalty to seller</div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleReview('dismiss')} disabled={processing}
                className="flex-1 glass-card text-white/60 hover:text-white py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                <XCircle className="w-4 h-4 inline mr-1.5" />Dismiss
              </button>
              <button onClick={() => handleReview('confirm')} disabled={processing}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
                {processing ? 'Processing...' : <><CheckCircle className="w-4 h-4 inline mr-1.5" />Confirm Fraud</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
