/**
 * Netlify Function: GitHub Device Flow - Initiate
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * POST /.netlify/functions/device-code
 */

import { NetlifyAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { handleDeviceCode } from '../../functions/_shared/handlers/device-code.js';

export async function handler(event) {
  const adapter = new NetlifyAdapter(event);
  return await handleDeviceCode(adapter);
}
