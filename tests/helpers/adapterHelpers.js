/**
 * Adapter Test Helpers
 * Helper functions for creating mock adapters in tests
 */

import { vi } from 'vitest';

/**
 * Create mock Netlify event
 */
export function createMockNetlifyEvent(overrides = {}) {
  return {
    httpMethod: overrides.httpMethod || 'GET',
    headers: overrides.headers || {},
    body: overrides.body || null,
    queryStringParameters: overrides.queryStringParameters || {},
    path: overrides.path || '/',
    ...overrides
  };
}

/**
 * Create mock Cloudflare context
 */
export function createMockCloudflareContext(overrides = {}) {
  const body = overrides.body || '';
  const method = overrides.method || 'GET';
  const url = overrides.url || 'https://example.com/api/test';
  const headers = overrides.headers || {};

  return {
    request: {
      method,
      url,
      headers: new Map(Object.entries(headers)),
      text: vi.fn().mockResolvedValue(body),
      json: vi.fn().mockResolvedValue(body ? JSON.parse(body) : {}),
      clone: vi.fn().mockReturnThis()
    },
    env: overrides.env || {},
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    ...overrides
  };
}

/**
 * Create mock ConfigAdapter
 */
export function createMockConfigAdapter(platform = 'test') {
  return {
    platform,
    getWikiConfig: vi.fn().mockReturnValue({
      siteTitle: 'Test Wiki',
      repo: {
        owner: 'test-owner',
        name: 'test-repo'
      }
    }),
    getStorageConfig: vi.fn().mockReturnValue({
      backend: 'github',
      version: 'v1',
      github: {
        owner: 'test-owner',
        repo: 'test-repo'
      }
    }),
    _loadFromFilesystem: vi.fn(),
    _getDefaultConfig: vi.fn()
  };
}

/**
 * Mock createWikiStorage to return mock storage
 */
export function mockCreateWikiStorage(mockStorage) {
  return vi.fn(() => mockStorage);
}

/**
 * Parse Netlify response format
 */
export function parseNetlifyResponse(response) {
  return {
    statusCode: response.statusCode,
    body: JSON.parse(response.body),
    headers: response.headers
  };
}

/**
 * Parse Cloudflare response format
 */
export async function parseCloudflareResponse(response) {
  const text = await response.text();
  return {
    status: response.status,
    body: JSON.parse(text),
    headers: Object.fromEntries(response.headers.entries())
  };
}

/**
 * Create mock environment variables
 */
export function createMockEnv(overrides = {}) {
  return {
    WIKI_BOT_TOKEN: 'test-bot-token',
    WIKI_BOT_USERNAME: 'test-wiki-bot',
    WIKI_REPO_OWNER: 'test-owner',
    WIKI_REPO_NAME: 'test-repo',
    VITE_WIKI_REPO_OWNER: 'test-owner',
    VITE_WIKI_REPO_NAME: 'test-repo',
    GITHUB_CLIENT_ID: 'test-client-id',
    GITHUB_CLIENT_SECRET: 'test-client-secret',
    SENDGRID_API_KEY: 'test-sendgrid-key',
    SENDGRID_FROM_EMAIL: 'test@example.com',
    EMAIL_VERIFICATION_SECRET: 'test-email-verification-secret-key-32chars-long',
    RECAPTCHA_SECRET_KEY: 'test-recaptcha-secret',
    OPENAI_API_KEY: 'test-openai-key',
    ...overrides
  };
}
