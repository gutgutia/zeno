'use client';

import { useState } from 'react';
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
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Describe what you'd like to change..."
              className="min-h-[120px] resize-none"
              autoFocus
            />
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
