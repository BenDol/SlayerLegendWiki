import { getOctokit } from '../../wiki-framework/src/services/github/api.js';
import { createUserIdLabel } from '../../wiki-framework/src/utils/githubLabelUtils.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('BattleLoadouts');

/**
 * Battle Loadouts Storage System - Slayer Legend Wiki
 * Stores user battle loadouts in GitHub Issues as a database
 *
 * This file was moved from the framework to the parent project as part of v2.0 refactoring.
 * The framework is now generic, so game-specific services belong in the parent project.
 *
 * Issue Format:
 * - Title: [Battle Loadouts] username
 * - Labels: battle-loadouts, user-id:12345, automated
 * - Body: JSON array of loadouts
 *
 * Loadout Format:
 * {
 *   id: "unique-loadout-id",
 *   name: "Loadout Name",
 *   skillBuild: {...},
 *   spirit: {...},
 *   skillStone: {...},
 *   promotionAbility: {...},
 *   familiar: {...},
 *   createdAt: "ISO date",
 *   updatedAt: "ISO date"
 * }
 *
 * Indexing:
 * - Primary: User ID label (user-id:12345) - permanent
 * - Fallback: Username in title - for legacy
 */

const LOADOUTS_LABEL = 'battle-loadouts'; // Must match the type used in storage
const LOADOUTS_TITLE_PREFIX = '[Battle Loadout]';
const MAX_LOADOUTS_PER_USER = 10; // Limit to prevent issue size bloat

/**
 * Get all loadouts for a specific user
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username
 * @param {number} [userId] - Optional GitHub user ID for faster lookup
 * @returns {Array} Array of loadouts or empty array if not found
 */
export async function getUserLoadouts(owner, repo, username, userId = null) {
  try {
    const octokit = getOctokit();

    // Search for the user's loadouts issue
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: LOADOUTS_LABEL,
      state: 'open',
      per_page: 100,
    });

    let loadoutsIssue = null;

    // First try: Search by user ID label (permanent identifier, preferred)
    if (userId) {
      loadoutsIssue = issues.find(issue =>
        issue.labels.some(label =>
          (typeof label === 'string' && label === `user-id:${userId}`) ||
          (typeof label === 'object' && label.name === `user-id:${userId}`)
        )
      );

      if (loadoutsIssue) {
        logger.debug(`Found loadouts for user ${username} by ID: ${userId}`);
      }
    }

    // Second try: Search by username in title (legacy or no user ID provided)
    if (!loadoutsIssue) {
      loadoutsIssue = issues.find(
        issue => issue.title === `${LOADOUTS_TITLE_PREFIX} ${username}`
      );

      if (loadoutsIssue) {
        logger.debug(`Found legacy loadouts for ${username} by title`);
      }
    }

    if (!loadoutsIssue) {
      logger.debug(`No loadouts found for user: ${username}`);
      return [];
    }

    // Parse JSON from issue body
    try {
      const loadouts = JSON.parse(loadoutsIssue.body || '[]');
      logger.debug(`Loaded ${loadouts.length} loadouts for ${username}`);
      return Array.isArray(loadouts) ? loadouts : [];
    } catch (parseError) {
      logger.error(`Failed to parse loadouts data for ${username}`, { error: parseError });
      return [];
    }
  } catch (error) {
    logger.error(`Failed to get loadouts for ${username}`, { error });
    return [];
  }
}

/**
 * Save loadouts for a user (create or update issue)
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username
 * @param {number} userId - GitHub user ID
 * @param {Array} loadouts - Array of loadouts to save
 * @returns {Object} Created/updated issue
 */
