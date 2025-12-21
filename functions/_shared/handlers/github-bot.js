const { createLogger } = require('../../../src/utils/logger');
const logger = createLogger('GithubBot');

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
 * Optional: reason
 */
async function handleCreateAnonymousPR(adapter, configAdapter, cryptoAdapter, octokit, {
  owner, repo, section, pageId, pageTitle,
  content, email, displayName, reason = '',
  verificationToken, captchaToken
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
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels: [
        'anonymous-edit',
        'needs-review',
        section,
        createNameLabel(displayName), // Store display name as label for easy access
        createEmailLabel(emailHash, 16), // Store email hash (truncated) for tracking
      ],
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
