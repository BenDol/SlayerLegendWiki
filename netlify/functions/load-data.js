/**
 * Netlify Function: Load Data
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * GET /.netlify/functions/load-data
 */

import { NetlifyAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleLoadData } from '../../functions/_shared/handlers/load-data.js';

export async function handler(event) {
  const adapter = new NetlifyAdapter(event);
  const configAdapter = new ConfigAdapter('netlify');
  return await handleLoadData(adapter, configAdapter);
}
