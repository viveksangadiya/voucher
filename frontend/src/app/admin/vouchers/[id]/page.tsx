'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, XCircle, Calendar, Tag, User, Star, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import clsx from 'clsx';

export default function AdminVoucherDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [voucher, setVoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/admin/vouchers/${id}`).then(r => { setVoucher(r.data); setLoading(false); });
  }, [id]);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await api.post(`/admin/vouchers/${id}/approve`, { verification_notes: notes });
      toast.success('✅ Voucher approved and now live!');
      router.push('/admin/vouchers');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { toast.error('Rejection reason required'); return; }
    setSubmitting(true);
    try {
      await api.post(`/admin/vouchers/${id}/reject`, { rejection_reason: rejectionReason, verification_notes: notes });
      toast.success('Voucher rejected');
      router.push('/admin/vouchers');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>;
  if (!voucher) return null;

  const isPending = voucher.verification_status === 'pending_review';

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <Link href="/admin/vouchers" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to queue
      </Link>

      {/* Status Banner */}
      <div className={clsx('rounded-2xl p-4 flex items-center gap-3', {
        'bg-yellow-500/10 border border-yellow-500/20': isPending,
        'bg-green-500/10 border border-green-500/20': voucher.verification_status === 'approved',
        'bg-red-500/10 border border-red-500/20': voucher.verification_status === 'rejected',
      })}>
        {isPending && <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />}
        {voucher.verification_status === 'approved' && <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />}
        {voucher.verification_status === 'rejected' && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
        <div>
          <div className={clsx('font-semibold text-sm', {
            'text-yellow-400': isPending,
            'text-green-400': voucher.verification_status === 'approved',
            'text-red-400': voucher.verification_status === 'rejected',
          })}>
            {isPending ? 'Pending Review' : voucher.verification_status === 'approved' ? 'Approved' : 'Rejected'}
          </div>
          {voucher.reviewed_at && (
            <div className="text-white/40 text-xs mt-0.5">
              by {voucher.reviewed_by_name} on {format(new Date(voucher.reviewed_at), 'dd MMM yyyy, HH:mm')}
            </div>
          )}
          {voucher.rejection_reason && (
            <div className="text-red-300/70 text-xs mt-1">Reason: {voucher.rejection_reason}</div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Voucher Info */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-white text-sm">Voucher Details</h3>
          <div>
            <div className="text-xs text-white/40 mb-1">Title</div>
            <div className="text-white font-medium">{voucher.title}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-xs text-white/40 mb-1">Brand</div><div className="text-white text-sm">{voucher.brand}</div></div>
            <div><div className="text-xs text-white/40 mb-1">Category</div><div className="text-white text-sm">{voucher.category_name}</div></div>
            <div><div className="text-xs text-white/40 mb-1">Original Value</div><div className="text-white text-sm">₹{parseFloat(voucher.original_value).toFixed(2)}</div></div>
            <div><div className="text-xs text-white/40 mb-1">Selling Price</div><div className="text-primary-300 text-sm font-semibold">₹{parseFloat(voucher.selling_price).toFixed(2)}</div></div>
          </div>
          {voucher.expiry_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-3.5 h-3.5 text-white/30" />
              <span className="text-white/60">Expires {format(new Date(voucher.expiry_date), 'dd MMMM yyyy')}</span>
            </div>
          )}
          {voucher.description && (
            <div><div className="text-xs text-white/40 mb-1">Description</div><div className="text-white/60 text-sm">{voucher.description}</div></div>
          )}
          {/* CODE — admin can see it */}
          <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-3">
            <div className="text-xs text-primary-400 mb-1">Voucher Code (Admin View)</div>
            <div className="font-mono text-primary-200 text-sm tracking-wide">{voucher.code}</div>
          </div>
        </div>

        {/* Seller Info */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-semibold text-white text-sm mb-4">Seller Info</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-300 font-bold">
                {voucher.seller_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-white font-medium">{voucher.seller_name}</div>
                <div className="text-white/40 text-xs">{voucher.seller_email}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-white/30 mb-1">Rating</div><div className="text-yellow-400 flex items-center gap-1"><Star className="w-3.5 h-3.5" />{parseFloat(voucher.seller_rating || 5).toFixed(1)}</div></div>
              <div><div className="text-xs text-white/30 mb-1">Total Sold</div><div className="text-white">{voucher.total_sold}</div></div>
            </div>
          </div>

          {/* Review checklist */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-semibold text-white text-sm mb-3">Review Checklist</h3>
            <div className="space-y-2 text-sm text-white/60">
              {[
                'Voucher code looks valid (not blank/test)',
                'Brand matches description',
                'Price discount is reasonable (5-90%)',
                'Expiry date is in the future',
                'No duplicate listing from same seller',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded border border-white/20 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Panel */}
      {isPending && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-white text-sm">Review Decision</h3>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Internal Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="input-base resize-none text-sm" placeholder="Notes visible to other admins..." />
          </div>

          {action === 'reject' && (
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Rejection Reason (shown to seller) *</label>
              <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={2}
                className="input-base resize-none text-sm border-red-500/30" placeholder="e.g. Voucher code appears invalid, please re-verify..." />
            </div>
          )}

          <div className="flex gap-3">
            {action === 'reject' ? (
              <>
                <button onClick={() => setAction(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleReject} disabled={submitting} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-50">
                  {submitting ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setAction('reject')} className="btn-secondary flex-1 flex items-center justify-center gap-2 border-red-500/20 text-red-400 hover:bg-red-500/10">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button onClick={handleApprove} disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" /> {submitting ? 'Approving...' : 'Approve & Publish'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
