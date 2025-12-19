/**
 * Netlify Function: GitHub Bot (Consolidated)
 * Handles all bot-authenticated GitHub operations
 *
 * POST /.netlify/functions/github-bot
 * Body: {
 *   action: 'create-comment' | 'update-issue' | 'list-issues' | 'get-comment' | 'create-comment-issue' | 'create-admin-issue' | 'update-admin-issue',
 *   owner: string,
 *   repo: string,
 *   ... (action-specific parameters)
 * }
 */

import { Octokit } from '@octokit/rest';
import sgMail from '@sendgrid/mail';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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
    const body = JSON.parse(event.body);
    const { action, owner, repo } = body;

    // Validate required fields
    if (!action || !owner || !repo) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: action, owner, repo' }),
      };
    }

    // Get bot token from environment
    const botToken = process.env.WIKI_BOT_TOKEN;
    if (!botToken) {
      console.error('[github-bot] WIKI_BOT_TOKEN not configured');
      return {
        statusCode: 503,
        body: JSON.stringify({ error: 'Bot token not configured' }),
      };
    }

    // Initialize Octokit with bot token
    const octokit = new Octokit({
      auth: botToken,
      userAgent: 'GitHub-Wiki-Bot/1.0'
    });

    // Route to action handler
    switch (action) {
      case 'create-comment':
        return await handleCreateComment(octokit, body);
      case 'update-issue':
        return await handleUpdateIssue(octokit, body);
      case 'list-issues':
        return await handleListIssues(octokit, body);
      case 'get-comment':
        return await handleGetComment(octokit, body);
      case 'create-comment-issue':
        return await handleCreateCommentIssue(octokit, body);
      case 'create-admin-issue':
        return await handleCreateAdminIssue(octokit, body);
      case 'update-admin-issue':
        return await handleUpdateAdminIssue(octokit, body);
      case 'send-verification-email':
        return await handleSendVerificationEmail(octokit, body);
      case 'verify-email':
        return await handleVerifyEmail(octokit, body);
      case 'check-rate-limit':
        return await handleCheckRateLimit(event, body);
      case 'create-anonymous-pr':
        return await handleCreateAnonymousPR(octokit, event, body);
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Unknown action: ${action}` }),
        };
    }
  } catch (error) {
    console.error('[github-bot] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}

/**
 * Create a comment on an issue
 * Required: issueNumber, body
 */
async function handleCreateComment(octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || !body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: issueNumber, body' }),
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
    body: JSON.stringify({
      comment: {
        id: comment.id,
        body: comment.body,
        created_at: comment.created_at,
        html_url: comment.html_url,
      },
    }),
  };
}

/**
 * Update an issue body
 * Required: issueNumber, body
 */
async function handleUpdateIssue(octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || body === undefined) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: issueNumber, body' }),
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
 * List issues by label
 * Required: labels (string or array)
 * Optional: state, per_page
 */
async function handleListIssues(octokit, { owner, repo, labels, state = 'open', per_page = 100 }) {
  if (!labels) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required field: labels' }),
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
    body: JSON.stringify({ issues }),
  };
}

/**
 * Get a comment by ID
 * Required: commentId
 */
async function handleGetComment(octokit, { owner, repo, commentId }) {
  if (!commentId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required field: commentId' }),
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
    body: JSON.stringify({ comment }),
  };
}

/**
 * Create a comment issue (public comments)
 * Required: title, body, labels
 * Optional: requestedBy, requestedByUserId (for server-side ban checking)
 */
async function handleCreateCommentIssue(octokit, { owner, repo, title, body, labels, requestedBy, requestedByUserId }) {
  if (!title || !body || !labels) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: title, body, labels' }),
    };
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

  console.log(`[github-bot] Created comment issue #${issue.number}${requestedBy ? ` (requested by ${requestedBy})` : ''}`);

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

  console.log(`[github-bot] Created admin issue #${issue.number} by ${username}`);

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

  console.log(`[github-bot] Updated admin issue #${issueNumber} by ${username}`);

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
 * Helper: Hash IP address for privacy
 */
function hashIP(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex');
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
 */
function createVerificationToken(email) {
  const secret = process.env.EMAIL_VERIFICATION_SECRET;
  if (!secret) {
    throw new Error('EMAIL_VERIFICATION_SECRET not configured');
  }

  return jwt.sign(
    {
      email,
      timestamp: Date.now(),
      type: 'email-verification'
    },
    secret,
    { expiresIn: '24h' }
  );
}

/**
 * Helper: Verify verification token
 */
function verifyVerificationToken(token) {
  const secret = process.env.EMAIL_VERIFICATION_SECRET;
  if (!secret) {
    throw new Error('EMAIL_VERIFICATION_SECRET not configured');
  }

  try {
    const decoded = jwt.verify(token, secret);
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
async function handleSendVerificationEmail(octokit, { owner, repo, email }) {
  if (!email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required field: email' }),
    };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid email format' }),
    };
  }

  // Check SendGrid configuration
  const sendGridKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!sendGridKey || !fromEmail) {
    console.error('[github-bot] SendGrid not configured');
    return {
      statusCode: 503,
      body: JSON.stringify({ error: 'Email service not configured' }),
    };
  }

  try {
    // Generate verification code
    const code = generateVerificationCode();
    const timestamp = Date.now();

    // Hash email for privacy
    const emailHash = hashIP(email);

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

    // Close the issue immediately
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: 'closed',
    });

    // Lock the issue
    await octokit.rest.issues.lock({
      owner,
      repo,
      issue_number: issue.number,
      lock_reason: 'off-topic',
    });

    // Send email with SendGrid
    sgMail.setApiKey(sendGridKey);

    const msg = {
      to: email,
      from: {
        email: fromEmail,
        name: 'Slayer Legend Wiki'
      },
      subject: 'Verify your email - Slayer Legend Wiki',
      text: generateVerificationEmailText(code),
      html: generateVerificationEmail(code),
    };

    await sgMail.send(msg);

    console.log(`[github-bot] Verification email sent to ${email}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Verification code sent',
        issueNumber: issue.number,
      }),
    };
  } catch (error) {
    console.error('[github-bot] Failed to send verification email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send verification email' }),
    };
  }
}

/**
 * Verify email code and return verification token
 * Required: email, code
 */
async function handleVerifyEmail(octokit, { owner, repo, email, code }) {
  console.log('[github-bot] handleVerifyEmail called:', { owner, repo, email: email ? '***' : undefined, code: code ? '***' : undefined });

  if (!email || !code) {
    console.log('[github-bot] Missing email or code');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: email, code' }),
    };
  }

  try {
    // Hash email
    const emailHash = hashIP(email);
    const issueTitle = `[Email Verification] ${emailHash}`;

    console.log('[github-bot] Looking for issue:', issueTitle);

    // Find the verification issue
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: 'email-verification',
      state: 'closed',
      per_page: 100,
    });

    console.log('[github-bot] Found', issues.length, 'closed issues with email-verification label');

    const verificationIssue = issues.find(issue => issue.title === issueTitle);

    if (!verificationIssue) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Verification code not found or expired' }),
      };
    }

    // Parse issue body
    let storedData;
    try {
      storedData = JSON.parse(verificationIssue.body);
    } catch (parseError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Invalid verification data' }),
      };
    }

    // Check expiration
    if (Date.now() > storedData.expiresAt) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Verification code expired' }),
      };
    }

    // Verify code
    if (storedData.code !== code) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Invalid verification code' }),
      };
    }

    // Generate verification token
    const token = createVerificationToken(email);

    console.log(`[github-bot] Email verified: ${email}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        verified: true,
        token,
      }),
    };
  } catch (error) {
    console.error('[github-bot] Email verification failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Verification failed' }),
    };
  }
}

