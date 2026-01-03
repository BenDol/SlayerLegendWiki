/**
 * Cloudflare Function: Video Upload
 * Handles server-side multipart/form-data video uploads (files < 100MB)
 *
 * POST /api/video-upload
 */

import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleVideoUploadRequest } from '../_shared/handlers/video-upload-request.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  const configAdapter = new ConfigAdapter('cloudflare');
  return await handleVideoUploadRequest(adapter, configAdapter);
}
