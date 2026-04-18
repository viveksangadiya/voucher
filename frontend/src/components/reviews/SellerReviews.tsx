'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { format } from 'date-fns';
import { ThumbsUp, ChevronDown, MessageSquare } from 'lucide-react';
import StarRating from './StarRating';
import clsx from 'clsx';

interface Props {
  sellerId: string;
  sellerName: string;
}

const SORT_OPTIONS = [
  { value: 'newest',  label: 'Newest first' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest',  label: 'Lowest rated' },
  { value: 'helpful', label: 'Most helpful' },
];

export default function SellerReviews({ sellerId, sellerName }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const fetchReviews = async (p = 1, s = sort) => {
    setLoading(true);
    try {
      const res = await api.get(`/reviews/seller/${sellerId}`, {
        params: { page: p, limit: 10, sort: s },
      });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(1, sort); setPage(1); }, [sellerId, sort]);

  const handleHelpful = async (reviewId: string) => {
    await api.post(`/reviews/${reviewId}/helpful`).catch(() => {});
    // Optimistic update
    setData((d: any) => ({
      ...d,
      reviews: d.reviews.map((r: any) =>
        r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r
      ),
    }));
  };

  if (!data && loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-4 space-y-2">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-3/4 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { reviews, stats, pages } = data;

  return (
    <div className="space-y-5">
      {/* Rating Summary */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4">
          Reviews for <span className="text-primary-400">{sellerName}</span>
        </h3>

        <div className="flex gap-6 items-start">
          {/* Big average score */}
          <div className="text-center shrink-0">
            <div className="font-display text-5xl font-800 text-white leading-none">
              {stats.average.toFixed(1)}
            </div>
            <StarRating value={Math.round(stats.average)} readonly size="sm" />
            <div className="text-white/30 text-xs mt-1">{stats.total} review{stats.total !== 1 ? 's' : ''}</div>
          </div>

          {/* Breakdown bars */}
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map(star => {
              const count = stats.breakdown[star] || 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="text-white/40 w-3 shrink-0">{star}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        star >= 4 ? 'bg-green-400' : star === 3 ? 'bg-yellow-400' : 'bg-red-400'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-white/30 w-5 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sort */}
      {reviews.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-white/30 text-sm">{stats.total} review{stats.total !== 1 ? 's' : ''}</span>
          <div className="relative">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="appearance-none bg-white/5 border border-white/10 text-white/70 text-sm rounded-xl px-3 py-2 pr-8 focus:outline-none"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-white/30 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Review list */}
      {reviews.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-white/30 text-sm">
          No reviews yet — be the first to review this seller
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r: any) => (
            <div key={r.id} className="glass-card rounded-xl p-4 space-y-3">
              {/* Reviewer info + stars */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-300 font-bold text-sm shrink-0">
                    {r.reviewer_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{r.reviewer_name}</div>
                    <div className="text-xs text-white/30 mt-0.5">
                      {format(new Date(r.created_at), 'dd MMM yyyy')}
                      {r.is_edited && <span className="ml-2 text-white/20">(edited)</span>}
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <StarRating value={r.rating} readonly size="sm" />
                </div>
              </div>

              {/* Voucher tag */}
              {r.voucher_title && (
                <div className="text-xs text-white/30 flex items-center gap-1">
                  <span className="bg-white/5 px-2 py-0.5 rounded">
                    {r.voucher_brand} — {r.voucher_title}
                  </span>
                </div>
              )}

              {/* Comment */}
              {r.comment && (
                <p className="text-sm text-white/70 leading-relaxed">{r.comment}</p>
              )}

              {/* Seller reply */}
              {r.reply && (
                <div className="bg-primary-500/5 border border-primary-500/15 rounded-xl p-3 mt-2">
                  <div className="text-xs text-primary-400 font-medium mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Seller replied
                    <span className="text-white/20 ml-1">
                      · {format(new Date(r.replied_at), 'dd MMM')}
                    </span>
                  </div>
                  <p className="text-sm text-white/60">{r.reply}</p>
                </div>
              )}

              {/* Helpful */}
              <button
                onClick={() => handleHelpful(r.id)}
                className="flex items-center gap-1.5 text-xs text-white/20 hover:text-white/50 transition-colors"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                Helpful{r.helpful_count > 0 && ` (${r.helpful_count})`}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(pages)].map((_, i) => (
            <button
              key={i}
              onClick={() => { setPage(i + 1); fetchReviews(i + 1); }}
              className={clsx(
                'w-8 h-8 rounded-lg text-sm transition-all',
                page === i + 1
                  ? 'bg-primary-500 text-white'
                  : 'glass-card text-white/40 hover:text-white'
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
