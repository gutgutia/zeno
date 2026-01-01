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
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Clear pending email
      sessionStorage.removeItem('pending_email');

      toast.success('Successfully signed in!');
      router.push('/dashboards');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        toast.error(error.message);
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
    return null; // Loading state while checking email
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-gray-50)]">
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
              Check your email
            </h1>
            <p className="text-[var(--color-gray-600)]">
              We sent a code to{' '}
              <span className="font-medium text-[var(--color-gray-900)]">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isLoading}
                autoComplete="one-time-code"
                autoFocus
                className="text-center text-2xl tracking-widest"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || code.length < 6}>
              {isLoading ? 'Verifying...' : 'Verify & Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--color-gray-500)]">
              Didn&apos;t receive the code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="text-[var(--color-primary)] hover:underline disabled:opacity-50"
              >
                {isResending ? 'Sending...' : 'Resend'}
              </button>
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/login"
              className="text-sm text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)]"
            >
              ← Use a different email
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
