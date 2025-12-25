import { createLogger } from '../../../src/utils/logger.js';
import { handleVideoUpload, createContentPR } from './video-upload.js';
import cdnRegistry from '../../../src/services/cdn/cdnRegistry.js';
import { parseMultipartFormData } from '../multipart.js';

const logger = createLogger('VideoUploadAPI');

// Server-Side Upload Strategy:
// This endpoint handles video uploads up to 100MB through serverless functions.
// Files are uploaded as multipart/form-data and processed server-side.
//
// Platform-specific limits:
// - Netlify Functions: 6MB local (CLI), up to 100MB in production
// - Cloudflare Workers/Pages: 100MB request body limit
//
// For videos larger than 100MB, users should use the YouTube Link option.
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024; // 5MB

export async function handleVideoUploadRequest(adapter, configAdapter) {
  // Handle CORS preflight
  if (adapter.getMethod() === 'OPTIONS') {
    return adapter.createResponse(200, { message: 'OK' });
  }

  // Only allow POST
  if (adapter.getMethod() !== 'POST') {
    return adapter.createJsonResponse(405, {
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    const contentType = adapter.getHeaders()['content-type'] || '';
    logger.info('Video upload request received', { contentType });

    // Load wiki config
    const config = configAdapter.getWikiConfig();

    // Check if video uploads are enabled
    if (!config?.features?.contentCreators?.videoGuides?.allowRawUpload) {
      return adapter.createJsonResponse(403, {
        error: 'Video uploads are not enabled',
      });
    }

    // Initialize CDN provider
    let cdnProvider;
    try {
      cdnProvider = cdnRegistry.initialize(config);
    } catch (error) {
      logger.error('Failed to initialize CDN provider', { error: error.message });
      return adapter.createJsonResponse(500, {
        error: 'CDN provider initialization failed',
      });
    }

    // Parse multipart form data
    const headers = adapter.getHeaders();
    const contentTypeHeader = headers['content-type'] || headers['Content-Type'] || '';
    if (!contentTypeHeader.includes('multipart/form-data')) {
      return adapter.createJsonResponse(400, {
        error: 'Content-Type must be multipart/form-data',
      });
    }

    let formData;
    try {
      // Pass the raw event from adapter (multipart parser needs it)
      formData = await parseMultipartFormData(adapter.event);
    } catch (error) {
      logger.error('Failed to parse multipart data', { error: error.message });
      return adapter.createJsonResponse(400, {
        error: 'Failed to parse form data',
      });
    }

    // Extract video file
    const videoFile = formData.files?.videoFile;
    if (!videoFile) {
      return adapter.createJsonResponse(400, {
        error: 'Video file is required',
      });
    }

    if (videoFile.size > MAX_VIDEO_SIZE) {
      return adapter.createJsonResponse(400, {
        error: `Video file too large. Maximum size: ${MAX_VIDEO_SIZE / 1024 / 1024}MB`,
      });
    }

    // Extract thumbnail file (optional)
    const thumbnailFile = formData.files?.thumbnailFile;
    if (thumbnailFile && thumbnailFile.size > MAX_THUMBNAIL_SIZE) {
      return adapter.createJsonResponse(400, {
        error: `Thumbnail file too large. Maximum size: ${MAX_THUMBNAIL_SIZE / 1024 / 1024}MB`,
      });
    }

    // Extract form fields
    const title = formData.fields.title;
    const description = formData.fields.description;
    const creator = formData.fields.creator;
    const category = formData.fields.category;
    const tagsString = formData.fields.tags;
    const difficulty = formData.fields.difficulty;
    const userEmail = formData.fields.userEmail;
    const verificationToken = formData.fields.verificationToken;

    // Parse tags
    let tags = [];
    if (tagsString) {
      tags = tagsString.split(',').map(t => t.trim()).filter(t => t.length > 0);
    }

    // Get authentication info
    const auth = await getAuthInfo(adapter, config);

    // Prepare upload parameters
    const uploadParams = {
      videoFile: videoFile.data,
      videoFilename: videoFile.filename,
      videoMimeType: videoFile.contentType,
      thumbnailFile: thumbnailFile?.data,
      thumbnailFilename: thumbnailFile?.filename,
      thumbnailMimeType: thumbnailFile?.contentType,
      title,
      description,
      creator,
      category,
      tags,
      difficulty,
      userEmail,
      verificationToken,
      auth,
      config,
      adapter,
      cdnProvider,
      createContentPR, // Pass as function
    };

    // Handle video upload
    logger.info('Starting video upload process', { title, uploadedBy: auth.user || 'anonymous' });

    const result = await handleVideoUpload(uploadParams);

    logger.info('Video upload successful', {
      videoId: result.videoId,
      cdnPR: result.cdnPR.number,
      contentPR: result.contentPR.number,
    });

    return adapter.createJsonResponse(200, result);
  } catch (error) {
    logger.error('Video upload request failed', {
      error: error.message,
      stack: error.stack,
    });

    return adapter.createJsonResponse(500, {
      error: error.message || 'Internal server error',
    });
  }
}

/**
 * Get authentication info from request
 * Supports both authenticated users (with GitHub token) and anonymous users (bot token)
 * @private
 */
async function getAuthInfo(adapter, config) {
  const headers = adapter.getHeaders();
  const authHeader = headers.authorization || headers.Authorization;
  const botToken = adapter.getEnv('WIKI_BOT_TOKEN');

  if (!botToken) {
    throw new Error('Bot token not configured');
  }

  // Check for user authentication token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const userToken = authHeader.substring(7);

    // Validate token by fetching user info
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const user = await response.json();
        logger.info('Authenticated upload', { username: user.login });

        return {
          user: user.login,
          token: userToken,  // User's token for content PR
          botToken,          // Bot token for CDN PR
        };
      }
    } catch (error) {
      logger.warn('Token validation failed, falling back to anonymous', { error: error.message });
    }
  }

  // Anonymous upload - use bot token for everything
  logger.info('Anonymous upload detected');
  return {
    user: null,
    token: null,
    botToken,
  };
}
