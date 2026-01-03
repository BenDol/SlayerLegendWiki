/**
 * Access Token Handler Tests
 * Comprehensive integration tests for OAuth device flow token polling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleAccessToken } from '../../functions/_shared/handlers/access-token.js';
import { NetlifyAdapter, CloudflareAdapter } from '../../wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import {
  createMockNetlifyEvent,
  createMockCloudflareContext
} from '../helpers/adapterHelpers.js';
import { setupAPIMocks } from '../mocks/externalApis.js';

describe('handleAccessToken', () => {
  let cleanupMocks;

  beforeEach(() => {
    cleanupMocks = setupAPIMocks();
  });

  afterEach(() => {
    if (cleanupMocks) cleanupMocks();
    vi.restoreAllMocks();
  });

  describe('Netlify Platform', () => {
    it('should exchange device code for access token successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'test-device-code-12345',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleAccessToken(adapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('token_type');
      expect(body.token_type).toBe('bearer');
    });

    it('should reject non-POST requests', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET'
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleAccessToken(adapter);

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('should handle authorization_pending error', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'pending', // Mock will return pending
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleAccessToken(adapter);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('authorization_pending');
    });

    it('should handle expired_token error', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'expired', // Mock will return expired
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleAccessToken(adapter);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('expired_token');
    });

    it('should validate required fields', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id'
          // missing device_code
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleAccessToken(adapter);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeTruthy();
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'test-device-code',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleAccessToken(adapter);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBeTruthy();
    });

    it('should include CORS headers', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'test-device-code',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleAccessToken(adapter);

      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('Cloudflare Platform', () => {
    it('should exchange device code for access token successfully', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'test-device-code-12345',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleAccessToken(adapter);

      expect(response.status).toBe(200);
      const body = JSON.parse(await response.text());
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('token_type');
      expect(body.token_type).toBe('bearer');
    });

    it('should reject non-POST requests', async () => {
      const context = createMockCloudflareContext({
        method: 'GET'
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleAccessToken(adapter);

      expect(response.status).toBe(405);
      const body = JSON.parse(await response.text());
      expect(body.error).toBe('Method not allowed');
    });

    it('should handle authorization_pending error', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'pending',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleAccessToken(adapter);

      expect(response.status).toBe(400);
      const body = JSON.parse(await response.text());
      expect(body.error).toBe('authorization_pending');
    });

    it('should handle expired_token error', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'expired',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleAccessToken(adapter);

      expect(response.status).toBe(400);
      const body = JSON.parse(await response.text());
      expect(body.error).toBe('expired_token');
    });

    it('should validate required fields', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id'
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleAccessToken(adapter);

      expect(response.status).toBe(400);
      const body = JSON.parse(await response.text());
      expect(body.error).toBeTruthy();
    });

    it('should include CORS headers', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'test-device-code',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleAccessToken(adapter);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should produce equivalent responses on both platforms', async () => {
      const netlifyEvent = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'test-device-code',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const netlifyAdapter = new NetlifyAdapter(netlifyEvent);

      const cloudflareContext = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'test-device-code',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const cloudflareAdapter = new CloudflareAdapter(cloudflareContext);

      const netlifyResponse = await handleAccessToken(netlifyAdapter);
      const cloudflareResponse = await handleAccessToken(cloudflareAdapter);

      expect(netlifyResponse.statusCode).toBe(cloudflareResponse.status);

      const netlifyBody = JSON.parse(netlifyResponse.body);
      const cloudflareBody = JSON.parse(await cloudflareResponse.text());

      expect(netlifyBody.access_token).toBe(cloudflareBody.access_token);
      expect(netlifyBody.token_type).toBe(cloudflareBody.token_type);
    });

    it('should handle errors identically on both platforms', async () => {
      const netlifyEvent = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'pending',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const netlifyAdapter = new NetlifyAdapter(netlifyEvent);

      const cloudflareContext = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'pending',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const cloudflareAdapter = new CloudflareAdapter(cloudflareContext);

      const netlifyResponse = await handleAccessToken(netlifyAdapter);
      const cloudflareResponse = await handleAccessToken(cloudflareAdapter);

      expect(netlifyResponse.statusCode).toBe(cloudflareResponse.status);

      const netlifyBody = JSON.parse(netlifyResponse.body);
      const cloudflareBody = JSON.parse(await cloudflareResponse.text());

      expect(netlifyBody.error).toBe(cloudflareBody.error);
    });
  });

  describe('OAuth Spec Compliance', () => {
    it('should return all required OAuth token response fields', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          device_code: 'test-device-code',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleAccessToken(adapter);
      const body = JSON.parse(response.body);

      // RFC 8628 required fields
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('token_type');

      expect(typeof body.access_token).toBe('string');
      expect(typeof body.token_type).toBe('string');
      expect(body.token_type).toBe('bearer');
    });

    it('should handle all OAuth error types', async () => {
      const errorTypes = [
        { device_code: 'pending', expected_error: 'authorization_pending' },
        { device_code: 'expired', expected_error: 'expired_token' }
      ];

      for (const { device_code, expected_error } of errorTypes) {
        const event = createMockNetlifyEvent({
          httpMethod: 'POST',
          body: JSON.stringify({
            client_id: 'test-client-id',
            device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        });
        const adapter = new NetlifyAdapter(event);

        const response = await handleAccessToken(adapter);
        const body = JSON.parse(response.body);

        expect(body.error).toBe(expected_error);
      }
    });
  });
});
