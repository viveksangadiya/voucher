'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { Calendar, Eye, Star, ShieldCheck, Tag, ArrowLeft, Copy, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import clsx from 'clsx';
import SellerReviews from '@/components/reviews/SellerReviews';

export default function VoucherDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  const [voucher, setVoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [revealedCode, setRevealedCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/vouchers/${id}`).then(r => { setVoucher(r.data); setLoading(false); }).catch(() => router.push('/vouchers'));
  }, [id]);

  // const handlePurchase = async () => {
  //   if (!user) { router.push('/login'); return; }
  //   if (user.balance < voucher.selling_price) {
  //     toast.error(`Insufficient balance. Please add ₹${(voucher.selling_price - user.balance).toFixed(2)} to your wallet.`);
  //     router.push('/dashboard?tab=wallet');
  //     return;
  //   }
  //   setPurchasing(true);
  //   try {
  //     const { data } = await api.post('/transactions/purchase', { voucher_id: voucher.id });
  //     setRevealedCode(data.voucher_code);
  //     setVoucher((v: any) => ({ ...v, status: 'sold' }));
  //     await refreshUser();
  //     toast.success('🎉 Purchase successful!');
  //   } catch (err: any) {
  //     toast.error(err.response?.data?.error || 'Purchase failed');
  //   } finally {
  //     setPurchasing(false);
  //   }
  // };
  const handlePurchase = async () => {
    if (!user) { router.push('/login'); return; }
  
    const balance = parseFloat(user.balance?.toString() || '0');
    const price = parseFloat(voucher.selling_price);
  
    if (balance < price) {
      toast.error(`Insufficient balance. Please add ₹${(price - balance).toFixed(2)} to your wallet.`);
      router.push('/dashboard?tab=wallet');
      return;
    }
  
    setPurchasing(true);
    try {
      const { data } = await api.post('/transactions/purchase', { voucher_id: voucher.id });
      setRevealedCode(data.voucher_code);
      setVoucher((v: any) => ({ ...v, status: 'sold' }));
      await refreshUser();
      toast.success('🎉 Purchase successful!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(revealedCode);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-white/40">Loading...</div>;
  if (!voucher) return null;

  const commission = parseFloat(voucher.selling_price) * 0.2;
  const sellerEarning = parseFloat(voucher.selling_price) - commission;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/vouchers" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to vouchers
      </Link>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Main Content */}
        <div className="md:col-span-3 space-y-5">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="badge bg-primary-500/20 text-primary-300 mb-3">{voucher.category_name}</div>
                <h1 className="font-display text-2xl font-700 text-white leading-tight">{voucher.title}</h1>
                <p className="text-white/40 mt-1 font-medium">{voucher.brand}</p>
              </div>
              <div className="bg-primary-500 rounded-2xl px-4 py-3 text-center shrink-0">
                <span className="font-display text-3xl font-800 text-white">{voucher.discount_percentage}%</span>
                <p className="text-primary-100 text-xs">OFF</p>
              </div>
            </div>

            {voucher.description && (
              <p className="text-white/50 text-sm mt-4 leading-relaxed">{voucher.description}</p>
            )}

            <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-white/5">
              {[
                ['Original Value', `₹${parseFloat(voucher.original_value).toFixed(2)}`],
                ['Selling Price', `₹${parseFloat(voucher.selling_price).toFixed(2)}`],
                ['You Save', `₹${(parseFloat(voucher.original_value) - parseFloat(voucher.selling_price)).toFixed(2)}`],
              ].map(([label, val]) => (
                <div key={label} className="text-center">
                  <div className={clsx('font-display font-700 text-xl', label === 'You Save' ? 'text-green-400' : 'text-white')}>{val}</div>
                  <div className="text-white/30 text-xs mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-4">Voucher Details</h3>
            <div className="space-y-3">
              {voucher.expiry_date && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40 flex items-center gap-2"><Calendar className="w-4 h-4" /> Expires</span>
                  <span className="text-white">{format(new Date(voucher.expiry_date), 'dd MMMM yyyy')}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/40 flex items-center gap-2"><Eye className="w-4 h-4" /> Views</span>
                <span className="text-white">{voucher.views}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/40 flex items-center gap-2"><Tag className="w-4 h-4" /> Status</span>
                <span className={clsx('badge', voucher.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                  {voucher.status}
                </span>
              </div>
            </div>
          </div>

          {/* Seller */}
          <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-300 text-xl font-bold">
              {voucher.seller_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{voucher.seller_name}</span>
                {voucher.seller_verified && <ShieldCheck className="w-4 h-4 text-primary-400" />}
              </div>
              <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" /> {parseFloat(voucher.seller_rating || 5).toFixed(1)}</span>
                <span>{voucher.seller_total_sold} sold</span>
              </div>
            </div>
          </div>
          <SellerReviews sellerId={voucher.seller_id} sellerName={voucher.seller_name} />
        </div>

        {/* Purchase Card */}
        <div className="md:col-span-2">
          <div className="glass-card rounded-2xl p-6 sticky top-24">
            {revealedCode ? (
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <h3 className="font-display text-xl font-700 text-white mb-1">Purchase Complete!</h3>
                <p className="text-white/40 text-sm mb-6">Your voucher code:</p>
                <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-4 font-mono text-lg text-primary-300 tracking-widest mb-4 break-all">
                  {revealedCode}
                </div>
                <button onClick={copyCode} className="btn-secondary w-full flex items-center justify-center gap-2">
                  {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="text-white/40 text-sm">Price</div>
                  <div className="font-display text-4xl font-800 text-white mt-1">₹{parseFloat(voucher.selling_price).toFixed(2)}</div>
                  <div className="text-green-400 text-sm mt-1">Save ₹{(parseFloat(voucher.original_value) - parseFloat(voucher.selling_price)).toFixed(2)}</div>
                </div>

                {user && (
                  <div className="glass-card rounded-xl p-3 mb-4 text-sm flex items-center justify-between">
                    <span className="text-white/40">Your balance</span>
                    <span className={clsx('font-semibold', parseFloat(user.balance?.toString() || '0') >= parseFloat(voucher.selling_price) ? 'text-green-400' : 'text-red-400')}>
                      ₹{parseFloat(user.balance?.toString() || '0').toFixed(2)}
                    </span>
                  </div>
                )}

                {voucher.status === 'active' ? (
                  voucher.seller_id === user?.id ? (
                    <div className="text-center text-white/40 text-sm py-4">This is your listing</div>
                  ) : (
                    <button onClick={handlePurchase} disabled={purchasing} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                      {purchasing ? 'Processing...' : '🛒 Buy Now'}
                    </button>
                  )
                ) : (
                  <div className="text-center text-white/40 text-sm py-4 glass-card rounded-xl">
                    Voucher {voucher.status}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-white/5 space-y-2 text-xs text-white/30">
                  <div className="flex justify-between"><span>Platform fee (20%)</span><span>₹{commission.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Seller receives</span><span>₹{sellerEarning.toFixed(2)}</span></div>
                </div>

                <div className="flex items-center gap-2 mt-4 text-xs text-white/30">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-400" /> Secured by VouchEx escrow
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
