/**
 * Cloudflare Function: GitHub Bot
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * POST /api/github-bot
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { CryptoAdapter } from 'github-wiki-framework/serverless/shared/adapters/CryptoAdapter.js';
import { handleGithubBot } from '../_shared/handlers/github-bot.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  const configAdapter = new ConfigAdapter('cloudflare');
  const cryptoAdapter = new CryptoAdapter('cloudflare');
  return await handleGithubBot(adapter, configAdapter, cryptoAdapter);
}
