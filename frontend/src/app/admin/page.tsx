'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { TrendingUp, Tag, AlertTriangle, Users, ArrowRight, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

export default function AdminOverviewPage() {
  const [counts, setCounts] = useState<any>({});
  const [revenue, setRevenue] = useState<any>(null);
  const [chart, setChart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats/counts'),
      api.get('/admin/revenue/overview'),
      api.get('/admin/revenue/chart?days=14'),
    ]).then(([c, r, ch]) => {
      setCounts(c.data);
      setRevenue(r.data);
      setChart(ch.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const maxCommission = chart.length ? Math.max(...chart.map((d: any) => parseFloat(d.commission))) : 1;

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-700 text-white">Overview</h1>
        <p className="text-white/30 text-sm mt-1">Platform health at a glance</p>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Pending Reviews', value: counts.pending_vouchers || 0, icon: <Tag className="w-5 h-5" />, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', href: '/admin/vouchers' },
          { label: 'Open Disputes', value: counts.open_disputes || 0, icon: <AlertTriangle className="w-5 h-5" />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', href: '/admin/disputes' },
          { label: 'Total Users', value: counts.total_users || 0, icon: <Users className="w-5 h-5" />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', href: '/admin/users' },
          { label: 'Suspended', value: counts.suspended_users || 0, icon: <XCircle className="w-5 h-5" />, color: 'text-white/40', bg: 'bg-white/5 border-white/10', href: '/admin/users?is_suspended=true' },
        ].map(card => (
          <Link key={card.label} href={card.href}
            className={clsx('glass-card rounded-2xl p-5 border hover:scale-[1.02] transition-transform cursor-pointer', card.bg)}>
            <div className={clsx('mb-3', card.color)}>{card.icon}</div>
            <div className="font-display text-3xl font-700 text-white">{card.value.toLocaleString()}</div>
            <div className="text-white/40 text-xs mt-1">{card.label}</div>
          </Link>
        ))}
      </div>

      {/* Revenue summary */}
      {revenue && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {[
            { label: 'Today\'s Commission', value: `₹${parseFloat(revenue.today?.commission || 0).toFixed(2)}`, sub: `${revenue.today?.tx_count || 0} transactions` },
            { label: 'This Month', value: `₹${parseFloat(revenue.this_month?.commission || 0).toFixed(2)}`, sub: `₹${parseFloat(revenue.this_month?.volume || 0).toFixed(2)} GMV` },
            { label: 'All Time', value: `₹${parseFloat(revenue.totals?.total_commission || 0).toFixed(2)}`, sub: `${revenue.totals?.total_transactions || 0} total transactions` },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-2xl p-5">
              <div className="text-white/40 text-xs mb-1">{s.label}</div>
              <div className="font-display text-2xl font-700 text-primary-300">{s.value}</div>
              <div className="text-white/30 text-xs mt-1">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Mini chart - 14 day commission */}
      {chart.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 text-sm">Commission — Last 14 Days</h3>
          <div className="flex items-end gap-1.5 h-24">
            {chart.map((d: any) => {
              const pct = maxCommission > 0 ? (parseFloat(d.commission) / maxCommission) * 100 : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-dark-800 text-white/80 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    ₹{parseFloat(d.commission).toFixed(0)} ({d.transactions}tx)
                  </div>
                  <div className="w-full bg-primary-500/30 rounded-t-sm hover:bg-primary-500/60 transition-colors"
                    style={{ height: `${Math.max(pct, 3)}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-white/20">
            <span>{format(new Date(chart[0]?.date), 'MMM d')}</span>
            <span>{format(new Date(chart[chart.length - 1]?.date), 'MMM d')}</span>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {revenue?.recent_transactions?.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Recent Transactions</h3>
            <Link href="/admin/revenue" className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {revenue.recent_transactions.slice(0, 6).map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/80 truncate">{t.voucher_title}</div>
                  <div className="text-xs text-white/30">{t.buyer_name} → {t.seller_name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm text-primary-300 font-semibold">+₹{parseFloat(t.commission).toFixed(2)}</div>
                  <div className="text-xs text-white/30">{format(new Date(t.created_at), 'dd MMM HH:mm')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
