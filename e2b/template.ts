/**
 * E2B Template Definition for Claude Code sandbox
 *
 * This template creates a sandbox with:
 * - Node.js runtime
 * - Claude Code CLI globally installed
 * - Required system dependencies
 */

import { Template } from 'e2b';

export const template = Template()
  .fromNodeImage('24')
  .aptInstall(['curl', 'git', 'ripgrep'])
  .npmInstall('@anthropic-ai/claude-code@latest', { g: true });
