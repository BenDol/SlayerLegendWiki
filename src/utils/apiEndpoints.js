/**
 * API Endpoint Configuration
 * Provides correct endpoints for both Netlify and Cloudflare Pages deployments
 *
 * Platform Detection:
 * - VITE_PLATFORM env variable (set at build time)
 * - Netlify: Functions at /.netlify/functions/
 * - Cloudflare: Functions at /api/
 * - Development: Uses Vite proxy (/api/github/* for OAuth, direct URLs for data operations)
 */

import { createLogger } from './logger';

const logger = createLogger('ApiEndpoints');

/**
 * Detect the current platform
 * @returns {'netlify' | 'cloudflare' | 'dev'} - Current platform
 */
function detectPlatform() {
  // Development mode
  if (import.meta.env.DEV) {
    return 'dev';
  }

  // Check for explicit platform configuration
  const explicitPlatform = import.meta.env.VITE_PLATFORM;
  if (explicitPlatform === 'netlify' || explicitPlatform === 'cloudflare') {
    return explicitPlatform;
  }

  // Auto-detect based on environment
  // Cloudflare Pages sets CF_PAGES=1
  if (import.meta.env.VITE_CF_PAGES === '1') {
    return 'cloudflare';
  }

  // Default to Netlify for backward compatibility
  return 'netlify';
}

/**
 * Get base URL for serverless functions
 * @returns {string} - Base URL
 */
function getFunctionsBaseUrl() {
  const platform = detectPlatform();

  switch (platform) {
    case 'dev':
      // In development with Netlify dev server, functions are at /.netlify/functions
      return '/.netlify/functions';

    case 'cloudflare':
      return '/api';

    case 'netlify':
    default:
      return '/.netlify/functions';
  }
}

/**
 * Get OAuth proxy base URL
 * In development, OAuth goes through Vite proxy to avoid CORS
 * In production, uses platform-specific functions
 * @returns {string} - OAuth base URL
 */
function getOAuthBaseUrl() {
  const platform = detectPlatform();

  switch (platform) {
    case 'dev':
      // Vite proxy for OAuth in development
      return '/api/github';

    case 'cloudflare':
      return '/api';

    case 'netlify':
    default:
      return '/.netlify/functions';
  }
}

// ===== DATA OPERATION ENDPOINTS =====

/**
 * Get save-data endpoint
 * @returns {string} - Endpoint URL
 */
export function getSaveDataEndpoint() {
  return `${getFunctionsBaseUrl()}/save-data`;
}

/**
 * Get load-data endpoint
 * @returns {string} - Endpoint URL
 */
export function getLoadDataEndpoint() {
  return `${getFunctionsBaseUrl()}/load-data`;
}

/**
 * Get delete-data endpoint
 * @returns {string} - Endpoint URL
 */
export function getDeleteDataEndpoint() {
  return `${getFunctionsBaseUrl()}/delete-data`;
}

// ===== GITHUB BOT ENDPOINTS =====

/**
 * Get github-bot endpoint
 * @returns {string} - Endpoint URL
 */
export function getGithubBotEndpoint() {
  return `${getFunctionsBaseUrl()}/github-bot`;
}

// ===== OAUTH ENDPOINTS =====

/**
 * Get device-code endpoint (OAuth)
 * @returns {string} - Endpoint URL
 */
export function getDeviceCodeEndpoint() {
  return `${getOAuthBaseUrl()}/device-code`;
}

/**
 * Get access-token endpoint (OAuth)
 * @returns {string} - Endpoint URL
 */
export function getAccessTokenEndpoint() {
  return `${getOAuthBaseUrl()}/access-token`;
}

// ===== PLATFORM INFO =====

/**
 * Get current platform name
 * @returns {'netlify' | 'cloudflare' | 'dev'} - Platform name
 */
export function getPlatform() {
  return detectPlatform();
}

/**
 * Check if running on Netlify
 * @returns {boolean}
 */
export function isNetlify() {
  return detectPlatform() === 'netlify';
}

/**
 * Check if running on Cloudflare Pages
 * @returns {boolean}
 */
export function isCloudflare() {
  return detectPlatform() === 'cloudflare';
}

/**
 * Check if running in development
 * @returns {boolean}
 */
export function isDevelopment() {
  return detectPlatform() === 'dev';
}

// ===== LEGACY SUPPORT =====

/**
 * Get endpoint by name (legacy support)
 * @param {string} name - Endpoint name
 * @returns {string} - Endpoint URL
 */
export function getEndpoint(name) {
  const endpoints = {
    'save-data': getSaveDataEndpoint(),
    'load-data': getLoadDataEndpoint(),
    'delete-data': getDeleteDataEndpoint(),
    'github-bot': getGithubBotEndpoint(),
    'device-code': getDeviceCodeEndpoint(),
    'access-token': getAccessTokenEndpoint(),
  };

  return endpoints[name] || `${getFunctionsBaseUrl()}/${name}`;
}

// ===== DEBUG =====

// Log platform detection in development
if (import.meta.env.DEV) {
  logger.debug('Platform detected', { platform: detectPlatform() });
  logger.debug('Functions base URL', { url: getFunctionsBaseUrl() });
  logger.debug('OAuth base URL', { url: getOAuthBaseUrl() });
}
