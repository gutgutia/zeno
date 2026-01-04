import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/admin/settings - Get all global settings
export async function GET() {
  const supabase = await createClient();

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Get all settings
  const { data: settings, error } = await supabase
    .from('global_settings')
    .select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Convert to key-value object
  const settingsMap: Record<string, unknown> = {};
  for (const setting of settings || []) {
    settingsMap[setting.key] = setting.value;
  }

  return NextResponse.json(settingsMap);
}

// PUT /api/admin/settings - Update a global setting
export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Only super_admin can change settings
  if (adminUser.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'Key and value required' }, { status: 400 });
  }

  // Get old value for audit log
  const { data: oldSetting } = await supabase
    .from('global_settings')
    .select('value')
    .eq('key', key)
    .single();

  // Update setting
  const { error } = await supabase
    .from('global_settings')
    .update({
      value,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('key', key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log admin action
  await supabase.from('admin_audit_log').insert({
    admin_user_id: user.id,
    action: 'update_setting',
    target_type: 'settings',
    old_value: { key, value: oldSetting?.value },
    new_value: { key, value },
  });

  return NextResponse.json({ success: true });
}
