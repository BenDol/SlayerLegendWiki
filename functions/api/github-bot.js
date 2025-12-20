/**
 * Cloudflare Pages Function: GitHub Bot (Consolidated)
 * Handles all bot-authenticated GitHub operations
 *
 * POST /api/github-bot
 * Body: {
 *   action: 'create-comment' | 'update-issue' | 'list-issues' | 'get-comment' | 'create-comment-issue' | 'create-admin-issue' | 'update-admin-issue' | 'save-user-snapshot' | 'send-verification-email' | 'verify-email' | 'check-rate-limit' | 'create-anonymous-pr',
 *   owner: string,
 *   repo: string,
 *   ... (action-specific parameters)
 * }
 */

import { Octokit } from '@octokit/rest';
import * as LeoProfanity from 'leo-profanity';
import StorageFactory from 'github-wiki-framework/src/services/storage/StorageFactory.js';
import { generateVerificationEmail, generateVerificationEmailText } from './emailTemplates/verificationEmail.js';
import { sendEmail } from './_lib/sendgrid.js';
import * as jwt from './_lib/jwt.js';

/**
 * Get storage configuration from environment
 * Uses a default GitHub backend configuration
 */
function getStorageConfig(env, owner, repo) {
  // Check if KV namespace is bound (indicates KV backend should be used)
  if (env.SLAYER_WIKI_DATA) {
    return {
      backend: 'cloudflare-kv',
      version: 'v1',
      cloudflareKV: { namespace: env.SLAYER_WIKI_DATA }
    };
  }

  // Default to GitHub backend
  return {
    backend: 'github',
    version: 'v1',
    github: { owner, repo }
  };
}

/**
 * Encrypt data using AES-GCM
 * @param {string} data - Data to encrypt
 * @param {string} secret - Encryption secret
 * @returns {Promise<string>} Base64-encoded encrypted data with IV prepended
 */
async function encryptData(data, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret.padEnd(32, '0').substring(0, 32)); // Ensure 32 bytes for AES-256

  // Import key
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-GCM
 * @param {string} encryptedData - Base64-encoded encrypted data with IV prepended
 * @param {string} secret - Encryption secret
 * @returns {Promise<string>} Decrypted data
 */
async function decryptData(encryptedData, secret) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const keyData = encoder.encode(secret.padEnd(32, '0').substring(0, 32)); // Ensure 32 bytes for AES-256

  // Import key
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return decoder.decode(decrypted);
}

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
 * Create storage instance helper
 */
function createStorage(env, botToken, owner, repo) {
  const storageConfig = getStorageConfig(env, owner, repo);

  return StorageFactory.create(
    storageConfig,
    { WIKI_BOT_TOKEN: botToken }
  );
}

/**
 * Simple storage helpers for verification codes
 * Uses StorageFactory with configured backend
 */
