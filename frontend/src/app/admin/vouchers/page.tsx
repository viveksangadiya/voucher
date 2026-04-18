'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Eye, Clock, Search } from 'lucide-react';
import clsx from 'clsx';

const STATUS_TABS = [
  { value: 'pending_review', label: 'Pending', color: 'text-yellow-400' },
  { value: 'approved', label: 'Approved', color: 'text-green-400' },
  { value: 'rejected', label: 'Rejected', color: 'text-red-400' },
  { value: 'all', label: 'All', color: 'text-white/40' },
];

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [tab, setTab] = useState('pending_review');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/vouchers', {
        params: { verification_status: tab, search, page, limit: 20 }
      });
      setVouchers(data.vouchers);
      setTotal(data.total);
      setPages(data.pages);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [tab, search, page]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-700 text-white">Voucher Review</h1>
          <p className="text-white/30 text-sm mt-1">{total} vouchers in queue</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-card rounded-xl p-1 w-fit">
        {STATUS_TABS.map(t => (
          <button key={t.value} onClick={() => { setTab(t.value); setPage(1); }}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === t.value ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input-base pl-10 h-10 text-sm" placeholder="Search title, brand, seller email..." />
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['Voucher', 'Seller', 'Value / Price', 'Category', 'Submitted', 'Status', ''].map(h => (
                <th key={h} className="text-left text-xs text-white/30 font-medium px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-24" /></td>)}
                </tr>
              ))
            ) : vouchers.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-white/30 text-sm">No vouchers in this category</td></tr>
            ) : vouchers.map(v => (
              <tr key={v.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white text-sm max-w-[200px] truncate">{v.title}</div>
                  <div className="text-xs text-white/30">{v.brand}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-white/70">{v.seller_name}</div>
                  <div className="text-xs text-white/30">{v.seller_email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-white">₹{parseFloat(v.selling_price).toFixed(0)}</div>
                  <div className="text-xs text-white/30 line-through">₹{parseFloat(v.original_value).toFixed(0)}</div>
                </td>
                <td className="px-4 py-3 text-sm text-white/50">{v.category_name}</td>
                <td className="px-4 py-3 text-xs text-white/30">{format(new Date(v.created_at), 'dd MMM, HH:mm')}</td>
                <td className="px-4 py-3">
                  <span className={clsx('badge text-xs', {
                    'bg-yellow-500/15 text-yellow-400': v.verification_status === 'pending_review',
                    'bg-green-500/15 text-green-400': v.verification_status === 'approved',
                    'bg-red-500/15 text-red-400': v.verification_status === 'rejected',
                  })}>
                    {v.verification_status === 'pending_review' ? 'Pending' : v.verification_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/vouchers/${v.id}`} className="text-primary-400 hover:text-primary-300 transition-colors">
                    <Eye className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex gap-2">
          {[...Array(pages)].map((_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={clsx('w-8 h-8 rounded-lg text-sm transition-all', page === i + 1 ? 'bg-primary-500 text-white' : 'glass-card text-white/40 hover:text-white')}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
