/**
 * Image Upload Request Handler
 * Platform-agnostic handler for processing image upload requests
 */

import { createLogger } from '../../../wiki-framework/src/utils/logger.js';
import { handleImageUpload } from './image-upload.js';
import { parseMultipartFormData } from '../multipart.js';

const logger = createLogger('ImageUploadAPI');

// Maximum file sizes
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Handle image upload request
 * @param {Object} adapter - Platform adapter (Netlify, Cloudflare, etc)
 * @param {Object} configAdapter - Config adapter instance
 * @returns {Promise<Response>} API response
 */
export async function handleImageUploadRequest(adapter, configAdapter) {
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
    logger.info('Image upload request received', { contentType });

    // Load wiki config
    const config = configAdapter.getWikiConfig();

    // Debug: Log config structure
    logger.info('Config loaded', {
      hasConfig: !!config,
      hasFeatures: !!config?.features,
      hasImageUploads: !!config?.features?.imageUploads,
      imageUploadsEnabled: config?.features?.imageUploads?.enabled,
      configKeys: config ? Object.keys(config) : []
    });

    // Check if image uploads are enabled
    if (!config?.features?.imageUploads?.enabled) {
      logger.error('Image uploads check failed', {
        config: config ? 'exists' : 'null',
        features: config?.features ? 'exists' : 'null',
        imageUploads: config?.features?.imageUploads ? 'exists' : 'null',
        enabled: config?.features?.imageUploads?.enabled
      });
      return adapter.createJsonResponse(403, {
        error: 'Image uploads are not enabled',
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
      // For Cloudflare, construct a Netlify-compatible event object
      let event;
      if (adapter.event) {
        // Netlify: use event directly
        event = adapter.event;
      } else {
        // Cloudflare: get raw Request and read as ArrayBuffer for binary data
        const request = adapter.request;
        const arrayBuffer = await request.arrayBuffer();
        const bodyBuffer = Buffer.from(arrayBuffer);

        event = {
          headers: adapter.getHeaders(),
          body: bodyBuffer,
          isBase64Encoded: false
        };

        // Check if body looks correct
        const bodyPreview = bodyBuffer.toString('utf-8', 0, Math.min(500, bodyBuffer.length));
        const boundaryMatch = event.headers['content-type'].match(/boundary=([^;]+)/);
        const boundary = boundaryMatch ? boundaryMatch[1] : 'unknown';
        const boundaryOccurrences = (bodyBuffer.toString('binary').match(new RegExp(`--${boundary}`, 'g')) || []).length;

        logger.debug('Constructed Cloudflare event', {
          bodyLength: bodyBuffer.length,
          headerKeys: Object.keys(event.headers),
          boundary: boundary,
          boundaryCount: boundaryOccurrences,
          expectedParts: 7,
          bodyStart: bodyPreview.substring(0, 200)
        });
      }

      formData = await parseMultipartFormData(event);

      // Debug: Log all parsed fields
      logger.info('Parsed form data', {
        fields: Object.keys(formData.fields || {}),
        files: Object.keys(formData.files || {}),
        dimensionsField: formData.fields.dimensions,
        dimensionsType: typeof formData.fields.dimensions
      });
    } catch (error) {
      logger.error('Failed to parse multipart data', { error: error.message });
      return adapter.createJsonResponse(400, {
        error: 'Failed to parse form data',
      });
    }

    // Extract original image file (required)
    const originalFile = formData.files?.originalFile;
    if (!originalFile) {
      return adapter.createJsonResponse(400, {
        error: 'Original image file is required',
      });
    }

    const maxSizeMB = config?.features?.imageUploads?.maxFileSizeMB || 10;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (originalFile.size > maxSizeBytes) {
      return adapter.createJsonResponse(400, {
        error: `Original image file too large. Maximum size: ${maxSizeMB}MB`,
      });
    }

    // Extract WebP image file (required - client-side processing)
    const webpFile = formData.files?.webpFile;
    if (!webpFile) {
      return adapter.createJsonResponse(400, {
        error: 'WebP image file is required (images must be processed client-side)',
      });
    }

    if (webpFile.size > maxSizeBytes) {
      return adapter.createJsonResponse(400, {
        error: `WebP image file too large. Maximum size: ${maxSizeMB}MB`,
      });
    }

    // Extract form fields
    const name = formData.fields.name;
    const description = formData.fields.description || '';
    const category = formData.fields.category;
    const tagsString = formData.fields.tags;
    const dimensionsString = formData.fields.dimensions;
    const userEmail = formData.fields.userEmail;
    const verificationToken = formData.fields.verificationToken;
    const dryRun = formData.fields.dryRun === 'true' || formData.fields.dryRun === true;

    // Parse tags
    let tags = [];
    if (tagsString) {
      try {
        tags = JSON.parse(tagsString);
        if (!Array.isArray(tags)) {
          tags = [];
        }
      } catch (error) {
        // If not JSON, try comma-separated
        tags = tagsString.split(',').map(t => t.trim()).filter(t => t.length > 0);
      }
    }

    // Parse dimensions
    let dimensions = { width: 0, height: 0 };
    if (dimensionsString) {
      try {
        dimensions = JSON.parse(dimensionsString);
        if (!dimensions.width || !dimensions.height) {
          return adapter.createJsonResponse(400, {
            error: 'Invalid dimensions format. Expected { width, height }',
          });
        }
      } catch (error) {
        return adapter.createJsonResponse(400, {
          error: 'Invalid dimensions format. Expected JSON object',
        });
      }
    }

    // Get authentication info
    const auth = await getAuthInfo(adapter, config);

    // Prepare upload parameters
    const uploadParams = {
      originalFile: originalFile.data,
      originalFilename: originalFile.filename,
      originalMimeType: originalFile.contentType,
      webpFile: webpFile.data,
      dimensions,
      name,
      description,
      category,
      tags,
      userEmail,
      verificationToken,
      dryRun,
      auth,
      config,
      adapter,
    };

    // Handle image upload
    logger.info('Starting image upload process', {
      name,
      category,
      uploadedBy: auth.user?.login || 'anonymous',
      originalSize: originalFile.size,
      webpSize: webpFile.size,
      dryRun
    });

    const result = await handleImageUpload(uploadParams);

    logger.info('Image upload successful', {
      imageId: result.imageId,
      uploadedBy: auth.user?.login || 'anonymous',
    });

    return adapter.createJsonResponse(200, result);
  } catch (error) {
    logger.error('Image upload request failed', {
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
  const botToken = adapter.getEnv('WIKI_BOT_TOKEN') || adapter.getEnv('VITE_WIKI_BOT_TOKEN');

  if (!botToken) {
    throw new Error('Bot token not configured');
  }

  // Check for user authentication token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const userToken = authHeader.substring(7);

    logger.debug('Attempting to validate user token', {
      tokenLength: userToken.length,
      tokenPrefix: userToken.substring(0, 7) + '...'
    });

    // Validate token by fetching user info
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SlayerLegend-Wiki-ImageUpload/1.0'
        },
      });

      if (response.ok) {
        const user = await response.json();
        logger.info('Authenticated upload', { username: user.login });

        return {
          user,
          token: userToken,  // User's token
          botToken,          // Bot token for CDN commits
        };
      } else {
        const errorBody = await response.text().catch(() => '');
        logger.warn('Token validation failed', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorBody.substring(0, 200)
        });
      }
    } catch (error) {
      logger.warn('Token validation error', { error: error.message });
    }
  }

  // Anonymous upload - use bot token only
  logger.info('Anonymous upload');
  return {
    user: null,
    token: null,
    botToken,
  };
}
