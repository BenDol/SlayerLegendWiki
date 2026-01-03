/**
 * Cloudflare Function: GitHub Device Flow - Access Token
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * POST /api/access-token
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { handleAccessToken } from '../_shared/handlers/access-token.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  return await handleAccessToken(adapter);
}
