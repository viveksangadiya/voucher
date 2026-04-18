'use client';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, X, ShoppingCart, Tag, Wallet, Shield, Star, AlertTriangle, Megaphone } from 'lucide-react';
import api from '@/lib/api';
import { format } from 'date-fns';
import clsx from 'clsx';
import Link from 'next/link';

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  voucher_sold:           { icon: Tag,           color: 'text-blue-400',    bg: 'bg-blue-400/10' },
  voucher_purchased:      { icon: ShoppingCart,  color: 'text-green-400',   bg: 'bg-green-400/10' },
  wallet_credit:          { icon: Wallet,        color: 'text-green-400',   bg: 'bg-green-400/10' },
  wallet_debit:           { icon: Wallet,        color: 'text-red-400',     bg: 'bg-red-400/10' },
  withdrawal_approved:    { icon: Wallet,        color: 'text-green-400',   bg: 'bg-green-400/10' },
  withdrawal_rejected:    { icon: Wallet,        color: 'text-red-400',     bg: 'bg-red-400/10' },
  kyc_approved:           { icon: Shield,        color: 'text-green-400',   bg: 'bg-green-400/10' },
  kyc_rejected:           { icon: Shield,        color: 'text-red-400',     bg: 'bg-red-400/10' },
  fraud_report_confirmed: { icon: AlertTriangle, color: 'text-yellow-400',  bg: 'bg-yellow-400/10' },
  fraud_report_dismissed: { icon: AlertTriangle, color: 'text-white/40',    bg: 'bg-white/5' },
  review_received:        { icon: Star,          color: 'text-yellow-400',  bg: 'bg-yellow-400/10' },
  review_reply:           { icon: Star,          color: 'text-primary-400', bg: 'bg-primary-400/10' },
  system:                 { icon: Megaphone,     color: 'text-primary-400', bg: 'bg-primary-400/10' },
};

const getCfg = (type: string) => TYPE_CONFIG[type] || TYPE_CONFIG.system;

export default function NotificationBell() {
  const [open, setOpen]               = useState(false);
  const [notifications, setNotifs]    = useState<any[]>([]);
  const [unread, setUnread]           = useState(0);
  const [loading, setLoading]         = useState(false);
  const [mounted, setMounted]         = useState(false);
  const [pos, setPos]                 = useState({ top: 0, right: 16 });
  const bellRef                        = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    fetchUnreadCount();
    const iv = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(iv);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnread(data.count);
    } catch {}
  };

  const openPanel = async () => {
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen(true);
    setLoading(true);
    try {
      const { data } = await api.get('/notifications?limit=15');
      setNotifs(data.notifications);
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

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.delete(`/notifications/${id}`).catch(() => {});
    const n = notifications.find(x => x.id === id);
    setNotifs(ns => ns.filter(x => x.id !== id));
    if (n && !n.is_read) setUnread(u => Math.max(0, u - 1));
  };

  return (
    <>
      <button
        ref={bellRef}
        onClick={open ? () => setOpen(false) : openPanel}
        className="relative p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && mounted && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] w-80 rounded-2xl shadow-2xl overflow-hidden"
            style={{ top: pos.top, right: pos.right, backgroundColor: '#16162a', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-sm">Notifications</span>
                {unread > 0 && (
                  <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full">{unread}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button onClick={markAllRead} title="Mark all as read"
                    className="text-white/30 hover:text-white/70 transition-colors">
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <Link href="/notifications" onClick={() => setOpen(false)}
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium">
                  See all
                </Link>
              </div>
            </div>

            {/* Body */}
            <div className="max-h-[380px] overflow-y-auto">
              {loading ? (
                <div className="space-y-0">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex gap-3 px-4 py-3 border-b border-white/5">
                      <div className="w-8 h-8 rounded-xl bg-white/5 shrink-0 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
                        <div className="h-2.5 bg-white/5 rounded animate-pulse w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">You're all caught up!</p>
                </div>
              ) : notifications.map(n => {
                const cfg = getCfg(n.type);
                const Icon = cfg.icon;
                return (
                  <div key={n.id}
                    onClick={() => !n.is_read && markRead(n.id)}
                    className={clsx(
                      'flex gap-3 px-4 py-3 border-b border-white/5 cursor-pointer group transition-colors',
                      !n.is_read ? 'bg-primary-500/5 hover:bg-primary-500/8' : 'hover:bg-white/3'
                    )}
                  >
                    <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                      <Icon className={clsx('w-4 h-4', cfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-sm font-medium leading-snug', n.is_read ? 'text-white/60' : 'text-white')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                      <p className="text-xs text-white/20 mt-1">{format(new Date(n.created_at), 'dd MMM, HH:mm')}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                      {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                      <button onClick={e => remove(n.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 mt-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
