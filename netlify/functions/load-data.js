/**
 * Netlify Function: Load Data (Universal)
 * Handles loading skill builds, battle loadouts, and spirit collection
 *
 * GET /.netlify/functions/load-data?type=TYPE&userId=USER_ID
 * Query Params:
 *   type: 'skill-builds' | 'battle-loadouts' | 'my-spirits' | 'spirit-builds'
 *   userId: number
 */

import StorageFactory from '../../wiki-framework/src/services/storage/StorageFactory.js';
import {
  DATA_TYPE_CONFIGS,
  createErrorResponse,
  createSuccessResponse,
} from './shared/utils.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Lazy-load config to avoid Vite HMR issues
// Use process.cwd() to get project root (works in both dev and production)
function getWikiConfig() {
  return JSON.parse(readFileSync(join(process.cwd(), 'wiki-config.json'), 'utf-8'));
}

export async function handler(event) {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    // Parse query parameters
    const params = event.queryStringParameters || {};
    const { type, userId } = params;

    // Validate required fields
    if (!type || !userId) {
      return createErrorResponse(400, 'Missing required parameters: type, userId');
    }

    // Validate type
    const validTypes = ['skill-builds', 'battle-loadouts', 'my-spirits', 'spirit-builds'];
    if (!validTypes.includes(type)) {
      return createErrorResponse(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Get configuration
    const config = DATA_TYPE_CONFIGS[type];

    // Get bot token from environment
    const botToken = process.env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[load-data] WIKI_BOT_TOKEN not configured');
      return createErrorResponse(500, 'Server configuration error');
    }

    // Get repo info from environment
    const owner = process.env.WIKI_REPO_OWNER || process.env.VITE_WIKI_REPO_OWNER;
    const repo = process.env.WIKI_REPO_NAME || process.env.VITE_WIKI_REPO_NAME;

    if (!owner || !repo) {
      console.error('[load-data] Repository config missing');
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

    // Load items
    const items = await storage.load(type, userId);

    console.log(`[load-data] Loaded ${items.length} ${config.itemsName} for user ${userId}`);

    // Return response with dynamic key names
    const response = {
      success: true,
    };
    response[config.itemsName] = items;

    return createSuccessResponse(response);

  } catch (error) {
    console.error('[load-data] Error:', error);
    return createErrorResponse(500, error.message || 'Internal server error');
  }
}

