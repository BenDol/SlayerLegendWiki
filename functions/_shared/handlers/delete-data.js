const { createLogger } = require('../../../src/utils/logger');
const logger = createLogger('DeleteData');

/**
 * Delete Data Handler (Platform-Agnostic)
 * Handles deleting skill builds, battle loadouts, engraving builds, and spirit collection
 *
 * POST /api/delete-data
 * Body: {
 *   type: 'skill-builds' | 'battle-loadouts' | 'my-spirits' | 'spirit-builds' | 'engraving-builds',
 *   username: string,
 *   userId: number,
 *   itemId: string (for skill-builds/battle-loadouts/spirit-builds/engraving-builds),
 *   spiritId: string (for my-spirits)
 * }
 */

import { createWikiStorage } from '../createWikiStorage.js';
import { DATA_TYPE_CONFIGS } from '../utils.js';
import {
  validateUsername,
  validateUserId,
  validateItemId,
} from '../validation.js';

/**
 * Handle delete data request
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {ConfigAdapter} configAdapter - Config adapter instance
 * @returns {Promise<Object>} Platform-specific response
 */
export async function handleDeleteData(adapter, configAdapter) {
  // Only allow POST
  if (adapter.getMethod() !== 'POST') {
    return adapter.createJsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    // Parse request body
    const { type, username, userId, itemId, spiritId } = await adapter.getJsonBody();

    // Validate required fields
    const deleteId = type === 'my-spirits' ? spiritId : itemId;
    if (!type || !username || !userId || !deleteId) {
      return adapter.createJsonResponse(400, {
        error: `Missing required fields: type, username, userId, ${type === 'my-spirits' ? 'spiritId' : 'itemId'}`
      });
    }

    // Validate type
    const validTypes = ['skill-builds', 'battle-loadouts', 'my-spirits', 'spirit-builds', 'engraving-builds'];
    if (!validTypes.includes(type)) {
      return adapter.createJsonResponse(400, {
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate username
    const usernameResult = validateUsername(username);
    if (!usernameResult.valid) {
      return adapter.createJsonResponse(400, { error: usernameResult.error });
    }

    // Validate userId
    const userIdResult = validateUserId(userId);
    if (!userIdResult.valid) {
      return adapter.createJsonResponse(400, { error: userIdResult.error });
    }

    // Validate deleteId (itemId or spiritId)
    const idFieldName = type === 'my-spirits' ? 'Spirit ID' : 'Item ID';
    const deleteIdResult = validateItemId(deleteId, idFieldName);
    if (!deleteIdResult.valid) {
      return adapter.createJsonResponse(400, { error: deleteIdResult.error });
    }

    // Get configuration
    const config = DATA_TYPE_CONFIGS[type];

    // Get bot token from environment
    const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
    if (!botToken) {
      console.error('[delete-data] WIKI_BOT_TOKEN not configured');
      return adapter.createJsonResponse(500, { error: 'Server configuration error' });
    }

    // Get repo info from environment
    const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
    const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

    if (!owner || !repo) {
      console.error('[delete-data] Repository config missing');
      return adapter.createJsonResponse(500, { error: 'Server configuration error' });
    }

    // Create storage adapter using config
    const storageConfig = configAdapter.getStorageConfig(adapter);
    const storage = createWikiStorage(storageConfig, { WIKI_BOT_TOKEN: botToken });

    // Delete the item
    const remainingItems = await storage.delete(type, username, userId, deleteId);

    logger.debug(`Deleted item ${deleteId} for ${username}, ${remainingItems.length} items remaining`);

    // Return response with dynamic key name
    const response = {
      success: true,
    };
    response[config.itemsName] = remainingItems;

    return adapter.createJsonResponse(200, response);

  } catch (error) {
    console.error('[delete-data] Error:', error);
    return adapter.createJsonResponse(500, {
      error: error.message || 'Internal server error'
    });
  }
}
