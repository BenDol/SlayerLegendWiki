/**
 * Netlify Function: Delete Data (Universal)
 * Handles deleting skill builds, battle loadouts, and spirit collection
 *
 * POST /.netlify/functions/delete-data
 * Body: {
 *   type: 'skill-build' | 'battle-loadout' | 'my-spirit' | 'spirit-build',
 *   username: string,
 *   userId: number,
 *   itemId: string (for skill-build/battle-loadout/spirit-build),
 *   spiritId: string (for my-spirit)
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
    const { type, username, userId, itemId, spiritId } = JSON.parse(event.body);

    // Validate required fields
    const deleteId = type === 'my-spirit' ? spiritId : itemId;
    if (!type || !username || !userId || !deleteId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Missing required fields: type, username, userId, ${type === 'my-spirit' ? 'spiritId' : 'itemId'}` }),
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
      console.error('[delete-data] WIKI_BOT_TOKEN not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // Initialize Octokit with bot token
    const octokit = new Octokit({ auth: botToken });

    // Get repo info from environment
    // Try both VITE_ prefixed (for local dev) and non-prefixed (for Netlify)
    const owner = process.env.WIKI_REPO_OWNER || process.env.VITE_WIKI_REPO_OWNER;
    const repo = process.env.WIKI_REPO_NAME || process.env.VITE_WIKI_REPO_NAME;

    if (!owner || !repo) {
      console.error('[delete-data] Repository config missing');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // Set type-specific constants
    const configs = {
      'skill-build': {
        label: 'skill-builds',
        titlePrefix: '[Skill Builds]',
        itemsName: 'builds',
      },
      'battle-loadout': {
        label: 'battle-loadouts',
        titlePrefix: '[Battle Loadouts]',
        itemsName: 'loadouts',
      },
      'my-spirit': {
        label: 'my-spirits',
        titlePrefix: '[My Spirits]',
        itemsName: 'spirits',
      },
      'spirit-build': {
        label: 'spirit-builds',
        titlePrefix: '[Spirit Builds]',
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

    // Find user's issue
    const existingIssue = issues.find(issue =>
      issue.labels.some(label =>
        (typeof label === 'string' && label === `user-id:${userId}`) ||
        (typeof label === 'object' && label.name === `user-id:${userId}`)
      )
    );

    if (!existingIssue) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No items found for this user' }),
      };
    }

    // Parse existing items
    let items = [];
    try {
      items = JSON.parse(existingIssue.body || '[]');
      if (!Array.isArray(items)) items = [];
    } catch (e) {
      items = [];
    }

    // Find and remove the item
    const itemIndex = items.findIndex(item => item.id === deleteId);

    if (itemIndex === -1) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Item not found' }),
      };
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

      console.log(`[delete-data] Closed empty ${config.itemsName} issue for ${username}`);
    } else {
      // Update the issue with remaining items
      const issueBody = JSON.stringify(items, null, 2);

      await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: existingIssue.number,
        body: issueBody,
      });

      console.log(`[delete-data] Updated ${config.itemsName} for ${username}`);
    }

    // Return response with dynamic key name
    const response = {
      success: true,
    };
    response[config.itemsName] = items;

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[delete-data] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
