/**
 * Cloudflare Pages Function: Delete Data (Universal)
 * Handles deleting skill builds, battle loadouts, and spirit collection
 *
 * POST /api/delete-data
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
} from '../../netlify/functions/shared/utils.js';
import {
  validateUsername,
  validateUserId,
  validateItemId,
} from '../../netlify/functions/shared/validation.js';

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

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Parse request body
    const { type, username, userId, itemId, spiritId } = await request.json();

    // Validate required fields
    const deleteId = type === 'my-spirits' ? spiritId : itemId;
    if (!type || !username || !userId || !deleteId) {
      return new Response(
        JSON.stringify({
          error: `Missing required fields: type, username, userId, ${type === 'my-spirits' ? 'spiritId' : 'itemId'}`
        }),
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

    // Validate username
    const usernameResult = validateUsername(username);
    if (!usernameResult.valid) {
      return new Response(
        JSON.stringify({ error: usernameResult.error }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate userId
    const userIdResult = validateUserId(userId);
    if (!userIdResult.valid) {
      return new Response(
        JSON.stringify({ error: userIdResult.error }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate deleteId (itemId or spiritId)
    const idFieldName = type === 'my-spirits' ? 'Spirit ID' : 'Item ID';
    const deleteIdResult = validateItemId(deleteId, idFieldName);
    if (!deleteIdResult.valid) {
      return new Response(
        JSON.stringify({ error: deleteIdResult.error }),
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
      console.error('[delete-data] WIKI_BOT_TOKEN not configured');
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
      console.error('[delete-data] Repository config missing');
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

    // Delete the item
    const remainingItems = await storage.delete(type, username, userId, deleteId);

    console.log(`[delete-data] Deleted item ${deleteId} for ${username}, ${remainingItems.length} items remaining`);

    // Return response with dynamic key name
    const response = {
      success: true,
    };
    response[config.itemsName] = remainingItems;

    const result = createSuccessResponse(response);
    return new Response(
      result.body,  // Already a JSON string from createSuccessResponse
      {
        status: result.statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[delete-data] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
