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
  /** Dashboard title to display */
  title: string;
  /** Optional company logo URL from branding */
  logoUrl?: string;
  /** Optional company name from branding */
  companyName?: string;
}

/**
 * Header component for shared dashboards (both public and private).
 *
 * Shows:
 * - Zeno logo (always)
 * - Dashboard title with optional company branding
 * - For authenticated users: avatar dropdown with My Dashboards, Settings, Sign Out
 * - For unauthenticated users: Sign In / Get Started buttons
 */
export function SharedDashboardHeader({
  user,
  title,
  logoUrl,
  companyName,
}: SharedDashboardHeaderProps) {
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
          {/* Left side - Zeno Logo + Dashboard Title */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Zeno Logo */}
            <Link href="/" className="flex-shrink-0">
              <Image
                src="/brand/logo-primary.svg"
                alt="Zeno"
                width={151}
                height={66}
                className="h-7 w-auto"
                priority
              />
            </Link>

            {/* Divider */}
            <div className="hidden sm:block h-6 w-px bg-[var(--color-gray-200)]" />

            {/* Dashboard branding + title */}
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={companyName || 'Logo'}
                  className="h-6 w-auto flex-shrink-0"
                />
              )}
              <h1 className="text-sm font-medium text-[var(--color-gray-700)] truncate">
                {title}
              </h1>
            </div>
          </div>

          {/* Right side - Auth state dependent */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {user ? (
              /* Authenticated user - show avatar dropdown */
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
            ) : (
              /* Unauthenticated - show sign in / get started buttons */
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
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
