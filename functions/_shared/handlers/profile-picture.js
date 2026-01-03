/**
 * Profile Picture Handler (Platform-Agnostic)
 * Handles custom profile picture operations: get, upload, delete
 *
 * GET /api/profile-picture?userId={userId}  - Get single user's profile picture
 * GET /api/profile-picture?all=true         - Get all profile pictures (admin/cache)
 * POST /api/profile-picture                 - Upload profile picture
 * DELETE /api/profile-picture               - Delete custom profile picture
 */

import { createLogger } from '../../../wiki-framework/src/utils/logger.js';
import { createWikiStorage } from '../createWikiStorage.js';
import { Octokit } from '@octokit/rest';
import {
  validateImageFile,
  validateProcessedImage,
  checkImageModeration,
} from '../image-utils.js';

const logger = createLogger('ProfilePicture');

// Profile picture constants
const PROFILE_PICTURE_MAX_SIZE_MB = 3;
const PROFILE_PICTURE_MAX_SIZE_BYTES = PROFILE_PICTURE_MAX_SIZE_MB * 1024 * 1024;
const PROFILE_PICTURE_ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const PROFILE_PICTURE_OUTPUT_DIMENSIONS = { width: 512, height: 512 };

const ERROR_MESSAGES = {
  TOO_LARGE: `Image too large (max ${PROFILE_PICTURE_MAX_SIZE_MB}MB)`,
  INVALID_FORMAT: `Invalid format. Must be WebP`,
  UPLOAD_FAILED: 'Upload failed. Please try again',
  MODERATION_FAILED: 'Image rejected by moderation',
  UNAUTHORIZED: 'Unauthorized',
  ADMIN_REQUIRED: 'Admin access required',
  INVALID_REQUEST: 'Invalid request',
  MISSING_CONFIG: 'Server configuration error',
};

/**
 * Main handler entry point
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {ConfigAdapter} configAdapter - Config adapter instance
 * @returns {Promise<Object>} Platform-specific response
 */
export async function handleProfilePicture(adapter, configAdapter) {
  const method = adapter.getMethod();

  if (method === 'GET') {
    return handleGetProfilePicture(adapter, configAdapter);
  } else if (method === 'POST') {
    return handlePostProfilePicture(adapter, configAdapter);
  } else if (method === 'DELETE') {
    return handleDeleteProfilePicture(adapter, configAdapter);
  }

  return adapter.createJsonResponse(405, { error: 'Method not allowed' });
}

/**
 * Handle GET requests (retrieve profile picture metadata)
 */
async function handleGetProfilePicture(adapter, configAdapter) {
  try {
    const params = adapter.getQueryParams();
    const { userId, all } = params;

    // Get configuration
    const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
    const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
    const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

    if (!botToken || !owner || !repo) {
      logger.error('Missing configuration', { botToken: !!botToken, owner, repo });
      return adapter.createJsonResponse(500, { error: ERROR_MESSAGES.MISSING_CONFIG });
    }

    // Create storage adapter
    const storageConfig = configAdapter.getStorageConfig(adapter);
    const storage = createWikiStorage(storageConfig, { WIKI_BOT_TOKEN: botToken });

    // Load profile pictures registry
    const registry = await loadProfilePictureRegistry(storage, owner, repo);

    if (all === 'true' || all === true) {
      // Return full registry
      logger.debug('Returning full profile picture registry', { count: Object.keys(registry).length });
      return adapter.createJsonResponse(200, { profilePictures: registry });
    } else if (userId) {
      // Return single user's profile picture
      const profilePictureData = registry[userId] || null;
      logger.debug('Returning profile picture for user', { userId, found: !!profilePictureData });
      return adapter.createJsonResponse(200, { profilePicture: profilePictureData });
    }

    return adapter.createJsonResponse(400, { error: ERROR_MESSAGES.INVALID_REQUEST });
  } catch (error) {
    logger.error('Failed to get profile picture', { error });
    return adapter.createJsonResponse(500, { error: error.message || 'Internal server error' });
  }
}

/**
 * Handle POST requests (upload profile picture)
 */
