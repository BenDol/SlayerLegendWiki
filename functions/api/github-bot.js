/**
 * Cloudflare Pages Function: GitHub Bot (Consolidated)
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
import { generateVerificationEmail, generateVerificationEmailText } from './emailTemplates/verificationEmail.js';
import { sendEmail } from './_lib/sendgrid.js';
import * as jwt from './_lib/jwt.js';

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
        result = await handleListIssues(octokit, body);
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
async function handleListIssues(octokit, { owner, repo, labels, state = 'open', per_page = 100 }) {
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

  console.log(`[github-bot] Listed ${issues.length} issues with labels: ${labels}`);

  return {
    statusCode: 200,
    body: { issues }
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

    // Hash email for privacy
    const emailHash = await hashIP(email);

    // Store code in GitHub Issue (private, closed, locked)
    const issueTitle = `[Email Verification] ${emailHash}`;
    const issueBody = JSON.stringify({
      code,
      timestamp,
      expiresAt: timestamp + 10 * 60 * 1000, // 10 minutes
    });

    const { data: issue } = await octokit.rest.issues.create({
      owner,
      repo,
      title: issueTitle,
      body: issueBody,
      labels: ['email-verification'],
    });

    // Close and lock the issue
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: 'closed',
    });

    await octokit.rest.issues.lock({
      owner,
      repo,
      issue_number: issue.number,
      lock_reason: 'off-topic',
    });

    // Send email with SendGrid
    const emailResult = await sendEmail({
      apiKey: sendGridKey,
      to: email,
      from: fromEmail,
      subject: 'Verify your email - Slayer Legend Wiki',
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
        issueNumber: issue.number,
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
    const issueTitle = `[Email Verification] ${emailHash}`;

    // Find the verification issue
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: 'email-verification',
      state: 'closed',
      per_page: 100,
    });

    const verificationIssue = issues.find(issue => issue.title === issueTitle);

    if (!verificationIssue) {
      return {
        statusCode: 404,
        body: { error: 'Verification code not found or expired' }
      };
    }

    // Parse issue body
    let storedData;
    try {
      storedData = JSON.parse(verificationIssue.body);
    } catch (parseError) {
      return {
        statusCode: 500,
        body: { error: 'Invalid verification data' }
      };
    }

    // Check expiration
    if (Date.now() > storedData.expiresAt) {
      return {
        statusCode: 403,
        body: { error: 'Verification code expired' }
      };
    }

    // Verify code
    if (storedData.code !== code) {
      return {
        statusCode: 403,
        body: { error: 'Invalid verification code' }
      };
    }

    // Generate verification token
    const secret = env.EMAIL_VERIFICATION_SECRET;
    if (!secret) {
      throw new Error('EMAIL_VERIFICATION_SECRET not configured');
    }
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
    const branchName = `anonymous-edit/${section}/${pageId}/${timestamp}`;

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
    const commitMessage = `Update ${pageTitle}

Anonymous contribution by: ${displayName}
Email: ${email} (verified ✓)
${reason ? `Reason: ${reason}` : ''}

Submitted: ${new Date(timestamp).toISOString()}

🤖 Generated with [Anonymous Wiki Editor](https://slayerlegend.wiki)

Co-Authored-By: Wiki Bot <bot@slayerlegend.wiki>`;

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
    });

    // 8. Create PR
    const prBody = `## Anonymous Edit Submission

**Submitted by:** ${displayName}
**Email:** ${email} (verified ✓)
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

    // 9. Add labels
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels: ['anonymous-edit', 'needs-review', section],
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
