'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import {
  LayoutDashboard, Tag, AlertTriangle, TrendingUp,
  Users, Clock, ChevronRight, Shield, Bell, LogOut, FileCheck, Megaphone,
} from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/admin',              label: 'Overview',       icon: LayoutDashboard, exact: true },
  { href: '/admin/vouchers',     label: 'Voucher Review', icon: Tag,             badge: 'pending_vouchers' },
  { href: '/admin/disputes',     label: 'Disputes',       icon: AlertTriangle,   badge: 'open_disputes' },
  { href: '/admin/kyc',          label: 'KYC Requests',   icon: FileCheck,       badge: 'pending_kyc' },
  { href: '/admin/fraud-reports',label: 'Fraud Reports',  icon: Shield,          badge: 'open_fraud_reports' },
  { href: '/admin/revenue',      label: 'Revenue',        icon: TrendingUp },
  { href: '/admin/users',        label: 'Users',          icon: Users },
  { href: '/admin/notifications',label: 'Broadcast',      icon: Megaphone },
  { href: '/admin/cron',         label: 'Cron Jobs',      icon: Clock },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (!['admin', 'super_admin'].includes((user as any).role || '')) {
      router.push('/dashboard');
      return;
    }
    fetchCounts();
  }, [user]);

  const fetchCounts = async () => {
    try {
      const [statsRes, kycRes] = await Promise.all([
        api.get('/admin/stats/counts'),
        api.get('/admin/kyc?status=pending'),
      ]);
      setCounts({ ...statsRes.data, pending_kyc: kycRes.data.total || 0 });
    } catch {}
  };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  if (!user || !['admin', 'super_admin'].includes((user as any).role || '')) return null;

  return (
    <div className="flex min-h-screen bg-[#050508]">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-white/5 flex flex-col fixed top-0 bottom-0 left-0 z-40" style={{ background: '#08090f' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-display text-sm font-700 text-white">VouchEx</div>
              <div className="text-xs text-white/30">Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            const badgeCount = item.badge ? counts[item.badge] : 0;
            return (
              <Link key={item.href} href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                  active
                    ? 'bg-primary-500/15 text-primary-300 border border-primary-500/20'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                )}>
                <Icon className={clsx('w-4 h-4', active ? 'text-primary-400' : 'text-white/30 group-hover:text-white/60')} />
                <span className="flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-tight">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
                {active && <ChevronRight className="w-3.5 h-3.5 text-primary-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Admin user */}
        <div className="px-4 py-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-300 text-sm font-bold shrink-0">
              {user.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/80 font-medium truncate">{user.name}</div>
              <div className="text-xs text-primary-400 capitalize">{(user as any).role?.replace('_', ' ')}</div>
            </div>
            <button onClick={() => { logout(); router.push('/'); }} className="text-white/20 hover:text-white/60 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-60">
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-30" style={{ background: '#08090f' }}>
          <div className="text-sm text-white/30 font-medium">
            {NAV.find(n => isActive(n.href, n.exact))?.label || 'Admin'}
          </div>
          <div className="flex items-center gap-3">
            <button className="relative text-white/30 hover:text-white/70 transition-colors">
              <Bell className="w-4 h-4" />
              {(counts.open_disputes || 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            <Link href="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">← Main site</Link>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}