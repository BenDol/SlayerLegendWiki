/**
 * Netlify Function: Save Battle Loadout
 * Creates or updates a battle loadout for the authenticated user
 *
 * POST /api/saveBattleLoadout
 * Body: {
 *   username: string,
 *   userId: number,
 *   loadout: {
 *     id?: string,
 *     name: string,
 *     skillBuild: object,
 *     spirit: object,
 *     skillStone: object,
 *     promotionAbility: object,
 *     familiar: object
 *   }
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
    const { username, userId, loadout } = JSON.parse(event.body);

    // Validate required fields
    if (!username || !userId || !loadout) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: username, userId, loadout' }),
      };
    }

    if (!loadout.name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Loadout must have a name' }),
      };
    }

    // Get bot token from environment
    const botToken = process.env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[saveBattleLoadout] WIKI_BOT_TOKEN not configured');
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
      console.error('[saveBattleLoadout] Repository config missing');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // Battle loadouts constants
    const LOADOUTS_LABEL = 'battle-loadouts';
    const LOADOUTS_TITLE_PREFIX = '[Battle Loadouts]';
    const MAX_LOADOUTS_PER_USER = 10;

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

    // Parse existing loadouts
    let loadouts = [];
    if (existingIssue) {
      try {
        loadouts = JSON.parse(existingIssue.body || '[]');
        if (!Array.isArray(loadouts)) loadouts = [];
      } catch (e) {
        loadouts = [];
      }
    }

    // Check if updating existing loadout (by name)
    const loadoutIndex = loadouts.findIndex(l => l.name === loadout.name);

    if (loadoutIndex !== -1) {
      // Update existing loadout
      loadouts[loadoutIndex] = {
        ...loadout,
        id: loadouts[loadoutIndex].id, // Preserve original ID
        createdAt: loadouts[loadoutIndex].createdAt, // Preserve creation date
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Add new loadout
      if (loadouts.length >= MAX_LOADOUTS_PER_USER) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: `Maximum ${MAX_LOADOUTS_PER_USER} loadouts allowed. Please delete an old loadout first.`,
          }),
        };
      }

      // Generate ID for new loadout
      loadout.id = `loadout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      loadout.createdAt = new Date().toISOString();
      loadout.updatedAt = new Date().toISOString();

      loadouts.push(loadout);
    }

    // Save loadouts to GitHub
    const issueTitle = `${LOADOUTS_TITLE_PREFIX} ${username}`;
    const issueBody = JSON.stringify(loadouts, null, 2);
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

      console.log(`[saveBattleLoadout] Updated loadouts for ${username}`);
    } else {
      // Create new issue
      const labels = [LOADOUTS_LABEL, userIdLabel];

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
        console.warn(`[saveBattleLoadout] Failed to lock issue:`, lockError.message);
      }

      console.log(`[saveBattleLoadout] Created loadouts issue for ${username}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        loadout,
        loadouts,
      }),
    };
  } catch (error) {
    console.error('[saveBattleLoadout] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
