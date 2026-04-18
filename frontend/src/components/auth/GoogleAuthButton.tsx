'use client';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';

// Load Google script once
const loadGoogleScript = (): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return;
    if ((window as any).google?.accounts) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
};

interface Props {
  mode: 'login' | 'register';
  onSuccess?: () => void;
}

export default function GoogleAuthButton({ mode, onSuccess }: Props) {
  const { login: storeLogin } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadGoogleScript().then(() => setReady(true));
  }, []);

  const handleGoogleAuth = () => {
    if (!ready || !(window as any).google?.accounts) {
      toast.error('Google Sign-In not ready, please try again');
      return;
    }

    setLoading(true);

    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      scope: 'openid email profile',
      callback: async (tokenResponse: any) => {
        if (tokenResponse.error) {
          toast.error('Google Sign-In cancelled');
          setLoading(false);
          return;
        }

        try {
          // Exchange access token for ID token via userinfo
          const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          });
          const userInfo = await userInfoRes.json();

          // Send to our backend — backend verifies with Google
          const { data } = await api.post('/auth/google', {
            id_token: tokenResponse.access_token,
            user_info: userInfo, // send user info directly since we verified with Google
          });

          // Save to store
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));

          // Trigger hydrate to get fresh user with role
          await useAuthStore.getState().hydrate();

          toast.success(data.is_new_user ? 'Account created! Welcome to VouchEx 🎉' : 'Welcome back!');

          if (onSuccess) {
            onSuccess();
          } else {
            const role = data.user?.role;
            router.push(role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard');
          }
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Google Sign-In failed');
        } finally {
          setLoading(false);
        }
      },
    });

    client.requestAccessToken();
  };

  return (
    <button
      onClick={handleGoogleAuth}
      disabled={loading || !ready}
      type="button"
      className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin text-white/40" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      {loading ? 'Signing in...' : `Continue with Google`}
    </button>
  );
}
