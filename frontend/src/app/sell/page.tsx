'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { Tag, Info } from 'lucide-react';
import Link from 'next/link';

export default function SellPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', brand: '', category_id: '',
    original_value: '', selling_price: '', code: '', expiry_date: '', image_url: ''
  });

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    api.get('/categories').then(r => setCategories(r.data));
  }, [user]);

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const discount = form.original_value && form.selling_price
    ? Math.round((1 - parseFloat(form.selling_price) / parseFloat(form.original_value)) * 100)
    : 0;
  const commission = form.selling_price ? parseFloat(form.selling_price) * 0.2 : 0;
  const earning = form.selling_price ? parseFloat(form.selling_price) * 0.8 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parseFloat(form.selling_price) > parseFloat(form.original_value)) {
      toast.error('Selling price cannot exceed original value');
      return;
    }
    if (discount < 5) { toast.error('Minimum 5% discount required to list'); return; }

    setLoading(true);
    try {
      await api.post('/vouchers', form);
      toast.success('Voucher listed successfully! 🎉');
      router.push('/dashboard?tab=listings');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to list voucher');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-700 text-white">List a Voucher</h1>
        <p className="text-white/40 mt-2">Fill in the details to start selling your unused voucher</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-white text-sm uppercase tracking-wide text-white/50">Basic Info</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-white/40 mb-1.5 block">Voucher Title *</label>
              <input type="text" required value={form.title} onChange={e => update('title', e.target.value)}
                className="input-base" placeholder="e.g. Swiggy ₹500 Gift Card" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Brand *</label>
              <input type="text" required value={form.brand} onChange={e => update('brand', e.target.value)}
                className="input-base" placeholder="e.g. Swiggy, Flipkart" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Category *</label>
              <select required value={form.category_id} onChange={e => update('category_id', e.target.value)} className="input-base">
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-white/40 mb-1.5 block">Description</label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)}
                rows={3} className="input-base resize-none" placeholder="Any terms or conditions..." />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-white text-sm uppercase tracking-wide text-white/50">Pricing</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Original Value (₹) *</label>
              <input type="number" required min="1" step="0.01" value={form.original_value}
                onChange={e => update('original_value', e.target.value)}
                className="input-base" placeholder="500" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Your Selling Price (₹) *</label>
              <input type="number" required min="1" step="0.01" value={form.selling_price}
                onChange={e => update('selling_price', e.target.value)}
                className="input-base" placeholder="400" />
            </div>
          </div>

          {form.selling_price && form.original_value && (
            <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Buyer discount</span>
                <span className="text-green-400 font-semibold">{discount}% off</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Platform fee (20%)</span>
                <span className="text-white/70">₹{commission.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/10">
                <span className="text-white">You receive</span>
                <span className="text-primary-300">₹{earning.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-white text-sm uppercase tracking-wide text-white/50">Voucher Details</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-white/40 mb-1.5 block">Voucher Code *</label>
              <input type="text" required value={form.code} onChange={e => update('code', e.target.value)}
                className="input-base font-mono" placeholder="SWIGGY-XXXX-YYYY" />
              <p className="text-xs text-white/30 mt-1.5 flex items-center gap-1">
                <Info className="w-3 h-3" /> Code is hidden from buyers until purchase
              </p>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Expiry Date</label>
              <input type="date" value={form.expiry_date} onChange={e => update('expiry_date', e.target.value)}
                className="input-base" min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Image URL (optional)</label>
              <input type="url" value={form.image_url} onChange={e => update('image_url', e.target.value)}
                className="input-base" placeholder="https://..." />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
          <Tag className="w-4 h-4" />
          {loading ? 'Listing...' : 'List Voucher for Sale'}
        </button>
      </form>
    </div>
  );
}
