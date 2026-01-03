/**
 * Display Name Handler (Platform-Agnostic)
 * Handles display name operations: get, set, validate, reset, ban
 *
 * GET /api/display-name?userId={userId}  - Get single user's display name
 * GET /api/display-name?all=true         - Get all display names (for uniqueness checking)
 * POST /api/display-name                 - Set/validate/ban display name
 * DELETE /api/display-name               - Admin: Reset user's display name
 */

import { createLogger } from '../../../src/utils/logger.js';
import { createWikiStorage } from '../createWikiStorage.js';
import { Octokit } from '@octokit/rest';

const logger = createLogger('DisplayName');

// Display name constants
const DISPLAY_NAME_MAX_LENGTH = 30;
const DISPLAY_NAME_MIN_LENGTH = 1;
const DISPLAY_NAME_CHANGE_COOLDOWN_DAYS = 30;
const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9\s\-_]+$/;

const ERROR_MESSAGES = {
  TOO_SHORT: `Display name must be at least ${DISPLAY_NAME_MIN_LENGTH} character`,
  TOO_LONG: `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`,
  INVALID_CHARS: 'Display name can only contain letters, numbers, spaces, hyphens, and underscores',
  NOT_UNIQUE: 'This display name is already taken',
  COOLDOWN: 'You can only change your display name once per month',
  MODERATION_FAILED: 'Display name contains inappropriate content',
  BANNED: 'You cannot reuse this display name (previously banned)',
  UNAUTHORIZED: 'Unauthorized',
  ADMIN_REQUIRED: 'Admin access required',
  INVALID_REQUEST: 'Invalid request',
};

/**
 * Main handler entry point
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {ConfigAdapter} configAdapter - Config adapter instance
 * @returns {Promise<Object>} Platform-specific response
 */
export async function handleDisplayName(adapter, configAdapter) {
  const method = adapter.getMethod();

  if (method === 'GET') {
    return handleGetDisplayName(adapter, configAdapter);
  } else if (method === 'POST') {
    return handlePostDisplayName(adapter, configAdapter);
  } else if (method === 'DELETE') {
    return handleDeleteDisplayName(adapter, configAdapter);
  }

  return adapter.createJsonResponse(405, { error: 'Method not allowed' });
}

/**
 * Handle GET requests (retrieve display names)
 */
async function handleGetDisplayName(adapter, configAdapter) {
  try {
    const params = adapter.getQueryParams();
    const { userId, all } = params;

    // Get configuration
    const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
    const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
    const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

    if (!botToken || !owner || !repo) {
      logger.error('Missing configuration', { botToken: !!botToken, owner, repo });
      return adapter.createJsonResponse(500, { error: 'Server configuration error' });
    }

    // Create storage adapter
    const storageConfig = configAdapter.getStorageConfig(adapter);
    const storage = createWikiStorage(storageConfig, { WIKI_BOT_TOKEN: botToken });

    // Load display names registry
    const registry = await loadDisplayNameRegistry(storage, owner, repo);

    if (all === 'true' || all === true) {
      // Return full registry
      logger.debug('Returning full display name registry', { count: Object.keys(registry).length });
      return adapter.createJsonResponse(200, { displayNames: registry });
    } else if (userId) {
      // Return single user's display name
      const displayNameData = registry[userId] || null;
      logger.debug('Returning display name for user', { userId, found: !!displayNameData });
      return adapter.createJsonResponse(200, { displayName: displayNameData });
    }

    return adapter.createJsonResponse(400, { error: 'Missing userId or all parameter' });
  } catch (error) {
    logger.error('Failed to get display name', { error });
    return adapter.createJsonResponse(500, { error: error.message || 'Internal server error' });
  }
}

/**
 * Handle POST requests (set, validate, ban)
 */
async function handlePostDisplayName(adapter, configAdapter) {
  try {
    const body = await adapter.getBody();
    const data = JSON.parse(body);
    const { action } = data;

    if (action === 'set') {
      return handleSetDisplayName(adapter, configAdapter, data);
    } else if (action === 'validate') {
      return handleValidateDisplayName(adapter, configAdapter, data);
    } else if (action === 'ban') {
      return handleBanDisplayName(adapter, configAdapter, data);
    }

    return adapter.createJsonResponse(400, { error: 'Invalid action. Must be: set, validate, or ban' });
  } catch (error) {
    logger.error('Failed to handle POST request', { error });
    return adapter.createJsonResponse(500, { error: error.message || 'Internal server error' });
  }
}

