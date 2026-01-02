'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function VerifyPage() {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Get email from session storage
    const pendingEmail = sessionStorage.getItem('pending_email');
    if (!pendingEmail) {
      router.push('/login');
      return;
    }
    setEmail(pendingEmail);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.length < 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);

    try {
      // First, verify our custom OTP
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Invalid code');
        return;
      }

      // Use the token hash to complete sign-in via Supabase
      const { error } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Clear pending email and get redirect URL
      sessionStorage.removeItem('pending_email');
      const redirectUrl = sessionStorage.getItem('auth_redirect');
      sessionStorage.removeItem('auth_redirect');

      toast.success(data.isNewUser ? 'Welcome to Zeno!' : 'Successfully signed in!');
      router.push(redirectUrl || '/dashboards');
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

  if (!email) {
    return <VerifyLoading />;
  }

  return (
    <div className="w-full">
      <div className="mb-10 text-center lg:text-left">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-gray-900)] mb-3">
          Check your email
        </h1>
        <p className="text-[var(--color-gray-600)] text-lg">
          We sent a code to <span className="font-semibold text-[var(--color-gray-900)]">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
            className="h-14 text-center text-3xl tracking-[0.5em] font-mono border-[var(--color-gray-200)] focus-visible:ring-[var(--color-primary-light)] focus-visible:border-[var(--color-primary)] transition-all"
          />
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 text-base font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm" 
          disabled={isLoading || code.length < 6}
        >
          {isLoading ? (
             <span className="flex items-center gap-2">
               <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               Verifying...
             </span>
          ) : (
            'Verify & Sign In'
          )}
        </Button>
      </form>

      <div className="mt-8 text-center lg:text-left space-y-4">
        <p className="text-sm text-[var(--color-gray-500)]">
          Didn&apos;t receive the code?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-[var(--color-primary)] font-medium hover:underline disabled:opacity-50 transition-colors"
          >
            {isResending ? 'Sending...' : 'Click to resend'}
          </button>
        </p>

        <div>
          <Link
            href="/login"
            className="text-sm text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)] transition-colors inline-flex items-center gap-1"
          >
            ← Use a different email
          </Link>
        </div>
      </div>
    </div>
  );
}

function VerifyLoading() {
  return (
    <div className="w-full animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
      <div className="space-y-4">
        <div className="h-14 bg-gray-200 rounded"></div>
        <div className="h-12 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}
