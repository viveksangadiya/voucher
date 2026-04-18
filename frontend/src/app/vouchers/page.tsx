'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import VoucherCard from '@/components/ui/VoucherCard';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import clsx from 'clsx';

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'discount', label: 'Best Discount' },
  { value: 'price_asc', label: 'Price: Low→High' },
  { value: 'price_desc', label: 'Price: High→Low' },
  { value: 'popular', label: 'Most Viewed' },
];

export default function VouchersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [vouchers, setVouchers] = useState([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    sort: searchParams.get('sort') || 'newest',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    page: 1,
  });

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data));
  }, []);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, String(v)); });
    try {
      const { data } = await api.get(`/vouchers?${params}`);
      setVouchers(data.vouchers);
      setTotal(data.total);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  const update = (key: string, value: any) => setFilters(f => ({ ...f, [key]: value, page: 1 }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-700 text-white">Browse Vouchers</h1>
          <p className="text-white/40 text-sm mt-1">{total} vouchers available</p>
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary flex items-center gap-2 !px-4 !py-2 !text-sm">
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </button>
      </div>

      {/* Search + Sort Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input type="text" placeholder="Search vouchers..." value={filters.search}
            onChange={e => update('search', e.target.value)}
            className="input-base pl-11 h-11" />
        </div>
        <select value={filters.sort} onChange={e => update('sort', e.target.value)}
          className="input-base w-auto h-11 cursor-pointer">
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="glass-card rounded-2xl p-5 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Filters</h3>
            <button onClick={() => setFilters(f => ({ ...f, category: '', minPrice: '', maxPrice: '' }))} className="text-xs text-white/40 hover:text-white flex items-center gap-1">
              <X className="w-3 h-3" /> Clear all
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-white/40 mb-2 block">Category</label>
              <select value={filters.category} onChange={e => update('category', e.target.value)} className="input-base w-full text-sm">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-2 block">Min Price (₹)</label>
              <input type="number" placeholder="0" value={filters.minPrice} onChange={e => update('minPrice', e.target.value)} className="input-base text-sm" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-2 block">Max Price (₹)</label>
              <input type="number" placeholder="10000" value={filters.maxPrice} onChange={e => update('maxPrice', e.target.value)} className="input-base text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => update('category', '')} className={clsx('badge whitespace-nowrap cursor-pointer transition-all px-4 py-2 rounded-full text-sm', !filters.category ? 'bg-primary-500 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10')}>All</button>
        {categories.map(c => (
          <button key={c.slug} onClick={() => update('category', c.slug)}
            className={clsx('badge whitespace-nowrap cursor-pointer transition-all px-4 py-2 rounded-full text-sm', filters.category === c.slug ? 'bg-primary-500 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10')}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => <div key={i} className="skeleton rounded-2xl h-56" />)}
        </div>
      ) : vouchers.length === 0 ? (
        <div className="text-center py-24 text-white/30">
          <div className="text-6xl mb-4">🏷️</div>
          <p className="text-lg">No vouchers found</p>
          <p className="text-sm mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          {vouchers.map((v: any) => <VoucherCard key={v.id} voucher={v} />)}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          {[...Array(pages)].map((_, i) => (
            <button key={i} onClick={() => setFilters(f => ({ ...f, page: i + 1 }))}
              className={clsx('w-10 h-10 rounded-xl text-sm font-medium transition-all', filters.page === i + 1 ? 'bg-primary-500 text-white' : 'glass-card text-white/50 hover:text-white')}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
