import { getOctokit } from '../../wiki-framework/src/services/github/api.js';
import { createUserIdLabel } from '../../wiki-framework/src/utils/githubLabelUtils.js';
import { createLogger } from '../utils/logger';
import { eventBus, EventNames } from '../../wiki-framework/src/services/eventBus.js';
import { queueAchievementCheck } from '../../wiki-framework/src/services/achievements/achievementQueue.js';
import { deserializeSoulWeaponBuild } from '../utils/battleLoadoutSerializer.js';
import { findRecordIssue, getOrCreateIssue } from './github/issueLookup.js';

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
 * Locate the user's loadouts issue.
 * The user-id label pins the lookup to the user's own records; the title is
 * consulted when that misses so legacy issues (created before the label
 * existed) are still found and can be relabelled.
 * @private
 * @param {{confirmAbsence: boolean}} options - Reads pass false (a miss then costs one call); saves pass true
 */
function findUserLoadoutsIssue(octokit, owner, repo, username, userId, { confirmAbsence }) {
  return findRecordIssue(octokit, {
    owner,
    repo,
    labels: [LOADOUTS_LABEL],
    identityLabel: userId ? createUserIdLabel(userId) : null,
    fallbackTitle: `${LOADOUTS_TITLE_PREFIX} ${username}`,
    confirmAbsence,
    logger,
  });
}

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

    const { issue: loadoutsIssue } = await findUserLoadoutsIssue(octokit, owner, repo, username, userId, { confirmAbsence: false });

    if (loadoutsIssue) {
      logger.debug(
        userId
          ? `Found loadouts for user ${username} by ID: ${userId}`
          : `Found legacy loadouts for ${username} by title`
      );
    }

    if (!loadoutsIssue) {
      logger.debug(`No loadouts found for user: ${username}`);
      return [];
    }

    // Parse JSON from issue body
    try {
      const loadouts = JSON.parse(loadoutsIssue.body || '[]');
      logger.debug(`Loaded ${loadouts.length} loadouts for ${username}`);

      // Deserialize soul weapon builds (reconstruct shape objects from shapeIds)
      const shapesResponse = await fetch('/data/soul-weapon-engravings.json').catch(err => {
        logger.warn('Failed to load shapes for deserialization', { error: err });
        return null;
      });

      if (shapesResponse && shapesResponse.ok) {
        const shapesData = await shapesResponse.json();
        // The JSON file has shapes in a "shapes" property, not as a direct array
        const shapes = shapesData.shapes || [];

        if (shapes.length > 0) {
          // Deserialize each loadout's soul weapon build
          const deserializedLoadouts = loadouts.map(loadout => {
            if (loadout.soulWeaponBuild) {
              return {
                ...loadout,
                soulWeaponBuild: deserializeSoulWeaponBuild(loadout.soulWeaponBuild, shapes)
              };
            }
            return loadout;
          });

          logger.debug(`Deserialized ${deserializedLoadouts.filter(l => l.soulWeaponBuild).length} soul weapon builds`);
          return Array.isArray(deserializedLoadouts) ? deserializedLoadouts : [];
        }
      }

      // If shapes couldn't be loaded, return loadouts as-is (will have serialized soul weapon builds)
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

    const issueTitle = `${LOADOUTS_TITLE_PREFIX} ${username}`;
    const issueBody = JSON.stringify(loadouts, null, 2);
    const userIdLabel = userId ? createUserIdLabel(userId) : null;
    const labels = userIdLabel ? [LOADOUTS_LABEL, userIdLabel] : [LOADOUTS_LABEL];

    // One lookup decides update-vs-create. A legacy title-only issue is adopted
    // and relabelled; a new issue is created only once absence is confirmed.
    // Browser code never reconciles duplicates: that is the server's job, and
    // doing it here would let a stale client snapshot overwrite merged data.
    const lookup = await findUserLoadoutsIssue(octokit, owner, repo, username, userId, { confirmAbsence: true });

    if (lookup.issue) {
      logger.debug(`Updating loadouts for ${username}`, { issueNumber: lookup.issue.number });

      const { data: updatedIssue } = await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: lookup.issue.number,
        title: issueTitle,
        body: issueBody,
      });

      if (lookup.legacy && userIdLabel) {
        logger.debug(`Adding user-id label to legacy loadouts for ${username}`);
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
      logger.debug(`Created new loadouts issue for ${username}${userIdLabel ? ` (ID: ${userId})` : ''}`, {
        issueNumber: issue.number,
      });
      return issue;
    }

    // A concurrent save created the issue first; this snapshot is the latest write
    logger.debug(`Updating loadouts for ${username}`, { issueNumber: issue.number });

    const { data: updatedIssue } = await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      title: issueTitle,
      body: issueBody,
    });

    return updatedIssue;
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

  // Emit event for achievement system
  eventBus.emit(EventNames.USER_LOADOUT_SAVED, { username, userId, loadout });

  // Queue achievement checks for all loadout-related achievements
  if (userId && username) {
    const loadoutAchievements = [
      'first-loadout',         // First loadout created
      'loadout-expert',        // 10 loadouts
      'spirit-collector',      // 10 different spirits
      'strategist',            // Advanced tactical loadout (4+ slots filled)
      'collector',             // All spirit types collected
    ];

    logger.info('Queueing loadout achievement checks', { userId, username, count: loadoutAchievements.length });

    loadoutAchievements.forEach(achievementId => {
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

  // Emit event for achievement system
  eventBus.emit(EventNames.USER_LOADOUT_UPDATED, { username, userId, loadoutId, loadout: loadouts[loadoutIndex] });

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

  // Emit event for achievement system
  eventBus.emit(EventNames.USER_LOADOUT_DELETED, { username, userId, loadoutId });

  return filteredLoadouts;
}
