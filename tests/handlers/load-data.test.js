/**
 * Load Data Handler Tests
 * Comprehensive integration tests for loading user data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleLoadData } from '../../functions/_shared/handlers/load-data.js';
import { NetlifyAdapter, CloudflareAdapter } from '../../wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import {
  createMockNetlifyEvent,
  createMockCloudflareContext,
  createMockConfigAdapter,
  createMockEnv
} from '../helpers/adapterHelpers.js';
import { createMockStorage } from '../mocks/storage.js';
import { mockSkillBuild, mockBattleLoadout, mockSpirit, mockSpiritBuild, mockEngravingBuild } from '../fixtures/testData.js';

// Mock createWikiStorage - use async factory to avoid hoisting issues
vi.mock('../../functions/_shared/createWikiStorage.js', async () => {
  const { createMockStorage } = await import('../mocks/storage.js');
  const { mockSkillBuild, mockBattleLoadout, mockSpirit, mockSpiritBuild, mockEngravingBuild } = await import('../fixtures/testData.js');

  let mockStorage;
  return {
    createWikiStorage: vi.fn(() => {
      if (!mockStorage) {
        mockStorage = createMockStorage({
          'skill-builds': {
            '12345': [mockSkillBuild]
          },
          'battle-loadouts': {
            '12345': [mockBattleLoadout]
          },
          'my-spirits': {
            '12345': [mockSpirit]
          },
          'spirit-builds': {
            '12345': [mockSpiritBuild]
          },
          'engraving-builds': {
            '12345': [mockEngravingBuild]
          }
        });
      }
      return mockStorage;
    })
  };
});

describe('handleLoadData', () => {
  let configAdapter;
  let storage;

  beforeEach(() => {
    configAdapter = createMockConfigAdapter();
    storage = createMockStorage({
      'skill-builds': { '12345': [mockSkillBuild] },
      'battle-loadouts': { '12345': [mockBattleLoadout] },
      'my-spirits': { '12345': [mockSpirit] },
      'spirit-builds': { '12345': [mockSpiritBuild] },
      'engraving-builds': { '12345': [mockEngravingBuild] }
    });
  });

  describe('Netlify Platform', () => {
    it('should load skill builds successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'skill-builds',
          userId: '12345'
        }
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleLoadData(adapter, configAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('builds');
      expect(Array.isArray(body.builds)).toBe(true);
    });

    it('should load battle loadouts successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'battle-loadouts',
          userId: '12345'
        }
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleLoadData(adapter, configAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('loadouts');
    });

    it('should load my-spirits successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'my-spirits',
          userId: '12345'
        }
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleLoadData(adapter, configAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('spirits');
    });

    it('should load engraving builds successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'engraving-builds',
          userId: '12345'
        }
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleLoadData(adapter, configAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('builds');
    });

    it('should reject non-GET requests', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST'
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleLoadData(adapter, configAdapter);

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('should validate required type parameter', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          userId: '12345'
        }
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleLoadData(adapter, configAdapter);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('type');
    });

    it('should validate required userId parameter', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'skill-builds'
        }
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleLoadData(adapter, configAdapter);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('userId');
    });

    it('should validate data type', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'invalid-type',
          userId: '12345'
        }
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleLoadData(adapter, configAdapter);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid type');
    });

    it('should return empty array for user with no data', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'skill-builds',
          userId: '99999' // User with no data
        }
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleLoadData(adapter, configAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.builds).toEqual([]);
    });
  });

  describe('Cloudflare Platform', () => {
    it('should load skill builds successfully', async () => {
      const context = createMockCloudflareContext({
        method: 'GET',
        env: createMockEnv(),
        url: 'https://example.com/api/load-data?type=skill-builds&userId=12345'
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleLoadData(adapter, configAdapter);

      expect(response.status).toBe(200);
      const body = JSON.parse(await response.text());
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('builds');
    });

    it('should reject non-GET requests', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        env: createMockEnv()
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleLoadData(adapter, configAdapter);

      expect(response.status).toBe(405);
      const body = JSON.parse(await response.text());
      expect(body.error).toBe('Method not allowed');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should produce equivalent responses on both platforms', async () => {
      const netlifyEvent = createMockNetlifyEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'skill-builds',
          userId: '12345'
        }
      });
      const netlifyAdapter = new NetlifyAdapter(netlifyEvent);

      const cloudflareContext = createMockCloudflareContext({
        method: 'GET',
        env: createMockEnv(),
        url: 'https://example.com/api/load-data?type=skill-builds&userId=12345'
      });
      const cloudflareAdapter = new CloudflareAdapter(cloudflareContext);

      const netlifyResponse = await handleLoadData(netlifyAdapter, configAdapter);
      const cloudflareResponse = await handleLoadData(cloudflareAdapter, configAdapter);

      expect(netlifyResponse.statusCode).toBe(cloudflareResponse.status);

      const netlifyBody = JSON.parse(netlifyResponse.body);
      const cloudflareBody = JSON.parse(await cloudflareResponse.text());

      expect(netlifyBody.success).toBe(cloudflareBody.success);
    });
  });
});
