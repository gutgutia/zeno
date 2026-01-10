/**
 * Centralized Permission Helpers
 *
 * Provides consistent permission checking across all API routes.
 * All functions work with the Supabase client (server-side).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrganizationRole } from '@/types/database';

// ============================================
// ORGANIZATION PERMISSIONS
// ============================================

/**
 * Get user's role in an organization
 * Returns null if user is not a member
 */
export async function getOrgRole(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<OrganizationRole | null> {
  const { data } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .single();

  return (data?.role as OrganizationRole) || null;
}

/**
 * Check if user is a member of an organization (any role)
 */
export async function isOrgMember(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<boolean> {
  const role = await getOrgRole(supabase, orgId, userId);
  return role !== null;
}

/**
 * Check if user can manage organization (owner or admin)
 * Used for: member management, branding, general settings
 */
export async function canManageOrg(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<boolean> {
  const role = await getOrgRole(supabase, orgId, userId);
  return role === 'owner' || role === 'admin';
}

/**
 * Check if user is the organization owner
 * Used for: billing, domain settings, delete org
 */
export async function isOrgOwner(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<boolean> {
  const role = await getOrgRole(supabase, orgId, userId);
  return role === 'owner';
}

/**
 * Get all organizations a user belongs to
 */
export async function getUserOrganizations(
  supabase: SupabaseClient,
  userId: string
): Promise<Array<{ id: string; name: string; role: OrganizationRole }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('organization_members')
    .select('organization_id, role, organizations(id, name)')
    .eq('user_id', userId) as { data: Array<{ role: string; organizations: { id: string; name: string } }> | null };

  if (!data) return [];

  return data.map((m) => ({
    id: m.organizations.id,
    name: m.organizations.name,
    role: m.role as OrganizationRole,
  }));
}

// ============================================
// DASHBOARD PERMISSIONS
// ============================================

/**
 * Permission levels for dashboard access
 * Designed to accommodate future share-with-edit feature
 */
export type DashboardPermission = 'none' | 'view' | 'edit' | 'admin';

/**
 * Get user's permission level for a dashboard
 *
 * Permission hierarchy:
 * - admin: Full control (owner, org owner/admin)
 * - edit: Can modify (creator, or future: shared with edit access)
 * - view: Can view (org member, or shared with view access)
 * - none: No access
 */
export async function getDashboardPermission(
  supabase: SupabaseClient,
  dashboardId: string,
  userId: string
): Promise<DashboardPermission> {
  // Get dashboard with owner and organization info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dashboard } = await (supabase as any)
    .from('dashboards')
    .select(`
      id,
      owner_id,
      organization_id,
      workspaces!inner(owner_id)
    `)
    .eq('id', dashboardId)
    .single() as { data: { id: string; owner_id: string; organization_id: string | null; workspaces: { owner_id: string } } | null };

  if (!dashboard) return 'none';

  // Check if user is the dashboard creator
  // Using both owner_id (new) and workspaces.owner_id (legacy) for compatibility
  const isCreator =
    dashboard.owner_id === userId ||
    dashboard.workspaces?.owner_id === userId;

  if (isCreator) {
    return 'admin';
  }

  // Check organization membership if dashboard belongs to an org
  if (dashboard.organization_id) {
    const orgRole = await getOrgRole(supabase, dashboard.organization_id, userId);

    if (orgRole === 'owner' || orgRole === 'admin') {
      return 'admin';
    }

    if (orgRole === 'member') {
      // Members can view all org dashboards
      // Future: Check if shared with edit access
      return 'view';
    }
  }

  // Future: Check dashboard_shares for explicit share permissions
  // This is where share-with-edit would be checked:
  // const { data: share } = await supabase
  //   .from('dashboard_shares')
  //   .select('permission_level')
  //   .eq('dashboard_id', dashboardId)
  //   .eq('share_value', userEmail)
  //   .single();
  // if (share?.permission_level === 'edit') return 'edit';
  // if (share?.permission_level === 'view') return 'view';

  return 'none';
}

/**
 * Check if user can view a dashboard
 */
export async function canViewDashboard(
  supabase: SupabaseClient,
  dashboardId: string,
  userId: string
): Promise<boolean> {
  const permission = await getDashboardPermission(supabase, dashboardId, userId);
  return permission !== 'none';
}

/**
 * Check if user can edit a dashboard
 */
export async function canEditDashboard(
  supabase: SupabaseClient,
  dashboardId: string,
  userId: string
): Promise<boolean> {
  const permission = await getDashboardPermission(supabase, dashboardId, userId);
  return permission === 'edit' || permission === 'admin';
}

/**
 * Check if user has admin access to a dashboard
 * Admin = can delete, transfer, manage shares
 */
export async function canAdminDashboard(
  supabase: SupabaseClient,
  dashboardId: string,
  userId: string
): Promise<boolean> {
  const permission = await getDashboardPermission(supabase, dashboardId, userId);
  return permission === 'admin';
}

// ============================================
// LEGACY COMPATIBILITY
// ============================================

/**
 * Check dashboard ownership via workspace (legacy pattern)
 * @deprecated Use getDashboardPermission instead
 */
export async function checkDashboardOwnershipLegacy(
  supabase: SupabaseClient,
  dashboardId: string,
  userId: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('dashboards')
    .select('workspaces!inner(owner_id)')
    .eq('id', dashboardId)
    .single() as { data: { workspaces: { owner_id: string } } | null };

  return data?.workspaces?.owner_id === userId;
}

// ============================================
// HELPER TYPES
// ============================================

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  permission?: DashboardPermission;
  role?: OrganizationRole;
}

/**
 * Comprehensive permission check with detailed result
 * Useful for debugging and error messages
 */
export async function checkDashboardAccess(
  supabase: SupabaseClient,
  dashboardId: string,
  userId: string,
  requiredLevel: DashboardPermission = 'view'
): Promise<PermissionCheckResult> {
  const permission = await getDashboardPermission(supabase, dashboardId, userId);

  const levels: DashboardPermission[] = ['none', 'view', 'edit', 'admin'];
  const userLevelIndex = levels.indexOf(permission);
  const requiredLevelIndex = levels.indexOf(requiredLevel);

  if (userLevelIndex >= requiredLevelIndex) {
    return { allowed: true, permission };
  }

  return {
    allowed: false,
    permission,
    reason:
      permission === 'none'
        ? 'You do not have access to this dashboard'
        : `You have ${permission} access but ${requiredLevel} access is required`,
  };
}
