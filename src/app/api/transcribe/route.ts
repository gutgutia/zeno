import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';

export const maxDuration = 60; // 1 minute max for transcription

export async function POST(request: Request) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for Groq API key
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.error('[Transcribe] GROQ_API_KEY not configured');
      return NextResponse.json(
        { error: 'Voice transcription is not configured' },
        { status: 503 }
      );
    }

    // Get the audio file from form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Check file size (max 25MB for Groq)
    const maxSize = 25 * 1024 * 1024;
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }

    console.log(`[Transcribe] Processing audio: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`);

    // Initialize Groq client
    const groq = new Groq({ apiKey: groqApiKey });

    // Transcribe using Whisper Large V3 Turbo (fastest)
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
      response_format: 'json',
      language: 'en', // Can be made dynamic if needed
    });

    console.log(`[Transcribe] Success: "${transcription.text.slice(0, 100)}..."`);

    return NextResponse.json({
      text: transcription.text,
    });

  } catch (error) {
    console.error('[Transcribe] Error:', error);

    // Handle specific Groq errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid file format')) {
        return NextResponse.json(
          { error: 'Invalid audio format. Please try again.' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to transcribe audio. Please try again.' },
      { status: 500 }
    );
  }
}
