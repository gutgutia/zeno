'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseVoiceRecordingOptions {
  onTranscript: (transcript: string) => void;
}

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  recordingDuration: number;
  recordingError: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useVoiceRecording({
  onTranscript,
}: UseVoiceRecordingOptions): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // Refs for recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const audioMimeTypeRef = useRef<string>('audio/webm');

  // Transcribe audio blob
  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setRecordingError(null);

    try {
      // Determine file extension from mime type
      const getExtension = (mimeType: string) => {
        if (mimeType.includes('webm')) return 'webm';
        if (mimeType.includes('mp4')) return 'mp4';
        if (mimeType.includes('mpeg')) return 'mp3';
        if (mimeType.includes('ogg')) return 'ogg';
        return 'webm'; // Default
      };
      const extension = getExtension(audioBlob.type);

      const formData = new FormData();
      formData.append('audio', audioBlob, `recording.${extension}`);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Transcription failed');
      }

      const data = await response.json();

      if (data.text && data.text.trim()) {
        onTranscript(data.text.trim());
      } else {
        setRecordingError('No speech detected. Please try again.');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setRecordingError(err instanceof Error ? err.message : 'Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  }, [onTranscript]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      cancelAnimationFrame(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // Start recording - browser will prompt for permission if needed
  const startRecording = useCallback(async () => {
    setRecordingError(null);
    audioChunksRef.current = [];

    try {
      // Request microphone - browser shows permission prompt if needed
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      streamRef.current = stream;

      // Set up media recorder with browser-compatible format
      // Safari doesn't support webm, so we need to check multiple formats
      const getMimeType = () => {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
        if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
        if (MediaRecorder.isTypeSupported('audio/mpeg')) return 'audio/mpeg';
        return ''; // Let browser choose default
      };
      const mimeType = getMimeType();
      audioMimeTypeRef.current = mimeType || 'audio/webm';
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Create audio blob with correct mime type and transcribe
        const audioBlob = new Blob(audioChunksRef.current, { type: audioMimeTypeRef.current });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingStartTimeRef.current = Date.now();

      // Smooth timer using requestAnimationFrame
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
        recordingTimerRef.current = requestAnimationFrame(updateTimer);
      };
      recordingTimerRef.current = requestAnimationFrame(updateTimer);

    } catch (err) {
      console.error('Error starting recording:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setRecordingError('Microphone access denied. Please allow access and try again.');
        } else if (err.name === 'NotFoundError') {
          setRecordingError('No microphone found. Please connect a microphone.');
        } else {
          setRecordingError(`Failed to start recording: ${err.message}`);
        }
      } else {
        setRecordingError('Failed to start recording. Please try again.');
      }
    }
  }, [transcribeAudio]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        cancelAnimationFrame(recordingTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    isTranscribing,
    recordingDuration,
    recordingError,
    startRecording,
    stopRecording,
  };
}
