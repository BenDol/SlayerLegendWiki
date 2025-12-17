/**
 * Netlify Function: Save Data (Universal)
 * Handles saving skill builds, battle loadouts, and spirit collection
 *
 * POST /.netlify/functions/save-data
 * Body: {
 *   type: 'skill-build' | 'battle-loadout' | 'my-spirit' | 'spirit-build',
 *   username: string,
 *   userId: number,
 *   data: object,
 *   spiritId?: string (for my-spirit updates)
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
    const { type, username, userId, data, spiritId } = JSON.parse(event.body);

    // Validate required fields
    if (!type || !username || !userId || !data) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: type, username, userId, data' }),
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
      console.error('[save-data] WIKI_BOT_TOKEN not configured');
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
      console.error('[save-data] Repository config missing');
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
        maxItems: 10,
        itemName: 'build',
        itemsName: 'builds',
      },
      'battle-loadout': {
        label: 'battle-loadouts',
        titlePrefix: '[Battle Loadouts]',
        maxItems: 10,
        itemName: 'loadout',
        itemsName: 'loadouts',
      },
      'my-spirit': {
        label: 'my-spirits',
        titlePrefix: '[My Spirits]',
        maxItems: 50,
        itemName: 'spirit',
        itemsName: 'spirits',
      },
      'spirit-build': {
        label: 'spirit-builds',
        titlePrefix: '[Spirit Builds]',
        maxItems: 10,
        itemName: 'build',
        itemsName: 'builds',
      },
    };
    const config = configs[type];

    // Validate data structure
    if (type !== 'my-spirit' && !data.name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `${config.itemName} must have a name` }),
      };
    }

    if (type === 'my-spirit' && !data.spirit) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Spirit data must include a spirit object' }),
      };
    }

    if (type === 'skill-build' && (!data.maxSlots || !data.slots)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Build must have maxSlots and slots' }),
      };
    }

    // Get existing items
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: config.label,
      state: 'open',
      per_page: 100,
    });

    let existingIssue = null;

    // Search by user ID label
    existingIssue = issues.find(issue =>
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
        items = [];
      }
    }

    // Check if updating existing item
    let itemIndex = -1;
    if (type === 'my-spirit' && spiritId) {
      // For my-spirit updates, find by spiritId
      itemIndex = items.findIndex(item => item.id === spiritId);
    } else if (type !== 'my-spirit') {
      // For other types, find by name
      itemIndex = items.findIndex(item => item.name === data.name);
    }

    if (itemIndex !== -1) {
      // Update existing item
      items[itemIndex] = {
        ...data,
        id: items[itemIndex].id, // Preserve original ID
        createdAt: items[itemIndex].createdAt, // Preserve creation date
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Add new item
      if (items.length >= config.maxItems) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: `Maximum ${config.maxItems} ${config.itemsName} allowed. Please delete an old ${config.itemName} first.`,
          }),
        };
      }

      // Generate ID for new item
      data.id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      data.createdAt = new Date().toISOString();
      data.updatedAt = new Date().toISOString();

      items.push(data);
    }

    // Save items to GitHub
    const issueTitle = `${config.titlePrefix} ${username}`;
    const issueBody = JSON.stringify(items, null, 2);
    const userIdLabel = `user-id:${userId}`;

    if (existingIssue) {
      // Update existing issue
      await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: existingIssue.number,
        title: issueTitle,
        body: issueBody,
      });

      console.log(`[save-data] Updated ${config.itemsName} for ${username}`);
    } else {
      // Create new issue
      const labels = [config.label, userIdLabel];

      const { data: newIssue } = await octokit.rest.issues.create({
        owner,
        repo,
        title: issueTitle,
        body: issueBody,
        labels,
      });

      // Lock the issue
      try {
        await octokit.rest.issues.lock({
          owner,
          repo,
          issue_number: newIssue.number,
          lock_reason: 'off-topic',
        });
      } catch (lockError) {
        console.warn(`[save-data] Failed to lock issue:`, lockError.message);
      }

      console.log(`[save-data] Created ${config.itemsName} issue for ${username}`);
    }

    // Return response with dynamic key names
    const response = {
      success: true,
    };
    response[config.itemName] = data;
    response[config.itemsName] = items;

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[save-data] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
