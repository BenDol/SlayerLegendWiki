/**
 * Cloudflare Function: Profile Picture
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * GET/POST/DELETE /api/profile-picture
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleProfilePicture } from '../_shared/handlers/profile-picture.js';
import wikiConfig from '../_shared/wiki-config.json';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  const configAdapter = new ConfigAdapter('cloudflare');
  // Inject the imported config into the adapter
  configAdapter._configCache = wikiConfig;
  return await handleProfilePicture(adapter, configAdapter);
}
