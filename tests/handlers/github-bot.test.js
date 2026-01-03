/**
 * GitHub Bot Handler Tests
 * Comprehensive integration tests for all 11 GitHub bot actions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleGithubBot } from '../../functions/_shared/handlers/github-bot.js';
import { NetlifyAdapter, CloudflareAdapter } from '../../wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { CryptoAdapter } from '../../functions/_shared/adapters/CryptoAdapter.js';
import {
  createMockNetlifyEvent,
  createMockCloudflareContext,
  createMockConfigAdapter
} from '../helpers/adapterHelpers.js';
import { createMockOctokit } from '../mocks/octokit.js';
import { setupAPIMocks } from '../mocks/externalApis.js';
import * as jwt from '../../functions/_shared/jwt.js';

// Mock Octokit - must be inline since vi.mock() is hoisted before imports
vi.mock('@octokit/rest', () => {
  return {
    Octokit: class MockOctokit {
      constructor() {
        // Simple mock implementation without vi.fn() - just return promises
        this.rest = {
          issues: {
            create: (params) => Promise.resolve({
              data: {
                id: 1,
                number: 1,
                title: params.title,
                body: params.body || '',
                labels: params.labels || []
              }
            }),
            update: () => Promise.resolve({ data: { id: 1, number: 1 } }),
            createComment: () => Promise.resolve({ data: { id: 1, body: 'test' } }),
            getComment: () => Promise.resolve({ data: { id: 1, body: 'test' } }),
            listForRepo: () => Promise.resolve({
              data: [{
                id: 1,
                number: 1,
                title: 'Test Issue',
                user: { login: 'test-wiki-bot' }
              }]
            }),
            addLabels: () => Promise.resolve({ data: { id: 1 } }),
            lock: () => Promise.resolve({ data: {} }),
          },
          pulls: {
            create: () => Promise.resolve({ data: { id: 1, number: 1 } }),
          },
          repos: {
            get: () => Promise.resolve({ data: { owner: { login: 'test-owner' }, name: 'test-repo' } }),
            getContent: () => Promise.resolve({ data: { sha: 'test-sha', content: Buffer.from('test').toString('base64') } }),
            createOrUpdateFileContents: () => Promise.resolve({ data: { content: { sha: 'new-sha' } } }),
            getBranch: () => Promise.resolve({ data: { commit: { sha: 'commit-sha' } } }),
          },
          git: {
            createRef: () => Promise.resolve({ data: { ref: 'refs/heads/test' } }),
            createTree: () => Promise.resolve({ data: { sha: 'tree-sha' } }),
            createCommit: () => Promise.resolve({ data: { sha: 'commit-sha' } }),
          },
          users: {
            getByUsername: () => Promise.resolve({ data: { id: 123, login: 'testuser' } }),
          },
        };
      }
    }
  };
});

describe('handleGithubBot', () => {
  let configAdapter;
  let cryptoAdapter;
  let cleanupMocks;

  beforeEach(() => {
    configAdapter = createMockConfigAdapter();
    cryptoAdapter = new CryptoAdapter('netlify');
    cleanupMocks = setupAPIMocks();
  });

  afterEach(() => {
    if (cleanupMocks) cleanupMocks();
    vi.restoreAllMocks();
  });

  describe('Action: create-comment', () => {
    it('should create comment successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-comment',
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 1,
          body: 'Test comment'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('comment');
    });

    it('should validate comment body', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-comment',
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 1,
          body: '' // Empty body
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Action: update-issue', () => {
    it('should update issue successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'update-issue',
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 1,
          body: 'Updated body'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Action: list-issues', () => {
    it('should list issues by label', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'list-issues',
          owner: 'test-owner',
          repo: 'test-repo',
          labels: 'bug'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('issues');
    });
  });

  describe('Action: create-comment-issue', () => {
    it('should create comment issue successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-comment-issue',
          owner: 'test-owner',
          repo: 'test-repo',
          title: 'Test Issue',
          body: 'Test body',
          labels: ['comment']
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Action: send-verification-email', () => {
    it('should send verification email successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'send-verification-email',
          owner: 'test-owner',
          repo: 'test-repo',
          email: 'test@example.com'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Verification code sent');
    });

    it('should validate email format', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'send-verification-email',
          owner: 'test-owner',
          repo: 'test-repo',
          email: 'invalid-email'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Action: create-anonymous-pr', () => {
    it('should create anonymous PR with all validations', async () => {
      const verificationToken = await jwt.sign(
        { email: 'test@example.com', timestamp: Date.now(), type: 'email-verification' },
        process.env.EMAIL_VERIFICATION_SECRET,
        86400
      );

      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-anonymous-pr',
          owner: 'test-owner',
          repo: 'test-repo',
          section: 'guides',
          pageId: 'test-page',
          pageTitle: 'Test Page',
          content: '# Test Content',
          email: 'test@example.com',
          displayName: 'Test User',
          reason: 'Fixed typo',
          verificationToken,
          captchaToken: 'test-captcha-token'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('pr');
    });

    it('should reject profane display name', async () => {
      const verificationToken = await jwt.sign(
        { email: 'test@example.com', timestamp: Date.now(), type: 'email-verification' },
        process.env.EMAIL_VERIFICATION_SECRET,
        86400
      );

      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-anonymous-pr',
          owner: 'test-owner',
          repo: 'test-repo',
          section: 'guides',
          pageId: 'test-page',
          pageTitle: 'Test Page',
          content: '# Test Content',
          email: 'test@example.com',
          displayName: 'badword user', // Will be flagged by mock
          reason: 'Fixed typo',
          verificationToken,
          captchaToken: 'test-captcha-token'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('inappropriate');
    });
  });

  describe('Common Validation', () => {
    it('should reject non-POST requests', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET'
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(405);
    });

    it('should validate required fields', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          // missing action, owner, repo
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(400);
    });

    it('should handle unknown actions', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'unknown-action',
          owner: 'test-owner',
          repo: 'test-repo'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unknown action');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work identically on both platforms', async () => {
      const netlifyEvent = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-comment',
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 1,
          body: 'Test comment'
        })
      });
      const netlifyAdapter = new NetlifyAdapter(netlifyEvent);

      const cloudflareContext = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          action: 'create-comment',
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 1,
          body: 'Test comment'
        }),
        env: {
          WIKI_BOT_TOKEN: process.env.WIKI_BOT_TOKEN
        }
      });
      const cloudflareAdapter = new CloudflareAdapter(cloudflareContext);
      const cloudflareCryptoAdapter = new CryptoAdapter('cloudflare');

      const netlifyResponse = await handleGithubBot(netlifyAdapter, configAdapter, cryptoAdapter);
      const cloudflareResponse = await handleGithubBot(cloudflareAdapter, configAdapter, cloudflareCryptoAdapter);

      expect(netlifyResponse.statusCode).toBe(cloudflareResponse.status);
    });
  });
});
