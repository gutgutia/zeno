'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function LoginForm() {
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
      router.push('/auth/verify');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] mx-auto">
      <div className="mb-10 text-center lg:text-left">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-gray-900)] mb-3">
          Get started with Zeno
        </h1>
        <p className="text-[var(--color-gray-600)] text-lg">
          Sign in or create an account to start building beautiful dashboards.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
            className="h-12 px-4 text-base border-[var(--color-gray-200)] focus-visible:ring-[var(--color-primary-light)] focus-visible:border-[var(--color-primary)] transition-all"
          />
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 text-base font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm" 
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending code...
            </span>
          ) : (
            'Continue with Email'
          )}
        </Button>
      </form>

      <div className="mt-8 pt-8 border-t border-[var(--color-gray-100)] text-center lg:text-left">
        <div className="flex items-center justify-center lg:justify-start gap-3 text-sm text-[var(--color-gray-500)]">
          <svg className="w-5 h-5 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>We&apos;ll email you a magic code for a password-free sign in.</span>
        </div>
      </div>

      <p className="text-center lg:text-left text-sm text-[var(--color-gray-500)] mt-8">
        By continuing, you agree to our{' '}
        <Link href="/terms" className="text-[var(--color-primary)] font-medium hover:underline hover:text-[var(--color-primary-hover)] transition-colors">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-[var(--color-primary)] font-medium hover:underline hover:text-[var(--color-primary-hover)] transition-colors">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
