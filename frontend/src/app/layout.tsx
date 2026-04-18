'use client';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore(s => s.hydrate);

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <html lang="en">
      <head>
        <title>VouchEx - Buy & Sell Vouchers</title>
        <meta name="description" content="The marketplace for unused vouchers." />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <Navbar />
        <main className="min-h-screen pt-16">{children}</main>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.1)' },
          }}
        />
      </body>
    </html>
  );
}