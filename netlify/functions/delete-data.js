/**
 * Netlify Function: Delete Data
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * POST /.netlify/functions/delete-data
 */

import { NetlifyAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleDeleteData } from '../../functions/_shared/handlers/delete-data.js';

export async function handler(event) {
  const adapter = new NetlifyAdapter(event);
  const configAdapter = new ConfigAdapter('netlify');
  return await handleDeleteData(adapter, configAdapter);
}
