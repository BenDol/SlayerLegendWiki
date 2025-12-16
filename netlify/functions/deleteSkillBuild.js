/**
 * Netlify Function: Delete Skill Build
 * Deletes a skill build for the authenticated user
 *
 * POST /api/deleteSkillBuild
 * Body: {
 *   username: string,
 *   userId: number,
 *   buildId: string
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
    const { username, userId, buildId } = JSON.parse(event.body);

    // Validate required fields
    if (!username || !userId || !buildId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: username, userId, buildId' }),
      };
    }

    // Get bot token from environment
    const botToken = process.env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[deleteSkillBuild] WIKI_BOT_TOKEN not configured');
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
      console.error('[deleteSkillBuild] Repository config missing');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    const BUILDS_LABEL = 'skill-builds';
    const BUILDS_TITLE_PREFIX = '[Skill Builds]';

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

    if (!existingIssue) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No builds found for user' }),
      };
    }

    // Parse existing builds
    let builds = [];
    try {
      builds = JSON.parse(existingIssue.body || '[]');
      if (!Array.isArray(builds)) builds = [];
    } catch (e) {
      builds = [];
    }

    // Remove the build
    const filteredBuilds = builds.filter(b => b.id !== buildId);

    if (filteredBuilds.length === builds.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Build with ID ${buildId} not found` }),
      };
    }

    // Update the issue with filtered builds
    const issueTitle = `${BUILDS_TITLE_PREFIX} ${username}`;
    const issueBody = JSON.stringify(filteredBuilds, null, 2);

    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: existingIssue.number,
      title: issueTitle,
      body: issueBody,
    });

    console.log(`[deleteSkillBuild] Deleted build ${buildId} for ${username}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        builds: filteredBuilds,
      }),
    };
  } catch (error) {
    console.error('[deleteSkillBuild] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
