'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { format } from 'date-fns';
import { AlertTriangle, Eye, Flame, ArrowUpCircle } from 'lucide-react';
import clsx from 'clsx';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border border-red-500/20',
  high: 'bg-orange-500/20 text-orange-400',
  normal: 'bg-blue-500/20 text-blue-400',
  low: 'bg-white/10 text-white/40',
};

const STATUS_TABS = ['open', 'under_review', 'resolved', 'dismissed', 'all'];

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState('open');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/disputes', { params: { status: tab, page, limit: 20 } });
      setDisputes(data.disputes);
      setTotal(data.total);
      setPages(data.pages);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [tab, page]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-700 text-white">Disputes</h1>
        <p className="text-white/30 text-sm mt-1">{total} cases</p>
      </div>

      <div className="flex gap-1 glass-card rounded-xl p-1 w-fit">
        {STATUS_TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all', tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70')}>
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['Priority', 'Type', 'Voucher', 'Raised by', 'Amount', 'Created', 'Status', ''].map(h => (
                <th key={h} className="text-left text-xs text-white/30 font-medium px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>)}
                </tr>
              ))
            ) : disputes.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-white/30 text-sm">No disputes</td></tr>
            ) : disputes.map(d => (
              <tr key={d.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                <td className="px-4 py-3">
                  <span className={clsx('badge text-xs', PRIORITY_COLORS[d.priority])}>
                    {d.priority === 'urgent' && <Flame className="w-3 h-3" />}
                    {d.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-white/60 capitalize">{d.type?.replace('_', ' ')}</td>
                <td className="px-4 py-3">
                  <div className="text-sm text-white max-w-[150px] truncate">{d.voucher_title}</div>
                  <div className="text-xs text-white/30">{d.voucher_brand}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-white/70">{d.raised_by_name}</div>
                  <div className="text-xs text-white/30">{d.raised_by_email}</div>
                </td>
                <td className="px-4 py-3 text-sm text-white">₹{parseFloat(d.transaction_amount || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-xs text-white/30">{format(new Date(d.created_at), 'dd MMM')}</td>
                <td className="px-4 py-3">
                  <span className={clsx('badge text-xs', {
                    'bg-red-500/15 text-red-400': d.status === 'open',
                    'bg-yellow-500/15 text-yellow-400': d.status === 'under_review',
                    'bg-green-500/15 text-green-400': d.status === 'resolved',
                    'bg-white/10 text-white/30': d.status === 'dismissed',
                  })}>
                    {d.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/disputes/${d.id}`} className="text-primary-400 hover:text-primary-300 transition-colors">
                    <Eye className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
