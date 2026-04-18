'use client';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag, PlusCircle, LayoutDashboard, LogOut,
  Wallet, Tag, User, ChevronDown, Shield,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import NotificationBell from '@/components/notifications/NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    router.push('/');
  };

  const avatarColor = (user as any)?.avatar || '#6366f1';
  const initials = user?.name?.[0]?.toUpperCase() || '?';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <Tag className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-xl font-700 gradient-text">VouchEx</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-white/60">
          <Link href="/vouchers" className="hover:text-white transition-colors flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4" /> Browse
          </Link>
          {user && (
            <>
              <Link href="/sell" className="hover:text-white transition-colors flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4" /> Sell
              </Link>
              <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1.5">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
            </>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {/* Wallet */}
              <div className="hidden sm:flex items-center gap-2 glass-card rounded-xl px-3 py-1.5">
                <Wallet className="w-3.5 h-3.5 text-primary-400" />
                <span className="text-sm font-semibold text-primary-300">
                  ₹{parseFloat(user.balance?.toString() || '0').toFixed(2)}
                </span>
              </div>

              {/* 🔔 Notification Bell */}
              <NotificationBell />

              {/* Avatar dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {(user as any).avatar_url
                      ? <img src={(user as any).avatar_url} alt={user.name} className="w-full h-full object-cover" />
                      : initials}
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-52 rounded-2xl shadow-2xl py-1 overflow-hidden"
                    style={{ backgroundColor: '#16162a', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-white/5">
                      <div className="text-sm font-semibold text-white truncate">{user.name}</div>
                      <div className="text-xs text-white/30 truncate mt-0.5">{user.email}</div>
                    </div>

                    <div className="py-1">
                      <Link href="/profile" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                        <User className="w-4 h-4" /> My Profile
                      </Link>
                      <Link href="/dashboard" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </Link>
                      <Link href="/kyc" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                        <Shield className="w-4 h-4" /> KYC Verification
                        {(user as any).kyc_status !== 'approved' && (
                          <span className="ml-auto text-xs bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded-full">
                            {(user as any).kyc_status === 'pending' ? 'Pending' : 'Required'}
                          </span>
                        )}
                      </Link>
                      <Link href="/sell" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                        <PlusCircle className="w-4 h-4" /> List a Voucher
                      </Link>
                    </div>

                    {/* Balance row */}
                    <div className="mx-3 mb-2 px-3 py-2 rounded-xl flex items-center justify-between"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <span className="text-xs text-white/40 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" /> Balance
                      </span>
                      <span className="text-sm font-semibold text-primary-300">
                        ₹{parseFloat(user.balance?.toString() || '0').toFixed(2)}
                      </span>
                    </div>

                    <div className="border-t border-white/5 pt-1 pb-1">
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-white/5 transition-colors">
                        <LogOut className="w-4 h-4" /> Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2">Login</Link>
              <Link href="/register" className="btn-primary !px-4 !py-2 !text-sm">Get Started</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
