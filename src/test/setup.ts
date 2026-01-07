/**
 * Vitest Test Setup
 *
 * Global test configuration and mocks
 */

import { vi } from 'vitest';

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');

// Mock Supabase client for tests that need it
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        })),
        not: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  })),
}));

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