async function handlePostProfilePicture(adapter, configAdapter) {
  try {
    // Parse multipart form data
    const formData = await adapter.parseMultipartFormData();
    const { imageFile, token, userId, username, dryRun } = formData;

    // Validate required fields
    if (!imageFile || !token || !userId || !username) {
      logger.warn('Missing required fields', {
        hasImage: !!imageFile,
        hasToken: !!token,
        hasUserId: !!userId,
        hasUsername: !!username
      });
      return adapter.createJsonResponse(400, { error: ERROR_MESSAGES.INVALID_REQUEST });
    }

    // Get configuration
    const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
    const cdnToken = adapter.getEnv('CDN_REPO_TOKEN') || botToken;
    const openaiApiKey = adapter.getEnv('OPENAI_API_KEY');
    const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
    const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

    if (!botToken || !cdnToken || !owner || !repo) {
      logger.error('Missing configuration', {
        botToken: !!botToken,
        cdnToken: !!cdnToken,
        owner,
        repo
      });
      return adapter.createJsonResponse(500, { error: ERROR_MESSAGES.MISSING_CONFIG });
    }

    // Load wiki config
    const config = configAdapter.getWikiConfig();
    logger.debug('Loaded config', {
      hasConfig: !!config,
      hasFeatures: !!config?.features,
      hasProfilePictures: !!config?.features?.profilePictures,
      enabled: config?.features?.profilePictures?.enabled,
      configKeys: config ? Object.keys(config) : []
    });

    const profilePictureConfig = config?.features?.profilePictures;

    if (!profilePictureConfig?.enabled) {
      logger.warn('Profile pictures feature disabled', {
        profilePictureConfig,
        configFeatures: config?.features ? Object.keys(config.features) : []
      });
      return adapter.createJsonResponse(403, { error: 'Profile pictures feature is disabled' });
    }

    // Validate user token
    const isValid = await validateUserToken(token, userId);
    if (!isValid) {
      logger.warn('Invalid user token', { userId });
      return adapter.createJsonResponse(401, { error: ERROR_MESSAGES.UNAUTHORIZED });
    }

    // Validate file size
    if (imageFile.size > PROFILE_PICTURE_MAX_SIZE_BYTES) {
      logger.warn('Image too large', { size: imageFile.size, max: PROFILE_PICTURE_MAX_SIZE_BYTES });
      return adapter.createJsonResponse(413, { error: ERROR_MESSAGES.TOO_LARGE });
    }

    // Validate file type (magic bytes check)
    // Client should have already processed to WebP, but validate anyway
    const isValidType = validateImageFile(imageFile.buffer, imageFile.mimetype);
    if (!isValidType) {
      logger.warn('Invalid image type', { mimetype: imageFile.mimetype });
      return adapter.createJsonResponse(400, { error: ERROR_MESSAGES.INVALID_FORMAT });
    }

    // Validate pre-processed image
    // Client should have already resized to 512x512 and converted to WebP
    logger.debug('Validating pre-processed image', { size: imageFile.size });
    const processed = validateProcessedImage(imageFile.buffer);

    // OpenAI Vision moderation (if enabled)
    if (profilePictureConfig?.moderation?.enabled && openaiApiKey) {
      logger.debug('Checking image moderation');
      const moderationResult = await checkImageModeration(processed.base64, openaiApiKey);

      if (moderationResult.flagged) {
        logger.warn('Image flagged by moderation', { userId });
        return adapter.createJsonResponse(422, { error: ERROR_MESSAGES.MODERATION_FAILED });
      }
    }

    // Dry run mode: Skip CDN upload and return mock data for testing
    // (dryRun is already extracted from formData destructuring above)
    const isDryRun = dryRun === 'true' || dryRun === true;
    if (isDryRun) {
      logger.info('DRY RUN: Skipping CDN upload (validation and moderation complete)', {
        userId,
        username
      });

      return adapter.createJsonResponse(200, {
        success: true,
        dryRun: true,
        url: `/mock/cdn/avatars/${userId}.webp?v=${Date.now()}`,
        message: 'Dry run complete - image validated and moderation passed (not uploaded to CDN)'
      });
    }

    // Upload to CDN repository
    logger.info('Uploading profile picture to CDN', { userId, username });

    const cdnConfig = profilePictureConfig?.cdn?.github;
    if (!cdnConfig) {
      logger.error('Missing CDN configuration');
      return adapter.createJsonResponse(500, { error: ERROR_MESSAGES.MISSING_CONFIG });
    }

    const avatarUrl = await uploadToCDN(
      cdnToken,
      cdnConfig,
      userId,
      username,
      processed.buffer,
      processed.extension
    );

    // Save metadata to GitHub Issues registry
    const storageConfig = configAdapter.getStorageConfig(adapter);
    const storage = createWikiStorage(storageConfig, { WIKI_BOT_TOKEN: botToken });

    const metadata = {
      userId: Number(userId),
      username,
      customAvatarUrl: avatarUrl,
      originalFilename: imageFile.filename,
      fileSize: processed.buffer.length,
      mimeType: `image/${processed.extension}`,
      dimensions: PROFILE_PICTURE_OUTPUT_DIMENSIONS,
      uploadDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      changeCount: 1, // Will be incremented if updating
    };

    await saveProfilePictureData(storage, owner, repo, userId, metadata);

    // Note: We use GitHub raw URLs (not jsDelivr) for profile pictures
    // This avoids jsDelivr's aggressive caching and provides immediate updates
    logger.info('Profile picture uploaded successfully', { userId, avatarUrl });

    return adapter.createJsonResponse(200, {
      success: true,
      avatarUrl,
      profilePicture: metadata,
    });
  } catch (error) {
    logger.error('Failed to upload profile picture', { error: error.message, stack: error.stack });
    return adapter.createJsonResponse(500, { error: ERROR_MESSAGES.UPLOAD_FAILED });
  }
}

