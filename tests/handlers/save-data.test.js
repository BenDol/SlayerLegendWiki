/**
 * Save Data Handler Tests
 * Comprehensive integration tests for saving user data and grid submissions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleSaveData } from '../../functions/_shared/handlers/save-data.js';
import { NetlifyAdapter, CloudflareAdapter } from '../../wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import {
  createMockNetlifyEvent,
  createMockCloudflareContext,
  createMockConfigAdapter,
  createMockEnv
} from '../helpers/adapterHelpers.js';
import { createMockStorage } from '../mocks/storage.js';
import { mockSkillBuild, mockGridSubmission, mockSpiritBuild, mockEngravingBuild } from '../fixtures/testData.js';
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

describe('handleSaveData', () => {
  let configAdapter;

  beforeEach(() => {
    configAdapter = createMockConfigAdapter();
  });

  describe('Netlify Platform', () => {
    describe('User-Centric Data', () => {
      it('should save new skill build successfully', async () => {
        const event = createMockNetlifyEvent({
          httpMethod: 'POST',
          headers: {
            authorization: 'Bearer github-token-123'
          },
          body: JSON.stringify({
            type: 'skill-builds',
            data: mockSkillBuild
          })
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleSaveData(adapter, configAdapter);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body).toHaveProperty('builds');
      });

      it('should update existing skill build', async () => {
        const existingBuild = { ...mockSkillBuild, id: 'existing-1' };
        const event = createMockNetlifyEvent({
          httpMethod: 'POST',
          headers: {
            authorization: 'Bearer github-token-123'
          },
          body: JSON.stringify({
            type: 'skill-builds',
            data: { ...existingBuild, description: 'Updated description' }
          })
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleSaveData(adapter, configAdapter);

        expect(response.statusCode).toBe(200);
      });

      it('should save engraving build successfully', async () => {
        const event = createMockNetlifyEvent({
          httpMethod: 'POST',
          headers: {
            authorization: 'Bearer github-token-123'
          },
          body: JSON.stringify({
            type: 'engraving-builds',
            data: mockEngravingBuild
          })
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleSaveData(adapter, configAdapter);

        expect(response.statusCode).toBe(200);
      });

      it('should require authentication', async () => {
        const event = createMockNetlifyEvent({
          httpMethod: 'POST',
          body: JSON.stringify({
            type: 'skill-builds',
            data: mockSkillBuild
            // missing authorization header
          })
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleSaveData(adapter, configAdapter);

        expect(response.statusCode).toBe(401);
      });

      it('should validate engraving build structure', async () => {
        const event = createMockNetlifyEvent({
          httpMethod: 'POST',
          headers: {
            authorization: 'Bearer github-token-123'
          },
          body: JSON.stringify({
            type: 'engraving-builds',
            data: { invalid: 'data' } // Missing required fields
          })
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleSaveData(adapter, configAdapter);

        expect(response.statusCode).toBe(400);
      });
    });

    describe('Grid Submissions', () => {
      it('should save new grid submission successfully', async () => {
        const event = createMockNetlifyEvent({
          httpMethod: 'POST',
          body: JSON.stringify({
            type: 'grid-submission',
            username: 'testuser',
            data: mockGridSubmission
          })
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleSaveData(adapter, configAdapter);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body).toHaveProperty('submission');
      });

      it('should replace existing grid submission in replace mode', async () => {
        const event = createMockNetlifyEvent({
          httpMethod: 'POST',
          body: JSON.stringify({
            type: 'grid-submission',
            username: 'testuser',
            data: mockGridSubmission,
            replace: true
          })
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleSaveData(adapter, configAdapter);

        expect(response.statusCode).toBe(200);
      });

      it('should validate grid submission structure', async () => {
        const event = createMockNetlifyEvent({
          httpMethod: 'POST',
          body: JSON.stringify({
            type: 'grid-submission',
            username: 'testuser',
            data: { invalid: 'data' }
          })
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleSaveData(adapter, configAdapter);

        expect(response.statusCode).toBe(400);
      });
    });

    describe('Validation', () => {
      it('should reject non-POST requests', async () => {
        const event = createMockNetlifyEvent({
          httpMethod: 'GET'
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleSaveData(adapter, configAdapter);

        expect(response.statusCode).toBe(405);
      });

      it('should validate request body size', async () => {
        const hugeData = { data: 'x'.repeat(10000000) }; // 10MB
        const event = createMockNetlifyEvent({
          httpMethod: 'POST',
          body: JSON.stringify({
            type: 'skill-builds',
            username: 'testuser',
            userId: 12345,
            data: hugeData
          })
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleSaveData(adapter, configAdapter);

        expect(response.statusCode).toBe(413);
      });

      it('should validate data type', async () => {
        const event = createMockNetlifyEvent({
          httpMethod: 'POST',
          body: JSON.stringify({
            type: 'invalid-type',
            username: 'testuser',
            userId: 12345,
            data: mockSkillBuild
          })
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleSaveData(adapter, configAdapter);

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('Cloudflare Platform', () => {
    it('should save skill build successfully', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        headers: {
          authorization: 'Bearer github-token-123'
        },
        env: createMockEnv(),
        body: JSON.stringify({
          type: 'skill-builds',
          data: mockSkillBuild
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleSaveData(adapter, configAdapter);

      expect(response.status).toBe(200);
    });

    it('should save grid submission successfully', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        env: createMockEnv(),
        body: JSON.stringify({
          type: 'grid-submission',
          username: 'testuser',
          data: mockGridSubmission
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleSaveData(adapter, configAdapter);

      expect(response.status).toBe(200);
    });
  });
});
