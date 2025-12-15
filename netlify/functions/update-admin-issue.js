/**
 * Netlify Function: Update Admin Issue (Bot)
 * Updates GitHub issues for admin/ban lists using bot token (server-side only)
 * This keeps the bot token secure and prevents users from tampering with admin lists
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
    const { owner, repo, issueNumber, body } = JSON.parse(event.body);

    // Validate required fields
    if (!owner || !repo || !issueNumber || !body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['owner', 'repo', 'issueNumber', 'body'],
        }),
      };
    }

    // Initialize Octokit with bot token (server-side only!)
    const octokit = new Octokit({
      auth: botToken,
      userAgent: 'GitHub-Wiki-Bot/1.0',
    });

    // Update the issue using bot token
    const { data: issue } = await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });

    console.log(`[Bot Function] Updated admin issue #${issue.number} for ${owner}/${repo}`);

    // Return the updated issue
    return {
      statusCode: 200,
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
          updated_at: issue.updated_at,
          state: issue.state,
        },
      }),
    };
  } catch (error) {
    console.error('[Bot Function] Error updating admin issue:', error);

    // Handle specific GitHub API errors
    let statusCode = 500;
    let errorMessage = 'Failed to update admin issue';

    if (error.status === 401) {
      statusCode = 401;
      errorMessage = 'Invalid bot token';
    } else if (error.status === 403) {
      statusCode = 403;
      errorMessage = 'Bot does not have permission to update issues';
    } else if (error.status === 404) {
      statusCode = 404;
      errorMessage = 'Issue not found';
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