export async function saveUserLoadouts(owner, repo, username, userId, loadouts) {
  try {
    const octokit = getOctokit();

    // Validate loadouts array
    if (!Array.isArray(loadouts)) {
      throw new Error('Loadouts must be an array');
    }

    // Limit number of loadouts
    if (loadouts.length > MAX_LOADOUTS_PER_USER) {
      throw new Error(`Maximum ${MAX_LOADOUTS_PER_USER} loadouts allowed per user`);
    }

    // Search for existing loadouts issue
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: LOADOUTS_LABEL,
      state: 'open',
      per_page: 100,
    });

    let existingIssue = null;

    // First try: Search by user ID label
    if (userId) {
      existingIssue = issues.find(issue =>
        issue.labels.some(label =>
          (typeof label === 'string' && label === `user-id:${userId}`) ||
          (typeof label === 'object' && label.name === `user-id:${userId}`)
        )
      );
    }

    // Second try: Search by username in title
    if (!existingIssue) {
      existingIssue = issues.find(
        issue => issue.title === `${LOADOUTS_TITLE_PREFIX} ${username}`
      );
    }

    const issueTitle = `${LOADOUTS_TITLE_PREFIX} ${username}`;
    const issueBody = JSON.stringify(loadouts, null, 2);
    const userIdLabel = userId ? createUserIdLabel(userId) : null;

    if (existingIssue) {
      // Update existing loadouts
      logger.debug(`Updating loadouts for ${username}`, { issueNumber: existingIssue.number });

      const { data: updatedIssue } = await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: existingIssue.number,
        title: issueTitle,
        body: issueBody,
      });

      // Add user ID label if missing (migration for legacy)
      if (userIdLabel) {
        const hasUserIdLabel = existingIssue.labels.some(label =>
          (typeof label === 'string' && label.startsWith('user-id:')) ||
          (typeof label === 'object' && label.name?.startsWith('user-id:'))
        );

        if (!hasUserIdLabel) {
          logger.debug(`Adding user-id label to legacy loadouts for ${username}`);
          await octokit.rest.issues.addLabels({
            owner,
            repo,
            issue_number: existingIssue.number,
            labels: [userIdLabel],
          });
        }
      }

      return updatedIssue;
    } else {
      // Create new loadouts issue
      logger.debug(`Creating new loadouts issue for ${username}${userIdLabel ? ` (ID: ${userId})` : ''}`);

      const labels = [LOADOUTS_LABEL];
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
        logger.debug(`Locked loadouts issue for ${username} to collaborators only`);
      } catch (lockError) {
        logger.warn(`Failed to lock issue for ${username}`, { error: lockError.message });
      }

      return newIssue;
    }
  } catch (error) {
    logger.error(`Failed to save loadouts for ${username}`, { error });
    throw error;
  }
}

/**
 * Add a loadout for a user
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username
 * @param {number} userId - GitHub user ID
 * @param {Object} loadout - Loadout to add
 * @returns {Object} Updated loadouts array
 */
export async function addUserLoadout(owner, repo, username, userId, loadout) {
  const loadouts = await getUserLoadouts(owner, repo, username, userId);

  // Generate unique ID if not provided
  if (!loadout.id) {
    loadout.id = `loadout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add timestamps
  loadout.createdAt = new Date().toISOString();
  loadout.updatedAt = new Date().toISOString();

  // Check limit
  if (loadouts.length >= MAX_LOADOUTS_PER_USER) {
    throw new Error(`Maximum ${MAX_LOADOUTS_PER_USER} loadouts allowed. Please delete an old loadout first.`);
  }

  loadouts.push(loadout);
  await saveUserLoadouts(owner, repo, username, userId, loadouts);
  logger.info(`Added loadout "${loadout.name}" for ${username}`);

  return loadouts;
}

/**
 * Update a loadout for a user
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username
 * @param {number} userId - GitHub user ID
 * @param {string} loadoutId - Loadout ID to update
 * @param {Object} updatedLoadout - Updated loadout data
 * @returns {Object} Updated loadouts array
 */
export async function updateUserLoadout(owner, repo, username, userId, loadoutId, updatedLoadout) {
  const loadouts = await getUserLoadouts(owner, repo, username, userId);

  const loadoutIndex = loadouts.findIndex(l => l.id === loadoutId);
  if (loadoutIndex === -1) {
    throw new Error(`Loadout with ID ${loadoutId} not found`);
  }

  // Preserve original timestamps, update the updatedAt
  loadouts[loadoutIndex] = {
    ...updatedLoadout,
    id: loadoutId,
    createdAt: loadouts[loadoutIndex].createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveUserLoadouts(owner, repo, username, userId, loadouts);
  logger.info(`Updated loadout "${updatedLoadout.name}" for ${username}`);

  return loadouts;
}

/**
 * Delete a loadout for a user
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - GitHub username
 * @param {number} userId - GitHub user ID
 * @param {string} loadoutId - Loadout ID to delete
 * @returns {Object} Updated loadouts array
 */
export async function deleteUserLoadout(owner, repo, username, userId, loadoutId) {
  const loadouts = await getUserLoadouts(owner, repo, username, userId);

  const filteredLoadouts = loadouts.filter(l => l.id !== loadoutId);

  if (filteredLoadouts.length === loadouts.length) {
    throw new Error(`Loadout with ID ${loadoutId} not found`);
  }

  await saveUserLoadouts(owner, repo, username, userId, filteredLoadouts);
  logger.info(`Deleted loadout ${loadoutId} for ${username}`);

  return filteredLoadouts;
}
