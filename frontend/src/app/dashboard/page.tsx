'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { LayoutDashboard, Tag, ShoppingCart, Wallet, TrendingUp, ArrowUpRight, ArrowDownLeft, CheckCircle, Clock, Plus, Eye } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import clsx from 'clsx';
import WalletTab from '@/components/wallet/WalletTab';
import ReportVoucherButton from '@/components/vouchers/ReportVoucherButton';
import ReviewButton from '@/components/reviews/ReviewButton';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'listings', label: 'My Listings', icon: Tag },
  { id: 'purchases', label: 'Purchases', icon: ShoppingCart },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
];

export default function DashboardPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { user, refreshUser, isHydrated } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState(searchParams?.tab || 'overview');
  const [stats, setStats] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [walletHistory, setWalletHistory] = useState<any[]>([]);
  const [addAmount, setAddAmount] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) { router.push('/login'); return; }
    fetchData();
  }, [isHydrated, user, tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const { data } = await api.get('/dashboard/stats');
        setStats(data);
      } else if (tab === 'listings') {
        const { data } = await api.get('/vouchers/mine');
        setListings(data);
      } else if (tab === 'purchases') {
        const { data } = await api.get('/transactions?role=buyer');
        setPurchases(data);
      } else if (tab === 'wallet') {
        const { data } = await api.get('/wallet/history');
        setWalletHistory(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setAdding(true);
    try {
      await api.post('/wallet/add-funds', { amount });
      toast.success(`₹${amount} added to wallet!`);
      setAddAmount('');
      await refreshUser();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add funds');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm('Delete this voucher listing?')) return;
    try {
      await api.delete(`/vouchers/${id}`);
      toast.success('Listing deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Cannot delete');
    }
  };

  if (!user) return null;
  if (!isHydrated) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-white/20 text-sm">Loading...</div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-700 text-white">Dashboard</h1>
          <p className="text-white/40 mt-1">Hello, {user.name} 👋</p>
        </div>
        <Link href="/sell" className="btn-primary flex items-center gap-2 !px-4 !py-2.5 !text-sm">
          <Plus className="w-4 h-4" /> List Voucher
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-card rounded-xl p-1 mb-6 w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === t.id ? 'bg-primary-500 text-white' : 'text-white/50 hover:text-white')}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* Overview */}
          {tab === 'overview' && stats && (
            <div className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Wallet Balance', value: `₹${stats.balance.toFixed(2)}`, icon: <Wallet className="w-5 h-5" />, color: 'text-primary-400' },
                  { label: 'Total Earned', value: `₹${stats.total_earned.toFixed(2)}`, icon: <TrendingUp className="w-5 h-5" />, color: 'text-green-400' },
                  { label: 'Vouchers Sold', value: stats.total_sold, icon: <Tag className="w-5 h-5" />, color: 'text-blue-400' },
                  { label: 'Active Listings', value: stats.active_listings, icon: <CheckCircle className="w-5 h-5" />, color: 'text-yellow-400' },
                ].map(s => (
                  <div key={s.label} className="glass-card rounded-2xl p-5">
                    <div className={clsx('mb-3', s.color)}>{s.icon}</div>
                    <div className="font-display text-2xl font-700 text-white">{s.value}</div>
                    <div className="text-white/40 text-xs mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {stats.recent_wallet?.length > 0 && (
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="font-semibold text-white mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {stats.recent_wallet.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-3">
                        <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center', t.type === 'credit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                          {t.type === 'credit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white/80 truncate">{t.description}</div>
                          <div className="text-xs text-white/30">{format(new Date(t.created_at), 'dd MMM, HH:mm')}</div>
                        </div>
                        <span className={clsx('font-semibold text-sm', t.type === 'credit' ? 'text-green-400' : 'text-red-400')}>
                          {t.type === 'credit' ? '+' : '-'}₹{parseFloat(t.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Listings */}
          {tab === 'listings' && (
            <div className="animate-fade-in space-y-3">
              {listings.length === 0 ? (
                <div className="text-center py-20 text-white/30">
                  <Tag className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No listings yet</p>
                  <Link href="/sell" className="btn-primary inline-flex mt-4 items-center gap-2 !px-4 !py-2 !text-sm">
                    <Plus className="w-4 h-4" /> List your first voucher
                  </Link>
                </div>
              ) : listings.map((v: any) => (
                <div key={v.id} className="glass-card rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx('badge text-xs', v.status === 'active' ? 'bg-green-500/20 text-green-400' : v.status === 'sold' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400')}>
                        {v.status}
                      </span>
                      <span className="text-white/40 text-xs">{v.category_name}</span>
                    </div>
                    <div className="font-semibold text-white text-sm truncate">{v.title}</div>
                    <div className="text-white/40 text-xs">{v.brand}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display font-700 text-white">₹{parseFloat(v.selling_price).toFixed(0)}</div>
                    <div className="text-white/30 text-xs line-through">₹{parseFloat(v.original_value).toFixed(0)}</div>
                  </div>
                  <div className="flex gap-2">
                    {v.status === 'active' && (
                      <button onClick={() => handleDeleteListing(v.id)} className="text-xs text-red-400/60 hover:text-red-400 transition-colors px-2 py-1">Delete</button>
                    )}
                    <Link href={`/vouchers/${v.id}`} className="text-xs text-primary-400/60 hover:text-primary-400 transition-colors px-2 py-1">View</Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Purchases */}
                    {/* Purchases */}
                    {tab === 'purchases' && (
            <div className="animate-fade-in space-y-3">
              {purchases.length === 0 ? (
                <div className="text-center py-20 text-white/30">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No purchases yet</p>
                  <Link href="/vouchers" className="btn-primary inline-flex mt-4 items-center gap-2 !px-4 !py-2 !text-sm">Browse vouchers</Link>
                </div>
              ) : purchases.map((t: any) => (
                <div key={t.id} className="glass-card rounded-xl p-4">
                  {/* Top row: icon + info + price */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-4 h-4 text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm truncate">{t.voucher_title}</div>
                      <div className="text-white/40 text-xs mt-0.5">
                        {t.voucher_brand} &bull; Seller: {t.seller_name} &bull; {format(new Date(t.created_at), 'dd MMM yyyy')}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display font-700 text-primary-300">₹{parseFloat(t.amount).toFixed(2)}</div>
                      <span className="badge bg-green-500/20 text-green-400 text-xs">{t.status}</span>
                    </div>
                  </div>

                  {/* Bottom row: actions */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                    {/* View voucher details */}
                    <Link
                      href={`/vouchers/${t.voucher_id}`}
                      className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Details
                    </Link>

                    <span className="text-white/10">|</span>

                    {/* Review button */}
                    <ReviewButton
                      transactionId={t.id}
                      sellerName={t.seller_name}
                      voucherTitle={t.voucher_title}
                    />

                    <span className="text-white/10">|</span>

                    {/* Report button */}
                    <ReportVoucherButton
                      voucherId={t.voucher_id}
                      transactionId={t.id}
                      voucherTitle={t.voucher_title}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}


          {/* Wallet */}
          {tab === 'wallet' && <WalletTab />}

        </>
      )}
    </div>
  );
}
