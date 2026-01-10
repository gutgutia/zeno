'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { OrganizationRole } from '@/types/database';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const CURRENT_ORG_KEY = 'zeno_current_org_id';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        const orgs = (data.organizations || []) as Organization[];
        setOrganizations(orgs);

        // Restore previously selected org from localStorage
        const savedOrgId = localStorage.getItem(CURRENT_ORG_KEY);
        const savedOrg = orgs.find((o) => o.id === savedOrgId);

        if (savedOrg) {
          setCurrentOrgState(savedOrg);
        } else if (orgs.length > 0) {
          // Default to first org (usually personal)
          setCurrentOrgState(orgs[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const setCurrentOrg = useCallback((org: Organization) => {
    setCurrentOrgState(org);
    localStorage.setItem(CURRENT_ORG_KEY, org.id);
  }, []);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        setCurrentOrg,
        isLoading,
        refetch: fetchOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

/**
 * Hook to get the current organization ID
 * Useful for API calls that need the org context
 */
export function useCurrentOrgId(): string | null {
  const { currentOrg } = useOrganization();
  return currentOrg?.id ?? null;
}
