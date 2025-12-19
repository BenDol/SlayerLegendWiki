/**
 * Cloudflare Pages Function: GitHub Bot (Consolidated)
 * Handles all bot-authenticated GitHub operations
 *
 * POST /api/github-bot
 * Body: {
 *   action: 'create-comment' | 'update-issue' | 'list-issues' | 'get-comment' | 'create-comment-issue' | 'create-admin-issue' | 'update-admin-issue',
 *   owner: string,
 *   repo: string,
 *   ... (action-specific parameters)
 * }
 */

import { Octokit } from '@octokit/rest';

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
    const body = await request.json();
    const { action, owner, repo } = body;

    console.log('[github-bot] Received request:', { action, owner, repo });

    // Validate required fields
    if (!action || !owner || !repo) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action, owner, repo' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get bot token from environment
    const botToken = env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[github-bot] WIKI_BOT_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Bot token not configured' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Octokit with bot token
    const octokit = new Octokit({
      auth: botToken,
      userAgent: 'GitHub-Wiki-Bot/1.0'
    });

    // Route to action handler
    let result;
    switch (action) {
      case 'create-comment':
        result = await handleCreateComment(octokit, body);
        break;
      case 'update-issue':
        result = await handleUpdateIssue(octokit, body);
        break;
      case 'list-issues':
        result = await handleListIssues(octokit, body);
        break;
      case 'get-comment':
        result = await handleGetComment(octokit, body);
        break;
      case 'create-comment-issue':
        result = await handleCreateCommentIssue(octokit, body);
        break;
      case 'create-admin-issue':
        result = await handleCreateAdminIssue(octokit, body);
        break;
      case 'update-admin-issue':
        result = await handleUpdateAdminIssue(octokit, body);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
    }

    return new Response(
      JSON.stringify(result.body),
      {
        status: result.statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[github-bot] Error:', error);
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
 * Create a comment on an issue
 */
async function handleCreateComment(octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || !body) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: issueNumber, body' }
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
    body: {
      comment: {
        id: comment.id,
        body: comment.body,
        created_at: comment.created_at,
        html_url: comment.html_url,
      },
    }
  };
}

/**
 * Update an issue body
 */
async function handleUpdateIssue(octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || body === undefined) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: issueNumber, body' }
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
    body: {
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        updated_at: issue.updated_at,
        state: issue.state,
      },
    }
  };
}

/**
 * List issues by label
 */
async function handleListIssues(octokit, { owner, repo, labels, state = 'open', per_page = 100 }) {
  if (!labels) {
    return {
      statusCode: 400,
      body: { error: 'Missing required field: labels' }
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
    body: { issues }
  };
}

/**
 * Get a comment by ID
 */
async function handleGetComment(octokit, { owner, repo, commentId }) {
  if (!commentId) {
    return {
      statusCode: 400,
      body: { error: 'Missing required field: commentId' }
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
    body: { comment }
  };
}

/**
 * Create a comment issue
 */
async function handleCreateCommentIssue(octokit, { owner, repo, title, body, labels, requestedBy, requestedByUserId }) {
  if (!title || !body || !labels) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: title, body, labels' }
    };
  }

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
    body: {
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        created_at: issue.created_at,
        state: issue.state,
      },
    }
  };
}

/**
 * Create an admin issue
 */
async function handleCreateAdminIssue(octokit, { owner, repo, title, body, labels, lock = true, userToken, username }) {
  if (!title || !body || !labels || !userToken || !username) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: title, body, labels, userToken, username' }
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
        body: { error: 'Only repository owner and admins can perform this action' }
      };
    }
  } catch (error) {
    console.error('[github-bot] Permission check failed:', error);
    return {
      statusCode: 403,
      body: { error: 'Permission verification failed' }
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

  // Lock the issue
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
    body: {
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        created_at: issue.created_at,
        state: issue.state,
      },
    }
  };
}

/**
 * Update an admin issue
 */
async function handleUpdateAdminIssue(octokit, { owner, repo, issueNumber, body, userToken, username }) {
  if (!issueNumber || body === undefined || !userToken || !username) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: issueNumber, body, userToken, username' }
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
        body: { error: 'Only repository owner and admins can perform this action' }
      };
    }
  } catch (error) {
    console.error('[github-bot] Permission check failed:', error);
    return {
      statusCode: 403,
      body: { error: 'Permission verification failed' }
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
    body: {
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        updated_at: issue.updated_at,
        state: issue.state,
      },
    }
  };
}