/**
 * Handle DELETE requests (remove custom profile picture)
 */
async function handleDeleteProfilePicture(adapter, configAdapter) {
  try {
    const params = adapter.getQueryParams();
    const { userId, token } = params;

    if (!userId || !token) {
      return adapter.createJsonResponse(400, { error: ERROR_MESSAGES.INVALID_REQUEST });
    }

    // Get configuration
    const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
    const cdnToken = adapter.getEnv('CDN_REPO_TOKEN') || botToken;
    const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
    const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

    if (!botToken || !cdnToken || !owner || !repo) {
      logger.error('Missing configuration');
      return adapter.createJsonResponse(500, { error: ERROR_MESSAGES.MISSING_CONFIG });
    }

    // Validate user token or admin status
    const isUserValid = await validateUserToken(token, userId);
    const isAdmin = await checkAdminStatus(token, owner, repo);

    if (!isUserValid && !isAdmin) {
      logger.warn('Unauthorized delete attempt', { userId });
      return adapter.createJsonResponse(401, { error: ERROR_MESSAGES.UNAUTHORIZED });
    }

    // Delete from CDN repository
    const config = configAdapter.getWikiConfig();
    const cdnConfig = config?.features?.profilePictures?.cdn?.github;

    if (cdnConfig) {
      await deleteFromCDN(cdnToken, cdnConfig, userId);
    }

    // Delete from registry
    const storageConfig = configAdapter.getStorageConfig(adapter);
    const storage = createWikiStorage(storageConfig, { WIKI_BOT_TOKEN: botToken });

    await deleteProfilePictureData(storage, owner, repo, userId);

    logger.info('Profile picture deleted', { userId, isAdmin });

    return adapter.createJsonResponse(200, { success: true });
  } catch (error) {
    logger.error('Failed to delete profile picture', { error });
    return adapter.createJsonResponse(500, { error: error.message || 'Internal server error' });
  }
}

/**
 * Load profile pictures registry from GitHub Issues
 */
