import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/profile - Get current user's profile
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (supabase as any)
      .from('profiles')
      .select('id, name, avatar_url, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json({
      id: profile?.id || user.id,
      email: user.email,
      name: profile?.name || null,
      avatar_url: profile?.avatar_url || null,
      created_at: profile?.created_at || user.created_at,
      updated_at: profile?.updated_at || null,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/profile - Update current user's profile
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, avatar_url } = body;

    // Build update object with only provided fields
    const updates: Record<string, string | null> = {};
    if (name !== undefined) {
      updates.name = name?.trim() || null;
    }
    if (avatar_url !== undefined) {
      updates.avatar_url = avatar_url || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Update profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: updateError } = await (supabase as any)
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id, name, avatar_url, created_at, updated_at')
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({
      id: profile.id,
      email: user.email,
      name: profile.name,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
