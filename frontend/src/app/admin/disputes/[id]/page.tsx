'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Send, CheckCircle, XCircle, Flame, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import clsx from 'clsx';

const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];
const OUTCOME_OPTIONS = [
  { value: 'favor_buyer', label: 'Favor Buyer (refund)' },
  { value: 'favor_seller', label: 'Favor Seller (no refund)' },
  { value: 'split', label: 'Split refund' },
  { value: 'dismissed', label: 'Dismiss (no action)' },
];

export default function AdminDisputeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [dispute, setDispute] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [resolution, setResolution] = useState({ outcome: 'favor_seller', text: '', refund: '' });
  const [resolving, setResolving] = useState(false);

  const fetchData = async () => {
    const { data } = await api.get(`/admin/disputes/${id}`);
    setDispute(data.dispute);
    setMessages(data.messages);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const sendMessage = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await api.post(`/admin/disputes/${id}/message`, { message: msg });
      setMsg('');
      fetchData();
    } finally { setSending(false); }
  };

  const setPriority = async (priority: string) => {
    await api.put(`/admin/disputes/${id}/priority`, { priority });
    toast.success(`Priority set to ${priority}`);
    fetchData();
  };

  const handleResolve = async () => {
    if (!resolution.text.trim()) { toast.error('Resolution text required'); return; }
    setResolving(true);
    try {
      await api.post(`/admin/disputes/${id}/resolve`, {
        outcome: resolution.outcome,
        resolution: resolution.text,
        refund_amount: resolution.outcome !== 'favor_seller' && resolution.outcome !== 'dismissed' ? parseFloat(resolution.refund) || 0 : 0,
      });
      toast.success('Dispute resolved!');
      router.push('/admin/disputes');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setResolving(false); }
  };

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>;
  if (!dispute) return null;

  const isActive = ['open', 'under_review'].includes(dispute.status);

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <Link href="/admin/disputes" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        {isActive && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Priority:</span>
            {PRIORITY_OPTIONS.map(p => (
              <button key={p} onClick={() => setPriority(p)}
                className={clsx('text-xs px-2.5 py-1 rounded-lg capitalize transition-all', dispute.priority === p ? 'bg-primary-500 text-white' : 'glass-card text-white/40 hover:text-white/70')}>
                {p === 'urgent' && <Flame className="w-3 h-3 inline mr-1" />}{p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dispute Info */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx('badge text-xs', {
                'bg-red-500/15 text-red-400': dispute.status === 'open',
                'bg-yellow-500/15 text-yellow-400': dispute.status === 'under_review',
                'bg-green-500/15 text-green-400': dispute.status === 'resolved',
                'bg-white/10 text-white/30': dispute.status === 'dismissed',
              })}>{dispute.status.replace('_', ' ')}</span>
              <span className="badge bg-white/5 text-white/40 text-xs capitalize">{dispute.type?.replace('_', ' ')}</span>
            </div>
            <h2 className="font-display text-xl font-700 text-white">{dispute.voucher_title}</h2>
            <p className="text-white/40 text-sm mt-1">{dispute.brand} • ₹{parseFloat(dispute.transaction_amount || 0).toFixed(2)}</p>
          </div>
          {dispute.refund_issued && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2 text-center">
              <div className="text-green-400 text-xs">Refunded</div>
              <div className="font-display font-700 text-green-300">₹{parseFloat(dispute.refund_amount).toFixed(2)}</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5 text-sm">
          <div><div className="text-xs text-white/30 mb-1">Raised by</div><div className="text-white">{dispute.raised_by_name}</div><div className="text-white/30 text-xs">{dispute.raised_by_email}</div></div>
          <div><div className="text-xs text-white/30 mb-1">Against</div><div className="text-white">{dispute.against_user_name}</div><div className="text-white/30 text-xs">{dispute.against_user_email}</div></div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="text-xs text-white/30 mb-2">Complaint</div>
          <p className="text-white/70 text-sm leading-relaxed">{dispute.description}</p>
        </div>

        {dispute.resolution && (
          <div className="mt-4 pt-4 border-t border-white/5 bg-green-500/5 rounded-xl p-3">
            <div className="text-xs text-green-400 mb-1">Resolution by {dispute.resolved_by_name}</div>
            <p className="text-white/70 text-sm">{dispute.resolution}</p>
          </div>
        )}
      </div>

      {/* Message Thread */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="font-semibold text-white text-sm mb-4">Admin Thread</h3>
        {messages.length === 0 ? (
          <p className="text-white/30 text-sm py-4 text-center">No messages yet</p>
        ) : (
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {messages.map(m => (
              <div key={m.id} className={clsx('rounded-xl p-3 text-sm', m.is_admin ? 'bg-primary-500/10 border border-primary-500/20 ml-8' : 'bg-white/5 mr-8')}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={clsx('text-xs font-medium', m.is_admin ? 'text-primary-400' : 'text-white/60')}>{m.sender_name}</span>
                  {m.is_admin && <span className="badge bg-primary-500/20 text-primary-400 text-xs">Admin</span>}
                  <span className="text-xs text-white/20 ml-auto">{format(new Date(m.created_at), 'dd MMM, HH:mm')}</span>
                </div>
                <p className="text-white/70 leading-relaxed">{m.message}</p>
              </div>
            ))}
          </div>
        )}

        {isActive && (
          <div className="flex gap-2">
            <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={2}
              className="input-base flex-1 resize-none text-sm" placeholder="Write a message to both parties..." />
            <button onClick={sendMessage} disabled={sending || !msg.trim()} className="btn-primary !px-4 self-end disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Resolve Panel */}
      {isActive && (
        <div className="glass-card rounded-2xl p-5">
          {!showResolve ? (
            <button onClick={() => setShowResolve(true)} className="btn-primary w-full flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" /> Resolve Dispute
            </button>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-sm">Resolution</h3>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Outcome</label>
                <div className="grid grid-cols-2 gap-2">
                  {OUTCOME_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => setResolution(r => ({ ...r, outcome: o.value }))}
                      className={clsx('text-sm px-4 py-2 rounded-xl transition-all border text-left', resolution.outcome === o.value ? 'bg-primary-500/20 border-primary-500/30 text-primary-300' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20')}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {(resolution.outcome === 'favor_buyer' || resolution.outcome === 'split') && (
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Refund Amount (₹)</label>
                  <input type="number" value={resolution.refund} onChange={e => setResolution(r => ({ ...r, refund: e.target.value }))}
                    className="input-base text-sm" placeholder={`Max ₹${parseFloat(dispute.transaction_amount || 0).toFixed(2)}`}
                    max={dispute.transaction_amount} />
                </div>
              )}

              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Resolution Note *</label>
                <textarea value={resolution.text} onChange={e => setResolution(r => ({ ...r, text: e.target.value }))}
                  rows={3} className="input-base resize-none text-sm" placeholder="Explain the decision..." />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowResolve(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleResolve} disabled={resolving} className="btn-primary flex-1 disabled:opacity-50">
                  {resolving ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
