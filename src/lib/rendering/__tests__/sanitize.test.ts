/**
 * HTML Sanitization Unit Tests
 *
 * Tests for XSS prevention and HTML security.
 * CRITICAL: These tests ensure user safety from malicious content.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeHTML,
  extractChartPlaceholders,
  validateChartConfigs,
} from '../sanitize';

describe('sanitizeHTML', () => {
  describe('script injection prevention', () => {
    it('should remove script tags', () => {
      const html = '<div>Hello</div><script>alert("xss")</script>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).toContain('<div>Hello</div>');
    });

    it('should remove script tags with attributes', () => {
      const html = '<script src="evil.js"></script><p>Safe</p>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('<script');
      expect(result).toContain('<p>Safe</p>');
    });

    it('should remove inline scripts', () => {
      const html = '<script type="text/javascript">malicious()</script>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('<script');
      expect(result).not.toContain('malicious');
    });
  });

  describe('event handler prevention', () => {
    it('should remove onclick handlers', () => {
      const html = '<button onclick="alert(1)">Click</button>';
      const result = sanitizeHTML(html);

      // The sanitizer removes the event handler attribute
      expect(result).not.toContain('onclick');
    });

    it('should remove onerror handlers', () => {
      const html = '<img src="x" onerror="alert(1)">';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('onerror');
    });

    it('should remove onload handlers', () => {
      const html = '<body onload="malicious()">';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('onload');
    });

    it('should remove onmouseover handlers', () => {
      const html = '<div onmouseover="steal()">Hover me</div>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('onmouseover');
    });

    it('should handle various event handler formats', () => {
      const html = `<div onclick='alert(1)' onmouseover="alert(2)" onfocus=alert(3)>Test</div>`;
      const result = sanitizeHTML(html);

      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onmouseover');
      expect(result).not.toContain('onfocus');
    });
  });

  describe('javascript URL prevention', () => {
    it('should remove javascript: URLs', () => {
      const html = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('javascript:');
    });

    it('should handle case variations', () => {
      const html = '<a href="JAVASCRIPT:alert(1)">Click</a>';
      const result = sanitizeHTML(html);

      expect(result.toLowerCase()).not.toContain('javascript:');
    });
  });

  describe('AI shell element removal', () => {
    it('should remove header elements', () => {
      const html = `<header class="site-header"><nav>Menu</nav></header><main>Content</main>`;
      const result = sanitizeHTML(html);

      expect(result).not.toContain('<header');
      expect(result).not.toContain('</header>');
      expect(result).toContain('<main>Content</main>');
    });

    it('should remove nav elements', () => {
      const html = '<nav><a href="/">Home</a></nav><article>Article</article>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('<nav');
      expect(result).not.toContain('</nav>');
      expect(result).toContain('<article>Article</article>');
    });

    it('should remove footer elements', () => {
      const html = '<main>Content</main><footer>© 2024</footer>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('<footer');
      expect(result).not.toContain('</footer>');
      expect(result).toContain('<main>Content</main>');
    });

    it('should remove nested header content', () => {
      const html = `<header>
        <div class="logo">Logo</div>
        <nav>Navigation</nav>
      </header>
      <main>Main content</main>`;
      const result = sanitizeHTML(html);

      expect(result).not.toContain('<header');
      expect(result).not.toContain('Logo');
      expect(result).toContain('Main content');
    });
  });

  describe('dangerous CSS prevention', () => {
    it('should neutralize position: fixed', () => {
      const html = '<div style="position: fixed; top: 0;">Fixed header</div>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('position: fixed');
      expect(result).toContain('position: relative');
    });

    it('should neutralize absolute positioning with top: 0', () => {
      const html = '<div style="position: absolute; top: 0; left: 0;">Overlay</div>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('position: absolute');
      expect(result).toContain('position: relative');
    });
  });

  describe('HTML comment removal', () => {
    it('should remove HTML comments', () => {
      const html = '<div>Content</div><!-- <script>evil()</script> -->';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('<!--');
      expect(result).not.toContain('-->');
      expect(result).not.toContain('evil');
    });

    it('should remove conditional comments', () => {
      const html = '<!--[if IE]><script>alert(1)</script><![endif]--><p>Safe</p>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('<!--');
      expect(result).toContain('<p>Safe</p>');
    });
  });

  describe('preserves safe content', () => {
    it('should preserve basic HTML structure', () => {
      const html = '<div class="container"><h1>Title</h1><p>Paragraph</p></div>';
      const result = sanitizeHTML(html);

      expect(result).toBe(html);
    });

    it('should preserve tables', () => {
      const html = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
      const result = sanitizeHTML(html);

      expect(result).toContain('<table>');
      expect(result).toContain('<th>Header</th>');
      expect(result).toContain('<td>Cell</td>');
    });

    it('should preserve images with safe attributes', () => {
      const html = '<img src="https://example.com/image.png" alt="Description" width="100" height="100">';
      const result = sanitizeHTML(html);

      expect(result).toContain('src="https://example.com/image.png"');
      expect(result).toContain('alt="Description"');
    });

    it('should preserve SVG elements', () => {
      const html = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>';
      const result = sanitizeHTML(html);

      expect(result).toContain('<svg');
      expect(result).toContain('<circle');
    });

    it('should preserve data attributes for charts', () => {
      const html = '<div data-chart="chart-1" data-title="Sales">Chart placeholder</div>';
      const result = sanitizeHTML(html);

      expect(result).toContain('data-chart="chart-1"');
      expect(result).toContain('data-title="Sales"');
    });

    it('should preserve safe inline styles', () => {
      const html = '<div style="color: red; background: blue; margin: 10px;">Styled</div>';
      const result = sanitizeHTML(html);

      expect(result).toContain('style="color: red; background: blue; margin: 10px;"');
    });
  });

  describe('complex attack vectors', () => {
    it('should handle data URLs with HTML', () => {
      const html = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('data:');
      expect(result).not.toContain('<script');
    });

    it('should handle CSS expression (IE)', () => {
      const html = '<div style="width: expression(alert(1))">Test</div>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('expression');
    });

    it('should handle VBScript URLs', () => {
      const html = '<a href="vbscript:msgbox(1)">Click</a>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('vbscript');
    });

    it('should handle CSS @import', () => {
      const html = '<style>@import url("evil.css");</style><p>Safe</p>';
      const result = sanitizeHTML(html);

      expect(result).not.toContain('@import');
    });
  });
});

describe('extractChartPlaceholders', () => {
  it('should extract single chart placeholder', () => {
    const html = '<div data-chart="chart-1">Placeholder</div>';
    const placeholders = extractChartPlaceholders(html);

    expect(placeholders).toEqual(['chart-1']);
  });

  it('should extract multiple chart placeholders', () => {
    const html = `
      <div data-chart="sales-chart">Sales</div>
      <div data-chart="revenue-chart">Revenue</div>
      <div data-chart="users-chart">Users</div>
    `;
    const placeholders = extractChartPlaceholders(html);

    expect(placeholders).toEqual(['sales-chart', 'revenue-chart', 'users-chart']);
  });

  it('should handle single quotes', () => {
    const html = "<div data-chart='my-chart'>Chart</div>";
    const placeholders = extractChartPlaceholders(html);

    expect(placeholders).toEqual(['my-chart']);
  });

  it('should return empty array when no placeholders', () => {
    const html = '<div>No charts here</div>';
    const placeholders = extractChartPlaceholders(html);

    expect(placeholders).toEqual([]);
  });

  it('should handle complex HTML', () => {
    const html = `
      <div class="dashboard">
        <section>
          <h2>Sales Overview</h2>
          <div class="chart-container" data-chart="sales-overview" data-title="Sales">
            Loading chart...
          </div>
        </section>
        <section>
          <h2>Revenue</h2>
          <div class="chart-container" data-chart="revenue-trend">
            Loading chart...
          </div>
        </section>
      </div>
    `;
    const placeholders = extractChartPlaceholders(html);

    expect(placeholders).toEqual(['sales-overview', 'revenue-trend']);
  });
});

describe('validateChartConfigs', () => {
  it('should validate when all configs exist', () => {
    const html = '<div data-chart="chart-1"></div><div data-chart="chart-2"></div>';
    const charts = {
      'chart-1': { type: 'bar' },
      'chart-2': { type: 'line' },
    };

    const result = validateChartConfigs(html, charts);

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('should detect missing chart configs', () => {
    const html = '<div data-chart="chart-1"></div><div data-chart="chart-2"></div>';
    const charts = {
      'chart-1': { type: 'bar' },
    };

    const result = validateChartConfigs(html, charts);

    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['chart-2']);
  });

  it('should handle empty HTML', () => {
    const html = '<div>No charts</div>';
    const charts = {};

    const result = validateChartConfigs(html, charts);

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('should handle extra chart configs', () => {
    const html = '<div data-chart="chart-1"></div>';
    const charts = {
      'chart-1': { type: 'bar' },
      'chart-2': { type: 'line' },
      'chart-3': { type: 'pie' },
    };

    const result = validateChartConfigs(html, charts);

    // Extra configs are OK, missing ones are not
    expect(result.valid).toBe(true);
  });
});
