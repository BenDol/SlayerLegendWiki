/**
 * External API Mocks
 * Mock implementations for external HTTP APIs (GitHub OAuth, OpenAI, SendGrid, reCAPTCHA)
 */

import { vi } from 'vitest';
import {
  mockDeviceCodeResponse,
  mockAccessTokenResponse,
  mockOpenAIModerationResponse,
  mockSendGridResponse,
  mockRecaptchaResponse
} from '../fixtures/testData.js';

export function mockGitHubOAuthAPI() {
  return vi.fn(async (url, options) => {
    // Device code initiation
    if (url.includes('/login/device/code')) {
      return {
        ok: true,
        status: 200,
        json: async () => mockDeviceCodeResponse
      };
    }

    // Access token polling
    if (url.includes('/login/oauth/access_token')) {
      const body = JSON.parse(options.body);

      // Simulate authorization pending
      if (body.device_code === 'pending') {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: 'authorization_pending',
            error_description: 'The authorization request is still pending'
          })
        };
      }

      // Simulate expired device code
      if (body.device_code === 'expired') {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: 'expired_token',
            error_description: 'The device code has expired'
          })
        };
      }

      // Success
      return {
        ok: true,
        status: 200,
        json: async () => mockAccessTokenResponse
      };
    }

    throw new Error(`Unmocked URL: ${url}`);
  });
}

export function mockOpenAIAPI() {
  return vi.fn(async (url, options) => {
    if (url.includes('api.openai.com/v1/moderations')) {
      const body = JSON.parse(options.body);
      const input = body.input;

      // Check for profanity patterns
      const hasProfanity = /badword|profanity|offensive/i.test(input);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...mockOpenAIModerationResponse,
          results: [{
            ...mockOpenAIModerationResponse.results[0],
            flagged: hasProfanity,
            categories: {
              ...mockOpenAIModerationResponse.results[0].categories,
              harassment: hasProfanity
            }
          }]
        })
      };
    }

    throw new Error(`Unmocked URL: ${url}`);
  });
}

export function mockSendGridAPI() {
  return vi.fn(async (url, options) => {
    if (url.includes('api.sendgrid.com/v3/mail/send')) {
      const body = JSON.parse(options.body);

      // Validate email format
      if (!body.personalizations?.[0]?.to?.[0]?.email) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            errors: [{ message: 'Invalid email' }]
          })
        };
      }

      return {
        ok: true,
        status: 202,
        headers: {
          get: (name) => {
            if (name === 'x-message-id') return 'test-message-id-123';
            return null;
          }
        },
        json: async () => ({})
      };
    }

    throw new Error(`Unmocked URL: ${url}`);
  });
}

export function mockRecaptchaAPI() {
  return vi.fn(async (url, options) => {
    if (url.includes('google.com/recaptcha/api/siteverify')) {
      const body = new URLSearchParams(options.body);
      const token = body.get('response');

      // Simulate failed reCAPTCHA
      if (token === 'invalid-token') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: false,
            'error-codes': ['invalid-input-response']
          })
        };
      }

      // Simulate low score
      if (token === 'low-score') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...mockRecaptchaResponse,
            success: true,
            score: 0.3
          })
        };
      }

      // Success
      return {
        ok: true,
        status: 200,
        json: async () => mockRecaptchaResponse
      };
    }

    throw new Error(`Unmocked URL: ${url}`);
  });
}

export function setupAPIMocks() {
  const originalFetch = global.fetch;

  global.fetch = vi.fn(async (url, options = {}) => {
    // Route to appropriate mock
    if (url.includes('github.com')) {
      return mockGitHubOAuthAPI()(url, options);
    }
    if (url.includes('openai.com')) {
      return mockOpenAIAPI()(url, options);
    }
    if (url.includes('sendgrid.com')) {
      return mockSendGridAPI()(url, options);
    }
    if (url.includes('recaptcha')) {
      return mockRecaptchaAPI()(url, options);
    }

    // Fallback to original fetch for unmocked URLs
    return originalFetch(url, options);
  });

  return () => {
    global.fetch = originalFetch;
  };
}