/**
 * Handle DELETE requests (admin reset)
 */
async function handleDeleteDisplayName(adapter, configAdapter) {
  try {
    const params = adapter.getQueryParams();
    const { userId, adminToken } = params;

    if (!userId || !adminToken) {
      return adapter.createJsonResponse(400, { error: 'Missing userId or adminToken' });
    }

    // Get configuration
    const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
    const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
    const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

    if (!botToken || !owner || !repo) {
      logger.error('Missing configuration', { botToken: !!botToken, owner, repo });
      return adapter.createJsonResponse(500, { error: 'Server configuration error' });
    }

    // Verify admin status
    const isAdmin = await checkAdminStatus(adminToken, owner, repo);
    if (!isAdmin) {
      logger.warn('Unauthorized reset attempt', { userId });
      return adapter.createJsonResponse(403, { error: ERROR_MESSAGES.ADMIN_REQUIRED });
    }

    // Create storage adapter
    const storageConfig = configAdapter.getStorageConfig(adapter);
    const storage = createWikiStorage(storageConfig, { WIKI_BOT_TOKEN: botToken });

    // Delete display name data
    await deleteDisplayNameData(storage, owner, repo, userId);

    logger.info('Display name reset by admin', { userId });
    return adapter.createJsonResponse(200, { success: true });
  } catch (error) {
    logger.error('Failed to reset display name', { error });
    return adapter.createJsonResponse(500, { error: error.message || 'Internal server error' });
  }
}

/**
 * Set display name for a user
 */
async function handleSetDisplayName(adapter, configAdapter, data) {
  const { userId, username, displayName, token } = data;

  // Validate required fields
  if (!userId || !username || !displayName || !token) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: userId, username, displayName, token' });
  }

  // Validate authentication
  const isValid = await validateUserToken(token, userId);
  if (!isValid) {
    logger.warn('Invalid authentication token', { userId });
    return adapter.createJsonResponse(401, { error: ERROR_MESSAGES.UNAUTHORIZED });
  }

  // Validate display name format
  const formatValidation = validateDisplayNameFormat(displayName);
  if (!formatValidation.valid) {
    return adapter.createJsonResponse(400, { error: formatValidation.error });
  }

  // Get configuration
  const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
  const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
  const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

  if (!botToken || !owner || !repo) {
    logger.error('Missing configuration', { botToken: !!botToken, owner, repo });
    return adapter.createJsonResponse(500, { error: 'Server configuration error' });
  }

  // Create storage adapter
  const storageConfig = configAdapter.getStorageConfig(adapter);
  const storage = createWikiStorage(storageConfig, { WIKI_BOT_TOKEN: botToken });

  // Load registry
  const registry = await loadDisplayNameRegistry(storage, owner, repo);

  // Check cooldown
  const userData = registry[userId];
  if (userData && !canChangeDisplayName(userData.lastChanged)) {
    const nextChangeDate = calculateNextChangeDate(userData.lastChanged);
    logger.debug('Cooldown active', { userId, nextChangeDate });
    return adapter.createJsonResponse(400, {
      error: ERROR_MESSAGES.COOLDOWN,
      nextChangeDate
    });
  }

  // Check if display name is banned for this user
  if (userData?.bannedNames?.includes(displayName.toLowerCase())) {
    logger.debug('Banned name attempted', { userId, displayName });
    return adapter.createJsonResponse(400, { error: ERROR_MESSAGES.BANNED });
  }

  // Check uniqueness (case-insensitive)
  const isUnique = checkDisplayNameUniqueness(registry, displayName, userId);
  if (!isUnique) {
    logger.debug('Duplicate display name', { displayName });
    return adapter.createJsonResponse(400, { error: ERROR_MESSAGES.NOT_UNIQUE });
  }

  // Moderate with OpenAI
  const moderationResult = await checkProfanity(adapter, displayName);
  if (moderationResult.containsProfanity) {
    logger.info('Display name flagged by moderation', { userId, displayName });
    return adapter.createJsonResponse(400, { error: ERROR_MESSAGES.MODERATION_FAILED });
  }

  // Prepare history array - add old display name to history if it exists
  let history = userData?.history || [];
  if (userData?.displayName && userData.displayName !== displayName) {
    // Push the old display name to history
    history.unshift({
      displayName: userData.displayName,
      changedAt: userData.lastChanged || new Date().toISOString()
    });

    // Keep only last 5 entries
    if (history.length > 5) {
      history = history.slice(0, 5);
    }

    logger.debug('Added old display name to history', {
      userId,
      oldName: userData.displayName,
      newName: displayName,
      historySize: history.length
    });
  }

  // Prepare display name data
  const displayNameData = {
    userId: Number(userId),
    username,
    displayName,
    lastChanged: new Date().toISOString(),
    changeCount: (userData?.changeCount || 0) + 1,
    bannedNames: userData?.bannedNames || [],
    history: history
  };

  // Save display name data
  await saveDisplayNameData(storage, owner, repo, userId, displayNameData);

  logger.info('Display name set successfully', { userId, displayName });
  return adapter.createJsonResponse(200, {
    success: true,
    displayName: displayNameData
  });
}

