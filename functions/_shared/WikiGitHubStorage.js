const { createLogger } = require('../../src/utils/logger');
const logger = createLogger('WikiGitHubStorage');

/**
 * Wiki-Specific GitHub Storage Wrapper
 *
 * Extends the framework's generic GitHubStorage to add wiki-specific
 * issue title formatting based on DATA_TYPE_CONFIGS.
 *
 * This keeps the framework generic while allowing the parent project
 * to customize GitHub issue titles.
 */

import GitHubStorage from 'github-wiki-framework/src/services/storage/GitHubStorage.js';
import { DATA_TYPE_CONFIGS } from './utils.js';

class WikiGitHubStorage extends GitHubStorage {
  /**
   * Save grid submission with wiki-specific configuration
   * Overrides to pass wiki-specific config for grid submissions
   */
  async saveGridSubmission(username, userId, entityId, item) {
    const gridConfig = {
      typeLabel: 'soul-weapon-grids',
      titlePrefix: '[Soul Weapon Grid]',
      entityType: 'soul-weapon'
    };
    return super.saveGridSubmission(username, userId, entityId, item, gridConfig);
  }

  /**
   * Save data to an issue with wiki-specific title formatting
   * Overrides the parent save() method to inject custom titles
   */
  async save(type, username, userId, item) {
    if (!item.id) {
      throw new Error('Item must have an id field');
    }

    try {
      // Load existing items
      const items = await this.load(type, userId);

      // Find existing item
      const existingIndex = items.findIndex(i => i.id === item.id);

      if (existingIndex >= 0) {
        // Update existing
        items[existingIndex] = {
          ...item,
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Add new
        items.push({
          ...item,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      const issueBody = JSON.stringify(items, null, 2);

      // Find existing issue
      const typeLabel = type;
      const userLabel = this._createUserLabel(userId);
      const versionLabel = `data-version:${this.dataVersion}`;

      const allIssues = await this._findIssuesByLabels([typeLabel]);
      const existingIssue = this._findIssueByLabel(allIssues, userLabel);

      if (existingIssue) {
        // Update existing issue (including title to fix old format)
        const config = DATA_TYPE_CONFIGS[type];
        const titlePrefix = config?.titlePrefix || `[${type}]`;
        const issueTitle = `${titlePrefix} ${username}`;

        await this.octokit.rest.issues.update({
          owner: this.owner,
          repo: this.repo,
          issue_number: existingIssue.number,
          title: issueTitle,
          body: issueBody,
          labels: [typeLabel, userLabel, versionLabel],
        });

        logger.debug(`Updated issue for ${username}: ${issueTitle}`);
      } else {
        // Create new issue with wiki-specific title
        const config = DATA_TYPE_CONFIGS[type];
        const titlePrefix = config?.titlePrefix || `[${type}]`;
        const issueTitle = `${titlePrefix} ${username}`;

        await this.octokit.rest.issues.create({
          owner: this.owner,
          repo: this.repo,
          title: issueTitle,
          body: issueBody,
          labels: [typeLabel, userLabel, versionLabel],
        });

        logger.debug(`Created issue for ${username}: ${issueTitle}`);
      }

      return items;
    } catch (error) {
      console.error('[WikiGitHubStorage] Save error:', error);
      throw new Error(`Failed to save ${type} for user ${userId}: ${error.message}`);
    }
  }
}

export default WikiGitHubStorage;
