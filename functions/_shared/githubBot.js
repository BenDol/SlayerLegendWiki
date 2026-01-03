/**
 * Shared GitHub Bot Operations
 * Used by both Netlify and Cloudflare implementations
 */

import { Octokit } from '@octokit/rest';
import { createErrorResponse, createSuccessResponse } from './utils.js';

/**
 * Initialize Octokit instance with bot token
 * @param {string} botToken - GitHub bot token
 * @returns {Octokit}
 */
function initOctokit(botToken) {
  return new Octokit({ auth: botToken });
}

/**
 * Check if user has admin/owner permissions
 * @param {Octokit} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - Username to check
 * @returns {Promise<{isOwner: boolean, isAdmin: boolean}>}
 */
async function checkUserPermissions(octokit, owner, repo, username) {
  try {
    // Check if user is repository owner
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const isOwner = repoData.owner.login.toLowerCase() === username.toLowerCase();

    if (isOwner) {
      return { isOwner: true, isAdmin: true };
    }

    // Check admin list
    const { data: adminIssues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: 'wiki-admin:admins',
      state: 'open',
      per_page: 1,
    });

    if (adminIssues.length > 0) {
      try {
        const adminList = JSON.parse(adminIssues[0].body || '[]');
        const isAdmin = adminList.some(admin =>
          admin.username.toLowerCase() === username.toLowerCase()
        );
        return { isOwner: false, isAdmin };
      } catch (e) {
        console.error('[checkUserPermissions] Failed to parse admin list:', e);
      }
    }

    return { isOwner: false, isAdmin: false };
  } catch (error) {
    console.error('[checkUserPermissions] Error:', error);
    return { isOwner: false, isAdmin: false };
  }
}

/**
 * Create a comment on an issue
 * @param {Object} config - Configuration object
 * @param {string} config.botToken - Bot token
 * @param {string} config.owner - Repository owner
 * @param {string} config.repo - Repository name
 * @param {Object} config.params - Comment parameters
 * @returns {Promise<Object>}
 */
export async function createComment({ botToken, owner, repo, params }) {
  const octokit = initOctokit(botToken);
  const { issue_number, body } = params;

  if (!issue_number || !body) {
    return createErrorResponse(400, 'Missing required parameters: issue_number, body');
  }

  try {
    const { data: comment } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body,
    });

    return createSuccessResponse({ comment }, 201);
  } catch (error) {
    console.error('[createComment] Error:', error);
    return createErrorResponse(500, error.message || 'Failed to create comment');
  }
}

/**
 * Update an issue
 * @param {Object} config - Configuration object
 * @param {string} config.botToken - Bot token
 * @param {string} config.owner - Repository owner
 * @param {string} config.repo - Repository name
 * @param {Object} config.params - Update parameters
 * @returns {Promise<Object>}
 */
export async function updateIssue({ botToken, owner, repo, params }) {
  const octokit = initOctokit(botToken);
  const { issue_number, title, body, state, labels } = params;

  if (!issue_number) {
    return createErrorResponse(400, 'Missing required parameter: issue_number');
  }

  try {
    const updateData = { owner, repo, issue_number };
    if (title !== undefined) updateData.title = title;
    if (body !== undefined) updateData.body = body;
    if (state !== undefined) updateData.state = state;
    if (labels !== undefined) updateData.labels = labels;

    const { data: issue } = await octokit.rest.issues.update(updateData);

    return createSuccessResponse({ issue });
  } catch (error) {
    console.error('[updateIssue] Error:', error);
    return createErrorResponse(500, error.message || 'Failed to update issue');
  }
}

/**
 * List issues by labels
 * @param {Object} config - Configuration object
 * @param {string} config.botToken - Bot token
 * @param {string} config.owner - Repository owner
 * @param {string} config.repo - Repository name
 * @param {Object} config.params - List parameters
 * @returns {Promise<Object>}
 */
