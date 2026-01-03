/**
 * Cloudflare Function: Delete Data
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * POST /api/delete-data
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleDeleteData } from '../_shared/handlers/delete-data.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  const configAdapter = new ConfigAdapter('cloudflare');
  return await handleDeleteData(adapter, configAdapter);
}
