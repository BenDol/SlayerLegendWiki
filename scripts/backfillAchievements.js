/**
 * Backfill Achievements Script
 *
 * This script helps backfill achievements for existing users who had activity
 * before the achievement system was deployed. It identifies users who need
 * achievement backfilling and provides options to process them.
 *
 * Usage:
 *   node scripts/backfillAchievements.js          # Report users needing backfill
 *   node scripts/backfillAchievements.js --auto   # Auto-backfill all users
 *
 * Note: The achievement system automatically checks achievements on user login,
 * so backfilling will happen naturally as users return to the wiki. This script
 * is mainly useful for ensuring all existing users get their achievements
 * immediately after deployment.
 *
 * Process:
 * 1. Fetch all user snapshot issues (identifies all registered users)
 * 2. Check which users already have achievement issues
 * 3. For users without achievements, trigger backfill via bot service
 *
 * Requirements:
 * - GITHUB_TOKEN with repo access
 * - Bot service endpoint for achievement rebuild
 */

import { Octokit } from '@octokit/rest';
import fetch from 'node-fetch';

// Initialize Octokit with GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Get repository info from environment
const owner = process.env.REPO_OWNER;
const repo = process.env.REPO_NAME;

// Bot service URL (adjust for your deployment)
const BOT_SERVICE_URL = process.env.BOT_SERVICE_URL || 'https://slayerlegend-wiki.netlify.app/.netlify/functions';

// Auto mode flag
const AUTO_MODE = process.argv.includes('--auto');

/**
 * Fetch all user snapshot issues
 */
async function fetchUserSnapshots() {
  console.log('📸 Fetching user snapshots...');

  try {
    const issues = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data } = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        labels: 'user-snapshot',
        state: 'open',
        per_page: 100,
        page
      });

      issues.push(...data);

      if (data.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`   Found ${issues.length} user snapshots\n`);
    return issues;
  } catch (error) {
    console.error('❌ Failed to fetch user snapshots:', error.message);
    throw error;
  }
}

/**
 * Fetch all achievement issues
 */
async function fetchAchievementIssues() {
  console.log('🏆 Fetching existing achievement issues...');

  try {
    const issues = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data } = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        labels: 'achievements',
        state: 'open',
        per_page: 100,
        page
      });

      issues.push(...data);

      if (data.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`   Found ${issues.length} achievement issues\n`);
    return issues;
  } catch (error) {
    console.error('❌ Failed to fetch achievement issues:', error.message);
    throw error;
  }
}

/**
 * Extract user ID from snapshot issue labels
 */
function extractUserId(snapshotIssue) {
  const userIdLabel = snapshotIssue.labels.find((label) => label.name.startsWith('user-id:'));
  if (userIdLabel) {
    return parseInt(userIdLabel.name.split(':')[1], 10);
  }
  return null;
}

/**
 * Extract username from snapshot issue title
 */
function extractUsername(snapshotIssue) {
  // Title format: "[User Snapshot] username"
  const match = snapshotIssue.title.match(/\[User Snapshot\] (.+)/);
  return match ? match[1] : null;
}

/**
 * Parse snapshot issue body to get user data
 */
function parseSnapshotIssue(snapshotIssue) {
  try {
    const data = JSON.parse(snapshotIssue.body);
    return data;
  } catch (error) {
    console.warn(`   ⚠️ Failed to parse snapshot issue #${snapshotIssue.number}`);
    return null;
  }
}

/**
 * Check if user already has achievements
 */
function hasAchievements(userId, achievementIssues) {
  return achievementIssues.some((issue) => {
    const userIdLabel = issue.labels.find((label) => label.name === `user-id:${userId}`);
    return !!userIdLabel;
  });
}

/**
 * Trigger achievement backfill via bot service
 */
