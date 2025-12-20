/**
 * Shared Data Operations
 * Handles load, save, and delete operations for all data types
 * Used by both Netlify and Cloudflare implementations
 *
 * @deprecated This file is no longer used. All functions now use the storage abstraction layer.
 * See: wiki-framework/src/services/storage/
 * - StorageFactory creates storage adapters based on configuration
 * - GitHubStorage wraps this functionality with improved architecture
 * - CloudflareKVStorage provides alternative KV-based storage
 *
 * This file is kept for reference only and may be removed in future versions.
 */

import { Octokit } from '@octokit/rest';
import {
  DATA_TYPE_CONFIGS,
  parseItemsFromIssue,
  createErrorResponse,
  createSuccessResponse
} from './utils.js';

/**
 * Initialize Octokit instance
 * @param {string} botToken - GitHub bot token
 * @returns {Octokit}
 */
function initOctokit(botToken) {
  return new Octokit({ auth: botToken });
}

/**
 * Find user's issue by user ID label
 * @param {Array} issues - List of issues
 * @param {string|number} userId - User ID
 * @returns {Object|null} - Found issue or null
 */
function findUserIssue(issues, userId) {
  return issues.find(issue =>
    issue.labels.some(label =>
      (typeof label === 'string' && label === `user-id:${userId}`) ||
      (typeof label === 'object' && label.name === `user-id:${userId}`)
    )
  ) || null;
}

/**
 * Load data for a user
 * @param {Object} config - Configuration object
 * @param {string} config.botToken - Bot token
 * @param {string} config.owner - Repository owner
 * @param {string} config.repo - Repository name
 * @param {string} config.type - Data type
 * @param {string|number} config.userId - User ID
 * @returns {Promise<Object>}
 */
export async function loadData({ botToken, owner, repo, type, userId }) {
  const octokit = initOctokit(botToken);
  const config = DATA_TYPE_CONFIGS[type];

  if (!config) {
    return createErrorResponse(400, `Unknown data type: ${type}`);
  }

  try {
    // Get existing items
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: config.label,
      state: 'open',
      per_page: 100,
    });

    // Find user's issue
    const existingIssue = findUserIssue(issues, userId);

    // Parse existing items
    let items = [];
    if (existingIssue) {
      items = parseItemsFromIssue(existingIssue.body);
    }

    // Return response with dynamic key name
    const response = {};
    response[config.itemsName] = items;

    return createSuccessResponse(response);
  } catch (error) {
    console.error('[loadData] Error:', error);
    return createErrorResponse(500, error.message || 'Internal server error');
  }
}

/**
 * Save data for a user
 * @param {Object} config - Configuration object
 * @param {string} config.botToken - Bot token
 * @param {string} config.owner - Repository owner
 * @param {string} config.repo - Repository name
 * @param {string} config.type - Data type
 * @param {string} config.username - Username
 * @param {string|number} config.userId - User ID
 * @param {Object} config.item - Item to save
 * @param {string} config.weaponId - Weapon ID (for grid submissions)
 * @returns {Promise<Object>}
 */
export async function saveData({ botToken, owner, repo, type, username, userId, item, weaponId }) {
  const octokit = initOctokit(botToken);
  const config = DATA_TYPE_CONFIGS[type];

  if (!config) {
    return createErrorResponse(400, `Unknown data type: ${type}`);
  }

  try {
    // Handle grid submissions differently (stored as comments)
    if (type === 'grid-submission') {
      return await saveGridSubmission({ octokit, owner, repo, config, username, userId, item, weaponId });
    }

    // Standard user-centric storage
    return await saveUserCentricData({ octokit, owner, repo, config, username, userId, item });
  } catch (error) {
    console.error('[saveData] Error:', error);
    return createErrorResponse(500, error.message || 'Internal server error');
  }
}

/**
 * Save user-centric data (skill-builds, battle-loadouts, my-spirits, spirit-builds)
 * @private
 */