async function loadProfilePictureRegistry(storage, owner, repo) {
  try {
    logger.debug('Loading profile pictures registry');

    // Find registry issue
    const issues = await storage._findIssuesByLabels(['profile-pictures', 'data-version:v1']);
    const registryIssue = issues.find(issue => issue.title === '[Profile Pictures Registry]');

    if (!registryIssue) {
      logger.debug('No profile pictures registry found');
      return {};
    }

    // Parse index map from issue body
    const indexMap = {};
    if (registryIssue.body) {
      const regex = /\[(\d+)\]=(\d+)/g;
      let match;
      while ((match = regex.exec(registryIssue.body)) !== null) {
        const userId = match[1];
        const commentId = parseInt(match[2], 10);
        indexMap[userId] = commentId;
      }
    }

    // Load comments individually using index map
    const registry = {};
    for (const [userId, commentId] of Object.entries(indexMap)) {
      try {
        const { data: comment } = await storage.octokit.rest.issues.getComment({
          owner,
          repo,
          comment_id: commentId
        });

        const data = JSON.parse(comment.body);
        registry[userId] = data;
      } catch (error) {
        logger.warn('Failed to load profile picture data', { userId, commentId, error: error.message });
      }
    }

    logger.debug('Loaded profile pictures registry', { count: Object.keys(registry).length });
    return registry;
  } catch (error) {
    logger.error('Failed to load profile pictures registry', { error });
    return {};
  }
}

/**
 * Save profile picture metadata to GitHub Issues registry
 */
async function saveProfilePictureData(storage, owner, repo, userId, metadata) {
  try {
    logger.debug('Saving profile picture data', { userId });

    // Find or create registry issue
    const issues = await storage._findIssuesByLabels(['profile-pictures', 'data-version:v1']);
    let registryIssue = issues.find(issue => issue.title === '[Profile Pictures Registry]');

    if (!registryIssue) {
      // Create registry issue
      logger.info('Creating profile pictures registry issue');
      const { data: newIssue } = await storage.octokit.rest.issues.create({
        owner,
        repo,
        title: '[Profile Pictures Registry]',
        body: '# Profile Pictures Index\n\n<!-- userId -> commentId mapping -->',
        labels: ['profile-pictures', 'data-version:v1', 'automated'],
      });
      registryIssue = {
        number: newIssue.number,
        body: newIssue.body
      };
    }

    // Parse existing index map
    const indexMap = {};
    if (registryIssue.body) {
      const regex = /\[(\d+)\]=(\d+)/g;
      let match;
      while ((match = regex.exec(registryIssue.body)) !== null) {
        indexMap[match[1]] = parseInt(match[2], 10);
      }
    }

    // Check if user already has a comment
    const existingCommentId = indexMap[userId];

    // Increment changeCount if updating
    if (existingCommentId) {
      try {
        const { data: existingComment } = await storage.octokit.rest.issues.getComment({
          owner,
          repo,
          comment_id: existingCommentId
        });
        const existingData = JSON.parse(existingComment.body);
        metadata.changeCount = (existingData.changeCount || 0) + 1;
      } catch (error) {
        logger.warn('Failed to get existing comment for changeCount', { error, commentId: existingCommentId });
        // Continue without incrementing changeCount
      }
    }

    const commentBody = JSON.stringify(metadata, null, 2);

    if (existingCommentId) {
      // Update existing comment
      logger.debug('Updating existing comment', { userId, commentId: existingCommentId });
      await storage.octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingCommentId,
        body: commentBody,
      });
    } else {
      // Create new comment
      logger.debug('Creating new comment', { userId });
      const { data: newComment } = await storage.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: registryIssue.number,
        body: commentBody,
      });

      // Update index map in issue body
      indexMap[userId] = newComment.id;
      const newBody = `# Profile Pictures Index\n\n<!-- userId -> commentId mapping -->\n${
        Object.entries(indexMap).map(([uid, cid]) => `[${uid}]=${cid}`).join('\n')
      }`;

      logger.debug('Updating registry issue with new index map', { userId, commentId: newComment.id });
      await storage.octokit.rest.issues.update({
        owner,
        repo,
        issue_number: registryIssue.number,
        body: newBody,
      });
    }

    logger.debug('Saved profile picture data successfully', { userId });
  } catch (error) {
    logger.error('Failed to save profile picture data', { error, userId });
    throw error;
  }
}

/**
 * Delete profile picture metadata from GitHub Issues registry
 */
