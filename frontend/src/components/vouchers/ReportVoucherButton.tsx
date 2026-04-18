'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Flag, XCircle } from 'lucide-react';
import clsx from 'clsx';

const REASONS = [
  { value: 'already_used', label: 'Code already used', desc: 'I tried the code and it says already redeemed' },
  { value: 'expired', label: 'Code is expired', desc: 'The voucher was expired when I tried to use it' },
  { value: 'wrong_code', label: 'Wrong / invalid code', desc: 'Code format is wrong or not accepted by the platform' },
  { value: 'invalid_format', label: 'Invalid format', desc: "The code does not match the brand's expected format" },
  { value: 'fake', label: 'Fake voucher', desc: 'I believe this voucher code was never real' },
];

interface Props {
  voucherId: string;
  transactionId: string;
  voucherTitle: string;
  alreadyReported?: boolean;
}

export default function ReportVoucherButton({ voucherId, transactionId, voucherTitle, alreadyReported }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadyReported || false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async () => {
    if (!reason) { toast.error('Please select a reason'); return; }
    setSubmitting(true);
    try {
      await api.post(`/vouchers/${voucherId}/report`, { reason, description, transaction_id: transactionId });
      toast.success("Report submitted. We'll review within 24 hours.");
      setSubmitted(true);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <span className="text-xs text-yellow-400/60 flex items-center gap-1">
        <Flag className="w-3 h-3" /> Reported
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-red-400/50 hover:text-red-400 transition-colors"
      >
        <Flag className="w-3 h-3" /> Report
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setOpen(false)}
        >
          <div className="min-h-full flex items-center justify-center p-4">
            <div
              className="relative w-full max-w-md rounded-2xl shadow-2xl"
              style={{ backgroundColor: '#16162a', border: '1px solid rgba(255,255,255,0.12)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Report Invalid Voucher</h3>
                  <p className="text-white/40 text-xs mt-1 truncate max-w-[260px]">{voucherTitle}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/40 hover:text-white transition-colors ml-4 shrink-0"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 pb-6 space-y-4">
                {/* Reasons */}
                <div>
                  <label className="text-xs text-white/50 block mb-2">What's wrong with this voucher?</label>
                  <div className="space-y-2">
                    {REASONS.map(r => (
                      <button
                        key={r.value}
                        onClick={() => setReason(r.value)}
                        className={clsx(
                          'w-full text-left px-4 py-3 rounded-xl border transition-all',
                          reason === r.value
                            ? 'border-red-500/60 bg-red-500/15'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        )}
                      >
                        <div className={clsx('text-sm font-medium', reason === r.value ? 'text-red-400' : 'text-white/80')}>
                          {r.label}
                        </div>
                        <div className="text-xs text-white/40 mt-0.5">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Additional details (optional)</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="Describe the issue in more detail..."
                  />
                </div>

                {/* Info */}
                <div
                  className="rounded-xl px-4 py-3 text-xs text-white/40"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  Our team reviews reports within 24 hours. If confirmed, you'll receive a full refund to your wallet.
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setOpen(false)}
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !reason}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                    style={{ backgroundColor: reason && !submitting ? '#ef4444' : 'rgba(239,68,68,0.3)' }}
                  >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}