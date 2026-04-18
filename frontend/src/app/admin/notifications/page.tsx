'use client';
import { useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Megaphone, Send, Users, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

const TYPES = [
  { value: 'system',   label: 'System',   color: 'text-primary-400', desc: 'General announcement' },
  { value: 'voucher_sold', label: 'Sale',  color: 'text-blue-400',   desc: 'Voucher-related news' },
  { value: 'wallet_credit',label: 'Wallet',color: 'text-green-400',  desc: 'Wallet / payment update' },
];

export default function AdminNotificationsPage() {
  const [title,    setTitle]    = useState('');
  const [message,  setMessage]  = useState('');
  const [type,     setType]     = useState('system');
  const [sending,  setSending]  = useState(false);
  const [lastSent, setLastSent] = useState<{ title: string; count: number } | null>(null);

  const handleBroadcast = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Both title and message are required');
      return;
    }
    if (!confirm(`Send this notification to ALL users?`)) return;

    setSending(true);
    try {
      const { data } = await api.post('/admin/notifications/broadcast', { title, message, type });
      toast.success(`Sent to ${data.sent} users`);
      setLastSent({ title, count: data.sent });
      setTitle('');
      setMessage('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-700 text-white">Broadcast Notification</h1>
        <p className="text-white/40 text-sm mt-1">Send a notification to all active users at once.</p>
      </div>

      {/* Last sent confirmation */}
      {lastSent && (
        <div className="glass-card rounded-2xl p-4 flex items-center gap-3 border border-green-500/20 bg-green-500/5">
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <p className="text-sm text-green-400 font-medium">Notification sent!</p>
            <p className="text-xs text-white/40 mt-0.5">
              "{lastSent.title}" delivered to {lastSent.count} users
            </p>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl p-6 space-y-4">

        {/* Type selector */}
        <div>
          <label className="text-xs text-white/50 block mb-2">Notification Type</label>
          <div className="flex gap-2">
            {TYPES.map(t => (
              <button key={t.value} onClick={() => setType(t.value)}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all',
                  type === t.value
                    ? 'border-primary-500/50 bg-primary-500/10 text-white'
                    : 'border-white/8 bg-white/3 text-white/40 hover:text-white/70 hover:border-white/15'
                )}>
                <div className={clsx('font-semibold', type === t.value ? 'text-white' : t.color)}>{t.label}</div>
                <div className="text-white/30 text-[10px] mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs text-white/50 block mb-1.5">Title <span className="text-white/25">(max 80 chars)</span></label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={80}
            placeholder="e.g. New feature available!"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <div className="text-right text-xs text-white/20 mt-1">{title.length}/80</div>
        </div>

        {/* Message */}
        <div>
          <label className="text-xs text-white/50 block mb-1.5">Message <span className="text-white/25">(max 300 chars)</span></label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Write the notification message here..."
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:ring-1 focus:ring-white/20"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <div className="text-right text-xs text-white/20 mt-1">{message.length}/300</div>
        </div>

        {/* Preview */}
        {(title || message) && (
          <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs text-white/30 mb-2 flex items-center gap-1.5">
              <Megaphone className="w-3 h-3" /> Preview (how users will see it)
            </p>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary-400/10 flex items-center justify-center shrink-0">
                <Megaphone className="w-4 h-4 text-primary-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{title || 'Notification title'}</p>
                <p className="text-xs text-white/50 mt-0.5">{message || 'Notification message...'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Send button */}
        <button
          onClick={handleBroadcast}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all flex items-center justify-center gap-2"
          style={{ backgroundColor: '#6366f1' }}
        >
          {sending
            ? <><Users className="w-4 h-4 animate-pulse" /> Sending to all users...</>
            : <><Send className="w-4 h-4" /> Send to All Users</>
          }
        </button>

        <p className="text-xs text-white/20 text-center">
          This will send a notification to every active user on the platform.
        </p>
      </div>
    </div>
  );
}