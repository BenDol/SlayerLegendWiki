import { createLogger } from '../../../src/utils/logger.js';
const logger = createLogger('SaveData');

/**
 * Save Data Handler (Platform-Agnostic)
 * Handles saving skill builds, battle loadouts, engraving builds, spirit collection, and grid submissions
 *
 * POST /api/save-data
 * Headers: {
 *   Authorization: Bearer <github-token> (REQUIRED for user-centric types)
 * }
 * Body: {
 *   type: 'skill-builds' | 'battle-loadouts' | 'my-spirits' | 'spirit-builds' | 'engraving-builds' | 'grid-submission',
 *   data: object,
 *   spiritId?: string (For my-spirits updates),
 *   replace?: boolean (for grid-submission replace mode)
 * }
 *
 * SECURITY: Username and userId are now derived from the authenticated token, NOT from request body
 */

import { createWikiStorage } from '../createWikiStorage.js';
import {
  DATA_TYPE_CONFIGS,
  VALID_DATA_TYPES,
} from '../utils.js';
import {
  validateBuildData,
  validateGridSubmission,
  validateRequestBodySize,
} from '../validation.js';
import { Octokit } from '@octokit/rest';

/**
 * Handle save data request
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {ConfigAdapter} configAdapter - Config adapter instance
 * @returns {Promise<Object>} Platform-specific response
 */
export async function handleSaveData(adapter, configAdapter) {
  // Only accept POST requests
  if (adapter.getMethod() !== 'POST') {
    return adapter.createJsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    // Get request body
    const body = await adapter.getBody();

    // Validate request body size first
    const bodySizeResult = validateRequestBodySize(body);
    if (!bodySizeResult.valid) {
      return adapter.createJsonResponse(413, { error: bodySizeResult.error });
    }

    // Parse request body
    const { type, data, spiritId, replace = false } = JSON.parse(body);

    // Validate required fields
    if (!type || !data) {
      return adapter.createJsonResponse(400, { error: 'Missing required fields: type, data' });
    }

    // Validate type
    if (!VALID_DATA_TYPES.includes(type)) {
      return adapter.createJsonResponse(400, {
        error: `Invalid type. Must be one of: ${VALID_DATA_TYPES.join(', ')}`
      });
    }

    // AUTHENTICATION: For user-centric types, verify token and get authenticated user
    let username = null;
    let userId = null;

    if (type !== 'grid-submission') {
      // Extract auth token from Authorization header
      const token = adapter.getAuthToken();
      if (!token) {
        logger.warn('No auth token provided for user-centric save', { type });
        return adapter.createJsonResponse(401, { error: 'Authentication required' });
      }

      // Verify token with GitHub and get authenticated user
      try {
        const octokit = new Octokit({ auth: token });
        const { data: user } = await octokit.rest.users.getAuthenticated();

        // Use VERIFIED user identity from GitHub
        username = user.login;
        userId = user.id;

        logger.debug('Authenticated user for save', { username, userId, type });
      } catch (error) {
        logger.error('Token verification failed', { error: error.message });
        return adapter.createJsonResponse(401, { error: 'Invalid authentication token' });
      }
    }

    // Get configuration
    const config = DATA_TYPE_CONFIGS[type];

    // Validate data structure
    if (type === 'grid-submission') {
      // Validate grid submission data
      const gridResult = validateGridSubmission(data);
      if (!gridResult.valid) {
        return adapter.createJsonResponse(400, { error: gridResult.error });
      }
    } else {
      // Validate build data (skill-builds, spirit-builds, battle-loadouts, my-spirits)
      const buildResult = validateBuildData(data, type);
      if (!buildResult.valid) {
        return adapter.createJsonResponse(400, { error: buildResult.error });
      }

      // Additional checks for specific types
      if (type === 'my-spirits' && !data.spiritId) {
        return adapter.createJsonResponse(400, { error: 'Spirit data must include a spiritId' });
      }

      if (type === 'skill-builds' && (!data.maxSlots || !data.slots)) {
        return adapter.createJsonResponse(400, { error: 'Build must have maxSlots and slots' });
      }

      if (type === 'engraving-builds' && (!data.weaponId || !data.weaponName || !data.gridState || !data.inventory)) {
        return adapter.createJsonResponse(400, {
          error: 'Engraving build must have weaponId, weaponName, gridState, and inventory'
        });
      }
    }

    // Get bot token from environment
    const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
    if (!botToken) {
      console.error('[save-data] WIKI_BOT_TOKEN not configured');
      return adapter.createJsonResponse(500, { error: 'Server configuration error' });
    }

    // Get repo info from environment
    const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
    const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

    if (!owner || !repo) {
      console.error('[save-data] Repository config missing');
      return adapter.createJsonResponse(500, { error: 'Server configuration error' });
    }

    // Create storage adapter using config
    const storageConfig = configAdapter.getStorageConfig(adapter);
    const storage = createWikiStorage(storageConfig, { WIKI_BOT_TOKEN: botToken });

    // Handle grid submissions (weapon-centric)
    if (type === 'grid-submission') {
      return await handleGridSubmission(adapter, storage, config, data, username, replace);
    }

    // Handle user-centric data
    return await handleUserCentricSave(adapter, storage, config, type, username, userId, data, spiritId);

  } catch (error) {
    console.error('[save-data] Error:', error);
    return adapter.createJsonResponse(500, { error: error.message || 'Internal server error' });
  }
}

/**
 * Check text for profanity using OpenAI Moderation API (primary) with leo-profanity fallback
 * Imported from github-bot handler pattern
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {string} text - Text to check
 * @returns {Promise<{containsProfanity: boolean, method: string, categories?: object}>}
 */
