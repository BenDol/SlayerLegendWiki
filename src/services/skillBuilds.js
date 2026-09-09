import { getOctokit } from '../../wiki-framework/src/services/github/api.js';
import { createUserIdLabel } from '../../wiki-framework/src/utils/githubLabelUtils.js';
import { createLogger } from '../utils/logger';
import { eventBus, EventNames } from '../../wiki-framework/src/services/eventBus.js';
import { queueAchievementCheck } from '../../wiki-framework/src/services/achievements/achievementQueue.js';
import { findRecordIssue, getOrCreateIssue } from './github/issueLookup.js';

const logger = createLogger('SkillBuilds');

/**
 * Skill Builds Storage System - Slayer Legend Wiki
 * Stores user skill builds in GitHub Issues as a database
 *
 * This file was moved from the framework to the parent project as part of v2.0 refactoring.
 * The framework is now generic, so game-specific services belong in the parent project.
 *
 * Issue Format:
 * - Title: [Skill Builds] username
 * - Labels: skill-builds, user-id:12345, automated
 * - Body: JSON array of builds
 *
 * Build Format:
 * {
 *   id: "unique-build-id",
 *   name: "Build Name",
 *   maxSlots: 10,
 *   slots: [...],
 *   createdAt: "ISO date",
 *   updatedAt: "ISO date"
 * }
 *
 * Indexing:
 * - Primary: User ID label (user-id:12345) - permanent
 * - Fallback: Username in title - for legacy
 */

const BUILDS_LABEL = 'skill-builds'; // Must match the type used in storage
const BUILDS_TITLE_PREFIX = '[Skill Build]';
const MAX_BUILDS_PER_USER = 10; // Limit to prevent issue size bloat

/**
 * Locate the user's builds issue.
 * The user-id label pins the lookup to the user's own records; the title is
 * consulted when that misses so legacy issues (created before the label
 * existed) are still found and can be relabelled.
 * @private
 * @param {{confirmAbsence: boolean}} options - Reads pass false (a miss then costs one call); saves pass true
 */
function findUserBuildsIssue(octokit, owner, repo, username, userId, { confirmAbsence }) {
  return findRecordIssue(octokit, {
    owner,
    repo,
    labels: [BUILDS_LABEL],
    identityLabel: userId ? createUserIdLabel(userId) : null,
    fallbackTitle: `${BUILDS_TITLE_PREFIX} ${username}`,
    confirmAbsence,
    logger,
  });
}

/**
 * Get all builds for a specific user
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username
 * @param {number} [userId] - Optional GitHub user ID for faster lookup
 * @returns {Array} Array of builds or empty array if not found
 */
export async function getUserBuilds(owner, repo, username, userId = null) {
  try {
    const octokit = getOctokit();

    const { issue: buildsIssue } = await findUserBuildsIssue(octokit, owner, repo, username, userId, { confirmAbsence: false });

    if (buildsIssue) {
      logger.debug(
        userId
          ? `Found builds for user ${username} by ID: ${userId}`
          : `Found legacy builds for ${username} by title`
      );
    }

    if (!buildsIssue) {
      logger.debug(`No builds found for user: ${username}`);
      return [];
    }

    // Parse JSON from issue body
    try {
      const builds = JSON.parse(buildsIssue.body || '[]');
      logger.debug(`Loaded ${builds.length} builds for ${username}`);
      return Array.isArray(builds) ? builds : [];
    } catch (parseError) {
      logger.error(`Failed to parse builds data for ${username}`, { error: parseError });
      return [];
    }
  } catch (error) {
    logger.error(`Failed to get builds for ${username}`, { error });
    return [];
  }
}

/**
 * Save builds for a user (create or update issue)
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username
 * @param {number} userId - GitHub user ID
 * @param {Array} builds - Array of builds to save
 * @returns {Object} Created/updated issue
 */