export async function listIssues({ botToken, owner, repo, params }) {
  const octokit = initOctokit(botToken);
  const { labels, state = 'open', per_page = 100 } = params;

  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels,
      state,
      per_page,
    });

    return createSuccessResponse({ issues });
  } catch (error) {
    console.error('[listIssues] Error:', error);
    return createErrorResponse(500, error.message || 'Failed to list issues');
  }
}

/**
 * Get a specific comment
 * @param {Object} config - Configuration object
 * @param {string} config.botToken - Bot token
 * @param {string} config.owner - Repository owner
 * @param {string} config.repo - Repository name
 * @param {Object} config.params - Comment parameters
 * @returns {Promise<Object>}
 */
export async function getComment({ botToken, owner, repo, params }) {
  const octokit = initOctokit(botToken);
  const { comment_id } = params;

  if (!comment_id) {
    return createErrorResponse(400, 'Missing required parameter: comment_id');
  }

  try {
    const { data: comment } = await octokit.rest.issues.getComment({
      owner,
      repo,
      comment_id,
    });

    return createSuccessResponse({ comment });
  } catch (error) {
    console.error('[getComment] Error:', error);
    return createErrorResponse(500, error.message || 'Failed to get comment');
  }
}

/**
 * Create a comment issue (for page comments)
 * @param {Object} config - Configuration object
 * @param {string} config.botToken - Bot token
 * @param {string} config.owner - Repository owner
 * @param {string} config.repo - Repository name
 * @param {Object} config.params - Issue parameters
 * @returns {Promise<Object>}
 */
export async function createCommentIssue({ botToken, owner, repo, params }) {
  const octokit = initOctokit(botToken);
  const { title, body, labels = [] } = params;

  if (!title || !body) {
    return createErrorResponse(400, 'Missing required parameters: title, body');
  }

  try {
    const issueLabels = Array.isArray(labels) ? labels : [labels];

    const { data: issue } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels: issueLabels,
    });

    // Lock the issue to prevent users from closing it
    await octokit.rest.issues.lock({
      owner,
      repo,
      issue_number: issue.number,
      lock_reason: 'resolved', // Use 'resolved' to indicate the issue is maintained by bot
    });

    return createSuccessResponse({ issue }, 201);
  } catch (error) {
    console.error('[createCommentIssue] Error:', error);
    return createErrorResponse(500, error.message || 'Failed to create comment issue');
  }
}

/**
 * Create an admin issue (admins or banned users list)
 * @param {Object} config - Configuration object
 * @param {string} config.botToken - Bot token
 * @param {string} config.owner - Repository owner
 * @param {string} config.repo - Repository name
 * @param {Object} config.params - Issue parameters
 * @returns {Promise<Object>}
 */
export async function createAdminIssue({ botToken, owner, repo, params }) {
  const octokit = initOctokit(botToken);
  const { username, type } = params;

  if (!username || !type) {
    return createErrorResponse(400, 'Missing required parameters: username, type');
  }

  if (type !== 'admins' && type !== 'banned-users') {
    return createErrorResponse(400, 'Invalid type. Must be "admins" or "banned-users"');
  }

  // Check permissions
  const { isOwner, isAdmin } = await checkUserPermissions(octokit, owner, repo, username);

  // Only owner can create admin issues
  if (!isOwner) {
    return createErrorResponse(403, 'Only repository owner can manage admin configuration');
  }

  try {
    const label = `wiki-admin:${type}`;
    const title = type === 'admins' ? '[Wiki Admins]' : '[Banned Users]';

    const { data: issue } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body: '[]',
      labels: [label],
    });

    // Lock the issue
    await octokit.rest.issues.lock({
      owner,
      repo,
      issue_number: issue.number,
      lock_reason: 'resolved',
    });

    return createSuccessResponse({ issue }, 201);
  } catch (error) {
    console.error('[createAdminIssue] Error:', error);
    return createErrorResponse(500, error.message || 'Failed to create admin issue');
  }
}

