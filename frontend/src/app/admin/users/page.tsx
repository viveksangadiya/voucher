'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Search, ShieldOff, ShieldCheck, Star } from 'lucide-react';
import clsx from 'clsx';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, suspended, admin
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [suspendModal, setSuspendModal] = useState<{ id: string; name: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const fetch = async () => {
    setLoading(true);
    const params: any = { search, page, limit: 20 };
    if (filter === 'suspended') params.is_suspended = 'true';
    if (filter === 'admin') params.role = 'admin';
    try {
      const { data } = await api.get('/admin/users', { params });
      setUsers(data.users);
      setTotal(data.total);
      setPages(data.pages);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [search, filter, page]);

  const handleSuspend = async () => {
    if (!suspendModal) return;
    try {
      await api.post(`/admin/users/${suspendModal.id}/suspend`, { reason: suspendReason });
      toast.success(`${suspendModal.name} suspended`);
      setSuspendModal(null);
      setSuspendReason('');
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleUnsuspend = async (id: string, name: string) => {
    try {
      await api.post(`/admin/users/${id}/unsuspend`);
      toast.success(`${name} unsuspended`);
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-700 text-white">Users</h1>
          <p className="text-white/30 text-sm mt-1">{total} accounts</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input-base pl-10 h-10 w-72 text-sm" placeholder="Search name or email..." />
        </div>
        <div className="flex gap-1 glass-card rounded-xl p-1">
          {[['all', 'All'], ['suspended', 'Suspended'], ['admin', 'Admins']].map(([v, l]) => (
            <button key={v} onClick={() => { setFilter(v); setPage(1); }}
              className={clsx('px-4 py-1.5 rounded-lg text-sm transition-all', filter === v ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['User', 'Role', 'Balance', 'Sold / Bought', 'Rating', 'Disputes', 'Joined', 'Actions'].map(h => (
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
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-white/30 text-sm">No users found</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className={clsx('border-b border-white/5 hover:bg-white/2 transition-colors', u.is_suspended && 'opacity-60')}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-300 text-xs font-bold shrink-0">
                      {u.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm text-white flex items-center gap-1">
                        {u.name}
                        {u.is_suspended && <span className="badge bg-red-500/20 text-red-400 text-xs ml-1">Suspended</span>}
                      </div>
                      <div className="text-xs text-white/30">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('badge text-xs capitalize', {
                    'bg-primary-500/20 text-primary-400': u.role === 'super_admin',
                    'bg-blue-500/20 text-blue-400': u.role === 'admin',
                    'bg-white/5 text-white/30': u.role === 'user',
                  })}>
                    {u.role?.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-white">₹{parseFloat(u.balance || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-white/60">{u.total_sold} / {u.total_bought}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-yellow-400 text-sm">
                    <Star className="w-3 h-3" />{parseFloat(u.rating || 5).toFixed(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-white/60">{u.disputes_raised}</td>
                <td className="px-4 py-3 text-xs text-white/30">{format(new Date(u.created_at), 'dd MMM yy')}</td>
                <td className="px-4 py-3">
                  {u.role !== 'super_admin' && (
                    u.is_suspended ? (
                      <button onClick={() => handleUnsuspend(u.id, u.name)} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Unsuspend
                      </button>
                    ) : (
                      <button onClick={() => setSuspendModal({ id: u.id, name: u.name })} className="text-xs text-red-400/60 hover:text-red-400 flex items-center gap-1">
                        <ShieldOff className="w-3.5 h-3.5" /> Suspend
                      </button>
                    )
                  )}
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

      {/* Suspend modal */}
      {suspendModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSuspendModal(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-700 text-white mb-1">Suspend {suspendModal.name}?</h3>
            <p className="text-white/40 text-sm mb-4">This will prevent them from logging in and all their listings will be hidden.</p>
            <label className="text-xs text-white/40 mb-1.5 block">Reason</label>
            <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} rows={3}
              className="input-base resize-none text-sm mb-4" placeholder="Reason for suspension..." />
            <div className="flex gap-3">
              <button onClick={() => setSuspendModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSuspend} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl transition-all">
                Suspend User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