/**
 * Validate display name (format, uniqueness, moderation)
 */
async function handleValidateDisplayName(adapter, configAdapter, data) {
  const { displayName, userId } = data;

  if (!displayName) {
    return adapter.createJsonResponse(400, { error: 'Missing required field: displayName' });
  }

  // Format validation
  const formatValidation = validateDisplayNameFormat(displayName);
  if (!formatValidation.valid) {
    return adapter.createJsonResponse(200, {
      valid: false,
      error: formatValidation.error
    });
  }

  // Get configuration
  const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
  const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
  const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

  if (!botToken || !owner || !repo) {
    logger.error('Missing configuration', { botToken: !!botToken, owner, repo });
    return adapter.createJsonResponse(500, { error: 'Server configuration error' });
  }

  // Create storage adapter
  const storageConfig = configAdapter.getStorageConfig(adapter);
  const storage = createWikiStorage(storageConfig, { WIKI_BOT_TOKEN: botToken });

  // Load registry
  const registry = await loadDisplayNameRegistry(storage, owner, repo);

  // Uniqueness check
  const isUnique = checkDisplayNameUniqueness(registry, displayName, userId);
  if (!isUnique) {
    return adapter.createJsonResponse(200, {
      valid: false,
      error: ERROR_MESSAGES.NOT_UNIQUE
    });
  }

  // Moderation check
  const moderationResult = await checkProfanity(adapter, displayName);
  if (moderationResult.containsProfanity) {
    return adapter.createJsonResponse(200, {
      valid: false,
      error: ERROR_MESSAGES.MODERATION_FAILED
    });
  }

  return adapter.createJsonResponse(200, { valid: true });
}

/**
 * Ban display name for a user (admin only)
 */
async function handleBanDisplayName(adapter, configAdapter, data) {
  const { userId, displayName, adminToken } = data;

  if (!userId || !displayName || !adminToken) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: userId, displayName, adminToken' });
  }

  // Get configuration
  const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
  const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
  const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

  if (!botToken || !owner || !repo) {
    logger.error('Missing configuration', { botToken: !!botToken, owner, repo });
    return adapter.createJsonResponse(500, { error: 'Server configuration error' });
  }

  // Verify admin status
  const isAdmin = await checkAdminStatus(adminToken, owner, repo);
  if (!isAdmin) {
    logger.warn('Unauthorized ban attempt', { userId, displayName });
    return adapter.createJsonResponse(403, { error: ERROR_MESSAGES.ADMIN_REQUIRED });
  }

  // Create storage adapter
  const storageConfig = configAdapter.getStorageConfig(adapter);
  const storage = createWikiStorage(storageConfig, { WIKI_BOT_TOKEN: botToken });

  // Load registry
  const registry = await loadDisplayNameRegistry(storage, owner, repo);

  // Add to user's banned names list
  if (!registry[userId]) {
    registry[userId] = {
      userId: Number(userId),
      username: 'unknown',
      displayName: null,
      lastChanged: null,
      changeCount: 0,
      bannedNames: [],
      history: []
    };
  }

  // Update banned names list
  if (!registry[userId].bannedNames.includes(displayName.toLowerCase())) {
    registry[userId].bannedNames.push(displayName.toLowerCase());
  }

  // Reset current display name if it matches
  if (registry[userId].displayName?.toLowerCase() === displayName.toLowerCase()) {
    registry[userId].displayName = null;
  }

  // Save updated user data
  await saveDisplayNameData(storage, owner, repo, userId, registry[userId]);

  logger.info('Display name banned by admin', { userId, displayName });
  return adapter.createJsonResponse(200, { success: true });
}

const INDEX_HEADER = '';

/**
 * Parse the index map from issue body
 * Format: [userId]=commentId
 * @param {string} body - Issue body text
 * @returns {Map<string, number>} Map of userIds to comment IDs
 */
