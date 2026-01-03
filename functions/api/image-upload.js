/**
 * Cloudflare Function: Image Upload
 * Handles multipart/form-data image uploads (up to 10MB)
 *
 * POST /api/image-upload
 *
 * Note: All image processing (resizing, WebP conversion) MUST be done client-side
 * This endpoint only accepts pre-processed images
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleImageUploadRequest } from '../_shared/handlers/image-upload-request.js';
import config from '../_shared/config-loader.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  const configAdapter = new ConfigAdapter('cloudflare');
  // Inject the config for Cloudflare Workers (can't use fs.readFileSync)
  configAdapter.setConfig(config);
  return await handleImageUploadRequest(adapter, configAdapter);
}
