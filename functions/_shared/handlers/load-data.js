import { createLogger } from '../../../src/utils/logger.js';
const logger = createLogger('LoadData');

/**
 * Load Data Handler (Platform-Agnostic)
 * Handles loading skill builds, battle loadouts, engraving builds, and spirit collection
 *
 * GET /api/load-data?type=TYPE&userId=USER_ID
 * Query Params:
 *   type: 'skill-builds' | 'battle-loadouts' | 'my-spirits' | 'spirit-builds' | 'engraving-builds'
 *   userId: number
 */

import { createWikiStorage } from '../createWikiStorage.js';
import { DATA_TYPE_CONFIGS } from '../utils.js';

/**
 * Handle load data request
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {ConfigAdapter} configAdapter - Config adapter instance
 * @returns {Promise<Object>} Platform-specific response
 */
export async function handleLoadData(adapter, configAdapter) {
  // Only allow GET
  if (adapter.getMethod() !== 'GET') {
    return adapter.createJsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    // Parse query parameters
    const params = adapter.getQueryParams();
    const { type, userId, public: isPublic } = params;

    // Validate required fields
    if (!type) {
      return adapter.createJsonResponse(400, {
        error: 'Missing required parameter: type'
      });
    }

    // Require userId unless loading public data
    if (!userId && isPublic !== 'true') {
      return adapter.createJsonResponse(400, {
        error: 'Missing required parameter: userId (or use public=true)'
      });
    }

    // Validate type
    const validTypes = ['skill-builds', 'battle-loadouts', 'my-spirits', 'spirit-builds', 'engraving-builds', 'skill-stone-builds'];
    if (!validTypes.includes(type)) {
      return adapter.createJsonResponse(400, {
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Get configuration
    const config = DATA_TYPE_CONFIGS[type];

    // Get bot token from environment
    const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
    if (!botToken) {
      console.error('[load-data] WIKI_BOT_TOKEN not configured');
      return adapter.createJsonResponse(500, { error: 'Server configuration error' });
    }

    // Get repo info from environment
    const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
    const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

    if (!owner || !repo) {
      console.error('[load-data] Repository config missing');
      return adapter.createJsonResponse(500, { error: 'Server configuration error' });
    }

    // Create storage adapter using config
    const storageConfig = configAdapter.getStorageConfig(adapter);
    const storage = createWikiStorage(storageConfig, { WIKI_BOT_TOKEN: botToken });

    // Load items
    let items;
    if (isPublic === 'true') {
      // Load public data from all users
      items = await storage.loadPublic(type);
      logger.debug(`Loaded ${items.length} public ${config.itemsName}`);
    } else {
      // Load data for specific user
      items = await storage.load(type, userId);
      logger.debug(`Loaded ${items.length} ${config.itemsName} for user ${userId}`);
    }

    // Return response with dynamic key names
    const response = {
      success: true,
    };
    response[config.itemsName] = items;

    return adapter.createJsonResponse(200, response);

  } catch (error) {
    console.error('[load-data] Error:', error);
    return adapter.createJsonResponse(500, {
      error: error.message || 'Internal server error'
    });
  }
}
