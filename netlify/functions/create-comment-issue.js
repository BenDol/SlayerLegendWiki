/**
 * Netlify Function: Create Comment Issue (Bot)
 * Creates GitHub issues for wiki page comments using bot token (server-side only)
 * This keeps the bot token secure and prevents users from closing comment issues
 */

import { Octokit } from 'octokit';

export const handler = async function(event) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check if bot token is configured
  const botToken = process.env.WIKI_BOT_TOKEN;
  if (!botToken) {
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Bot token not configured',
        message: 'Wiki administrator needs to configure WIKI_BOT_TOKEN in Netlify environment variables',
      }),
    };
  }

  try {
    // Parse the request body
    const { owner, repo, title, body, labels } = JSON.parse(event.body);

    // Validate required fields
    if (!owner || !repo || !title || !body || !labels) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['owner', 'repo', 'title', 'body', 'labels'],
        }),
      };
    }

    // Initialize Octokit with bot token (server-side only!)
    const octokit = new Octokit({
      auth: botToken,
      userAgent: 'GitHub-Wiki-Bot/1.0',
    });

    // Create the issue using bot token
    const { data: issue } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    });

    console.log(`[Bot Function] Created issue #${issue.number} for ${owner}/${repo}`);

    // Return the created issue
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
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
  } catch (error) {
    console.error('[Bot Function] Error creating issue:', error);

    // Handle specific GitHub API errors
    let statusCode = 500;
    let errorMessage = 'Failed to create comment issue';

    if (error.status === 401) {
      statusCode = 401;
      errorMessage = 'Invalid bot token';
    } else if (error.status === 403) {
      statusCode = 403;
      errorMessage = 'Bot does not have permission to create issues';
    } else if (error.status === 404) {
      statusCode = 404;
      errorMessage = 'Repository not found';
    } else if (error.status === 422) {
      statusCode = 422;
      errorMessage = 'Invalid issue data';
    }

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: errorMessage,
        message: error.message,
      }),
    };
  }
};
