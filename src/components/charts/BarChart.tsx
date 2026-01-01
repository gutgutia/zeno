'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import type { BarChartConfig } from '@/types/chart';
import { groupAndAggregate, getSeriesNames, getChartColor, formatValue, prepareTimeSeriesData } from './utils';

interface BarChartComponentProps {
  config: BarChartConfig;
  data: Record<string, unknown>[];
}

export function BarChartComponent({ config, data }: BarChartComponentProps) {
  const { title, description, config: chartConfig } = config;
  const {
    xAxis,
    yAxis,
    orientation = 'vertical',
    splitBy,
    stacked = false,
    colors,
    sortBy = 'value',
    sortOrder = 'desc',
    limit,
  } = chartConfig;

  let chartData: Record<string, unknown>[];

  if (splitBy) {
    chartData = prepareTimeSeriesData(
      data,
      xAxis.column,
      yAxis.column,
      yAxis.aggregation,
      splitBy
    );
  } else {
    chartData = groupAndAggregate(data, xAxis.column, yAxis.column, yAxis.aggregation);
  }

  // Sort data
  if (sortBy === 'value' && !splitBy) {
    chartData = [...chartData].sort((a, b) => {
      const aVal = (a as { value: number }).value;
      const bVal = (b as { value: number }).value;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  } else if (sortBy === 'label') {
    chartData = [...chartData].sort((a, b) => {
      const aName = String(a.name);
      const bName = String(b.name);
      return sortOrder === 'desc' ? bName.localeCompare(aName) : aName.localeCompare(bName);
    });
  }

  // Apply limit
  if (limit && limit > 0) {
    chartData = chartData.slice(0, limit);
  }

  const series = splitBy ? getSeriesNames(data, splitBy) : ['value'];
  const isHorizontal = orientation === 'horizontal';

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
          <BarChart
            data={chartData}
            layout={isHorizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 5, right: 20, bottom: 5, left: isHorizontal ? 80 : 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" />
            {isHorizontal ? (
              <>
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: 'var(--color-gray-500)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-gray-200)' }}
                  tickFormatter={(v) => formatValue(v, yAxis.format)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: 'var(--color-gray-500)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-gray-200)' }}
                  width={75}
                />
              </>
            ) : (
              <>
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
              </>
            )}
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
            {series.length === 1 ? (
              <Bar dataKey="value" radius={[4, 4, 0, 0]} stackId={stacked ? 'a' : undefined}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors?.[0] || getChartColor(0)} />
                ))}
              </Bar>
            ) : (
              series.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  fill={colors?.[i] || getChartColor(i)}
                  radius={[4, 4, 0, 0]}
                  stackId={stacked ? 'a' : undefined}
                />
              ))
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
