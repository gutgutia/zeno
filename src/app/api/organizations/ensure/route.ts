import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/organizations/ensure - Ensure user has an organization (for legacy users)
export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to call the SECURITY DEFINER function
    const adminSupabase = createAdminClient();

    // Call the database function to get or create organization
    const { data: orgId, error: rpcError } = await adminSupabase.rpc(
      'get_or_create_user_organization',
      { p_user_id: user.id }
    );

    if (rpcError) {
      console.error('Error ensuring organization:', rpcError);
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organization_id: orgId
    });
  } catch (error) {
    console.error('Organization ensure error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
