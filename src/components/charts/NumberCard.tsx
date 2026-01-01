'use client';

import type { NumberCardConfig } from '@/types/chart';
import { aggregateData, formatValue } from './utils';

interface NumberCardProps {
  config: NumberCardConfig;
  data: Record<string, unknown>[];
}

export function NumberCard({ config, data }: NumberCardProps) {
  const { title, description, config: chartConfig } = config;
  const { column, aggregation, format, prefix, suffix } = chartConfig;

  const value = aggregateData(data, column, aggregation);
  const formattedValue = formatValue(value, format, prefix, suffix);

  return (
    <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 h-full flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-medium text-[var(--color-gray-600)] mb-1">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-[var(--color-gray-500)]">{description}</p>
        )}
      </div>
      <div className="mt-4">
        <span className="text-3xl font-bold text-[var(--color-gray-900)]">
          {formattedValue}
        </span>
      </div>
    </div>
  );
}
