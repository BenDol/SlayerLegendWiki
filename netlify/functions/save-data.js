/**
 * Netlify Function: Save Data
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * POST /.netlify/functions/save-data
 */

import { NetlifyAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleSaveData } from '../../functions/_shared/handlers/save-data.js';

export async function handler(event) {
  const adapter = new NetlifyAdapter(event);
  const configAdapter = new ConfigAdapter('netlify');
  return await handleSaveData(adapter, configAdapter);
}
