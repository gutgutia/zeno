'use client';

import { useState, useCallback, useRef, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { parseData, getFileSheets, isDocumentType, type ExcelSheetInfo } from '@/lib/data/parser';
import { detectContentTypeQuick } from '@/lib/ai/content-detection';
import { estimateTokens, isContentTooLarge, MAX_TOKENS } from '@/types/dashboard';
import { SheetSelector } from '@/components/sheets/SheetSelector';
import { GoogleSheetPicker } from '@/components/sheets/GoogleSheetPicker';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { usePlan } from '@/lib/hooks';
import { useOrganization } from '@/lib/contexts/organization-context';
import type { ParsedData, DataSchema, ContentType } from '@/types/dashboard';
import type { DataSource } from '@/types/database';

type Step = 'input' | 'select-sheets' | 'select-google-sheets' | 'instructions' | 'generating' | 'error';

interface GoogleSpreadsheet {
  id: string;
  name: string;
  modifiedTime: string;
}

interface GoogleSheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
}

function NewDashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Plan features
  const { features } = usePlan();
  const canUseGoogleSheets = features.google_sheets;

  // Organization context - always use current org
  const { currentOrg } = useOrganization();

  // Check for Google connection callback
  const googleConnected = searchParams.get('google_connected');
  const googleError = searchParams.get('google_error');
  const googleEmail = searchParams.get('google_email');

  // Step state
  const [step, setStep] = useState<Step>('input');
  const [activeTab, setActiveTab] = useState<'paste' | 'upload' | 'google'>('paste');

  // Content state
  const [title, setTitle] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [schema, setSchema] = useState<DataSchema | null>(null);
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [contentType, setContentType] = useState<ContentType>('data');

  // Excel sheet selection state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelSheets, setExcelSheets] = useState<ExcelSheetInfo[]>([]);
  const [selectedExcelSheets, setSelectedExcelSheets] = useState<string[]>([]);

  // Google Sheets state
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [hasGoogleConnection, setHasGoogleConnection] = useState(false);
  const [isCheckingGoogle, setIsCheckingGoogle] = useState(false);
  const [selectedGoogleSpreadsheet, setSelectedGoogleSpreadsheet] = useState<GoogleSpreadsheet | null>(null);
  const [googleSheets, setGoogleSheets] = useState<GoogleSheetInfo[]>([]);
  const [selectedGoogleSheets, setSelectedGoogleSheets] = useState<string[]>([]);

  // Instructions state
  const [instructions, setInstructions] = useState('');
  const [enableSync, setEnableSync] = useState(true);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);
  const cursorPositionRef = useRef<number>(0);

  // Voice recording state (inline, no modal)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioMimeTypeRef = useRef<string>('audio/webm');
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Upgrade modal state
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [creditsInfo, setCreditsInfo] = useState<{ needed: number; available: number } | null>(null);

  // Content summary collapsed state
  const [contentSummaryOpen, setContentSummaryOpen] = useState(false);

  // Token estimation
  const tokenCount = useMemo(() => estimateTokens(rawContent), [rawContent]);
  const isTooLarge = useMemo(() => isContentTooLarge(rawContent), [rawContent]);

  // Load workspace and check Google connection on mount
  useEffect(() => {
    loadWorkspace();
  }, []);

  // Handle Google connection callback
  useEffect(() => {
    if (googleConnected === 'true') {
      setHasGoogleConnection(true);
      setActiveTab('google');
      // Clear URL params
      window.history.replaceState({}, '', '/dashboards/new');
    }
    if (googleError) {
      setError(googleError);
      window.history.replaceState({}, '', '/dashboards/new');
    }
  }, [googleConnected, googleError]);

  const loadWorkspace = async () => {
    try {
      // Get user's default workspace
      const response = await fetch('/api/workspaces');
      if (response.ok) {
        const { workspaces } = await response.json();
        if (workspaces && workspaces.length > 0) {
          setWorkspaceId(workspaces[0].id);
          checkGoogleConnection(workspaces[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load workspace:', err);
    }
  };

  const checkGoogleConnection = async (wsId: string) => {
    setIsCheckingGoogle(true);
    try {
      const response = await fetch(`/api/google/spreadsheets?workspace_id=${wsId}`);
      setHasGoogleConnection(response.ok);
    } catch {
      setHasGoogleConnection(false);
    } finally {
      setIsCheckingGoogle(false);
    }
  };

  const handleConnectGoogle = async () => {
    if (!workspaceId) return;

    try {
      const response = await fetch(`/api/auth/google?workspace_id=${workspaceId}&return_url=/dashboards/new`);
      if (response.ok) {
        const { authUrl } = await response.json();
        window.location.href = authUrl;
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to start Google authorization');
      }
    } catch (err) {
      setError('Failed to connect to Google');
    }
  };

  const handlePasteData = useCallback(async () => {
    if (!rawContent.trim()) {
      setError('Please paste some content');
      return;
    }

    if (isTooLarge) {
      setError(`Content is too large (${tokenCount.toLocaleString()} tokens). Maximum is ${MAX_TOKENS.toLocaleString()} tokens (~800K characters).`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const detectedType = detectContentTypeQuick(rawContent);
      setContentType(detectedType);

      if (detectedType === 'data' || detectedType === 'mixed') {
        try {
          const result = await parseData(rawContent);
          if (result.data.rows.length > 0) {
            setParsedData(result.data);
            setSchema(result.schema);
          }
        } catch {
          console.log('Data parsing failed, will use raw content');
        }
      }

      setDataSource({ type: 'paste' });
      setStep('instructions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process content');
    } finally {
      setIsLoading(false);
    }
  }, [rawContent, isTooLarge, tokenCount]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';

      // Handle document types (PDF, DOCX, PPTX, etc.) via API
      if (isDocumentType(extension)) {
        // Send file to server for parsing
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to parse document.');
          setIsLoading(false);
          return;
        }

        const result = await response.json();

        if (isContentTooLarge(result.text)) {
          setError(`Document is too large (${estimateTokens(result.text).toLocaleString()} tokens). Maximum is ${MAX_TOKENS.toLocaleString()} tokens.`);
          setIsLoading(false);
          return;
        }

        setRawContent(result.text);
        setContentType('text');
        setParsedData(null); // Documents are not tabular
        setSchema(null);
        setDataSource({
          type: 'upload',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });

        if (!title) {
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
          setTitle(nameWithoutExt);
        }

        setStep('instructions');
        setIsLoading(false);
        return;
      }

      // For Excel files, check if there are multiple sheets
      if (extension === 'xlsx' || extension === 'xls') {
        const sheets = await getFileSheets(file);

        if (sheets && sheets.length > 1) {
          // Multiple sheets - show sheet selector
          setExcelFile(file);
          setExcelSheets(sheets);
          setSelectedExcelSheets(sheets.map(s => s.name)); // Select all by default
          setStep('select-sheets');
          setIsLoading(false);
          return;
        }

        // Single sheet - parse directly
        const result = await parseData(file);
        if (result.data.rows.length === 0) {
          setError('No data found in the file.');
          setIsLoading(false);
          return;
        }

        const fileContent = result.data.columns.join('\t') + '\n' +
          result.data.rows.map(row =>
            result.data.columns.map(col => String(row[col] ?? '')).join('\t')
          ).join('\n');

        setRawContent(fileContent);
        setParsedData(result.data);
        setSchema(result.schema);
        setContentType('data');
        setDataSource({
          type: 'upload',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          selectedSheets: sheets ? [sheets[0].name] : undefined,
          availableSheets: sheets?.map(s => s.name),
        });
      } else {
        // Text file (CSV, TSV, TXT, MD, JSON)
        const fileContent = await file.text();

        if (isContentTooLarge(fileContent)) {
          setError(`File is too large (${estimateTokens(fileContent).toLocaleString()} tokens). Maximum is ${MAX_TOKENS.toLocaleString()} tokens.`);
          setIsLoading(false);
          return;
        }

        const detectedType = detectContentTypeQuick(fileContent);
        setContentType(detectedType);

        if (detectedType === 'data' || detectedType === 'mixed') {
          try {
            const result = await parseData(fileContent);
            if (result.data.rows.length > 0) {
              setParsedData(result.data);
              setSchema(result.schema);
            }
          } catch {
            console.log('Data parsing failed, will use raw content');
          }
        }

        setRawContent(fileContent);
        setDataSource({
          type: 'upload',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });
      }

      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }

      setStep('instructions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setIsLoading(false);
    }
  }, [title]);

  const handleExcelSheetsConfirm = async () => {
    if (!excelFile || selectedExcelSheets.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await parseData(excelFile, { selectedSheets: selectedExcelSheets });

      if (result.data.rows.length === 0) {
        setError('No data found in the selected sheets.');
        setIsLoading(false);
        return;
      }

      const fileContent = result.data.columns.join('\t') + '\n' +
        result.data.rows.map(row =>
          result.data.columns.map(col => String(row[col] ?? '')).join('\t')
        ).join('\n');

      setRawContent(fileContent);
      setParsedData(result.data);
      setSchema(result.schema);
      setContentType('data');
      setDataSource({
        type: 'upload',
        fileName: excelFile.name,
        fileSize: excelFile.size,
        fileType: excelFile.type,
        selectedSheets: selectedExcelSheets,
        availableSheets: excelSheets.map(s => s.name),
      });

      if (!title) {
        const nameWithoutExt = excelFile.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }

      setStep('instructions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse selected sheets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSpreadsheetSelect = async (spreadsheet: GoogleSpreadsheet) => {
    setSelectedGoogleSpreadsheet(spreadsheet);
    setIsLoading(true);
    setError(null);

    try {
      // Fetch sheets from the spreadsheet
      const response = await fetch(
        `/api/google/spreadsheets/${spreadsheet.id}/sheets?workspace_id=${workspaceId}`
      );

      if (!response.ok) {
        throw new Error('Failed to load sheets');
      }

      const data = await response.json();
      setGoogleSheets(data.sheets);

      if (data.sheets.length > 1) {
        // Multiple sheets - show selector
        setSelectedGoogleSheets(data.sheets.map((s: GoogleSheetInfo) => s.name));
        setStep('select-google-sheets');
      } else {
        // Single sheet - fetch data directly
        await fetchGoogleSheetData(spreadsheet, data.sheets.map((s: GoogleSheetInfo) => s.name));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spreadsheet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSheetsConfirm = async () => {
    if (!selectedGoogleSpreadsheet || selectedGoogleSheets.length === 0) return;
    await fetchGoogleSheetData(selectedGoogleSpreadsheet, selectedGoogleSheets);
  };

  const fetchGoogleSheetData = async (spreadsheet: GoogleSpreadsheet, sheets: string[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/google/spreadsheets/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          spreadsheet_id: spreadsheet.id,
          sheets: sheets,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch spreadsheet data');
      }

      const { data, metadata } = await response.json();

      setRawContent(data);
      setContentType('data');

      // Parse the fetched data
      try {
        const result = await parseData(data);
        if (result.data.rows.length > 0) {
          setParsedData(result.data);
          setSchema(result.schema);
        }
      } catch {
        console.log('Data parsing failed');
      }

      setDataSource({
        type: 'google_sheets',
        spreadsheetId: spreadsheet.id,
        spreadsheetName: spreadsheet.name,
        selectedSheets: sheets,
        availableSheets: googleSheets.map(s => s.name),
      });

      if (!title) {
        setTitle(spreadsheet.name);
      }

      setStep('instructions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch spreadsheet data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDashboard = async () => {
    if (!rawContent.trim() && !parsedData) return;

    const dashboardTitle = title.trim() || 'Untitled Dashboard';
    setIsLoading(true);
    setError(null);
    setStep('generating');

    try {
      const response = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: dashboardTitle,
          rawContent,
          data: parsedData?.rows || null,
          dataSource,
          userInstructions: instructions || null,
          notifyEmail: true, // Always send email notification when ready
          // Google Sheets specific
          googleSheetId: dataSource?.type === 'google_sheets' ? dataSource.spreadsheetId : null,
          googleSheetName: dataSource?.type === 'google_sheets' && dataSource.selectedSheets
            ? dataSource.selectedSheets.join(', ')
            : null,
          syncEnabled: dataSource?.type === 'google_sheets' ? enableSync : false,
          // Organization assignment - use current org
          organizationId: currentOrg?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle insufficient credits (402)
        if (response.status === 402) {
          setCreditsInfo({
            needed: data.credits_required || 25,
            available: data.credits_available || 0,
          });
          setUpgradeModalOpen(true);
          setIsLoading(false);
          setStep('instructions'); // Go back to instructions step
          return;
        }
        throw new Error(data.error || 'Failed to create dashboard');
      }

      router.push(`/dashboards/${data.dashboard.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dashboard');
      setStep('error');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'select-sheets') {
      setStep('input');
      setExcelFile(null);
      setExcelSheets([]);
    } else if (step === 'select-google-sheets') {
      setSelectedGoogleSpreadsheet(null);
      setGoogleSheets([]);
      setStep('input');
      setActiveTab('google');
    } else if (step === 'instructions') {
      setStep('input');
    } else {
      setStep('input');
      setParsedData(null);
      setSchema(null);
      setError(null);
    }
  };

  // Insert transcript at cursor position
  const insertTranscript = useCallback((transcript: string) => {
    const cursorPos = cursorPositionRef.current;
    const before = instructions.slice(0, cursorPos);
    const after = instructions.slice(cursorPos);

    // Add space before transcript if there's text before and it doesn't end with space
    const needsSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
    // Add space after transcript if there's text after and it doesn't start with space
    const needsSpaceAfter = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n');

    const newText = before +
      (needsSpaceBefore ? ' ' : '') +
      transcript +
      (needsSpaceAfter ? ' ' : '') +
      after;

    setInstructions(newText);

    // Update cursor position to end of inserted text
    const newCursorPos = cursorPos + (needsSpaceBefore ? 1 : 0) + transcript.length + (needsSpaceAfter ? 1 : 0);
    cursorPositionRef.current = newCursorPos;

    // Focus textarea and set cursor position after state update
    setTimeout(() => {
      if (instructionsRef.current) {
        instructionsRef.current.focus();
        instructionsRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [instructions]);

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
        insertTranscript(data.text.trim());
      } else {
        setRecordingError('No speech detected. Please try again.');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setRecordingError(err instanceof Error ? err.message : 'Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  }, [insertTranscript]);

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
    // Save cursor position
    if (instructionsRef.current) {
      cursorPositionRef.current = instructionsRef.current.selectionStart;
    } else {
      cursorPositionRef.current = instructions.length;
    }

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
  }, [instructions.length, transcribeAudio]);

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

  const getContentTypeLabel = (type: ContentType) => {
    switch (type) {
      case 'data': return 'Structured Data';
      case 'text': return 'Text Document';
      case 'mixed': return 'Mixed Content';
    }
  };

  const getContentTypeDescription = (type: ContentType) => {
    switch (type) {
      case 'data': return 'Tables, spreadsheets, CSV data';
      case 'text': return 'Documents, proposals, reports';
      case 'mixed': return 'Combination of data and text';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboards"
          className="text-sm text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)] mb-4 inline-block"
        >
          ← Back to Dashboards
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">
          Create New Dashboard
        </h1>
        <p className="text-[var(--color-gray-600)] mt-1">
          Paste any content and we&apos;ll create a beautiful page for you
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 ${['input', 'select-sheets', 'select-google-sheets'].includes(step) ? 'text-[var(--color-primary)]' : 'text-[var(--color-gray-400)]'}`}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${['input', 'select-sheets', 'select-google-sheets'].includes(step) ? 'bg-[var(--color-primary)] text-white' : step === 'instructions' || step === 'generating' ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'bg-[var(--color-gray-200)]'}`}>1</span>
            <span className="hidden sm:inline font-medium">Add Content</span>
          </div>
          <div className="flex-1 h-px bg-[var(--color-gray-200)]" />
          <div className={`flex items-center gap-2 ${step === 'instructions' ? 'text-[var(--color-primary)]' : 'text-[var(--color-gray-400)]'}`}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'instructions' ? 'bg-[var(--color-primary)] text-white' : step === 'generating' ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'bg-[var(--color-gray-200)]'}`}>2</span>
            <span className="hidden sm:inline font-medium">Instructions</span>
          </div>
          <div className="flex-1 h-px bg-[var(--color-gray-200)]" />
          <div className={`flex items-center gap-2 ${step === 'generating' ? 'text-[var(--color-primary)]' : 'text-[var(--color-gray-400)]'}`}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'generating' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-gray-200)]'}`}>3</span>
            <span className="hidden sm:inline font-medium">Generate</span>
          </div>
        </div>
      </div>

      {/* Step 1: Input */}
      {step === 'input' && (
        <>
          {/* Title Input */}
          <div className="mb-6">
            <Label htmlFor="title">Dashboard Title (optional)</Label>
            <Input
              id="title"
              type="text"
              placeholder="My Dashboard"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
              <TabsList className="w-full justify-start border-b border-[var(--color-gray-200)] rounded-none bg-transparent p-0">
                <TabsTrigger
                  value="paste"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--color-primary)] data-[state=active]:bg-transparent px-6 py-3"
                >
                  Paste Content
                </TabsTrigger>
                <TabsTrigger
                  value="upload"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--color-primary)] data-[state=active]:bg-transparent px-6 py-3"
                >
                  Upload File
                </TabsTrigger>
                <TabsTrigger
                  value="google"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--color-primary)] data-[state=active]:bg-transparent px-6 py-3 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h2v2H7zm0 4h2v2H7zm0 4h2v2H7zm4-8h6v2h-6zm0 4h6v2h-6zm0 4h6v2h-6z"/>
                  </svg>
                  Google Sheets
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="p-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="data">Paste your content</Label>
                    <p className="text-sm text-[var(--color-gray-500)] mb-2">
                      Data (CSV, JSON), text documents, proposals, reports - anything you want to beautify
                    </p>
                    <textarea
                      id="data"
                      className="w-full h-64 mt-1.5 p-3 border border-[var(--color-gray-300)] rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                      placeholder={`Paste anything here:

• Spreadsheet data (CSV, TSV)
• JSON data
• Text documents or reports
• Customer proposals
• Meeting notes
• Any content you want to present beautifully`}
                      value={rawContent}
                      onChange={(e) => setRawContent(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className={isTooLarge ? 'text-[var(--color-error)]' : 'text-[var(--color-gray-500)]'}>
                      {tokenCount.toLocaleString()} / {MAX_TOKENS.toLocaleString()} tokens
                    </span>
                    {rawContent && (
                      <span className="text-[var(--color-gray-500)]">
                        Detected: {getContentTypeLabel(detectContentTypeQuick(rawContent))}
                      </span>
                    )}
                  </div>

                  {error && (
                    <p className="text-sm text-[var(--color-error)]">{error}</p>
                  )}

                  <Button
                    onClick={handlePasteData}
                    disabled={isLoading || !rawContent.trim() || isTooLarge}
                    className="w-full sm:w-auto"
                  >
                    {isLoading ? 'Processing...' : 'Continue'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="p-6">
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-[var(--color-gray-300)] rounded-lg p-8 text-center hover:border-[var(--color-primary)] transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg
                      className="w-12 h-12 text-[var(--color-gray-400)] mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="text-[var(--color-gray-600)] mb-2">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-[var(--color-gray-500)]">
                      CSV, Excel, PDF, Word, PowerPoint, and more
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.tsv,.txt,.xls,.xlsx,.md,.json,.pdf,.docx,.doc,.pptx,.ppt,.odt,.odp,.ods,.rtf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-[var(--color-error)]">{error}</p>
                  )}
                  {isLoading && (
                    <p className="text-sm text-[var(--color-gray-600)]">
                      Processing file...
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="google" className="p-6">
                {isCheckingGoogle ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--color-gray-600)]">Checking Google connection...</p>
                  </div>
                ) : !hasGoogleConnection ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-[#4285F4]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
                      Connect Google Sheets
                    </h3>
                    <p className="text-[var(--color-gray-600)] mb-6 max-w-md mx-auto">
                      Link your Google account to import data directly from Google Sheets.
                      Your dashboard can automatically sync when the sheet is updated.
                    </p>
                    <Button onClick={handleConnectGoogle} className="inline-flex items-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Connect Google Account
                    </Button>
                  </div>
                ) : !canUseGoogleSheets ? (
                  // Connected but doesn't have Google Sheets feature - show upgrade prompt
                  <div className="py-4">
                    <div className="flex items-center gap-2 mb-4 text-sm text-green-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Google account connected
                    </div>
                    <UpgradePrompt
                      title="Google Sheets Integration"
                      description="Import data directly from Google Sheets and keep your dashboards automatically synced. Upgrade to Pro to unlock this feature."
                      requiredPlan="pro"
                    />
                  </div>
                ) : (
                  <GoogleSheetPicker
                    workspaceId={workspaceId!}
                    onSelect={handleGoogleSpreadsheetSelect}
                    onCancel={() => setActiveTab('paste')}
                  />
                )}
                {error && (
                  <p className="text-sm text-[var(--color-error)] mt-4">{error}</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}

      {/* Excel Sheet Selection */}
      {step === 'select-sheets' && (
        <SheetSelector
          sheets={excelSheets}
          selectedSheets={selectedExcelSheets}
          onSelectionChange={setSelectedExcelSheets}
          onConfirm={handleExcelSheetsConfirm}
          onCancel={handleBack}
          title="Select Excel Sheets"
          description="This file contains multiple sheets. Select which ones to include in your dashboard."
        />
      )}

      {/* Google Sheet Tab Selection */}
      {step === 'select-google-sheets' && (
        <SheetSelector
          sheets={googleSheets}
          selectedSheets={selectedGoogleSheets}
          onSelectionChange={setSelectedGoogleSheets}
          onConfirm={handleGoogleSheetsConfirm}
          onCancel={handleBack}
          title={`Select sheets from "${selectedGoogleSpreadsheet?.name}"`}
          description="This spreadsheet contains multiple sheets. Select which ones to include in your dashboard."
        />
      )}

      {/* Step 2: Instructions */}
      {step === 'instructions' && (
        <div className="space-y-6">
          {/* Instructions Input - Primary focus */}
          <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
              Instructions (Optional)
            </h2>
            <p className="text-sm text-[var(--color-gray-500)] mb-4">
              Tell us what you&apos;d like to see. Leave blank and we&apos;ll create something great automatically.
            </p>

            {/* Recording/Transcribing UI replaces textarea */}
            {isRecording || isTranscribing ? (
              <div className="min-h-[120px] border border-[var(--color-gray-200)] rounded-md bg-[var(--color-gray-50)] flex flex-col items-center justify-center py-8">
                {isTranscribing ? (
                  <>
                    {/* Transcribing state */}
                    <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-[var(--color-gray-600)] text-sm">Transcribing...</p>
                  </>
                ) : (
                  <>
                    {/* Recording state - pulsing mic */}
                    <div className="relative mb-4">
                      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                        <div className="absolute w-16 h-16 rounded-full bg-red-100 animate-ping opacity-75" />
                        <svg className="w-8 h-8 text-red-500 relative z-10" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-[var(--color-gray-700)] font-medium mb-1">Listening...</p>
                    <p className="text-[var(--color-gray-500)] text-2xl font-mono tabular-nums mb-4">
                      {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                    </p>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                      Stop Recording
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="relative">
                <Textarea
                  ref={instructionsRef}
                  placeholder="Examples:
• Show me customer status breakdown by owner
• Create a professional summary with key metrics
• Highlight the most important trends
• Make it look like an executive report"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  onSelect={(e) => {
                    cursorPositionRef.current = (e.target as HTMLTextAreaElement).selectionStart;
                  }}
                  className="min-h-[120px] pb-12"
                  autoFocus
                />
                {/* Voice input button - bottom right */}
                <button
                  type="button"
                  onClick={startRecording}
                  className="absolute right-2 bottom-2 p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Click to speak your instructions"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* Recording error message */}
            {recordingError && (
              <p className="text-red-500 text-sm mt-2">{recordingError}</p>
            )}
          </div>

          {/* Content Summary - Collapsible */}
          <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setContentSummaryOpen(!contentSummaryOpen)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--color-gray-50)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-[var(--color-gray-900)]">
                  Content Summary
                </h2>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 bg-[var(--color-primary-light)] rounded text-xs text-[var(--color-primary)] font-medium">
                    {getContentTypeLabel(contentType)}
                  </span>
                  {schema && (
                    <span className="px-2 py-0.5 bg-[var(--color-gray-100)] rounded text-xs font-medium">
                      {schema.rowCount} rows × {schema.columns.length} cols
                    </span>
                  )}
                  {dataSource?.type === 'google_sheets' && (
                    <span className="px-2 py-0.5 bg-green-50 rounded text-xs text-green-700 font-medium">
                      Google Sheets
                    </span>
                  )}
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-[var(--color-gray-400)] transition-transform ${contentSummaryOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {contentSummaryOpen && (
              <div className="px-6 pb-6 border-t border-[var(--color-gray-100)]">
                <div className="flex flex-wrap gap-4 mt-4 mb-4">
                  <div className="px-4 py-2 bg-[var(--color-primary-light)] rounded-lg">
                    <span className="text-sm text-[var(--color-primary)] font-medium">
                      {getContentTypeLabel(contentType)}
                    </span>
                    <p className="text-xs text-[var(--color-gray-500)] mt-0.5">
                      {getContentTypeDescription(contentType)}
                    </p>
                  </div>

                  {dataSource?.selectedSheets && dataSource.selectedSheets.length > 0 && (
                    <div className="px-4 py-2 bg-[var(--color-gray-100)] rounded-lg">
                      <span className="text-sm font-medium">
                        {dataSource.selectedSheets.length} sheet{dataSource.selectedSheets.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}

                  {schema && (
                    <>
                      <div className="px-4 py-2 bg-[var(--color-gray-100)] rounded-lg">
                        <span className="text-sm font-medium">{schema.rowCount} rows</span>
                      </div>
                      <div className="px-4 py-2 bg-[var(--color-gray-100)] rounded-lg">
                        <span className="text-sm font-medium">{schema.columns.length} columns</span>
                      </div>
                    </>
                  )}
                  <div className="px-4 py-2 bg-[var(--color-gray-100)] rounded-lg">
                    <span className="text-sm font-medium">{tokenCount.toLocaleString()} tokens</span>
                  </div>
                </div>

                {/* Data Preview */}
                {schema && parsedData && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-[var(--color-gray-700)] mb-2">
                      Detected Columns
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {schema.columns.map((col) => (
                        <span
                          key={col.name}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--color-gray-100)] rounded-full text-sm"
                        >
                          <span className="font-medium">{col.name}</span>
                          <span className="text-[var(--color-gray-500)]">({col.type})</span>
                        </span>
                      ))}
                    </div>

                    <h3 className="text-sm font-medium text-[var(--color-gray-700)] mb-2">
                      Sample Data
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-gray-200)]">
                            {parsedData.columns.slice(0, 6).map((col) => (
                              <th
                                key={col}
                                className="text-left py-2 px-3 font-medium text-[var(--color-gray-700)] bg-[var(--color-gray-50)]"
                              >
                                {col}
                              </th>
                            ))}
                            {parsedData.columns.length > 6 && (
                              <th className="text-left py-2 px-3 font-medium text-[var(--color-gray-500)] bg-[var(--color-gray-50)]">
                                +{parsedData.columns.length - 6} more
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {schema.sampleRows.slice(0, 3).map((row, i) => (
                            <tr key={i} className="border-b border-[var(--color-gray-100)]">
                              {parsedData.columns.slice(0, 6).map((col) => (
                                <td key={col} className="py-2 px-3 text-[var(--color-gray-600)]">
                                  {String(row[col] ?? '')}
                                </td>
                              ))}
                              {parsedData.columns.length > 6 && (
                                <td className="py-2 px-3 text-[var(--color-gray-400)]">...</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {contentType === 'text' && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-[var(--color-gray-700)] mb-2">
                      Content Preview
                    </h3>
                    <div className="bg-[var(--color-gray-50)] rounded-lg p-4 text-sm text-[var(--color-gray-600)] max-h-32 overflow-y-auto">
                      {rawContent.slice(0, 500)}
                      {rawContent.length > 500 && '...'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Options - only show for Google Sheets */}
          {dataSource?.type === 'google_sheets' && (
            <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSync}
                  onChange={(e) => setEnableSync(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-[var(--color-gray-300)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <div>
                  <span className="font-medium text-[var(--color-gray-900)]">
                    Enable automatic sync
                  </span>
                  <p className="text-sm text-[var(--color-gray-500)] mt-0.5">
                    Automatically update your dashboard when the Google Sheet changes (checked daily).
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleBack}>
              ← Back
            </Button>
            <Button onClick={handleCreateDashboard} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Generate Dashboard'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Generating */}
      {step === 'generating' && (
        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-12 text-center">
          <div className="w-16 h-16 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
            Creating Your Dashboard
          </h2>
          <p className="text-[var(--color-gray-600)] mb-4">
            Our AI is analyzing your content and designing a beautiful page...
          </p>
          <p className="text-sm text-[var(--color-gray-500)]">
            We&apos;ll email you when it&apos;s ready. Feel free to close this page.
          </p>
        </div>
      )}

      {/* Error State */}
      {step === 'error' && (
        <div className="bg-white rounded-xl border border-[var(--color-error)] shadow-sm p-6 text-center">
          <div className="w-12 h-12 bg-[var(--color-error)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-[var(--color-error)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
            Something went wrong
          </h2>
          <p className="text-[var(--color-gray-600)] mb-4">{error}</p>
          <Button variant="outline" onClick={handleBack}>
            Try Again
          </Button>
        </div>
      )}

      {/* Upgrade Modal for insufficient credits */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        reason="credits"
        creditsNeeded={creditsInfo?.needed}
        creditsAvailable={creditsInfo?.available}
      />
    </div>
  );
}

export default function NewDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-gray-50)] p-6 flex items-center justify-center">
        <div className="animate-pulse text-[var(--color-gray-500)]">Loading...</div>
      </div>
    }>
      <NewDashboardPageContent />
    </Suspense>
  );
}