async function storeVerificationCode(env, botToken, owner, repo, emailHash, code, expiresAt) {
  const storage = createStorage(env, botToken, owner, repo);

  const item = {
    id: `verify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    code,
    expiresAt,
    createdAt: new Date().toISOString()
  };

  await storage.save('email-verification', emailHash, emailHash, item);
  return item;
}

async function getVerificationCode(env, botToken, owner, repo, emailHash) {
  const storage = createStorage(env, botToken, owner, repo);
  const items = await storage.load('email-verification', emailHash);

  // Return the first (and should be only) verification code
  return items[0] || null;
}

async function deleteVerificationCode(env, botToken, owner, repo, emailHash, itemId) {
  const storage = createStorage(env, botToken, owner, repo);
  return storage.delete('email-verification', emailHash, emailHash, itemId);
}

/**
 * Check text for profanity using OpenAI Moderation API (primary) with leo-profanity fallback
 * @param {string} text - Text to check
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{containsProfanity: boolean, method: string, categories?: object}>}
 */
async function checkProfanity(text, apiKey) {
  // Try OpenAI Moderation API first (if configured)
  if (apiKey) {
    try {
      console.log('[Profanity] Checking with OpenAI Moderation API for text:', text);
      const response = await fetch(
        'https://api.openai.com/v1/moderations',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
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

        console.log('[Profanity] OpenAI Moderation result:', {
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
    console.log('[Profanity] OPENAI_API_KEY not configured, using leo-profanity fallback');
  }

  // Fallback to leo-profanity package
  console.log('[Profanity] Using leo-profanity package for text:', text);
  const containsProfanity = LeoProfanity.check(text);
  console.log('[Profanity] leo-profanity result:', containsProfanity);
  return { containsProfanity, method: 'leo-profanity' };
}

export async function onRequest(context) {
  const { request, env } = context;

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Parse request body
    const body = await request.json();
    const { action, owner, repo } = body;

    console.log('[github-bot] Received request:', { action, owner, repo });

    // Validate required fields
    if (!action || !owner || !repo) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action, owner, repo' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get bot token from environment
    const botToken = env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[github-bot] WIKI_BOT_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Bot token not configured' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Octokit with bot token
    const octokit = new Octokit({
      auth: botToken,
      userAgent: 'GitHub-Wiki-Bot/1.0'
    });

    // Route to action handler
    let result;
    switch (action) {
      case 'create-comment':
        result = await handleCreateComment(octokit, body);
        break;
      case 'update-issue':
        result = await handleUpdateIssue(octokit, body);
        break;
      case 'list-issues':
        result = await handleListIssues(octokit, body, env);
        break;
      case 'get-comment':
        result = await handleGetComment(octokit, body);
        break;
      case 'create-comment-issue':
        result = await handleCreateCommentIssue(octokit, body);
        break;
      case 'create-admin-issue':
        result = await handleCreateAdminIssue(octokit, body);
        break;
      case 'update-admin-issue':
        result = await handleUpdateAdminIssue(octokit, body);
        break;
      case 'save-user-snapshot':
        result = await handleSaveUserSnapshot(octokit, body);
        break;
      case 'send-verification-email':
        result = await handleSendVerificationEmail(octokit, env, body);
        break;
      case 'verify-email':
        result = await handleVerifyEmail(octokit, env, body);
        break;
      case 'check-rate-limit':
        result = await handleCheckRateLimit(context, body);
        break;
      case 'create-anonymous-pr':
        result = await handleCreateAnonymousPR(octokit, context, env, body);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
    }

    return new Response(
      JSON.stringify(result.body),
      {
        status: result.statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[github-bot] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Create a comment on an issue
 */
async function handleCreateComment(octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || !body) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: issueNumber, body' }
    };
  }

  const { data: comment } = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  console.log(`[github-bot] Created comment ${comment.id} on issue #${issueNumber}`);

  return {
    statusCode: 200,
    body: {
      comment: {
        id: comment.id,
        body: comment.body,
        created_at: comment.created_at,
        html_url: comment.html_url,
      },
    }
  };
}

/**
 * Update an issue body
 */
async function handleUpdateIssue(octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || body === undefined) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: issueNumber, body' }
    };
  }

  const { data: issue } = await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  console.log(`[github-bot] Updated issue #${issueNumber}`);

  return {
    statusCode: 200,
    body: {
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        updated_at: issue.updated_at,
        state: issue.state,
      },
    }
  };
}

/**
 * List issues by label
 */
async function handleListIssues(octokit, { owner, repo, labels, state = 'open', per_page = 100 }, env) {
  if (!labels) {
    return {
      statusCode: 400,
      body: { error: 'Missing required field: labels' }
    };
  }

  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: Array.isArray(labels) ? labels.join(',') : labels,
    state,
    per_page,
  });

  // Security: Filter to only bot-created issues
  const botUsername = env.WIKI_BOT_USERNAME;
  const botIssues = issues.filter(issue => issue.user.login === botUsername);

  console.log(`[github-bot] Listed ${botIssues.length}/${issues.length} bot-created issues with labels: ${labels}`);

  return {
    statusCode: 200,
    body: { issues: botIssues }
  };
}

/**
 * Get a comment by ID
 */
async function handleGetComment(octokit, { owner, repo, commentId }) {
  if (!commentId) {
    return {
      statusCode: 400,
      body: { error: 'Missing required field: commentId' }
    };
  }

  const { data: comment } = await octokit.rest.issues.getComment({
    owner,
    repo,
    comment_id: commentId,
  });

  console.log(`[github-bot] Fetched comment ${commentId}`);

  return {
    statusCode: 200,
    body: { comment }
  };
}

/**
 * Create a comment issue
 */
async function handleCreateCommentIssue(octokit, { owner, repo, title, body, labels, requestedBy, requestedByUserId }) {
  if (!title || !body || !labels) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: title, body, labels' }
    };
  }

  const { data: issue } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels: Array.isArray(labels) ? labels : [labels],
  });

  console.log(`[github-bot] Created comment issue #${issue.number}${requestedBy ? ` (requested by ${requestedBy})` : ''}`);

  return {
    statusCode: 200,
    body: {
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        created_at: issue.created_at,
        state: issue.state,
      },
    }
  };
}