/**
 * Update an admin issue (add/remove admins or banned users)
 * @param {Object} config - Configuration object
 * @param {string} config.botToken - Bot token
 * @param {string} config.owner - Repository owner
 * @param {string} config.repo - Repository name
 * @param {Object} config.params - Update parameters
 * @returns {Promise<Object>}
 */
export async function updateAdminIssue({ botToken, owner, repo, params }) {
  const octokit = initOctokit(botToken);
  const { username, type, action, targetUser } = params;

  if (!username || !type || !action || !targetUser) {
    return createErrorResponse(400, 'Missing required parameters: username, type, action, targetUser');
  }

  if (type !== 'admins' && type !== 'banned-users') {
    return createErrorResponse(400, 'Invalid type. Must be "admins" or "banned-users"');
  }

  if (action !== 'add' && action !== 'remove') {
    return createErrorResponse(400, 'Invalid action. Must be "add" or "remove"');
  }

  // Check permissions
  const { isOwner, isAdmin } = await checkUserPermissions(octokit, owner, repo, username);

  // Permission checks
  if (type === 'admins' && !isOwner) {
    return createErrorResponse(403, 'Only repository owner can manage administrators');
  }

  if (type === 'banned-users' && !isOwner && !isAdmin) {
    return createErrorResponse(403, 'Only administrators can manage banned users');
  }

  // Additional check: admins can't ban other admins
  if (type === 'banned-users' && action === 'add' && !isOwner) {
    const targetPerms = await checkUserPermissions(octokit, owner, repo, targetUser.username);
    if (targetPerms.isAdmin || targetPerms.isOwner) {
      return createErrorResponse(403, 'Administrators cannot ban other administrators or the owner');
    }
  }

  try {
    const label = `wiki-admin:${type}`;

    // Find the admin issue
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: label,
      state: 'open',
      per_page: 1,
    });

    if (issues.length === 0) {
      return createErrorResponse(404, `Admin issue for ${type} not found`);
    }

    const issue = issues[0];

    // Parse current list
    let list = [];
    try {
      list = JSON.parse(issue.body || '[]');
      if (!Array.isArray(list)) list = [];
    } catch (e) {
      list = [];
    }

    // Add or remove user
    if (action === 'add') {
      // Check if already exists
      const exists = list.some(u => u.username.toLowerCase() === targetUser.username.toLowerCase());
      if (exists) {
        return createErrorResponse(400, `User ${targetUser.username} already in ${type} list`);
      }

      list.push({
        username: targetUser.username,
        userId: targetUser.userId,
        addedBy: username,
        addedAt: new Date().toISOString(),
      });
    } else {
      // Remove user
      const index = list.findIndex(u => u.username.toLowerCase() === targetUser.username.toLowerCase());
      if (index === -1) {
        return createErrorResponse(404, `User ${targetUser.username} not found in ${type} list`);
      }

      list.splice(index, 1);
    }

    // Update issue
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      body: JSON.stringify(list, null, 2),
    });

    return createSuccessResponse({ list });
  } catch (error) {
    console.error('[updateAdminIssue] Error:', error);
    return createErrorResponse(500, error.message || 'Failed to update admin issue');
  }
}

/**
 * Route bot action to appropriate handler
 * @param {string} action - Action to perform
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>}
 */
export async function routeBotAction(action, config) {
  switch (action) {
    case 'create-comment':
      return createComment(config);
    case 'update-issue':
      return updateIssue(config);
    case 'list-issues':
      return listIssues(config);
    case 'get-comment':
      return getComment(config);
    case 'create-comment-issue':
      return createCommentIssue(config);
    case 'create-admin-issue':
      return createAdminIssue(config);
    case 'update-admin-issue':
      return updateAdminIssue(config);
    default:
      return createErrorResponse(400, `Unknown action: ${action}`);
  }
}
