import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * POST /api/profile/avatar - Upload a profile avatar
 *
 * Accepts multipart/form-data with:
 * - file: The avatar image file
 *
 * Returns the public URL of the uploaded avatar
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, GIF, WebP' },
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

    // Generate file path: {user_id}/avatar.{ext}
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${user.id}/avatar.${extension}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Delete any existing avatars for this user (clean up old files)
    const { data: existingFiles } = await supabase.storage
      .from('avatars')
      .list(user.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
      await supabase.storage.from('avatars').remove(filesToDelete);
    }

    // Upload the new avatar
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload avatar. Make sure storage bucket exists.' },
        { status: 500 }
      );
    }

    // Get the public URL with cache-busting timestamp
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Add timestamp to bust browser/CDN cache
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update the profile with the new avatar URL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      // Don't fail the request - avatar is uploaded, just profile update failed
    }

    return NextResponse.json({
      success: true,
      avatar_url: avatarUrl,
      message: 'Avatar uploaded successfully'
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/profile/avatar - Remove the profile avatar
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete all avatars for this user
    const { data: existingFiles } = await supabase.storage
      .from('avatars')
      .list(user.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
      await supabase.storage.from('avatars').remove(filesToDelete);
    }

    // Update profile to remove avatar_url
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      message: 'Avatar removed successfully'
    });
  } catch (error) {
    console.error('Avatar delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
