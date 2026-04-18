'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Star, CheckCircle } from 'lucide-react';
import WriteReviewModal from './WriteReviewModal';
import StarRating from './StarRating';

interface Props {
  transactionId: string;
  sellerName: string;
  sellerNameFallback?: string;
  voucherTitle: string;
}

export default function ReviewButton({ transactionId, sellerName, voucherTitle }: Props) {
  const [status, setStatus] = useState<'loading' | 'pending' | 'done'>('loading');
  const [existingReview, setExistingReview] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    api.get(`/reviews/check/${transactionId}`)
      .then(({ data }) => {
        if (data.reviewed) {
          setExistingReview(data.review);
          setStatus('done');
        } else {
          setStatus('pending');
        }
      })
      .catch(() => setStatus('pending'));
  }, [transactionId]);

  if (status === 'loading') return <div className="skeleton h-6 w-24 rounded" />;

  if (status === 'done' && existingReview) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-white/40">
        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
        <span>Reviewed</span>
        <StarRating value={existingReview.rating} readonly size="sm" />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
      >
        <Star className="w-3.5 h-3.5" />
        Leave a review
      </button>

      {showModal && (
        <WriteReviewModal
          transactionId={transactionId}
          sellerName={sellerName}
          voucherTitle={voucherTitle}
          onSuccess={(review) => {
            setExistingReview(review);
            setStatus('done');
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
