/**
 * Link Anonymous Edits Handler Tests
 * Tests for backend anonymous edit linking with OAuth authentication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleGithubBot } from '../../functions/_shared/handlers/github-bot.js';
import { NetlifyAdapter } from '../../wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { CryptoAdapter } from '../../functions/_shared/adapters/CryptoAdapter.js';
import {
  createMockNetlifyEvent,
  createMockConfigAdapter
} from '../helpers/adapterHelpers.js';
import { setupAPIMocks } from '../mocks/externalApis.js';

// Shared mock functions that persist across test instances
const mockAddLabels = vi.fn();
const mockListForRepo = vi.fn();
const mockPullsList = vi.fn();
const mockIssuesCreate = vi.fn();
const mockIssuesUpdate = vi.fn();
const mockIssuesLock = vi.fn();
const mockCreateComment = vi.fn();
const mockGetComment = vi.fn();
const mockListComments = vi.fn();

// Mock GitHub API responses
// Email hash for 'test@example.com' truncated to 46 chars
const testEmailHash = '973dfe463ec85785f5f95af5ba3906eedb2d931c24e698';

const mockGitHubAPI = {
  user: { id: 12345, login: 'testuser', email: 'test@example.com' },
  emails: [
    { email: 'test@example.com', primary: true, verified: true },
    { email: 'alt@example.com', primary: false, verified: true },
  ],
  prs: [
    {
      number: 101,
      labels: [
        { name: 'anonymous-edit' },
        { name: 'linkable' },
        { name: `ref:${testEmailHash}` }, // Matches test@example.com
      ],
      user: { login: 'wiki-bot', id: 88888 },
    },
    {
      number: 102,
      labels: [
        { name: 'anonymous-edit' },
        { name: 'linkable' },
        { name: `ref:${testEmailHash}` }, // Same hash
      ],
      user: { login: 'wiki-bot', id: 88888 },
    },
    {
      number: 103,
      labels: [
        { name: 'anonymous-edit' },
        { name: 'ref:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd' }, // Different hash, no 'linkable' label
      ],
      user: { login: 'wiki-bot', id: 88888 },
    },
  ],
  issues: [],
};

// Mock Octokit - use shared mock functions
vi.mock('@octokit/rest', () => {
  return {
    Octokit: class MockOctokit {
      constructor() {
        this.rest = {
          pulls: {
            list: mockPullsList,
          },
          issues: {
            addLabels: mockAddLabels,
            listForRepo: mockListForRepo,
            create: mockIssuesCreate,
            update: mockIssuesUpdate,
            lock: mockIssuesLock,
            createComment: mockCreateComment,
            getComment: mockGetComment,
            listComments: mockListComments,
          },
        };
      }
    }
  };
});

describe('handleGithubBot - link-anonymous-edits', () => {
  let configAdapter;
  let cryptoAdapter;
  let cleanupMocks;

  beforeEach(() => {
    configAdapter = createMockConfigAdapter();
    cryptoAdapter = new CryptoAdapter('netlify');
    cleanupMocks = setupAPIMocks();

    // Reset all mock functions
    mockAddLabels.mockClear();
    mockListForRepo.mockClear();
    mockPullsList.mockClear();
    mockIssuesCreate.mockClear();
    mockIssuesUpdate.mockClear();
    mockIssuesLock.mockClear();
    mockCreateComment.mockClear();
    mockGetComment.mockClear();
    mockListComments.mockClear();

    // Set default mock implementations
    mockPullsList.mockResolvedValue({ data: mockGitHubAPI.prs });
    mockListForRepo.mockResolvedValue({ data: mockGitHubAPI.issues });
    mockAddLabels.mockResolvedValue({ data: {} });
    mockIssuesCreate.mockImplementation((params) => Promise.resolve({
      data: {
        id: 999,
        number: 999,
        title: params.title,
        body: params.body,
        labels: params.labels || [],
      }
    }));
    mockIssuesUpdate.mockResolvedValue({ data: {} });
    mockIssuesLock.mockResolvedValue({ data: {} });
    mockCreateComment.mockImplementation((params) => Promise.resolve({
      data: {
        id: Date.now(), // Unique comment ID
        body: params.body,
      }
    }));
    mockGetComment.mockImplementation((params) => Promise.resolve({
      data: {
        id: params.comment_id,
        body: JSON.stringify({
          emailHash: testEmailHash,
          userId: 12345,
          username: 'testuser',
          linkedAt: new Date().toISOString(),
        }),
      }
    }));
    mockListComments.mockResolvedValue({ data: [] });

    // Mock GitHub user API (receives calls from our server with 'token' format)
    global.fetch = vi.fn(async (url, options) => {
      if (url === 'https://api.github.com/user') {
        const authHeader = options?.headers?.Authorization;
        if (!authHeader || !authHeader.startsWith('token ')) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
          };
        }
        if (authHeader === 'token valid-token') {
          return {
            ok: true,
            json: async () => mockGitHubAPI.user,
          };
        }
        if (authHeader === 'token no-email-token') {
          return {
            ok: true,
            json: async () => ({ ...mockGitHubAPI.user, email: null }),
          };
        }
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Invalid token' }),
        };
      }
      if (url === 'https://api.github.com/user/emails') {
        return {
          ok: true,
          json: async () => mockGitHubAPI.emails,
        };
      }
      return { ok: false, status: 404 };
    });
  });

  afterEach(() => {
    if (cleanupMocks) cleanupMocks();
    vi.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should reject request without Authorization header', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      const result = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Authorization');
    });

    it('should reject request with invalid Authorization format', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'InvalidFormat token123',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      const result = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(result.statusCode).toBe(401);
    });

    it('should validate OAuth token with GitHub API', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'token valid-token',
          }),
        })
      );
    });

    it('should reject invalid OAuth token', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      const result = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('token');
    });
  });

  describe('Email Fetching', () => {
    it('should use email from /user if available', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      const result = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(result.statusCode).toBe(200);
      // Should not call /user/emails since email is already in /user response
      const emailsCall = [...fetch.mock.calls].find(call => call[0] === 'https://api.github.com/user/emails');
      expect(emailsCall).toBeUndefined();
    });

    it('should fetch from /user/emails when email is null', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer no-email-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      const result = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(result.statusCode).toBe(200);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/user/emails',
        expect.any(Object)
      );
    });

    it('should return error when no verified email found', async () => {
      // Mock /user/emails to return empty array
      global.fetch = vi.fn(async (url, options) => {
        if (url === 'https://api.github.com/user') {
          return {
            ok: true,
            json: async () => ({ id: 12345, login: 'testuser', email: null }),
          };
        }
        if (url === 'https://api.github.com/user/emails') {
          return {
            ok: true,
            json: async () => [], // No emails
          };
        }
        return { ok: false, status: 404 };
      });

      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer no-email-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      const result = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('email');
    });
  });

  describe('PR Linking', () => {
    it('should find and link PRs with matching hash and linkable label', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      const result = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.linked).toBe(true);
      expect(body.linkedCount).toBe(2); // PRs 101 and 102 have linkable label
    });

    it('should add user-id label to linked PRs', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      // Should add user-id:12345 label to PR 101 and 102
      expect(mockAddLabels).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          issue_number: 101,
          labels: ['user-id:12345'],
        })
      );
      expect(mockAddLabels).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          issue_number: 102,
          labels: ['user-id:12345'],
        })
      );
    });

    it('should not link PRs without linkable label', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      // Should NOT add label to PR 103 (no linkable flag)
      const pr103Calls = mockAddLabels.mock.calls.filter(
        call => call[0].issue_number === 103
      );
      expect(pr103Calls).toHaveLength(0);
    });

    it('should return zero count when no linkable PRs found', async () => {
      // Mock empty PR list
      mockPullsList.mockResolvedValue({ data: [] });

      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      const result = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.linked).toBe(true);
      expect(body.linkedCount).toBe(0);
    });
  });

  describe('User Index', () => {
    it('should create user index issue if not exists', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      // Should check for existing user index issue
      expect(mockListForRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          labels: 'user-index',
        })
      );
    });
  });

  describe('Security', () => {
    it('should not trust client-provided userId', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
          userId: 99999, // Attacker tries to spoof userId
          username: 'attacker',
          emailHash: 'fake-hash',
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      const result = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);

      // Should use real userId from token (12345), not the fake one (99999)
      // Labels added should be user-id:12345, not user-id:99999
      const addLabelsCall = mockAddLabels.mock.calls[0];
      if (addLabelsCall) {
        expect(addLabelsCall[0].labels[0]).toBe('user-id:12345');
        expect(addLabelsCall[0].labels[0]).not.toBe('user-id:99999');
      } else {
        // If no labels were added (empty PR list), just verify response is correct
        expect(body.linked).toBe(true);
      }
    });

    it('should hash email server-side, not trust client', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          action: 'link-anonymous-edits',
          owner: 'test-owner',
          repo: 'test-repo',
          emailHash: 'attacker-provided-hash', // Should be ignored
        }),
      });

      const adapter = new NetlifyAdapter(event, {});
      await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      // Backend should fetch user data from GitHub API (not trust request body)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.any(Object)
      );
    });
  });
});
