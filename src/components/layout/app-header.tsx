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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { CreditDisplay } from '@/components/billing/CreditDisplay';

// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

export function AppHeader() {
  const { user, signOut } = useAuth();
  const { plan, isLoading: isPlanLoading } = usePlan();
  const { organizations, currentOrg, setCurrentOrg, refetch } = useOrganization();
  const router = useRouter();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Create organization state
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleNameChange = (name: string) => {
    setNewOrgName(name);
    if (!isSlugManuallyEdited) {
      setNewOrgSlug(generateSlug(name));
    }
  };

  const handleSlugChange = (slug: string) => {
    setIsSlugManuallyEdited(true);
    setNewOrgSlug(slug.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) {
      setCreateError('Organization name is required');
      return;
    }

    if (!newOrgSlug.trim()) {
      setCreateError('URL slug is required');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newOrgName.trim(),
          slug: newOrgSlug.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create organization');
      }

      const newOrg = await response.json();

      // Refresh organizations and switch to the new one
      await refetch();
      setCurrentOrg({
        id: newOrg.id,
        name: newOrg.name,
        slug: newOrg.slug,
        role: 'owner',
      });

      // Reset form and close dialog
      setNewOrgName('');
      setNewOrgSlug('');
      setIsSlugManuallyEdited(false);
      setIsCreateOrgOpen(false);

      // Refresh the page to load new org data
      router.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsCreating(false);
    }
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
  const isFreePlan = plan === 'free';

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

                {/* Organization Switcher - Always show */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Organizations
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => setIsCreateOrgOpen(true)}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Organization
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
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
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      {/* Create Organization Dialog */}
      <Dialog open={isCreateOrgOpen} onOpenChange={setIsCreateOrgOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {createError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                {createError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={newOrgName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Inc"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">URL Slug</Label>
              <Input
                id="org-slug"
                value={newOrgSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="acme-inc"
              />
              {newOrgSlug && (
                <p className="text-xs text-[var(--color-gray-500)]">
                  Your organization will be at{' '}
                  <span className="font-mono text-[var(--color-primary)]">
                    {newOrgSlug}.zeno.fyi
                  </span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOrgOpen(false);
                setNewOrgName('');
                setNewOrgSlug('');
                setIsSlugManuallyEdited(false);
                setCreateError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateOrg} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