// In-memory rate limiting storage (for Netlify)
// Note: This resets on function cold starts. For production, use Netlify Blobs or external storage.
const rateLimitStore = new Map();

/**
 * Check rate limit for IP address
 * Required: (IP extracted from event)
 */
async function handleCheckRateLimit(event, { maxEdits = 5, windowMinutes = 60 }) {
  const clientIP = getClientIP(event);
  const ipHash = hashIP(clientIP);

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
      body: JSON.stringify({
        allowed: false,
        remainingMs,
        message: `Rate limit exceeded. Please try again in ${Math.ceil(remainingMs / 1000 / 60)} minutes.`,
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      allowed: true,
      remaining: maxEdits - submissions.length,
    }),
  };
}

/**
 * Record a submission for rate limiting
 */
function recordSubmission(event) {
  const clientIP = getClientIP(event);
  const ipHash = hashIP(clientIP);

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
async function validateRecaptcha(token, ip) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
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
async function handleCreateAnonymousPR(octokit, event, {
  owner, repo, section, pageId, pageTitle,
  content, email, displayName, reason = '',
  verificationToken, captchaToken
}) {
  // Validate required fields
  if (!owner || !repo || !section || !pageId || !pageTitle || !content || !email || !displayName || !verificationToken || !captchaToken) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    };
  }

  try {
    // 1. Verify email verification token
    const decoded = verifyVerificationToken(verificationToken);
    if (!decoded || decoded.email !== email) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Email verification expired or invalid' }),
      };
    }

    // 2. Validate reCAPTCHA
    const clientIP = getClientIP(event);
    const captchaResult = await validateRecaptcha(captchaToken, clientIP);

    if (!captchaResult.valid || captchaResult.score < 0.5) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'CAPTCHA validation failed', score: captchaResult.score }),
      };
    }

    // 3. Check rate limit
    const rateCheck = await handleCheckRateLimit(event, { maxEdits: 5, windowMinutes: 60 });
    if (rateCheck.statusCode === 429) {
      return rateCheck;
    }

    // 4. Sanitize inputs
    displayName = displayName.replace(/<[^>]*>/g, '').substring(0, 50).trim();
    reason = reason.replace(/<[^>]*>/g, '').substring(0, 500).trim();

    if (displayName.length < 2) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Display name must be at least 2 characters' }),
      };
    }

    // 5. Create branch
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

    // 6. Commit file
    const filePath = `public/content/${section}/${pageId}.md`;
    const commitMessage = `Update ${pageTitle}

Anonymous contribution by: ${displayName}
Email: ${email} (verified ✓)
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

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch: branchName,
      ...(fileSha && { sha: fileSha }), // Include sha if updating existing file
    });

    // 7. Create PR
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

    // 8. Add labels
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels: ['anonymous-edit', 'needs-review', section],
    });

    // 9. Record submission for rate limiting
    recordSubmission(event);

    console.log(`[github-bot] Anonymous PR created: #${pr.number} by ${displayName} (${email})`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        pr: {
          number: pr.number,
          url: pr.html_url,
          branch: branchName,
        },
      }),
    };
  } catch (error) {
    console.error('[github-bot] Failed to create anonymous PR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Failed to create pull request' }),
    };
  }
}
