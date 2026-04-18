'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import VoucherCard from '@/components/ui/VoucherCard';
import { Search, Tag, ShieldCheck, Zap, TrendingUp, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const CATEGORY_ICONS: Record<string, string> = {
  'food-dining': '🍕', shopping: '🛍️', travel: '✈️', entertainment: '🎬',
  'health-beauty': '💄', electronics: '💻', 'sports-fitness': '🏋️', education: '📚'
};

export default function HomePage() {
  const [vouchers, setVouchers] = useState([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      api.get('/vouchers?limit=8&sort=newest'),
      api.get('/categories'),
    ]).then(([v, c]) => {
      setVouchers(v.data.vouchers);
      setCategories(c.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/vouchers?search=${encodeURIComponent(search)}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/30 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 right-20 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-40 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 py-24 text-center relative">
          <div className="inline-flex items-center gap-2 badge bg-primary-500/15 text-primary-300 border border-primary-500/20 mb-6 px-4 py-2 text-sm">
            <Zap className="w-3.5 h-3.5" /> Buy & sell unused vouchers
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-800 text-white leading-tight mb-6">
            Turn Vouchers<br />Into <span className="gradient-text">Cash</span>
          </h1>
          <p className="text-white/50 text-lg md:text-xl max-w-2xl mx-auto mb-10">
            The trusted marketplace to buy vouchers at a discount or sell the ones you don't need. Win-win every time.
          </p>

          <form onSubmit={handleSearch} className="flex max-w-lg mx-auto gap-3 mb-12">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search brand, category..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-base pl-11 h-12"
              />
            </div>
            <button type="submit" className="btn-primary h-12 whitespace-nowrap">Search</button>
          </form>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 text-center">
            {[['10,000+', 'Active Vouchers'], ['₹2M+', 'Saved by Buyers'], ['5,000+', 'Sellers'], ['4.9★', 'Avg Rating']].map(([val, label]) => (
              <div key={label}>
                <div className="font-display text-2xl font-700 text-white">{val}</div>
                <div className="text-white/40 text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-700 text-white">Browse Categories</h2>
          <Link href="/vouchers" className="text-primary-400 text-sm hover:text-primary-300 flex items-center gap-1">
            All vouchers <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
          {categories.map(cat => (
            <Link key={cat.id} href={`/vouchers?category=${cat.slug}`}
              className="glass-card glass-card-hover rounded-2xl p-4 text-center cursor-pointer group">
              <div className="text-3xl mb-2">{CATEGORY_ICONS[cat.slug] || '🏷️'}</div>
              <div className="text-xs text-white/60 group-hover:text-white/90 transition-colors font-medium leading-tight">{cat.name}</div>
              <div className="text-xs text-primary-400 mt-1">{cat.voucher_count}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Vouchers */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-700 text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-400" /> Latest Vouchers
          </h2>
          <Link href="/vouchers" className="text-primary-400 text-sm hover:text-primary-300 flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="skeleton rounded-2xl h-56" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {vouchers.map((v: any) => <VoucherCard key={v.id} voucher={v} />)}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="font-display text-3xl font-700 text-white text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: <Search className="w-6 h-6" />, title: 'Browse & Buy', desc: 'Find vouchers at up to 80% off. Pay securely with your wallet.' },
            { icon: <Tag className="w-6 h-6" />, title: 'List & Sell', desc: 'Upload your unused voucher, set a price, and get cash fast.' },
            { icon: <ShieldCheck className="w-6 h-6" />, title: 'Safe & Secure', desc: 'Voucher code revealed only after successful payment. 20% platform fee on each sale.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="glass-card rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-primary-500/20 rounded-2xl flex items-center justify-center text-primary-400 mx-auto mb-4">{icon}</div>
              <h3 className="font-display text-lg font-700 text-white mb-2">{title}</h3>
              <p className="text-white/40 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="glass-card rounded-3xl p-10 text-center bg-gradient-to-r from-primary-900/30 to-orange-900/20 border border-primary-500/20">
          <h2 className="font-display text-3xl font-700 text-white mb-3">Have unused vouchers?</h2>
          <p className="text-white/50 mb-6">Turn them into real money in minutes. It's free to list.</p>
          <Link href="/sell" className="btn-primary inline-flex items-center gap-2">
            Start Selling <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