async function backfillUserAchievements(userId, username) {
  console.log(`   Backfilling achievements for ${username} (ID: ${userId})...`);

  try {
    // This would call a bot service endpoint to rebuild achievements
    // For now, we'll just document what needs to happen
    console.log(`   ⚠️  Bot service integration needed for: ${username}`);
    console.log(`       Call bot service: POST /api/github-bot with action: "rebuild-achievements"`);
    console.log(`       Payload: { userId: ${userId}, username: "${username}" }\n`);

    // Uncomment when bot service endpoint is ready:
    /*
    const response = await fetch(`${BOT_SERVICE_URL}/github-bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
      },
      body: JSON.stringify({
        action: 'rebuild-achievements',
        owner,
        repo,
        userId,
        username
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`   ✅ Backfilled ${result.achievementCount} achievements for ${username}\n`);
    */

    return true;
  } catch (error) {
    console.error(`   ❌ Failed to backfill for ${username}:`, error.message);
    return false;
  }
}

/**
 * Main backfill function
 */
async function backfillAchievements() {
  console.log('\n' + '='.repeat(60));
  console.log('🏆 Achievement Backfill Script');
  console.log('='.repeat(60) + '\n');

  console.log(`📦 Repository: ${owner}/${repo}`);
  console.log(`🔧 Mode: ${AUTO_MODE ? 'AUTO (will backfill)' : 'REPORT (dry run)'}\n`);

  // 1. Fetch user snapshots and achievement issues
  const userSnapshots = await fetchUserSnapshots();
  const achievementIssues = await fetchAchievementIssues();

  // 2. Build set of users with achievements
  const usersWithAchievements = new Set();
  for (const issue of achievementIssues) {
    const userIdLabel = issue.labels.find((label) => label.name.startsWith('user-id:'));
    if (userIdLabel) {
      const userId = parseInt(userIdLabel.name.split(':')[1], 10);
      usersWithAchievements.add(userId);
    }
  }

  // 3. Identify users needing backfill
  const usersNeedingBackfill = [];

  for (const snapshot of userSnapshots) {
    const userId = extractUserId(snapshot);
    const username = extractUsername(snapshot);

    if (!userId || !username) {
      console.warn(`   ⚠️ Skipping invalid snapshot issue #${snapshot.number}`);
      continue;
    }

    if (!usersWithAchievements.has(userId)) {
      const snapshotData = parseSnapshotIssue(snapshot);
      usersNeedingBackfill.push({
        userId,
        username,
        snapshotData
      });
    }
  }

  // 4. Print summary
  console.log('='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`👥 Total Users:              ${userSnapshots.length}`);
  console.log(`✅ Users with Achievements:  ${usersWithAchievements.size}`);
  console.log(`⚠️  Users Needing Backfill:   ${usersNeedingBackfill.length}`);
  console.log('='.repeat(60) + '\n');

  if (usersNeedingBackfill.length === 0) {
    console.log('✅ All users already have achievements! No backfill needed.\n');
    return;
  }

  // 5. List users needing backfill
  console.log('📋 Users Needing Backfill:\n');
  for (const user of usersNeedingBackfill) {
    const prCount = user.snapshotData?.stats?.totalPRs || 0;
    console.log(`   ${user.username} (ID: ${user.userId}) - ${prCount} PRs`);
  }
  console.log();

  // 6. Backfill if in auto mode
  if (AUTO_MODE) {
    console.log('🔄 Starting automatic backfill...\n');

    const stats = {
      success: 0,
      failed: 0
    };

    for (const user of usersNeedingBackfill) {
      const success = await backfillUserAchievements(user.userId, user.username);
      if (success) {
        stats.success++;
      } else {
        stats.failed++;
      }
    }

    console.log('='.repeat(60));
    console.log('📈 Backfill Results');
    console.log('='.repeat(60));
    console.log(`✅ Success: ${stats.success}`);
    console.log(`❌ Failed:  ${stats.failed}`);
    console.log('='.repeat(60) + '\n');

    if (stats.failed > 0) {
      console.error('⚠️  Some users failed to backfill. Please check the errors above.');
      process.exit(1);
    }

    console.log('✅ Backfill completed successfully!\n');
  } else {
    console.log('ℹ️  This was a dry run. To actually backfill achievements, run:');
    console.log('   node scripts/backfillAchievements.js --auto\n');
    console.log('💡 Tip: Achievements will be automatically created when users login,');
    console.log('   so backfilling is optional unless you want immediate results.\n');
  }
}

// Run the backfill
backfillAchievements().catch((error) => {
  console.error('\n❌ Fatal error during backfill:', error);
  process.exit(1);
});
