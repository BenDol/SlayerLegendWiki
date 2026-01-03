/**
 * Platform Adapter Singleton
 * Auto-detects platform and provides unified interface
 */

import { NetlifyAdapter, CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';

/**
 * Create platform adapter based on event/context
 * @param {Object} event - Function event object
 * @param {Object} context - Function context object
 * @returns {PlatformAdapter} Platform-specific adapter instance
 */
function createAdapter(event, context) {
  // Cloudflare Pages Functions have event.request
  if (event && event.request !== undefined) {
    return new CloudflareAdapter({ request: event.request, env: event.env, context });
  }

  // Netlify Functions have event.httpMethod
  if (event && event.httpMethod !== undefined) {
    return new NetlifyAdapter(event);
  }

  throw new Error('Unable to detect platform. Event must be from Netlify or Cloudflare.');
}

/**
 * Adapter factory for use in handlers
 * Usage: const adapter = createPlatformAdapter(event, context);
 */
export const createPlatformAdapter = createAdapter;

/**
 * Default export for convenience
 * Note: Since we need event/context to detect platform, this is a factory function
 */
export default {
  create: createAdapter,
  createPlatformAdapter: createAdapter,
};
