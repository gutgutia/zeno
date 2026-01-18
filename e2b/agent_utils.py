"""
Agent Utility Library for Dashboard Generation

This module provides pre-built functions that help the agent:
1. Load and analyze data quickly
2. Generate common chart configurations
3. Build HTML components

Usage in the sandbox:
    from agent_utils import load_data, get_profile, html

"""

import json
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Any, Optional
from datetime import datetime

# ============================================================================
# Data Loading
# ============================================================================

_cached_df: Optional[pd.DataFrame] = None
_cached_profile: Optional[dict] = None


def load_data(path: str = "/home/user/data.csv") -> pd.DataFrame:
    """
    Load the pre-processed CSV data into a pandas DataFrame.

    The data has already been converted from whatever format the user uploaded
    (Excel, PDF, etc.) into clean CSV format.

    Returns:
        pd.DataFrame: The data ready for analysis

    Example:
        df = load_data()
        print(df.head())
        print(df.describe())
    """
    global _cached_df
    if _cached_df is not None:
        return _cached_df

    _cached_df = pd.read_csv(path)
    return _cached_df


def get_profile(path: str = "/home/user/profile.json") -> dict:
    """
    Get the pre-computed data profile.

    This profile contains:
    - Column information (types, stats, suggested roles)
    - Visualization suggestions
    - Data quality insights

    Returns:
        dict: The data profile

    Example:
        profile = get_profile()
        print(profile['insights'])
        print(profile['suggestedVisualizations'])
    """
    global _cached_profile
    if _cached_profile is not None:
        return _cached_profile

    with open(path) as f:
        _cached_profile = json.load(f)
    return _cached_profile


def get_column_info(column_name: str) -> Optional[dict]:
    """Get detailed info about a specific column from the profile."""
    profile = get_profile()
    for col in profile.get('columns', []):
        if col['name'] == column_name:
            return col
    return None


# ============================================================================
# Data Analysis Helpers
# ============================================================================

def summarize_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """
    Get summary statistics for all numeric columns.

    Returns a DataFrame with min, max, mean, median, sum for each numeric column.
    """
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) == 0:
        return pd.DataFrame()

    summary = df[numeric_cols].agg(['min', 'max', 'mean', 'median', 'sum']).T
    summary.columns = ['Min', 'Max', 'Mean', 'Median', 'Total']
    return summary.round(2)


def get_top_categories(df: pd.DataFrame, column: str, n: int = 10) -> pd.DataFrame:
    """
    Get top N categories by count for a column.

    Returns DataFrame with value, count, and percentage.
    """
    counts = df[column].value_counts().head(n)
    total = len(df)

    return pd.DataFrame({
        'Value': counts.index,
        'Count': counts.values,
        'Percentage': (counts.values / total * 100).round(1)
    })


def aggregate_by(df: pd.DataFrame, group_col: str, value_col: str,
                 agg_func: str = 'sum') -> pd.DataFrame:
    """
    Aggregate a value column by a grouping column.

    Args:
        df: The DataFrame
        group_col: Column to group by
        value_col: Column to aggregate
        agg_func: Aggregation function ('sum', 'mean', 'count', 'min', 'max')

    Returns:
        DataFrame with grouped results sorted by value
    """
    result = df.groupby(group_col)[value_col].agg(agg_func).reset_index()
    result.columns = [group_col, value_col]
    return result.sort_values(value_col, ascending=False)


