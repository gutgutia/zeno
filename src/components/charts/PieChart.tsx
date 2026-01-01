'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { PieChartConfig } from '@/types/chart';
import { groupAndAggregate, getChartColor, formatValue } from './utils';

interface PieChartComponentProps {
  config: PieChartConfig;
  data: Record<string, unknown>[];
}

export function PieChartComponent({ config, data }: PieChartComponentProps) {
  const { title, description, config: chartConfig } = config;
  const { groupBy, value, donut = false, showPercent = true, colors, limit = 8 } = chartConfig;

  let chartData = groupAndAggregate(data, groupBy, value.column, value.aggregation);

  // Sort by value descending and limit
  chartData = [...chartData]
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const renderLabel = (entry: { name?: string; value?: number }) => {
    if (showPercent && entry.value !== undefined) {
      const percent = ((entry.value / total) * 100).toFixed(1);
      return `${percent}%`;
    }
    return entry.name || '';
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-[var(--color-gray-900)]">{title}</h3>
        {description && (
          <p className="text-xs text-[var(--color-gray-500)] mt-1">{description}</p>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={donut ? '50%' : 0}
              outerRadius="70%"
              paddingAngle={2}
              dataKey="value"
              label={renderLabel}
              labelLine={true}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors?.[index] || getChartColor(index)}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid var(--color-gray-200)',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
              formatter={(value) => [formatValue(value as number, 'number'), '']}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span style={{ color: 'var(--color-gray-700)', fontSize: '12px' }}>
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
