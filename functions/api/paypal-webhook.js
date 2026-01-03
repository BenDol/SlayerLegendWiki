/**
 * Cloudflare Function: PayPal Webhook
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * POST /api/paypal-webhook
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handlePayPalWebhook } from '../_shared/handlers/paypal-webhook.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  const configAdapter = new ConfigAdapter('cloudflare');
  return await handlePayPalWebhook(adapter, configAdapter);
}
