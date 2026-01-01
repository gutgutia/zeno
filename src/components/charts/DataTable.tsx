'use client';

import { useState, useMemo } from 'react';
import type { TableConfig } from '@/types/chart';
import { formatValue } from './utils';
import { Button } from '@/components/ui/button';

interface DataTableProps {
  config: TableConfig;
  data: Record<string, unknown>[];
}

export function DataTable({ config, data }: DataTableProps) {
  const { title, description, config: tableConfig } = config;
  const { columns, sortBy, sortOrder = 'asc', pageSize = 10, showPagination = true } = tableConfig;

  const [currentPage, setCurrentPage] = useState(1);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortBy) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [data, sortBy, sortOrder]);

  // Paginate
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = showPagination
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData.slice(0, pageSize);

  const handlePrevPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-[var(--color-gray-900)]">{title}</h3>
        {description && (
          <p className="text-xs text-[var(--color-gray-500)] mt-1">{description}</p>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-gray-200)]">
              {columns.map((col) => (
                <th
                  key={col.column}
                  className="text-left py-2 px-3 font-medium text-[var(--color-gray-700)] bg-[var(--color-gray-50)]"
                  style={{ width: col.width ? `${col.width}px` : 'auto' }}
                >
                  {col.label || col.column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, i) => (
              <tr
                key={i}
                className="border-b border-[var(--color-gray-100)] hover:bg-[var(--color-gray-50)]"
              >
                {columns.map((col) => (
                  <td key={col.column} className="py-2 px-3 text-[var(--color-gray-600)]">
                    {col.format
                      ? formatValue(row[col.column] as number, col.format)
                      : String(row[col.column] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-gray-200)]">
          <span className="text-sm text-[var(--color-gray-500)]">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
