const { createLogger } = require('../../../src/utils/logger');
const logger = createLogger('GithubBot');

// Cache for loaded achievement deciders
let achievementDecidersCache = null;

/**
 * Load achievement deciders (framework defaults + custom)
 * Lazy-loaded and cached for performance
 */
async function loadAchievementDeciders() {
  if (achievementDecidersCache) {
    return achievementDecidersCache;
  }

  let deciders = {};

  try {
    // Import framework default deciders
    const frameworkModule = await import('github-wiki-framework/src/services/achievements/deciders/index.js');
    deciders = { ...frameworkModule.defaultDeciders };

    // Import custom deciders from parent project (if they exist)
    try {
      const customModule = await import('../../../src/services/achievements/deciders/index.js');
      deciders = { ...deciders, ...customModule.customDeciders };
    } catch (customError) {
      // Custom deciders are optional
      logger.debug('No custom deciders found (this is OK)', { error: customError.message });
    }

    logger.info('Loaded achievement deciders', {
      count: Object.keys(deciders).length,
      ids: Object.keys(deciders)
    });

    achievementDecidersCache = deciders;
    return deciders;
  } catch (error) {
    logger.error('Failed to load achievement deciders', { error: error.message });
    return {};
  }
}

/**
 * GitHub Bot Handler (Platform-Agnostic)
 * Handles all bot-authenticated GitHub operations
 *
 * POST /api/github-bot
 * Body: {
 *   action: 'create-comment' | 'update-issue' | 'list-issues' | 'get-comment' | 'create-comment-issue' | 'create-admin-issue' | 'update-admin-issue',
 *   owner: string,
 *   repo: string,
 *   ... (action-specific parameters)
 * }
 */

import { Octokit } from '@octokit/rest';
import * as LeoProfanity from 'leo-profanity';
import { sendEmail } from '../sendgrid.js';
import * as jwt from '../jwt.js';
import StorageFactory from 'github-wiki-framework/src/services/storage/StorageFactory.js';
import { createUserIdLabel, createNameLabel, createEmailLabel } from 'github-wiki-framework/src/utils/githubLabelUtils.js';
import {
  validateIssueTitle,
  validateIssueBody,
  validateLabels,
  validateEmail,
  validateDisplayName,
  validateEditReason,
  validatePageContent,
  validatePageTitle,
  validatePageId,
  validateSectionName,
  validateUsername,
} from '../validation.js';

/**
 * Mask email address for privacy
 * Shows only first and last character of username, masks middle with asterisks
 * Adds random 1-2 extra asterisks to prevent length-based matching
 * Example: demo0@gmail.com -> d****0@gmail.com or d*****0@gmail.com
 * @param {string} email - Email address to mask
 * @returns {string} Masked email address
 */
function maskEmail(email) {
  const [username, domain] = email.split('@');

  if (username.length <= 2) {
    // For very short usernames, mask all but first character
    const randomExtra = Math.floor(Math.random() * 2) + 1; // 1-2 extra asterisks
    return `${username[0]}${'*'.repeat(3 + randomExtra)}@${domain}`;
  }

  // Show first and last character, mask the middle
  const firstChar = username[0];
  const lastChar = username[username.length - 1];
  const baseMaskLength = Math.min(username.length - 2, 3); // Base 3 asterisks
  const randomExtra = Math.floor(Math.random() * 2) + 1; // Add 1-2 random asterisks
  const mask = '*'.repeat(baseMaskLength + randomExtra);

  return `${firstChar}${mask}${lastChar}@${domain}`;
}

/**
 * Check text for profanity using OpenAI Moderation API (primary) with leo-profanity fallback
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {string} text - Text to check
 * @returns {Promise<{containsProfanity: boolean, method: string, categories?: object}>}
 */
async function checkProfanity(adapter, text) {
  const openaiApiKey = adapter.getEnv("OPENAI_API_KEY");

  // Try OpenAI Moderation API first (if configured)
  if (openaiApiKey) {
    try {
      logger.debug('Checking with OpenAI Moderation API for text:', text);
      const response = await fetch(
        'https://api.openai.com/v1/moderations',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: text
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const result = data.results[0];

        // OpenAI returns flagged=true if content violates policies
        // Categories: hate, harassment, self-harm, sexual, violence
        const containsProfanity = result.flagged;

        logger.debug('OpenAI Moderation result', {
          flagged: result.flagged,
          categories: result.categories,
          category_scores: result.category_scores
        });

        return {
          containsProfanity,
          method: 'openai-moderation',
          categories: result.categories,
          scores: result.category_scores
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[Profanity] OpenAI API request failed:', response.status, errorData, 'falling back to leo-profanity');
      }
    } catch (error) {
      console.warn('[Profanity] OpenAI API error:', error.message, 'falling back to leo-profanity');
    }
  } else {
    logger.debug('OPENAI_API_KEY not configured, using leo-profanity fallback');
  }

  // Fallback to leo-profanity package
  logger.debug('Using leo-profanity package for text:', text);
  const containsProfanity = LeoProfanity.check(text);
  logger.debug('leo-profanity result:', containsProfanity);
  return { containsProfanity, method: 'leo-profanity' };
}

/**
 * Generate verification email HTML
 */
function generateVerificationEmail(code) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification - Slayer Legend Wiki</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0f172a;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
              <tr>
                <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 30px; text-align: center;">
                  <img src="https://slayerlegend.wiki/images/logo.png" alt="Slayer Legend" width="96" height="96" style="display: block; margin: 0 auto 16px auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);" />
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">Slayer Legend Wiki</h1>
                  <p style="margin: 8px 0 0 0; color: #fecaca; font-size: 14px; letter-spacing: 0.5px;">VERIFICATION CODE</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 24px 0; color: #e2e8f0; font-size: 16px; line-height: 1.6;">Thank you for contributing to the Slayer Legend Wiki! To complete your anonymous edit, please use the verification code below:</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding: 0 0 32px 0;">
                        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); border: 2px solid #3b82f6; border-radius: 8px; padding: 24px; display: inline-block;">
                          <div style="color: #ffffff; font-size: 42px; font-weight: bold; letter-spacing: 12px; font-family: 'Courier New', monospace; text-align: center;">${code}</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #334155; border-left: 4px solid #f59e0b; border-radius: 6px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <p style="margin: 0; color: #fbbf24; font-size: 14px; font-weight: 600;">⏱️ Expires in 10 minutes</p>
                        <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">Enter this code in the wiki editor to verify your email address. After verification, you can make multiple edits for 24 hours without re-verifying.</p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 32px 0 0 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">If you didn't request this code, you can safely ignore this email. The code will expire automatically.</p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #0f172a; padding: 30px; text-align: center; border-top: 1px solid #334155;">
                  <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">Sent by <strong style="color: #94a3b8;">Slayer Legend Wiki</strong></p>
                  <p style="margin: 0; color: #475569; font-size: 12px;">Complete guide for Slayer Legend: Idle RPG (슬레이어 키우기)</p>
                  <div style="margin-top: 16px;"><a href="https://slayerlegend.wiki" style="color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: 600;">Visit Wiki →</a></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Generate plain text version
 */
function generateVerificationEmailText(code) {
  return `⚔️ SLAYER LEGEND WIKI
Email Verification

Thank you for contributing to the Slayer Legend Wiki!

Your verification code is:

    ${code}

⏱️ This code will expire in 10 minutes.

Enter this code in the wiki editor to verify your email address. After verification, you can make multiple edits for 24 hours without re-verifying.

If you didn't request this code, you can safely ignore this email. The code will expire automatically.

────────────────────────────────
Slayer Legend Wiki
Complete guide for Slayer Legend: Idle RPG (슬레이어 키우기)
https://slayerlegend.wiki`;
}

/**
 * Handle GitHub bot request (Platform-Agnostic)
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {ConfigAdapter} configAdapter - Config adapter instance
 * @param {CryptoAdapter} cryptoAdapter - Crypto adapter instance
 * @returns {Promise<Object>} Platform-specific response
 */
export async function handleGithubBot(adapter, configAdapter, cryptoAdapter) {
  // Only allow POST
  if (adapter.getMethod() !== 'POST') {
    return adapter.createJsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    // Parse request body
    const body = await adapter.getJsonBody();
    const { action, owner, repo } = body;

    // Validate required fields
    if (!action || !owner || !repo) {
      return adapter.createJsonResponse(400, { error: 'Missing required fields: action, owner, repo' });
    }

    // Get bot token from environment
    const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
    if (!botToken) {
      console.error('[github-bot] WIKI_BOT_TOKEN not configured');
      return adapter.createJsonResponse(503, { error: 'Bot token not configured' });
    }

    // Initialize Octokit with bot token
    const octokit = new Octokit({
      auth: botToken,
      userAgent: 'GitHub-Wiki-Bot/1.0'
    });

    // Get headers for authenticated endpoints
    const headers = adapter.getHeaders();

    // Route to action handler
    switch (action) {
      case 'create-comment':
        return await handleCreateComment(adapter, octokit, body);
      case 'update-issue':
        return await handleUpdateIssue(adapter, octokit, body);
      case 'list-issues':
        return await handleListIssues(adapter, octokit, body);
      case 'get-comment':
        return await handleGetComment(adapter, octokit, body);
      case 'create-comment-issue':
        return await handleCreateCommentIssue(adapter, octokit, body);
      case 'create-admin-issue':
        return await handleCreateAdminIssue(adapter, octokit, body);
      case 'update-admin-issue':
        return await handleUpdateAdminIssue(adapter, octokit, body);
      case 'save-user-snapshot':
        return await handleSaveUserSnapshot(adapter, octokit, body);
      case 'send-verification-email':
        return await handleSendVerificationEmail(adapter, configAdapter, cryptoAdapter, octokit, body);
      case 'verify-email':
        return await handleVerifyEmail(adapter, configAdapter, cryptoAdapter, octokit, body);
      case 'check-rate-limit':
        return await handleCheckRateLimit(adapter, body);
      case 'create-anonymous-pr':
        return await handleCreateAnonymousPR(adapter, configAdapter, cryptoAdapter, octokit, body);
      case 'link-anonymous-edits':
        return await handleLinkAnonymousEdits(adapter, octokit, body, headers);
      case 'check-achievements':
        return await handleCheckAchievements(adapter, octokit, body, headers);
      case 'check-single-achievement':
        return await handleCheckSingleAchievement(adapter, octokit, body, headers);
      case 'get-or-create-creator-index':
        return await handleGetOrCreateCreatorIndex(adapter, octokit, body);
      case 'submit-content-creator':
        return await handleSubmitContentCreator(adapter, octokit, body);
      case 'get-approved-creators':
        return await handleGetApprovedCreators(adapter, octokit, body);
      case 'get-all-creator-submissions':
        return await handleGetAllCreatorSubmissions(adapter, octokit, body);
      case 'sync-creator-approvals':
        return await handleSyncCreatorApprovals(adapter, octokit, body);
      case 'approve-creator':
        return await handleApproveCreator(adapter, octokit, body);
      case 'delete-creator-submission':
        return await handleDeleteCreatorSubmission(adapter, octokit, body);
      case 'delete-video-guide':
        return await handleDeleteVideoGuide(adapter, octokit, body);
      default:
        return adapter.createJsonResponse(400, { error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('[github-bot] Error:', error);
    return adapter.createJsonResponse(500, { error: error.message || 'Internal server error' });
  }
}

/**
 * Create a comment on an issue
 * Required: issueNumber, body
 */
async function handleCreateComment(adapter, octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || !body) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: issueNumber, body' });
  }

  // Validate body
  const bodyResult = validateIssueBody(body, 'Comment body');
  if (!bodyResult.valid) {
    return adapter.createJsonResponse(400, { error: bodyResult.error });
  }

  const { data: comment } = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  logger.debug(`Created comment ${comment.id} on issue #${issueNumber}`);

  return adapter.createJsonResponse(200, {
    comment: {
      id: comment.id,
      body: comment.body,
      created_at: comment.created_at,
      html_url: comment.html_url,
    },
  });
}

/**
 * Update an issue body
 * Required: issueNumber, body
 */
async function handleUpdateIssue(adapter, octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || body === undefined) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: issueNumber, body' });
  }

  // Validate body
  const bodyResult = validateIssueBody(body, 'Issue body');
  if (!bodyResult.valid) {
    return adapter.createJsonResponse(400, { error: bodyResult.error });
  }

  const { data: issue } = await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  logger.debug(`Updated issue #${issueNumber}`);

  return adapter.createJsonResponse(200, {
    issue: {
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      body: issue.body,
      labels: issue.labels,
      updated_at: issue.updated_at,
      state: issue.state,
    },
  });
}