async function deleteProfilePictureData(storage, owner, repo, userId) {
  try {
    logger.debug('Deleting profile picture data', { userId });

    // Find registry issue
    const issues = await storage._findIssuesByLabels(['profile-pictures', 'data-version:v1']);
    const registryIssue = issues.find(issue => issue.title === '[Profile Pictures Registry]');

    if (!registryIssue) {
      logger.debug('No registry found, nothing to delete');
      return;
    }

    // Parse index map
    const indexMap = {};
    if (registryIssue.body) {
      const regex = /\[(\d+)\]=(\d+)/g;
      let match;
      while ((match = regex.exec(registryIssue.body)) !== null) {
        indexMap[match[1]] = parseInt(match[2], 10);
      }
    }

    const commentId = indexMap[userId];
    if (!commentId) {
      logger.debug('User not in registry', { userId });
      return;
    }

    // Delete comment
    logger.debug('Deleting comment', { userId, commentId });
    await storage.octokit.rest.issues.deleteComment({
      owner,
      repo,
      comment_id: commentId,
    });

    // Update index map
    delete indexMap[userId];
    const newBody = `# Profile Pictures Index\n\n<!-- userId -> commentId mapping -->\n${
      Object.entries(indexMap).map(([uid, cid]) => `[${uid}]=${cid}`).join('\n')
    }`;

    logger.debug('Updating registry issue after deletion', { userId });
    await storage.octokit.rest.issues.update({
      owner,
      repo,
      issue_number: registryIssue.number,
      body: newBody,
    });

    logger.debug('Deleted profile picture data successfully', { userId });
  } catch (error) {
    logger.error('Failed to delete profile picture data', { error, userId });
    throw error;
  }
}

/**
 * Upload profile picture to CDN repository
 */
async function uploadToCDN(cdnToken, cdnConfig, userId, username, imageBuffer, extension) {
  const octokit = new Octokit({ auth: cdnToken });
  const { owner, repo, path, servingMode } = cdnConfig;

  const filename = `${userId}.${extension}`;
  const filePath = `${path}/${filename}`;
  const timestamp = Date.now();

  // Convert buffer to base64
  const content = imageBuffer.toString('base64');

  // Check if file exists
  let sha = null;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
    });
    sha = data.sha;
  } catch (error) {
    // File doesn't exist, that's okay
  }

  // Create or update file
  const { data: commitResponse } = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: `${sha ? 'Update' : 'Add'} profile picture for @${username}`,
    content,
    sha,
    branch: 'main',
  });

  // Use the commit SHA in the URL to bypass all caching
  // GitHub caches URLs with branch names like "main", but specific commit SHAs are always fresh
  const commitSha = commitResponse.commit.sha;
  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${filePath}`;

  logger.debug('Using GitHub raw URL with commit SHA for immediate updates', { baseUrl, commitSha });
  return `${baseUrl}?v=${timestamp}`;
}

/**
 * Delete profile picture from CDN repository
 */
async function deleteFromCDN(cdnToken, cdnConfig, userId) {
  try {
    const octokit = new Octokit({ auth: cdnToken });
    const { owner, repo, path } = cdnConfig;

    // Try common extensions
    for (const ext of ['webp', 'jpg', 'jpeg', 'png', 'gif']) {
      const filename = `${userId}.${ext}`;
      const filePath = `${path}/${filename}`;

      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
        });

        await octokit.rest.repos.deleteFile({
          owner,
          repo,
          path: filePath,
          message: `Delete profile picture for user ${userId}`,
          sha: data.sha,
          branch: 'main',
        });

        logger.debug('Deleted file from CDN', { filePath });
        return; // Success, stop trying other extensions
      } catch (error) {
        // File doesn't exist with this extension, try next
      }
    }

    logger.debug('No profile picture file found in CDN', { userId });
  } catch (error) {
    logger.error('Failed to delete from CDN', { error, userId });
    // Don't throw - allow registry deletion to proceed
  }
}

/**
 * Validate user token
 */
async function validateUserToken(token, expectedUserId) {
  try {
    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    return user.id === Number(expectedUserId);
  } catch (error) {
    logger.warn('Token validation failed', { error: error.message });
    return false;
  }
}

/**
 * Check if user has admin permissions
 */
async function checkAdminStatus(token, owner, repo) {
  try {
    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.rest.users.getAuthenticated();

    const { data: permission } = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: user.login,
    });

    return permission.permission === 'admin' || permission.permission === 'write';
  } catch (error) {
    return false;
  }
}
