/**
 * Netlify Function: Profile Picture
 * Thin wrapper that delegates to platform-agnostic handler
 *
 * GET/POST/DELETE /.netlify/functions/profile-picture
 */

import { NetlifyAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleProfilePicture } from '../../functions/_shared/handlers/profile-picture.js';

export async function handler(event) {
  const adapter = new NetlifyAdapter(event);
  const configAdapter = new ConfigAdapter('netlify');
  return await handleProfilePicture(adapter, configAdapter);
}