async function checkProfanity(adapter, text) {
  const openaiApiKey = adapter.getEnv("OPENAI_API_KEY");

  // Try OpenAI Moderation API first (if configured)
  if (openaiApiKey) {
    try {
      logger.debug('Checking with OpenAI Moderation API for text:', text);
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
        // Categories: hate, harassment, self-harm, sexual, violence
        const containsProfanity = result.flagged;

        logger.debug('OpenAI Moderation result', {
          flagged: result.flagged,
          categories: result.categories,
          category_scores: result.category_scores
        });

        return {
          containsProfanity,
          method: 'openai-moderation',
          categories: result.categories,
          scores: result.category_scores
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[Profanity] OpenAI API request failed:', response.status, errorData, 'falling back to basic check');
      }
    } catch (error) {
      console.warn('[Profanity] OpenAI API error:', error.message, 'falling back to basic check');
    }
  } else {
    logger.debug('OPENAI_API_KEY not configured, using basic profanity check');
  }

  // Fallback: basic check for common profanity
  // This is a minimal fallback since leo-profanity isn't available in serverless context
  const commonProfanity = ['fuck', 'shit', 'bitch', 'ass', 'damn', 'hell', 'crap', 'bastard', 'dick', 'cock', 'pussy'];
  const lowerText = text.toLowerCase();
  const containsProfanity = commonProfanity.some(word => lowerText.includes(word));

  logger.debug('Basic profanity check result:', containsProfanity);
  return { containsProfanity, method: 'basic-check' };
}

/**
 * Handle grid submission (weapon-centric)
 * Grid submissions are stored per weapon, not per user
 */
async function handleGridSubmission(adapter, storage, config, data, username, replace) {
  try {
    // Check weapon name override for profanity (if provided)
    if (data.weaponNameOverride) {
      const profanityCheck = await checkProfanity(adapter, data.weaponNameOverride);
      if (profanityCheck.containsProfanity) {
        logger.warn('Grid submission rejected: weapon name contains inappropriate content', {
          weaponNameOverride: data.weaponNameOverride,
          method: profanityCheck.method,
          categories: profanityCheck.categories
        });
        return adapter.createJsonResponse(400, {
          error: 'Weapon name override contains inappropriate content and cannot be submitted.',
        });
      }
    }

    const weaponId = data.weaponId;

    // For replace mode, we need to load existing submissions and update the first one
    if (replace) {
      const existingSubmissions = await storage.loadGridSubmissions(weaponId);

      if (existingSubmissions.length > 0) {
        // Find the user's existing submission or use the first one
        const targetSubmission = existingSubmissions.find(s => s.username === username) || existingSubmissions[0];

        // Update with new data, preserving ID and createdAt
        const updatedSubmission = {
          ...data,
          id: targetSubmission.id,
          createdAt: targetSubmission.createdAt,
          submittedBy: username || 'Anonymous',
          submittedAt: new Date().toISOString(),
        };

        await storage.saveGridSubmission(
          username || 'Anonymous',
          targetSubmission.userId || 0,
          weaponId,
          updatedSubmission
        );

        return adapter.createJsonResponse(200, {
          success: true,
          submission: updatedSubmission,
        });
      }
    }

    // New submission or no existing submissions
    const newSubmission = {
      ...data,
      id: data.id || `grid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      submittedBy: username || 'Anonymous',
      submittedAt: new Date().toISOString(),
    };

    await storage.saveGridSubmission(
      username || 'Anonymous',
      0, // Anonymous userId
      weaponId,
      newSubmission
    );

    return adapter.createJsonResponse(200, {
      success: true,
      submission: newSubmission,
    });

  } catch (error) {
    console.error('[save-data] Grid submission error:', error);
    return adapter.createJsonResponse(500, {
      error: error.message || 'Failed to save grid submission'
    });
  }
}

/**
 * Handle user-centric data save
 */
async function handleUserCentricSave(adapter, storage, config, type, username, userId, data, spiritId) {
  try {
    // Load existing items
    const items = await storage.load(type, userId);

    // Find existing item
    let itemIndex = -1;
    if (type === 'my-spirits' && spiritId) {
      // For my-spirits updates, find by spiritId
      itemIndex = items.findIndex(item => item.id === spiritId);
    } else if (type !== 'my-spirits') {
      // For other types, match by ID only (not by name)
      // This enables "Save As" behavior: when user changes name in UI, frontend
      // removes the ID, causing backend to create a new entry instead of renaming
      if (data.id) {
        // ID provided → Update existing item
        itemIndex = items.findIndex(item => item.id === data.id);
      }
      // No ID provided → Create new item (itemIndex stays -1)
    }

    let itemToSave;

    if (itemIndex !== -1) {
      // Update existing item
      itemToSave = {
        ...data,
        id: items[itemIndex].id, // Preserve original ID
        createdAt: items[itemIndex].createdAt, // Preserve creation date
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Add new item
      if (config.maxItems && items.length >= config.maxItems) {
        return adapter.createJsonResponse(400, {
          error: `Maximum ${config.maxItems} ${config.itemsName} allowed. Please delete an old item first.`
        });
      }

      // Generate ID for new item
      itemToSave = {
        ...data,
        id: data.id || `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Save the item
    const updatedItems = await storage.save(type, username, userId, itemToSave);

    logger.debug(`Saved ${config.itemsName} for ${username}`);

    // Return response with dynamic key names
    const response = {
      success: true,
    };
    response[config.itemsName.replace(/s$/, '')] = itemToSave; // Singular form
    response[config.itemsName] = updatedItems; // Plural form

    return adapter.createJsonResponse(200, response);

  } catch (error) {
    console.error('[save-data] User-centric save error:', error);
    return adapter.createJsonResponse(500, {
      error: error.message || 'Failed to save data'
    });
  }
}