def time_series_aggregate(df: pd.DataFrame, date_col: str, value_col: str,
                          freq: str = 'M', agg_func: str = 'sum') -> pd.DataFrame:
    """
    Aggregate data by time periods.

    Args:
        df: The DataFrame
        date_col: Column containing dates
        value_col: Column to aggregate
        freq: Frequency ('D' for daily, 'W' for weekly, 'M' for monthly, 'Y' for yearly)
        agg_func: Aggregation function

    Returns:
        DataFrame with time-aggregated results
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.set_index(date_col)

    result = df[value_col].resample(freq).agg(agg_func).reset_index()
    result.columns = [date_col, value_col]
    return result


# ============================================================================
# Chart.js Configuration Builders
# ============================================================================

def chart_bar(labels: list, values: list, title: str = "",
              color: str = "#2563EB") -> dict:
    """
    Generate Chart.js configuration for a bar chart.

    Args:
        labels: Category labels (x-axis)
        values: Numeric values (y-axis)
        title: Chart title
        color: Bar color (hex)

    Returns:
        dict: Chart.js configuration object
    """
    return {
        "type": "bar",
        "data": {
            "labels": labels,
            "datasets": [{
                "data": values,
                "backgroundColor": color,
                "borderRadius": 4,
            }]
        },
        "options": {
            "responsive": True,
            "maintainAspectRatio": False,
            "plugins": {
                "title": {"display": bool(title), "text": title},
                "legend": {"display": False}
            },
            "scales": {
                "y": {"beginAtZero": True}
            }
        }
    }


def chart_line(labels: list, values: list, title: str = "",
               color: str = "#2563EB", fill: bool = False) -> dict:
    """
    Generate Chart.js configuration for a line chart.

    Args:
        labels: X-axis labels (often dates)
        values: Y-axis values
        title: Chart title
        color: Line color
        fill: Whether to fill area under line

    Returns:
        dict: Chart.js configuration object
    """
    return {
        "type": "line",
        "data": {
            "labels": labels,
            "datasets": [{
                "data": values,
                "borderColor": color,
                "backgroundColor": color + "20" if fill else "transparent",
                "fill": fill,
                "tension": 0.3,
            }]
        },
        "options": {
            "responsive": True,
            "maintainAspectRatio": False,
            "plugins": {
                "title": {"display": bool(title), "text": title},
                "legend": {"display": False}
            }
        }
    }


def chart_pie(labels: list, values: list, title: str = "",
              colors: Optional[list] = None) -> dict:
    """
    Generate Chart.js configuration for a pie/doughnut chart.

    Args:
        labels: Category labels
        values: Values for each category
        title: Chart title
        colors: List of colors (optional, uses defaults)

    Returns:
        dict: Chart.js configuration object
    """
    default_colors = ["#2563EB", "#0D9488", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"]
    colors = colors or default_colors[:len(labels)]

    return {
        "type": "doughnut",
        "data": {
            "labels": labels,
            "datasets": [{
                "data": values,
                "backgroundColor": colors,
            }]
        },
        "options": {
            "responsive": True,
            "maintainAspectRatio": False,
            "plugins": {
                "title": {"display": bool(title), "text": title},
                "legend": {"position": "right"}
            }
        }
    }


# ============================================================================
# HTML Component Builders
# ============================================================================

class html:
    """HTML component builders for dashboard generation."""

    @staticmethod
    def metric_card(title: str, value: Any, subtitle: str = "",
                    color: str = "#2563EB") -> str:
        """
        Generate HTML for a metric card.

        Args:
            title: Card title (e.g., "Total Revenue")
            value: The metric value (e.g., "$1,234,567")
            subtitle: Optional subtitle (e.g., "+12% from last month")
            color: Accent color

        Returns:
            str: HTML string for the metric card
        """
        return f'''
        <div class="metric-card" style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="color: #6B7280; font-size: 14px; margin-bottom: 8px;">{title}</div>
            <div style="color: #111827; font-size: 32px; font-weight: 700;">{value}</div>
            {f'<div style="color: {color}; font-size: 14px; margin-top: 8px;">{subtitle}</div>' if subtitle else ''}
        </div>
        '''

    @staticmethod
    def chart_container(chart_id: str, title: str = "", height: int = 300) -> str:
        """
        Generate HTML container for a Chart.js chart.

        Args:
            chart_id: Unique ID for the canvas element
            title: Optional chart title
            height: Chart height in pixels

        Returns:
            str: HTML string for the chart container
        """
        title_html = f'<h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px;">{title}</h3>' if title else ''
        return f'''
        <div class="chart-container" style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            {title_html}
            <div style="height: {height}px;">
                <canvas id="{chart_id}"></canvas>
            </div>
        </div>
        '''

    @staticmethod
    def data_table(df: pd.DataFrame, max_rows: int = 50) -> str:
        """
        Generate HTML for a styled data table.

        Args:
            df: DataFrame to display
            max_rows: Maximum rows to show

        Returns:
            str: HTML string for the table
        """
        df_display = df.head(max_rows)

        # Build header
        headers = ''.join(f'<th style="padding: 12px; text-align: left; border-bottom: 2px solid #E5E7EB; color: #374151; font-weight: 600;">{col}</th>' for col in df_display.columns)

        # Build rows
        rows = []
        for _, row in df_display.iterrows():
            cells = ''.join(f'<td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">{val}</td>' for val in row)
            rows.append(f'<tr style="background: white;">{cells}</tr>')

        rows_html = ''.join(rows)

        return f'''
        <div class="table-container" style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #F9FAFB;">{headers}</tr>
                </thead>
                <tbody>{rows_html}</tbody>
            </table>
            {f'<div style="color: #6B7280; font-size: 12px; margin-top: 12px;">Showing {len(df_display)} of {len(df)} rows</div>' if len(df) > max_rows else ''}
        </div>
        '''

    @staticmethod
    def grid(columns: int = 2) -> tuple:
        """
        Generate grid container open/close tags.

        Args:
            columns: Number of columns

        Returns:
            tuple: (open_tag, close_tag)
        """
        return (
            f'<div style="display: grid; grid-template-columns: repeat({columns}, 1fr); gap: 24px;">',
            '</div>'
        )

    @staticmethod
    def section(title: str, content: str) -> str:
        """
        Wrap content in a titled section.

        Args:
            title: Section title
            content: HTML content

        Returns:
            str: HTML string for the section
        """
        return f'''
        <section style="margin-bottom: 32px;">
            <h2 style="color: #111827; font-size: 24px; font-weight: 600; margin-bottom: 16px;">{title}</h2>
            {content}
        </section>
        '''


# ============================================================================
# Full Page Template
# ============================================================================

def page_template(title: str, body: str, branding: Optional[dict] = None) -> str:
    """
    Generate a complete HTML page with proper structure.

    Args:
        title: Page title
        body: Main content HTML
        branding: Optional branding config with colors, fonts, logo

    Returns:
        str: Complete HTML document
    """
    branding = branding or {}
    primary = branding.get('primary', '#2563EB')
    background = branding.get('background', '#F9FAFB')
    font = branding.get('font', 'system-ui, -apple-system, sans-serif')

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: {font};
            background: {background};
            color: #111827;
            line-height: 1.5;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            padding: 32px;
        }}
        h1 {{
            color: #111827;
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 8px;
        }}
        .subtitle {{
            color: #6B7280;
            font-size: 16px;
            margin-bottom: 32px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{title}</h1>
        <p class="subtitle">Generated on {datetime.now().strftime('%B %d, %Y')}</p>
        {body}
    </div>
</body>
</html>'''


# ============================================================================
# Formatting Helpers
# ============================================================================

def format_number(value: float, decimals: int = 0) -> str:
    """Format a number with thousands separators."""
    if pd.isna(value):
        return "N/A"
    return f"{value:,.{decimals}f}"


def format_currency(value: float, symbol: str = "$") -> str:
    """Format a number as currency."""
    if pd.isna(value):
        return "N/A"
    if abs(value) >= 1_000_000:
        return f"{symbol}{value/1_000_000:.1f}M"
    if abs(value) >= 1_000:
        return f"{symbol}{value/1_000:.1f}K"
    return f"{symbol}{value:,.0f}"


def format_percent(value: float, decimals: int = 1) -> str:
    """Format a number as percentage."""
    if pd.isna(value):
        return "N/A"
    return f"{value:.{decimals}f}%"
