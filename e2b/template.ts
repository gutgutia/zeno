/**
 * E2B Template Definition for Claude Code sandbox
 *
 * This template creates a sandbox with:
 * - Python runtime with data science stack
 * - Node.js for Claude Code CLI
 * - Required system dependencies for file processing
 *
 * Two execution modes are supported:
 * 1. Claude Code CLI (Node.js) - current approach
 * 2. Claude Agent SDK (Python) - alternative approach with native data access
 */

import { Template } from 'e2b';

/**
 * Main template: Python-based with full data science stack
 *
 * This gives the agent:
 * - Native Python for data analysis (pandas, numpy)
 * - File format support (Excel, PDF, Word, PowerPoint)
 * - Claude Code CLI for agentic execution
 * - Claude Agent SDK (Python) for alternative execution
 */
export const template = Template()
  // Start with Python 3.11 base
  .fromPythonImage('3.11')

  // System dependencies for file parsing and tools
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

    // Claude Agent SDK (Python)
    'anthropic-claude-agent-sdk',

    // Utilities
    'tabulate',
    'chardet',
  ])

  // Install Claude Code CLI globally via npm
  // Note: This works because we installed nodejs and npm via aptInstall above
  .npmInstall('@anthropic-ai/claude-code', { g: true });

/**
 * Lightweight template: Just Claude Code CLI
 * Use this if you don't need Python data processing
 */
export const templateLite = Template()
  .fromNodeImage('24')
  .aptInstall(['curl', 'git', 'ripgrep'])
  .npmInstall('@anthropic-ai/claude-code@latest', { g: true });
