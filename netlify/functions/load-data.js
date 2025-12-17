/**
 * Netlify Function: Load Data (Universal)
 * Handles loading skill builds, battle loadouts, and spirit collection
 *
 * GET /.netlify/functions/load-data?type=TYPE&userId=USER_ID
 * Query Params:
 *   type: 'skill-build' | 'battle-loadout' | 'my-spirit' | 'spirit-build'
 *   userId: number
 */

import { Octokit } from '@octokit/rest';

export async function handler(event) {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse query parameters
    const params = event.queryStringParameters || {};
    const { type, userId } = params;

    // Validate required fields
    if (!type || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters: type, userId' }),
      };
    }

    // Validate type
    const validTypes = ['skill-build', 'battle-loadout', 'my-spirit', 'spirit-build'];
    if (!validTypes.includes(type)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }),
      };
    }

    // Get bot token from environment
    const botToken = process.env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[load-data] WIKI_BOT_TOKEN not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // Initialize Octokit with bot token
    const octokit = new Octokit({ auth: botToken });

    // Get repo info from environment
    const owner = process.env.WIKI_REPO_OWNER || process.env.VITE_WIKI_REPO_OWNER;
    const repo = process.env.WIKI_REPO_NAME || process.env.VITE_WIKI_REPO_NAME;

    if (!owner || !repo) {
      console.error('[load-data] Repository config missing');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // Set type-specific constants
    const configs = {
      'skill-build': {
        label: 'skill-builds',
        itemsName: 'builds',
      },
      'battle-loadout': {
        label: 'battle-loadouts',
        itemsName: 'loadouts',
      },
      'my-spirit': {
        label: 'my-spirits',
        itemsName: 'spirits',
      },
      'spirit-build': {
        label: 'spirit-builds',
        itemsName: 'builds',
      },
    };
    const config = configs[type];

    // Get existing items
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: config.label,
      state: 'open',
      per_page: 100,
    });

    // Search by user ID label
    const existingIssue = issues.find(issue =>
      issue.labels.some(label =>
        (typeof label === 'string' && label === `user-id:${userId}`) ||
        (typeof label === 'object' && label.name === `user-id:${userId}`)
      )
    );

    // Parse existing items
    let items = [];
    if (existingIssue) {
      try {
        items = JSON.parse(existingIssue.body || '[]');
        if (!Array.isArray(items)) items = [];
      } catch (e) {
        console.error('[load-data] Failed to parse issue body:', e);
        items = [];
      }
    }

    // Return response with dynamic key names
    const response = {
      success: true,
    };
    response[config.itemsName] = items;

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[load-data] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
