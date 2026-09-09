/**
 * Wiki-Specific GitHub Storage Wrapper
 *
 * Extends the framework's generic GitHubStorage to add wiki-specific issue
 * title formatting based on DATA_TYPE_CONFIGS, and routes every issue lookup
 * through src/services/github/issueLookup.js so that:
 *
 *   - a user's record is found by its user-id label (no 100-issue page limit,
 *     no scan of every record of the type);
 *   - a record is only created once GitHub has confirmed it does not exist
 *     (the REST list alone returned [] for existing records in 12-32 % of
 *     calls, measured 2026-09-09);
 *   - duplicates left behind by earlier races are merged into the oldest
 *     issue and closed.
 *
 * This keeps the framework generic while allowing the parent project to
 * customize GitHub issue titles and lookup strategy.
 */

import GitHubStorage from 'github-wiki-framework/src/services/storage/GitHubStorage.js';
import { DATA_TYPE_CONFIGS } from './utils.js';
import { createLogger } from '../../src/utils/logger.js';
import {
  createJsonArrayMerge,
  findCanonicalIssue,
  findIssues,
  getOrCreateIssue,
  parseJsonArray,
  reconcileDuplicates,
} from '../../src/services/github/issueLookup.js';

const logger = createLogger('WikiGitHubStorage');
const lookupLogger = logger.child('IssueLookup');

const GRID_SUBMISSIONS_TYPE_LABEL = 'soul-weapon-grids';
const GRID_SUBMISSIONS_TITLE_PREFIX = '[Soul Weapon Grid]';
const GRID_SUBMISSIONS_ENTITY_TYPE = 'soul-weapon';

const COMMENTS_PAGE_SIZE = 100;
/** Hard ceiling on comment pages read per entity issue (1,000 submissions). */
const COMMENTS_MAX_PAGES = 10;

/** Delay before an in-flight save key is released, covering GitHub's write propagation. */
const SAVE_RELEASE_DELAY_MS = 2000;

/**
 * Union two item arrays. Items from `extra` win on conflict: they are the
 * write that lost a creation race and therefore the most recent. Positions
 * follow first appearance; items without an id are de-duplicated by value.
 */
function mergeItemsById(base, extra) {
  const keyOf = item => (item?.id !== undefined && item?.id !== null ? `id:${item.id}` : `value:${JSON.stringify(item)}`);
  const merged = new Map();
  for (const item of [...base, ...extra]) {
    merged.set(keyOf(item), item);
  }
  return [...merged.values()];
}

/**
 * Re-wrap an error with storage context while keeping the lookup module's
 * `code` (e.g. ABSENCE_UNCONFIRMED) visible to the handlers that map it to a
 * retryable response.
 */
function storageError(message, error) {
  const wrapped = new Error(`${message}: ${error.message}`);
  if (error?.code) wrapped.code = error.code;
  wrapped.cause = error;
  return wrapped;
}

class WikiGitHubStorage extends GitHubStorage {
  /**
   * @param {Object} config - See GitHubStorage
   * @param {string} [config.botLogin] - Bot account login; duplicate reconciliation only closes its issues
   */
  constructor(config) {
    super(config);
    this.botLogin = config.botLogin || null;
  }

  _versionLabel() {
    return `data-version:${this.dataVersion}`;
  }

  _issueTitle(type, username) {
    const config = DATA_TYPE_CONFIGS[type];
    const titlePrefix = config?.titlePrefix || `[${type}]`;
    return `${titlePrefix} ${username}`;
  }

  _itemsOf(issue) {
    return parseJsonArray(issue?.body) ?? [];
  }

  /**
   * Every open issue carrying all `labels`, across all pages.
   * @override
   * @private
   */
  async _findIssuesByLabels(labels) {
    const { issues } = await findIssues(this.octokit, {
      owner: this.owner,
      repo: this.repo,
      labels,
      state: 'open',
      logger: lookupLogger,
    });
    return issues;
  }

  /**
   * The user's record issue for `type`: oldest wins, duplicates are merged
   * into it and closed. The full lookup result is returned so a caller that
   * goes on to create can reuse it instead of confirming absence twice.
   * @private
   * @returns {Promise<{issue: Object|null, duplicates: Object[], confirmedAbsent: boolean}>}
   */
  async _findUserIssue(type, userId) {
    const userLabel = this._createUserLabel(userId);
    const result = await findCanonicalIssue(this.octokit, {
      owner: this.owner,
      repo: this.repo,
      labels: [type, userLabel],
      selectorLabel: userLabel,
      logger: lookupLogger,
    });

    if (result.issue && result.duplicates.length > 0) {
      await reconcileDuplicates(this.octokit, {
        owner: this.owner,
        repo: this.repo,
        canonical: result.issue,
        duplicates: result.duplicates,
        merge: createJsonArrayMerge(this.octokit, { owner: this.owner, repo: this.repo, logger: lookupLogger }),
        botLogin: this.botLogin,
        logger: lookupLogger,
      });
    }

    return result;
  }

