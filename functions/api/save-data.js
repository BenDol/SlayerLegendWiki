/**
 * Cloudflare Function: Save Data
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * POST /api/save-data
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleSaveData } from '../_shared/handlers/save-data.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  const configAdapter = new ConfigAdapter('cloudflare');
  return await handleSaveData(adapter, configAdapter);
}
