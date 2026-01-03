/**
 * Cloudflare Function: Display Name
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * GET/POST/DELETE /api/display-name
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleDisplayName } from '../_shared/handlers/display-name.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  const configAdapter = new ConfigAdapter('cloudflare');
  return await handleDisplayName(adapter, configAdapter);
}
