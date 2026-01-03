#!/usr/bin/env node

/**
 * GitHub Issue Backup Script
 *
 * Creates comprehensive backups of all open GitHub issues including:
 * - User-generated data (skill-builds, battle-loadouts, spirit-builds)
 * - System cache issues (highscore-cache, user-snapshot, achievement-stats)
 * - Comment system issues (wiki-comments)
 * - All comments for each issue
 *
 * Output: JSON file at backups/issues/issues-backup-YYYY-MM-DD.json
 */

import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, '..', 'backups', 'issues');
const MAX_PAGES = 50;                // Safety limit for pagination
const PER_PAGE = 100;                // GitHub API maximum
const DELAY_BETWEEN_CALLS = 500;     // 500ms delay for rate limit safety

// Utility: Delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize Octokit
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  userAgent: 'GitHub-Wiki-Backup/1.0',
});

const owner = process.env.REPO_OWNER;
const repo = process.env.REPO_NAME;

/**
 * Fetch all open issues with pagination
 */
async function fetchAllOpenIssues(octokit, owner, repo) {
  console.log('[Backup] Fetching all open issues...');

  const issues = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= MAX_PAGES) {
    console.log(`[Backup] Fetching issues page ${page}...`);

    try {
      const { data } = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: 'open',
        per_page: PER_PAGE,
        page,
      });

      if (data.length === 0) break;

      // Filter out pull requests (they show up in issues API)
      const actualIssues = data.filter(issue => !issue.pull_request);
      issues.push(...actualIssues);

      console.log(`[Backup]    Found ${actualIssues.length} issues on page ${page} (${data.length} total items)`);

      hasMore = data.length === PER_PAGE;
      page++;

      // Rate limiting delay
      if (hasMore) {
        await delay(DELAY_BETWEEN_CALLS);
      }
    } catch (error) {
      if (error.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') {
        console.error('[Backup] Rate limit exceeded - backup incomplete');
        throw new Error('Rate limit exceeded');
      }

      console.error(`[Backup] Failed to fetch issues page ${page}: ${error.message}`);
      throw error;
    }
  }

  if (page > MAX_PAGES) {
    console.warn('[Backup] Reached page limit - backup may be incomplete');
  }

  console.log(`[Backup] Total issues fetched: ${issues.length}`);
  return issues;
}

/**
 * Fetch all comments for a single issue with pagination
 */
async function fetchIssueComments(octokit, owner, repo, issueNumber) {
  const comments = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= MAX_PAGES) {
    try {
      const { data } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: PER_PAGE,
        page,
      });

      if (data.length === 0) break;

      comments.push(...data);
      hasMore = data.length === PER_PAGE;
      page++;

      if (hasMore) {
        await delay(DELAY_BETWEEN_CALLS);
      }
    } catch (error) {
      console.error(`[Backup] Failed to fetch comments for issue #${issueNumber}: ${error.message}`);
      // Return partial comments rather than failing completely
      break;
    }
  }

  return comments;
}

/**
 * Transform issue and comments to backup format
 */
function transformIssue(issue, comments) {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    labels: issue.labels.map(l => ({
      name: typeof l === 'string' ? l : l.name,
      color: l.color || '',
      description: l.description || ''
    })),
    user: {
      login: issue.user.login,
      id: issue.user.id,
      type: issue.user.type || 'User'
    },
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    html_url: issue.html_url,
    comments: comments.map(c => ({
      id: c.id,
      body: c.body,
      user: {
        login: c.user.login,
        id: c.user.id
      },
      created_at: c.created_at,
      updated_at: c.updated_at,
      html_url: c.html_url
    }))
  };
}

/**
 * Build complete backup data structure
 */
function buildBackupData(issues) {
  const totalComments = issues.reduce((sum, issue) => sum + issue.comments.length, 0);

  return {
    metadata: {
      backupDate: new Date().toISOString(),
      repository: `${owner}/${repo}`,
      totalIssues: issues.length,
      totalComments: totalComments,
      issueState: 'open',
      version: '1.0.0'
    },
    issues: issues
  };
}

/**
 * Write backup to file
 */
function writeBackupFile(backupData) {
  // Ensure directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('[Backup] Creating backup directory...');
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Generate filename with current date
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `issues-backup-${timestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  console.log('[Backup] Writing backup file...');
  fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');

  const fileSizeMB = (fs.statSync(filepath).size / (1024 * 1024)).toFixed(2);
  console.log(`[Backup] Backup file written: ${filepath}`);
  console.log(`[Backup] File size: ${fileSizeMB} MB`);

  return filepath;
}

/**
 * Main backup function
 */
async function main() {
  console.log('[Backup] Starting GitHub issue backup...');
  console.log(`[Backup] Repository: ${owner}/${repo}`);
  console.log(`[Backup] Timestamp: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Step 1: Fetch all open issues
    const allIssues = await fetchAllOpenIssues(octokit, owner, repo);

    if (allIssues.length === 0) {
      console.log('[Backup] No open issues found - creating empty backup');
      const backupData = buildBackupData([]);
      writeBackupFile(backupData);
      console.log('[Backup] Backup completed successfully');
      return;
    }

    console.log('');

    // Step 2: Fetch comments for each issue
    console.log('[Backup] Fetching comments for all issues...');
    const issuesWithComments = [];
    let successCount = 0;
    let errorCount = 0;

    for (const issue of allIssues) {
      try {
        console.log(`[Backup]    Processing issue #${issue.number}: ${issue.title.substring(0, 50)}...`);

        const comments = await fetchIssueComments(octokit, owner, repo, issue.number);
        issuesWithComments.push(transformIssue(issue, comments));

        console.log(`[Backup]       Fetched ${comments.length} comment(s)`);
        successCount++;

        // Rate limiting delay between issues
        await delay(DELAY_BETWEEN_CALLS);
      } catch (error) {
        console.error(`[Backup] Failed to fetch comments for issue #${issue.number}: ${error.message}`);

        // Add issue without comments (partial backup better than none)
        issuesWithComments.push(transformIssue(issue, []));
        errorCount++;
      }
    }

    console.log('');
    console.log('[Backup] Comment fetching complete');
    console.log(`[Backup]    Success: ${successCount} issues`);
    if (errorCount > 0) {
      console.log(`[Backup]    Errors: ${errorCount} issues (added without comments)`);
    }
    console.log('');

    // Step 3: Build backup data
    const backupData = buildBackupData(issuesWithComments);

    // Step 4: Write to file
    const filepath = writeBackupFile(backupData);

    // Step 5: Summary
    console.log('');
    console.log('[Backup] ============================================');
    console.log('[Backup] Backup Summary');
    console.log('[Backup] ============================================');
    console.log(`[Backup] Backup Date: ${backupData.metadata.backupDate}`);
    console.log(`[Backup] Total Issues: ${backupData.metadata.totalIssues}`);
    console.log(`[Backup] Total Comments: ${backupData.metadata.totalComments}`);
    console.log(`[Backup] Output File: ${filepath}`);
    console.log('[Backup] ============================================');
    console.log('[Backup] Backup completed successfully');

  } catch (error) {
    console.error('[Backup] Backup failed:', error.message);
    process.exit(1);
  }
}

// Run backup
main();