/**
 * List issues by label
 * Required: labels (string or array)
 * Optional: state, per_page
 */
async function handleListIssues(adapter, octokit, { owner, repo, labels, state = 'open', per_page = 100 }) {
  if (!labels) {
    return adapter.createJsonResponse(400, { error: 'Missing required field: labels' });
  }

  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: Array.isArray(labels) ? labels.join(',') : labels,
    state,
    per_page,
  });

  // Security: Filter to only bot-created issues
  const botUsername = adapter.getEnv('WIKI_BOT_USERNAME');
  const botIssues = issues.filter(issue => issue.user.login === botUsername);

  logger.debug(`Listed ${botIssues.length}/${issues.length} bot-created issues with labels: ${labels}`);

  return adapter.createJsonResponse(200, { issues: botIssues });
}

/**
 * Get a comment by ID
 * Required: commentId
 */
async function handleGetComment(adapter, octokit, { owner, repo, commentId }) {
  if (!commentId) {
    return adapter.createJsonResponse(400, { error: 'Missing required field: commentId' });
  }

  const { data: comment } = await octokit.rest.issues.getComment({
    owner,
    repo,
    comment_id: commentId,
  });

  logger.debug(`Fetched comment ${commentId}`);

  return adapter.createJsonResponse(200, { comment });
}

/**
 * Create a comment issue (public comments)
 * Required: title, body, labels
 * Optional: requestedBy, requestedByUserId (for server-side ban checking)
 */
async function handleCreateCommentIssue(adapter, octokit, { owner, repo, title, body, labels, requestedBy, requestedByUserId }) {
  if (!title || !body || !labels) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: title, body, labels' });
  }

  // Validate title
  const titleResult = validateIssueTitle(title);
  if (!titleResult.valid) {
    return adapter.createJsonResponse(400, { error: titleResult.error });
  }

  // Validate body
  const bodyResult = validateIssueBody(body, 'Issue body');
  if (!bodyResult.valid) {
    return adapter.createJsonResponse(400, { error: bodyResult.error });
  }

  // Validate labels
  const labelsResult = validateLabels(labels);
  if (!labelsResult.valid) {
    return adapter.createJsonResponse(400, { error: labelsResult.error });
  }

  // TODO: Add ban checking here if requestedBy/requestedByUserId provided
  // For now, just create the issue

  const { data: issue } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels: Array.isArray(labels) ? labels : [labels],
  });

  logger.debug(`Created comment issue #${issue.number}${requestedBy ? ` (requested by ${requestedBy})` : ''}`);

  return adapter.createJsonResponse(200, {
    issue: {
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      body: issue.body,
      labels: issue.labels,
      created_at: issue.created_at,
      state: issue.state,
    },
  });
}

/**
 * Create an admin issue (with lock)
 * Required: title, body, labels, userToken, username
 * Optional: lock (default: true)
 */
async function handleCreateAdminIssue(octokit, { owner, repo, title, body, labels, lock = true, userToken, username }) {
  if (!title || !body || !labels || !userToken || !username) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: title, body, labels, userToken, username' }),
    };
  }

  // Verify user has admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    // Check if user is owner or has admin permissions
    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only repository owner and admins can perform this action' }),
      };
    }
  } catch (error) {
    console.error('[github-bot] Permission check failed:', error);
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Permission verification failed' }),
    };
  }

  // Create issue using bot token
  const { data: issue } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels: Array.isArray(labels) ? labels : [labels],
  });

  // Lock the issue if requested
  if (lock) {
    try {
      await octokit.rest.issues.lock({
        owner,
        repo,
        issue_number: issue.number,
        lock_reason: 'off-topic',
      });
    } catch (lockError) {
      console.warn('[github-bot] Failed to lock issue:', lockError.message);
    }
  }

  logger.debug(`Created admin issue #${issue.number} by ${username}`);

  return {
    statusCode: 200,
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
}

/**
 * Update an admin issue
 * Required: issueNumber, body, userToken, username
 */
async function handleUpdateAdminIssue(octokit, { owner, repo, issueNumber, body, userToken, username }) {
  if (!issueNumber || body === undefined || !userToken || !username) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: issueNumber, body, userToken, username' }),
    };
  }

  // Verify user has admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only repository owner and admins can perform this action' }),
      };
    }
  } catch (error) {
    console.error('[github-bot] Permission check failed:', error);
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Permission verification failed' }),
    };
  }

  // Update issue using bot token
  const { data: issue } = await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  logger.debug(`Updated admin issue #${issueNumber} by ${username}`);

  return {
    statusCode: 200,
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
}

/**
 * Save or update user snapshot issue
 * Required: username, snapshotData, userToken, requestingUsername
 * Optional: existingIssueNumber
 */
