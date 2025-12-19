/**
 * Cloudflare Function: Load Data (Universal)
 * Handles loading skill builds, battle loadouts, and spirit collection
 *
 * GET /api/load-data?type=TYPE&userId=USER_ID
 * Query Params:
 *   type: 'skill-build' | 'battle-loadout' | 'my-spirit' | 'spirit-build'
 *   userId: number
 */

import { Octokit } from '@octokit/rest';

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
    const validTypes = ['skill-build', 'battle-loadout', 'my-spirit', 'spirit-build'];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

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

    // Initialize Octokit with bot token
    const octokit = new Octokit({ auth: botToken });

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

    return new Response(
      JSON.stringify(response),
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
