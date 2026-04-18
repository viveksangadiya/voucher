'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { X, Send } from 'lucide-react';
import StarRating from './StarRating';
import clsx from 'clsx';

interface Props {
  transactionId: string;
  sellerName: string;
  voucherTitle: string;
  onSuccess: (review: any) => void;
  onClose: () => void;
}

const LABELS = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];
const LABEL_COLORS = ['', 'text-red-400', 'text-red-400', 'text-yellow-400', 'text-green-400', 'text-green-400'];

export default function WriteReviewModal({ transactionId, sellerName, voucherTitle, onSuccess, onClose }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async () => {
    if (!rating) { toast.error('Please select a star rating'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/reviews', {
        transaction_id: transactionId,
        rating,
        comment: comment.trim() || undefined,
      });
      toast.success('Review submitted!');
      onSuccess(data.review);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
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
              <h3 className="text-base font-bold text-white">Rate your purchase</h3>
              <p className="text-white/40 text-xs mt-1 truncate max-w-[260px]">{voucherTitle}</p>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors ml-4 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 space-y-5">
            {/* Stars */}
            <div className="text-center py-2">
              <p className="text-white/50 text-sm mb-4">
                How was your experience with{' '}
                <span className="text-white font-semibold">{sellerName}</span>?
              </p>
              <div className="flex justify-center mb-3">
                <StarRating value={rating} onChange={setRating} size="lg" />
              </div>
              <div className="h-5">
                {rating > 0 && (
                  <span className={clsx('text-sm font-semibold', LABEL_COLORS[rating])}>
                    {LABELS[rating]}
                  </span>
                )}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="text-xs text-white/50 block mb-1.5">
                Write a review <span className="text-white/25">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                maxLength={1000}
                rows={3}
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:ring-1 focus:ring-white/20"
                placeholder="Was the voucher code valid? Did it work as expected? Help other buyers..."
              />
              <div className="text-right text-xs text-white/25 mt-1">{comment.length}/1000</div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !rating}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#6366f1' }}
              >
                {submitting ? 'Submitting...' : <><Send className="w-4 h-4" /> Submit Review</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}