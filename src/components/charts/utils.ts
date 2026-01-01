import type { FormatType, AggregationType } from '@/types/chart';
import { CHART_COLORS } from '@/types/chart';

// Format a value based on format type
export function formatValue(value: number | string | null | undefined, format?: FormatType, prefix?: string, suffix?: string): string {
  if (value === null || value === undefined) return '-';

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) return String(value);

  let formatted: string;

  switch (format) {
    case 'currency':
      formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numValue);
      break;
    case 'percent':
      formatted = new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(numValue / 100);
      break;
    case 'compact':
      formatted = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(numValue);
      break;
    case 'date':
      formatted = new Date(numValue).toLocaleDateString();
      break;
    case 'number':
    default:
      formatted = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(numValue);
  }

  if (prefix && format !== 'currency') {
    formatted = prefix + formatted;
  }
  if (suffix && format !== 'percent') {
    formatted = formatted + suffix;
  }

  return formatted;
}

// Aggregate data based on aggregation type
export function aggregateData(
  data: Record<string, unknown>[],
  column: string,
  aggregation: AggregationType
): number {
  const values = data
    .map(row => row[column])
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(v => {
      if (typeof v === 'number') return v;
      const parsed = parseFloat(String(v).replace(/[$,%]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    });

  if (values.length === 0) return 0;

  switch (aggregation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.length;
    case 'countDistinct':
      return new Set(values).size;
    case 'latest':
      return values[values.length - 1];
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

// Group and aggregate data
export function groupAndAggregate(
  data: Record<string, unknown>[],
  groupBy: string,
  valueColumn: string,
  aggregation: AggregationType = 'sum'
): { name: string; value: number }[] {
  const groups = new Map<string, number[]>();

  data.forEach(row => {
    const key = String(row[groupBy] ?? 'Unknown');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    const value = row[valueColumn];
    if (value !== null && value !== undefined && value !== '') {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[$,%]/g, ''));
      if (!isNaN(numValue)) {
        groups.get(key)!.push(numValue);
      }
    }
  });

  return Array.from(groups.entries()).map(([name, values]) => {
    let value: number;
    switch (aggregation) {
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case 'min':
        value = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        value = values.length > 0 ? Math.max(...values) : 0;
        break;
      case 'count':
        value = values.length;
        break;
      case 'countDistinct':
        value = new Set(values).size;
        break;
      default:
        value = values.reduce((a, b) => a + b, 0);
    }
    return { name, value };
  });
}

// Get chart color
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

// Prepare time series data
export function prepareTimeSeriesData(
  data: Record<string, unknown>[],
  xColumn: string,
  yColumn: string,
  aggregation: AggregationType = 'sum',
  splitBy?: string
): Record<string, unknown>[] {
  if (!splitBy) {
    // Simple case - no split
    const grouped = new Map<string, number[]>();

    data.forEach(row => {
      const x = String(row[xColumn] ?? '');
      if (!grouped.has(x)) {
        grouped.set(x, []);
      }
      const value = row[yColumn];
      if (value !== null && value !== undefined) {
        const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[$,%]/g, ''));
        if (!isNaN(numValue)) {
          grouped.get(x)!.push(numValue);
        }
      }
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, values]) => ({
        name,
        value: aggregateArray(values, aggregation),
      }));
  }

  // With split - multiple series
  const grouped = new Map<string, Map<string, number[]>>();
  const allSeries = new Set<string>();

  data.forEach(row => {
    const x = String(row[xColumn] ?? '');
    const series = String(row[splitBy] ?? 'Other');
    allSeries.add(series);

    if (!grouped.has(x)) {
      grouped.set(x, new Map());
    }
    if (!grouped.get(x)!.has(series)) {
      grouped.get(x)!.set(series, []);
    }

    const value = row[yColumn];
    if (value !== null && value !== undefined) {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[$,%]/g, ''));
      if (!isNaN(numValue)) {
        grouped.get(x)!.get(series)!.push(numValue);
      }
    }
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, seriesMap]) => {
      const result: Record<string, unknown> = { name };
      allSeries.forEach(series => {
        const values = seriesMap.get(series) || [];
        result[series] = aggregateArray(values, aggregation);
      });
      return result;
    });
}

function aggregateArray(values: number[], aggregation: AggregationType): number {
  if (values.length === 0) return 0;
  switch (aggregation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.length;
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

// Get unique series names from data
export function getSeriesNames(
  data: Record<string, unknown>[],
  splitBy: string
): string[] {
  const series = new Set<string>();
  data.forEach(row => {
    const value = row[splitBy];
    if (value !== null && value !== undefined) {
      series.add(String(value));
    }
  });
  return Array.from(series);
}
