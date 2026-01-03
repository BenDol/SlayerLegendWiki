/**
 * PlatformAdapter Tests
 * Comprehensive tests for NetlifyAdapter and CloudflareAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetlifyAdapter, CloudflareAdapter } from '../../wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import {
  createMockNetlifyEvent,
  createMockCloudflareContext,
  createMockEnv
} from '../helpers/adapterHelpers.js';

describe('PlatformAdapter', () => {
  describe('NetlifyAdapter', () => {
    let mockEvent;
    let adapter;

    beforeEach(() => {
      mockEvent = createMockNetlifyEvent({
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-agent'
        },
        body: JSON.stringify({ test: 'data' }),
        queryStringParameters: { page: '1', limit: '10' }
      });
      adapter = new NetlifyAdapter(mockEvent);
    });

    it('should get HTTP method', () => {
      expect(adapter.getMethod()).toBe('POST');
    });

    it('should get request body', async () => {
      const body = await adapter.getBody();
      expect(body).toBe(JSON.stringify({ test: 'data' }));
    });

    it('should get JSON body', async () => {
      const json = await adapter.getJsonBody();
      expect(json).toEqual({ test: 'data' });
    });

    it('should handle empty body', async () => {
      const emptyAdapter = new NetlifyAdapter(createMockNetlifyEvent({ body: null }));
      const body = await emptyAdapter.getBody();
      expect(body).toBe('');
    });

    it('should get query parameters', () => {
      const params = adapter.getQueryParams();
      expect(params).toEqual({ page: '1', limit: '10' });
    });

    it('should get headers', () => {
      const headers = adapter.getHeaders();
      expect(headers['content-type']).toBe('application/json');
      expect(headers['user-agent']).toBe('test-agent');
    });

    it('should get client IP from x-forwarded-for header', () => {
      const event = createMockNetlifyEvent({
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }
      });
      const adapter = new NetlifyAdapter(event);
      expect(adapter.getClientIP()).toBe('192.168.1.1');
    });

    it('should return unknown for missing IP', () => {
      const event = createMockNetlifyEvent({ headers: {} });
      const adapter = new NetlifyAdapter(event);
      expect(adapter.getClientIP()).toBe('unknown');
    });

    it('should create JSON response', () => {
      const response = adapter.createJsonResponse(200, { success: true });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ success: true });
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should create response with custom headers', () => {
      const response = adapter.createResponse(201, '{"created":true}', {
        'X-Custom-Header': 'value'
      });
      expect(response.statusCode).toBe(201);
      expect(response.body).toBe('{"created":true}');
      expect(response.headers['X-Custom-Header']).toBe('value');
    });

    it('should get environment variable', () => {
      process.env.TEST_VAR = 'test-value';
      expect(adapter.getEnv('TEST_VAR')).toBe('test-value');
      delete process.env.TEST_VAR;
    });

    it('should check if environment variable exists', () => {
      process.env.TEST_VAR = 'test-value';
      expect(adapter.hasEnv('TEST_VAR')).toBe(true);
      expect(adapter.hasEnv('NON_EXISTENT')).toBe(false);
      delete process.env.TEST_VAR;
    });

    it('should get multiple required environment variables', () => {
      process.env.VAR1 = 'value1';
      process.env.VAR2 = 'value2';
      const envVars = adapter.getRequiredEnv(['VAR1', 'VAR2']);
      expect(envVars).toEqual({ VAR1: 'value1', VAR2: 'value2' });
      delete process.env.VAR1;
      delete process.env.VAR2;
    });

    it('should throw error for missing required environment variable', () => {
      expect(() => {
        adapter.getRequiredEnv(['NON_EXISTENT_VAR']);
      }).toThrow('Missing required environment variable: NON_EXISTENT_VAR');
    });

    it('should get platform name', () => {
      expect(adapter.getPlatform()).toBe('netlify');
    });
  });

  describe('CloudflareAdapter', () => {
    let mockContext;
    let adapter;

    beforeEach(() => {
      const headers = new Map();
      headers.set('content-type', 'application/json');
      headers.set('user-agent', 'test-agent');

      mockContext = createMockCloudflareContext({
        method: 'POST',
        url: 'https://example.com/api/test?page=1&limit=10',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-agent'
        },
        body: JSON.stringify({ test: 'data' }),
        env: createMockEnv()
      });

      // Update headers to use Map
      mockContext.request.headers = headers;

      adapter = new CloudflareAdapter(mockContext);
    });

    it('should get HTTP method', () => {
      expect(adapter.getMethod()).toBe('POST');
    });

    it('should get request body', async () => {
      const body = await adapter.getBody();
      expect(body).toBe(JSON.stringify({ test: 'data' }));
    });

    it('should get JSON body', async () => {
      const json = await adapter.getJsonBody();
      expect(json).toEqual({ test: 'data' });
    });

    it('should get query parameters', () => {
      const params = adapter.getQueryParams();
      expect(params).toEqual({ page: '1', limit: '10' });
    });

    it('should handle URL without query parameters', () => {
      const context = createMockCloudflareContext({
        url: 'https://example.com/api/test'
      });
      const adapter = new CloudflareAdapter(context);
      expect(adapter.getQueryParams()).toEqual({});
    });

    it('should get headers', () => {
      const headers = adapter.getHeaders();
      expect(headers['content-type']).toBe('application/json');
      expect(headers['user-agent']).toBe('test-agent');
    });

    it('should get client IP from CF-Connecting-IP header', () => {
      const headers = new Map();
      headers.set('cf-connecting-ip', '203.0.113.1');
      mockContext.request.headers = headers;

      const adapter = new CloudflareAdapter(mockContext);
      expect(adapter.getClientIP()).toBe('203.0.113.1');
    });

    it('should fallback to x-forwarded-for for client IP', () => {
      const headers = new Map();
      headers.set('x-forwarded-for', '192.168.1.1, 10.0.0.1');
      mockContext.request.headers = headers;

      const adapter = new CloudflareAdapter(mockContext);
      expect(adapter.getClientIP()).toBe('192.168.1.1');
    });

    it('should return unknown for missing IP', () => {
      const headers = new Map();
      mockContext.request.headers = headers;

      const adapter = new CloudflareAdapter(mockContext);
      expect(adapter.getClientIP()).toBe('unknown');
    });

    it('should create JSON response', () => {
      const response = adapter.createJsonResponse(200, { success: true });
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should create response with custom headers', () => {
      const response = adapter.createResponse(201, '{"created":true}', {
        'X-Custom-Header': 'value'
      });
      expect(response.status).toBe(201);
      expect(response.headers.get('X-Custom-Header')).toBe('value');
    });

    it('should get environment variable', () => {
      expect(adapter.getEnv('WIKI_BOT_TOKEN')).toBe('test-bot-token');
    });

    it('should check if environment variable exists', () => {
      expect(adapter.hasEnv('WIKI_BOT_TOKEN')).toBe(true);
      expect(adapter.hasEnv('NON_EXISTENT')).toBe(false);
    });

    it('should get multiple required environment variables', () => {
      const envVars = adapter.getRequiredEnv(['WIKI_BOT_TOKEN', 'WIKI_REPO_OWNER']);
      expect(envVars).toEqual({
        WIKI_BOT_TOKEN: 'test-bot-token',
        WIKI_REPO_OWNER: 'test-owner'
      });
    });

    it('should throw error for missing required environment variable', () => {
      expect(() => {
        adapter.getRequiredEnv(['NON_EXISTENT_VAR']);
      }).toThrow('Missing required environment variable: NON_EXISTENT_VAR');
    });

    it('should get platform name', () => {
      expect(adapter.getPlatform()).toBe('cloudflare');
    });
  });

  describe('Platform Compatibility', () => {
    it('should produce equivalent responses on both platforms', async () => {
      const netlifyEvent = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ test: 'data' })
      });
      const netlifyAdapter = new NetlifyAdapter(netlifyEvent);

      const cloudflareContext = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      });
      const cloudflareAdapter = new CloudflareAdapter(cloudflareContext);

      // Both should return same method
      expect(netlifyAdapter.getMethod()).toBe(cloudflareAdapter.getMethod());

      // Both should return same body
      const netlifyBody = await netlifyAdapter.getBody();
      const cloudflareBody = await cloudflareAdapter.getBody();
      expect(netlifyBody).toBe(cloudflareBody);

      // Both should return same JSON
      const netlifyJson = await netlifyAdapter.getJsonBody();
      const cloudflareJson = await cloudflareAdapter.getJsonBody();
      expect(netlifyJson).toEqual(cloudflareJson);

      // Both should create equivalent JSON responses
      const netlifyResponse = netlifyAdapter.createJsonResponse(200, { success: true });
      const cloudflareResponse = cloudflareAdapter.createJsonResponse(200, { success: true });

      expect(netlifyResponse.statusCode).toBe(cloudflareResponse.status);
      const netlifyResponseBody = JSON.parse(netlifyResponse.body);
      const cloudflareResponseBody = JSON.parse(await cloudflareResponse.text());
      expect(netlifyResponseBody).toEqual(cloudflareResponseBody);
    });
  });
});
