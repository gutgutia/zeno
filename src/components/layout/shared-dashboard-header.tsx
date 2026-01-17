'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';

interface SharedDashboardHeaderProps {
  /** User object if authenticated, null otherwise */
  user: { email: string } | null;
  /** Hide Zeno branding for white-labeled dashboards */
  hideZenoBranding?: boolean;
}

/**
 * Header component for shared dashboards - matches AppHeader exactly
 *
 * For authenticated users: Same as AppHeader (logo + avatar dropdown)
 * For unauthenticated users: Logo + Sign In / Get Started buttons
 */
export function SharedDashboardHeader({ user, hideZenoBranding }: SharedDashboardHeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[var(--color-gray-200)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo - hidden for white-labeled dashboards */}
          {!hideZenoBranding ? (
            <Link href={user ? '/dashboards' : '/'} className="flex items-center">
              <Image
                src="/brand/logo-primary.svg"
                alt="Zeno"
                width={151}
                height={66}
                className="h-7 w-auto"
                priority
              />
            </Link>
          ) : (
            <div /> /* Spacer for layout */
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              /* Authenticated user - same as AppHeader */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-[var(--color-primary-light)] text-[var(--color-primary)] text-sm font-medium">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-[var(--color-gray-900)]">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboards">My Dashboards</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-[var(--color-error)]">
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : !hideZenoBranding ? (
              /* Unauthenticated - show sign in buttons (not for white-labeled) */
              <>
                <Link href="/auth">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth">
                  <Button size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
