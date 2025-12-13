/**
 * Anonymous Edit Server Example
 *
 * This is a reference implementation for handling anonymous wiki edits.
 *
 * SECURITY WARNING:
 * - NEVER expose the bot's GitHub token to the client
 * - Store BOT_GITHUB_TOKEN in environment variables only
 * - Use fine-grained tokens with minimal permissions (repo scope only)
 * - Validate and sanitize all incoming data
 * - Rate limit requests by IP address
 * - Consider adding CAPTCHA for additional protection
 * - Log all anonymous contributions for moderation
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  methods: ['POST'],
}));

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 5; // 5 edits per hour per IP

// Initialize Octokit with bot token
const octokit = new Octokit({
  auth: process.env.BOT_GITHUB_TOKEN,
});

// Configuration from environment
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const BASE_BRANCH = process.env.BASE_BRANCH || 'main';

/**
 * Rate limiting middleware
 */
function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const requests = rateLimitMap.get(ip).filter(time => now - time < RATE_LIMIT_WINDOW);

  if (requests.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      retryAfter: RATE_LIMIT_WINDOW / 1000,
    });
  }

  requests.push(now);
  rateLimitMap.set(ip, requests);
  next();
}

/**
 * Validate input data
 */
function validateInput(data) {
  const errors = [];

  if (!data.section || typeof data.section !== 'string') {
    errors.push('Invalid section');
  }

  if (!data.pageId || typeof data.pageId !== 'string') {
    errors.push('Invalid pageId');
  }

  if (!data.content || typeof data.content !== 'string') {
    errors.push('Invalid content');
  }

  if (data.content.length > 100000) {
    errors.push('Content too large (max 100KB)');
  }

  if (!data.filePath || typeof data.filePath !== 'string') {
    errors.push('Invalid filePath');
  }

  // Prevent path traversal
  if (data.filePath.includes('..') || data.filePath.startsWith('/')) {
    errors.push('Invalid filePath (security violation)');
  }

  return errors;
}

/**
 * Sanitize markdown content
 * Basic sanitization - you may want to add more rules
 */
function sanitizeContent(content) {
  // Remove any potential script injections
  // This is a basic implementation - consider using a proper markdown sanitizer
  return content
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Generate branch name for anonymous edit
 */
function generateBranchName(section, pageId) {
  const timestamp = Date.now();
  return `wiki-edit/${section}/${pageId}-anonymous-${timestamp}`;
}

/**
 * Generate PR body with anonymous attribution
 */
function generatePRBody(data, attribution) {
  let body = `## Anonymous Page Edit\n\n`;
  body += `**Page:** ${data.metadata?.title || data.pageId}\n`;
  body += `**Section:** ${data.section}\n`;
  body += `**Page ID:** ${data.pageId}\n\n`;

  if (data.editSummary) {
    body += `### Changes\n\n${data.editSummary}\n\n`;
  }

  body += `---\n\n`;
  body += `${attribution}\n\n`;
  body += `🤖 Generated with [GitHub Wiki Framework](https://github.com/BenDol/GithubWiki)\n\n`;
  body += `This pull request was created anonymously through the wiki's web editor.\n`;

  return body;
}

/**
 * POST /api/anonymous-edit
 * Handle anonymous edit submission
 */
app.post('/api/anonymous-edit', rateLimitMiddleware, async (req, res) => {
  const startTime = Date.now();

  try {
    console.log('\n' + '='.repeat(60));
    console.log('[Anonymous Edit] New request received');
    console.log('='.repeat(60));

    // Validate input
    const validationErrors = validateInput(req.body);
    if (validationErrors.length > 0) {
      console.error('[Anonymous Edit] Validation failed:', validationErrors);
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validationErrors,
      });
    }

    const { section, pageId, content, editSummary, filePath, metadata } = req.body;

    console.log(`[Anonymous Edit] Section: ${section}`);
    console.log(`[Anonymous Edit] Page ID: ${pageId}`);
    console.log(`[Anonymous Edit] File path: ${filePath}`);
    console.log(`[Anonymous Edit] Content length: ${content.length} bytes`);

    // Sanitize content
    const sanitizedContent = sanitizeContent(content);

    // Generate branch name
    const branchName = generateBranchName(section, pageId);
    console.log(`[Anonymous Edit] Branch name: ${branchName}`);

    // Get base branch reference
    const { data: baseBranchRef } = await octokit.rest.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BASE_BRANCH}`,
    });

    const baseSha = baseBranchRef.object.sha;
    console.log(`[Anonymous Edit] Base SHA: ${baseSha}`);

    // Create new branch
    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    console.log(`[Anonymous Edit] Branch created: ${branchName}`);

    // Check if file exists to get SHA
    let fileSha = null;
    try {
      const { data: existingFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: filePath,
        ref: BASE_BRANCH,
      });
      fileSha = existingFile.sha;
      console.log(`[Anonymous Edit] Existing file SHA: ${fileSha}`);
    } catch (error) {
      if (error.status === 404) {
        console.log(`[Anonymous Edit] File does not exist (new file)`);
      } else {
        throw error;
      }
    }

    // Commit changes
    const commitMessage = metadata?.title
      ? `Update ${metadata.title}\n\n${editSummary || 'Updated via wiki editor'}`
      : `Update ${pageId}\n\n${editSummary || 'Updated via wiki editor'}`;

    const { data: commit } = await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(sanitizedContent).toString('base64'),
      branch: branchName,
      sha: fileSha,
    });

    console.log(`[Anonymous Edit] Commit created: ${commit.commit.sha}`);

    // Generate PR title and body
    const prTitle = `Update ${metadata?.title || pageId}`;
    const attribution = process.env.ATTRIBUTION_FORMAT ||
                       'Contributed anonymously via wiki editor';
    const prBody = generatePRBody({ section, pageId, editSummary, metadata }, attribution);

    // Create pull request
    const { data: pr } = await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: prTitle,
      body: prBody,
      head: branchName,
      base: BASE_BRANCH,
    });

    console.log(`[Anonymous Edit] PR created: #${pr.number}`);
    console.log(`[Anonymous Edit] URL: ${pr.html_url}`);

    // Try to add labels
    try {
      await octokit.rest.issues.addLabels({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        issue_number: pr.number,
        labels: ['wiki-edit', 'anonymous', 'documentation'],
      });
      console.log(`[Anonymous Edit] Labels added to PR`);
    } catch (error) {
      console.warn(`[Anonymous Edit] Could not add labels:`, error.message);
    }

    const duration = Date.now() - startTime;
    console.log(`[Anonymous Edit] ✓ Success (${duration}ms)`);
    console.log('='.repeat(60) + '\n');

    // Return success response
    res.json({
      success: true,
      prNumber: pr.number,
      prUrl: pr.html_url,
      message: 'Edit request created successfully',
    });

  } catch (error) {
    console.error('[Anonymous Edit] Error:', error);
    console.log('='.repeat(60) + '\n');

    res.status(500).json({
      success: false,
      error: 'Failed to create edit request',
      message: error.message,
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('Anonymous Edit Server');
  console.log('='.repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log(`Repository: ${REPO_OWNER}/${REPO_NAME}`);
  console.log(`Base branch: ${BASE_BRANCH}`);
  console.log(`Rate limit: ${MAX_REQUESTS_PER_WINDOW} requests per hour`);
  console.log('='.repeat(60) + '\n');
});
