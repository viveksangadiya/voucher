'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Play, RefreshCw, CheckCircle, XCircle, Clock, Activity } from 'lucide-react';
import clsx from 'clsx';

const MANUAL_JOBS = [
  { key: 'expire-vouchers', label: 'Expire Vouchers', desc: 'Mark past-expiry active vouchers as expired', endpoint: '/admin/cron/expire-vouchers' },
  { key: 'snapshot-revenue', label: 'Revenue Snapshot', desc: "Snapshot yesterday's revenue data", endpoint: '/admin/cron/snapshot-revenue' },
  { key: 'escalate-disputes', label: 'Escalate Disputes', desc: 'Upgrade stale 48h+ disputes to urgent', endpoint: '/admin/cron/escalate-disputes' },
];

const SCHEDULE = [
  { job: 'expire_vouchers', schedule: 'Every hour (0 * * * *)', icon: '⏱️' },
  { job: 'snapshot_revenue', schedule: 'Daily at 00:05', icon: '📊' },
  { job: 'cleanup_rejected_vouchers', schedule: 'Daily at 02:00', icon: '🧹' },
  { job: 'escalate_disputes', schedule: 'Every 6 hours', icon: '🚨' },
  { job: 'warn_expiring_vouchers', schedule: 'Daily at 09:00', icon: '⚠️' },
];

export default function AdminCronPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      const { data } = await api.get('/admin/cron/logs');
      setLogs(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  const runJob = async (job: typeof MANUAL_JOBS[0]) => {
    setRunning(job.key);
    try {
      const { data } = await api.post(job.endpoint);
      toast.success(`${job.label} completed: ${JSON.stringify(data)}`);
      fetchLogs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Job failed');
    } finally { setRunning(null); }
  };

  // Last run per job
  const lastRun = (jobName: string) => logs.find(l => l.job_name === jobName);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-700 text-white">Cron Jobs</h1>
          <p className="text-white/30 text-sm mt-1">Automated background tasks</p>
        </div>
        <button onClick={fetchLogs} className="btn-secondary flex items-center gap-2 !px-4 !py-2 !text-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Schedule overview */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="font-semibold text-white text-sm mb-4">Scheduled Jobs</h3>
        <div className="space-y-3">
          {SCHEDULE.map(s => {
            const last = lastRun(s.job);
            return (
              <div key={s.job} className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0">
                <span className="text-xl">{s.icon}</span>
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">{s.job.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-white/30">{s.schedule}</div>
                </div>
                {last ? (
                  <div className="text-right">
                    <div className={clsx('flex items-center gap-1 text-xs', last.status === 'success' ? 'text-green-400' : last.status === 'failed' ? 'text-red-400' : 'text-yellow-400')}>
                      {last.status === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : last.status === 'failed' ? <XCircle className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                      {last.status} · {last.records_affected} records
                    </div>
                    <div className="text-xs text-white/20 mt-0.5">{format(new Date(last.ran_at), 'dd MMM HH:mm')}</div>
                  </div>
                ) : (
                  <span className="text-xs text-white/20">Never run</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual triggers */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="font-semibold text-white text-sm mb-4">Manual Triggers</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {MANUAL_JOBS.map(job => (
            <div key={job.key} className="bg-white/3 border border-white/5 rounded-xl p-4">
              <div className="text-sm font-medium text-white mb-1">{job.label}</div>
              <div className="text-xs text-white/30 mb-4 leading-relaxed">{job.desc}</div>
              <button onClick={() => runJob(job)} disabled={!!running}
                className="btn-primary w-full !py-2 !text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {running === job.key ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Running...</>
                ) : (
                  <><Play className="w-3.5 h-3.5" /> Run Now</>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Logs table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white text-sm">Recent Logs</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['Job', 'Status', 'Records', 'Duration', 'Message', 'Ran At'].map(h => (
                <th key={h} className="text-left text-xs text-white/30 font-medium px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="skeleton h-3 rounded w-20" /></td>)}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-white/30 text-sm">No logs yet</td></tr>
            ) : logs.slice(0, 30).map(log => (
              <tr key={log.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                <td className="px-4 py-3 text-sm text-white">{log.job_name.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">
                  <span className={clsx('badge text-xs', {
                    'bg-green-500/15 text-green-400': log.status === 'success',
                    'bg-red-500/15 text-red-400': log.status === 'failed',
                    'bg-yellow-500/15 text-yellow-400': log.status === 'running',
                  })}>{log.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-white/60">{log.records_affected}</td>
                <td className="px-4 py-3 text-xs text-white/40">{log.duration_ms ? `${log.duration_ms}ms` : '—'}</td>
                <td className="px-4 py-3 text-xs text-white/30 max-w-[200px] truncate">{log.message || '—'}</td>
                <td className="px-4 py-3 text-xs text-white/30">{format(new Date(log.ran_at), 'dd MMM, HH:mm:ss')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
