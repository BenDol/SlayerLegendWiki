/**
 * Cloudflare Function: Save Data (Universal)
 * Handles saving skill builds, battle loadouts, spirit collection, and grid submissions
 *
 * POST /api/save-data
 * Body: {
 *   type: 'skill-builds' | 'battle-loadouts' | 'my-spirits' | 'spirit-builds' | 'grid-submission',
 *   username: string,
 *   userId: number,
 *   data: object,
 *   spiritId?: string (For my-spiritss updates),
 *   replace?: boolean (for grid-submission replace mode)
 * }
 */

import StorageFactory from '../../../wiki-framework/src/services/storage/StorageFactory.js';
import {
  DATA_TYPE_CONFIGS,
  VALID_DATA_TYPES,
  createErrorResponse,
  createSuccessResponse,
} from './_lib/utils.js';
import {
  validateUsername,
  validateUserId,
  validateBuildData,
  validateGridSubmission,
  validateRequestBodySize,
} from './_lib/validation.js';
import wikiConfig from '../../../wiki-config.json' with { type: 'json' };

/**
 * Main handler
 */
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
    // Get request body
    const body = await request.text();

    // Validate request body size first
    const bodySizeResult = validateRequestBodySize(body);
    if (!bodySizeResult.valid) {
      return new Response(
        JSON.stringify({ error: bodySizeResult.error }),
        {
          status: 413,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const { type, username, userId, data, spiritId, replace = false } = JSON.parse(body);

    // Validate required fields
    if (!type || !data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, data' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // For user-centric types (not grid-submission), require username and userId
    if (type !== 'grid-submission' && (!username || !userId)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: username, userId' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate type
    if (!VALID_DATA_TYPES.includes(type)) {
      return new Response(
        JSON.stringify({ error: `Invalid type. Must be one of: ${VALID_DATA_TYPES.join(', ')}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate username and userId (for user-centric types)
    if (type !== 'grid-submission') {
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
    }

    // Get configuration
    const config = DATA_TYPE_CONFIGS[type];

    // Validate data structure
    if (type === 'grid-submission') {
      // Validate grid submission data
      const gridResult = validateGridSubmission(data);
      if (!gridResult.valid) {
        return new Response(
          JSON.stringify({ error: gridResult.error }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    } else {
      // Validate build data (skill-builds, spirit-builds, battle-loadouts, my-spirits)
      const buildResult = validateBuildData(data, type);
      if (!buildResult.valid) {
        return new Response(
          JSON.stringify({ error: buildResult.error }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Additional checks for specific types
      if (type === 'my-spirits' && !data.spiritId) {
        return new Response(
          JSON.stringify({ error: 'Spirit data must include a spiritId' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (type === 'skill-builds' && (!data.maxSlots || !data.slots)) {
        return new Response(
          JSON.stringify({ error: 'Build must have maxSlots and slots' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Get bot token from environment
    const botToken = env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[save-data] WIKI_BOT_TOKEN not configured');
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
      console.error('[save-data] Repository config missing');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create storage adapter
    const storageConfig = wikiConfig.storage || {
      backend: 'github',
      version: 'v1',
      github: { owner, repo },
    };

    const storage = StorageFactory.create(
      storageConfig,
      {
        WIKI_BOT_TOKEN: botToken,
        SLAYER_WIKI_DATA: env.SLAYER_WIKI_DATA, // KV namespace binding
      }
    );

    // Handle grid submissions (weapon-centric)
    if (type === 'grid-submission') {
      return await handleGridSubmission(storage, config, data, username, replace);
    }

    // Handle user-centric data
    return await handleUserCentricSave(storage, config, type, username, userId, data, spiritId);

  } catch (error) {
    console.error('[save-data] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
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

        return new Response(
          JSON.stringify({
            success: true,
            submission: updatedSubmission,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
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

    return new Response(
      JSON.stringify({
        success: true,
        submission: newSubmission,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[save-data] Grid submission error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to save grid submission' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
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
        return new Response(
          JSON.stringify({ error: `Maximum ${config.maxItems} ${config.itemsName} allowed. Please delete an old item first.` }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
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

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[save-data] User-centric save error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to save data' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
