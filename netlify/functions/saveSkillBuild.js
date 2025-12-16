/**
 * Netlify Function: Save Skill Build
 * Creates or updates a skill build for the authenticated user
 *
 * POST /api/saveSkillBuild
 * Body: {
 *   username: string,
 *   userId: number,
 *   build: {
 *     id?: string,
 *     name: string,
 *     maxSlots: number,
 *     slots: array
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
    const { username, userId, build } = JSON.parse(event.body);

    // Validate required fields
    if (!username || !userId || !build) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: username, userId, build' }),
      };
    }

    if (!build.name || !build.maxSlots || !build.slots) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Build must have name, maxSlots, and slots' }),
      };
    }

    // Get bot token from environment
    const botToken = process.env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[saveSkillBuild] WIKI_BOT_TOKEN not configured');
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
      console.error('[saveSkillBuild] Repository config missing');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // Import skill builds service functions
    const BUILDS_LABEL = 'skill-builds';
    const BUILDS_TITLE_PREFIX = '[Skill Builds]';
    const MAX_BUILDS_PER_USER = 10;

    // Get existing builds
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: BUILDS_LABEL,
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

    // Parse existing builds
    let builds = [];
    if (existingIssue) {
      try {
        builds = JSON.parse(existingIssue.body || '[]');
        if (!Array.isArray(builds)) builds = [];
      } catch (e) {
        builds = [];
      }
    }

    // Check if updating existing build (by name)
    const buildIndex = builds.findIndex(b => b.name === build.name);

    if (buildIndex !== -1) {
      // Update existing build
      builds[buildIndex] = {
        ...build,
        id: builds[buildIndex].id, // Preserve original ID
        createdAt: builds[buildIndex].createdAt, // Preserve creation date
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Add new build
      if (builds.length >= MAX_BUILDS_PER_USER) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: `Maximum ${MAX_BUILDS_PER_USER} builds allowed. Please delete an old build first.`,
          }),
        };
      }

      // Generate ID for new build
      build.id = `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      build.createdAt = new Date().toISOString();
      build.updatedAt = new Date().toISOString();

      builds.push(build);
    }

    // Save builds to GitHub
    const issueTitle = `${BUILDS_TITLE_PREFIX} ${username}`;
    const issueBody = JSON.stringify(builds, null, 2);
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

      console.log(`[saveSkillBuild] Updated builds for ${username}`);
    } else {
      // Create new issue
      const labels = [BUILDS_LABEL, userIdLabel];

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
        console.warn(`[saveSkillBuild] Failed to lock issue:`, lockError.message);
      }

      console.log(`[saveSkillBuild] Created builds issue for ${username}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        build,
        builds,
      }),
    };
  } catch (error) {
    console.error('[saveSkillBuild] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
