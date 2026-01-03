/**
 * Netlify Function: GitHub Device Flow - Access Token
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * POST /.netlify/functions/access-token
 */

import { NetlifyAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { handleAccessToken } from '../../functions/_shared/handlers/access-token.js';

export async function handler(event) {
  const adapter = new NetlifyAdapter(event);
  return await handleAccessToken(adapter);
}
