'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';

interface ModifyWithAIModalProps {
  dashboardId: string;
  isDisabled?: boolean;
  onModificationComplete: () => void;
  trigger?: React.ReactNode;
}

export function ModifyWithAIModal({
  dashboardId,
  isDisabled,
  onModificationComplete,
  trigger,
}: ModifyWithAIModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [creditsInfo, setCreditsInfo] = useState<{ needed: number; available: number } | null>(null);

  // Voice recording
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPositionRef = useRef<number>(0);

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
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [instructions]);

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
    if (textareaRef.current) {
      cursorPositionRef.current = textareaRef.current.selectionStart;
    } else {
      cursorPositionRef.current = instructions.length;
    }
    await startVoiceRecording();
  }, [instructions.length, startVoiceRecording]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructions.trim() || isProcessing) return;

    setIsProcessing(true);
    setIsOpen(false); // Close modal immediately so user can see dashboard

    // Show toast that processing has started
    const toastId = toast.loading('Modifying dashboard...', {
      description: 'Your changes are being applied. This may take a moment.',
    });

    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: instructions.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle insufficient credits (402)
        if (response.status === 402) {
          setCreditsInfo({
            needed: data.credits_required || 10,
            available: data.credits_available || 0,
          });
          setUpgradeModalOpen(true);
          toast.dismiss(toastId);
          return;
        }
        throw new Error(data.error || 'Failed to modify dashboard');
      }

      toast.success('Dashboard modified!', {
        id: toastId,
        description: data.summary || 'Your changes have been applied.',
      });

      // Reset state
      setInstructions('');

      // Notify parent to refresh
      onModificationComplete();
    } catch (error) {
      toast.error('Modification failed', {
        id: toastId,
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const suggestions = [
    'Make the header more prominent with a larger font',
    'Change the color scheme to use more blue tones',
    'Add a summary section at the top with key metrics',
    'Improve the layout of the timeline section',
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            disabled={isDisabled || isProcessing}
            className="flex items-center gap-1.5"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Modifying...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Modify with AI
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modify with AI</DialogTitle>
          <DialogDescription>
            Describe the changes you&apos;d like to make. The dashboard will update while you can continue viewing it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
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
                  ref={textareaRef}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  onSelect={(e) => {
                    cursorPositionRef.current = (e.target as HTMLTextAreaElement).selectionStart;
                  }}
                  placeholder="Describe what you'd like to change..."
                  className="min-h-[120px] resize-none pb-10"
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

          {/* Suggestions */}
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-gray-500)] font-medium">Suggestions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInstructions(suggestion)}
                  className="text-xs px-2 py-1 bg-[var(--color-gray-100)] hover:bg-[var(--color-gray-200)] text-[var(--color-gray-600)] rounded-md transition-colors text-left"
                >
                  {suggestion.length > 40 ? suggestion.slice(0, 40) + '...' : suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!instructions.trim() || isProcessing}
            >
              Apply Changes
            </Button>
          </div>
        </form>
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