export async function saveUserBuilds(owner, repo, username, userId, builds) {
  try {
    const octokit = getOctokit();

    // Validate builds array
    if (!Array.isArray(builds)) {
      throw new Error('Builds must be an array');
    }

    // Limit number of builds
    if (builds.length > MAX_BUILDS_PER_USER) {
      throw new Error(`Maximum ${MAX_BUILDS_PER_USER} builds allowed per user`);
    }

    const issueTitle = `${BUILDS_TITLE_PREFIX} ${username}`;
    const issueBody = JSON.stringify(builds, null, 2);
    const userIdLabel = userId ? createUserIdLabel(userId) : null;
    const labels = userIdLabel ? [BUILDS_LABEL, userIdLabel] : [BUILDS_LABEL];

    // One lookup decides update-vs-create. A legacy title-only issue is adopted
    // and relabelled; a new issue is created only once absence is confirmed.
    // Browser code never reconciles duplicates: that is the server's job, and
    // doing it here would let a stale client snapshot overwrite merged data.
    const lookup = await findUserBuildsIssue(octokit, owner, repo, username, userId, { confirmAbsence: true });

    if (lookup.issue) {
      logger.debug(`Updating builds for ${username}`, { issueNumber: lookup.issue.number });

      const { data: updatedIssue } = await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: lookup.issue.number,
        title: issueTitle,
        body: issueBody,
      });

      if (lookup.legacy && userIdLabel) {
        logger.debug(`Adding user-id label to legacy builds for ${username}`);
        await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: lookup.issue.number,
          labels: [userIdLabel],
        });
      }

      return updatedIssue;
    }

    const { issue, created } = await getOrCreateIssue(octokit, {
      owner,
      repo,
      labels,
      ...(userIdLabel ? { selectorLabel: userIdLabel } : { matchTitle: issueTitle }),
      title: issueTitle,
      body: issueBody,
      lock: true,
      lockReason: 'off-topic',
      precomputed: lookup,
      reconcile: false,
      logger,
    });

    if (created) {
      logger.debug(`Created new builds issue for ${username}${userIdLabel ? ` (ID: ${userId})` : ''}`, {
        issueNumber: issue.number,
      });
      return issue;
    }

    // A concurrent save created the issue first; this snapshot is the latest write
    logger.debug(`Updating builds for ${username}`, { issueNumber: issue.number });

    const { data: updatedIssue } = await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      title: issueTitle,
      body: issueBody,
    });

    return updatedIssue;
  } catch (error) {
    logger.error(`Failed to save builds for ${username}`, { error });
    throw error;
  }
}

/**
 * Add a build for a user
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username
 * @param {number} userId - GitHub user ID
 * @param {Object} build - Build to add
 * @returns {Object} Updated builds array
 */
export async function addUserBuild(owner, repo, username, userId, build) {
  const builds = await getUserBuilds(owner, repo, username, userId);

  // Generate unique ID if not provided
  if (!build.id) {
    build.id = `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add timestamps
  build.createdAt = new Date().toISOString();
  build.updatedAt = new Date().toISOString();

  // Check limit
  if (builds.length >= MAX_BUILDS_PER_USER) {
    throw new Error(`Maximum ${MAX_BUILDS_PER_USER} builds allowed. Please delete an old build first.`);
  }

  builds.push(build);
  await saveUserBuilds(owner, repo, username, userId, builds);
  logger.info(`Added build "${build.name}" for ${username}`);

  // Emit event for achievement system
  eventBus.emit(EventNames.USER_BUILD_SAVED, { username, userId, build });

  // Queue achievement checks for all build-related achievements
  if (userId && username) {
    const buildAchievements = [
      'first-build',           // First build created
      'build-collector',       // 10 builds
      'build-master',          // Max builds (10)
      'skill-theorist',        // Unique skill combinations
      'completionist',         // Variety of builds
      'innovative',            // Build with unique combo (8 skills)
      'min-maxer',             // Optimized build (8 slots filled)
    ];

    logger.info('Queueing build achievement checks', { userId, username, count: buildAchievements.length });

    buildAchievements.forEach(achievementId => {
      queueAchievementCheck(achievementId, {
        owner,
        repo,
        userId,
        username,
        delay: 2000, // Wait 2 seconds for GitHub Issues to sync
        retryDelay: 5000,
        maxRetries: 3,
      }).catch(error => {
        logger.error(`Failed to queue ${achievementId} achievement check`, { error: error.message });
      });
    });
  }

  return builds;
}

/**
 * Update a build for a user
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username
 * @param {number} userId - GitHub user ID
 * @param {string} buildId - Build ID to update
 * @param {Object} updatedBuild - Updated build data
 * @returns {Object} Updated builds array
 */
export async function updateUserBuild(owner, repo, username, userId, buildId, updatedBuild) {
  const builds = await getUserBuilds(owner, repo, username, userId);

  const buildIndex = builds.findIndex(b => b.id === buildId);
  if (buildIndex === -1) {
    throw new Error(`Build with ID ${buildId} not found`);
  }

  // Preserve original timestamps, update the updatedAt
  builds[buildIndex] = {
    ...updatedBuild,
    id: buildId,
    createdAt: builds[buildIndex].createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveUserBuilds(owner, repo, username, userId, builds);
  logger.info(`Updated build "${updatedBuild.name}" for ${username}`);

  // Emit event for achievement system
  eventBus.emit(EventNames.USER_BUILD_UPDATED, { username, userId, buildId, build: builds[buildIndex] });

  return builds;
}

/**
 * Delete a build for a user
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username
 * @param {number} userId - GitHub user ID
 * @param {string} buildId - Build ID to delete
 * @returns {Object} Updated builds array
 */
export async function deleteUserBuild(owner, repo, username, userId, buildId) {
  const builds = await getUserBuilds(owner, repo, username, userId);

  const filteredBuilds = builds.filter(b => b.id !== buildId);

  if (filteredBuilds.length === builds.length) {
    throw new Error(`Build with ID ${buildId} not found`);
  }

  await saveUserBuilds(owner, repo, username, userId, filteredBuilds);
  logger.info(`Deleted build ${buildId} for ${username}`);

  // Emit event for achievement system
  eventBus.emit(EventNames.USER_BUILD_DELETED, { username, userId, buildId });

  return filteredBuilds;
}
