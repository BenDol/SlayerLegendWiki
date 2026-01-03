/**
 * Netlify Function: Display Name
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * GET/POST/DELETE /.netlify/functions/display-name
 */

import { NetlifyAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleDisplayName } from '../../functions/_shared/handlers/display-name.js';

export async function handler(event) {
  const adapter = new NetlifyAdapter(event);
  const configAdapter = new ConfigAdapter('netlify');
  return await handleDisplayName(adapter, configAdapter);
}
