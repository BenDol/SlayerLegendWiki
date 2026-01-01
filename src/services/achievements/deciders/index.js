/**
 * Custom Achievement Deciders
 *
 * Game-specific deciders for Slayer Legend Wiki.
 * These extend the framework's default deciders.
 */

import * as gameProgress from './gameProgress.js';
import * as milestone from './milestone.js';

/**
 * Custom decider registry
 * Maps achievement IDs to decider functions
 */
export const customDeciders = {
  // Game progress achievements - Build related
  'first-build': gameProgress.firstBuild,
  'build-collector': gameProgress.buildCollector,
  'build-master': gameProgress.buildMaster,
  'skill-theorist': gameProgress.skillTheorist,
  'completionist': gameProgress.completionist,
  'innovative': gameProgress.innovative,
  'min-maxer': gameProgress.minMaxer,

  // Game progress achievements - Loadout related
  'first-loadout': gameProgress.firstLoadout,
  'loadout-expert': gameProgress.loadoutExpert,
  'strategist': gameProgress.strategist,

  // Game progress achievements - Spirit related
  'spirit-collector': gameProgress.spiritCollector,
  'collector': gameProgress.collector,

  // Game progress achievements - Engraving related
  'engraving-expert': gameProgress.engravingExpert,

  // Social achievements - Game related
  'build-sharer': gameProgress.buildSharer,
  'popular-builder': gameProgress.popularBuilder,

  // Milestone achievements
  'donator': milestone.donator,
};

/**
 * Decider function signature:
 * @param {Object} userData - User data from snapshot { user, stats, pullRequests, userId, username }
 * @param {Object} context - Server context { octokit, owner, repo, userId, username }
 * @returns {Promise<boolean>} - True if achievement should be unlocked
 */