  /**
   * The entity issue holding comment-based submissions: oldest wins; empty
   * duplicates are closed, non-empty ones are reported for manual merging.
   * @private
   */
  async _findEntityIssue(typeLabel, entityLabel) {
    const result = await findCanonicalIssue(this.octokit, {
      owner: this.owner,
      repo: this.repo,
      labels: [typeLabel, entityLabel],
      selectorLabel: entityLabel,
      logger: lookupLogger,
    });

    if (result.issue && result.duplicates.length > 0) {
      await reconcileDuplicates(this.octokit, {
        owner: this.owner,
        repo: this.repo,
        canonical: result.issue,
        duplicates: result.duplicates,
        isEmpty: issue => (issue.comments ?? 0) === 0,
        botLogin: this.botLogin,
        logger: lookupLogger,
      });
    }

    return result.issue;
  }

  /**
   * All comments on an issue, across pages.
   * @private
   */
  async _listAllComments(issueNumber) {
    const comments = [];
    for (let page = 1; page <= COMMENTS_MAX_PAGES; page++) {
      const { data } = await this.octokit.rest.issues.listComments({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        per_page: COMMENTS_PAGE_SIZE,
        page,
      });
      comments.push(...data);
      if (data.length < COMMENTS_PAGE_SIZE) break;
    }
    return comments;
  }

  /**
   * Load a user's items for `type`.
   * @override
   */
  async load(type, userId) {
    try {
      const { issue } = await this._findUserIssue(type, userId);
      return issue ? this._itemsOf(issue) : [];
    } catch (error) {
      logger.error('Load error', { error });
      throw storageError(`Failed to load ${type} for user ${userId}`, error);
    }
  }

  /**
   * Save an item into the user's record issue with wiki-specific title
   * formatting. One lookup serves both the read-modify-write and the
   * create-or-update decision; the issue is only created once its absence
   * is confirmed.
   * @override
   */
  async save(type, username, userId, item) {
    if (!item.id) {
      throw new Error('Item must have an id field');
    }

    // Create a unique key for this save operation
    const saveKey = `${type}:${userId}`;

    // Check if there's already a save in progress for this user+type
    if (this._pendingSaveRequests.has(saveKey)) {
      logger.debug(`Waiting for in-flight save request for ${saveKey}...`);
      // Wait for the in-flight request to complete, then retry
      try {
        await this._pendingSaveRequests.get(saveKey);
      } catch (error) {
        // Ignore errors from the previous request, we'll try again
      }
      // Clear the pending request and try again (the second request may have different data)
      this._pendingSaveRequests.delete(saveKey);
      return this.save(type, username, userId, item);
    }

    // Create a new save promise and track it
    const savePromise = (async () => {
      try {
        const typeLabel = type;
        const userLabel = this._createUserLabel(userId);
        const versionLabel = this._versionLabel();
        const issueTitle = this._issueTitle(type, username);
        const labels = [typeLabel, userLabel, versionLabel];

        const lookup = await this._findUserIssue(type, userId);
        const existingIssue = lookup.issue;
        const items = existingIssue ? this._itemsOf(existingIssue) : [];

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

        if (existingIssue) {
          // Update existing issue (title fixes old formats, labels add the version label if missing)
          await this.octokit.rest.issues.update({
            owner: this.owner,
            repo: this.repo,
            issue_number: existingIssue.number,
            title: issueTitle,
            body: issueBody,
            labels,
          });

          logger.debug(`Updated issue for ${username}: ${issueTitle}`);
          return items;
        }

        const { issue, created } = await getOrCreateIssue(this.octokit, {
          owner: this.owner,
          repo: this.repo,
          labels: [typeLabel, userLabel],
          createLabels: labels,
          selectorLabel: userLabel,
          title: issueTitle,
          body: issueBody,
          precomputed: lookup,
          merge: createJsonArrayMerge(this.octokit, { owner: this.owner, repo: this.repo, logger: lookupLogger }),
          botLogin: this.botLogin,
          logger: lookupLogger,
        });

        if (created) {
          logger.debug(`Created issue for ${username}: ${issueTitle}`);
          return items;
        }

        // A concurrent save created the issue first: fold our items into it
        const merged = mergeItemsById(this._itemsOf(issue), items);
        await this.octokit.rest.issues.update({
          owner: this.owner,
          repo: this.repo,
          issue_number: issue.number,
          title: issueTitle,
          body: JSON.stringify(merged, null, 2),
          labels,
        });

        logger.debug(`Merged save into concurrently created issue for ${username}: ${issueTitle}`);
        return merged;
      } catch (error) {
        logger.error('Save error', { error });
        throw storageError(`Failed to save ${type} for user ${userId}`, error);
      } finally {
        // Clean up the pending request after a short delay to handle eventual consistency
        setTimeout(() => {
          this._pendingSaveRequests.delete(saveKey);
        }, SAVE_RELEASE_DELAY_MS);
      }
    })();

    // Track this save request
    this._pendingSaveRequests.set(saveKey, savePromise);

    return savePromise;
  }

