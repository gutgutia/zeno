import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Workspace } from '@/types/database';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * POST /api/branding/logo - Upload a workspace logo
 *
 * Accepts multipart/form-data with:
 * - file: The logo image file
 *
 * Returns the public URL of the uploaded logo
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's personal workspace
    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .eq('type', 'personal')
      .single();

    if (workspaceError || !workspaceData) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspace = workspaceData as unknown as Workspace;

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, GIF, WebP, SVG' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 2MB' },
        { status: 400 }
      );
    }

    // Generate file path: {workspace_id}/logo.{ext}
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${workspace.id}/logo.${extension}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Delete any existing logos for this workspace (clean up old files)
    const { data: existingFiles } = await supabase.storage
      .from('logos')
      .list(workspace.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `${workspace.id}/${f.name}`);
      await supabase.storage.from('logos').remove(filesToDelete);
    }

    // Upload the new logo
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Logo upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload logo' },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('logos')
      .getPublicUrl(filePath);

    const logoUrl = urlData.publicUrl;

    // Update the workspace branding with the new logo URL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentWorkspace } = await (supabase as any)
      .from('workspaces')
      .select('branding')
      .eq('id', workspace.id)
      .single();

    const currentBranding = (currentWorkspace?.branding as Record<string, unknown>) || {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('workspaces')
      .update({
        branding: {
          ...currentBranding,
          logoUrl,
        },
      })
      .eq('id', workspace.id);

    if (updateError) {
      console.error('Failed to update branding:', updateError);
      // Don't fail the request - logo is uploaded, just branding update failed
    }

    return NextResponse.json({
      success: true,
      logoUrl,
      message: 'Logo uploaded successfully'
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/branding/logo - Remove the workspace logo
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's personal workspace
    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, branding')
      .eq('owner_id', user.id)
      .eq('type', 'personal')
      .single();

    if (workspaceError || !workspaceData) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspace = workspaceData as unknown as Workspace;

    // Delete all logos for this workspace
    const { data: existingFiles } = await supabase.storage
      .from('logos')
      .list(workspace.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `${workspace.id}/${f.name}`);
      await supabase.storage.from('logos').remove(filesToDelete);
    }

    // Update branding to remove logoUrl
    const currentBranding = (workspace.branding as Record<string, unknown>) || {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { logoUrl: _, ...brandingWithoutLogo } = currentBranding;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('workspaces')
      .update({
        branding: Object.keys(brandingWithoutLogo).length > 0 ? brandingWithoutLogo : null,
      })
      .eq('id', workspace.id);

    return NextResponse.json({
      success: true,
      message: 'Logo removed successfully'
    });
  } catch (error) {
    console.error('Logo delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
