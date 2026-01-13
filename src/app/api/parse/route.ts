import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseDocument, isDocumentType } from '@/lib/data/document-parser';

export const maxDuration = 60; // 1 minute for large documents

export async function POST(request: Request) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check file extension
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!isDocumentType(extension)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${extension}. Supported types: PDF, DOCX, PPTX, ODT, ODP, ODS, RTF` },
        { status: 400 }
      );
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 50MB.` },
        { status: 400 }
      );
    }

    // Parse the document
    const buffer = await file.arrayBuffer();
    const result = await parseDocument(buffer);

    return NextResponse.json({
      text: result.text,
      metadata: result.metadata,
      fileName: file.name,
      fileSize: file.size,
    });

  } catch (error) {
    console.error('[Parse API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse document' },
      { status: 500 }
    );
  }
}
