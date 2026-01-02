'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  // Store redirect URL on mount
  useEffect(() => {
    if (redirectTo) {
      sessionStorage.setItem('auth_redirect', redirectTo);
    }
  }, [redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
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

      // Store email for verification page
      sessionStorage.setItem('pending_email', email);

      toast.success('Check your email for the verification code');
      router.push('/login/verify');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-10 h-10 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">Z</span>
          </div>
          <span className="text-2xl font-semibold text-[var(--color-gray-900)]">
            Zeno
          </span>
        </Link>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-gray-900)] mb-2">
            Welcome back
          </h1>
          <p className="text-[var(--color-gray-600)]">
            Enter your email to sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Sending code...' : 'Continue with Email'}
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--color-gray-500)] mt-6">
          We&apos;ll send you a verification code to sign in.
          <br />
          No password needed.
        </p>
      </div>

      {/* Footer */}
      <p className="text-center text-sm text-[var(--color-gray-500)] mt-8">
        By continuing, you agree to our{' '}
        <Link href="/terms" className="text-[var(--color-primary)] hover:underline">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-[var(--color-primary)] hover:underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="w-full max-w-md px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2">
          <div className="w-10 h-10 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">Z</span>
          </div>
          <span className="text-2xl font-semibold text-[var(--color-gray-900)]">
            Zeno
          </span>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-gray-50)]">
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