async function saveUserCentricData({ octokit, owner, repo, config, username, userId, item }) {
  // Get existing items
  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: config.label,
    state: 'open',
    per_page: 100,
  });

  // Find user's issue
  const existingIssue = findUserIssue(issues, userId);

  // Parse existing items
  let items = [];
  if (existingIssue) {
    items = parseItemsFromIssue(existingIssue.body);
  }

  // Find existing item by ID
  const existingIndex = items.findIndex(i => i.id === item.id);

  if (existingIndex >= 0) {
    // Update existing item
    items[existingIndex] = {
      ...item,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Add new item
    if (config.maxItems && items.length >= config.maxItems) {
      return createErrorResponse(400, `Maximum ${config.maxItems} ${config.itemsName} reached`);
    }

    items.push({
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const issueBody = JSON.stringify(items, null, 2);

  if (existingIssue) {
    // Update existing issue
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: existingIssue.number,
      body: issueBody,
    });

    console.log(`[saveData] Updated ${config.itemsName} for ${username}`);
  } else {
    // Create new issue
    await octokit.rest.issues.create({
      owner,
      repo,
      title: `${config.titlePrefix} ${username}`,
      body: issueBody,
      labels: [config.label, `user-id:${userId}`],
    });

    console.log(`[saveData] Created new ${config.itemsName} issue for ${username}`);
  }

  // Return response with dynamic key name
  const response = {};
  response[config.itemsName] = items;

  return createSuccessResponse(response);
}

/**
 * Save grid submission (weapon-centric storage as comments)
 * @private
 */
async function saveGridSubmission({ octokit, owner, repo, config, username, userId, item, weaponId }) {
  // Find weapon's issue
  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: config.label,
    state: 'open',
    per_page: 100,
  });

  const weaponIssue = issues.find(issue =>
    issue.labels.some(label =>
      (typeof label === 'string' && label === `weapon-id:${weaponId}`) ||
      (typeof label === 'object' && label.name === `weapon-id:${weaponId}`)
    )
  );

  if (!weaponIssue) {
    // Create weapon issue if it doesn't exist
    const { data: newIssue } = await octokit.rest.issues.create({
      owner,
      repo,
      title: `${config.titlePrefix} ${weaponId}`,
      body: `Grid submissions for weapon: ${weaponId}`,
      labels: [config.label, `weapon-id:${weaponId}`],
    });

    console.log(`[saveData] Created weapon issue for ${weaponId}`);

    // Create comment with submission
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: newIssue.number,
      body: JSON.stringify({
        ...item,
        username,
        userId,
        createdAt: new Date().toISOString(),
      }, null, 2),
    });

    return createSuccessResponse({ submission: item }, 201);
  }

  // Get existing comments
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: weaponIssue.number,
    per_page: 100,
  });

  // Find user's existing comment
  const userComment = comments.find(comment => {
    try {
      const data = JSON.parse(comment.body);
      return data.userId === userId && data.id === item.id;
    } catch (e) {
      return false;
    }
  });

  if (userComment) {
    // Update existing comment
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: userComment.id,
      body: JSON.stringify({
        ...item,
        username,
        userId,
        updatedAt: new Date().toISOString(),
      }, null, 2),
    });

    console.log(`[saveData] Updated grid submission for ${username} on weapon ${weaponId}`);
  } else {
    // Create new comment
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: weaponIssue.number,
      body: JSON.stringify({
        ...item,
        username,
        userId,
        createdAt: new Date().toISOString(),
      }, null, 2),
    });

    console.log(`[saveData] Created grid submission for ${username} on weapon ${weaponId}`);
  }

  return createSuccessResponse({ submission: item }, 201);
}

/**
 * Delete data for a user
 * @param {Object} config - Configuration object
 * @param {string} config.botToken - Bot token
 * @param {string} config.owner - Repository owner
 * @param {string} config.repo - Repository name
 * @param {string} config.type - Data type
 * @param {string} config.username - Username
 * @param {string|number} config.userId - User ID
 * @param {string} config.deleteId - Item ID or spirit ID to delete
 * @returns {Promise<Object>}
 */
export async function deleteData({ botToken, owner, repo, type, username, userId, deleteId }) {
  const octokit = initOctokit(botToken);
  const config = DATA_TYPE_CONFIGS[type];

  if (!config) {
    return createErrorResponse(400, `Unknown data type: ${type}`);
  }

  try {
    // Get existing items
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: config.label,
      state: 'open',
      per_page: 100,
    });

    // Find user's issue
    const existingIssue = findUserIssue(issues, userId);

    if (!existingIssue) {
      return createErrorResponse(404, 'No items found for this user');
    }

    // Parse existing items
    let items = parseItemsFromIssue(existingIssue.body);

    // Find and remove the item
    const itemIndex = items.findIndex(item => item.id === deleteId);

    if (itemIndex === -1) {
      return createErrorResponse(404, 'Item not found');
    }

    // Remove the item
    items.splice(itemIndex, 1);

    // Update or close the issue
    if (items.length === 0) {
      // Close the issue if no items left
      await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: existingIssue.number,
        state: 'closed',
      });

      console.log(`[deleteData] Closed empty ${config.itemsName} issue for ${username}`);
    } else {
      // Update the issue with remaining items
      const issueBody = JSON.stringify(items, null, 2);

      await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: existingIssue.number,
        body: issueBody,
      });

      console.log(`[deleteData] Updated ${config.itemsName} for ${username}`);
    }

    // Return response with dynamic key name
    const response = {};
    response[config.itemsName] = items;

    return createSuccessResponse(response);
  } catch (error) {
    console.error('[deleteData] Error:', error);
    return createErrorResponse(500, error.message || 'Internal server error');
  }
}

