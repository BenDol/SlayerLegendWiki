/**
 * Netlify Function: Delete Data (Universal)
 * Handles deleting skill builds, battle loadouts, and spirit collection
 *
 * POST /.netlify/functions/delete-data
 * Body: {
 *   type: 'skill-builds' | 'battle-loadouts' | 'my-spirits' | 'spirit-builds',
 *   username: string,
 *   userId: number,
 *   itemId: string (for skill-builds/battle-loadouts/spirit-builds),
 *   spiritId: string (for my-spirits)
 * }
 */

import StorageFactory from 'github-wiki-framework/src/services/storage/StorageFactory.js';
import {
  DATA_TYPE_CONFIGS,
  createErrorResponse,
  createSuccessResponse,
} from './shared/utils.js';
import {
  validateUsername,
  validateUserId,
  validateItemId,
} from './shared/validation.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Lazy-load config to avoid Vite HMR issues
// Use process.cwd() to get project root (works in both dev and production)
function getWikiConfig() {
  return JSON.parse(readFileSync(join(process.cwd(), 'wiki-config.json'), 'utf-8'));
}

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    // Parse request body
    const { type, username, userId, itemId, spiritId } = JSON.parse(event.body);

    // Validate required fields
    const deleteId = type === 'my-spirits' ? spiritId : itemId;
    if (!type || !username || !userId || !deleteId) {
      return createErrorResponse(
        400,
        `Missing required fields: type, username, userId, ${type === 'my-spirits' ? 'spiritId' : 'itemId'}`
      );
    }

    // Validate type
    const validTypes = ['skill-builds', 'battle-loadouts', 'my-spirits', 'spirit-builds'];
    if (!validTypes.includes(type)) {
      return createErrorResponse(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate username
    const usernameResult = validateUsername(username);
    if (!usernameResult.valid) {
      return createErrorResponse(400, usernameResult.error);
    }

    // Validate userId
    const userIdResult = validateUserId(userId);
    if (!userIdResult.valid) {
      return createErrorResponse(400, userIdResult.error);
    }

    // Validate deleteId (itemId or spiritId)
    const idFieldName = type === 'my-spirits' ? 'Spirit ID' : 'Item ID';
    const deleteIdResult = validateItemId(deleteId, idFieldName);
    if (!deleteIdResult.valid) {
      return createErrorResponse(400, deleteIdResult.error);
    }

    // Get configuration
    const config = DATA_TYPE_CONFIGS[type];

    // Get bot token from environment
    const botToken = process.env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[delete-data] WIKI_BOT_TOKEN not configured');
      return createErrorResponse(500, 'Server configuration error');
    }

    // Get repo info from environment
    const owner = process.env.WIKI_REPO_OWNER || process.env.VITE_WIKI_REPO_OWNER;
    const repo = process.env.WIKI_REPO_NAME || process.env.VITE_WIKI_REPO_NAME;

    if (!owner || !repo) {
      console.error('[delete-data] Repository config missing');
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

    // Delete the item
    const remainingItems = await storage.delete(type, username, userId, deleteId);

    console.log(`[delete-data] Deleted item ${deleteId} for ${username}, ${remainingItems.length} items remaining`);

    // Return response with dynamic key name
    const response = {
      success: true,
    };
    response[config.itemsName] = remainingItems;

    return createSuccessResponse(response);

  } catch (error) {
    console.error('[delete-data] Error:', error);
    return createErrorResponse(500, error.message || 'Internal server error');
  }
}


