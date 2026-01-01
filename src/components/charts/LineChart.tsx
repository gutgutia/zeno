'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { LineChartConfig } from '@/types/chart';
import { prepareTimeSeriesData, getSeriesNames, getChartColor, formatValue } from './utils';

interface LineChartComponentProps {
  config: LineChartConfig;
  data: Record<string, unknown>[];
}

export function LineChartComponent({ config, data }: LineChartComponentProps) {
  const { title, description, config: chartConfig } = config;
  const { xAxis, yAxis, splitBy, colors, showDots = true, showGrid = true, smooth = false } = chartConfig;

  const chartData = prepareTimeSeriesData(
    data,
    xAxis.column,
    yAxis.column,
    yAxis.aggregation,
    splitBy
  );

  const series = splitBy ? getSeriesNames(data, splitBy) : ['value'];

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
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" />}
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: 'var(--color-gray-500)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-gray-200)' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--color-gray-500)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-gray-200)' }}
              tickFormatter={(v) => formatValue(v, yAxis.format)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid var(--color-gray-200)',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
              formatter={(value) => [formatValue(value as number, yAxis.format), '']}
            />
            {series.length > 1 && <Legend />}
            {series.map((s, i) => (
              <Line
                key={s}
                type={smooth ? 'monotone' : 'linear'}
                dataKey={s}
                stroke={colors?.[i] || getChartColor(i)}
                strokeWidth={2}
                dot={showDots}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
