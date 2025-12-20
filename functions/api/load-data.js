/**
 * Cloudflare Pages Function: Load Data (Universal)
 * Handles loading skill builds, battle loadouts, and spirit collection
 *
 * GET /api/load-data?type=TYPE&userId=USER_ID
 * Query Params:
 *   type: 'skill-builds' | 'battle-loadouts' | 'my-spirits' | 'spirit-builds'
 *   userId: number
 */

import StorageFactory from 'github-wiki-framework/src/services/storage/StorageFactory.js';
import {
  DATA_TYPE_CONFIGS,
  createErrorResponse,
  createSuccessResponse,
} from '../../netlify/functions/shared/utils.js';

/**
 * Get storage configuration from environment
 * Uses a default GitHub backend configuration
 */
function getStorageConfig(env, owner, repo) {
  // Check if KV namespace is bound (indicates KV backend should be used)
  if (env.SLAYER_WIKI_DATA) {
    return {
      backend: 'cloudflare-kv',
      version: 'v1',
      cloudflareKV: { namespace: env.SLAYER_WIKI_DATA }
    };
  }

  // Default to GitHub backend
  return {
    backend: 'github',
    version: 'v1',
    github: { owner, repo }
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  // Only allow GET
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const userId = url.searchParams.get('userId');

    // Validate required fields
    if (!type || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: type, userId' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate type
    const validTypes = ['skill-builds', 'battle-loadouts', 'my-spirits', 'spirit-builds'];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get configuration
    const config = DATA_TYPE_CONFIGS[type];

    // Get bot token from environment
    const botToken = env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[load-data] WIKI_BOT_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get repo info from environment
    const owner = env.WIKI_REPO_OWNER || env.VITE_WIKI_REPO_OWNER;
    const repo = env.WIKI_REPO_NAME || env.VITE_WIKI_REPO_NAME;

    if (!owner || !repo) {
      console.error('[load-data] Repository config missing');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create storage adapter
    const storageConfig = getStorageConfig(env, owner, repo);

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

    return new Response(
      JSON.stringify(createSuccessResponse(response).body),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[load-data] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