/**
 * Create an admin issue
 */
async function handleCreateAdminIssue(octokit, { owner, repo, title, body, labels, lock = true, userToken, username }) {
  if (!title || !body || !labels || !userToken || !username) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: title, body, labels, userToken, username' }
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
        body: { error: 'Only repository owner and admins can perform this action' }
      };
    }
  } catch (error) {
    console.error('[github-bot] Permission check failed:', error);
    return {
      statusCode: 403,
      body: { error: 'Permission verification failed' }
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

  // Lock the issue
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

  console.log(`[github-bot] Created admin issue #${issue.number} by ${username}`);

  return {
    statusCode: 200,
    body: {
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        created_at: issue.created_at,
        state: issue.state,
      },
    }
  };
}

/**
 * Update an admin issue
 */
async function handleUpdateAdminIssue(octokit, { owner, repo, issueNumber, body, userToken, username }) {
  if (!issueNumber || body === undefined || !userToken || !username) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: issueNumber, body, userToken, username' }
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
        body: { error: 'Only repository owner and admins can perform this action' }
      };
    }
  } catch (error) {
    console.error('[github-bot] Permission check failed:', error);
    return {
      statusCode: 403,
      body: { error: 'Permission verification failed' }
    };
  }

  // Update issue using bot token
  const { data: issue } = await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  console.log(`[github-bot] Updated admin issue #${issueNumber} by ${username}`);

  return {
    statusCode: 200,
    body: {
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        updated_at: issue.updated_at,
        state: issue.state,
      },
    }
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
      body: { error: 'Missing required fields: username, snapshotData, userToken, requestingUsername' }
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
        body: { error: 'User verification failed' }
      };
    }

    // Users can only update their own snapshot
    if (requestingUsername !== username) {
      return {
        statusCode: 403,
        body: { error: 'You can only update your own user snapshot' }
      };
    }
  } catch (error) {
    console.error('[github-bot] User verification failed:', error);
    return {
      statusCode: 403,
      body: { error: 'User authentication failed' }
    };
  }

  // Prepare issue data
  const issueTitle = `[User Snapshot] ${username}`;
  const issueBody = JSON.stringify(snapshotData, null, 2);
  const userIdLabel = snapshotData.userId ? `user-id:${snapshotData.userId}` : null;

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
      console.log(`[github-bot] Updated user snapshot #${existingIssueNumber} for ${username}`);
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
      console.log(`[github-bot] Created user snapshot #${newIssue.number} for ${username}`);
    }

    return {
      statusCode: 200,
      body: {
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
      }
    };
  } catch (error) {
    console.error('[github-bot] Failed to save user snapshot:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to save user snapshot: ' + error.message }
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
function getClientIP(context) {
  const { request } = context;
  // Cloudflare provides the real IP in CF-Connecting-IP header
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         'unknown';
}

/**
 * Helper: Generate verification code
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Helper: Create verification token (JWT)
 */
async function createVerificationToken(email, secret) {
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
 */
async function verifyVerificationToken(token, secret) {
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
 */
async function handleSendVerificationEmail(octokit, env, { owner, repo, email }) {
  if (!email) {
    return {
      statusCode: 400,
      body: { error: 'Missing required field: email' }
    };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      statusCode: 400,
      body: { error: 'Invalid email format' }
    };
  }

  // Check SendGrid configuration
  const sendGridKey = env.SENDGRID_API_KEY;
  const fromEmail = env.SENDGRID_FROM_EMAIL;
  if (!sendGridKey || !fromEmail) {
    console.error('[github-bot] SendGrid not configured');
    return {
      statusCode: 503,
      body: { error: 'Email service not configured' }
    };
  }

  try {
    // Generate verification code
    const code = generateVerificationCode();
    const timestamp = Date.now();
    const expiresAt = timestamp + 10 * 60 * 1000; // 10 minutes

    // Hash email for privacy
    const emailHash = await hashIP(email);

    // Encrypt verification code before storing
    const secret = env.EMAIL_VERIFICATION_SECRET;
    if (!secret) {
      throw new Error('EMAIL_VERIFICATION_SECRET not configured');
    }
    const encryptedCode = await encryptData(code, secret);

    // Get bot token
    const botToken = env.WIKI_BOT_TOKEN;
    if (!botToken) {
      throw new Error('WIKI_BOT_TOKEN not configured');
    }

    // Store verification code
    await storeVerificationCode(env, botToken, owner, repo, emailHash, encryptedCode, expiresAt);

    console.log(`[github-bot] Stored verification code for emailHash: ${emailHash.substring(0, 8)}...`);

    // Send email with SendGrid
    // Add [TEST] prefix in development mode
    const isDev = env.NODE_ENV === 'development';
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

    console.log(`[github-bot] Verification email sent to ${email}`);

    return {
      statusCode: 200,
      body: {
        message: 'Verification code sent',
      }
    };
  } catch (error) {
    console.error('[github-bot] Failed to send verification email:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to send verification email' }
    };
  }
}

/**
 * Verify email code and return verification token
 */
async function handleVerifyEmail(octokit, env, { owner, repo, email, code }) {
  if (!email || !code) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: email, code' }
    };
  }

  try {
    // Hash email
    const emailHash = await hashIP(email);

    // Get bot token
    const botToken = env.WIKI_BOT_TOKEN;
    if (!botToken) {
      throw new Error('WIKI_BOT_TOKEN not configured');
    }

    // Get verification code from storage
    const storedData = await getVerificationCode(env, botToken, owner, repo, emailHash);

    if (!storedData) {
      return {
        statusCode: 404,
        body: { error: 'Verification code not found or expired' }
      };
    }

    // Decrypt and verify code
    const secret = env.EMAIL_VERIFICATION_SECRET;
    if (!secret) {
      throw new Error('EMAIL_VERIFICATION_SECRET not configured');
    }

    let decryptedCode;
    try {
      decryptedCode = await decryptData(storedData.code, secret);
    } catch (decryptError) {
      console.error('[github-bot] Failed to decrypt verification code:', decryptError.message);
      return {
        statusCode: 500,
        body: { error: 'Verification failed' }
      };
    }

    if (decryptedCode !== code) {
      return {
        statusCode: 403,
        body: { error: 'Invalid verification code' }
      };
    }

    // Delete verification code after successful verification
    await deleteVerificationCode(env, botToken, owner, repo, emailHash, storedData.id);

    // Generate verification token
    const token = await createVerificationToken(email, secret);

    console.log(`[github-bot] Email verified: ${email}`);

    return {
      statusCode: 200,
      body: {
        verified: true,
        token,
      }
    };
  } catch (error) {
    console.error('[github-bot] Email verification failed:', error);
    return {
      statusCode: 500,
      body: { error: 'Verification failed' }
    };
  }
}

