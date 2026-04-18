'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import {
  User, Mail, Lock, Star, ShoppingBag, Tag, Shield,
  Eye, EyeOff, CheckCircle, Edit3, X, Save, LogOut,
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import SellerReviews from '@/components/reviews/SellerReviews';

const AVATAR_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444',
  '#f97316','#eab308','#22c55e','#14b8a6',
  '#3b82f6','#06b6d4','#a855f7','#f43f5e',
];

function ChangePasswordModal({ authProvider, onClose }: { authProvider: string; onClose: () => void }) {
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [show, setShow] = useState({ current: false, newPass: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const isGoogleOnly = authProvider === 'google';

  const handleSubmit = async () => {
    if (form.newPass.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (form.newPass !== form.confirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      await api.put('/auth/change-password', {
        current_password: form.current || undefined,
        new_password: form.newPass,
      });
      toast.success('Password updated successfully');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    } finally { setSaving(false); }
  };

  const fields = [
    ...(!isGoogleOnly ? [{ key: 'current', label: 'Current Password', placeholder: 'Enter current password' }] : []),
    { key: 'newPass', label: 'New Password', placeholder: 'Min 6 characters' },
    { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ backgroundColor: '#16162a', border: '1px solid rgba(255,255,255,0.12)' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between p-6 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">Change Password</h3>
              <p className="text-white/40 text-xs mt-0.5">{isGoogleOnly ? 'Set a password to also enable email login' : 'Update your account password'}</p>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 pb-6 space-y-4">
            {fields.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-white/50 block mb-1.5">{label}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type={show[key as keyof typeof show] ? 'text' : 'password'}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <button type="button" onClick={() => setShow(s => ({ ...s, [key]: !s[key as keyof typeof s] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    {show[key as keyof typeof show] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
            {form.newPass.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={clsx('h-1 flex-1 rounded-full transition-all',
                      form.newPass.length >= i * 3
                        ? i <= 1 ? 'bg-red-400' : i <= 2 ? 'bg-yellow-400' : i <= 3 ? 'bg-blue-400' : 'bg-green-400'
                        : 'bg-white/10')} />
                  ))}
                </div>
                <p className="text-xs text-white/30">{form.newPass.length < 6 ? 'Too short' : form.newPass.length < 9 ? 'Weak' : form.newPass.length < 12 ? 'Good' : 'Strong'}</p>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving || !form.newPass || !form.confirm} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all" style={{ backgroundColor: '#6366f1' }}>
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ProfilePage() {
  const { user, refreshUser, logout, isHydrated } = useAuthStore();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'reviews'>('info');
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(AVATAR_COLORS[0]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) { router.push('/login'); return; }
    fetchProfile();
  }, [isHydrated, user]);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setProfile(data);
      setEditName(data.name);
      setEditColor(data.avatar || AVATAR_COLORS[0]);
    } catch { toast.error('Failed to load profile'); }
  };

  const handleSave = async () => {
    if (!editName.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    try {
      await api.put('/auth/profile', { name: editName.trim(), avatar: editColor });
      await refreshUser();
      await fetchProfile();
      setEditing(false);
      toast.success('Profile updated!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally { setSaving(false); }
  };

  const handleCancel = () => {
    setEditName(profile?.name || '');
    setEditColor(profile?.avatar || AVATAR_COLORS[0]);
    setEditing(false);
  };

  if (!isHydrated || !profile) return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      {[48, 32, 64].map(h => <div key={h} className={`skeleton h-${h} rounded-2xl`} />)}
    </div>
  );

  const initials = profile.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  const memberSince = profile.created_at ? format(new Date(profile.created_at), 'MMMM yyyy') : '';
  const currentColor = editing ? editColor : (profile.avatar || AVATAR_COLORS[0]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

      {/* ── HEADER CARD ── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="h-24 w-full" style={{ background: `linear-gradient(135deg, ${currentColor}55, ${currentColor}15)` }} />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-10 mb-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-xl ring-4 ring-[#0d0d1a]" style={{ backgroundColor: currentColor }}>
              {profile.avatar_url && !editing
                ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full rounded-2xl object-cover" />
                : initials}
            </div>
            {/* Buttons */}
            <div className="flex items-center gap-2 mb-1">
              {editing ? (
                <>
                  <button onClick={handleCancel} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white/50 hover:text-white transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#6366f1' }}>
                    <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => { logout(); router.push('/'); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-red-400/60 hover:text-red-400 transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Name input or display */}
          {editing ? (
            <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={60}
              className="w-full rounded-xl px-3 py-2.5 text-white font-bold text-xl mb-3 focus:outline-none focus:ring-1 focus:ring-white/20"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
              placeholder="Your name" />
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display text-2xl font-700 text-white">{profile.name}</h1>
              {profile.is_verified && <Shield className="w-5 h-5 text-primary-400 shrink-0" title="Verified" />}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/40 mb-1">
            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {profile.email}</span>
            {(profile.auth_provider === 'google' || profile.auth_provider === 'both') && (
              <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">Google</span>
            )}
          </div>
          <p className="text-xs text-white/25">Member since {memberSince}</p>

          {/* Colour picker */}
          {editing && (
            <div className="mt-5 pt-5 border-t border-white/5">
              <label className="text-xs text-white/50 block mb-3">Choose avatar colour</label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map(color => (
                  <button key={color} onClick={() => setEditColor(color)}
                    className={clsx('w-8 h-8 rounded-xl transition-all', editColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#16162a] scale-110' : 'hover:scale-105')}
                    style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/5">
            {[
              { label: 'Sold', value: profile.total_sold ?? 0, icon: <Tag className="w-4 h-4" />, color: 'text-blue-400' },
              { label: 'Bought', value: profile.total_bought ?? 0, icon: <ShoppingBag className="w-4 h-4" />, color: 'text-green-400' },
              { label: 'Rating', value: parseFloat(profile.rating || '5').toFixed(1), icon: <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />, color: 'text-yellow-400' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className={clsx('flex justify-center mb-1.5', s.color)}>{s.icon}</div>
                <div className="font-display text-xl font-700 text-white">{s.value}</div>
                <div className="text-white/30 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECURITY CARD ── */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary-400" /> Security
        </h2>
        <div className="divide-y divide-white/5">
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm text-white/80">Password</div>
              <div className="text-xs text-white/30 mt-0.5">{profile.auth_provider === 'google' ? 'No password — using Google Sign-In' : '••••••••••'}</div>
            </div>
            <button onClick={() => setShowPasswordModal(true)} className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors">
              {profile.auth_provider === 'google' ? 'Set Password' : 'Change'}
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm text-white/80">Email</div>
              <div className="text-xs text-white/30 mt-0.5">{profile.email}</div>
            </div>
            <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="w-3.5 h-3.5" /> Verified</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm text-white/80">Login method</div>
              <div className="text-xs text-white/30 mt-0.5">
                {profile.auth_provider === 'google' ? 'Google only' : profile.auth_provider === 'both' ? 'Email + Google' : 'Email & Password'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div>
        <div className="flex gap-1 glass-card rounded-xl p-1 w-fit mb-4">
          {[{ id: 'info', label: 'Account Info' }, { id: 'reviews', label: 'Reviews Received' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all', activeTab === t.id ? 'bg-primary-500 text-white' : 'text-white/50 hover:text-white')}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
          <div className="glass-card rounded-2xl p-5 animate-fade-in">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><User className="w-4 h-4 text-primary-400" /> Account Details</h2>
            <div className="divide-y divide-white/5">
              {[
                { label: 'Full Name', value: profile.name },
                { label: 'Email', value: profile.email },
                { label: 'Account Type', value: profile.auth_provider === 'google' ? 'Google Account' : profile.auth_provider === 'both' ? 'Email + Google' : 'Email & Password' },
                { label: 'Member Since', value: memberSince },
                { label: 'Vouchers Sold', value: profile.total_sold ?? 0 },
                { label: 'Vouchers Purchased', value: profile.total_bought ?? 0 },
                { label: 'Seller Rating', value: `${parseFloat(profile.rating || '5').toFixed(1)} / 5.0` },
                { label: 'Verified Seller', value: profile.is_verified ? 'Yes ✓' : 'Not yet' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <span className="text-white/40 text-sm">{label}</span>
                  <span className={clsx('text-sm font-medium', label === 'Verified Seller' && profile.is_verified ? 'text-green-400' : 'text-white/80')}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="animate-fade-in">
            <SellerReviews sellerId={profile.id} sellerName={profile.name} />
          </div>
        )}
      </div>

      {showPasswordModal && <ChangePasswordModal authProvider={profile.auth_provider} onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}