  /**
   * Delete an item from the user's record issue; the issue is closed when
   * it becomes empty.
   * @override
   */
  async delete(type, username, userId, deleteId) {
    try {
      const { issue } = await this._findUserIssue(type, userId);
      if (!issue) {
        throw new Error('Issue not found');
      }

      const items = this._itemsOf(issue);
      const itemIndex = items.findIndex(i => i.id === deleteId);
      if (itemIndex === -1) {
        throw new Error('Item not found');
      }

      items.splice(itemIndex, 1);

      if (items.length === 0) {
        // Close empty issue
        await this.octokit.rest.issues.update({
          owner: this.owner,
          repo: this.repo,
          issue_number: issue.number,
          state: 'closed',
        });

        logger.info(`Closed empty issue for ${username}`);
      } else {
        // Update issue with remaining items
        await this.octokit.rest.issues.update({
          owner: this.owner,
          repo: this.repo,
          issue_number: issue.number,
          body: JSON.stringify(items, null, 2),
          labels: [type, this._createUserLabel(userId), this._versionLabel()],
        });

        logger.info(`Updated issue for ${username}`);
      }

      return items;
    } catch (error) {
      logger.error('Delete error', { error });
      throw storageError(`Failed to delete ${type} for user ${userId}`, error);
    }
  }

  /**
   * Load grid submissions (comments on the weapon's entity issue).
   * @override
   */
  async loadGridSubmissions(entityId) {
    try {
      const entityLabel = this._createEntityLabel(entityId);
      const entityIssue = await this._findEntityIssue(GRID_SUBMISSIONS_TYPE_LABEL, entityLabel);

      if (!entityIssue) {
        return [];
      }

      const comments = await this._listAllComments(entityIssue.number);
      return comments.map(comment => this._parseJSON(comment.body)).filter(Boolean);
    } catch (error) {
      logger.error('Load comments error', { error });
      throw storageError(`Failed to load comments for entity ${entityId}`, error);
    }
  }

  /**
   * Save a grid submission as a comment on the weapon's entity issue,
   * creating the entity issue only once its absence is confirmed.
   * @override
   */
  async saveGridSubmission(username, userId, entityId, item) {
    if (!item.id) {
      throw new Error('Item must have an id field');
    }

    try {
      const entityLabel = this._createEntityLabel(entityId);

      const { issue: entityIssue, created } = await getOrCreateIssue(this.octokit, {
        owner: this.owner,
        repo: this.repo,
        labels: [GRID_SUBMISSIONS_TYPE_LABEL, entityLabel],
        createLabels: [entityLabel, this._versionLabel(), GRID_SUBMISSIONS_TYPE_LABEL],
        selectorLabel: entityLabel,
        title: `${GRID_SUBMISSIONS_TITLE_PREFIX} ${GRID_SUBMISSIONS_ENTITY_TYPE}-${entityId}`,
        body: `Storage for ${GRID_SUBMISSIONS_ENTITY_TYPE} grid submissions: ${entityId}`,
        isEmpty: issue => (issue.comments ?? 0) === 0,
        botLogin: this.botLogin,
        logger: lookupLogger,
      });

      if (created) {
        logger.info(`Created entity issue for ${entityId}`);
      }

      const submissionData = {
        ...item,
        username,
        userId,
        entityId,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Find the user's existing comment for this item
      const comments = await this._listAllComments(entityIssue.number);
      const userComment = comments.find(comment => {
        const data = this._parseJSON(comment.body);
        return data && data.userId === userId && data.id === item.id;
      });

      if (userComment) {
        await this.octokit.rest.issues.updateComment({
          owner: this.owner,
          repo: this.repo,
          comment_id: userComment.id,
          body: JSON.stringify(submissionData, null, 2),
        });

        logger.info(`Updated comment for ${username} on entity ${entityId}`);
      } else {
        await this.octokit.rest.issues.createComment({
          owner: this.owner,
          repo: this.repo,
          issue_number: entityIssue.number,
          body: JSON.stringify(submissionData, null, 2),
        });

        logger.info(`Created comment for ${username} on entity ${entityId}`);
      }

      return submissionData;
    } catch (error) {
      logger.error('Save comment error', { error });
      throw storageError(`Failed to save comment for entity ${entityId}`, error);
    }
  }
}

export default WikiGitHubStorage;