async function handleSaveUserSnapshot(octokit, { owner, repo, username, snapshotData, existingIssueNumber, userToken, requestingUsername }) {
  if (!username || !snapshotData || !userToken || !requestingUsername) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: username, snapshotData, userToken, requestingUsername' }),
    };
  }

  // Verify the user is authenticated (has a valid token)
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    // Verify user token is valid
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    // Verify requesting user matches authenticated user
    if (userData.login !== requestingUsername) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'User verification failed' }),
      };
    }

    // Users can only update their own snapshot
    if (requestingUsername !== username) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'You can only update your own user snapshot' }),
      };
    }
  } catch (error) {
    console.error('[github-bot] User verification failed:', error);
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'User authentication failed' }),
    };
  }

  // Prepare issue data
  const issueTitle = `[User Snapshot] ${username}`;
  const issueBody = JSON.stringify(snapshotData, null, 2);
  const userIdLabel = snapshotData.userId ? createUserIdLabel(snapshotData.userId) : null;

  try {
    let issue;

    if (existingIssueNumber) {
      // Update existing snapshot
      const { data: updatedIssue } = await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: existingIssueNumber,
        title: issueTitle,
        body: issueBody,
      });

      // Add user ID label if missing
      if (userIdLabel) {
        try {
          await octokit.rest.issues.addLabels({
            owner,
            repo,
            issue_number: existingIssueNumber,
            labels: [userIdLabel],
          });
        } catch (err) {
          console.warn('[github-bot] Failed to add user-id label:', err.message);
        }
      }

      issue = updatedIssue;
      logger.debug(`Updated user snapshot #${existingIssueNumber} for ${username}`);
    } else {
      // Create new snapshot
      const labels = ['user-snapshot', 'automated'];
      if (userIdLabel) {
        labels.push(userIdLabel);
      }

      const { data: newIssue } = await octokit.rest.issues.create({
        owner,
        repo,
        title: issueTitle,
        body: issueBody,
        labels,
      });

      // Lock the issue to prevent unwanted comments
      try {
        await octokit.rest.issues.lock({
          owner,
          repo,
          issue_number: newIssue.number,
          lock_reason: 'off-topic',
        });
      } catch (lockError) {
        console.warn('[github-bot] Failed to lock user snapshot:', lockError.message);
      }

      issue = newIssue;
      logger.debug(`Created user snapshot #${newIssue.number} for ${username}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        issue: {
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          body: issue.body,
          labels: issue.labels,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          state: issue.state,
        },
      }),
    };
  } catch (error) {
    console.error('[github-bot] Failed to save user snapshot:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to save user snapshot: ' + error.message }),
    };
  }
}

/**
 * Helper: Hash IP address for privacy
 */
async function hashIP(ip) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Helper: Get client IP address from request
 */
function getClientIP(event) {
  // Try multiple headers in order of preference
  return (
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['x-real-ip'] ||
    event.headers['client-ip'] ||
    'unknown'
  );
}

/**
 * Helper: Generate verification code
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Helper: Create verification token (JWT)
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {string} email - Email address
 */
async function createVerificationToken(adapter, email) {
  const secret = adapter.getEnv('EMAIL_VERIFICATION_SECRET');
  if (!secret) {
    throw new Error('EMAIL_VERIFICATION_SECRET not configured');
  }

  return await jwt.sign(
    {
      email,
      timestamp: Date.now(),
      type: 'email-verification'
    },
    secret,
    86400 // 24 hours in seconds
  );
}

/**
 * Helper: Verify verification token
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {string} token - JWT token
 */
async function verifyVerificationToken(adapter, token) {
  const secret = adapter.getEnv('EMAIL_VERIFICATION_SECRET');
  if (!secret) {
    throw new Error('EMAIL_VERIFICATION_SECRET not configured');
  }

  try {
    const decoded = await jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    console.error('[github-bot] Token verification failed:', error.message);
    return null;
  }
}

/**
 * Send verification email
 * Required: email
 */
async function handleSendVerificationEmail(adapter, configAdapter, cryptoAdapter, octokit, { owner, repo, email }) {
  if (!email) {
    return adapter.createJsonResponse(400, { error: 'Missing required field: email' });
  }

  // Validate email format and length
  const emailResult = validateEmail(email);
  if (!emailResult.valid) {
    return adapter.createJsonResponse(400, { error: emailResult.error });
  }

  // Check SendGrid configuration
  const sendGridKey = adapter.getEnv("SENDGRID_API_KEY");
  const fromEmail = adapter.getEnv("SENDGRID_FROM_EMAIL");
  if (!sendGridKey || !fromEmail) {
    console.error('[github-bot] SendGrid not configured');
    return adapter.createJsonResponse(503, { error: 'Email service not configured' });
  }

  try {
    // Generate verification code
    const code = generateVerificationCode();
    const timestamp = Date.now();
    const expiresAt = timestamp + 10 * 60 * 1000; // 10 minutes

    // Hash email for privacy
    const emailHash = await hashIP(email);

    // Encrypt verification code before storing
    const secret = adapter.getEnv("EMAIL_VERIFICATION_SECRET");
    if (!secret) {
      throw new Error('EMAIL_VERIFICATION_SECRET not configured');
    }
    const encryptedCode = await cryptoAdapter.encrypt(code, secret);

    // Create storage adapter
    const botToken = adapter.getEnv("WIKI_BOT_TOKEN");
    if (!botToken) {
      throw new Error('WIKI_BOT_TOKEN not configured');
    }

    const wikiConfig = configAdapter.getWikiConfig();
    const storageConfig = wikiConfig.storage || {
      backend: 'github',
      version: 'v1',
      github: { owner, repo },
    };

    const storage = StorageFactory.create(
      storageConfig,
      {
        WIKI_BOT_TOKEN: botToken,
        SLAYER_WIKI_DATA: adapter.getEnv("SLAYER_WIKI_DATA"), // KV namespace (if available)
      }
    );

    // Store verification code using storage abstraction
    await storage.storeVerificationCode(emailHash, encryptedCode, expiresAt);

    logger.debug(`Stored verification code for emailHash: ${emailHash.substring(0, 8)}...`);

    // Send email with SendGrid
    // Add [TEST] prefix in development mode
    const isDev = adapter.getEnv("NODE_ENV") === 'development';
    const subjectPrefix = isDev ? '[TEST] ' : '';

    const emailResult = await sendEmail({
      apiKey: sendGridKey,
      to: email,
      from: fromEmail,
      subject: `${subjectPrefix}Verify your email - Slayer Legend Wiki`,
      text: generateVerificationEmailText(code),
      html: generateVerificationEmail(code),
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send email');
    }

    logger.debug(`Verification email sent to ${email}`);

    return adapter.createJsonResponse(200, {
      message: 'Verification code sent',
    });
  } catch (error) {
    console.error('[github-bot] Failed to send verification email:', error);
    return adapter.createJsonResponse(500, { error: 'Failed to send verification email' });
  }
}

/**
 * Verify email code and return verification token
 * Required: email, code
 */
async function handleVerifyEmail(adapter, configAdapter, cryptoAdapter, octokit, { owner, repo, email, code }) {
  logger.debug('handleVerifyEmail called:', { owner, repo, email: email ? '***' : undefined, code: code ? '***' : undefined });

  if (!email || !code) {
    logger.debug('Missing email or code');
    return adapter.createJsonResponse(400, { error: "Missing required fields: email, code" });
  }

  try {
    // Hash email
    const emailHash = await hashIP(email);

    // Create storage adapter
    const botToken = adapter.getEnv("WIKI_BOT_TOKEN");
    if (!botToken) {
      throw new Error('WIKI_BOT_TOKEN not configured');
    }

    const wikiConfig = configAdapter.getWikiConfig();
    const storageConfig = wikiConfig.storage || {
      backend: 'github',
      version: 'v1',
      github: { owner, repo },
    };

    const storage = StorageFactory.create(
      storageConfig,
      {
        WIKI_BOT_TOKEN: botToken,
        SLAYER_WIKI_DATA: adapter.getEnv("SLAYER_WIKI_DATA"), // KV namespace (if available)
      }
    );

    // Get verification code from storage
    const storedData = await storage.getVerificationCode(emailHash);

    if (!storedData) {
      logger.debug('No matching verification code found or expired');
      return adapter.createJsonResponse(
        404, {
        error: 'Verification code not found or expired'
      });
    }

    logger.debug('Found verification code for email hash');

    // Decrypt and verify code
    const secret = adapter.getEnv("EMAIL_VERIFICATION_SECRET");
    if (!secret) {
      throw new Error('EMAIL_VERIFICATION_SECRET not configured');
    }

    let decryptedCode;
    try {
      decryptedCode = await cryptoAdapter.decrypt(storedData.code, secret);
    } catch (decryptError) {
      console.error('[github-bot] Failed to decrypt verification code:', decryptError.message);
      return adapter.createJsonResponse(
        500, {
        error: 'Verification failed'
      });
    }

    if (decryptedCode !== code) {
      logger.debug('Invalid verification code');
      return adapter.createJsonResponse(
        403, {
        error: 'Invalid verification code'
      });
    }

    // Delete the verification code after successful verification
    logger.debug('Verification successful, deleting code');
    await storage.deleteVerificationCode(emailHash);

    // Generate verification token
    const token = await createVerificationToken(adapter, email);

    logger.debug(`Email verified: ${email}`);

    return adapter.createJsonResponse(
      200, {
        verified: true,
        token,
      }
    );
  } catch (error) {
    console.error('[github-bot] Email verification failed:', error);
    return adapter.createJsonResponse(
      500, {
      error: 'Verification failed'
    });
  }
}

// In-memory rate limiting storage (for Netlify)
// Note: This resets on function cold starts. For production, use Netlify Blobs or external storage.
const rateLimitStore = new Map();

/**
 * Check rate limit for IP address
 * Required: (IP extracted from adapter)
 */
async function handleCheckRateLimit(adapter, { maxEdits = 5, windowMinutes = 60 }) {
  const clientIP = adapter.getClientIP();
  const ipHash = await hashIP(clientIP);

  const windowMs = windowMinutes * 60 * 1000;
  const now = Date.now();

  // Get existing submissions
  let submissions = rateLimitStore.get(ipHash) || [];

  // Filter to submissions within window
  submissions = submissions.filter(timestamp => now - timestamp < windowMs);

  // Check if limit exceeded
  if (submissions.length >= maxEdits) {
    const oldestSubmission = submissions[0];
    const remainingMs = windowMs - (now - oldestSubmission);

    return adapter.createJsonResponse(429, {
      allowed: false,
      remainingMs,
      message: `Rate limit exceeded. Please try again in ${Math.ceil(remainingMs / 1000 / 60)} minutes.`,
    });
  }

  return adapter.createJsonResponse(200, {
    allowed: true,
    remaining: maxEdits - submissions.length,
  });
}

/**
 * Record a submission for rate limiting
 */
async function recordSubmission(adapter) {
  const clientIP = adapter.getClientIP();
  const ipHash = await hashIP(clientIP);

  let submissions = rateLimitStore.get(ipHash) || [];
  submissions.push(Date.now());

  // Keep only last 10 submissions
  if (submissions.length > 10) {
    submissions = submissions.slice(-10);
  }

  rateLimitStore.set(ipHash, submissions);
}

/**
 * Validate reCAPTCHA token
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {string} token - reCAPTCHA token
 * @param {string} ip - Client IP address
 */
async function validateRecaptcha(adapter, token, ip) {
  const secret = adapter.getEnv('RECAPTCHA_SECRET_KEY');
  if (!secret) {
    throw new Error('RECAPTCHA_SECRET_KEY not configured');
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: ip,
    }),
  });

  const result = await response.json();

  if (!result.success) {
    console.error('[github-bot] reCAPTCHA validation failed:', result['error-codes']);
    return { valid: false, score: 0 };
  }

  return { valid: true, score: result.score || 1.0 };
}

/**
 * Create anonymous PR
 * Required: owner, repo, section, pageId, pageTitle, content, email, displayName, verificationToken, captchaToken
 * Optional: reason, consentToLinkEmail
 */
async function handleCreateAnonymousPR(adapter, configAdapter, cryptoAdapter, octokit, {
  owner, repo, section, pageId, pageTitle,
  content, email, displayName, reason = '',
  verificationToken, captchaToken, consentToLinkEmail = false
}) {
  // Validate required fields
  if (!owner || !repo || !section || !pageId || !pageTitle || !content || !email || !displayName || !verificationToken || !captchaToken) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields' });
  }

  logger.debug('Starting anonymous PR creation for:', { email, displayName, section, pageId });

  try {
    // Validate all inputs BEFORE any processing
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: emailResult.error });
    }

    const displayNameResult = validateDisplayName(displayName);
    if (!displayNameResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: displayNameResult.error });
    }

    const reasonResult = validateEditReason(reason);
    if (!reasonResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: reasonResult.error });
    }

    const contentResult = validatePageContent(content);
    if (!contentResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: contentResult.error });
    }

    const titleResult = validatePageTitle(pageTitle);
    if (!titleResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: titleResult.error });
    }

    const pageIdResult = validatePageId(pageId);
    if (!pageIdResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: pageIdResult.error });
    }

    const sectionResult = validateSectionName(section);
    if (!sectionResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: sectionResult.error });
    }

    // Use sanitized values from validation
    displayName = displayNameResult.sanitized;
    reason = reasonResult.sanitized;

    // 1. Verify email verification token
    const decoded = await verifyVerificationToken(adapter, verificationToken);
    if (!decoded || decoded.email !== email) {
      return adapter.createJsonResponse(403, { error: 'Email verification expired or invalid' });
    }

    // 2. Validate reCAPTCHA
    const clientIP = adapter.getClientIP();
    const captchaResult = await validateRecaptcha(adapter, captchaToken, clientIP);

    if (!captchaResult.valid || captchaResult.score < 0.5) {
      return adapter.createJsonResponse(
        403, {
        error: 'CAPTCHA validation failed', score: captchaResult.score
      });
    }

    // 3. Check rate limit
    const rateCheck = await handleCheckRateLimit(adapter, { maxEdits: 5, windowMinutes: 60 });
    if (rateCheck.statusCode === 429) {
      return rateCheck;
    }

    // 4. Check display name for profanity
    logger.debug('Checking display name for profanity:', displayName);
    const profanityCheck = await checkProfanity(adapter, displayName);
    logger.debug('Profanity check result:', profanityCheck);

    if (profanityCheck.containsProfanity) {
      logger.debug(`Display name rejected due to profanity (method: ${profanityCheck.method}):`, displayName);
      return adapter.createJsonResponse(400, {
        error: 'Display name contains inappropriate language. Please choose a respectful name.'
      });
    }

    logger.debug('Display name passed profanity check');

    // 5b. Check reason for profanity (if provided)
    if (reason && reason.length > 0) {
      logger.debug('Checking reason for profanity:', reason);
      const reasonProfanityCheck = await checkProfanity(adapter, reason);
      logger.debug('Reason profanity check result:', reasonProfanityCheck);

      if (reasonProfanityCheck.containsProfanity) {
        logger.debug(`Reason rejected due to profanity (method: ${reasonProfanityCheck.method}):`, reason);
        return adapter.createJsonResponse(400, {
          error: 'Edit reason contains inappropriate language. Please provide a respectful explanation.'
        });
      }

      logger.debug('Reason passed profanity check');
    }

    // 5c. Check page content for profanity
    logger.debug('Checking page content for profanity (length:', content.length, ')');
    // Only check first 5000 chars to avoid overwhelming the API
    const contentSample = content.substring(0, 5000);
    const contentProfanityCheck = await checkProfanity(adapter, contentSample);
    logger.debug('Content profanity check result:', contentProfanityCheck);

    if (contentProfanityCheck.containsProfanity) {
      logger.debug(`Content rejected due to profanity (method: ${contentProfanityCheck.method})`);
      return adapter.createJsonResponse(400, {
          error: 'Page content contains inappropriate language. Please remove offensive content and try again.'
        });
      
    }

    logger.debug('Content passed profanity check');

    // 6. Create branch
    const timestamp = Date.now();
    const branchName = `anon-edit/${section}/${pageId}/${timestamp}`;

    // Get main branch SHA
    const { data: mainBranch } = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: 'main',
    });

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: mainBranch.commit.sha,
    });

    // 7. Commit file
    const filePath = `public/content/${section}/${pageId}.md`;

    // Hash email BEFORE masking for tracking purposes
    const emailHash = await hashIP(email);

    // Use maximum hash length that fits in label if consent given (50 char limit - 4 char prefix = 46 chars)
    // Use truncated hash if no consent (16 chars for basic tracking)
    const LABEL_MAX_HASH_LENGTH = 46; // Max hash chars that fit in GitHub label (50 - len('ref:'))
    const emailLabelHash = consentToLinkEmail
      ? emailHash.substring(0, LABEL_MAX_HASH_LENGTH)
      : emailHash.substring(0, 16);

    // Then mask email for display
    const maskedEmail = maskEmail(email);
    const commitMessage = `Update ${pageTitle}

Anonymous contribution by: ${displayName}
Email: ${maskedEmail} (verified ✓)
${reason ? `Reason: ${reason}` : ''}

Submitted: ${new Date(timestamp).toISOString()}

🤖 Generated with [Anonymous Wiki Editor](https://slayerlegend.wiki)

Co-Authored-By: Wiki Bot <bot@slayerlegend.wiki>`;

    // Check if file exists on main branch to get its sha
    let fileSha;
    try {
      const { data: existingFile } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: 'main',
      });
      fileSha = existingFile.sha;
      logger.debug('File exists on main, using sha:', fileSha);
    } catch (error) {
      // File doesn't exist, that's fine (new page)
      logger.debug('File does not exist on main (new page)');
      fileSha = undefined;
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch: branchName,
      ...(fileSha && { sha: fileSha }), // Include sha if updating existing file
    });

    // 8. Create PR
    const prBody = `## Anonymous Edit Submission

**Submitted by:** ${displayName}
**Email:** ${maskedEmail} (verified ✓)
${reason ? `**Reason:** ${reason}` : ''}
**Timestamp:** ${new Date(timestamp).toISOString()}
**reCAPTCHA Score:** ${captchaResult.score.toFixed(2)}

---

*This edit was submitted anonymously via the wiki editor.*
*The submitter's email address has been verified.*
*Automated submission by wiki bot.*`;

    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: `[Anonymous] Update ${pageTitle}`,
      body: prBody,
      head: branchName,
      base: 'main',
    });

    // 9. Add labels (including display name and email hash for easy identification)
    const labels = [
      'anonymous-edit',
      'needs-review',
      section,
      createNameLabel(displayName), // Store display name as label for easy access
      createEmailLabel(emailLabelHash, consentToLinkEmail ? LABEL_MAX_HASH_LENGTH : 16), // Store max hash if consent, truncated otherwise
    ];

    // Add 'linkable' label if consent was given
    if (consentToLinkEmail) {
      labels.push('linkable');
    }

    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels,
    });

    // 10. Record submission for rate limiting
    await recordSubmission(adapter);

    logger.debug(`Anonymous PR created: #${pr.number} by ${displayName} (${email})`);

    return adapter.createJsonResponse(200, {

        success: true,
        pr: {
          number: pr.number,
          url: pr.html_url,
          branch: branchName,
        },
    });
  } catch (error) {
    console.error('[github-bot] Failed to create anonymous PR:', error);
    return adapter.createJsonResponse(500, { error: error.message || 'Failed to create pull request' });
  }
}

/**
 * Link anonymous edits to user account
 * Authenticates user via OAuth token and validates identity
 * Required: owner, repo
 * Optional: manual (boolean) - If true, enforces cooldown check
 * Required Header: Authorization: Bearer {token}
 */
async function handleLinkAnonymousEdits(adapter, octokit, { owner, repo, manual = false }, headers) {
  if (!owner || !repo) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo' });
  }

  // Extract and validate Authorization header
  const authHeader = headers?.authorization || headers?.Authorization;
  if (!authHeader) {
    return adapter.createJsonResponse(401, { error: 'Missing Authorization header' });
  }

  // Validate Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    return adapter.createJsonResponse(401, { error: 'Invalid Authorization header format. Use "Bearer {token}"' });
  }

  const userToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // 1. Validate token and fetch authenticated user from GitHub
    logger.info('Validating user token for anonymous edit linking', { manual });

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${userToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SlayerLegend-Wiki/1.0',
      },
    });

    if (!userResponse.ok) {
      logger.error('Token validation failed', { status: userResponse.status });
      return adapter.createJsonResponse(401, { error: 'Invalid or expired token' });
    }

    const userData = await userResponse.json();
    const userId = userData.id;
    const username = userData.login;
    let userEmail = userData.email;

    // 2. If email is null (private setting), fetch from /user/emails
    if (!userEmail) {
      try {
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `token ${userToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'SlayerLegend-Wiki/1.0',
          },
        });

        if (emailsResponse.ok) {
          const emails = await emailsResponse.json();
          const primaryEmail = emails.find(e => e.primary && e.verified);
          if (primaryEmail) {
            userEmail = primaryEmail.email;
          }
        }
      } catch (emailError) {
        logger.warn('Failed to fetch user emails', { error: emailError.message });
      }
    }

    if (!userEmail) {
      logger.info('User has no email, cannot link', { userId, username });
      return adapter.createJsonResponse(400, {
        error: 'No verified email found. Please add a verified email to your GitHub account.',
        linked: false,
        reason: 'no_email'
      });
    }

    logger.info('User authenticated for linking', { userId, username });

    // 3. Hash email server-side (don't trust client)
    const emailHash = await hashIP(userEmail); // Reuse existing hash function

    // 4. Check cooldown if this is a manual trigger
    if (manual) {
      const { checkLinkingCooldown } = await import('github-wiki-framework/src/services/github/emailUserMapping.js');
      const cooldownCheck = await checkLinkingCooldown(octokit, owner, repo, emailHash, 60); // 60 minute cooldown

      if (!cooldownCheck.allowed) {
        logger.warn('Link request denied - cooldown active', {
          userId,
          username,
          remainingSeconds: cooldownCheck.remainingSeconds
        });

        const remainingMinutes = Math.ceil(cooldownCheck.remainingSeconds / 60);
        return adapter.createJsonResponse(429, {
          error: `Please wait ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} before trying again`,
          cooldown: cooldownCheck.remainingSeconds,
          lastLinkedAt: cooldownCheck.lastLinkedAt
        });
      }

      logger.info('Cooldown check passed', { userId, username });
    }

    // 4. Find linkable PRs with hash label + 'linkable' flag
    // Note: Labels are limited to 50 chars, so we can only match first 46 chars of hash (50 - len('ref:'))
    const LABEL_MAX_HASH_LENGTH = 46;
    const truncatedHash = emailHash.substring(0, LABEL_MAX_HASH_LENGTH);

    const { data: allPRs } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'all',
      per_page: 100,
    });

    const linkablePRs = allPRs.filter(pr => {
      const labelNames = pr.labels.map(l => l.name);
      const hasRefHash = labelNames.some(name => name === `ref:${truncatedHash}`);
      const hasLinkableFlag = labelNames.includes('linkable');
      return hasRefHash && hasLinkableFlag;
    });

    logger.debug('Found linkable PRs', { count: linkablePRs.length });

    if (linkablePRs.length === 0) {
      return adapter.createJsonResponse(200, {
        linked: true,
        linkedCount: 0,
        message: 'No linkable anonymous edits found',
      });
    }

    // 2. Add user-id label to each PR (enables efficient queries)
    const userIdLabel = `user-id:${userId}`;
    for (const pr of linkablePRs) {
      try {
        await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: pr.number,
          labels: [userIdLabel],
        });
        logger.debug('Added user-id label', { prNumber: pr.number, userId });
      } catch (error) {
        logger.error('Failed to add label', { error, prNumber: pr.number });
      }
    }

    // 3. Store mapping (for future O(1) lookups)
    // Dynamically import the mapping service
    const { addEmailUserMapping } = await import('github-wiki-framework/src/services/github/emailUserMapping.js');
    await addEmailUserMapping(octokit, owner, repo, emailHash, userId, username, manual); // Update lastLinkedAt if manual=true

    logger.info('Linking completed successfully', { userId, linkedCount: linkablePRs.length });

    return adapter.createJsonResponse(200, {
      linked: true,
      linkedCount: linkablePRs.length,
      prNumbers: linkablePRs.map(pr => pr.number),
    });
  } catch (error) {
    logger.error('Failed to link anonymous edits', { error, userId });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Check achievements for authenticated user (SERVER-SIDE)
 * All data retrieval and processing happens on the server
 * Required: owner, repo
 * Required Header: Authorization: Bearer {token}
 */
async function handleCheckAchievements(adapter, octokit, { owner, repo }, headers) {
  console.log('[CF] handleCheckAchievements called', {
    owner,
    repo,
    hasHeaders: !!headers,
    authHeader: headers?.authorization ? 'present' : 'missing',
    NODE_ENV: process.env.NODE_ENV,
    CONTEXT: process.env.CONTEXT
  });

  logger.info('handleCheckAchievements called', {
    owner,
    repo,
    hasHeaders: !!headers,
    authHeader: headers?.authorization ? 'present' : 'missing',
    NODE_ENV: process.env.NODE_ENV,
    CONTEXT: process.env.CONTEXT
  });

  if (!owner || !repo) {
    console.error('[CF] Missing owner or repo', { owner, repo });
    logger.error('Missing owner or repo', { owner, repo });
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo' });
  }

  // Extract and validate Authorization header
  const authHeader = headers?.authorization || headers?.Authorization;
  if (!authHeader) {
    console.error('[CF] Missing Authorization header');
    logger.error('Missing Authorization header');
    return adapter.createJsonResponse(401, { error: 'Missing Authorization header' });
  }

  // Validate Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    console.error('[CF] Invalid Authorization header format', {
      authType: authHeader?.substring(0, 10)
    });
    logger.error('Invalid Authorization header format', {
      authType: authHeader?.substring(0, 10)
    });
    return adapter.createJsonResponse(401, { error: 'Invalid Authorization header format. Use "Bearer {token}"' });
  }

  const userToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // 1. Validate token and fetch authenticated user
    logger.debug('Validating user token for achievement checking', {
      tokenLength: userToken?.length || 0,
      tokenPrefix: userToken?.substring(0, 4) || 'none'
    });

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${userToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SlayerLegend-Wiki/1.0',
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      logger.error('Token validation failed', {
        status: userResponse.status,
        statusText: userResponse.statusText,
        error: errorText
      });
      return adapter.createJsonResponse(401, { error: 'Invalid or expired token' });
    }

    const userData = await userResponse.json();
    const userId = userData.id;
    const username = userData.login;

    console.log('[CF] Checking achievements server-side', { userId, username });
    logger.info('Checking achievements server-side', { userId, username });

    // 2. Load wiki config to get base URL
    let wikiConfig;
    let baseUrl;

    // Detect platform to determine if we have filesystem access
    // Netlify Functions: Have filesystem access (Node.js)
    // Cloudflare Workers: No filesystem, must fetch via HTTP
    const platform = adapter.getPlatform();
    const hasFilesystemAccess = platform === 'netlify';

    console.log('[CF] Environment check', {
      platform,
      hasFilesystemAccess,
      NODE_ENV: process.env.NODE_ENV,
      CONTEXT: process.env.CONTEXT
    });

    // In Netlify (with filesystem), load from local filesystem
    if (hasFilesystemAccess) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const configPath = path.join(process.cwd(), 'public', 'wiki-config.json');
        const configContent = fs.readFileSync(configPath, 'utf8');
        wikiConfig = JSON.parse(configContent);
        baseUrl = wikiConfig.wiki?.url || 'http://localhost:8888';
        logger.debug('Loaded wiki config from local filesystem', { baseUrl });
      } catch (error) {
        logger.warn('Failed to load wiki config, using localhost', { error: error.message });
        baseUrl = 'http://localhost:8888';
      }
    } else {
      // In production, determine base URL from environment/headers, then fetch config
      let envBaseUrl = null;
      try {
        // Try to get the host from the request headers or environment
        const cfPagesUrl = adapter.getEnv('CF_PAGES_URL');
        const urlEnv = adapter.getEnv('URL');
        const hostHeader = headers?.host;

        logger.info('Determining base URL from environment', {
          CF_PAGES_URL: cfPagesUrl,
          URL: urlEnv,
          host: hostHeader
        });

        const host = cfPagesUrl || urlEnv || hostHeader;
        if (host) {
          envBaseUrl = host.startsWith('http') ? host : `https://${host}`;
          logger.info('Using environment-derived base URL', { envBaseUrl });
        } else {
          logger.info('No environment base URL found, will load from config');
        }
      } catch (e) {
        logger.warn('Error determining base URL from environment', { error: e.message });
      }

      // Fetch wiki config to get the configured URL as fallback
      try {
        const configUrl = envBaseUrl ? `${envBaseUrl}/wiki-config.json` : 'https://slayerlegend.wiki/wiki-config.json';
        logger.info('Fetching wiki config', { configUrl });

        const configResponse = await fetch(configUrl);
        if (configResponse.ok) {
          wikiConfig = await configResponse.json();
          // Use environment baseUrl if available, otherwise use config URL
          baseUrl = envBaseUrl || wikiConfig.wiki?.url || 'https://slayerlegend.wiki';
          logger.info('Loaded wiki config from deployed site', {
            baseUrl,
            configUrl: wikiConfig.wiki?.url,
            usingEnv: !!envBaseUrl
          });
        } else {
          logger.warn('Failed to fetch wiki config, using fallback', {
            configUrl,
            status: configResponse.status,
            statusText: configResponse.statusText
          });
          baseUrl = envBaseUrl || 'https://slayerlegend.wiki';
        }
      } catch (e) {
        logger.warn('Could not load wiki config, using fallback', { error: e.message });
        baseUrl = envBaseUrl || 'https://slayerlegend.wiki';
      }

      console.log('[CF] Final base URL determined', { baseUrl });
      logger.info('Final base URL determined', { baseUrl });
    }

    // 3. Load achievement definitions from public/achievements.json
    let definitions;

    // In Netlify (with filesystem), load from local filesystem
    if (hasFilesystemAccess) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const achievementsPath = path.join(process.cwd(), 'public', 'achievements.json');
        const achievementsContent = fs.readFileSync(achievementsPath, 'utf8');
        definitions = JSON.parse(achievementsContent);
        logger.debug('Loaded achievement definitions from local filesystem');
      } catch (error) {
        logger.error('Failed to load achievement definitions from filesystem', { error: error.message });
        throw new Error('Failed to load achievement definitions');
      }
    } else {
      // In production, fetch from the deployed site
      const achievementsUrl = `${baseUrl}/achievements.json`;
      console.log('[CF] Fetching achievement definitions from deployed site', { url: achievementsUrl, baseUrl });
      logger.info('Fetching achievement definitions from deployed site', { url: achievementsUrl, baseUrl });

      try {
        const achievementDefsResponse = await fetch(achievementsUrl);
        if (!achievementDefsResponse.ok) {
          const errorText = await achievementDefsResponse.text().catch(() => 'Unable to read error body');
          console.error('[CF] Failed to fetch achievement definitions - HTTP error', {
            url: achievementsUrl,
            baseUrl,
            status: achievementDefsResponse.status,
            statusText: achievementDefsResponse.statusText,
            errorBody: errorText,
          });
          logger.error('Failed to fetch achievement definitions - HTTP error', {
            url: achievementsUrl,
            baseUrl,
            status: achievementDefsResponse.status,
            statusText: achievementDefsResponse.statusText,
            errorBody: errorText,
          });
          throw new Error(`Failed to load achievement definitions: ${achievementDefsResponse.status} ${achievementDefsResponse.statusText}`);
        }
        definitions = await achievementDefsResponse.json();
        console.log('[CF] Successfully loaded achievement definitions from deployed site', { count: definitions.achievements?.length });
        logger.info('Successfully loaded achievement definitions from deployed site', { count: definitions.achievements?.length });
      } catch (fetchError) {
        console.error('[CF] Failed to fetch achievement definitions - network/parse error', {
          url: achievementsUrl,
          baseUrl,
          error: fetchError.message,
          stack: fetchError.stack,
        });
        logger.error('Failed to fetch achievement definitions - network/parse error', {
          url: achievementsUrl,
          baseUrl,
          error: fetchError.message,
          stack: fetchError.stack,
        });
        throw new Error(`Failed to load achievement definitions: ${fetchError.message}`);
      }
    }

    // 4. Get release date from environment variable (VITE_RELEASE_DATE)
    let releaseDate = null;
    const releaseDateStr = process.env.VITE_RELEASE_DATE;
    if (releaseDateStr && releaseDateStr.trim() !== '') {
      try {
        releaseDate = new Date(releaseDateStr);
        if (isNaN(releaseDate.getTime())) {
          logger.warn('Invalid VITE_RELEASE_DATE format', { value: releaseDateStr });
          releaseDate = null;
        } else {
          logger.debug('Using release date from VITE_RELEASE_DATE', { releaseDate: releaseDate.toISOString() });
        }
      } catch (error) {
        logger.warn('Failed to parse VITE_RELEASE_DATE', { error: error.message });
        releaseDate = null;
      }
    }

    // 5. Fetch user snapshot from GitHub Issues
    const userIdLabel = `user-id:${userId}`;
    const { data: snapshotIssues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: `user-snapshot,${userIdLabel}`,
      state: 'open',
      per_page: 1,
    });

    let userSnapshot = null;
    if (snapshotIssues.length > 0) {
      try {
        userSnapshot = JSON.parse(snapshotIssues[0].body);
      } catch (error) {
        logger.error('Failed to parse user snapshot', { error });
      }
    }

    // If no snapshot, use minimal data
    if (!userSnapshot) {
      userSnapshot = {
        userId,
        user: userData,
        stats: { totalPRs: 0, mergedPRs: 0, totalAdditions: 0, closedPRs: 0, totalFiles: 0 },
        pullRequests: [],
      };
    }

    // Filter PRs and recalculate stats based on release date
    if (releaseDate && userSnapshot.pullRequests) {
      const filteredPRs = userSnapshot.pullRequests.filter(pr => {
        if (!pr.created_at) return false;
        const prDate = new Date(pr.created_at);
        return prDate >= releaseDate;
      });

      // Recalculate stats from filtered PRs
      userSnapshot.pullRequests = filteredPRs;
      userSnapshot.stats = {
        totalPRs: filteredPRs.length,
        mergedPRs: filteredPRs.filter(pr => pr.merged_at).length,
        closedPRs: filteredPRs.filter(pr => pr.state === 'closed' && !pr.merged_at).length,
        totalAdditions: filteredPRs.reduce((sum, pr) => sum + (pr.additions || 0), 0),
        totalDeletions: filteredPRs.reduce((sum, pr) => sum + (pr.deletions || 0), 0),
        totalFiles: new Set(filteredPRs.flatMap(pr => (pr.files || []).map(f => f.filename))).size,
      };

      logger.debug('Filtered PRs by release date', {
        original: userSnapshot.pullRequests?.length || 0,
        filtered: filteredPRs.length,
        releaseDate: releaseDate.toISOString(),
      });
    }

    // 6. Get existing achievements
    const { data: achievementIssues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: `achievements,${userIdLabel}`,
      state: 'open',
      per_page: 1,
    });

    let existingAchievements = [];
    let existingIssueNumber = null;
    if (achievementIssues.length > 0) {
      existingIssueNumber = achievementIssues[0].number;
      try {
        const existingData = JSON.parse(achievementIssues[0].body);
        existingAchievements = existingData.achievements || [];
      } catch (error) {
        logger.error('Failed to parse existing achievements', { error });
      }
    }

    const unlockedIds = new Set(existingAchievements.map(a => a.id));

    // 7. Run deciders server-side to check for new achievements
    const newlyUnlocked = [];

    for (const achievement of definitions.achievements) {
      if (unlockedIds.has(achievement.id)) continue;

      // Run decider logic server-side
      const isUnlocked = await runDecider(achievement.id, userSnapshot, {
        octokit,
        owner,
        repo,
        userId,
        username,
        releaseDate,
        baseUrl, // Pass baseUrl for deciders that need to fetch data files
      });

      if (isUnlocked) {
        newlyUnlocked.push({
          id: achievement.id,
          unlockedAt: new Date().toISOString(),
          progress: 100,
        });
      }
    }

    // 8. If new achievements found, save to GitHub Issues
    if (newlyUnlocked.length > 0) {
      const allAchievements = [...existingAchievements, ...newlyUnlocked];
      const issueData = {
        userId,
        username,
        lastUpdated: new Date().toISOString(),
        achievements: allAchievements,
        version: '1.0',
      };

      const body = JSON.stringify(issueData, null, 2);
      const title = `[Achievements] ${username}`;
      const labels = ['achievements', userIdLabel, 'automated'];

      if (existingIssueNumber) {
        // Update existing issue
        await octokit.rest.issues.update({
          owner,
          repo,
          issue_number: existingIssueNumber,
          body,
        });
        logger.info('Updated achievements', { username, newCount: newlyUnlocked.length });
      } else {
        // Double-check before creating (race condition prevention)
        // If multiple requests run simultaneously, one might have just created the issue
        const { data: recheckIssues } = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          labels: `achievements,${userIdLabel}`,
          state: 'open',
          per_page: 1,
        });

        if (recheckIssues.length > 0) {
          // Issue was just created by another request, update it instead
          await octokit.rest.issues.update({
            owner,
            repo,
            issue_number: recheckIssues[0].number,
            body,
          });
          logger.info('Updated achievements (race condition avoided)', { username, newCount: newlyUnlocked.length });
        } else {
          // Create new issue
          const { data: newIssue } = await octokit.rest.issues.create({
            owner,
            repo,
            title,
            body,
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
            logger.warn('Failed to lock achievement issue', { error: lockError.message });
          }

          logger.info('Created achievements', { username, count: newlyUnlocked.length });
        }
      }
    }

    return adapter.createJsonResponse(200, {
      checked: true,
      newlyUnlocked,
      totalAchievements: existingAchievements.length + newlyUnlocked.length,
    });
  } catch (error) {
    console.error('[CF] Failed to check achievements - caught error', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    logger.error('Failed to check achievements - caught error', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    return adapter.createJsonResponse(500, {
      error: error.message || 'Failed to check achievements',
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
}

/**
 * Check Single Achievement (SERVER-SIDE)
 * Targeted achievement check for immediate feedback
 * Required: owner, repo, achievementId
 * Required Header: Authorization: Bearer {token}
 */
async function handleCheckSingleAchievement(adapter, octokit, { owner, repo, achievementId }, headers) {
  console.log('[CF] handleCheckSingleAchievement called', {
    owner,
    repo,
    achievementId,
    hasHeaders: !!headers,
    authHeader: headers?.authorization ? 'present' : 'missing',
  });

  if (!owner || !repo || !achievementId) {
    console.error('[CF] Missing required fields', { owner, repo, achievementId });
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo, achievementId' });
  }

  // Extract and validate Authorization header
  const authHeader = headers?.authorization || headers?.Authorization;
  if (!authHeader) {
    console.error('[CF] Missing Authorization header');
    return adapter.createJsonResponse(401, { error: 'Missing Authorization header' });
  }

  // Validate Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    console.error('[CF] Invalid Authorization header format');
    return adapter.createJsonResponse(401, { error: 'Invalid Authorization header format. Use "Bearer {token}"' });
  }

  const userToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // 1. Validate token and fetch authenticated user
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${userToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SlayerLegend-Wiki/1.0',
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('[CF] Token validation failed', {
        status: userResponse.status,
        error: errorText
      });
      return adapter.createJsonResponse(401, { error: 'Invalid or expired token' });
    }

    const userData = await userResponse.json();
    const userId = userData.id;
    const username = userData.login;

    console.log('[CF] Checking single achievement', { userId, username, achievementId });

    // 2. Load achievement definition
    const platform = adapter.getPlatform();
    const hasFilesystemAccess = platform === 'netlify';
    let definitions;

    if (hasFilesystemAccess) {
      const fs = await import('fs');
      const path = await import('path');
      const achievementsPath = path.join(process.cwd(), 'public', 'achievements.json');
      const achievementsContent = fs.readFileSync(achievementsPath, 'utf8');
      definitions = JSON.parse(achievementsContent);
    } else {
      // Fetch from deployed site
      const host = adapter.getEnv('CF_PAGES_URL') || adapter.getEnv('URL') || headers?.host;
      const baseUrl = host ? (host.startsWith('http') ? host : `https://${host}`) : 'https://slayerlegend.wiki';
      const achievementsUrl = `${baseUrl}/achievements.json`;
      const response = await fetch(achievementsUrl);
      if (!response.ok) {
        throw new Error(`Failed to load achievements: ${response.status}`);
      }
      definitions = await response.json();
    }

    // Find the achievement definition
    const achievementDef = definitions.achievements.find(a => a.id === achievementId);
    if (!achievementDef) {
      console.warn('[CF] Achievement not found', { achievementId });
      return adapter.createJsonResponse(404, { error: `Achievement not found: ${achievementId}` });
    }

    // 3. Get user snapshot
    const userIdLabel = `user-id:${userId}`;
    const { data: snapshotIssues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: `user-snapshot,${userIdLabel}`,
      state: 'open',
      per_page: 1,
    });

    let userSnapshot = null;
    if (snapshotIssues.length > 0) {
      try {
        userSnapshot = JSON.parse(snapshotIssues[0].body);
      } catch (error) {
        console.error('[CF] Failed to parse user snapshot', error);
      }
    }

    // If no snapshot, use minimal data
    if (!userSnapshot) {
      userSnapshot = {
        userId,
        user: userData,
        stats: { totalPRs: 0, mergedPRs: 0, totalAdditions: 0, closedPRs: 0, totalFiles: 0 },
        pullRequests: [],
      };
    }

    // 4. Check if already unlocked
    const { data: achievementIssues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: `achievements,${userIdLabel}`,
      state: 'open',
      per_page: 1,
    });

    let existingAchievements = [];
    let existingIssueNumber = null;

    if (achievementIssues.length > 0) {
      existingIssueNumber = achievementIssues[0].number;
      try {
        const data = JSON.parse(achievementIssues[0].body);
        existingAchievements = data.achievements || [];
      } catch (error) {
        console.error('[CF] Failed to parse achievements', error);
      }
    }

    // Check if already unlocked
    const alreadyUnlocked = existingAchievements.some(a => a.id === achievementId);
    if (alreadyUnlocked) {
      console.log('[CF] Achievement already unlocked', { achievementId });
      return adapter.createJsonResponse(200, {
        unlocked: false,
        alreadyHas: true,
        message: 'Achievement already unlocked'
      });
    }

    // 5. Run the decider
    const platform2 = adapter.getPlatform();
    const hasFilesystemAccess2 = platform2 === 'netlify';
    let baseUrl = 'https://slayerlegend.wiki';

    if (!hasFilesystemAccess2) {
      const host = adapter.getEnv('CF_PAGES_URL') || adapter.getEnv('URL') || headers?.host;
      if (host) {
        baseUrl = host.startsWith('http') ? host : `https://${host}`;
      }
    }

    const isUnlocked = await runDecider(achievementId, userSnapshot, {
      octokit,
      owner,
      repo,
      userId,
      username,
      releaseDate: null, // TODO: get from env if needed
      baseUrl,
    });

    if (!isUnlocked) {
      console.log('[CF] Achievement not yet unlocked', { achievementId });
      return adapter.createJsonResponse(200, {
        unlocked: false,
        message: 'Achievement requirements not met'
      });
    }

    // 6. Save the achievement
    const newAchievement = {
      id: achievementId,
      unlockedAt: new Date().toISOString(),
      progress: 100,
    };

    const allAchievements = [...existingAchievements, newAchievement];
    const issueData = {
      userId,
      username,
      lastUpdated: new Date().toISOString(),
      achievements: allAchievements,
      version: '1.0',
    };

    const body = JSON.stringify(issueData, null, 2);
    const title = `[Achievements] ${username}`;
    const labels = ['achievements', userIdLabel, 'automated'];

    if (existingIssueNumber) {
      await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: existingIssueNumber,
        body,
      });
      console.log('[CF] Updated achievements', { username, achievementId });
    } else {
      const { data: newIssue } = await octokit.rest.issues.create({
        owner,
        repo,
        title,
        body,
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
        logger.warn('Failed to lock achievement issue', { error: lockError.message });
      }

      console.log('[CF] Created achievements', { username, achievementId });
    }

    // Return the full achievement data for client
    return adapter.createJsonResponse(200, {
      unlocked: true,
      achievement: {
        ...achievementDef,
        ...newAchievement,
      }
    });

  } catch (error) {
    console.error('[CF] Failed to check single achievement', {
      error: error.message,
      stack: error.stack,
    });
    return adapter.createJsonResponse(500, {
      error: error.message || 'Failed to check achievement'
    });
  }
}

