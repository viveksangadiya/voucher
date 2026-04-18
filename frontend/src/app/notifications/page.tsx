'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { format } from 'date-fns';
import { Bell, CheckCheck, Trash2, ShoppingCart, Tag, Wallet, Shield, Star, AlertTriangle, Megaphone } from 'lucide-react';
import clsx from 'clsx';

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  voucher_sold:           { icon: Tag,           color: 'text-blue-400',    bg: 'bg-blue-400/10',    label: 'Sale' },
  voucher_purchased:      { icon: ShoppingCart,  color: 'text-green-400',   bg: 'bg-green-400/10',   label: 'Purchase' },
  wallet_credit:          { icon: Wallet,        color: 'text-green-400',   bg: 'bg-green-400/10',   label: 'Wallet' },
  wallet_debit:           { icon: Wallet,        color: 'text-red-400',     bg: 'bg-red-400/10',     label: 'Wallet' },
  withdrawal_approved:    { icon: Wallet,        color: 'text-green-400',   bg: 'bg-green-400/10',   label: 'Withdrawal' },
  withdrawal_rejected:    { icon: Wallet,        color: 'text-red-400',     bg: 'bg-red-400/10',     label: 'Withdrawal' },
  kyc_approved:           { icon: Shield,        color: 'text-green-400',   bg: 'bg-green-400/10',   label: 'KYC' },
  kyc_rejected:           { icon: Shield,        color: 'text-red-400',     bg: 'bg-red-400/10',     label: 'KYC' },
  fraud_report_confirmed: { icon: AlertTriangle, color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  label: 'Fraud' },
  fraud_report_dismissed: { icon: AlertTriangle, color: 'text-white/40',    bg: 'bg-white/5',        label: 'Fraud' },
  review_received:        { icon: Star,          color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  label: 'Review' },
  review_reply:           { icon: Star,          color: 'text-primary-400', bg: 'bg-primary-400/10', label: 'Review' },
  system:                 { icon: Megaphone,     color: 'text-primary-400', bg: 'bg-primary-400/10', label: 'System' },
};
const getCfg = (type: string) => TYPE_CONFIG[type] || TYPE_CONFIG.system;

const FILTERS = ['all', 'unread', 'vouchers', 'wallet', 'kyc', 'reviews'];

export default function NotificationsPage() {
  const { user, isHydrated } = useAuthStore();
  const router = useRouter();

  const [notifications, setNotifs] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) { router.push('/login'); return; }
    fetchNotifications();
  }, [isHydrated, user, filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (filter === 'unread') params.unread_only = true;
      const { data } = await api.get('/notifications', { params });
      let notifs = data.notifications;

      // client-side filter by category
      if (filter === 'vouchers') notifs = notifs.filter((n: any) => n.type.includes('voucher'));
      if (filter === 'wallet')   notifs = notifs.filter((n: any) => n.type.includes('wallet') || n.type.includes('withdrawal'));
      if (filter === 'kyc')      notifs = notifs.filter((n: any) => n.type.includes('kyc'));
      if (filter === 'reviews')  notifs = notifs.filter((n: any) => n.type.includes('review'));

      setNotifs(notifs);
      setTotal(data.total);
      setUnread(data.unread);
    } finally { setLoading(false); }
  };

  const markRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`).catch(() => {});
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(u => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all').catch(() => {});
    setNotifs(ns => ns.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const remove = async (id: string) => {
    await api.delete(`/notifications/${id}`).catch(() => {});
    const n = notifications.find(x => x.id === id);
    setNotifs(ns => ns.filter(x => x.id !== id));
    if (n && !n.is_read) setUnread(u => Math.max(0, u - 1));
  };

  const clearAll = async () => {
    if (!confirm('Clear all notifications?')) return;
    await api.delete('/notifications/clear-all').catch(() => {});
    setNotifs([]);
    setUnread(0);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-700 text-white">Notifications</h1>
          <p className="text-white/40 text-sm mt-1">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white px-3 py-2 rounded-xl transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll}
              className="flex items-center gap-1.5 text-sm text-red-400/60 hover:text-red-400 px-3 py-2 rounded-xl transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Trash2 className="w-4 h-4" /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 glass-card rounded-xl p-1 mb-5 overflow-x-auto">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all capitalize',
              filter === f ? 'bg-primary-500 text-white' : 'text-white/50 hover:text-white'
            )}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-4 flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 shrink-0 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-white/5 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-white/5 rounded animate-pulse w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card rounded-2xl py-20 text-center">
          <Bell className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No notifications in this category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const cfg = getCfg(n.type);
            const Icon = cfg.icon;
            return (
              <div key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={clsx(
                  'glass-card rounded-xl p-4 flex gap-3 cursor-pointer group transition-all',
                  !n.is_read && 'ring-1 ring-primary-500/20 bg-primary-500/3'
                )}
              >
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
                  <Icon className={clsx('w-5 h-5', cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={clsx('text-sm font-semibold', n.is_read ? 'text-white/60' : 'text-white')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-white/40 mt-1 leading-relaxed">{n.message}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary-500 mt-1" />}
                      <button onClick={e => { e.stopPropagation(); remove(n.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-white/25 mt-2">{format(new Date(n.created_at), 'dd MMM yyyy, HH:mm')}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
