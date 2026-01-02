'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { parseData } from '@/lib/data/parser';
import { detectContentTypeQuick } from '@/lib/ai/content-detection';
import { estimateTokens, isContentTooLarge, MAX_TOKENS } from '@/types/dashboard';
import type { ParsedData, DataSchema, ContentType } from '@/types/dashboard';
import type { DataSource } from '@/types/database';

type Step = 'input' | 'instructions' | 'generating' | 'error';

export default function NewDashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step state
  const [step, setStep] = useState<Step>('input');

  // Content state
  const [title, setTitle] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [schema, setSchema] = useState<DataSchema | null>(null);
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [contentType, setContentType] = useState<ContentType>('data');

  // Instructions state
  const [instructions, setInstructions] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Token estimation
  const tokenCount = useMemo(() => estimateTokens(rawContent), [rawContent]);
  const isTooLarge = useMemo(() => isContentTooLarge(rawContent), [rawContent]);

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
      // Detect content type
      const detectedType = detectContentTypeQuick(rawContent);
      setContentType(detectedType);

      // For data content, try to parse it
      if (detectedType === 'data' || detectedType === 'mixed') {
        try {
          const result = await parseData(rawContent);
          if (result.data.rows.length > 0) {
            setParsedData(result.data);
            setSchema(result.schema);
          }
        } catch {
          // Parsing failed, but that's okay - we'll send raw content to AI
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
      // Read file content
      let fileContent: string;
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'xlsx' || extension === 'xls') {
        // For Excel files, parse and convert to string representation
        const result = await parseData(file);
        if (result.data.rows.length === 0) {
          setError('No data found in the file.');
          setIsLoading(false);
          return;
        }
        // Convert parsed data to string for raw content
        fileContent = result.data.columns.join('\t') + '\n' +
          result.data.rows.map(row =>
            result.data.columns.map(col => String(row[col] ?? '')).join('\t')
          ).join('\n');
        setParsedData(result.data);
        setSchema(result.schema);
        setContentType('data');
      } else {
        // For text files, read as string
        fileContent = await file.text();

        if (isContentTooLarge(fileContent)) {
          setError(`File is too large (${estimateTokens(fileContent).toLocaleString()} tokens). Maximum is ${MAX_TOKENS.toLocaleString()} tokens.`);
          setIsLoading(false);
          return;
        }

        const detectedType = detectContentTypeQuick(fileContent);
        setContentType(detectedType);

        // Try to parse if it looks like data
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
      }

      setRawContent(fileContent);
      setDataSource({
        type: 'upload',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      // Auto-set title from filename if not set
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

  const handleCreateDashboard = async () => {
    if (!rawContent.trim() && !parsedData) return;

    const dashboardTitle = title.trim() || 'Untitled Dashboard';
    setIsLoading(true);
    setError(null);
    setStep('generating');

    try {
      // Create the dashboard and trigger async generation
      const response = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: dashboardTitle,
          rawContent,
          data: parsedData?.rows || null,
          dataSource,
          userInstructions: instructions || null,
          notifyEmail,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create dashboard');
      }

      const { dashboard } = await response.json();

      // Redirect to the dashboard page (it will show generating state)
      router.push(`/dashboards/${dashboard.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dashboard');
      setStep('error');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'instructions') {
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
          <div className={`flex items-center gap-2 ${step === 'input' ? 'text-[var(--color-primary)]' : 'text-[var(--color-gray-400)]'}`}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'input' ? 'bg-[var(--color-primary)] text-white' : step === 'instructions' || step === 'generating' ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'bg-[var(--color-gray-200)]'}`}>1</span>
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
            <Tabs defaultValue="paste" className="w-full">
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

                  {/* Token count indicator */}
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
            </Tabs>
          </div>
        </>
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

            {/* Data Preview for structured data */}
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

            {/* Text preview for text content */}
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

          {/* Email Notification Option */}
          <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-[var(--color-gray-300)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <div>
                <span className="font-medium text-[var(--color-gray-900)]">
                  Email me when ready
                </span>
                <p className="text-sm text-[var(--color-gray-500)] mt-0.5">
                  Generation may take a minute. We&apos;ll send you an email when your dashboard is ready.
                </p>
              </div>
            </label>
          </div>

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
            {notifyEmail
              ? "We'll email you when it's ready. Feel free to close this page."
              : "This may take a minute. Please wait..."}
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