/**
 * Run achievement decider logic server-side
 * Uses plugin-based decider registry (framework defaults + custom)
 */
async function runDecider(achievementId, userData, context) {
  try {
    // Load deciders from registry
    const deciders = await loadAchievementDeciders();

    // Get decider function for this achievement
    const deciderFn = deciders[achievementId];

    if (!deciderFn) {
      logger.warn('No decider found for achievement', { achievementId });
      return false;
    }

    // Run the decider
    return await deciderFn(userData, context);
  } catch (error) {
    logger.error('Decider execution failed', { achievementId, error: error.message });
    return false;
  }
}

// ============================================================================
// Content Creator Handler Functions
// ============================================================================

const CREATOR_INDEX_LABEL = 'content-creator-index';
const CREATOR_INDEX_TITLE = '[Content Creator Index]';
const CREATOR_INDEX_HEADER = '# Content Creator Index\n\n## Approved Creators\n';
const PENDING_APPROVALS_HEADER = '\n## Pending Approvals\n';

/**
 * In-flight request tracking to prevent race conditions
 * Key: "owner/repo", Value: Promise
 */
const pendingCreatorIndexRequests = new Map();

/**
 * Parse creator index map from issue body
 * Returns: Map<creatorId, commentId>
 */
function parseCreatorIndex(body) {
  const map = new Map();
  if (!body) return map;

  // Find the Approved Creators section
  const approvedSection = body.match(/## Approved Creators\n([\s\S]*?)(?=\n##|\n---|\n🤖|$)/);
  if (!approvedSection) return map;

  // Match lines like: [creator-id]=comment-id
  const regex = /\[([a-z0-9-]+)\]=(\d+)/gi;
  let match;

  while ((match = regex.exec(approvedSection[1])) !== null) {
    const creatorId = match[1];
    const commentId = parseInt(match[2], 10);
    map.set(creatorId, commentId);
  }

  return map;
}

/**
 * Parse pending approvals from issue body
 * Returns: Array<{ creatorId, checked, commentUrl, channelName, platform, submittedBy }>
 */
function parsePendingApprovals(body) {
  const pending = [];
  if (!body) return pending;

  // Find the Pending Approvals section
  const pendingSection = body.match(/## Pending Approvals\n([\s\S]*?)(?=\n---|\n🤖|$)/);
  if (!pendingSection) return pending;

  // Match lines like: - [ ] [Name](URL#comment-123) - Platform - submitted by @user
  const regex = /- \[([ x])\] \[([^\]]+)\]\(([^)]+#issuecomment-(\d+))\) - ([^-]+) - submitted by @([^\n]+)/gi;
  let match;

  while ((match = regex.exec(pendingSection[1])) !== null) {
    const checked = match[1] === 'x';
    const channelName = match[2].trim();
    const commentUrl = match[3].trim();
    const commentId = match[4];
    const platform = match[5].trim().toLowerCase();
    const submittedBy = match[6].trim();

    // Extract creator ID from comment data (will need to fetch)
    pending.push({
      commentId: parseInt(commentId, 10),
      checked,
      channelName,
      platform,
      submittedBy,
      commentUrl
    });
  }

  return pending;
}

/**
 * Serialize creator index map to issue body
 */
function serializeCreatorIndex(approvedMap, pendingList) {
  let body = CREATOR_INDEX_HEADER;

  // Add approved creators
  for (const [creatorId, commentId] of approvedMap.entries()) {
    body += `[${creatorId}]=${commentId}\n`;
  }

  // Add pending approvals section
  body += PENDING_APPROVALS_HEADER;
  for (const pending of pendingList) {
    const checkbox = pending.checked ? 'x' : ' ';
    body += `- [${checkbox}] [${pending.channelName}](${pending.commentUrl}) - ${pending.platform} - submitted by @${pending.submittedBy}\n`;
  }

  body += '\n---\n\n🤖 Managed by wiki bot';
  return body;
}

/**
 * Get or create content creator index issue
 * Required: owner, repo
 */
async function handleGetOrCreateCreatorIndex(adapter, octokit, { owner, repo }) {
  if (!owner || !repo) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo' });
  }

  const cacheKey = `${owner}/${repo}`;

  // Check if there's already a request in-flight for this key
  if (pendingCreatorIndexRequests.has(cacheKey)) {
    logger.debug('Waiting for in-flight creator index request', { cacheKey });
    return await pendingCreatorIndexRequests.get(cacheKey);
  }

  // Create promise placeholder and track it IMMEDIATELY (before any async work)
  // This prevents race condition where multiple calls check pendingCreatorIndexRequests
  // at the same time before any of them set it
  let resolvePromise, rejectPromise;
  const requestPromise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  // Set in map IMMEDIATELY
  pendingCreatorIndexRequests.set(cacheKey, requestPromise);

  // Now do the actual async work
  (async () => {
    try {
      // Search for existing index issue
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        labels: CREATOR_INDEX_LABEL,
        state: 'open',
        per_page: 1,
      });

      if (issues.length > 0) {
        const issue = issues[0];
        resolvePromise({
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          body: issue.body || ''
        });
        return;
      }

      // Create new index issue
      const initialBody = CREATOR_INDEX_HEADER + PENDING_APPROVALS_HEADER + '\n---\n\n🤖 Managed by wiki bot';
      const { data: newIssue } = await octokit.rest.issues.create({
        owner,
        repo,
        title: CREATOR_INDEX_TITLE,
        body: initialBody,
        labels: [CREATOR_INDEX_LABEL],
      });

      // Lock issue to prevent tampering
      await octokit.rest.issues.lock({
        owner,
        repo,
        issue_number: newIssue.number,
        lock_reason: 'resolved',
      });

      logger.info('Created content creator index issue', { issueNumber: newIssue.number });

      resolvePromise({
        issueNumber: newIssue.number,
        issueUrl: newIssue.html_url,
        body: newIssue.body || ''
      });
    } catch (error) {
      logger.error('Failed to get/create creator index', { error: error.message });
      rejectPromise(error);
    } finally {
      // Keep in-flight entry for 5 seconds after completion to prevent race conditions during GitHub's eventual consistency
      setTimeout(() => {
        pendingCreatorIndexRequests.delete(cacheKey);
      }, 5000);
    }
  })();

  // Promise already tracked above (line 2479) - return it
  return requestPromise;
}

