/**
 * Test Setup
 * Global configuration and setup for all tests
 */

import { vi } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up test environment variables (only set if not already defined)
// This allows .env.test to override these defaults for integration tests
// NOTE: For integration tests, dotenv loads .env.test FIRST, so these are only fallbacks for unit tests
process.env.NODE_ENV = 'test';

// Only set fallback values if not defined (allows .env.test to take precedence)
if (!process.env.WIKI_BOT_TOKEN) process.env.WIKI_BOT_TOKEN = 'test-bot-token-12345';
if (!process.env.WIKI_BOT_USERNAME) process.env.WIKI_BOT_USERNAME = 'test-wiki-bot';
if (!process.env.WIKI_REPO_OWNER) process.env.WIKI_REPO_OWNER = 'test-owner';
if (!process.env.WIKI_REPO_NAME) process.env.WIKI_REPO_NAME = 'test-repo';
if (!process.env.VITE_WIKI_REPO_OWNER) process.env.VITE_WIKI_REPO_OWNER = 'test-owner';
if (!process.env.VITE_WIKI_REPO_NAME) process.env.VITE_WIKI_REPO_NAME = 'test-repo';
if (!process.env.GITHUB_CLIENT_ID && !process.env.VITE_GITHUB_CLIENT_ID) process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
if (!process.env.SENDGRID_API_KEY) process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
if (!process.env.SENDGRID_FROM_EMAIL) process.env.SENDGRID_FROM_EMAIL = 'test@example.com';
if (!process.env.EMAIL_VERIFICATION_SECRET) process.env.EMAIL_VERIFICATION_SECRET = 'test-email-verification-secret-key-32chars-long';
if (!process.env.RECAPTCHA_SECRET_KEY) process.env.RECAPTCHA_SECRET_KEY = 'test-recaptcha-secret';
if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = 'test-openai-key';

// Mock global crypto for Cloudflare Workers environment
if (!global.crypto) {
  const { webcrypto } = await import('crypto');
  global.crypto = webcrypto;
}

// Mock btoa/atob for Cloudflare Workers environment
if (!global.btoa) {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
if (!global.atob) {
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}

// Global test timeout
vi.setConfig({ testTimeout: 30000 });