/**
 * Check rate limit for IP address
 * Note: For Cloudflare, this would ideally use KV storage
 * This implementation uses in-memory storage (resets on cold starts)
 */
const rateLimitStore = new Map();

async function handleCheckRateLimit(context, { maxEdits = 5, windowMinutes = 60 }) {
  const clientIP = getClientIP(context);
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

    return {
      statusCode: 429,
      body: {
        allowed: false,
        remainingMs,
        message: `Rate limit exceeded. Please try again in ${Math.ceil(remainingMs / 1000 / 60)} minutes.`,
      }
    };
  }

  return {
    statusCode: 200,
    body: {
      allowed: true,
      remaining: maxEdits - submissions.length,
    }
  };
}

/**
 * Record a submission for rate limiting
 */
async function recordSubmission(context) {
  const clientIP = getClientIP(context);
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
 */
async function validateRecaptcha(token, ip, secret) {
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
 */
async function handleCreateAnonymousPR(octokit, context, env, {
  owner, repo, section, pageId, pageTitle,
  content, email, displayName, reason = '',
  verificationToken, captchaToken
}) {
  // Validate required fields
  if (!owner || !repo || !section || !pageId || !pageTitle || !content || !email || !displayName || !verificationToken || !captchaToken) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields' }
    };
  }

  console.log('[github-bot] Starting anonymous PR creation for:', { email, displayName, section, pageId });

  try {
    // 1. Verify email verification token
    const secret = env.EMAIL_VERIFICATION_SECRET;
    if (!secret) {
      throw new Error('EMAIL_VERIFICATION_SECRET not configured');
    }
    const decoded = await verifyVerificationToken(verificationToken, secret);
    if (!decoded || decoded.email !== email) {
      return {
        statusCode: 403,
        body: { error: 'Email verification expired or invalid' }
      };
    }

    // 2. Validate reCAPTCHA
    const clientIP = getClientIP(context);
    const recaptchaSecret = env.RECAPTCHA_SECRET_KEY;
    if (!recaptchaSecret) {
      throw new Error('RECAPTCHA_SECRET_KEY not configured');
    }
    const captchaResult = await validateRecaptcha(captchaToken, clientIP, recaptchaSecret);

    if (!captchaResult.valid || captchaResult.score < 0.5) {
      return {
        statusCode: 403,
        body: { error: 'CAPTCHA validation failed', score: captchaResult.score }
      };
    }

    // 3. Check rate limit
    const rateCheck = await handleCheckRateLimit(context, { maxEdits: 5, windowMinutes: 60 });
    if (rateCheck.statusCode === 429) {
      return rateCheck;
    }

    // 4. Sanitize inputs
    displayName = displayName.replace(/<[^>]*>/g, '').substring(0, 50).trim();
    reason = reason.replace(/<[^>]*>/g, '').substring(0, 500).trim();

    if (displayName.length < 2) {
      return {
        statusCode: 400,
        body: { error: 'Display name must be at least 2 characters' }
      };
    }

    // 5. Check display name for profanity
    console.log('[github-bot] Checking display name for profanity:', displayName);
    const profanityCheck = await checkProfanity(displayName, env.OPENAI_API_KEY);
    console.log('[github-bot] Profanity check result:', profanityCheck);

    if (profanityCheck.containsProfanity) {
      console.log(`[github-bot] Display name rejected due to profanity (method: ${profanityCheck.method}):`, displayName);
      return {
        statusCode: 400,
        body: {
          error: 'Display name contains inappropriate language. Please choose a respectful name.'
        }
      };
    }

    console.log('[github-bot] Display name passed profanity check');

    // 5b. Check reason for profanity (if provided)
    if (reason && reason.length > 0) {
      console.log('[github-bot] Checking reason for profanity:', reason);
      const reasonProfanityCheck = await checkProfanity(reason, env.OPENAI_API_KEY);
      console.log('[github-bot] Reason profanity check result:', reasonProfanityCheck);

      if (reasonProfanityCheck.containsProfanity) {
        console.log(`[github-bot] Reason rejected due to profanity (method: ${reasonProfanityCheck.method}):`, reason);
        return {
          statusCode: 400,
          body: {
            error: 'Edit reason contains inappropriate language. Please provide a respectful explanation.'
          }
        };
      }

      console.log('[github-bot] Reason passed profanity check');
    }

    // 5c. Check page content for profanity
    console.log('[github-bot] Checking page content for profanity (length:', content.length, ')');
    // Only check first 5000 chars to avoid overwhelming the API
    const contentSample = content.substring(0, 5000);
    const contentProfanityCheck = await checkProfanity(contentSample, env.OPENAI_API_KEY);
    console.log('[github-bot] Content profanity check result:', contentProfanityCheck);

    if (contentProfanityCheck.containsProfanity) {
      console.log(`[github-bot] Content rejected due to profanity (method: ${contentProfanityCheck.method})`);
      return {
        statusCode: 400,
        body: {
          error: 'Page content contains inappropriate language. Please remove offensive content and try again.'
        }
      };
    }

    console.log('[github-bot] Content passed profanity check');

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
      console.log('[github-bot] File exists on main, using sha:', fileSha);
    } catch (error) {
      // File doesn't exist, that's fine (new page)
      console.log('[github-bot] File does not exist on main (new page)');
      fileSha = undefined;
    }

    // Convert content to base64
    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(content);
    const contentBase64 = btoa(String.fromCharCode(...contentBytes));

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: commitMessage,
      content: contentBase64,
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
        `name:${displayName}`, // Store display name as label for easy access
        `email:${emailHash.substring(0, 16)}`, // Store email hash (truncated) for tracking
      ],
    });

    // 10. Record submission for rate limiting
    await recordSubmission(context);

    console.log(`[github-bot] Anonymous PR created: #${pr.number} by ${displayName} (${email})`);

    return {
      statusCode: 200,
      body: {
        success: true,
        pr: {
          number: pr.number,
          url: pr.html_url,
          branch: branchName,
        },
      }
    };
  } catch (error) {
    console.error('[github-bot] Failed to create anonymous PR:', error);
    return {
      statusCode: 500,
      body: { error: error.message || 'Failed to create pull request' }
    };
  }
}
