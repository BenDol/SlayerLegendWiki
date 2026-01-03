/**
 * Calculate Achievement Statistics
 *
 * This script calculates what percentage of users have unlocked each achievement.
 * It is triggered by the achievement-stats.yml GitHub Action whenever achievement
 * issues are created or updated.
 *
 * Process:
 * 1. Load achievement definitions from public/achievements.json
 * 2. Fetch all user snapshot issues (to count total users)
 * 3. Fetch all achievement issues (to count unlocks per achievement)
 * 4. Calculate count and percentage for each achievement
 * 5. Store results in a cache issue labeled "achievement-stats"
 *
 * The cached statistics are used by the achievement UI to show rarity.
 */

import { Octokit } from '@octokit/rest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Octokit with GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Get repository info from environment
const owner = process.env.REPO_OWNER;
const repo = process.env.REPO_NAME;

/**
 * Load achievement definitions from public/achievements.json
 */
function loadAchievementDefinitions() {
  const achievementsPath = join(__dirname, '..', 'public', 'achievements.json');
  const content = readFileSync(achievementsPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Fetch all user snapshot issues (to count total users)
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
  console.log('🏆 Fetching achievement issues...');

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
 * Parse achievement data from issue body
 */
function parseAchievementIssue(issue) {
  try {
    const data = JSON.parse(issue.body);
    return data.achievements || [];
  } catch (error) {
    console.warn(`   ⚠️ Failed to parse issue #${issue.number}: ${error.message}`);
    return [];
  }
}

/**
 * Count achievement unlocks across all users
 */
function countAchievementUnlocks(achievementIssues, achievementDefinitions) {
  console.log('📊 Counting achievement unlocks...');

  const achievementCounts = {};

  // Initialize counts for all defined achievements
  for (const def of achievementDefinitions.achievements) {
    achievementCounts[def.id] = { count: 0, percentage: 0 };
  }

  // Count unlocks from achievement issues
  for (const issue of achievementIssues) {
    const achievements = parseAchievementIssue(issue);

    for (const achievement of achievements) {
      if (achievementCounts[achievement.id]) {
        achievementCounts[achievement.id].count++;
      }
    }
  }

  console.log(`   Processed ${achievementIssues.length} achievement issues\n`);
  return achievementCounts;
}

/**
 * Calculate percentages based on total user count
 */
function calculatePercentages(achievementCounts, totalUsers) {
  console.log('🔢 Calculating percentages...');

  for (const id in achievementCounts) {
    const count = achievementCounts[id].count;
    achievementCounts[id].percentage = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
  }

  console.log(`   Calculated percentages for ${Object.keys(achievementCounts).length} achievements\n`);
}

/**
 * Find existing achievement stats cache issue
 */
async function findStatsCacheIssue() {
  console.log('🔍 Looking for existing stats cache issue...');

  try {
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: 'achievement-stats',
      state: 'open',
      per_page: 1
    });

    if (data.length > 0) {
      console.log(`   Found existing cache issue #${data[0].number}\n`);
      return data[0];
    }

    console.log('   No existing cache issue found\n');
    return null;
  } catch (error) {
    console.error('❌ Failed to search for cache issue:', error.message);
    throw error;
  }
}

/**
 * Create or update stats cache issue
 */
async function saveStatsCacheIssue(stats, existingIssue) {
  const body = JSON.stringify(stats, null, 2);

  try {
    if (existingIssue) {
      console.log('🔄 Updating existing cache issue...');

      await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: existingIssue.number,
        body
      });

      console.log(`   ✅ Updated cache issue #${existingIssue.number}\n`);
      return existingIssue;
    } else {
      console.log('📝 Creating new cache issue...');

      const { data } = await octokit.rest.issues.create({
        owner,
        repo,
        title: '[Achievement Statistics]',
        body,
        labels: ['achievement-stats', 'automated']
      });

      console.log(`   ✅ Created cache issue #${data.number}\n`);
      return data;
    }
  } catch (error) {
    console.error('❌ Failed to save cache issue:', error.message);
    throw error;
  }
}

/**
 * Print top 10 most unlocked achievements
 */
function printTopAchievements(achievementCounts, achievementDefinitions) {
  console.log('🏅 Top 10 Most Unlocked Achievements:');
  console.log('─'.repeat(60));

  const sorted = Object.entries(achievementCounts)
    .sort((a, b) => b[1].percentage - a[1].percentage)
    .slice(0, 10);

  for (const [id, { count, percentage }] of sorted) {
    const def = achievementDefinitions.achievements.find((a) => a.id === id);
    if (def) {
      const percentStr = percentage.toFixed(1).padStart(5);
      const countStr = count.toString().padStart(4);
      console.log(`   ${def.icon} ${percentStr}% (${countStr} users) - ${def.title}`);
    }
  }

  console.log('─'.repeat(60) + '\n');
}

/**
 * Main calculation function
 */
async function calculateAchievementStats() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Achievement Statistics Calculation');
  console.log('='.repeat(60) + '\n');

  console.log(`📦 Repository: ${owner}/${repo}\n`);

  // 1. Load achievement definitions
  console.log('📋 Loading achievement definitions...');
  const achievementDefinitions = loadAchievementDefinitions();
  console.log(`   Loaded ${achievementDefinitions.achievements.length} achievements\n`);

  // 2. Fetch user snapshots (for total count)
  const userSnapshots = await fetchUserSnapshots();
  const totalUsers = userSnapshots.length;

  // 3. Fetch achievement issues
  const achievementIssues = await fetchAchievementIssues();

  // 4. Count unlocks per achievement
  const achievementCounts = countAchievementUnlocks(achievementIssues, achievementDefinitions);

  // 5. Calculate percentages
  calculatePercentages(achievementCounts, totalUsers);

  // 6. Build stats object
  const stats = {
    lastUpdated: new Date().toISOString(),
    totalUsers,
    achievements: achievementCounts
  };

  // 7. Save to cache issue
  const existingIssue = await findStatsCacheIssue();
  await saveStatsCacheIssue(stats, existingIssue);

  // 8. Print summary
  console.log('='.repeat(60));
  console.log('📈 Summary');
  console.log('='.repeat(60));
  console.log(`👥 Total Users:        ${totalUsers}`);
  console.log(`🏆 Total Achievements: ${achievementDefinitions.achievements.length}`);
  console.log(`📊 Issues Processed:   ${achievementIssues.length}`);
  console.log(`⏰ Last Updated:       ${stats.lastUpdated}`);
  console.log('='.repeat(60) + '\n');

  // 9. Print top achievements
  if (totalUsers > 0) {
    printTopAchievements(achievementCounts, achievementDefinitions);
  }

  console.log('✅ Achievement statistics calculation completed successfully!\n');
}

// Run the calculation
calculateAchievementStats().catch((error) => {
  console.error('\n❌ Fatal error during calculation:', error);
  process.exit(1);
});
