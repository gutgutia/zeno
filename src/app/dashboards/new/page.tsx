'use client';

import { useState, useCallback, useRef, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { parseData, getFileSheets, type ExcelSheetInfo } from '@/lib/data/parser';
import { detectContentTypeQuick } from '@/lib/ai/content-detection';
import { estimateTokens, isContentTooLarge, MAX_TOKENS } from '@/types/dashboard';
import { SheetSelector } from '@/components/sheets/SheetSelector';
import { GoogleSheetPicker } from '@/components/sheets/GoogleSheetPicker';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';
import { usePlan } from '@/lib/hooks';
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

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      const extension = file.name.split('.').pop()?.toLowerCase();

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
        // Text file
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
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create dashboard');
      }

      const { dashboard } = await response.json();
      router.push(`/dashboards/${dashboard.id}`);
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
                      CSV, TSV, TXT, XLS, XLSX, MD, or any text file
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.tsv,.txt,.xls,.xlsx,.md,.json"
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
          {/* Content Summary */}
          <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">
              Content Summary
            </h2>

            <div className="flex flex-wrap gap-4 mb-4">
              <div className="px-4 py-2 bg-[var(--color-primary-light)] rounded-lg">
                <span className="text-sm text-[var(--color-primary)] font-medium">
                  {getContentTypeLabel(contentType)}
                </span>
                <p className="text-xs text-[var(--color-gray-500)] mt-0.5">
                  {getContentTypeDescription(contentType)}
                </p>
              </div>

              {/* Data source indicator */}
              {dataSource?.type === 'google_sheets' && (
                <div className="px-4 py-2 bg-green-50 rounded-lg flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
                  </svg>
                  <span className="text-sm text-green-700 font-medium">Google Sheets</span>
                </div>
              )}

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

          {/* Instructions Input */}
          <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
              Instructions (Optional)
            </h2>
            <p className="text-sm text-[var(--color-gray-500)] mb-4">
              Tell us what you&apos;d like to see. Leave blank and we&apos;ll create something great automatically.
            </p>

            <Textarea
              placeholder="Examples:
• Show me customer status breakdown by owner
• Create a professional summary with key metrics
• Highlight the most important trends
• Make it look like a executive report"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="min-h-[120px]"
            />
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
