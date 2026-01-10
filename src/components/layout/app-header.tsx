'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth, usePlan } from '@/lib/hooks';
import { useOrganization } from '@/lib/contexts/organization-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { CreditDisplay } from '@/components/billing/CreditDisplay';

export function AppHeader() {
  const { user, signOut } = useAuth();
  const { plan, isLoading: isPlanLoading } = usePlan();
  const { organizations, currentOrg, setCurrentOrg } = useOrganization();
  const router = useRouter();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
  const isFreePlan = plan === 'free';
  const hasMultipleOrgs = organizations.length > 1;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[var(--color-gray-200)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/dashboards" className="flex items-center">
            <Image
              src="/brand/logo-primary.svg"
              alt="Zeno"
              width={151}
              height={66}
              className="h-7 w-auto"
              priority
            />
          </Link>

          {/* Right side - User menu */}
          <div className="flex items-center gap-2">
            {/* Credits Display */}
            <CreditDisplay variant="compact" className="hidden sm:flex" />

            {/* Upgrade nudge for free users */}
            {!isPlanLoading && isFreePlan && (
              <button
                onClick={() => setIsUpgradeModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 rounded-full hover:bg-[var(--color-primary)]/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Upgrade
              </button>
            )}
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
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-[var(--color-gray-900)]">
                    {user?.email}
                  </p>
                  {currentOrg && (
                    <p className="text-xs text-[var(--color-gray-500)] mt-0.5">
                      {currentOrg.name}
                    </p>
                  )}
                </div>
                <DropdownMenuSeparator />

                {/* Organization Switcher */}
                {hasMultipleOrgs && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="cursor-pointer">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Switch Organization
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56">
                        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={currentOrg?.id || ''}
                          onValueChange={(value) => {
                            const org = organizations.find((o) => o.id === value);
                            if (org) {
                              setCurrentOrg(org);
                              router.refresh();
                            }
                          }}
                        >
                          {organizations.map((org) => (
                            <DropdownMenuRadioItem key={org.id} value={org.id} className="cursor-pointer">
                              <div className="flex flex-col">
                                <span>{org.name}</span>
                                <span className="text-xs text-[var(--color-gray-400)] capitalize">
                                  {org.role}
                                </span>
                              </div>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                  </>
                )}

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
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </header>
  );
}
