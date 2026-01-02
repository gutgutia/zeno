'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SpreadsheetListItem {
  id: string;
  name: string;
  modifiedTime: string;
  owners?: { emailAddress: string; displayName?: string }[];
}

interface GoogleSheetPickerProps {
  workspaceId: string;
  onSelect: (spreadsheet: SpreadsheetListItem) => void;
  onCancel: () => void;
}

export function GoogleSheetPicker({
  workspaceId,
  onSelect,
  onCancel,
}: GoogleSheetPickerProps) {
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSpreadsheets();
  }, [workspaceId]);

  const loadSpreadsheets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/google/spreadsheets?workspace_id=${workspaceId}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load spreadsheets');
      }

      const data = await response.json();
      setSpreadsheets(data.spreadsheets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spreadsheets');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSpreadsheets = spreadsheets.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-8 text-center">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--color-gray-600)]">Loading your Google Sheets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-[var(--color-error)] shadow-sm p-6">
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-[var(--color-error)]/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[var(--color-error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[var(--color-error)]">{error}</p>
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={loadSpreadsheets}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)]">
          Select a Google Sheet
        </h2>
        <p className="text-sm text-[var(--color-gray-500)] mt-1">
          Choose a spreadsheet from your Google Drive
        </p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search spreadsheets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Spreadsheet list */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filteredSpreadsheets.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-gray-500)]">
            {searchQuery ? 'No spreadsheets match your search' : 'No spreadsheets found'}
          </div>
        ) : (
          filteredSpreadsheets.map((spreadsheet) => (
            <button
              key={spreadsheet.id}
              onClick={() => onSelect(spreadsheet)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--color-gray-200)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors text-left"
            >
              {/* Google Sheets icon */}
              <div className="w-10 h-10 bg-[#0F9D58] rounded flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h2v2H7zm0 4h2v2H7zm0 4h2v2H7zm4-8h6v2h-6zm0 4h6v2h-6zm0 4h6v2h-6z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[var(--color-gray-900)] truncate">
                  {spreadsheet.name}
                </div>
                <div className="text-sm text-[var(--color-gray-500)]">
                  Modified {formatDate(spreadsheet.modifiedTime)}
                </div>
              </div>
              <svg className="w-5 h-5 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-[var(--color-gray-200)]">
        <Button variant="outline" onClick={onCancel}>
          ← Back
        </Button>
      </div>
    </div>
  );
}
