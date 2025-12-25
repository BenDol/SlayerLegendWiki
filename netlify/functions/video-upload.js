/**
 * Netlify Function: Video Upload
 * Handles server-side multipart/form-data video uploads (files < 100MB)
 *
 * POST /.netlify/functions/video-upload
 */

import { NetlifyAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleVideoUploadRequest } from '../../functions/_shared/handlers/video-upload-request.js';

export async function handler(event) {
  const adapter = new NetlifyAdapter(event);
  const configAdapter = new ConfigAdapter('netlify');
  return await handleVideoUploadRequest(adapter, configAdapter);
}
