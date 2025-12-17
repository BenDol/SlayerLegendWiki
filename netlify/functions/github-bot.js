/**
 * Netlify Function: GitHub Bot (Consolidated)
 * Handles all bot-authenticated GitHub operations
 *
 * POST /.netlify/functions/github-bot
 * Body: {
 *   action: 'create-comment' | 'update-issue' | 'list-issues' | 'get-comment' | 'create-comment-issue' | 'create-admin-issue' | 'update-admin-issue',
 *   owner: string,
 *   repo: string,
 *   ... (action-specific parameters)
 * }
 */

import { Octokit } from '@octokit/rest';

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body);
    const { action, owner, repo } = body;

    // Validate required fields
    if (!action || !owner || !repo) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: action, owner, repo' }),
      };
    }

    // Get bot token from environment
    const botToken = process.env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[github-bot] WIKI_BOT_TOKEN not configured');
      return {
        statusCode: 503,
        body: JSON.stringify({ error: 'Bot token not configured' }),
      };
    }

    // Initialize Octokit with bot token
    const octokit = new Octokit({
      auth: botToken,
      userAgent: 'GitHub-Wiki-Bot/1.0'
    });

    // Route to action handler
    switch (action) {
      case 'create-comment':
        return await handleCreateComment(octokit, body);
      case 'update-issue':
        return await handleUpdateIssue(octokit, body);
      case 'list-issues':
        return await handleListIssues(octokit, body);
      case 'get-comment':
        return await handleGetComment(octokit, body);
      case 'create-comment-issue':
        return await handleCreateCommentIssue(octokit, body);
      case 'create-admin-issue':
        return await handleCreateAdminIssue(octokit, body);
      case 'update-admin-issue':
        return await handleUpdateAdminIssue(octokit, body);
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Unknown action: ${action}` }),
        };
    }
  } catch (error) {
    console.error('[github-bot] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}

/**
 * Create a comment on an issue
 * Required: issueNumber, body
 */
async function handleCreateComment(octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || !body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: issueNumber, body' }),
    };
  }

  const { data: comment } = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  console.log(`[github-bot] Created comment ${comment.id} on issue #${issueNumber}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      comment: {
        id: comment.id,
        body: comment.body,
        created_at: comment.created_at,
        html_url: comment.html_url,
      },
    }),
  };
}

/**
 * Update an issue body
 * Required: issueNumber, body
 */
async function handleUpdateIssue(octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || body === undefined) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: issueNumber, body' }),
    };
  }

  const { data: issue } = await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  console.log(`[github-bot] Updated issue #${issueNumber}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        updated_at: issue.updated_at,
        state: issue.state,
      },
    }),
  };
}

/**
 * List issues by label
 * Required: labels (string or array)
 * Optional: state, per_page
 */
async function handleListIssues(octokit, { owner, repo, labels, state = 'open', per_page = 100 }) {
  if (!labels) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required field: labels' }),
    };
  }

  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: Array.isArray(labels) ? labels.join(',') : labels,
    state,
    per_page,
  });

  console.log(`[github-bot] Listed ${issues.length} issues with labels: ${labels}`);

  return {
    statusCode: 200,
    body: JSON.stringify({ issues }),
  };
}

/**
 * Get a comment by ID
 * Required: commentId
 */
async function handleGetComment(octokit, { owner, repo, commentId }) {
  if (!commentId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required field: commentId' }),
    };
  }

  const { data: comment } = await octokit.rest.issues.getComment({
    owner,
    repo,
    comment_id: commentId,
  });

  console.log(`[github-bot] Fetched comment ${commentId}`);

  return {
    statusCode: 200,
    body: JSON.stringify({ comment }),
  };
}

/**
 * Create a comment issue (public comments)
 * Required: title, body, labels
 * Optional: requestedBy, requestedByUserId (for server-side ban checking)
 */
async function handleCreateCommentIssue(octokit, { owner, repo, title, body, labels, requestedBy, requestedByUserId }) {
  if (!title || !body || !labels) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: title, body, labels' }),
    };
  }

  // TODO: Add ban checking here if requestedBy/requestedByUserId provided
  // For now, just create the issue

  const { data: issue } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels: Array.isArray(labels) ? labels : [labels],
  });

  console.log(`[github-bot] Created comment issue #${issue.number}${requestedBy ? ` (requested by ${requestedBy})` : ''}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        created_at: issue.created_at,
        state: issue.state,
      },
    }),
  };
}

/**
 * Create an admin issue (with lock)
 * Required: title, body, labels, userToken, username
 * Optional: lock (default: true)
 */
async function handleCreateAdminIssue(octokit, { owner, repo, title, body, labels, lock = true, userToken, username }) {
  if (!title || !body || !labels || !userToken || !username) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: title, body, labels, userToken, username' }),
    };
  }

  // Verify user has admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    // Check if user is owner or has admin permissions
    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only repository owner and admins can perform this action' }),
      };
    }
  } catch (error) {
    console.error('[github-bot] Permission check failed:', error);
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Permission verification failed' }),
    };
  }

  // Create issue using bot token
  const { data: issue } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels: Array.isArray(labels) ? labels : [labels],
  });

  // Lock the issue if requested
  if (lock) {
    try {
      await octokit.rest.issues.lock({
        owner,
        repo,
        issue_number: issue.number,
        lock_reason: 'off-topic',
      });
    } catch (lockError) {
      console.warn('[github-bot] Failed to lock issue:', lockError.message);
    }
  }

  console.log(`[github-bot] Created admin issue #${issue.number} by ${username}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        created_at: issue.created_at,
        state: issue.state,
      },
    }),
  };
}

/**
 * Update an admin issue
 * Required: issueNumber, body, userToken, username
 */
async function handleUpdateAdminIssue(octokit, { owner, repo, issueNumber, body, userToken, username }) {
  if (!issueNumber || body === undefined || !userToken || !username) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: issueNumber, body, userToken, username' }),
    };
  }

  // Verify user has admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only repository owner and admins can perform this action' }),
      };
    }
  } catch (error) {
    console.error('[github-bot] Permission check failed:', error);
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Permission verification failed' }),
    };
  }

  // Update issue using bot token
  const { data: issue } = await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  console.log(`[github-bot] Updated admin issue #${issueNumber} by ${username}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        updated_at: issue.updated_at,
        state: issue.state,
      },
    }),
  };
}
