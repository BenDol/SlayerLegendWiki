/**
 * Netlify Function: Save Data (Universal)
 * Handles saving skill builds, battle loadouts, spirit collection, and grid submissions
 *
 * POST /.netlify/functions/save-data
 * Body: {
 *   type: 'skill-builds' | 'battle-loadouts' | 'my-spirits' | 'spirit-builds' | 'grid-submission',
 *   username: string,
 *   userId: number,
 *   data: object,
 *   spiritId?: string (For my-spiritss updates),
 *   replace?: boolean (for grid-submission replace mode)
 * }
 */

import StorageFactory from '../../wiki-framework/src/services/storage/StorageFactory.js';
import {
  DATA_TYPE_CONFIGS,
  VALID_DATA_TYPES,
  createErrorResponse,
  createSuccessResponse,
} from './shared/utils.js';
import {
  validateUsername,
  validateUserId,
  validateBuildData,
  validateGridSubmission,
  validateRequestBodySize,
} from './shared/validation.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Lazy-load config to avoid Vite HMR issues
// Use process.cwd() to get project root (works in both dev and production)
function getWikiConfig() {
  return JSON.parse(readFileSync(join(process.cwd(), 'wiki-config.json'), 'utf-8'));
}

/**
 * Main handler
 */
export async function handler(event) {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    // Validate request body size first
    const bodySizeResult = validateRequestBodySize(event.body);
    if (!bodySizeResult.valid) {
      return createErrorResponse(413, bodySizeResult.error);
    }

    // Parse request body
    const { type, username, userId, data, spiritId, replace = false } = JSON.parse(event.body);

    // Validate required fields
    if (!type || !data) {
      return createErrorResponse(400, 'Missing required fields: type, data');
    }

    // For user-centric types (not grid-submission), require username and userId
    if (type !== 'grid-submission' && (!username || !userId)) {
      return createErrorResponse(400, 'Missing required fields: username, userId');
    }

    // Validate type
    if (!VALID_DATA_TYPES.includes(type)) {
      return createErrorResponse(400, `Invalid type. Must be one of: ${VALID_DATA_TYPES.join(', ')}`);
    }

    // Validate username and userId (for user-centric types)
    if (type !== 'grid-submission') {
      const usernameResult = validateUsername(username);
      if (!usernameResult.valid) {
        return createErrorResponse(400, usernameResult.error);
      }

      const userIdResult = validateUserId(userId);
      if (!userIdResult.valid) {
        return createErrorResponse(400, userIdResult.error);
      }
    }

    // Get configuration
    const config = DATA_TYPE_CONFIGS[type];

    // Validate data structure
    if (type === 'grid-submission') {
      // Validate grid submission data
      const gridResult = validateGridSubmission(data);
      if (!gridResult.valid) {
        return createErrorResponse(400, gridResult.error);
      }
    } else {
      // Validate build data (skill-builds, spirit-builds, battle-loadouts, my-spirits)
      const buildResult = validateBuildData(data, type);
      if (!buildResult.valid) {
        return createErrorResponse(400, buildResult.error);
      }

      // Additional checks for specific types
      if (type === 'my-spirits' && !data.spiritId) {
        return createErrorResponse(400, 'Spirit data must include a spiritId');
      }

      if (type === 'skill-builds' && (!data.maxSlots || !data.slots)) {
        return createErrorResponse(400, 'Build must have maxSlots and slots');
      }
    }

    // Get bot token from environment
    const botToken = process.env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[save-data] WIKI_BOT_TOKEN not configured');
      return createErrorResponse(500, 'Server configuration error');
    }

    // Get repo info from environment
    const owner = process.env.WIKI_REPO_OWNER || process.env.VITE_WIKI_REPO_OWNER;
    const repo = process.env.WIKI_REPO_NAME || process.env.VITE_WIKI_REPO_NAME;

    if (!owner || !repo) {
      console.error('[save-data] Repository config missing');
      return createErrorResponse(500, 'Server configuration error');
    }

    // Create storage adapter
    const wikiConfig = getWikiConfig();
    const storageConfig = wikiConfig.storage || {
      backend: 'github',
      version: 'v1',
      github: { owner, repo },
    };

    const storage = StorageFactory.create(
      storageConfig,
      { WIKI_BOT_TOKEN: botToken }
    );

    // Handle grid submissions (weapon-centric)
    if (type === 'grid-submission') {
      return await handleGridSubmission(storage, config, data, username, replace);
    }

    // Handle user-centric data
    return await handleUserCentricSave(storage, config, type, username, userId, data, spiritId);

  } catch (error) {
    console.error('[save-data] Error:', error);
    return createErrorResponse(500, error.message || 'Internal server error');
  }
}

/**
 * Handle grid submission (weapon-centric)
 * Grid submissions are stored per weapon, not per user
 */
async function handleGridSubmission(storage, config, data, username, replace) {
  try {
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

        return createSuccessResponse({
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

    return createSuccessResponse({
      success: true,
      submission: newSubmission,
    });

  } catch (error) {
    console.error('[save-data] Grid submission error:', error);
    return createErrorResponse(500, error.message || 'Failed to save grid submission');
  }
}

/**
 * Handle user-centric data save
 */
async function handleUserCentricSave(storage, config, type, username, userId, data, spiritId) {
  try {
    // Load existing items
    const items = await storage.load(type, userId);

    // Find existing item
    let itemIndex = -1;
    if (type === 'my-spirits' && spiritId) {
      // For my-spiritss updates, find by spiritId
      itemIndex = items.findIndex(item => item.id === spiritId);
    } else if (type !== 'my-spirits' && data.name) {
      // For other types, find by name
      itemIndex = items.findIndex(item => item.name === data.name);
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
        return createErrorResponse(
          400,
          `Maximum ${config.maxItems} ${config.itemsName} allowed. Please delete an old item first.`
        );
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

    console.log(`[save-data] Saved ${config.itemsName} for ${username}`);

    // Return response with dynamic key names
    const response = {
      success: true,
    };
    response[config.itemsName.replace(/s$/, '')] = itemToSave; // Singular form
    response[config.itemsName] = updatedItems; // Plural form

    return createSuccessResponse(response);

  } catch (error) {
    console.error('[save-data] User-centric save error:', error);
    return createErrorResponse(500, error.message || 'Failed to save data');
  }
}


