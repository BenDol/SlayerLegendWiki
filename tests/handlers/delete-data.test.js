/**
 * Delete Data Handler Tests
 * Comprehensive integration tests for deleting user data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleDeleteData } from '../../functions/_shared/handlers/delete-data.js';
import { NetlifyAdapter, CloudflareAdapter } from '../../wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import {
  createMockNetlifyEvent,
  createMockCloudflareContext,
  createMockConfigAdapter,
  createMockEnv
} from '../helpers/adapterHelpers.js';
import { createMockStorage } from '../mocks/storage.js';
import { mockSkillBuild, mockBattleLoadout } from '../fixtures/testData.js';
import { createMockOctokit } from '../mocks/octokit.js';

// Mock createWikiStorage - use factory to avoid hoisting issues
vi.mock('../../functions/_shared/createWikiStorage.js', async () => {
  const { createMockStorage } = await import('../mocks/storage.js');
  return {
    createWikiStorage: vi.fn(() => createMockStorage())
  };
});

// Mock Octokit for authentication
vi.mock('@octokit/rest', async () => {
  const { createMockOctokit } = await import('../mocks/octokit.js');
  return {
    Octokit: vi.fn(function() {
      return createMockOctokit();
    })
  };
});

describe('handleDeleteData', () => {
  let configAdapter;

  beforeEach(() => {
    configAdapter = createMockConfigAdapter();
  });

  describe('Netlify Platform', () => {
    it('should delete skill build successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          authorization: 'Bearer github-token-123'
        },
        body: JSON.stringify({
          type: 'skill-builds',
          itemId: 'skill-1'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeleteData(adapter, configAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject non-POST requests', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET'
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeleteData(adapter, configAdapter);

      expect(response.statusCode).toBe(405);
    });

    it('should validate required fields', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          type: 'skill-builds'
          // missing username, userId, itemId
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeleteData(adapter, configAdapter);

      expect(response.statusCode).toBe(400);
    });

    it('should validate data type', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          type: 'invalid-type',
          username: 'testuser',
          userId: 12345,
          itemId: 'item-1'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeleteData(adapter, configAdapter);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Cloudflare Platform', () => {
    it('should delete skill build successfully', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        headers: {
          authorization: 'Bearer github-token-123'
        },
        env: createMockEnv(),
        body: JSON.stringify({
          type: 'skill-builds',
          itemId: 'skill-1'
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleDeleteData(adapter, configAdapter);

      expect(response.status).toBe(200);
    });
  });
});
