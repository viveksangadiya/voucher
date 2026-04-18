'use client';
import Link from 'next/link';
import { Calendar, Eye, Star, Zap } from 'lucide-react';
import { format, isAfter, addDays } from 'date-fns';
import clsx from 'clsx';

interface VoucherCardProps {
  voucher: {
    id: string;
    title: string;
    brand: string;
    original_value: number;
    selling_price: number;
    discount_percentage: number;
    expiry_date: string;
    category_name: string;
    category_slug: string;
    image_url?: string;
    seller_name: string;
    seller_rating: number;
    views: number;
    status: string;
  };
}

const categoryColors: Record<string, string> = {
  'food-dining': 'bg-orange-500/20 text-orange-300',
  shopping: 'bg-blue-500/20 text-blue-300',
  travel: 'bg-sky-500/20 text-sky-300',
  entertainment: 'bg-purple-500/20 text-purple-300',
  'health-beauty': 'bg-pink-500/20 text-pink-300',
  electronics: 'bg-cyan-500/20 text-cyan-300',
  'sports-fitness': 'bg-green-500/20 text-green-300',
  education: 'bg-yellow-500/20 text-yellow-300',
};

const categoryGradients: Record<string, string> = {
  'food-dining': 'from-orange-900/30 to-red-900/20',
  shopping: 'from-blue-900/30 to-indigo-900/20',
  travel: 'from-sky-900/30 to-blue-900/20',
  entertainment: 'from-purple-900/30 to-pink-900/20',
  'health-beauty': 'from-pink-900/30 to-rose-900/20',
  electronics: 'from-cyan-900/30 to-blue-900/20',
  'sports-fitness': 'from-green-900/30 to-emerald-900/20',
  education: 'from-yellow-900/30 to-amber-900/20',
};

export default function VoucherCard({ voucher }: VoucherCardProps) {
  const isExpiringSoon = voucher.expiry_date && isAfter(new Date(voucher.expiry_date), new Date()) && !isAfter(new Date(voucher.expiry_date), addDays(new Date(), 7));
  const colorClass = categoryColors[voucher.category_slug] || 'bg-white/10 text-white/60';
  const gradient = categoryGradients[voucher.category_slug] || 'from-white/5 to-white/2';

  return (
    <Link href={`/vouchers/${voucher.id}`}>
      <div className={clsx('glass-card glass-card-hover rounded-2xl overflow-hidden cursor-pointer h-full flex flex-col bg-gradient-to-br', gradient)}>
        {/* Discount Badge */}
        <div className="relative px-5 pt-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className={clsx('badge mb-2', colorClass)}>
                {voucher.category_name}
              </div>
              <h3 className="font-semibold text-white/90 text-sm leading-snug line-clamp-2">{voucher.title}</h3>
              <p className="text-white/40 text-xs mt-1 font-medium">{voucher.brand}</p>
            </div>
            <div className="bg-primary-500 rounded-xl px-2.5 py-1.5 text-center shrink-0">
              <span className="font-display font-700 text-white text-lg leading-none">{voucher.discount_percentage}%</span>
              <p className="text-primary-100 text-xs">OFF</p>
            </div>
          </div>
        </div>

        <div className="border-t border-dashed border-white/10 mx-5" />

        <div className="px-5 py-4 flex-1 flex flex-col gap-3">
          {/* Price */}
          <div className="flex items-end gap-2">
            <span className="font-display text-2xl font-700 text-white">₹{parseFloat(voucher.selling_price.toString()).toFixed(0)}</span>
            <span className="text-white/30 text-sm line-through mb-0.5">₹{parseFloat(voucher.original_value.toString()).toFixed(0)}</span>
            <span className="ml-auto text-green-400 text-xs font-medium">
              Save ₹{(parseFloat(voucher.original_value.toString()) - parseFloat(voucher.selling_price.toString())).toFixed(0)}
            </span>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-white/40 mt-auto">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{voucher.views}</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" />{parseFloat(voucher.seller_rating?.toString() || '5').toFixed(1)}</span>
            {voucher.expiry_date && (
              <span className={clsx('flex items-center gap-1 ml-auto', isExpiringSoon ? 'text-red-400' : 'text-white/30')}>
                {isExpiringSoon && <Zap className="w-3 h-3" />}
                <Calendar className="w-3 h-3" />
                {format(new Date(voucher.expiry_date), 'dd MMM yy')}
              </span>
            )}
          </div>

          {/* Seller */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
            <div className="w-5 h-5 rounded-full bg-primary-500/30 flex items-center justify-center text-primary-300 text-xs font-bold">
              {voucher.seller_name?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-white/30">{voucher.seller_name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
