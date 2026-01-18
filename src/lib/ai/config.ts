/**
 * Centralized configuration for AI/Agent settings
 *
 * Change these values to quickly test different configurations.
 */

export const AI_CONFIG = {
  // ============================================================================
  // MODEL SELECTION
  // ============================================================================
  // Options: 'sonnet' (balanced), 'opus' (highest quality), 'haiku' (fastest)

  /** Model for dashboard generation */
  generateModel: 'haiku' as 'sonnet' | 'opus' | 'haiku',

  /** Model for dashboard modifications */
  modifyModel: 'sonnet' as 'sonnet' | 'opus' | 'haiku',

  /** Model for dashboard refresh/regeneration */
  refreshModel: 'sonnet' as 'sonnet' | 'opus' | 'haiku',

  // ============================================================================
  // SANDBOX TEMPLATE
  // ============================================================================

  /**
   * Which E2B sandbox template to use
   * - 'node': Original Node.js template (stable)
   * - 'python': Python template with data science stack (experimental)
   *
   * To build templates: npx tsx e2b/build.ts [node|python|all]
   */
  sandboxTemplate: 'node' as 'node' | 'python',

  // ============================================================================
  // LOGGING
  // ============================================================================

  /**
   * Enable verbose logging of agent execution
   * Shows turn-by-turn tool calls, thinking, and results
   */
  verboseLogging: false,

  // ============================================================================
  // TIMEOUTS
  // ============================================================================

  /** Sandbox timeout in ms (how long the E2B sandbox stays alive) */
  sandboxTimeoutMs: 480000, // 8 minutes

  /** Command timeout in ms (how long to wait for Claude CLI to complete) */
  commandTimeoutMs: 420000, // 7 minutes
};
