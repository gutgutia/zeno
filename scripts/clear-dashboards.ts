#!/usr/bin/env npx ts-node

/**
 * Script to clear dashboards from the database
 *
 * Usage:
 *   npm run db:clear-dashboards              # Clear ALL dashboards (requires confirmation)
 *   npm run db:clear-dashboards -- --all     # Clear ALL dashboards (skip confirmation)
 *   npm run db:clear-dashboards -- --email user@example.com   # Clear dashboards for specific user
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local and .env
function loadEnvFile(filename: string) {
  const filepath = resolve(process.cwd(), filename);
  if (!existsSync(filepath)) return;

  const content = readFileSync(filepath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  console.error('\nMake sure you have a .env.local file with these variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getUserByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error fetching users:', error.message);
    return null;
  }

  const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  return user?.id || null;
}

async function clearDashboardsForUser(userId: string, email: string): Promise<void> {
  console.log(`\nClearing dashboards for user: ${email} (${userId})`);

  // First, get count of dashboards
  const { count, error: countError } = await supabase
    .from('dashboards')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);

  if (countError) {
    console.error('Error counting dashboards:', countError.message);
    return;
  }

  console.log(`Found ${count || 0} dashboards for this user`);

  if (!count || count === 0) {
    console.log('No dashboards to delete.');
    return;
  }

  // Get dashboard IDs first
  const { data: dashboards } = await supabase
    .from('dashboards')
    .select('id')
    .eq('owner_id', userId);

  const dashboardIds = dashboards?.map(d => d.id) || [];

  if (dashboardIds.length === 0) {
    console.log('No dashboards found for this user.');
    return;
  }

  // Delete dashboard versions first (foreign key constraint)
  const { error: versionsError } = await supabase
    .from('dashboard_versions')
    .delete()
    .in('dashboard_id', dashboardIds);

  if (versionsError) {
    console.error('Error deleting dashboard versions:', versionsError.message);
  }

  // Delete dashboard shares
  const { error: sharesError } = await supabase
    .from('dashboard_shares')
    .delete()
    .in('dashboard_id', dashboardIds);

  if (sharesError) {
    console.error('Error deleting dashboard shares:', sharesError.message);
  }

  // Delete chat messages
  const { error: chatError } = await supabase
    .from('chat_messages')
    .delete()
    .in('dashboard_id', dashboardIds);

  if (chatError) {
    console.error('Error deleting chat messages:', chatError.message);
  }

  // Delete dashboards
  const { error: deleteError } = await supabase
    .from('dashboards')
    .delete()
    .eq('owner_id', userId);

  if (deleteError) {
    console.error('Error deleting dashboards:', deleteError.message);
    return;
  }

  console.log(`✓ Deleted ${count} dashboards for ${email}`);
}

async function clearAllDashboards(): Promise<void> {
  console.log('\nClearing ALL dashboards from the database...');

  // Get count first
  const { count, error: countError } = await supabase
    .from('dashboards')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting dashboards:', countError.message);
    return;
  }

  console.log(`Found ${count || 0} total dashboards`);

  if (!count || count === 0) {
    console.log('No dashboards to delete.');
    return;
  }

  // Delete in order due to foreign key constraints
  console.log('Deleting dashboard versions...');
  const { error: versionsError } = await supabase
    .from('dashboard_versions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (versionsError) {
    console.error('Error deleting versions:', versionsError.message);
  }

  console.log('Deleting dashboard shares...');
  const { error: sharesError } = await supabase
    .from('dashboard_shares')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (sharesError) {
    console.error('Error deleting shares:', sharesError.message);
  }

  console.log('Deleting chat messages...');
  const { error: chatError } = await supabase
    .from('chat_messages')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (chatError) {
    console.error('Error deleting chat messages:', chatError.message);
  }

  console.log('Deleting dashboards...');
  const { error: deleteError } = await supabase
    .from('dashboards')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (deleteError) {
    console.error('Error deleting dashboards:', deleteError.message);
    return;
  }

  console.log(`✓ Deleted ${count} dashboards`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments
  const emailIndex = args.indexOf('--email');
  const hasAll = args.includes('--all');
  const email = emailIndex !== -1 ? args[emailIndex + 1] : null;

  console.log('='.repeat(50));
  console.log('Dashboard Cleanup Script');
  console.log('='.repeat(50));

  if (email) {
    // Clear for specific user
    const userId = await getUserByEmail(email);

    if (!userId) {
      console.error(`\nUser not found with email: ${email}`);
      process.exit(1);
    }

    await clearDashboardsForUser(userId, email);
  } else {
    // Clear all dashboards
    if (!hasAll) {
      console.log('\n⚠️  WARNING: This will delete ALL dashboards from ALL users!');
      console.log('To confirm, run with --all flag:');
      console.log('  npm run db:clear-dashboards -- --all\n');
      process.exit(0);
    }

    await clearAllDashboards();
  }

  console.log('\n' + '='.repeat(50));
  console.log('Done!');
  console.log('='.repeat(50));
}

main().catch(console.error);
