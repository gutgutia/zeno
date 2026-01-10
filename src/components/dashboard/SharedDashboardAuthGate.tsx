'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// Cookie name for external viewer sessions
const EXTERNAL_SESSION_COOKIE = 'zeno_external_session';

// Helper to set a cookie
function setExternalSessionCookie(token: string, dashboardId: string, expiresAt: string) {
  const expires = new Date(expiresAt);
  const value = JSON.stringify({ token, dashboardId });
  document.cookie = `${EXTERNAL_SESSION_COOKIE}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict; Secure`;
}

interface SharedDashboardAuthGateProps {
  dashboardTitle: string;
  slug: string;
  dashboardId: string;
}

export function SharedDashboardAuthGate({ dashboardTitle, slug, dashboardId }: SharedDashboardAuthGateProps) {
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to send code');
        return;
      }

      toast.success('Check your email for the verification code');
      setStep('verify');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.length < 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);

    try {
      // Use the new verify-share-access endpoint that handles viewer types
      const response = await fetch('/api/auth/verify-share-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, dashboardSlug: slug }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Invalid code');
        return;
      }

      if (data.viewerType === 'internal') {
        // Internal user: Complete Supabase authentication
        const { error } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink',
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        toast.success(data.isNewUser ? 'Welcome! Your account has been created.' : 'Successfully signed in!');
      } else {
        // External viewer: Store session token in cookie
        setExternalSessionCookie(data.external_session_token, dashboardId, data.expires_at);
        toast.success('Access granted!');
      }

      // Refresh the page to load the dashboard
      router.refresh();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to resend code');
        return;
      }

      toast.success('New code sent to your email');
    } catch {
      toast.error('Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] relative">
      {/* Blurred placeholder background */}
      <div className="absolute inset-0 overflow-hidden">
        <PlaceholderDashboard />
      </div>

      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-md bg-white/30" />

      {/* Auth modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative z-10">
          {/* Logo */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[var(--color-gray-900)]">Zeno</h2>
          </div>

          {/* Dashboard info */}
          <div className="bg-[var(--color-gray-50)] rounded-lg p-4 mb-6">
            <p className="text-sm text-[var(--color-gray-500)] mb-1">You&apos;ve been invited to view</p>
            <p className="font-semibold text-[var(--color-gray-900)]">{dashboardTitle}</p>
          </div>

          {step === 'email' ? (
            <>
              <p className="text-[var(--color-gray-600)] mb-6 text-center">
                Sign in to access this dashboard
              </p>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-[var(--color-gray-700)]">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                    autoFocus
                    className="h-12 px-4 text-base"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending code...
                    </span>
                  ) : (
                    'Continue with Email'
                  )}
                </Button>
              </form>

              <p className="text-xs text-[var(--color-gray-500)] text-center mt-4">
                We&apos;ll email you a magic code for password-free sign in
              </p>
            </>
          ) : (
            <>
              <p className="text-[var(--color-gray-600)] mb-6 text-center">
                We sent a code to <span className="font-semibold">{email}</span>
              </p>

              <form onSubmit={handleVerifySubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-medium text-[var(--color-gray-700)]">
                    Verification code
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={isLoading}
                    autoComplete="one-time-code"
                    autoFocus
                    className="h-14 text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium"
                  disabled={isLoading || code.length < 6}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    'Verify & View Dashboard'
                  )}
                </Button>
              </form>

              <div className="mt-4 text-center space-y-2">
                <p className="text-sm text-[var(--color-gray-500)]">
                  Didn&apos;t receive the code?{' '}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="text-[var(--color-primary)] font-medium hover:underline disabled:opacity-50"
                  >
                    {isResending ? 'Sending...' : 'Resend'}
                  </button>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setCode('');
                  }}
                  className="text-sm text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)]"
                >
                  Use a different email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Placeholder dashboard with fake chart skeletons
function PlaceholderDashboard() {
  return (
    <div className="w-full h-full p-8 opacity-60">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 bg-gray-200 rounded w-64 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-96" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg p-6 shadow-sm">
            <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Bar chart placeholder */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="h-4 bg-gray-200 rounded w-32 mb-6" />
          <div className="flex items-end gap-3 h-48">
            {[40, 65, 45, 80, 55, 70, 50, 85, 60, 75].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-blue-100 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Line chart placeholder */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="h-4 bg-gray-200 rounded w-32 mb-6" />
          <div className="h-48 relative">
            <svg className="w-full h-full" viewBox="0 0 300 150">
              <path
                d="M0,100 Q50,80 100,90 T200,60 T300,40"
                fill="none"
                stroke="#dbeafe"
                strokeWidth="3"
              />
              <path
                d="M0,120 Q50,100 100,110 T200,80 T300,70"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
            </svg>
          </div>
        </div>

        {/* Pie chart placeholder */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="h-4 bg-gray-200 rounded w-32 mb-6" />
          <div className="flex justify-center">
            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-blue-100 via-blue-50 to-gray-100" />
          </div>
        </div>

        {/* Table placeholder */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="h-4 bg-gray-200 rounded w-32 mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 bg-gray-200 rounded flex-1" />
                <div className="h-4 bg-gray-200 rounded w-20" />
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Access revoked component - shown when user was previously shared but access is now removed
export function AccessRevoked({ dashboardTitle }: { dashboardTitle: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-gray-50)] p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-[var(--color-gray-100)] rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-[var(--color-gray-900)] mb-2">
          Access Removed
        </h1>
        <p className="text-[var(--color-gray-600)] mb-2">
          Your access to <span className="font-medium">&quot;{dashboardTitle}&quot;</span> has been revoked.
        </p>
        <p className="text-sm text-[var(--color-gray-500)] mb-6">
          Please contact the dashboard owner if you believe this is a mistake.
        </p>
        <a
          href="https://zeno.fyi"
          className="inline-flex items-center justify-center px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Go to Zeno
        </a>
      </div>
    </div>
  );
}
