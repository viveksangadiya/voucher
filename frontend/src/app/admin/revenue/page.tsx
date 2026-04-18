'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { format } from 'date-fns';
import { TrendingUp, DollarSign, BarChart3, Trophy } from 'lucide-react';

export default function AdminRevenuePage() {
  const [overview, setOverview] = useState<any>(null);
  const [chart, setChart] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/revenue/overview'),
      api.get(`/admin/revenue/chart?days=${days}`),
    ]).then(([o, c]) => {
      setOverview(o.data);
      setChart(c.data);
      setLoading(false);
    });
  }, [days]);

  const maxCommission = chart.length ? Math.max(...chart.map(d => parseFloat(d.commission))) : 1;
  const totalPeriodCommission = chart.reduce((s, d) => s + parseFloat(d.commission), 0);
  const totalPeriodVolume = chart.reduce((s, d) => s + parseFloat(d.volume), 0);

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-700 text-white">Revenue Analytics</h1>
        <p className="text-white/30 text-sm mt-1">Platform earnings breakdown</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'All-Time Commission', value: `₹${parseFloat(overview?.totals?.total_commission || 0).toFixed(2)}`, icon: <DollarSign className="w-5 h-5" />, color: 'text-primary-400' },
          { label: 'Gross Volume', value: `₹${parseFloat(overview?.totals?.gross_volume || 0).toFixed(2)}`, icon: <TrendingUp className="w-5 h-5" />, color: 'text-green-400' },
          { label: 'Today Commission', value: `₹${parseFloat(overview?.today?.commission || 0).toFixed(2)}`, icon: <BarChart3 className="w-5 h-5" />, color: 'text-blue-400' },
          { label: 'This Month', value: `₹${parseFloat(overview?.this_month?.commission || 0).toFixed(2)}`, icon: <Trophy className="w-5 h-5" />, color: 'text-yellow-400' },
        ].map(card => (
          <div key={card.label} className="glass-card rounded-2xl p-5">
            <div className={`mb-3 ${card.color}`}>{card.icon}</div>
            <div className="font-display text-2xl font-700 text-white">{card.value}</div>
            <div className="text-white/30 text-xs mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-white">Commission Over Time</h3>
            <p className="text-white/30 text-xs mt-0.5">
              ₹{totalPeriodCommission.toFixed(2)} commission from ₹{totalPeriodVolume.toFixed(2)} volume
            </p>
          </div>
          <div className="flex gap-1.5">
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${days === d ? 'bg-primary-500 text-white' : 'glass-card text-white/40 hover:text-white/70'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-1 h-32">
          {chart.map((d: any, i) => {
            const pct = maxCommission > 0 ? (parseFloat(d.commission) / maxCommission) * 100 : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-dark-800 border border-white/10 text-white/80 text-xs px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  <div className="font-semibold">₹{parseFloat(d.commission).toFixed(2)}</div>
                  <div className="text-white/40">{d.transactions} tx</div>
                </div>
                <div className="w-full bg-primary-500/50 hover:bg-primary-500 rounded-t transition-colors"
                  style={{ height: `${Math.max(pct, 2)}%` }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-white/20">
          {chart.length > 0 && <>
            <span>{format(new Date(chart[0]?.date), 'MMM d')}</span>
            <span>{format(new Date(chart[chart.length - 1]?.date), 'MMM d')}</span>
          </>}
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        {/* Top Sellers */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 text-sm">Top Sellers by Commission</h3>
          <div className="space-y-3">
            {(overview?.top_sellers || []).slice(0, 8).map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/80 truncate">{s.name}</div>
                  <div className="text-xs text-white/30">{s.total_sold} sold</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm text-primary-300 font-semibold">₹{parseFloat(s.commission_generated).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Brands */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 text-sm">Top Brands by Commission</h3>
          <div className="space-y-3">
            {(overview?.top_brands || []).slice(0, 8).map((b: any, i: number) => (
              <div key={b.brand} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-white/80">{b.brand}</div>
                  <div className="text-xs text-white/30">{b.sales} sales</div>
                </div>
                <div className="text-sm text-yellow-400 font-semibold">₹{parseFloat(b.commission).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
