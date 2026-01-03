/**
 * Device Code Handler Tests
 * Comprehensive integration tests for OAuth device flow initiation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleDeviceCode } from '../../functions/_shared/handlers/device-code.js';
import { NetlifyAdapter, CloudflareAdapter } from '../../wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import {
  createMockNetlifyEvent,
  createMockCloudflareContext
} from '../helpers/adapterHelpers.js';
import { setupAPIMocks } from '../mocks/externalApis.js';

describe('handleDeviceCode', () => {
  let cleanupMocks;

  beforeEach(() => {
    cleanupMocks = setupAPIMocks();
  });

  afterEach(() => {
    if (cleanupMocks) cleanupMocks();
    vi.restoreAllMocks();
  });

  describe('Netlify Platform', () => {
    it('should initiate device flow successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          scope: 'repo'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeviceCode(adapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('device_code');
      expect(body).toHaveProperty('user_code');
      expect(body).toHaveProperty('verification_uri');
      expect(body).toHaveProperty('expires_in');
      expect(body).toHaveProperty('interval');
    });

    it('should reject non-POST requests', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET'
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeviceCode(adapter);

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('should validate required client_id field', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          scope: 'repo'
          // missing client_id
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeviceCode(adapter);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeTruthy();
    });

    it('should handle GitHub API errors gracefully', async () => {
      // Mock fetch to return error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error' })
      });

      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          scope: 'repo'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeviceCode(adapter);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBeTruthy();
    });

    it('should handle invalid JSON body', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: 'invalid json'
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeviceCode(adapter);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBeTruthy();
    });

    it('should include CORS headers', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          scope: 'repo'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeviceCode(adapter);

      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('Cloudflare Platform', () => {
    it('should initiate device flow successfully', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          scope: 'repo'
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleDeviceCode(adapter);

      expect(response.status).toBe(200);
      const body = JSON.parse(await response.text());
      expect(body).toHaveProperty('device_code');
      expect(body).toHaveProperty('user_code');
      expect(body).toHaveProperty('verification_uri');
      expect(body).toHaveProperty('expires_in');
      expect(body).toHaveProperty('interval');
    });

    it('should reject non-POST requests', async () => {
      const context = createMockCloudflareContext({
        method: 'GET'
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleDeviceCode(adapter);

      expect(response.status).toBe(405);
      const body = JSON.parse(await response.text());
      expect(body.error).toBe('Method not allowed');
    });

    it('should validate required client_id field', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          scope: 'repo'
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleDeviceCode(adapter);

      expect(response.status).toBe(400);
      const body = JSON.parse(await response.text());
      expect(body.error).toBeTruthy();
    });

    it('should handle GitHub API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error' })
      });

      const context = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          scope: 'repo'
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleDeviceCode(adapter);

      expect(response.status).toBe(500);
      const body = JSON.parse(await response.text());
      expect(body.error).toBeTruthy();
    });

    it('should include CORS headers', async () => {
      const context = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          scope: 'repo'
        })
      });
      const adapter = new CloudflareAdapter(context);

      const response = await handleDeviceCode(adapter);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should produce equivalent responses on both platforms', async () => {
      const netlifyEvent = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          scope: 'repo'
        })
      });
      const netlifyAdapter = new NetlifyAdapter(netlifyEvent);

      const cloudflareContext = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          scope: 'repo'
        })
      });
      const cloudflareAdapter = new CloudflareAdapter(cloudflareContext);

      const netlifyResponse = await handleDeviceCode(netlifyAdapter);
      const cloudflareResponse = await handleDeviceCode(cloudflareAdapter);

      // Status codes should match
      expect(netlifyResponse.statusCode).toBe(cloudflareResponse.status);

      // Response bodies should match
      const netlifyBody = JSON.parse(netlifyResponse.body);
      const cloudflareBody = JSON.parse(await cloudflareResponse.text());

      expect(netlifyBody.device_code).toBe(cloudflareBody.device_code);
      expect(netlifyBody.user_code).toBe(cloudflareBody.user_code);
      expect(netlifyBody.verification_uri).toBe(cloudflareBody.verification_uri);
    });

    it('should handle errors identically on both platforms', async () => {
      const netlifyEvent = createMockNetlifyEvent({
        httpMethod: 'GET'
      });
      const netlifyAdapter = new NetlifyAdapter(netlifyEvent);

      const cloudflareContext = createMockCloudflareContext({
        method: 'GET'
      });
      const cloudflareAdapter = new CloudflareAdapter(cloudflareContext);

      const netlifyResponse = await handleDeviceCode(netlifyAdapter);
      const cloudflareResponse = await handleDeviceCode(cloudflareAdapter);

      expect(netlifyResponse.statusCode).toBe(cloudflareResponse.status);

      const netlifyBody = JSON.parse(netlifyResponse.body);
      const cloudflareBody = JSON.parse(await cloudflareResponse.text());

      expect(netlifyBody.error).toBe(cloudflareBody.error);
    });
  });

  describe('OAuth Spec Compliance', () => {
    it('should return all required OAuth device code fields', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          scope: 'repo'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeviceCode(adapter);
      const body = JSON.parse(response.body);

      // RFC 8628 required fields
      expect(body).toHaveProperty('device_code');
      expect(body).toHaveProperty('user_code');
      expect(body).toHaveProperty('verification_uri');
      expect(body).toHaveProperty('expires_in');
      expect(body).toHaveProperty('interval');

      expect(typeof body.device_code).toBe('string');
      expect(typeof body.user_code).toBe('string');
      expect(typeof body.verification_uri).toBe('string');
      expect(typeof body.expires_in).toBe('number');
      expect(typeof body.interval).toBe('number');
    });

    it('should accept optional scope parameter', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id',
          scope: 'repo user'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeviceCode(adapter);

      expect(response.statusCode).toBe(200);
    });

    it('should work without scope parameter', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          client_id: 'test-client-id'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleDeviceCode(adapter);

      expect(response.statusCode).toBe(200);
    });
  });
});