/**
 * Submit content creator (create comment + add pending checkbox)
 * Required: owner, repo, creatorId, channelUrl, channelName, platform, submittedBy
 */
async function handleSubmitContentCreator(adapter, octokit, { owner, repo, creatorId, channelUrl, channelName, platform, submittedBy }) {
  if (!owner || !repo || !creatorId || !channelUrl || !channelName || !platform || !submittedBy) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, creatorId, channelUrl, channelName, platform, submittedBy'
    });
  }

  try {
    // Get index issue
    const indexData = await handleGetOrCreateCreatorIndex(adapter, octokit, { owner, repo });
    const issueNumber = indexData.issueNumber;
    const currentBody = indexData.body;

    // Check if already exists
    const indexMap = parseCreatorIndex(currentBody);
    if (indexMap.has(creatorId)) {
      return adapter.createJsonResponse(409, { error: 'This creator has already been submitted' });
    }

    // Create comment with submission data
    const submissionData = {
      creatorId,
      platform,
      channelUrl,
      channelName,
      submittedBy,
      submittedAt: new Date().toISOString(),
      approved: false,
      approvedBy: null,
      approvedAt: null
    };

    const { data: comment } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: JSON.stringify(submissionData, null, 2)
    });

    // Parse current pending list
    const pendingList = parsePendingApprovals(currentBody);

    // Add new pending entry
    const commentUrl = `https://github.com/${owner}/${repo}/issues/${issueNumber}#issuecomment-${comment.id}`;
    pendingList.push({
      commentId: comment.id,
      checked: false,
      channelName,
      platform,
      submittedBy,
      commentUrl
    });

    // Update issue body with new pending entry
    const updatedBody = serializeCreatorIndex(indexMap, pendingList);
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      body: updatedBody
    });

    logger.info('Created content creator submission', { creatorId, commentId: comment.id });

    return adapter.createJsonResponse(201, {
      creatorId,
      commentId: comment.id,
      issueNumber,
      issueUrl: `https://github.com/${owner}/${repo}/issues/${issueNumber}`
    });
  } catch (error) {
    logger.error('Failed to submit content creator', { error: error.message, creatorId });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Get approved creators
 * Required: owner, repo
 */
async function handleGetApprovedCreators(adapter, octokit, { owner, repo }) {
  if (!owner || !repo) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo' });
  }

  try {
    // Get index issue
    const indexData = await handleGetOrCreateCreatorIndex(adapter, octokit, { owner, repo });
    const issueNumber = indexData.issueNumber;
    const body = indexData.body;

    // Parse index map
    const indexMap = parseCreatorIndex(body);

    if (indexMap.size === 0) {
      return adapter.createJsonResponse(200, { creators: [] });
    }

    // Fetch all approved creator comments
    const creators = [];
    for (const [creatorId, commentId] of indexMap.entries()) {
      try {
        const { data: comment } = await octokit.rest.issues.getComment({
          owner,
          repo,
          comment_id: commentId
        });

        const creatorData = JSON.parse(comment.body);
        creators.push(creatorData);
      } catch (error) {
        logger.warn('Failed to fetch creator comment', { creatorId, commentId, error: error.message });
      }
    }

    return adapter.createJsonResponse(200, { creators });
  } catch (error) {
    logger.error('Failed to get approved creators', { error: error.message });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Get all creator submissions (for admin panel)
 * Required: owner, repo
 */
async function handleGetAllCreatorSubmissions(adapter, octokit, { owner, repo }) {
  if (!owner || !repo) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo' });
  }

  try {
    // Get index issue
    const indexData = await handleGetOrCreateCreatorIndex(adapter, octokit, { owner, repo });
    const issueNumber = indexData.issueNumber;
    const body = indexData.body;

    // Parse both approved and pending
    const indexMap = parseCreatorIndex(body);
    const pendingList = parsePendingApprovals(body);

    // Fetch all comments (approved)
    const submissions = [];
    for (const [creatorId, commentId] of indexMap.entries()) {
      try {
        const { data: comment } = await octokit.rest.issues.getComment({
          owner,
          repo,
          comment_id: commentId
        });

        const creatorData = JSON.parse(comment.body);
        submissions.push(creatorData);
      } catch (error) {
        logger.warn('Failed to fetch creator comment', { creatorId, commentId, error: error.message });
      }
    }

    // Fetch pending comments
    for (const pending of pendingList) {
      try {
        const { data: comment } = await octokit.rest.issues.getComment({
          owner,
          repo,
          comment_id: pending.commentId
        });

        const creatorData = JSON.parse(comment.body);
        submissions.push(creatorData);
      } catch (error) {
        logger.warn('Failed to fetch pending creator comment', { commentId: pending.commentId, error: error.message });
      }
    }

    return adapter.createJsonResponse(200, { submissions });
  } catch (error) {
    logger.error('Failed to get all creator submissions', { error: error.message });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Sync creator approvals from checkboxes
 * Required: owner, repo, adminUsername, userToken
 */
async function handleSyncCreatorApprovals(adapter, octokit, { owner, repo, adminUsername, userToken }) {
  if (!owner || !repo || !adminUsername || !userToken) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, adminUsername, userToken'
    });
  }

  // Verify admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return adapter.createJsonResponse(403, { error: 'Only repository owner and admins can perform this action' });
    }
  } catch (error) {
    logger.error('Permission check failed', { error: error.message });
    return adapter.createJsonResponse(403, { error: 'Permission verification failed' });
  }

  try {
    // Get index issue
    const indexData = await handleGetOrCreateCreatorIndex(adapter, octokit, { owner, repo });
    const issueNumber = indexData.issueNumber;
    const body = indexData.body;

    // Parse current state
    const indexMap = parseCreatorIndex(body);
    const pendingList = parsePendingApprovals(body);

    let updatesCount = 0;

    // Process newly checked boxes
    for (const pending of pendingList) {
      if (pending.checked && !indexMap.has(pending.creatorId)) {
        // Fetch comment data
        try {
          const { data: comment } = await octokit.rest.issues.getComment({
            owner,
            repo,
            comment_id: pending.commentId
          });

          const creatorData = JSON.parse(comment.body);

          // Update approval status
          creatorData.approved = true;
          creatorData.approvedBy = adminUsername;
          creatorData.approvedAt = new Date().toISOString();

          // Update comment
          await octokit.rest.issues.updateComment({
            owner,
            repo,
            comment_id: pending.commentId,
            body: JSON.stringify(creatorData, null, 2)
          });

          // Add to index
          indexMap.set(creatorData.creatorId, pending.commentId);
          updatesCount++;

          logger.info('Approved creator via checkbox sync', { creatorId: creatorData.creatorId });
        } catch (error) {
          logger.error('Failed to process checked creator', { commentId: pending.commentId, error: error.message });
        }
      }
    }

    // Update pending list to remove approved items
    const updatedPendingList = pendingList.filter(p => !p.checked || !indexMap.has(p.creatorId));

    // Update issue body
    const updatedBody = serializeCreatorIndex(indexMap, updatedPendingList);
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      body: updatedBody
    });

    return adapter.createJsonResponse(200, {
      updatesCount,
      message: `Synced ${updatesCount} approval(s)`
    });
  } catch (error) {
    logger.error('Failed to sync creator approvals', { error: error.message });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Approve creator manually
 * Required: owner, repo, creatorId, adminUsername, userToken
 */
async function handleApproveCreator(adapter, octokit, { owner, repo, creatorId, adminUsername, userToken }) {
  if (!owner || !repo || !creatorId || !adminUsername || !userToken) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, creatorId, adminUsername, userToken'
    });
  }

  // Verify admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return adapter.createJsonResponse(403, { error: 'Only repository owner and admins can perform this action' });
    }
  } catch (error) {
    logger.error('Permission check failed', { error: error.message });
    return adapter.createJsonResponse(403, { error: 'Permission verification failed' });
  }

  try {
    // Get index issue
    const indexData = await handleGetOrCreateCreatorIndex(adapter, octokit, { owner, repo });
    const issueNumber = indexData.issueNumber;
    const body = indexData.body;

    // Parse current state
    const indexMap = parseCreatorIndex(body);
    const pendingList = parsePendingApprovals(body);

    // Check if already approved
    if (indexMap.has(creatorId)) {
      return adapter.createJsonResponse(409, { error: 'Creator already approved' });
    }

    // Find in pending list
    const pending = pendingList.find(p => {
      // We need to fetch the comment to get the creatorId
      return true; // Will check in loop
    });

    let commentId = null;
    let creatorData = null;

    // Search through pending comments to find the matching creator
    for (const p of pendingList) {
      try {
        const { data: comment } = await octokit.rest.issues.getComment({
          owner,
          repo,
          comment_id: p.commentId
        });

        const data = JSON.parse(comment.body);
        if (data.creatorId === creatorId) {
          commentId = p.commentId;
          creatorData = data;
          break;
        }
      } catch (error) {
        logger.warn('Failed to check pending comment', { commentId: p.commentId, error: error.message });
      }
    }

    if (!commentId || !creatorData) {
      return adapter.createJsonResponse(404, { error: 'Creator not found in pending list' });
    }

    // Update approval status
    creatorData.approved = true;
    creatorData.approvedBy = adminUsername;
    creatorData.approvedAt = new Date().toISOString();

    // Update comment
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body: JSON.stringify(creatorData, null, 2)
    });

    // Add to index
    indexMap.set(creatorId, commentId);

    // Remove from pending list and check the checkbox
    const updatedPendingList = pendingList.map(p => {
      if (p.commentId === commentId) {
        return { ...p, checked: true };
      }
      return p;
    }).filter(p => p.commentId !== commentId);

    // Update issue body
    const updatedBody = serializeCreatorIndex(indexMap, updatedPendingList);
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      body: updatedBody
    });

    logger.info('Approved creator manually', { creatorId, adminUsername });

    return adapter.createJsonResponse(200, {
      message: 'Creator approved successfully',
      creatorId
    });
  } catch (error) {
    logger.error('Failed to approve creator', { error: error.message, creatorId });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Delete creator submission
 * Required: owner, repo, creatorId, adminUsername, userToken
 */
async function handleDeleteCreatorSubmission(adapter, octokit, { owner, repo, creatorId, adminUsername, userToken }) {
  if (!owner || !repo || !creatorId || !adminUsername || !userToken) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, creatorId, adminUsername, userToken'
    });
  }

  // Verify admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return adapter.createJsonResponse(403, { error: 'Only repository owner and admins can perform this action' });
    }
  } catch (error) {
    logger.error('Permission check failed', { error: error.message });
    return adapter.createJsonResponse(403, { error: 'Permission verification failed' });
  }

  try {
    // Get index issue
    const indexData = await handleGetOrCreateCreatorIndex(adapter, octokit, { owner, repo });
    const issueNumber = indexData.issueNumber;
    const body = indexData.body;

    // Parse current state
    const indexMap = parseCreatorIndex(body);
    const pendingList = parsePendingApprovals(body);

    let commentId = null;

    // Check if in approved list
    if (indexMap.has(creatorId)) {
      commentId = indexMap.get(creatorId);
      indexMap.delete(creatorId);
    } else {
      // Search in pending list
      for (const p of pendingList) {
        try {
          const { data: comment } = await octokit.rest.issues.getComment({
            owner,
            repo,
            comment_id: p.commentId
          });

          const data = JSON.parse(comment.body);
          if (data.creatorId === creatorId) {
            commentId = p.commentId;
            break;
          }
        } catch (error) {
          logger.warn('Failed to check pending comment', { commentId: p.commentId, error: error.message });
        }
      }
    }

    if (!commentId) {
      return adapter.createJsonResponse(404, { error: 'Creator not found' });
    }

    // Delete comment
    await octokit.rest.issues.deleteComment({
      owner,
      repo,
      comment_id: commentId
    });

    // Remove from pending list
    const updatedPendingList = pendingList.filter(p => p.commentId !== commentId);

    // Update issue body
    const updatedBody = serializeCreatorIndex(indexMap, updatedPendingList);
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      body: updatedBody
    });

    logger.info('Deleted creator submission', { creatorId, adminUsername });

    return adapter.createJsonResponse(200, {
      message: 'Creator deleted successfully',
      creatorId
    });
  } catch (error) {
    logger.error('Failed to delete creator submission', { error: error.message, creatorId });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Delete video guide (admin only)
 * Creates a PR to remove guide from video-guides.json
 */
async function handleDeleteVideoGuide(adapter, octokit, { owner, repo, guideId, adminUsername, userToken }) {
  if (!owner || !repo || !guideId || !adminUsername || !userToken) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, guideId, adminUsername, userToken'
    });
  }

  // Verify admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return adapter.createJsonResponse(403, { error: 'Only repository owner and admins can perform this action' });
    }
  } catch (error) {
    logger.error('Permission check failed', { error: error.message });
    return adapter.createJsonResponse(403, { error: 'Permission verification failed' });
  }

  try {
    // Fetch current video-guides.json from main branch
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: 'public/data/video-guides.json',
      ref: 'main'
    });

    // Decode and parse
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const videoGuidesData = JSON.parse(currentContent);
    const existingGuides = videoGuidesData.videoGuides || [];

    // Find guide to delete
    const guideIndex = existingGuides.findIndex(g => g.id === guideId);
    if (guideIndex === -1) {
      return adapter.createJsonResponse(404, { error: 'Video guide not found' });
    }

    const guideToDelete = existingGuides[guideIndex];

    // Remove from array
    existingGuides.splice(guideIndex, 1);
    videoGuidesData.videoGuides = existingGuides;

    // Serialize
    const updatedContent = JSON.stringify(videoGuidesData, null, 2);
    const updatedContentBase64 = Buffer.from(updatedContent).toString('base64');

    // Create branch
    const branchName = `delete-video-guide-${guideId}-${Date.now()}`;
    const { data: mainRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: 'heads/main'
    });

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: mainRef.object.sha
    });

    // Commit to branch
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'public/data/video-guides.json',
      message: `Delete video guide: ${guideToDelete.title}`,
      content: updatedContentBase64,
      branch: branchName,
      sha: fileData.sha
    });

    // Create PR
    const prTitle = `[Video Guide] Delete: ${guideToDelete.title}`;
    const prBody = `## Video Guide Deletion

**Title:** ${guideToDelete.title}
**Video:** ${guideToDelete.videoUrl}
**Guide ID:** ${guideToDelete.id}
**Originally Submitted By:** ${guideToDelete.submittedBy || 'Unknown'}

---

Deleted by @${adminUsername}

**For reviewers:** This PR removes the video guide from the database.`;

    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: prBody,
      head: branchName,
      base: 'main'
    });

    logger.info('Video guide deletion PR created', {
      prNumber: pr.number,
      prUrl: pr.html_url,
      guideId,
      adminUsername
    });

    return adapter.createJsonResponse(200, {
      message: 'Video guide deletion PR created successfully',
      prNumber: pr.number,
      prUrl: pr.html_url,
      guideId
    });
  } catch (error) {
    logger.error('Failed to delete video guide', { error: error.message, guideId });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

