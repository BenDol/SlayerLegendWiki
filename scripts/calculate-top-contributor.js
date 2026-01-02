#!/usr/bin/env node

/**
 * Calculate Top Contributor Script
 *
 * This script calculates the top contributor for a wiki page based on commit history.
 * It's designed to be run by a GitHub Action after content changes.
 *
 * Usage:
 *   node scripts/calculate-top-contributor.js <sectionId> <pageId>
 *
 * Example:
 *   node scripts/calculate-top-contributor.js characters skills
 */

import { Octokit } from 'octokit';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Scoring weights (must match StarContributor.jsx)
const COMMIT_WEIGHT = 10;      // Each commit is worth 10 points
const ADDITION_WEIGHT = 0.5;   // Each line added is worth 0.5 points
const DELETION_WEIGHT = 0.5;   // Each line deleted is worth 0.5 points

/**
 * Calculate top contributor for a page
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} sectionId - Section ID (e.g., "characters")
 * @param {string} pageId - Page ID (e.g., "skills")
 * @param {string} contentPath - Path to content directory (e.g., "public/content")
 * @param {string} token - GitHub token
 * @returns {Promise<Object|null>} Top contributor object or null
 */
async function calculateTopContributor(owner, repo, sectionId, pageId, contentPath, token) {
  console.log(`[TopContributor] Calculating top contributor for ${sectionId}/${pageId}...`);

  const octokit = new Octokit({ auth: token });
  const filePath = `${contentPath}/${sectionId}/${pageId}.md`;

  try {
    // Fetch ALL commits for the file (up to 100, same as StarContributor component)
    console.log(`[TopContributor] Fetching commits for ${filePath}...`);
    const { data: commitList } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      path: filePath,
      per_page: 100,
    });

    console.log(`[TopContributor] Found ${commitList.length} commits`);

    if (commitList.length === 0) {
      console.log('[TopContributor] No commits found - returning null');
      return null;
    }

    // Fetch detailed commit info including stats in parallel
    console.log('[TopContributor] Fetching commit details...');
    const commitsWithStats = await Promise.all(
      commitList.map(async (commit) => {
        try {
          const { data: commitDetails } = await octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: commit.sha,
          });

          // Extract stats for the specific file being viewed
          const fileStats = commitDetails.files?.find(file => file.filename === filePath);
          const stats = fileStats ? {
            additions: fileStats.additions || 0,
            deletions: fileStats.deletions || 0,
            total: fileStats.changes || 0,
          } : {
            additions: 0,
            deletions: 0,
            total: 0,
          };

          return {
            sha: commit.sha,
            message: commit.commit.message,
            author: {
              name: commit.commit.author.name,
              email: commit.commit.author.email,
              username: commit.author?.login,
              userId: commit.author?.id,
            },
            stats,
          };
        } catch (err) {
          console.error(`Failed to fetch stats for commit ${commit.sha}:`, err);
          return null;
        }
      })
    );

    const commits = commitsWithStats.filter(c => c !== null);

    // Calculate contributor scores
    console.log('[TopContributor] Calculating scores...');
    const contributorScores = {};
    const contributorStats = {};

    // Get repository owner to exclude their commits
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const repoOwner = repoData.owner.login;

    commits.forEach((commit) => {
      const username = commit.author.username;
      const userId = commit.author.userId;

      // Skip repository owner commits
      if (username === repoOwner) {
        console.log(`[TopContributor] Skipping repository owner commit: ${commit.sha.substring(0, 7)}`);
        return;
      }

      // Skip commits without GitHub user (local commits)
      if (!username || !userId) {
        console.log(`[TopContributor] Skipping commit without GitHub user: ${commit.sha.substring(0, 7)}`);
        return;
      }

      const stats = commit.stats || { additions: 0, deletions: 0, total: 0 };

      // Calculate weighted score
      const score =
        (COMMIT_WEIGHT) +
        (stats.additions * ADDITION_WEIGHT) +
        (stats.deletions * DELETION_WEIGHT);

      // Initialize contributor if not exists
      if (!contributorScores[userId]) {
        contributorScores[userId] = {
          username,
          userId,
          score: 0,
          commits: 0,
          additions: 0,
          deletions: 0,
        };
      }

      // Update contributor stats
      contributorScores[userId].score += score;
      contributorScores[userId].commits += 1;
      contributorScores[userId].additions += stats.additions;
      contributorScores[userId].deletions += stats.deletions;
    });

    // Find top contributor
    const contributors = Object.values(contributorScores);

    if (contributors.length === 0) {
      console.log('[TopContributor] No valid contributors found - returning null');
      return null;
    }

    contributors.sort((a, b) => b.score - a.score);
    const topContributor = contributors[0];

    console.log(`[TopContributor] Top contributor: ${topContributor.username} (ID: ${topContributor.userId}, score: ${topContributor.score.toFixed(2)})`);
    console.log(`[TopContributor]   - Commits: ${topContributor.commits}`);
    console.log(`[TopContributor]   - Additions: ${topContributor.additions}`);
    console.log(`[TopContributor]   - Deletions: ${topContributor.deletions}`);

    return {
      username: topContributor.username,
      userId: topContributor.userId,
      score: Math.round(topContributor.score * 100) / 100, // Round to 2 decimal places
    };
  } catch (error) {
    console.error('[TopContributor] Failed to calculate top contributor:', error);
    throw error;
  }
}

/**
 * Update top contributor issue via bot service
 */
async function updateTopContributorIssue(owner, repo, sectionId, pageId, contributorData, token, botServiceUrl) {
  console.log(`[TopContributor] Updating top contributor issue for ${sectionId}/${pageId}...`);

  const response = await fetch(`${botServiceUrl}/update-top-contributor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      owner,
      repo,
      sectionId,
      pageId,
      contributorData,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update top contributor issue: ${error}`);
  }

  const result = await response.json();
  console.log('[TopContributor] Successfully updated top contributor issue');
  return result;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node calculate-top-contributor.js <sectionId> <pageId>');
    process.exit(1);
  }

  const [sectionId, pageId] = args;

  // Get environment variables
  const owner = process.env.GITHUB_REPOSITORY_OWNER || process.env.GITHUB_REPOSITORY?.split('/')[0];
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const token = process.env.GITHUB_TOKEN || process.env.WIKI_BOT_TOKEN;
  const contentPath = process.env.CONTENT_PATH || 'public/content';
  const botServiceUrl = process.env.BOT_SERVICE_URL || process.env.VITE_BOT_SERVICE_URL;

  if (!owner || !repo) {
    console.error('Error: GITHUB_REPOSITORY environment variable not set');
    process.exit(1);
  }

  if (!token) {
    console.error('Error: GITHUB_TOKEN or WIKI_BOT_TOKEN environment variable not set');
    process.exit(1);
  }

  try {
    // Calculate top contributor
    const topContributor = await calculateTopContributor(owner, repo, sectionId, pageId, contentPath, token);

    if (!topContributor) {
      console.log('[TopContributor] No top contributor to update (no commits or no valid contributors)');
      process.exit(0);
    }

    // Update the issue via bot service (if available)
    if (botServiceUrl) {
      await updateTopContributorIssue(owner, repo, sectionId, pageId, topContributor, token, botServiceUrl);
    } else {
      console.warn('[TopContributor] BOT_SERVICE_URL not set - skipping issue update');
      console.log('[TopContributor] Top contributor data:');
      console.log(JSON.stringify(topContributor, null, 2));
    }

    console.log('[TopContributor] Done!');
  } catch (error) {
    console.error('[TopContributor] Error:', error);
    process.exit(1);
  }
}

main();
