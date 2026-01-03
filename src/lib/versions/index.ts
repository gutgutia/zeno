import { SupabaseClient } from '@supabase/supabase-js';
import type { Dashboard, DashboardVersion, VersionChangeType, DataSource } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';

/**
 * Version Service
 *
 * Handles creating, retrieving, and restoring dashboard versions.
 * Uses major.minor versioning:
 * - Major: Increments on data refresh (1.x -> 2.0)
 * - Minor: Increments on AI modifications (1.0 -> 1.1)
 */

export interface CreateVersionParams {
  dashboardId: string;
  changeType: VersionChangeType;
  changeSummary?: string;
  config: DashboardConfig | null;
  rawContent?: string | null;
  data?: Record<string, unknown>[] | null;
  dataSource?: DataSource | null;
  userId?: string;
}

export interface VersionInfo {
  major: number;
  minor: number;
  label: string;
}

/**
 * Get the current version of a dashboard
 */
export async function getCurrentVersion(
  supabase: SupabaseClient,
  dashboardId: string
): Promise<VersionInfo> {
  const { data, error } = await supabase
    .from('dashboards')
    .select('current_major_version, current_minor_version')
    .eq('id', dashboardId)
    .single();

  if (error || !data) {
    return { major: 1, minor: 0, label: '1.0' };
  }

  const major = data.current_major_version ?? 1;
  const minor = data.current_minor_version ?? 0;
  return { major, minor, label: `${major}.${minor}` };
}

/**
 * Calculate the next version number based on change type
 */
export function getNextVersion(
  currentMajor: number,
  currentMinor: number,
  changeType: VersionChangeType
): VersionInfo {
  if (changeType === 'data_refresh') {
    // Major version bump, reset minor to 0
    const major = currentMajor + 1;
    return { major, minor: 0, label: `${major}.0` };
  } else {
    // Minor version bump (ai_modification, restore)
    const minor = currentMinor + 1;
    return { major: currentMajor, minor, label: `${currentMajor}.${minor}` };
  }
}

/**
 * Create a new version snapshot of a dashboard
 */
export async function createVersion(
  supabase: SupabaseClient,
  params: CreateVersionParams
): Promise<DashboardVersion> {
  const {
    dashboardId,
    changeType,
    changeSummary,
    config,
    rawContent,
    data,
    dataSource,
    userId,
  } = params;

  // Get current version
  const current = await getCurrentVersion(supabase, dashboardId);

  // Calculate next version (for initial, use 1.0)
  let nextVersion: VersionInfo;
  if (changeType === 'initial') {
    nextVersion = { major: 1, minor: 0, label: '1.0' };
  } else {
    nextVersion = getNextVersion(current.major, current.minor, changeType);
  }

  // Create version snapshot
  const { data: version, error: versionError } = await supabase
    .from('dashboard_versions')
    .insert({
      dashboard_id: dashboardId,
      major_version: nextVersion.major,
      minor_version: nextVersion.minor,
      change_type: changeType,
      change_summary: changeSummary || null,
      config: config as unknown as Record<string, unknown>,
      raw_content: rawContent || null,
      data: data || null,
      data_source: dataSource as unknown as Record<string, unknown> || null,
      created_by: userId || null,
    })
    .select()
    .single();

  if (versionError) {
    console.error('Failed to create version:', versionError);
    throw new Error(`Failed to create version: ${versionError.message}`);
  }

  // Update dashboard's current version
  const { error: updateError } = await supabase
    .from('dashboards')
    .update({
      current_major_version: nextVersion.major,
      current_minor_version: nextVersion.minor,
    })
    .eq('id', dashboardId);

  if (updateError) {
    console.error('Failed to update dashboard version:', updateError);
    // Don't throw - version was created successfully
  }

  return version as DashboardVersion;
}

/**
 * Get all versions of a dashboard, ordered by version (newest first)
 */
export async function getVersions(
  supabase: SupabaseClient,
  dashboardId: string
): Promise<DashboardVersion[]> {
  const { data, error } = await supabase
    .from('dashboard_versions')
    .select('*')
    .eq('dashboard_id', dashboardId)
    .order('major_version', { ascending: false })
    .order('minor_version', { ascending: false });

  if (error) {
    console.error('Failed to get versions:', error);
    throw new Error(`Failed to get versions: ${error.message}`);
  }

  return (data || []) as DashboardVersion[];
}

/**
 * Get a specific version of a dashboard
 */
export async function getVersion(
  supabase: SupabaseClient,
  dashboardId: string,
  major: number,
  minor: number
): Promise<DashboardVersion | null> {
  const { data, error } = await supabase
    .from('dashboard_versions')
    .select('*')
    .eq('dashboard_id', dashboardId)
    .eq('major_version', major)
    .eq('minor_version', minor)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Failed to get version:', error);
    throw new Error(`Failed to get version: ${error.message}`);
  }

  return data as DashboardVersion;
}

/**
 * Restore a dashboard to a specific version
 * Creates a new version with change_type 'restore'
 */
export async function restoreVersion(
  supabase: SupabaseClient,
  dashboardId: string,
  major: number,
  minor: number,
  userId?: string
): Promise<{ dashboard: Dashboard; version: DashboardVersion }> {
  // Get the version to restore
  const targetVersion = await getVersion(supabase, dashboardId, major, minor);
  if (!targetVersion) {
    throw new Error(`Version ${major}.${minor} not found`);
  }

  // Update the dashboard with the restored state
  const { data: dashboard, error: updateError } = await supabase
    .from('dashboards')
    .update({
      config: targetVersion.config as unknown as Record<string, unknown>,
      raw_content: targetVersion.raw_content,
      data: targetVersion.data,
      data_source: targetVersion.data_source as unknown as Record<string, unknown>,
    })
    .eq('id', dashboardId)
    .select()
    .single();

  if (updateError) {
    console.error('Failed to restore dashboard:', updateError);
    throw new Error(`Failed to restore dashboard: ${updateError.message}`);
  }

  // Create a new version recording the restore
  const newVersion = await createVersion(supabase, {
    dashboardId,
    changeType: 'restore',
    changeSummary: `Restored to version ${major}.${minor}`,
    config: targetVersion.config,
    rawContent: targetVersion.raw_content,
    data: targetVersion.data,
    dataSource: targetVersion.data_source,
    userId,
  });

  return {
    dashboard: dashboard as Dashboard,
    version: newVersion,
  };
}

/**
 * Group versions by major version for display
 */
export function groupVersionsByMajor(
  versions: DashboardVersion[]
): Map<number, DashboardVersion[]> {
  const groups = new Map<number, DashboardVersion[]>();

  for (const version of versions) {
    const major = version.major_version;
    if (!groups.has(major)) {
      groups.set(major, []);
    }
    groups.get(major)!.push(version);
  }

  // Sort each group by minor version (descending)
  for (const [, group] of groups) {
    group.sort((a, b) => b.minor_version - a.minor_version);
  }

  return groups;
}

/**
 * Get a human-readable description for a change type
 */
export function getChangeTypeLabel(changeType: VersionChangeType): string {
  switch (changeType) {
    case 'initial':
      return 'Initial generation';
    case 'ai_modification':
      return 'AI modification';
    case 'data_refresh':
      return 'Data update';
    case 'restore':
      return 'Restored version';
    default:
      return 'Change';
  }
}
