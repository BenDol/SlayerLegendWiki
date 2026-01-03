/**
 * Netlify Function: GitHub Bot
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * POST /.netlify/functions/github-bot
 */

import { NetlifyAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { CryptoAdapter } from 'github-wiki-framework/serverless/shared/adapters/CryptoAdapter.js';
import { handleGithubBot } from '../../functions/_shared/handlers/github-bot.js';

export async function handler(event) {
  const adapter = new NetlifyAdapter(event);
  const configAdapter = new ConfigAdapter('netlify');
  const cryptoAdapter = new CryptoAdapter('netlify');
  return await handleGithubBot(adapter, configAdapter, cryptoAdapter);
}
