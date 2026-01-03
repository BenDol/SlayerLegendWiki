/**
 * Milestone Achievement Deciders
 * Custom milestone-related deciders for Slayer Legend Wiki
 */

import { getDonatorStatus } from '../../../../wiki-framework/src/services/github/donatorRegistry.js';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('MilestoneDeciders');

/**
 * Check if user is a donator
 * @param {Object} userData - User data from snapshot
 * @param {Object} context - Server context { octokit, owner, repo, userId, username }
 * @returns {Promise<boolean>} True if user has donated
 */
export async function donator(userData, context) {
  try {
    const { owner, repo, username, userId } = context;

    const donatorStatus = await getDonatorStatus(owner, repo, username, userId);

    if (donatorStatus && donatorStatus.isDonator === true) {
      logger.debug('User is a donator', { username });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Failed to check donator status', { username: context.username, error });
    return false;
  }
}
