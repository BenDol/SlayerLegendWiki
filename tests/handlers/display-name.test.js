/**
 * Display Name Handler Tests
 *
 * Focused on the security hardening from the bot-security remediation plan:
 * - canonical userId binding (no Number() aliasing)
 * - admin token in the Authorization header (query string deprecated)
 * - read-path registry caching with write invalidation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { handleDisplayName } from '../../functions/_shared/handlers/display-name.js';
import { NetlifyAdapter } from '../../wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { createMockNetlifyEvent, createMockConfigAdapter } from '../helpers/adapterHelpers.js';

// Shared spies so call counts can be asserted across requests (each request
// gets a storage instance from the mocked factory, but they share these).
const spies = vi.hoisted(() => ({
  getComment: vi.fn(),
  deleteComment: vi.fn(),
  updateComment: vi.fn(),
  createComment: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  findIssuesByLabels: vi.fn(),
}));

vi.mock('@octokit/rest', () => ({
  Octokit: class MockOctokit {
    constructor() {
      this.rest = {
        users: {
          // The authenticated caller is always user 12345 / "testuser".
          getAuthenticated: vi.fn().mockResolvedValue({ data: { id: 12345, login: 'testuser' } }),
        },
        repos: {
          getCollaboratorPermissionLevel: vi.fn().mockResolvedValue({ data: { permission: 'admin' } }),
        },
      };
    }
  },
}));

vi.mock('../../functions/_shared/createWikiStorage.js', () => ({
  createWikiStorage: vi.fn(() => ({
    _findIssuesByLabels: spies.findIssuesByLabels,
    octokit: {
      rest: {
        issues: {
          getComment: spies.getComment,
          deleteComment: spies.deleteComment,
          updateComment: spies.updateComment,
          createComment: spies.createComment,
          update: spies.update,
          create: spies.create,
        },
      },
    },
  })),
}));

const REGISTRY_ISSUE = { number: 500, title: '[Display Names Registry]', body: '[12345]=777\n' };
const EXISTING_RECORD = { userId: 12345, displayName: 'Tester', lastChanged: '2020-01-01T00:00:00Z' };

describe('handleDisplayName', () => {
  let configAdapter;
  let savedOpenAiKey;

  beforeAll(() => {
    // Keep moderation on the local word list so no network call is attempted.
    // Save and restore so the deletion cannot leak to other files in this worker.
    savedOpenAiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    if (savedOpenAiKey !== undefined) process.env.OPENAI_API_KEY = savedOpenAiKey;
  });

  beforeEach(() => {
    configAdapter = createMockConfigAdapter();
    spies.findIssuesByLabels.mockReset().mockResolvedValue([REGISTRY_ISSUE]);
    spies.getComment.mockReset().mockResolvedValue({ data: { body: JSON.stringify(EXISTING_RECORD) } });
    spies.deleteComment.mockReset().mockResolvedValue({ data: {} });
    spies.updateComment.mockReset().mockResolvedValue({ data: {} });
    spies.createComment.mockReset().mockResolvedValue({ data: { id: 778 } });
    spies.update.mockReset().mockResolvedValue({ data: {} });
    spies.create.mockReset().mockResolvedValue({ data: { number: 500, body: '' } });
  });

  const run = async (overrides) => {
    const event = createMockNetlifyEvent(overrides);
    const response = await handleDisplayName(new NetlifyAdapter(event), configAdapter);
    return { status: response.statusCode, body: JSON.parse(response.body) };
  };

  describe('canonical userId binding', () => {
    it('rejects a non-canonical userId alias even with a valid token', async () => {
      // "012345" would have passed the old Number() comparison for user 12345.
      const { status } = await run({
        httpMethod: 'POST',
        body: JSON.stringify({ action: 'set', userId: '012345', username: 'testuser', displayName: 'CleanName', token: 'tok' }),
      });
      expect(status).toBe(401);
    });

    it('accepts the canonical userId for the token holder', async () => {
      const { status } = await run({
        httpMethod: 'POST',
        body: JSON.stringify({ action: 'set', userId: '12345', username: 'testuser', displayName: 'CleanName', token: 'tok' }),
      });
      expect(status).not.toBe(401);
    });
  });

  describe('fail-closed moderation', () => {
    it('rejects a profane display name via the local word list when OpenAI is unavailable', async () => {
      // OPENAI_API_KEY is unset (beforeAll), so checkProfanity falls back to
      // leo-profanity instead of failing open.
      const { status } = await run({
        httpMethod: 'POST',
        body: JSON.stringify({ action: 'set', userId: '12345', username: 'testuser', displayName: 'shit', token: 'tok' }),
      });
      expect(status).toBe(400);
    });
  });

  describe('registry read cache', () => {
    it('serves repeated GETs from cache and loads the comments only once', async () => {
      // Use a repo unique to this test so the module-level cache key cannot
      // collide with (or be pre-populated by) any other test.
      const savedRepo = process.env.WIKI_REPO_NAME;
      process.env.WIKI_REPO_NAME = 'cache-isolation-repo';
      try {
        spies.getComment.mockClear();

        const first = await run({ httpMethod: 'GET', queryStringParameters: { userId: '12345' } });
        const second = await run({ httpMethod: 'GET', queryStringParameters: { userId: '12345' } });

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(first.body.displayName?.displayName).toBe('Tester');
        expect(second.body.displayName?.displayName).toBe('Tester');
        // One comment fetch for two requests: the N+1 amplification is gone.
        expect(spies.getComment).toHaveBeenCalledTimes(1);
      } finally {
        if (savedRepo !== undefined) process.env.WIKI_REPO_NAME = savedRepo;
      }
    });
  });

  describe('admin DELETE authorization transport', () => {
    it('accepts the admin token from the Authorization header', async () => {
      const { status } = await run({
        httpMethod: 'DELETE',
        headers: { authorization: 'Bearer admintok' },
        queryStringParameters: { userId: '12345' },
      });
      expect(status).toBe(200);
      expect(spies.deleteComment).toHaveBeenCalled();
    });

    it('still honours the deprecated adminToken query parameter', async () => {
      const { status } = await run({
        httpMethod: 'DELETE',
        queryStringParameters: { userId: '12345', adminToken: 'admintok' },
      });
      expect(status).toBe(200);
    });

    it('returns 400 when no admin authorization is supplied', async () => {
      const { status } = await run({
        httpMethod: 'DELETE',
        queryStringParameters: { userId: '12345' },
      });
      expect(status).toBe(400);
    });
  });
});
