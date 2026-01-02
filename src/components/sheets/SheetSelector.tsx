'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export interface SheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
}

interface SheetSelectorProps {
  sheets: SheetInfo[];
  selectedSheets: string[];
  onSelectionChange: (sheets: string[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export function SheetSelector({
  sheets,
  selectedSheets,
  onSelectionChange,
  onConfirm,
  onCancel,
  title = 'Select Sheets',
  description = 'Choose which sheets to include in your dashboard. Data from selected sheets will be combined.',
}: SheetSelectorProps) {
  const toggleSheet = (sheetName: string) => {
    if (selectedSheets.includes(sheetName)) {
      onSelectionChange(selectedSheets.filter((s) => s !== sheetName));
    } else {
      onSelectionChange([...selectedSheets, sheetName]);
    }
  };

  const selectAll = () => {
    onSelectionChange(sheets.map((s) => s.name));
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)]">
          {title}
        </h2>
        <p className="text-sm text-[var(--color-gray-500)] mt-1">
          {description}
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={selectAll}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          Select all
        </button>
        <span className="text-[var(--color-gray-300)]">|</span>
        <button
          onClick={deselectAll}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          Deselect all
        </button>
      </div>

      {/* Sheet list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {sheets.map((sheet) => (
          <label
            key={sheet.name}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedSheets.includes(sheet.name)
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                : 'border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)]'
            }`}
          >
            <Checkbox
              checked={selectedSheets.includes(sheet.name)}
              onCheckedChange={() => toggleSheet(sheet.name)}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[var(--color-gray-900)] truncate">
                {sheet.name}
              </div>
              <div className="text-sm text-[var(--color-gray-500)]">
                {sheet.rowCount.toLocaleString()} rows × {sheet.columnCount} columns
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Selection summary */}
      <div className="mt-4 pt-4 border-t border-[var(--color-gray-200)]">
        <div className="text-sm text-[var(--color-gray-600)] mb-4">
          {selectedSheets.length === 0 ? (
            <span className="text-[var(--color-error)]">
              Please select at least one sheet
            </span>
          ) : (
            <>
              <span className="font-medium">{selectedSheets.length}</span> of{' '}
              <span className="font-medium">{sheets.length}</span> sheets selected
            </>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            ← Back
          </Button>
          <Button
            onClick={onConfirm}
            disabled={selectedSheets.length === 0}
          >
            Continue with {selectedSheets.length} sheet{selectedSheets.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
