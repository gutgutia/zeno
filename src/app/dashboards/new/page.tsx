'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseData } from '@/lib/data/parser';
import type { ParsedData, DataSchema } from '@/types/dashboard';
import type { DataSource } from '@/types/database';

type Step = 'input' | 'preview' | 'generating' | 'error';

export default function NewDashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('input');
  const [title, setTitle] = useState('');
  const [pastedData, setPastedData] = useState('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [schema, setSchema] = useState<DataSchema | null>(null);
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePasteData = useCallback(async () => {
    if (!pastedData.trim()) {
      setError('Please paste some data');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await parseData(pastedData);

      if (result.data.rows.length === 0) {
        setError('No data rows found. Please check your data format.');
        setIsLoading(false);
        return;
      }

      setParsedData(result.data);
      setSchema(result.schema);
      setDataSource({ type: 'paste' });
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse data');
    } finally {
      setIsLoading(false);
    }
  }, [pastedData]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await parseData(file);

      if (result.data.rows.length === 0) {
        setError('No data rows found in the file.');
        setIsLoading(false);
        return;
      }

      setParsedData(result.data);
      setSchema(result.schema);
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

      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsLoading(false);
    }
  }, [title]);

  const handleCreateDashboard = async () => {
    if (!parsedData || !dataSource) return;

    const dashboardTitle = title.trim() || 'Untitled Dashboard';
    setIsLoading(true);
    setError(null);
    setStep('generating');

    try {
      // First, create the dashboard with the data
      const response = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: dashboardTitle,
          data: parsedData.rows,
          dataSource,
          config: { charts: [] },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create dashboard');
      }

      const { dashboard } = await response.json();

      // Now generate the dashboard with AI
      const generateResponse = await fetch(`/api/dashboards/${dashboard.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema }),
      });

      if (!generateResponse.ok) {
        // Dashboard created but AI generation failed - still redirect
        console.error('AI generation failed, redirecting to dashboard anyway');
      }

      // Redirect to the dashboard editor
      router.push(`/dashboards/${dashboard.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dashboard');
      setStep('error');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('input');
    setParsedData(null);
    setSchema(null);
    setError(null);
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
          Paste your data or upload a file to get started
        </p>
      </div>

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

      {step === 'input' && (
        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm">
          <Tabs defaultValue="paste" className="w-full">
            <TabsList className="w-full justify-start border-b border-[var(--color-gray-200)] rounded-none bg-transparent p-0">
              <TabsTrigger
                value="paste"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--color-primary)] data-[state=active]:bg-transparent px-6 py-3"
              >
                Paste Data
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
                  <Label htmlFor="data">Paste your CSV or TSV data</Label>
                  <textarea
                    id="data"
                    className="w-full h-64 mt-1.5 p-3 border border-[var(--color-gray-300)] rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                    placeholder={`name,value,date
Product A,100,2024-01-01
Product B,250,2024-01-02
Product C,180,2024-01-03`}
                    value={pastedData}
                    onChange={(e) => setPastedData(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="text-sm text-[var(--color-error)]">{error}</p>
                )}
                <Button
                  onClick={handlePasteData}
                  disabled={isLoading || !pastedData.trim()}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? 'Parsing...' : 'Continue'}
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
                    CSV, TSV, XLS, or XLSX (max 10MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt,.xls,.xlsx"
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
      )}

      {step === 'preview' && parsedData && schema && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">
              Data Preview
            </h2>

            {/* Stats */}
            <div className="flex gap-6 mb-6 text-sm">
              <div>
                <span className="text-[var(--color-gray-500)]">Rows:</span>{' '}
                <span className="font-medium">{schema.rowCount}</span>
              </div>
              <div>
                <span className="text-[var(--color-gray-500)]">Columns:</span>{' '}
                <span className="font-medium">{schema.columns.length}</span>
              </div>
            </div>

            {/* Column Info */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[var(--color-gray-700)] mb-2">
                Detected Columns
              </h3>
              <div className="flex flex-wrap gap-2">
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
            </div>

            {/* Sample Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-gray-200)]">
                    {parsedData.columns.map((col) => (
                      <th
                        key={col}
                        className="text-left py-2 px-3 font-medium text-[var(--color-gray-700)] bg-[var(--color-gray-50)]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schema.sampleRows.map((row, i) => (
                    <tr key={i} className="border-b border-[var(--color-gray-100)]">
                      {parsedData.columns.map((col) => (
                        <td key={col} className="py-2 px-3 text-[var(--color-gray-600)]">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {schema.rowCount > 5 && (
              <p className="text-sm text-[var(--color-gray-500)] mt-2">
                Showing 5 of {schema.rowCount} rows
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleBack}>
              ← Back
            </Button>
            <Button onClick={handleCreateDashboard} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Generate Dashboard with AI'}
            </Button>
          </div>
        </div>
      )}

      {step === 'generating' && (
        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-12 text-center">
          <div className="w-16 h-16 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
            Generating Your Dashboard
          </h2>
          <p className="text-[var(--color-gray-600)]">
            AI is analyzing your data and creating visualizations...
          </p>
        </div>
      )}

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
