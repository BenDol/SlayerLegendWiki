/**
 * Netlify Function: Delete Battle Loadout
 * Deletes a battle loadout for the authenticated user
 *
 * POST /api/deleteBattleLoadout
 * Body: {
 *   username: string,
 *   userId: number,
 *   loadoutId: string
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
    const { username, userId, loadoutId } = JSON.parse(event.body);

    // Validate required fields
    if (!username || !userId || !loadoutId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: username, userId, loadoutId' }),
      };
    }

    // Get bot token from environment
    const botToken = process.env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[deleteBattleLoadout] WIKI_BOT_TOKEN not configured');
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
      console.error('[deleteBattleLoadout] Repository config missing');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    const LOADOUTS_LABEL = 'battle-loadouts';
    const LOADOUTS_TITLE_PREFIX = '[Battle Loadouts]';

    // Get existing loadouts
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: LOADOUTS_LABEL,
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

    if (!existingIssue) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No loadouts found for user' }),
      };
    }

    // Parse existing loadouts
    let loadouts = [];
    try {
      loadouts = JSON.parse(existingIssue.body || '[]');
      if (!Array.isArray(loadouts)) loadouts = [];
    } catch (e) {
      loadouts = [];
    }

    // Remove the loadout
    const filteredLoadouts = loadouts.filter(l => l.id !== loadoutId);

    if (filteredLoadouts.length === loadouts.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Loadout with ID ${loadoutId} not found` }),
      };
    }

    // Update the issue with filtered loadouts
    const issueTitle = `${LOADOUTS_TITLE_PREFIX} ${username}`;
    const issueBody = JSON.stringify(filteredLoadouts, null, 2);

    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: existingIssue.number,
      title: issueTitle,
      body: issueBody,
    });

    console.log(`[deleteBattleLoadout] Deleted loadout ${loadoutId} for ${username}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        loadouts: filteredLoadouts,
      }),
    };
  } catch (error) {
    console.error('[deleteBattleLoadout] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
