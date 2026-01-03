/**
 * Cloudflare Function: GitHub Device Flow - Initiate
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * POST /api/device-code
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { handleDeviceCode } from '../_shared/handlers/device-code.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  return await handleDeviceCode(adapter);
}
