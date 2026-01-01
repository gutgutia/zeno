export type ChartType = 'number_card' | 'line' | 'bar' | 'area' | 'pie' | 'table';
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'countDistinct' | 'latest';
export type FormatType = 'number' | 'currency' | 'percent' | 'compact' | 'date';

export interface BaseChartConfig {
  id: string;
  type: ChartType;
  title: string;
  description?: string;
}

export interface NumberCardConfig extends BaseChartConfig {
  type: 'number_card';
  config: {
    column: string;
    aggregation: AggregationType;
    format?: FormatType;
    prefix?: string;
    suffix?: string;
    comparison?: {
      type: 'previous' | 'target';
      value?: number;
      column?: string;
    };
  };
}

export interface LineChartConfig extends BaseChartConfig {
  type: 'line';
  config: {
    xAxis: {
      column: string;
      type?: 'category' | 'time';
      format?: string;
    };
    yAxis: {
      column: string;
      aggregation?: AggregationType;
      format?: FormatType;
    };
    splitBy?: string;
    colors?: string[];
    showDots?: boolean;
    showGrid?: boolean;
    smooth?: boolean;
  };
}

export interface BarChartConfig extends BaseChartConfig {
  type: 'bar';
  config: {
    xAxis: {
      column: string;
    };
    yAxis: {
      column: string;
      aggregation?: AggregationType;
      format?: FormatType;
    };
    orientation?: 'vertical' | 'horizontal';
    splitBy?: string;
    stacked?: boolean;
    colors?: string[];
    sortBy?: 'label' | 'value';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
  };
}

export interface AreaChartConfig extends BaseChartConfig {
  type: 'area';
  config: {
    xAxis: {
      column: string;
      type?: 'category' | 'time';
    };
    yAxis: {
      column: string;
      aggregation?: AggregationType;
      format?: FormatType;
    };
    splitBy?: string;
    stacked?: boolean;
    colors?: string[];
    smooth?: boolean;
  };
}

export interface PieChartConfig extends BaseChartConfig {
  type: 'pie';
  config: {
    groupBy: string;
    value: {
      column: string;
      aggregation?: AggregationType;
    };
    donut?: boolean;
    showLabels?: boolean;
    showPercent?: boolean;
    colors?: string[];
    limit?: number;
  };
}

export interface TableConfig extends BaseChartConfig {
  type: 'table';
  config: {
    columns: {
      column: string;
      label?: string;
      format?: FormatType;
      width?: number;
    }[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    pageSize?: number;
    showPagination?: boolean;
  };
}

export type ChartConfig =
  | NumberCardConfig
  | LineChartConfig
  | BarChartConfig
  | AreaChartConfig
  | PieChartConfig
  | TableConfig;

// Default chart colors
export const CHART_COLORS = [
  '#2563EB', // Primary Blue
  '#0D9488', // Teal
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#10B981', // Green
  '#EC4899', // Pink
  '#6366F1', // Indigo
];