function parseIndexMap(body) {
  const map = new Map();
  if (!body) return map;

  // Match lines like: [userId]=comment-id
  const regex = /\[(\d+)\]=(\d+)/g;
  let match;

  while ((match = regex.exec(body)) !== null) {
    const userId = match[1];
    const commentId = parseInt(match[2], 10);
    map.set(userId, commentId);
  }

  return map;
}

/**
 * Serialize index map to issue body format
 * @param {Map<string, number>} map - Map of userIds to comment IDs
 * @returns {string} Formatted issue body
 */
function serializeIndexMap(map) {
  let body = INDEX_HEADER;
  for (const [userId, commentId] of map.entries()) {
    body += `[${userId}]=${commentId}\n`;
  }
  return body;
}

/**
 * Get or create the display names registry issue
 */
async function getOrCreateRegistryIssue(storage, owner, repo) {
  try {
    // Find existing registry issue
    const issues = await storage._findIssuesByLabels(['display-names', 'data-version:v1']);
    const registryIssue = issues.find(issue => issue.title === '[Display Names Registry]');

    if (registryIssue) {
      return {
        number: registryIssue.number,
        body: registryIssue.body || INDEX_HEADER
      };
    }

    // Create new registry issue
    logger.info('Creating display names registry issue');
    const { data: newIssue } = await storage.octokit.rest.issues.create({
      owner,
      repo,
      title: '[Display Names Registry]',
      body: INDEX_HEADER,
      labels: ['display-names', 'data-version:v1', 'automated']
    });

    return {
      number: newIssue.number,
      body: INDEX_HEADER
    };
  } catch (error) {
    logger.error('Failed to get/create registry issue', { error });
    throw error;
  }
}

/**
 * Load display name registry from GitHub Issues
 * Returns object keyed by userId with display name data
 */
async function loadDisplayNameRegistry(storage, owner, repo) {
  try {
    // Get registry issue
    const registryIssue = await getOrCreateRegistryIssue(storage, owner, repo);

    // Parse index map
    const indexMap = parseIndexMap(registryIssue.body);

    if (indexMap.size === 0) {
      logger.debug('No display names in registry');
      return {};
    }

    // Load all comments with display name data
    const registry = {};

    for (const [userId, commentId] of indexMap.entries()) {
      try {
        const { data: comment } = await storage.octokit.rest.issues.getComment({
          owner,
          repo,
          comment_id: commentId
        });

        const data = JSON.parse(comment.body);
        registry[userId] = data;
      } catch (error) {
        logger.warn('Failed to load comment for user', { userId, commentId, error: error.message });
        // Skip this user if comment can't be loaded
      }
    }

    logger.debug('Loaded display name registry', { count: Object.keys(registry).length });
    return registry;
  } catch (error) {
    logger.error('Failed to load display name registry', { error });
    return {};
  }
}

/**
 * Save display name data for a single user
 * Creates new comment or updates existing comment
 */
async function saveDisplayNameData(storage, owner, repo, userId, displayNameData) {
  try {
    // Get registry issue
    const registryIssue = await getOrCreateRegistryIssue(storage, owner, repo);

    // Parse index map
    const indexMap = parseIndexMap(registryIssue.body);

    // Prepare comment body
    const commentBody = JSON.stringify(displayNameData, null, 2);

    // Check if user already has a comment
    if (indexMap.has(String(userId))) {
      // Update existing comment
      const commentId = indexMap.get(String(userId));
      logger.debug('Updating existing comment', { userId, commentId });

      await storage.octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: commentId,
        body: commentBody
      });
    } else {
      // Create new comment
      logger.debug('Creating new comment', { userId });

      const { data: comment } = await storage.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: registryIssue.number,
        body: commentBody
      });

      // Add to index map
      indexMap.set(String(userId), comment.id);

      // Update issue body with new map
      const newBody = serializeIndexMap(indexMap);
      await storage.octokit.rest.issues.update({
        owner,
        repo,
        issue_number: registryIssue.number,
        body: newBody
      });

      logger.debug('Updated index map', { userId, commentId: comment.id });
    }

    logger.info('Saved display name data', { userId });
  } catch (error) {
    logger.error('Failed to save display name data', { userId, error });
    throw error;
  }
}

/**
 * Delete display name data for a single user
 * Deletes comment and removes from index map
 */
