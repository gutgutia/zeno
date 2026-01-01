'use client';

import type { ChartConfig } from '@/types/chart';
import { NumberCard } from './NumberCard';
import { LineChartComponent } from './LineChart';
import { BarChartComponent } from './BarChart';
import { AreaChartComponent } from './AreaChart';
import { PieChartComponent } from './PieChart';
import { DataTable } from './DataTable';

interface ChartRendererProps {
  config: ChartConfig;
  data: Record<string, unknown>[];
  className?: string;
}

export function ChartRenderer({ config, data, className = '' }: ChartRendererProps) {
  const wrapperClasses = `${className}`;

  switch (config.type) {
    case 'number_card':
      return (
        <div className={wrapperClasses}>
          <NumberCard config={config} data={data} />
        </div>
      );

    case 'line':
      return (
        <div className={`${wrapperClasses} min-h-[300px]`}>
          <LineChartComponent config={config} data={data} />
        </div>
      );

    case 'bar':
      return (
        <div className={`${wrapperClasses} min-h-[300px]`}>
          <BarChartComponent config={config} data={data} />
        </div>
      );

    case 'area':
      return (
        <div className={`${wrapperClasses} min-h-[300px]`}>
          <AreaChartComponent config={config} data={data} />
        </div>
      );

    case 'pie':
      return (
        <div className={`${wrapperClasses} min-h-[300px]`}>
          <PieChartComponent config={config} data={data} />
        </div>
      );

    case 'table':
      return (
        <div className={wrapperClasses}>
          <DataTable config={config} data={data} />
        </div>
      );

    default:
      return (
        <div className={`${wrapperClasses} bg-white rounded-xl border border-[var(--color-gray-200)] p-6`}>
          <p className="text-[var(--color-gray-500)]">
            Unknown chart type: {(config as { type: string }).type}
          </p>
        </div>
      );
  }
}
