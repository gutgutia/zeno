/**
 * E2B Template Definitions
 *
 * We maintain two templates for experimentation:
 * 1. templateNode (alias: zeno-claude-code) - Original Node.js based template
 * 2. templatePython (alias: zeno-claude-code-python) - Enhanced Python template
 *
 * Use build.ts to build either template.
 */

import { Template } from 'e2b';

// ============================================================================
// Template Aliases (used when creating sandboxes)
// ============================================================================

export const TEMPLATE_ALIASES = {
  node: 'zeno-claude-code',
  python: 'zeno-claude-code-python',
} as const;

export type TemplateType = keyof typeof TEMPLATE_ALIASES;

// ============================================================================
// Node.js Template (Original)
// ============================================================================

/**
 * Original template: Node.js with Claude Code CLI
 * Alias: zeno-claude-code
 *
 * This is the existing, stable template.
 */
export const templateNode = Template()
  .fromNodeImage('24')
  .aptInstall(['curl', 'git', 'ripgrep'])
  .npmInstall('@anthropic-ai/claude-code', { g: true });

// ============================================================================
// Python Template (Experimental)
// ============================================================================

/**
 * Enhanced template: Python with data science stack + Claude Code CLI
 * Alias: zeno-claude-code-python
 *
 * This gives the agent:
 * - Native Python for data analysis (pandas, numpy)
 * - File format support (Excel, PDF, Word, PowerPoint)
 * - Claude Code CLI for agentic execution
 * - Claude Agent SDK (Python) for future use
 */
export const templatePython = Template()
  // Start with Python 3.11 base
  .fromPythonImage('3.11')

  // System dependencies
  .aptInstall([
    'curl',
    'git',
    'ripgrep',
    // For PDF processing
    'poppler-utils',
    // For Node.js (needed for Claude Code CLI)
    'nodejs',
    'npm',
  ])

  // Data science and file processing packages
  .pipInstall([
    // Core data science
    'pandas',
    'numpy',

    // Excel support
    'openpyxl',
    'xlrd',

    // PDF support
    'pdfplumber',
    'PyMuPDF',

    // Document support
    'python-docx',
    'python-pptx',

    // Claude Agent SDK (Python) - for future use
    'anthropic-claude-agent-sdk',

    // Utilities
    'tabulate',
    'chardet',
  ])

  // Install Claude Code CLI globally via npm
  .npmInstall('@anthropic-ai/claude-code', { g: true });

// ============================================================================
// Default export (for backwards compatibility with existing build.ts)
// ============================================================================

export const template = templateNode;
