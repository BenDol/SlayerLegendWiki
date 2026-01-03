/**
 * Cloudflare Function: Admin Actions
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * GET/POST /api/admin-actions
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleAdminAction } from '../_shared/handlers/admin-actions.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  const configAdapter = new ConfigAdapter('cloudflare');
  return await handleAdminAction(adapter, configAdapter);
}
