/**
 * Cloudflare Function: Load Data
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * GET /api/load-data
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleLoadData } from '../_shared/handlers/load-data.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  const configAdapter = new ConfigAdapter('cloudflare');
  return await handleLoadData(adapter, configAdapter);
}
