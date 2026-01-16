'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';

interface UpdateDataModalProps {
  dashboardId: string;
  hasGoogleConnection: boolean;
  onRefreshStarted?: () => void; // Called when refresh starts (for polling)
  onRefreshComplete: (result: RefreshResult) => void;
  trigger?: React.ReactNode;
}

interface RefreshResult {
  success: boolean;
  refreshed: boolean;
  summary?: string;
  changes?: { metric: string; old: string; new: string }[];
  warnings?: string[];
  version?: {
    major: number;
    minor: number;
    label: string;
  };
}

type DataInputMethod = 'paste' | 'upload' | 'google';
type ModalState = 'input' | 'started' | 'error';

export function UpdateDataModal({
  dashboardId,
  hasGoogleConnection,
  onRefreshStarted,
  onRefreshComplete,
  trigger,
}: UpdateDataModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>('input');
  const [inputMethod, setInputMethod] = useState<DataInputMethod>(
    hasGoogleConnection ? 'google' : 'paste'
  );
  const [pastedData, setPastedData] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [creditsInfo, setCreditsInfo] = useState<{ needed: number; available: number } | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const isMounted = useRef(true);

  // Voice recording for paste data
  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPositionRef = useRef<number>(0);

  // Insert transcript at cursor position
  const insertTranscript = useCallback((transcript: string) => {
    const cursorPos = cursorPositionRef.current;
    const before = pastedData.slice(0, cursorPos);
    const after = pastedData.slice(cursorPos);

    // Add space before transcript if there's text before and it doesn't end with space
    const needsSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
    // Add space after transcript if there's text after and it doesn't start with space
    const needsSpaceAfter = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n');

    const newText = before +
      (needsSpaceBefore ? ' ' : '') +
      transcript +
      (needsSpaceAfter ? ' ' : '') +
      after;

    setPastedData(newText);

    // Update cursor position to end of inserted text
    const newCursorPos = cursorPos + (needsSpaceBefore ? 1 : 0) + transcript.length + (needsSpaceAfter ? 1 : 0);
    cursorPositionRef.current = newCursorPos;

    // Focus textarea and set cursor position after state update
    setTimeout(() => {
      if (pasteTextareaRef.current) {
        pasteTextareaRef.current.focus();
        pasteTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [pastedData]);

  const {
    isRecording,
    isTranscribing,
    recordingDuration,
    recordingError,
    startRecording: startVoiceRecording,
    stopRecording,
  } = useVoiceRecording({ onTranscript: insertTranscript });

  // Save cursor position before starting recording
  const startRecording = useCallback(async () => {
    if (pasteTextareaRef.current) {
      cursorPositionRef.current = pasteTextareaRef.current.selectionStart;
    } else {
      cursorPositionRef.current = pastedData.length;
    }
    await startVoiceRecording();
  }, [pastedData.length, startVoiceRecording]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setModalState('input');
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      let body: Record<string, unknown> = {};

      if (inputMethod === 'google') {
        body = { syncFromSheet: true };
      } else if (inputMethod === 'paste') {
        if (!pastedData.trim()) {
          toast.error('Please paste your data');
          setIsRefreshing(false);
          return;
        }
        body = { rawContent: pastedData };
      } else if (inputMethod === 'upload') {
        if (!uploadedFile) {
          toast.error('Please select a file');
          setIsRefreshing(false);
          return;
        }
        const content = await uploadedFile.text();
        body = { rawContent: content };
      }

      // Show "started" state immediately and notify parent to start polling
      setModalState('started');
      onRefreshStarted?.();

      // Fire the request - it may take a while, but user can close modal
      const response = await fetch(`/api/dashboards/${dashboardId}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!isMounted.current) return; // Component unmounted, skip updates

      if (!response.ok) {
        // Handle insufficient credits (402)
        if (response.status === 402) {
          setCreditsInfo({
            needed: result.credits_required || 10,
            available: result.credits_available || 0,
          });
          setUpgradeModalOpen(true);
          setModalState('input');
          setIsRefreshing(false);
          return;
        }
        throw new Error(result.error || 'Failed to refresh dashboard');
      }

      // Success - notify parent (if modal is still open)
      if (result.refreshed) {
        toast.success('Dashboard updated with new data!');
        if (result.version) {
          toast.info(`New version: ${result.version.label}`);
        }
      } else {
        toast.info(result.message || 'No changes detected in the data');
      }

      onRefreshComplete(result);

      // Close modal on success (if still open)
      setIsOpen(false);
      setPastedData('');
      setUploadedFile(null);
    } catch (error) {
      console.error('Refresh error:', error);
      if (isMounted.current) {
        const message = error instanceof Error ? error.message : 'Failed to refresh dashboard';
        setErrorMessage(message);
        setModalState('error');
        toast.error(message);
      }
    } finally {
      if (isMounted.current) {
        setIsRefreshing(false);
      }
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    // Reset state after close animation
    setTimeout(() => {
      setModalState('input');
      setPastedData('');
      setUploadedFile(null);
      setErrorMessage(null);
    }, 200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Update Data
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {/* Started State - Show success message */}
        {modalState === 'started' && (
          <>
            <DialogHeader>
              <DialogTitle>Update Started</DialogTitle>
            </DialogHeader>
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <h3 className="text-lg font-medium text-[var(--color-gray-900)] mb-2">
                Data update in progress
              </h3>
              <p className="text-[var(--color-gray-600)] mb-4">
                Feel free to close this dialog. We&apos;ll email you when your dashboard is ready.
              </p>
              <p className="text-sm text-[var(--color-gray-500)]">
                The dashboard will automatically refresh when the update is complete.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Error State */}
        {modalState === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle>Update Failed</DialogTitle>
            </DialogHeader>
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-[var(--color-gray-900)] mb-2">
                Something went wrong
              </h3>
              <p className="text-[var(--color-gray-600)]">
                {errorMessage || 'Failed to update dashboard. Please try again.'}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={() => setModalState('input')}>
                Try Again
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Input State - Normal form */}
        {modalState === 'input' && (
          <>
            <DialogHeader>
              <DialogTitle>Update Dashboard Data</DialogTitle>
              <DialogDescription>
                Refresh your dashboard with new data. The visualizations will be updated to reflect the changes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Data source selection */}
              <div className="space-y-2">
                <Label>How would you like to update?</Label>
                <div className="grid grid-cols-1 gap-2">
                  {hasGoogleConnection && (
                    <button
                      type="button"
                      onClick={() => setInputMethod('google')}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        inputMethod === 'google'
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                          : 'border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)]'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        inputMethod === 'google' ? 'bg-[var(--color-primary)]/10' : 'bg-[var(--color-gray-100)]'
                      }`}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.5 3H4.5C3.67 3 3 3.67 3 4.5v15c0 .83.67 1.5 1.5 1.5h15c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5zm-1 15H5.5c-.28 0-.5-.22-.5-.5v-10c0-.28.22-.5.5-.5h13c.28 0 .5.22.5.5v10c0 .28-.22.5-.5.5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-sm">Sync from Google Sheets</p>
                        <p className="text-xs text-[var(--color-gray-500)]">
                          Pull latest data from your connected sheet
                        </p>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setInputMethod('paste')}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      inputMethod === 'paste'
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                        : 'border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      inputMethod === 'paste' ? 'bg-[var(--color-primary)]/10' : 'bg-[var(--color-gray-100)]'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Paste Data</p>
                      <p className="text-xs text-[var(--color-gray-500)]">
                        Paste CSV, TSV, or JSON data
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMethod('upload')}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      inputMethod === 'upload'
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                        : 'border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      inputMethod === 'upload' ? 'bg-[var(--color-primary)]/10' : 'bg-[var(--color-gray-100)]'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Upload File</p>
                      <p className="text-xs text-[var(--color-gray-500)]">
                        Upload a CSV, JSON, or Excel file
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Data input based on method */}
              {inputMethod === 'paste' && (
                <div className="space-y-2">
                  <Label htmlFor="paste-data">Paste your data</Label>
                  {/* Recording/Transcribing UI replaces textarea */}
                  {isRecording || isTranscribing ? (
                    <div className="min-h-[200px] border border-[var(--color-gray-200)] rounded-md bg-[var(--color-gray-50)] flex flex-col items-center justify-center py-8">
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
                        ref={pasteTextareaRef}
                        id="paste-data"
                        value={pastedData}
                        onChange={(e) => setPastedData(e.target.value)}
                        onSelect={(e) => {
                          cursorPositionRef.current = (e.target as HTMLTextAreaElement).selectionStart;
                        }}
                        placeholder="Paste your CSV, TSV, or JSON data here..."
                        rows={8}
                        className="font-mono text-sm pb-10"
                      />
                      {/* Voice input button - bottom right */}
                      <button
                        type="button"
                        onClick={startRecording}
                        className="absolute right-2 bottom-2 p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Click to speak your data"
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
              )}

              {inputMethod === 'upload' && (
                <div className="space-y-2">
                  <Label htmlFor="file-upload">Select file</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv,.json,.xlsx,.xls,.tsv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="file-upload"
                      className="flex-1 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[var(--color-gray-300)] rounded-lg cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                    >
                      {uploadedFile ? (
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium">{uploadedFile.name}</span>
                        </div>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span className="text-sm text-[var(--color-gray-500)]">
                            Click to select a file
                          </span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {inputMethod === 'google' && hasGoogleConnection && (
                <div className="p-4 bg-[var(--color-gray-50)] rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-[var(--color-primary)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-gray-900)]">
                        Ready to sync
                      </p>
                      <p className="text-sm text-[var(--color-gray-600)] mt-1">
                        This will fetch the latest data from your Google Sheet and update the dashboard visualizations to reflect any changes.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isRefreshing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing || (inputMethod === 'paste' && !pastedData.trim()) || (inputMethod === 'upload' && !uploadedFile)}
              >
                {isRefreshing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Starting...
                  </>
                ) : (
                  'Update Dashboard'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>

      {/* Upgrade Modal for insufficient credits */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        reason="credits"
        creditsNeeded={creditsInfo?.needed}
        creditsAvailable={creditsInfo?.available}
      />
    </Dialog>
  );
}