async function deleteDisplayNameData(storage, owner, repo, userId) {
  try {
    // Get registry issue
    const registryIssue = await getOrCreateRegistryIssue(storage, owner, repo);

    // Parse index map
    const indexMap = parseIndexMap(registryIssue.body);

    // Check if user has a comment
    if (!indexMap.has(String(userId))) {
      logger.debug('No display name to delete', { userId });
      return;
    }

    // Get comment ID
    const commentId = indexMap.get(String(userId));

    // Delete the comment
    logger.debug('Deleting comment', { userId, commentId });
    await storage.octokit.rest.issues.deleteComment({
      owner,
      repo,
      comment_id: commentId
    });

    // Remove from index map
    indexMap.delete(String(userId));

    // Update issue body with new map
    const newBody = serializeIndexMap(indexMap);
    await storage.octokit.rest.issues.update({
      owner,
      repo,
      issue_number: registryIssue.number,
      body: newBody
    });

    logger.info('Deleted display name data', { userId });
  } catch (error) {
    logger.error('Failed to delete display name data', { userId, error });
    throw error;
  }
}

/**
 * Validate display name format
 */
function validateDisplayNameFormat(displayName) {
  if (!displayName || displayName.length < DISPLAY_NAME_MIN_LENGTH) {
    return { valid: false, error: ERROR_MESSAGES.TOO_SHORT };
  }

  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return { valid: false, error: ERROR_MESSAGES.TOO_LONG };
  }

  if (!DISPLAY_NAME_PATTERN.test(displayName)) {
    return { valid: false, error: ERROR_MESSAGES.INVALID_CHARS };
  }

  return { valid: true };
}

/**
 * Check display name uniqueness (case-insensitive)
 */
function checkDisplayNameUniqueness(registry, displayName, excludeUserId) {
  const lowerDisplayName = displayName.toLowerCase();

  for (const [userId, userData] of Object.entries(registry)) {
    // Skip the user we're updating
    if (userId === String(excludeUserId)) {
      continue;
    }

    // Check if another user has this display name
    if (userData.displayName?.toLowerCase() === lowerDisplayName) {
      return false;
    }
  }

  return true;
}

/**
 * Check if user can change display name (cooldown check)
 */
function canChangeDisplayName(lastChanged) {
  if (!lastChanged) {
    return true;
  }

  const lastChangedDate = new Date(lastChanged);
  const cooldownMs = DISPLAY_NAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const nextChangeDate = new Date(lastChangedDate.getTime() + cooldownMs);

  return Date.now() >= nextChangeDate.getTime();
}

/**
 * Calculate next allowed change date
 */
function calculateNextChangeDate(lastChanged) {
  if (!lastChanged) {
    return null;
  }

  const lastChangedDate = new Date(lastChanged);
  const cooldownMs = DISPLAY_NAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return new Date(lastChangedDate.getTime() + cooldownMs).toISOString();
}

/**
 * Validate user token (check if token matches userId)
 */
async function validateUserToken(token, expectedUserId) {
  try {
    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    return user.id === Number(expectedUserId);
  } catch (error) {
    logger.error('Token validation failed', { error });
    return false;
  }
}

/**
 * Check if user is admin
 */
async function checkAdminStatus(token, owner, repo) {
  try {
    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.rest.users.getAuthenticated();

    // Check repository permissions
    const { data: permission } = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: user.login
    });

    // Admin or owner permission required
    return permission.permission === 'admin' || permission.permission === 'write';
  } catch (error) {
    logger.error('Admin check failed', { error });
    return false;
  }
}

/**
 * Check profanity using OpenAI Moderation API
 */
async function checkProfanity(adapter, text) {
  const openaiApiKey = adapter.getEnv("OPENAI_API_KEY");

  // Try OpenAI Moderation API first (if configured)
  if (openaiApiKey) {
    try {
      logger.debug('Checking with OpenAI Moderation API');
      const response = await fetch(
        'https://api.openai.com/v1/moderations',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: text
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const result = data.results[0];

        // OpenAI returns flagged=true if content violates policies
        const containsProfanity = result.flagged;

        logger.debug('OpenAI Moderation result', {
          flagged: result.flagged,
          categories: result.categories
        });

        return { containsProfanity };
      } else {
        logger.warn('OpenAI Moderation API error', { status: response.status });
      }
    } catch (error) {
      logger.error('OpenAI Moderation API failed', { error });
    }
  }

  // No moderation configured or API failed - allow content
  logger.debug('No moderation configured, allowing content');
  return { containsProfanity: false };
}
