/**
 * GitHub OAuth Real Integration Tests
 * Tests REAL GitHub OAuth API endpoints
 *
 * ⚠️ WARNING: Makes real API calls to GitHub
 * Requires: GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env.test
 *
 * Run with: npm run test:integration --integration/github-oauth
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

// Load .env.test for local development only
// In CI/Cloudflare, environment variables are already set
if (!process.env.CI && !process.env.CF_PAGES) {
  config({ path: '.env.test', override: true });
}

describe('GitHub OAuth Integration (REAL API)', () => {
  let clientId;

  beforeAll(() => {
    clientId = process.env.GITHUB_CLIENT_ID || process.env.VITE_GITHUB_CLIENT_ID;

    if (!clientId) {
      throw new Error('Missing required environment variable: GITHUB_CLIENT_ID or VITE_GITHUB_CLIENT_ID');
    }

    console.log(`\n🔑 Using GitHub Client ID: ${clientId}`);
  });

  describe('Device Flow Initiation', () => {
    it('should initiate device flow and return device_code', async () => {
      const response = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          scope: 'repo user'
        })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      // Verify OAuth spec compliance
      expect(data).toHaveProperty('device_code');
      expect(data).toHaveProperty('user_code');
      expect(data).toHaveProperty('verification_uri');
      expect(data).toHaveProperty('expires_in');
      expect(data).toHaveProperty('interval');

      // Verify types
      expect(typeof data.device_code).toBe('string');
      expect(typeof data.user_code).toBe('string');
      expect(typeof data.verification_uri).toBe('string');
      expect(typeof data.expires_in).toBe('number');
      expect(typeof data.interval).toBe('number');

      // Verify reasonable values
      expect(data.device_code.length).toBeGreaterThan(10);
      expect(data.user_code.length).toBeGreaterThan(4);
      expect(data.verification_uri).toContain('github.com');
      expect(data.expires_in).toBeGreaterThan(0);
      expect(data.interval).toBeGreaterThanOrEqual(5);

      console.log('\n📝 Device Flow initiated successfully:');
      console.log(`User Code: ${data.user_code}`);
      console.log(`Verification URI: ${data.verification_uri}`);
      console.log(`Expires in: ${data.expires_in}s`);
    }, 30000);

    it('should handle invalid client_id gracefully', async () => {
      const response = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: 'invalid-client-id',
          scope: 'repo'
        })
      });

      // GitHub returns an error for invalid client_id
      // This is the expected behavior
      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data).toHaveProperty('error');

      console.log('✅ Invalid client_id rejected as expected');
    }, 30000);
  });

  describe('Access Token Exchange', () => {
    it('should return authorization_pending for unapproved device code', async () => {
      // First initiate device flow to get a valid device_code
      const initResponse = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          scope: 'repo'
        })
      });

      const initData = await initResponse.json();
      const deviceCode = initData.device_code;

      // Immediately try to exchange (before user approves)
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });

      const tokenData = await tokenResponse.json();

      // Should get authorization_pending error
      expect(tokenData).toHaveProperty('error');
      expect(tokenData.error).toBe('authorization_pending');
      expect(tokenData).toHaveProperty('error_description');

      console.log('\n✅ Authorization pending error returned as expected');
    }, 30000);

    it('should reject invalid device_code', async () => {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          device_code: 'invalid-device-code-12345',
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });

      const tokenData = await tokenResponse.json();

      expect(tokenData).toHaveProperty('error');
      // Could be expired_token, bad_verification_code, or incorrect_device_code
      expect(['expired_token', 'bad_verification_code', 'incorrect_device_code']).toContain(tokenData.error);

      console.log(`\n✅ Invalid device code rejected: ${tokenData.error}`);
    }, 30000);
  });

  describe('OAuth Flow Timing', () => {
    it('should respect polling interval', async () => {
      const initResponse = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          scope: 'repo'
        })
      });

      const data = await initResponse.json();
      const interval = data.interval;

      // Verify interval is reasonable
      expect(interval).toBeGreaterThanOrEqual(5);
      expect(interval).toBeLessThanOrEqual(60);

      console.log(`\n⏱️  Polling interval: ${interval} seconds`);
    }, 30000);
  });
});
