import { createLogger } from '../../../src/utils/logger.js';
import {
  findCanonicalIssue,
  findIssues,
  findRecordIssue,
  getIssue,
  getOrCreateIssue,
  normalizeLabels,
  reconcileDuplicates,
} from '../../../src/services/github/issueLookup.js';
import { DATA_TYPE_CONFIGS, absenceUnconfirmedResponse, isAbsenceUnconfirmed } from '../utils.js';
const logger = createLogger('GithubBot');
const lookupLogger = logger.child('IssueLookup');

// ============================================================================
// Issue-backed record lookups
//
// Every read of an issue that acts as a database record goes through
// src/services/github/issueLookup.js: GraphQL first, the REST list only as
// the absence cross-check, lowest issue number wins, and reads never create.
// The REST list alone returned [] for existing records in 12-32 % of calls
// (measured 2026-09-09), which is how the duplicate index issues were born.
// ============================================================================

const ACHIEVEMENTS_LABEL = 'achievements';
const USER_SNAPSHOT_LABEL = 'user-snapshot';
const AUTOMATED_LABEL = 'automated';
const RECORD_LOCK_REASON = 'off-topic';

// Labels of the trusted account/role records (mirrors admin.js, donatorRegistry.js
// and prestige.js). Declared once so the reserved-label denylist and the ban-list
// lookup cannot drift apart.
const ADMIN_LIST_LABEL = 'wiki-admin-list';
const BAN_LIST_LABEL = 'wiki-ban-list';
const DONATOR_LABEL = 'donator';
const PRESTIGE_CACHE_LABEL = 'prestige-cache';

/** Login of the bot account; reconciliation only ever closes the bot's own issues. */
function getBotLogin(adapter) {
  return adapter.getEnv('WIKI_BOT_USERNAME') || adapter.getEnv('VITE_WIKI_BOT_USERNAME') || null;
}

/**
 * Labels that identify bot-managed records. `create-comment-issue` is an
 * unauthenticated action, so it must never mint an issue that the record
 * lookups would adopt or merge.
 */
const RESERVED_RECORD_LABELS = Object.freeze(
  new Set(
    [
      'content-creator-index',
      ACHIEVEMENTS_LABEL,
      USER_SNAPSHOT_LABEL,
      'highscore-cache',
      'top-contributor',
      'email-verification',
      'soul-weapon-grids',
      // Trusted account/role records: the admin & ban lists, donator badges and
      // the prestige cache. Blocking these labels stops create-comment-issue from
      // minting an issue that admin.js / donatorRegistry.js / prestige.js trust.
      ADMIN_LIST_LABEL,
      BAN_LIST_LABEL,
      DONATOR_LABEL,
      PRESTIGE_CACHE_LABEL,
      ...Object.values(DATA_TYPE_CONFIGS).map((config) => config?.label).filter(Boolean),
    ].map((label) => label.toLowerCase())
  )
);
const RESERVED_RECORD_LABEL_PREFIXES = Object.freeze(['user-id:', 'data-version:', 'wiki-admin:', 'weapon-id:']);

/** The first label that would let an anonymous caller forge a bot-managed record, or null. */
function findReservedLabel(labels) {
  return (
    normalizeLabels(labels).find((label) => {
      const lower = label.toLowerCase();
      return RESERVED_RECORD_LABELS.has(lower) || RESERVED_RECORD_LABEL_PREFIXES.some((prefix) => lower.startsWith(prefix));
    }) ?? null
  );
}

/**
 * Title prefixes of bot-managed records. Defence in depth on top of the label
 * denylist: even with a permitted label, `create-comment-issue` must not forge an
 * issue whose title matches a trusted record (some records fall back to a
 * title-match lookup). Compared case-insensitively against the trimmed title.
 */
const RESERVED_RECORD_TITLE_PREFIXES = Object.freeze([
  '[admin list',
  '[ban list',
  '[banned users',
  '[donator]',
  '[user snapshot]',
  '[achievements]',
  '[top contributor]',
  '[content creator index',
  '[prestige',
]);

/** The reserved title prefix a title starts with, or null. */
function findReservedTitle(title) {
  const lower = String(title || '').trim().toLowerCase();
  return RESERVED_RECORD_TITLE_PREFIXES.find((prefix) => lower.startsWith(prefix)) ?? null;
}

/**
 * Labels that mark an issue as a bot-managed comment/index container that the
 * generic `update-issue` / `create-comment` verbs are allowed to modify. These
 * are the only issues those verbs legitimately touch (build-share index and page
 * comment issues); everything else - admin list, donator, snapshots, etc. - is
 * off limits to the public endpoint.
 */
const MANAGED_ISSUE_LABELS = Object.freeze(new Set(['build-share-index', 'wiki-comments']));

/**
 * Authorize a write to an existing issue by the generic bot verbs.
 *
 * The bot token can write to every issue in the repo, so `update-issue` and
 * `create-comment` must not accept an arbitrary issue number from the client
 * (that path let anyone rewrite the admin-list issue). An issue may be modified
 * only when it was authored by the bot AND carries a managed container label.
 *
 * @returns {Promise<object|null>} an error response to return, or null when authorized.
 */
async function assertBotManagedIssue(adapter, octokit, owner, repo, issueNumber, verb) {
  const botLogin = getBotLogin(adapter);
  if (!botLogin) {
    logger.error(`${verb}: WIKI_BOT_USERNAME not configured - refusing to write without an author check`);
    return adapter.createJsonResponse(503, { error: 'Bot username not configured' });
  }

  let issue;
  try {
    ({ data: issue } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber }));
  } catch (error) {
    if (error.status === 404) {
      return adapter.createJsonResponse(404, { error: `Issue #${issueNumber} not found` });
    }
    throw error;
  }

  if (!issue.user || issue.user.login !== botLogin) {
    logger.warn(`${verb}: refused - issue #${issueNumber} authored by ${issue.user?.login ?? 'unknown'}, not the bot`);
    return adapter.createJsonResponse(403, {
      error: 'This issue is not a bot-managed record and cannot be modified through this endpoint',
    });
  }

  const labelNames = (issue.labels || [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter(Boolean)
    .map((name) => name.toLowerCase());
  const isManaged = labelNames.some((name) => MANAGED_ISSUE_LABELS.has(name));
  if (!isManaged) {
    logger.warn(`${verb}: refused - issue #${issueNumber} carries no managed label (${labelNames.join(', ') || 'none'})`);
    return adapter.createJsonResponse(403, {
      error: 'This issue is not a bot-managed record and cannot be modified through this endpoint',
    });
  }

  return null; // authorized
}

// ============================================================================
// Layer B - caller identity for the verbs that write through the bot on a
// caller's behalf. Layer A above constrains WHAT those verbs may touch; this
// establishes WHO is asking, so bans and abuse controls can apply.
// ============================================================================

/** Actions that create/modify content through the bot on behalf of the caller. */
const IDENTITY_SCOPED_ACTIONS = Object.freeze(new Set(['create-comment', 'update-issue', 'create-comment-issue']));

/** Pages of ban-list issues to walk (there is normally one per branch). */
const BAN_LIST_MAX_PAGES = 2;
/** How long a parsed ban list is reused before it is re-read from GitHub. */
const BAN_LIST_CACHE_TTL_MS = 60 * 1000;
/** Parsed ban entries per `owner/repo`; the last good read is kept for fallback. */
const banListCache = createTtlCache(BAN_LIST_CACHE_TTL_MS);
const lastKnownBanEntries = new Map();

/** Test seam: clear the per-isolate identity caches so tests do not leak state. */
export function __resetIdentityCachesForTests() {
  banListCache.clear();
  lastKnownBanEntries.clear();
}

/**
 * Load the merged entries of every bot-managed ban list. Matched by the reserved
 * `wiki-ban-list` label plus bot authorship - never by title, which the framework
 * owns (it currently writes "[Ban List]"). Uses the shared record parser so the
 * ban format has a single source of truth.
 * @returns {Promise<Array<Object>>} ban entries ({ username, userId, ... })
 */
async function loadBanEntries(adapter, octokit, owner, repo) {
  const key = `${owner}/${repo}`;
  const cached = banListCache.get(key);
  if (cached) return cached;

  const botLogin = getBotLogin(adapter);
  const { issues } = await findIssues(octokit, {
    owner,
    repo,
    labels: [BAN_LIST_LABEL],
    state: 'open',
    maxPages: BAN_LIST_MAX_PAGES,
    confirmAbsence: false,
    logger: lookupLogger,
  });
  const entries = issues
    .filter((issue) => !botLogin || issue.user?.login === botLogin)
    .flatMap((issue) => parseUserListFromIssue(issue.body || ''));

  banListCache.set(key, entries);
  lastKnownBanEntries.set(key, entries);
  return entries;
}

/**
 * Whether the identified caller appears on any bot-managed ban list.
 *
 * On a read failure the last successfully loaded list is used; only when no list
 * has ever been read does the check fail OPEN (logged), so a transient GitHub
 * error cannot lock every signed-in user out of commenting - and Layer A still
 * bounds what an unbanned-by-mistake caller can do.
 */
async function isCallerBanned(adapter, octokit, owner, repo, user) {
  let entries;
  try {
    entries = await loadBanEntries(adapter, octokit, owner, repo);
  } catch (error) {
    entries = lastKnownBanEntries.get(`${owner}/${repo}`);
    if (!entries) {
      logger.warn('Ban-list check failed with no cached list; allowing the request', { error: error.message });
      return false;
    }
    logger.warn('Ban-list refresh failed; using the last known list', { error: error.message });
  }

  const login = String(user.login || '').toLowerCase();
  const userId = user.id != null ? Number(user.id) : null;
  return entries.some((entry) => {
    if (userId != null && entry.userId != null && Number(entry.userId) === userId) return true;
    return entry.username != null && String(entry.username).toLowerCase() === login;
  });
}

/**
 * Resolve and validate the caller for an identity-scoped action.
 *
 * Verify-if-present: when an Authorization header is supplied it must be a
 * valid GitHub token and the user must not be banned. A missing header is
 * accepted (the legacy anonymous path, still bounded by Layer A) unless
 * `features.botSecurity.requireIdentity` is enabled in wiki-config.json.
 * That flag must stay off until every client caller of these verbs is
 * login-gated and forwards the user's token.
 *
 * @returns {Promise<object|null>} an error response to return, or null to proceed.
 */
async function enforceCallerIdentity(adapter, configAdapter, headers, octokit, owner, repo, action) {
  const authHeader = headers?.authorization || headers?.Authorization;
  // The flag comes from wiki-config.json or, because the Cloudflare default-config
  // fallback carries no `features`, from the environment (BOT_REQUIRE_IDENTITY=true).
  const requireIdentity =
    adapter.getEnv('BOT_REQUIRE_IDENTITY') === 'true' ||
    configAdapter?.getWikiConfig?.()?.features?.botSecurity?.requireIdentity === true;

  if (!authHeader) {
    if (requireIdentity) {
      logger.warn(`${action}: refused - identity required but no Authorization header`);
      return adapter.createJsonResponse(401, { error: 'Authentication required' });
    }
    return null;
  }

  // Same case-insensitive "Bearer <token>" parsing as every other handler.
  const userToken = adapter.getAuthToken();
  if (!userToken) {
    return adapter.createJsonResponse(401, { error: 'Invalid Authorization header format. Use "Bearer {token}"' });
  }

  // Verify the token with GitHub and resolve the caller.
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${userToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'GitHub-Wiki-Bot/1.0',
    },
  });
  if (!userResponse.ok) {
    logger.warn(`${action}: refused - invalid user token (${userResponse.status})`);
    return adapter.createJsonResponse(401, { error: 'Invalid authentication token' });
  }
  const user = await userResponse.json();

  if (await isCallerBanned(adapter, octokit, owner, repo, user)) {
    logger.warn(`${action}: refused - ${user.login} is banned`);
    return adapter.createJsonResponse(403, { error: 'You are not permitted to perform this action' });
  }

  return null;
}

/** Issue states the public list action accepts. */
const LISTABLE_ISSUE_STATES = Object.freeze(new Set(['open', 'closed', 'all']));

/** Pages the public list action may walk per request (300 issues); it is a read, so no absence protocol either. */
const LIST_ISSUES_MAX_PAGES = 3;

function parseJsonObject(text) {
  try {
    const value = JSON.parse(text || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/** Union achievement lists by id, keeping the earliest unlock of each. */
function unionAchievements(...lists) {
  const byId = new Map();
  for (const item of lists.flat()) {
    if (!item?.id) continue;
    const previous = byId.get(item.id);
    if (!previous || (item.unlockedAt && previous.unlockedAt && item.unlockedAt < previous.unlockedAt)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

/** Merge strategy for duplicate "[Achievements] user" issues: fold the newer issue's unlocks into the oldest. */
function createAchievementMerge(octokit, owner, repo) {
  return async (canonical, duplicate) => {
    const base = parseJsonObject(canonical.body);
    const extra = parseJsonObject(duplicate.body);
    const merged = unionAchievements(base.achievements ?? [], extra.achievements ?? []);
    if (JSON.stringify(merged) === JSON.stringify(base.achievements ?? [])) return;

    const body = JSON.stringify({ ...base, achievements: merged, lastUpdated: new Date().toISOString() }, null, 2);
    await octokit.rest.issues.update({ owner, repo, issue_number: canonical.number, body });
    canonical.body = body;
  };
}

/** Merge strategy for duplicate "[User Snapshot] user" issues: the most recently updated snapshot wins. */
function createSnapshotMerge(octokit, owner, repo) {
  return async (canonical, duplicate) => {
    const base = parseJsonObject(canonical.body);
    const extra = parseJsonObject(duplicate.body);
    if (!extra.lastUpdated || (base.lastUpdated && extra.lastUpdated <= base.lastUpdated)) return;

    await octokit.rest.issues.update({ owner, repo, issue_number: canonical.number, body: duplicate.body });
    canonical.body = duplicate.body;
  };
}

/**
 * Find a user's record issue by its user-id label, falling back to the exact
 * title for legacy records that predate the label (`legacy: true` in the
 * result). Duplicates left behind by earlier races are merged into the oldest
 * issue and closed.
 * @returns {Promise<{issue: Object|null, duplicates: Object[], legacy: boolean, confirmedAbsent: boolean}>}
 */
async function findUserRecordIssue(octokit, { owner, repo, typeLabel, userIdLabel, fallbackTitle = null, merge, botLogin }) {
  const result = await findRecordIssue(octokit, {
    owner,
    repo,
    labels: [typeLabel],
    identityLabel: userIdLabel,
    fallbackTitle,
    logger: lookupLogger,
  });

  if (result.issue && result.duplicates.length > 0) {
    await reconcileDuplicates(octokit, {
      owner,
      repo,
      canonical: result.issue,
      duplicates: result.duplicates,
      merge,
      botLogin,
      logger: lookupLogger,
    });
  }

  return result;
}

const findUserAchievementsIssue = (octokit, { owner, repo, userIdLabel, fallbackTitle = null, botLogin }) =>
  findUserRecordIssue(octokit, {
    owner,
    repo,
    typeLabel: ACHIEVEMENTS_LABEL,
    userIdLabel,
    fallbackTitle,
    merge: createAchievementMerge(octokit, owner, repo),
    botLogin,
  });

const findUserSnapshotIssue = (octokit, { owner, repo, userIdLabel, fallbackTitle = null, botLogin }) =>
  findUserRecordIssue(octokit, {
    owner,
    repo,
    typeLabel: USER_SNAPSHOT_LABEL,
    userIdLabel,
    fallbackTitle,
    merge: createSnapshotMerge(octokit, owner, repo),
    botLogin,
  });

/**
 * Persist a user's achievements: update the existing issue (relabelling a
 * legacy one so the next lookup is direct), or create one once its absence
 * is confirmed. Losing a creation race folds the new unlocks into the winner
 * instead of leaving a second issue behind.
 * @returns {Promise<{issueNumber: number, created: boolean}>}
 */
async function saveUserAchievements(octokit, { owner, repo, username, userIdLabel, existingIssue, legacy = false, issueData, botLogin }) {
  const body = JSON.stringify(issueData, null, 2);

  if (existingIssue) {
    await octokit.rest.issues.update({ owner, repo, issue_number: existingIssue.number, body });
    if (legacy) {
      try {
        await octokit.rest.issues.addLabels({ owner, repo, issue_number: existingIssue.number, labels: [userIdLabel] });
      } catch (error) {
        logger.warn('Failed to add user-id label to legacy achievements issue', { number: existingIssue.number, error: error.message });
      }
    }
    return { issueNumber: existingIssue.number, created: false };
  }

  const { issue, created } = await getOrCreateIssue(octokit, {
    owner,
    repo,
    labels: [ACHIEVEMENTS_LABEL, userIdLabel],
    createLabels: [ACHIEVEMENTS_LABEL, userIdLabel, AUTOMATED_LABEL],
    selectorLabel: userIdLabel,
    title: `[Achievements] ${username}`,
    body,
    lock: true,
    lockReason: RECORD_LOCK_REASON,
    merge: createAchievementMerge(octokit, owner, repo),
    botLogin,
    logger: lookupLogger,
  });

  if (!created) {
    const winner = parseJsonObject(issue.body);
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      body: JSON.stringify(
        { ...issueData, achievements: unionAchievements(winner.achievements ?? [], issueData.achievements ?? []) },
        null,
        2
      ),
    });
  }

  return { issueNumber: issue.number, created };
}

// Lazy-load donator registry to avoid top-level await issues
let donatorRegistryModule = null;
async function getDonatorRegistry() {
  if (!donatorRegistryModule) {
    donatorRegistryModule = await import('github-wiki-framework/src/services/github/donatorRegistry.js');
  }
  return donatorRegistryModule;
}

// Cache for loaded achievement deciders
let achievementDecidersCache = null;

/**
 * Load achievement deciders (framework defaults + custom)
 * Lazy-loaded and cached for performance
 */
async function loadAchievementDeciders() {
  if (achievementDecidersCache) {
    return achievementDecidersCache;
  }

  let deciders = {};

  try {
    // Import framework default deciders
    const frameworkModule = await import('github-wiki-framework/src/services/achievements/deciders/index.js');
    deciders = { ...frameworkModule.defaultDeciders };

    // Import custom deciders from parent project (if they exist)
    try {
      const customModule = await import('../../../src/services/achievements/deciders/index.js');
      deciders = { ...deciders, ...customModule.customDeciders };
    } catch (customError) {
      // Custom deciders are optional
      logger.debug('No custom deciders found (this is OK)', { error: customError.message });
    }

    logger.info('Loaded achievement deciders', {
      count: Object.keys(deciders).length,
      ids: Object.keys(deciders)
    });

    achievementDecidersCache = deciders;
    return deciders;
  } catch (error) {
    logger.error('Failed to load achievement deciders', { error: error.message });
    return {};
  }
}

/**
 * GitHub Bot Handler (Platform-Agnostic)
 * Handles all bot-authenticated GitHub operations
 *
 * POST /api/github-bot
 * Body: {
 *   action: 'create-comment' | 'update-issue' | 'list-issues' | 'get-comment' | 'create-comment-issue' | 'create-admin-issue' | 'update-admin-issue',
 *   owner: string,
 *   repo: string,
 *   ... (action-specific parameters)
 * }
 */

import { Octokit } from '@octokit/rest';
import * as LeoProfanity from 'leo-profanity';
import { sendEmail } from '../sendgrid.js';
import * as jwt from '../jwt.js';
import StorageFactory from 'github-wiki-framework/src/services/storage/StorageFactory.js';
import { createUserIdLabel, createNameLabel, createEmailLabel } from 'github-wiki-framework/src/utils/githubLabelUtils.js';
// Relative path on purpose: in a git worktree the `github-wiki-framework` package
// alias resolves up-tree to the MAIN checkout's submodule (a worktree has no
// node_modules of its own), so only the relative path guarantees the checked-out
// submodule is the one under test.
import { parseUserListFromIssue } from '../../../wiki-framework/src/utils/userListRecords.js';
import { createTtlCache } from '../utils/registryCache.js';
import {
  validateIssueTitle,
  validateIssueBody,
  validateLabels,
  validateEmail,
  validateDisplayName,
  validateEditReason,
  validatePageContent,
  validatePageTitle,
  validatePageId,
  validateSectionName,
  validateUsername,
} from '../validation.js';

/**
 * Mask email address for privacy
 * Shows only first and last character of username, masks middle with asterisks
 * Adds random 1-2 extra asterisks to prevent length-based matching
 * Example: demo0@gmail.com -> d****0@gmail.com or d*****0@gmail.com
 * @param {string} email - Email address to mask
 * @returns {string} Masked email address
 */
function maskEmail(email) {
  const [username, domain] = email.split('@');

  if (username.length <= 2) {
    // For very short usernames, mask all but first character
    const randomExtra = Math.floor(Math.random() * 2) + 1; // 1-2 extra asterisks
    return `${username[0]}${'*'.repeat(3 + randomExtra)}@${domain}`;
  }

  // Show first and last character, mask the middle
  const firstChar = username[0];
  const lastChar = username[username.length - 1];
  const baseMaskLength = Math.min(username.length - 2, 3); // Base 3 asterisks
  const randomExtra = Math.floor(Math.random() * 2) + 1; // Add 1-2 random asterisks
  const mask = '*'.repeat(baseMaskLength + randomExtra);

  return `${firstChar}${mask}${lastChar}@${domain}`;
}

/**
 * Check text for profanity using OpenAI Moderation API (primary) with leo-profanity fallback
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {string} text - Text to check
 * @returns {Promise<{containsProfanity: boolean, method: string, categories?: object}>}
 */
async function checkProfanity(adapter, text) {
  const openaiApiKey = adapter.getEnv("OPENAI_API_KEY");

  // Try OpenAI Moderation API first (if configured)
  if (openaiApiKey) {
    try {
      logger.debug('Checking with OpenAI Moderation API for text:', text);
      const response = await fetch(
        'https://api.openai.com/v1/moderations',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: text
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const result = data.results[0];

        // OpenAI returns flagged=true if content violates policies
        // Categories: hate, harassment, self-harm, sexual, violence
        const containsProfanity = result.flagged;

        logger.debug('OpenAI Moderation result', {
          flagged: result.flagged,
          categories: result.categories,
          category_scores: result.category_scores
        });

        return {
          containsProfanity,
          method: 'openai-moderation',
          categories: result.categories,
          scores: result.category_scores
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[Profanity] OpenAI API request failed:', response.status, errorData, 'falling back to leo-profanity');
      }
    } catch (error) {
      console.warn('[Profanity] OpenAI API error:', error.message, 'falling back to leo-profanity');
    }
  } else {
    logger.debug('OPENAI_API_KEY not configured, using leo-profanity fallback');
  }

  // Fallback to leo-profanity package
  logger.debug('Using leo-profanity package for text:', text);
  const containsProfanity = LeoProfanity.check(text);
  logger.debug('leo-profanity result:', containsProfanity);
  return { containsProfanity, method: 'leo-profanity' };
}

/**
 * Generate verification email HTML
 */
function generateVerificationEmail(code) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification - Slayer Legend Wiki</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0f172a;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
              <tr>
                <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 30px; text-align: center;">
                  <img src="https://slayerlegend.wiki/images/logo.png" alt="Slayer Legend" width="96" height="96" style="display: block; margin: 0 auto 16px auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);" />
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">Slayer Legend Wiki</h1>
                  <p style="margin: 8px 0 0 0; color: #fecaca; font-size: 14px; letter-spacing: 0.5px;">VERIFICATION CODE</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 24px 0; color: #e2e8f0; font-size: 16px; line-height: 1.6;">Thank you for contributing to the Slayer Legend Wiki! To complete your anonymous edit, please use the verification code below:</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding: 0 0 32px 0;">
                        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); border: 2px solid #3b82f6; border-radius: 8px; padding: 24px; display: inline-block;">
                          <div style="color: #ffffff; font-size: 42px; font-weight: bold; letter-spacing: 12px; font-family: 'Courier New', monospace; text-align: center;">${code}</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #334155; border-left: 4px solid #f59e0b; border-radius: 6px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <p style="margin: 0; color: #fbbf24; font-size: 14px; font-weight: 600;">⏱️ Expires in 10 minutes</p>
                        <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">Enter this code in the wiki editor to verify your email address. After verification, you can make multiple edits for 24 hours without re-verifying.</p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 32px 0 0 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">If you didn't request this code, you can safely ignore this email. The code will expire automatically.</p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #0f172a; padding: 30px; text-align: center; border-top: 1px solid #334155;">
                  <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">Sent by <strong style="color: #94a3b8;">Slayer Legend Wiki</strong></p>
                  <p style="margin: 0; color: #475569; font-size: 12px;">Complete guide for Slayer Legend: Idle RPG (슬레이어 키우기)</p>
                  <div style="margin-top: 16px;"><a href="https://slayerlegend.wiki" style="color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: 600;">Visit Wiki →</a></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Generate plain text version
 */
function generateVerificationEmailText(code) {
  return `⚔️ SLAYER LEGEND WIKI
Email Verification

Thank you for contributing to the Slayer Legend Wiki!

Your verification code is:

    ${code}

⏱️ This code will expire in 10 minutes.

Enter this code in the wiki editor to verify your email address. After verification, you can make multiple edits for 24 hours without re-verifying.

If you didn't request this code, you can safely ignore this email. The code will expire automatically.

────────────────────────────────
Slayer Legend Wiki
Complete guide for Slayer Legend: Idle RPG (슬레이어 키우기)
https://slayerlegend.wiki`;
}

/**
 * Handle GitHub bot request (Platform-Agnostic)
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {ConfigAdapter} configAdapter - Config adapter instance
 * @param {CryptoAdapter} cryptoAdapter - Crypto adapter instance
 * @returns {Promise<Object>} Platform-specific response
 */
export async function handleGithubBot(adapter, configAdapter, cryptoAdapter) {
  // Only allow POST
  if (adapter.getMethod() !== 'POST') {
    return adapter.createJsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    // Parse request body
    const body = await adapter.getJsonBody();
    const { action } = body;

    if (!action) {
      return adapter.createJsonResponse(400, { error: 'Missing required field: action' });
    }

    // SECURITY: the bot only ever operates on the wiki's own repository. Pin
    // owner/repo to the server configuration and ignore whatever the request
    // body claims, so a caller cannot aim the bot token at another repository.
    // No body fallback: an unconfigured deployment fails closed (like the other
    // handlers) instead of silently trusting the request.
    const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
    const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');
    if (!owner || !repo) {
      console.error('[github-bot] WIKI_REPO_OWNER / WIKI_REPO_NAME not configured');
      return adapter.createJsonResponse(503, { error: 'Repository is not configured' });
    }
    body.owner = owner;
    body.repo = repo;

    // Get bot token from environment
    const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
    if (!botToken) {
      console.error('[github-bot] WIKI_BOT_TOKEN not configured');
      return adapter.createJsonResponse(503, { error: 'Bot token not configured' });
    }

    // Initialize Octokit with bot token
    const octokit = new Octokit({
      auth: botToken,
      userAgent: 'GitHub-Wiki-Bot/1.0'
    });

    // Get headers for authenticated endpoints
    const headers = adapter.getHeaders();

    // Layer B (identity) for the verbs that write through the bot on a caller's behalf
    if (IDENTITY_SCOPED_ACTIONS.has(action)) {
      const identityGuard = await enforceCallerIdentity(adapter, configAdapter, headers, octokit, owner, repo, action);
      if (identityGuard) return identityGuard;
    }

    // Route to action handler
    switch (action) {
      case 'create-comment':
        return await handleCreateComment(adapter, octokit, body);
      case 'update-issue':
        return await handleUpdateIssue(adapter, octokit, body);
      case 'list-issues':
        return await handleListIssues(adapter, octokit, body);
      case 'get-comment':
        return await handleGetComment(adapter, octokit, body);
      case 'create-comment-issue':
        return await handleCreateCommentIssue(adapter, octokit, body);
      case 'create-admin-issue':
        return await handleCreateAdminIssue(adapter, octokit, body);
      case 'update-admin-issue':
        return await handleUpdateAdminIssue(adapter, octokit, body);
      case 'update-top-contributor':
        return await handleUpdateTopContributor(adapter, octokit, body);
      case 'create-issue-report':
        return await handleCreateIssueReport(adapter, octokit, body);
      case 'save-user-snapshot':
        return await handleSaveUserSnapshot(adapter, octokit, body);
      case 'create-user-snapshot':
        return await handleCreateUserSnapshot(adapter, octokit, body);
      case 'send-verification-email':
        return await handleSendVerificationEmail(adapter, configAdapter, cryptoAdapter, octokit, body);
      case 'verify-email':
        return await handleVerifyEmail(adapter, configAdapter, cryptoAdapter, octokit, body);
      case 'check-rate-limit':
        return await handleCheckRateLimit(adapter, body);
      case 'create-anonymous-pr':
        return await handleCreateAnonymousPR(adapter, configAdapter, cryptoAdapter, octokit, body);
      case 'link-anonymous-edits':
        return await handleLinkAnonymousEdits(adapter, octokit, body, headers);
      case 'check-achievements':
        return await handleCheckAchievements(adapter, octokit, body, headers);
      case 'check-single-achievement':
        return await handleCheckSingleAchievement(adapter, octokit, body, headers);
      case 'get-or-create-creator-index':
        return await handleGetOrCreateCreatorIndex(adapter, octokit, body);
      case 'submit-content-creator':
        return await handleSubmitContentCreator(adapter, octokit, body);
      case 'get-approved-creators':
        return await handleGetApprovedCreators(adapter, octokit, body);
      case 'get-all-creator-submissions':
        return await handleGetAllCreatorSubmissions(adapter, octokit, body);
      case 'sync-creator-approvals':
        return await handleSyncCreatorApprovals(adapter, octokit, body);
      case 'approve-creator':
        return await handleApproveCreator(adapter, octokit, body);
      case 'delete-creator-submission':
        return await handleDeleteCreatorSubmission(adapter, octokit, body);
      case 'submit-video-guide':
        return await handleSubmitVideoGuide(adapter, octokit, body);
      case 'delete-video-guide':
        return await handleDeleteVideoGuide(adapter, octokit, body);
      case 'get-pending-video-guide-deletions':
        return await handleGetPendingVideoGuideDeletions(adapter, octokit, body);
      case 'assign-donator-badge':
        return await handleAssignDonatorBadge(adapter, octokit, body, botToken);
      case 'remove-donator-badge':
        return await handleRemoveDonatorBadge(adapter, octokit, body, botToken);
      default:
        return adapter.createJsonResponse(400, { error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('[github-bot] Error:', error);
    return adapter.createJsonResponse(500, { error: error.message || 'Internal server error' });
  }
}

/**
 * Create a comment on an issue
 * Required: issueNumber, body
 */
async function handleCreateComment(adapter, octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || !body) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: issueNumber, body' });
  }

  // Validate body
  const bodyResult = validateIssueBody(body, 'Comment body');
  if (!bodyResult.valid) {
    return adapter.createJsonResponse(400, { error: bodyResult.error });
  }

  // SECURITY: only comment on bot-managed container issues, never an arbitrary issue.
  const guard = await assertBotManagedIssue(adapter, octokit, owner, repo, issueNumber, 'create-comment');
  if (guard) return guard;

  const { data: comment } = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  logger.debug(`Created comment ${comment.id} on issue #${issueNumber}`);

  return adapter.createJsonResponse(200, {
    comment: {
      id: comment.id,
      body: comment.body,
      created_at: comment.created_at,
      html_url: comment.html_url,
    },
  });
}

/**
 * Update an issue body
 * Required: issueNumber, body
 */
async function handleUpdateIssue(adapter, octokit, { owner, repo, issueNumber, body }) {
  if (!issueNumber || body === undefined) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: issueNumber, body' });
  }

  // Validate body
  const bodyResult = validateIssueBody(body, 'Issue body');
  if (!bodyResult.valid) {
    return adapter.createJsonResponse(400, { error: bodyResult.error });
  }

  // SECURITY: only update bot-managed container issues. This is what stopped the
  // admin-list takeover: an arbitrary issue number can no longer be rewritten.
  const guard = await assertBotManagedIssue(adapter, octokit, owner, repo, issueNumber, 'update-issue');
  if (guard) return guard;

  const { data: issue } = await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  logger.debug(`Updated issue #${issueNumber}`);

  return adapter.createJsonResponse(200, {
    issue: {
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      body: issue.body,
      labels: issue.labels,
      updated_at: issue.updated_at,
      state: issue.state,
    },
  });
}

/**
 * List issues by label
 * Required: labels (string or array)
 * Optional: state
 * Every page is walked (bounded by the lookup module's ceiling); a `per_page`
 * sent by older clients is accepted and ignored.
 */
async function handleListIssues(adapter, octokit, { owner, repo, labels, state = 'open' }) {
  if (!labels) {
    return adapter.createJsonResponse(400, { error: 'Missing required field: labels' });
  }

  const labelsResult = validateLabels(labels);
  if (!labelsResult.valid) {
    return adapter.createJsonResponse(400, { error: labelsResult.error });
  }

  const labelList = normalizeLabels(labels);
  if (labelList.length === 0) {
    return adapter.createJsonResponse(400, { error: 'Missing required field: labels' });
  }

  const wantedState = String(state).toLowerCase();
  if (!LISTABLE_ISSUE_STATES.has(wantedState)) {
    return adapter.createJsonResponse(400, { error: `Invalid state "${state}" (expected open, closed or all)` });
  }

  const { issues } = await findIssues(octokit, {
    owner,
    repo,
    labels: labelList,
    state: wantedState,
    maxPages: LIST_ISSUES_MAX_PAGES,
    confirmAbsence: false,
    logger: lookupLogger,
  });

  // Security: Filter to only bot-created issues
  const botUsername = adapter.getEnv('WIKI_BOT_USERNAME');
  const botIssues = issues.filter(issue => issue.user.login === botUsername);

  logger.debug(`Listed ${botIssues.length}/${issues.length} bot-created issues with labels: ${labels}`);

  return adapter.createJsonResponse(200, { issues: botIssues });
}

/**
 * Get a comment by ID
 * Required: commentId
 */
async function handleGetComment(adapter, octokit, { owner, repo, commentId }) {
  if (!commentId) {
    return adapter.createJsonResponse(400, { error: 'Missing required field: commentId' });
  }

  const { data: comment } = await octokit.rest.issues.getComment({
    owner,
    repo,
    comment_id: commentId,
  });

  logger.debug(`Fetched comment ${commentId}`);

  return adapter.createJsonResponse(200, { comment });
}

/**
 * Create a comment issue (public comments)
 * Required: title, body, labels
 * Optional: requestedBy, requestedByUserId (for server-side ban checking)
 * Optional: preventDuplicates (if true, checks for existing issue with same labels before creating)
 */
async function handleCreateCommentIssue(adapter, octokit, { owner, repo, title, body, labels, requestedBy, requestedByUserId, preventDuplicates = false }) {
  if (!title || !body || !labels) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: title, body, labels' });
  }

  // Validate title
  const titleResult = validateIssueTitle(title);
  if (!titleResult.valid) {
    return adapter.createJsonResponse(400, { error: titleResult.error });
  }

  // Validate body
  const bodyResult = validateIssueBody(body, 'Issue body');
  if (!bodyResult.valid) {
    return adapter.createJsonResponse(400, { error: bodyResult.error });
  }

  // Validate labels
  const labelsResult = validateLabels(labels);
  if (!labelsResult.valid) {
    return adapter.createJsonResponse(400, { error: labelsResult.error });
  }

  // This action is unauthenticated: never let it mint a bot-managed record,
  // whether identified by a reserved label or by a reserved title.
  const reservedLabel = findReservedLabel(labels);
  if (reservedLabel) {
    return adapter.createJsonResponse(400, { error: `Label "${reservedLabel}" is reserved for bot-managed records` });
  }
  const reservedTitle = findReservedTitle(title);
  if (reservedTitle) {
    return adapter.createJsonResponse(400, { error: `Title "${title}" is reserved for bot-managed records` });
  }

  // Managed containers (page comment threads, the build-share index) must stay
  // unique: always de-duplicate them regardless of what the caller asked for, so
  // an anonymous call cannot mint a competing bot-authored container.
  if (normalizeLabels(labels).some((label) => MANAGED_ISSUE_LABELS.has(label.toLowerCase()))) {
    preventDuplicates = true;
  }

  // Check for existing issue if preventDuplicates is enabled
  if (preventDuplicates) {
    const botUsername = adapter.getEnv('WIKI_BOT_USERNAME');
    const labelsArray = Array.isArray(labels) ? labels : [labels];

    // Search for existing issues with the same labels (oldest first)
    const { issues: existingIssues, confirmedAbsent } = await findIssues(octokit, {
      owner,
      repo,
      labels: labelsArray,
      state: 'open',
      logger: lookupLogger,
    });

    // Filter to only bot-created issues
    const botIssues = existingIssues.filter(issue => issue.user.login === botUsername);

    // Creating on an unconfirmed miss is exactly how duplicate index issues were born
    if (existingIssues.length === 0 && !confirmedAbsent) {
      return absenceUnconfirmedResponse(
        adapter,
        new Error(`No open issue with labels ${labelsArray.join(', ')} was visible, but GitHub did not confirm its absence`)
      );
    }

    // If issue already exists, return it instead of creating duplicate
    if (botIssues.length > 0) {
      const existingIssue = botIssues[0];
      logger.info(`Issue already exists with labels ${labelsArray.join(', ')}, returning existing issue #${existingIssue.number}`);

      return adapter.createJsonResponse(200, {
        issue: {
          number: existingIssue.number,
          title: existingIssue.title,
          url: existingIssue.html_url,
          body: existingIssue.body,
          labels: existingIssue.labels,
          created_at: existingIssue.created_at,
          state: existingIssue.state,
        },
        wasExisting: true, // Indicate this was an existing issue
      });
    }
  }

  // Caller identity and the ban check run in enforceCallerIdentity() before
  // dispatch; requestedBy / requestedByUserId are advisory audit fields only.

  const { data: issue } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels: Array.isArray(labels) ? labels : [labels],
  });

  logger.debug(`Created comment issue #${issue.number}${requestedBy ? ` (requested by ${requestedBy})` : ''}`);

  return adapter.createJsonResponse(200, {
    issue: {
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      body: issue.body,
      labels: issue.labels,
      created_at: issue.created_at,
      state: issue.state,
    },
  });
}

/**
 * Create an admin issue (with lock)
 * Required: title, body, labels, userToken, username
 * Optional: lock (default: true)
 */
async function handleCreateAdminIssue(octokit, { owner, repo, title, body, labels, lock = true, userToken, username }) {
  if (!title || !body || !labels || !userToken || !username) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: title, body, labels, userToken, username' }),
    };
  }

  // Verify user has admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    // Check if user is owner or has admin permissions
    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only repository owner and admins can perform this action' }),
      };
    }
  } catch (error) {
    console.error('[github-bot] Permission check failed:', error);
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Permission verification failed' }),
    };
  }

  // Create issue using bot token
  const { data: issue } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels: Array.isArray(labels) ? labels : [labels],
  });

  // Lock the issue if requested
  if (lock) {
    try {
      await octokit.rest.issues.lock({
        owner,
        repo,
        issue_number: issue.number,
        lock_reason: 'off-topic',
      });
    } catch (lockError) {
      console.warn('[github-bot] Failed to lock issue:', lockError.message);
    }
  }

  logger.debug(`Created admin issue #${issue.number} by ${username}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        created_at: issue.created_at,
        state: issue.state,
      },
    }),
  };
}

/**
 * Update an admin issue
 * Required: issueNumber, body, userToken, username
 */
async function handleUpdateAdminIssue(octokit, { owner, repo, issueNumber, body, userToken, username }) {
  if (!issueNumber || body === undefined || !userToken || !username) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: issueNumber, body, userToken, username' }),
    };
  }

  // Verify user has admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only repository owner and admins can perform this action' }),
      };
    }
  } catch (error) {
    console.error('[github-bot] Permission check failed:', error);
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Permission verification failed' }),
    };
  }

  // Update issue using bot token
  const { data: issue } = await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  logger.debug(`Updated admin issue #${issueNumber} by ${username}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        body: issue.body,
        labels: issue.labels,
        updated_at: issue.updated_at,
        state: issue.state,
      },
    }),
  };
}

/**
 * Update top contributor for a page (called by GitHub Action)
 * Required: owner, repo, sectionId, pageId, contributorData
 */
async function handleUpdateTopContributor(adapter, octokit, { owner, repo, sectionId, pageId, contributorData }) {
  if (!owner || !repo || !sectionId || !pageId || !contributorData) {
    return adapter.createJsonResponse(
      { error: 'Missing required fields: owner, repo, sectionId, pageId, contributorData' },
      { status: 400 }
    );
  }

  if (!contributorData.username || !contributorData.userId || contributorData.score === undefined) {
    return adapter.createJsonResponse(
      { error: 'contributorData must contain username, userId, and score' },
      { status: 400 }
    );
  }

  try {
    // Import admin service dynamically
    const adminModule = await import('github-wiki-framework/src/services/github/admin.js');

    // Load wiki config
    const configModule = await import('github-wiki-framework/src/config/wikiConfig.js');
    const config = configModule.default || configModule;

    // Update top contributor via admin service
    const result = await adminModule.updateTopContributor(
      owner,
      repo,
      sectionId,
      pageId,
      contributorData,
      config
    );

    logger.info('Updated top contributor', {
      section: sectionId,
      page: pageId,
      username: contributorData.username,
      score: contributorData.score
    });

    return adapter.createJsonResponse({
      success: true,
      topContributor: result,
    });
  } catch (error) {
    logger.error('Failed to update top contributor', {
      error: error.message,
      section: sectionId,
      page: pageId
    });

    return adapter.createJsonResponse(
      { error: `Failed to update top contributor: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * Create an issue report (bug report, suggestion, content issue, or other)
 * Supports both anonymous and authenticated submissions
 * Required: category, title, description, pageUrl
 * Optional: email, includeSystemInfo, systemInfo, requestedBy
 */
async function handleCreateIssueReport(adapter, octokit, body) {
  const {
    owner,
    repo,
    category,
    title,
    description,
    email,
    pageUrl,
    includeSystemInfo,
    systemInfo,
    requestedBy  // Username if authenticated, null if anonymous
  } = body;

  // Validate required fields
  if (!category || !title || !description) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: category, title, description' });
  }

  // Validate category
  const allowedCategories = ['bug-report', 'suggestion', 'content-issue', 'other'];
  if (!allowedCategories.includes(category)) {
    return adapter.createJsonResponse(400, { error: 'Invalid category' });
  }

  // Validate title length
  if (title.length < 10 || title.length > 100) {
    return adapter.createJsonResponse(400, { error: 'Title must be between 10 and 100 characters' });
  }

  // Validate description length
  if (description.length < 20 || description.length > 2000) {
    return adapter.createJsonResponse(400, { error: 'Description must be between 20 and 2000 characters' });
  }

  // Validate email if provided
  if (email) {
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      return adapter.createJsonResponse(400, { error: emailResult.error });
    }
  }

  // Build issue title
  const reporterName = requestedBy || 'Anonymous';
  const issueTitle = `[Issue Report] ${reporterName} - ${title}`;

  // Build issue body
  const categoryDisplay = category.split('-').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');

  let issueBody = `**Category**: ${categoryDisplay}\n`;
  issueBody += `**Submitted by**: ${reporterName}\n`;
  if (email) {
    issueBody += `**Email**: ${email}\n`;
  }
  issueBody += `**Page URL**: ${pageUrl}\n\n`;
  issueBody += `## Description\n\n${description}\n\n`;

  if (includeSystemInfo && systemInfo) {
    issueBody += `---\n\n**System Information**\n`;
    issueBody += `- **Browser**: ${systemInfo.browser}\n`;
    issueBody += `- **OS**: ${systemInfo.os}\n`;
    issueBody += `- **Screen**: ${systemInfo.screen}\n`;
    issueBody += `- **Timestamp**: ${systemInfo.timestamp}\n`;
  }

  try {
    // Create issue
    const { data: issue } = await octokit.rest.issues.create({
      owner,
      repo,
      title: issueTitle,
      body: issueBody,
      labels: ['user-report', category]
    });

    logger.info(`Created issue report #${issue.number}`, {
      category,
      reporter: reporterName,
      anonymous: !requestedBy
    });

    return adapter.createJsonResponse(200, {
      success: true,
      issue: {
        number: issue.number,
        url: issue.html_url,
        title: issue.title
      }
    });
  } catch (error) {
    logger.error('Failed to create issue report', { error: error.message });
    return adapter.createJsonResponse(500, { error: 'Failed to create issue report' });
  }
}

/**
 * Save or update user snapshot issue
 * Required: username, snapshotData, userToken, requestingUsername
 * Optional: existingIssueNumber
 */
async function handleSaveUserSnapshot(octokit, { owner, repo, username, snapshotData, existingIssueNumber, userToken, requestingUsername }) {
  if (!username || !snapshotData || !userToken || !requestingUsername) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: username, snapshotData, userToken, requestingUsername' }),
    };
  }

  // Verify the user is authenticated (has a valid token)
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    // Verify user token is valid
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    // Verify requesting user matches authenticated user
    if (userData.login !== requestingUsername) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'User verification failed' }),
      };
    }

    // Users can only update their own snapshot
    if (requestingUsername !== username) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'You can only update your own user snapshot' }),
      };
    }
  } catch (error) {
    console.error('[github-bot] User verification failed:', error);
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'User authentication failed' }),
    };
  }

  // Prepare issue data
  const issueTitle = `[User Snapshot] ${username}`;
  const issueBody = JSON.stringify(snapshotData, null, 2);
  const userIdLabel = snapshotData.userId ? createUserIdLabel(snapshotData.userId) : null;

  try {
    let issue;

    if (existingIssueNumber) {
      // Update existing snapshot
      const { data: updatedIssue } = await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: existingIssueNumber,
        title: issueTitle,
        body: issueBody,
      });

      // Add user ID label if missing
      if (userIdLabel) {
        try {
          await octokit.rest.issues.addLabels({
            owner,
            repo,
            issue_number: existingIssueNumber,
            labels: [userIdLabel],
          });
        } catch (err) {
          console.warn('[github-bot] Failed to add user-id label:', err.message);
        }
      }

      issue = updatedIssue;
      logger.debug(`Updated user snapshot #${existingIssueNumber} for ${username}`);
    } else {
      // Create new snapshot
      const labels = ['user-snapshot', 'automated'];
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
      } catch (lockError) {
        console.warn('[github-bot] Failed to lock user snapshot:', lockError.message);
      }

      issue = newIssue;
      logger.debug(`Created user snapshot #${newIssue.number} for ${username}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        issue: {
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          body: issue.body,
          labels: issue.labels,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          state: issue.state,
        },
      }),
    };
  } catch (error) {
    console.error('[github-bot] Failed to save user snapshot:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to save user snapshot: ' + error.message }),
    };
  }
}

/**
 * Helper: Hash IP address or email for privacy
 * IMPORTANT: When hashing emails, normalizes them (lowercase + trim) for consistency
 * @param {string} value - IP address or email to hash
 * @param {boolean} isEmail - If true, normalizes the value before hashing (default: false)
 */
async function hashIP(value, isEmail = false) {
  const encoder = new TextEncoder();
  // Normalize emails for consistent hashing (must match client-side and GitHub Actions)
  const normalizedValue = isEmail ? value.toLowerCase().trim() : value;
  const data = encoder.encode(normalizedValue);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Helper: Get client IP address from request
 */
function getClientIP(event) {
  // Try multiple headers in order of preference
  return (
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['x-real-ip'] ||
    event.headers['client-ip'] ||
    'unknown'
  );
}

/**
 * Helper: Generate verification code
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Helper: Create verification token (JWT)
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {string} email - Email address
 */
async function createVerificationToken(adapter, email) {
  const secret = adapter.getEnv('EMAIL_VERIFICATION_SECRET');
  if (!secret) {
    throw new Error('EMAIL_VERIFICATION_SECRET not configured');
  }

  return await jwt.sign(
    {
      email,
      timestamp: Date.now(),
      type: 'email-verification'
    },
    secret,
    86400 // 24 hours in seconds
  );
}

/**
 * Helper: Verify verification token
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {string} token - JWT token
 */
async function verifyVerificationToken(adapter, token) {
  const secret = adapter.getEnv('EMAIL_VERIFICATION_SECRET');
  if (!secret) {
    throw new Error('EMAIL_VERIFICATION_SECRET not configured');
  }

  try {
    const decoded = await jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    console.error('[github-bot] Token verification failed:', error.message);
    return null;
  }
}

/**
 * Send verification email
 * Required: email
 */
async function handleSendVerificationEmail(adapter, configAdapter, cryptoAdapter, octokit, { owner, repo, email }) {
  if (!email) {
    return adapter.createJsonResponse(400, { error: 'Missing required field: email' });
  }

  // Validate email format and length
  const emailResult = validateEmail(email);
  if (!emailResult.valid) {
    return adapter.createJsonResponse(400, { error: emailResult.error });
  }

  // Check SendGrid configuration
  const sendGridKey = adapter.getEnv("SENDGRID_API_KEY");
  const fromEmail = adapter.getEnv("SENDGRID_FROM_EMAIL");
  if (!sendGridKey || !fromEmail) {
    console.error('[github-bot] SendGrid not configured');
    return adapter.createJsonResponse(503, { error: 'Email service not configured' });
  }

  try {
    // Generate verification code
    const code = generateVerificationCode();
    const timestamp = Date.now();
    const expiresAt = timestamp + 10 * 60 * 1000; // 10 minutes

    // Hash email for privacy
    const emailHash = await hashIP(email);

    // Encrypt verification code before storing
    const secret = adapter.getEnv("EMAIL_VERIFICATION_SECRET");
    if (!secret) {
      throw new Error('EMAIL_VERIFICATION_SECRET not configured');
    }
    const encryptedCode = await cryptoAdapter.encrypt(code, secret);

    // Create storage adapter
    const botToken = adapter.getEnv("WIKI_BOT_TOKEN");
    if (!botToken) {
      throw new Error('WIKI_BOT_TOKEN not configured');
    }

    const wikiConfig = configAdapter.getWikiConfig();
    const storageConfig = wikiConfig.storage || {
      backend: 'github',
      version: 'v1',
      github: { owner, repo },
    };

    const storage = StorageFactory.create(
      storageConfig,
      {
        WIKI_BOT_TOKEN: botToken,
        SLAYER_WIKI_DATA: adapter.getEnv("SLAYER_WIKI_DATA"), // KV namespace (if available)
      }
    );

    // Store verification code using storage abstraction
    await storage.storeVerificationCode(emailHash, encryptedCode, expiresAt);

    logger.debug(`Stored verification code for emailHash: ${emailHash.substring(0, 8)}...`);

    // Send email with SendGrid
    // Add [TEST] prefix in development mode
    const isDev = adapter.getEnv("NODE_ENV") === 'development';
    const subjectPrefix = isDev ? '[TEST] ' : '';

    const emailResult = await sendEmail({
      apiKey: sendGridKey,
      to: email,
      from: fromEmail,
      subject: `${subjectPrefix}Verify your email - Slayer Legend Wiki`,
      text: generateVerificationEmailText(code),
      html: generateVerificationEmail(code),
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send email');
    }

    logger.debug(`Verification email sent to ${email}`);

    return adapter.createJsonResponse(200, {
      message: 'Verification code sent',
    });
  } catch (error) {
    console.error('[github-bot] Failed to send verification email:', error);
    return adapter.createJsonResponse(500, { error: 'Failed to send verification email' });
  }
}

/**
 * Verify email code and return verification token
 * Required: email, code
 */
async function handleVerifyEmail(adapter, configAdapter, cryptoAdapter, octokit, { owner, repo, email, code }) {
  logger.debug('handleVerifyEmail called:', { owner, repo, email: email ? '***' : undefined, code: code ? '***' : undefined });

  if (!email || !code) {
    logger.debug('Missing email or code');
    return adapter.createJsonResponse(400, { error: "Missing required fields: email, code" });
  }

  try {
    // Hash email
    const emailHash = await hashIP(email);

    // Create storage adapter
    const botToken = adapter.getEnv("WIKI_BOT_TOKEN");
    if (!botToken) {
      throw new Error('WIKI_BOT_TOKEN not configured');
    }

    const wikiConfig = configAdapter.getWikiConfig();
    const storageConfig = wikiConfig.storage || {
      backend: 'github',
      version: 'v1',
      github: { owner, repo },
    };

    const storage = StorageFactory.create(
      storageConfig,
      {
        WIKI_BOT_TOKEN: botToken,
        SLAYER_WIKI_DATA: adapter.getEnv("SLAYER_WIKI_DATA"), // KV namespace (if available)
      }
    );

    // Get verification code from storage
    const storedData = await storage.getVerificationCode(emailHash);

    if (!storedData) {
      logger.debug('No matching verification code found or expired');
      return adapter.createJsonResponse(
        404, {
        error: 'Verification code not found or expired'
      });
    }

    logger.debug('Found verification code for email hash');

    // Decrypt and verify code
    const secret = adapter.getEnv("EMAIL_VERIFICATION_SECRET");
    if (!secret) {
      throw new Error('EMAIL_VERIFICATION_SECRET not configured');
    }

    let decryptedCode;
    try {
      decryptedCode = await cryptoAdapter.decrypt(storedData.code, secret);
    } catch (decryptError) {
      console.error('[github-bot] Failed to decrypt verification code:', decryptError.message);
      return adapter.createJsonResponse(
        500, {
        error: 'Verification failed'
      });
    }

    if (decryptedCode !== code) {
      logger.debug('Invalid verification code');
      return adapter.createJsonResponse(
        403, {
        error: 'Invalid verification code'
      });
    }

    // Delete the verification code after successful verification
    logger.debug('Verification successful, deleting code');
    await storage.deleteVerificationCode(emailHash);

    // Generate verification token
    const token = await createVerificationToken(adapter, email);

    logger.debug(`Email verified: ${email}`);

    return adapter.createJsonResponse(
      200, {
        verified: true,
        token,
      }
    );
  } catch (error) {
    console.error('[github-bot] Email verification failed:', error);
    return adapter.createJsonResponse(
      500, {
      error: 'Verification failed'
    });
  }
}

// In-memory rate limiting storage (for Netlify)
// Note: This resets on function cold starts. For production, use Netlify Blobs or external storage.
const rateLimitStore = new Map();

/**
 * Check rate limit for IP address
 * Required: (IP extracted from adapter)
 */
async function handleCheckRateLimit(adapter, { maxEdits = 5, windowMinutes = 60 }) {
  const clientIP = adapter.getClientIP();
  const ipHash = await hashIP(clientIP);

  const windowMs = windowMinutes * 60 * 1000;
  const now = Date.now();

  // Get existing submissions
  let submissions = rateLimitStore.get(ipHash) || [];

  // Filter to submissions within window
  submissions = submissions.filter(timestamp => now - timestamp < windowMs);

  // Check if limit exceeded
  if (submissions.length >= maxEdits) {
    const oldestSubmission = submissions[0];
    const remainingMs = windowMs - (now - oldestSubmission);

    return adapter.createJsonResponse(429, {
      allowed: false,
      remainingMs,
      message: `Rate limit exceeded. Please try again in ${Math.ceil(remainingMs / 1000 / 60)} minutes.`,
    });
  }

  return adapter.createJsonResponse(200, {
    allowed: true,
    remaining: maxEdits - submissions.length,
  });
}

/**
 * Record a submission for rate limiting
 */
async function recordSubmission(adapter) {
  const clientIP = adapter.getClientIP();
  const ipHash = await hashIP(clientIP);

  let submissions = rateLimitStore.get(ipHash) || [];
  submissions.push(Date.now());

  // Keep only last 10 submissions
  if (submissions.length > 10) {
    submissions = submissions.slice(-10);
  }

  rateLimitStore.set(ipHash, submissions);
}

/**
 * Validate reCAPTCHA token
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {string} token - reCAPTCHA token
 * @param {string} ip - Client IP address
 */
async function validateRecaptcha(adapter, token, ip) {
  const secret = adapter.getEnv('RECAPTCHA_SECRET_KEY');
  if (!secret) {
    throw new Error('RECAPTCHA_SECRET_KEY not configured');
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: ip,
    }),
  });

  const result = await response.json();

  if (!result.success) {
    console.error('[github-bot] reCAPTCHA validation failed:', result['error-codes']);
    return { valid: false, score: 0 };
  }

  return { valid: true, score: result.score || 1.0 };
}

/**
 * Create anonymous PR
 * Required: owner, repo, section, pageId, pageTitle, content, email, displayName, verificationToken, captchaToken
 * Optional: reason, consentToLinkEmail
 */
async function handleCreateAnonymousPR(adapter, configAdapter, cryptoAdapter, octokit, {
  owner, repo, section, pageId, pageTitle,
  content, email, displayName, reason = '',
  verificationToken, captchaToken, consentToLinkEmail = false
}) {
  // Validate required fields
  if (!owner || !repo || !section || !pageId || !pageTitle || !content || !email || !displayName || !verificationToken || !captchaToken) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields' });
  }

  logger.debug('Starting anonymous PR creation for:', { email, displayName, section, pageId });

  try {
    // Validate all inputs BEFORE any processing
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: emailResult.error });
    }

    const displayNameResult = validateDisplayName(displayName);
    if (!displayNameResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: displayNameResult.error });
    }

    const reasonResult = validateEditReason(reason);
    if (!reasonResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: reasonResult.error });
    }

    const contentResult = validatePageContent(content);
    if (!contentResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: contentResult.error });
    }

    const titleResult = validatePageTitle(pageTitle);
    if (!titleResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: titleResult.error });
    }

    const pageIdResult = validatePageId(pageId);
    if (!pageIdResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: pageIdResult.error });
    }

    const sectionResult = validateSectionName(section);
    if (!sectionResult.valid) {
      return adapter.createJsonResponse(
        400, {
        error: sectionResult.error });
    }

    // Use sanitized values from validation
    displayName = displayNameResult.sanitized;
    reason = reasonResult.sanitized;

    // 1. Verify email verification token
    const decoded = await verifyVerificationToken(adapter, verificationToken);
    if (!decoded || decoded.email !== email) {
      return adapter.createJsonResponse(403, { error: 'Email verification expired or invalid' });
    }

    // 2. Validate reCAPTCHA
    const clientIP = adapter.getClientIP();
    const captchaResult = await validateRecaptcha(adapter, captchaToken, clientIP);

    if (!captchaResult.valid || captchaResult.score < 0.5) {
      return adapter.createJsonResponse(
        403, {
        error: 'CAPTCHA validation failed', score: captchaResult.score
      });
    }

    // 3. Check rate limit
    const rateCheck = await handleCheckRateLimit(adapter, { maxEdits: 5, windowMinutes: 60 });
    if (rateCheck.statusCode === 429) {
      return rateCheck;
    }

    // 4. Check display name for profanity
    logger.debug('Checking display name for profanity:', displayName);
    const profanityCheck = await checkProfanity(adapter, displayName);
    logger.debug('Profanity check result:', profanityCheck);

    if (profanityCheck.containsProfanity) {
      logger.debug(`Display name rejected due to profanity (method: ${profanityCheck.method}):`, displayName);
      return adapter.createJsonResponse(400, {
        error: 'Display name contains inappropriate language. Please choose a respectful name.'
      });
    }

    logger.debug('Display name passed profanity check');

    // 5b. Check reason for profanity (if provided)
    if (reason && reason.length > 0) {
      logger.debug('Checking reason for profanity:', reason);
      const reasonProfanityCheck = await checkProfanity(adapter, reason);
      logger.debug('Reason profanity check result:', reasonProfanityCheck);

      if (reasonProfanityCheck.containsProfanity) {
        logger.debug(`Reason rejected due to profanity (method: ${reasonProfanityCheck.method}):`, reason);
        return adapter.createJsonResponse(400, {
          error: 'Edit reason contains inappropriate language. Please provide a respectful explanation.'
        });
      }

      logger.debug('Reason passed profanity check');
    }

    // 5c. Check page content for profanity
    logger.debug('Checking page content for profanity (length:', content.length, ')');
    // Only check first 5000 chars to avoid overwhelming the API
    const contentSample = content.substring(0, 5000);
    const contentProfanityCheck = await checkProfanity(adapter, contentSample);
    logger.debug('Content profanity check result:', contentProfanityCheck);

    if (contentProfanityCheck.containsProfanity) {
      logger.debug(`Content rejected due to profanity (method: ${contentProfanityCheck.method})`);
      return adapter.createJsonResponse(400, {
          error: 'Page content contains inappropriate language. Please remove offensive content and try again.'
        });
      
    }

    logger.debug('Content passed profanity check');

    // 6. Create branch
    const timestamp = Date.now();
    const branchName = `anon-edit/${section}/${pageId}/${timestamp}`;

    // Get main branch SHA
    const { data: mainBranch } = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: 'main',
    });

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: mainBranch.commit.sha,
    });

    // 7. Commit file
    const filePath = `public/content/${section}/${pageId}.md`;

    // Hash email BEFORE masking for tracking purposes
    // CRITICAL: Pass isEmail=true to normalize email for consistent hashing
    const emailHash = await hashIP(email, true);

    // Use maximum hash length that fits in label if consent given (50 char limit - 4 char prefix = 46 chars)
    // Use truncated hash if no consent (16 chars for basic tracking)
    const LABEL_MAX_HASH_LENGTH = 46; // Max hash chars that fit in GitHub label (50 - len('ref:'))
    const emailLabelHash = consentToLinkEmail
      ? emailHash.substring(0, LABEL_MAX_HASH_LENGTH)
      : emailHash.substring(0, 16);

    // Then mask email for display
    const maskedEmail = maskEmail(email);
    const commitMessage = `Update ${pageTitle}

Anonymous contribution by: ${displayName}
Email: ${maskedEmail} (verified ✓)
Email-Hash: ${emailHash}
${reason ? `Reason: ${reason}` : ''}

Submitted: ${new Date(timestamp).toISOString()}

🤖 Generated with [Anonymous Wiki Editor](https://slayerlegend.wiki)

Co-Authored-By: Wiki Bot <bot@slayerlegend.wiki>`;

    // Check if file exists on main branch to get its sha
    let fileSha;
    try {
      const { data: existingFile } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: 'main',
      });
      fileSha = existingFile.sha;
      logger.debug('File exists on main, using sha:', fileSha);
    } catch (error) {
      // File doesn't exist, that's fine (new page)
      logger.debug('File does not exist on main (new page)');
      fileSha = undefined;
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch: branchName,
      ...(fileSha && { sha: fileSha }), // Include sha if updating existing file
    });

    // 8. Create PR
    const prBody = `## Anonymous Edit Submission

**Submitted by:** ${displayName}
**Email:** ${maskedEmail} (verified ✓)
${reason ? `**Reason:** ${reason}` : ''}
**Timestamp:** ${new Date(timestamp).toISOString()}
**reCAPTCHA Score:** ${captchaResult.score.toFixed(2)}

---

*This edit was submitted anonymously via the wiki editor.*
*The submitter's email address has been verified.*
*Automated submission by wiki bot.*`;

    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: `[Anonymous] Update ${pageTitle}`,
      body: prBody,
      head: branchName,
      base: 'main',
    });

    // 9. Add labels (including display name and email hash for easy identification)
    const labels = [
      'anonymous-edit',
      'needs-review',
      section,
      createNameLabel(displayName), // Store display name as label for easy access
      createEmailLabel(emailLabelHash, consentToLinkEmail ? LABEL_MAX_HASH_LENGTH : 16), // Store max hash if consent, truncated otherwise
    ];

    // Add 'linkable' label if consent was given
    if (consentToLinkEmail) {
      labels.push('linkable');
    }

    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels,
    });

    // 10. Record submission for rate limiting
    await recordSubmission(adapter);

    logger.debug(`Anonymous PR created: #${pr.number} by ${displayName} (${email})`);

    return adapter.createJsonResponse(200, {

        success: true,
        pr: {
          number: pr.number,
          url: pr.html_url,
          branch: branchName,
        },
    });
  } catch (error) {
    console.error('[github-bot] Failed to create anonymous PR:', error);
    return adapter.createJsonResponse(500, { error: error.message || 'Failed to create pull request' });
  }
}

/**
 * Link anonymous edits to user account
 * Authenticates user via OAuth token and validates identity
 * Required: owner, repo
 * Optional: manual (boolean) - If true, enforces cooldown check
 * Required Header: Authorization: Bearer {token}
 */
async function handleLinkAnonymousEdits(adapter, octokit, { owner, repo, manual = false }, headers) {
  if (!owner || !repo) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo' });
  }

  // Extract and validate Authorization header
  const authHeader = headers?.authorization || headers?.Authorization;
  if (!authHeader) {
    return adapter.createJsonResponse(401, { error: 'Missing Authorization header' });
  }

  // Validate Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    return adapter.createJsonResponse(401, { error: 'Invalid Authorization header format. Use "Bearer {token}"' });
  }

  const userToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // 1. Validate token and fetch authenticated user from GitHub
    logger.info('Validating user token for anonymous edit linking', { manual });

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${userToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SlayerLegend-Wiki/1.0',
      },
    });

    if (!userResponse.ok) {
      logger.error('Token validation failed', { status: userResponse.status });
      return adapter.createJsonResponse(401, { error: 'Invalid or expired token' });
    }

    const userData = await userResponse.json();
    const userId = userData.id;
    const username = userData.login;
    let userEmail = userData.email;

    // 2. If email is null (private setting), fetch from /user/emails
    if (!userEmail) {
      try {
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `token ${userToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'SlayerLegend-Wiki/1.0',
          },
        });

        if (emailsResponse.ok) {
          const emails = await emailsResponse.json();
          const primaryEmail = emails.find(e => e.primary && e.verified);
          if (primaryEmail) {
            userEmail = primaryEmail.email;
          }
        }
      } catch (emailError) {
        logger.warn('Failed to fetch user emails', { error: emailError.message });
      }
    }

    if (!userEmail) {
      logger.info('User has no email, cannot link', { userId, username });
      return adapter.createJsonResponse(400, {
        error: 'No verified email found. Please add a verified email to your GitHub account.',
        linked: false,
        reason: 'no_email'
      });
    }

    logger.info('User authenticated for linking', { userId, username });

    // 3. Hash email server-side (don't trust client)
    const emailHash = await hashIP(userEmail); // Reuse existing hash function

    // 4. Check cooldown if this is a manual trigger
    if (manual) {
      const { checkLinkingCooldown } = await import('github-wiki-framework/src/services/github/emailUserMapping.js');
      const cooldownCheck = await checkLinkingCooldown(octokit, owner, repo, emailHash, 60); // 60 minute cooldown

      if (!cooldownCheck.allowed) {
        logger.warn('Link request denied - cooldown active', {
          userId,
          username,
          remainingSeconds: cooldownCheck.remainingSeconds
        });

        const remainingMinutes = Math.ceil(cooldownCheck.remainingSeconds / 60);
        return adapter.createJsonResponse(429, {
          error: `Please wait ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} before trying again`,
          cooldown: cooldownCheck.remainingSeconds,
          lastLinkedAt: cooldownCheck.lastLinkedAt
        });
      }

      logger.info('Cooldown check passed', { userId, username });
    }

    // 4. Find linkable PRs with hash label + 'linkable' flag
    // Note: Labels are limited to 50 chars, so we can only match first 46 chars of hash (50 - len('ref:'))
    const LABEL_MAX_HASH_LENGTH = 46;
    const truncatedHash = emailHash.substring(0, LABEL_MAX_HASH_LENGTH);

    const { data: allPRs } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'all',
      per_page: 100,
    });

    const linkablePRs = allPRs.filter(pr => {
      const labelNames = pr.labels.map(l => l.name);
      const hasRefHash = labelNames.some(name => name === `ref:${truncatedHash}`);
      const hasLinkableFlag = labelNames.includes('linkable');
      return hasRefHash && hasLinkableFlag;
    });

    logger.debug('Found linkable PRs', { count: linkablePRs.length });

    if (linkablePRs.length === 0) {
      return adapter.createJsonResponse(200, {
        linked: true,
        linkedCount: 0,
        message: 'No linkable anonymous edits found',
      });
    }

    // 2. Add user-id label to each PR (enables efficient queries)
    const userIdLabel = `user-id:${userId}`;
    for (const pr of linkablePRs) {
      try {
        await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: pr.number,
          labels: [userIdLabel],
        });
        logger.debug('Added user-id label', { prNumber: pr.number, userId });
      } catch (error) {
        logger.error('Failed to add label', { error, prNumber: pr.number });
      }
    }

    // 3. Store mapping (for future O(1) lookups)
    // Dynamically import the mapping service
    const { addEmailUserMapping } = await import('github-wiki-framework/src/services/github/emailUserMapping.js');
    await addEmailUserMapping(octokit, owner, repo, emailHash, userId, username, manual); // Update lastLinkedAt if manual=true

    logger.info('Linking completed successfully', { userId, linkedCount: linkablePRs.length });

    return adapter.createJsonResponse(200, {
      linked: true,
      linkedCount: linkablePRs.length,
      prNumbers: linkablePRs.map(pr => pr.number),
    });
  } catch (error) {
    logger.error('Failed to link anonymous edits', { error, userId });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Check achievements for authenticated user (SERVER-SIDE)
 * All data retrieval and processing happens on the server
 * Required: owner, repo
 * Required Header: Authorization: Bearer {token}
 */
async function handleCheckAchievements(adapter, octokit, { owner, repo }, headers) {
  console.log('[CF] handleCheckAchievements called', {
    owner,
    repo,
    hasHeaders: !!headers,
    authHeader: headers?.authorization ? 'present' : 'missing',
    NODE_ENV: process.env.NODE_ENV,
    CONTEXT: process.env.CONTEXT
  });

  logger.info('handleCheckAchievements called', {
    owner,
    repo,
    hasHeaders: !!headers,
    authHeader: headers?.authorization ? 'present' : 'missing',
    NODE_ENV: process.env.NODE_ENV,
    CONTEXT: process.env.CONTEXT
  });

  if (!owner || !repo) {
    console.error('[CF] Missing owner or repo', { owner, repo });
    logger.error('Missing owner or repo', { owner, repo });
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo' });
  }

  // Extract and validate Authorization header
  const authHeader = headers?.authorization || headers?.Authorization;
  if (!authHeader) {
    console.error('[CF] Missing Authorization header');
    logger.error('Missing Authorization header');
    return adapter.createJsonResponse(401, { error: 'Missing Authorization header' });
  }

  // Validate Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    console.error('[CF] Invalid Authorization header format', {
      authType: authHeader?.substring(0, 10)
    });
    logger.error('Invalid Authorization header format', {
      authType: authHeader?.substring(0, 10)
    });
    return adapter.createJsonResponse(401, { error: 'Invalid Authorization header format. Use "Bearer {token}"' });
  }

  const userToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // 1. Validate token and fetch authenticated user
    logger.debug('Validating user token for achievement checking');

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${userToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SlayerLegend-Wiki/1.0',
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      logger.error('Token validation failed', {
        status: userResponse.status,
        statusText: userResponse.statusText,
        error: errorText
      });
      return adapter.createJsonResponse(401, { error: 'Invalid or expired token' });
    }

    const userData = await userResponse.json();
    const userId = userData.id;
    const username = userData.login;

    console.log('[CF] Checking achievements server-side', { userId, username });
    logger.info('Checking achievements server-side', { userId, username });

    // 2. Load wiki config to get base URL
    let wikiConfig;
    let baseUrl;

    // Detect platform to determine if we have filesystem access
    // Netlify Functions: Have filesystem access (Node.js)
    // Cloudflare Workers: No filesystem, must fetch via HTTP
    const platform = adapter.getPlatform();
    const hasFilesystemAccess = platform === 'netlify';

    console.log('[CF] Environment check', {
      platform,
      hasFilesystemAccess,
      NODE_ENV: process.env.NODE_ENV,
      CONTEXT: process.env.CONTEXT
    });

    // In Netlify (with filesystem), load from local filesystem
    if (hasFilesystemAccess) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const configPath = path.join(process.cwd(), 'public', 'wiki-config.json');
        const configContent = fs.readFileSync(configPath, 'utf8');
        wikiConfig = JSON.parse(configContent);
        baseUrl = wikiConfig.wiki?.url || 'http://localhost:8888';
        logger.debug('Loaded wiki config from local filesystem', { baseUrl });
      } catch (error) {
        logger.warn('Failed to load wiki config, using localhost', { error: error.message });
        baseUrl = 'http://localhost:8888';
      }
    } else {
      // In production, determine base URL from environment/headers, then fetch config
      let envBaseUrl = null;
      try {
        // Try to get the host from the request headers or environment
        const cfPagesUrl = adapter.getEnv('CF_PAGES_URL');
        const urlEnv = adapter.getEnv('URL');
        const hostHeader = headers?.host;

        logger.info('Determining base URL from environment', {
          CF_PAGES_URL: cfPagesUrl,
          URL: urlEnv,
          host: hostHeader
        });

        const host = cfPagesUrl || urlEnv || hostHeader;
        if (host) {
          envBaseUrl = host.startsWith('http') ? host : `https://${host}`;
          logger.info('Using environment-derived base URL', { envBaseUrl });
        } else {
          logger.info('No environment base URL found, will load from config');
        }
      } catch (e) {
        logger.warn('Error determining base URL from environment', { error: e.message });
      }

      // Fetch wiki config to get the configured URL as fallback
      try {
        const configUrl = envBaseUrl ? `${envBaseUrl}/wiki-config.json` : 'https://slayerlegend.wiki/wiki-config.json';
        logger.info('Fetching wiki config', { configUrl });

        const configResponse = await fetch(configUrl);
        if (configResponse.ok) {
          wikiConfig = await configResponse.json();
          // Use environment baseUrl if available, otherwise use config URL
          baseUrl = envBaseUrl || wikiConfig.wiki?.url || 'https://slayerlegend.wiki';
          logger.info('Loaded wiki config from deployed site', {
            baseUrl,
            configUrl: wikiConfig.wiki?.url,
            usingEnv: !!envBaseUrl
          });
        } else {
          logger.warn('Failed to fetch wiki config, using fallback', {
            configUrl,
            status: configResponse.status,
            statusText: configResponse.statusText
          });
          baseUrl = envBaseUrl || 'https://slayerlegend.wiki';
        }
      } catch (e) {
        logger.warn('Could not load wiki config, using fallback', { error: e.message });
        baseUrl = envBaseUrl || 'https://slayerlegend.wiki';
      }

      console.log('[CF] Final base URL determined', { baseUrl });
      logger.info('Final base URL determined', { baseUrl });
    }

    // 3. Load achievement definitions from public/achievements.json
    let definitions;

    // In Netlify (with filesystem), load from local filesystem
    if (hasFilesystemAccess) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const achievementsPath = path.join(process.cwd(), 'public', 'achievements.json');
        const achievementsContent = fs.readFileSync(achievementsPath, 'utf8');
        definitions = JSON.parse(achievementsContent);
        logger.debug('Loaded achievement definitions from local filesystem');
      } catch (error) {
        logger.error('Failed to load achievement definitions from filesystem', { error: error.message });
        throw new Error('Failed to load achievement definitions');
      }
    } else {
      // In production, fetch from the deployed site
      const achievementsUrl = `${baseUrl}/achievements.json`;
      console.log('[CF] Fetching achievement definitions from deployed site', { url: achievementsUrl, baseUrl });
      logger.info('Fetching achievement definitions from deployed site', { url: achievementsUrl, baseUrl });

      try {
        const achievementDefsResponse = await fetch(achievementsUrl);
        if (!achievementDefsResponse.ok) {
          const errorText = await achievementDefsResponse.text().catch(() => 'Unable to read error body');
          console.error('[CF] Failed to fetch achievement definitions - HTTP error', {
            url: achievementsUrl,
            baseUrl,
            status: achievementDefsResponse.status,
            statusText: achievementDefsResponse.statusText,
            errorBody: errorText,
          });
          logger.error('Failed to fetch achievement definitions - HTTP error', {
            url: achievementsUrl,
            baseUrl,
            status: achievementDefsResponse.status,
            statusText: achievementDefsResponse.statusText,
            errorBody: errorText,
          });
          throw new Error(`Failed to load achievement definitions: ${achievementDefsResponse.status} ${achievementDefsResponse.statusText}`);
        }
        definitions = await achievementDefsResponse.json();
        console.log('[CF] Successfully loaded achievement definitions from deployed site', { count: definitions.achievements?.length });
        logger.info('Successfully loaded achievement definitions from deployed site', { count: definitions.achievements?.length });
      } catch (fetchError) {
        console.error('[CF] Failed to fetch achievement definitions - network/parse error', {
          url: achievementsUrl,
          baseUrl,
          error: fetchError.message,
          stack: fetchError.stack,
        });
        logger.error('Failed to fetch achievement definitions - network/parse error', {
          url: achievementsUrl,
          baseUrl,
          error: fetchError.message,
          stack: fetchError.stack,
        });
        throw new Error(`Failed to load achievement definitions: ${fetchError.message}`);
      }
    }

    // 4. Get release date from environment variable (VITE_RELEASE_DATE)
    let releaseDate = null;
    const releaseDateStr = process.env.VITE_RELEASE_DATE;
    if (releaseDateStr && releaseDateStr.trim() !== '') {
      try {
        releaseDate = new Date(releaseDateStr);
        if (isNaN(releaseDate.getTime())) {
          logger.warn('Invalid VITE_RELEASE_DATE format', { value: releaseDateStr });
          releaseDate = null;
        } else {
          logger.debug('Using release date from VITE_RELEASE_DATE', { releaseDate: releaseDate.toISOString() });
        }
      } catch (error) {
        logger.warn('Failed to parse VITE_RELEASE_DATE', { error: error.message });
        releaseDate = null;
      }
    }

    // 5. Fetch user snapshot from GitHub Issues
    const userIdLabel = `user-id:${userId}`;
    const botLogin = getBotLogin(adapter);
    const { issue: snapshotIssue } = await findUserSnapshotIssue(octokit, {
      owner,
      repo,
      userIdLabel,
      fallbackTitle: `[User Snapshot] ${username}`,
      botLogin,
    });

    let userSnapshot = null;
    if (snapshotIssue) {
      try {
        userSnapshot = JSON.parse(snapshotIssue.body);
      } catch (error) {
        logger.error('Failed to parse user snapshot', { error });
      }
    }

    // If no snapshot, use minimal data
    if (!userSnapshot) {
      userSnapshot = {
        userId,
        user: userData,
        stats: { totalPRs: 0, mergedPRs: 0, totalAdditions: 0, closedPRs: 0, totalFiles: 0 },
        pullRequests: [],
      };
    }

    // Filter PRs and recalculate stats based on release date
    if (releaseDate && userSnapshot.pullRequests) {
      const filteredPRs = userSnapshot.pullRequests.filter(pr => {
        if (!pr.created_at) return false;
        const prDate = new Date(pr.created_at);
        return prDate >= releaseDate;
      });

      // Recalculate stats from filtered PRs
      userSnapshot.pullRequests = filteredPRs;
      userSnapshot.stats = {
        totalPRs: filteredPRs.length,
        mergedPRs: filteredPRs.filter(pr => pr.merged_at).length,
        closedPRs: filteredPRs.filter(pr => pr.state === 'closed' && !pr.merged_at).length,
        totalAdditions: filteredPRs.reduce((sum, pr) => sum + (pr.additions || 0), 0),
        totalDeletions: filteredPRs.reduce((sum, pr) => sum + (pr.deletions || 0), 0),
        totalFiles: new Set(filteredPRs.flatMap(pr => (pr.files || []).map(f => f.filename))).size,
      };

      logger.debug('Filtered PRs by release date', {
        original: userSnapshot.pullRequests?.length || 0,
        filtered: filteredPRs.length,
        releaseDate: releaseDate.toISOString(),
      });
    }

    // 6. Get existing achievements
    const { issue: achievementsIssue, legacy: legacyAchievements } = await findUserAchievementsIssue(octokit, {
      owner,
      repo,
      userIdLabel,
      fallbackTitle: `[Achievements] ${username}`,
      botLogin,
    });

    let existingAchievements = [];
    if (achievementsIssue) {
      try {
        const existingData = JSON.parse(achievementsIssue.body);
        existingAchievements = existingData.achievements || [];
      } catch (error) {
        logger.error('Failed to parse existing achievements', { error });
      }
    }

    const unlockedIds = new Set(existingAchievements.map(a => a.id));

    // 7. Run deciders server-side to check for new achievements
    const newlyUnlocked = [];

    for (const achievement of definitions.achievements) {
      if (unlockedIds.has(achievement.id)) continue;

      // Run decider logic server-side
      const isUnlocked = await runDecider(achievement.id, userSnapshot, {
        octokit,
        owner,
        repo,
        userId,
        username,
        releaseDate,
        baseUrl, // Pass baseUrl for deciders that need to fetch data files
      });

      if (isUnlocked) {
        newlyUnlocked.push({
          id: achievement.id,
          unlockedAt: new Date().toISOString(),
          progress: 100,
        });
      }
    }

    // 8. If new achievements found, save to GitHub Issues
    if (newlyUnlocked.length > 0) {
      const allAchievements = [...existingAchievements, ...newlyUnlocked];
      const issueData = {
        userId,
        username,
        lastUpdated: new Date().toISOString(),
        achievements: allAchievements,
        version: '1.0',
      };

      const { created } = await saveUserAchievements(octokit, {
        owner,
        repo,
        username,
        userIdLabel,
        existingIssue: achievementsIssue,
        legacy: legacyAchievements,
        issueData,
        botLogin,
      });
      logger.info(created ? 'Created achievements' : 'Updated achievements', { username, newCount: newlyUnlocked.length });
    }

    return adapter.createJsonResponse(200, {
      checked: true,
      newlyUnlocked,
      totalAchievements: existingAchievements.length + newlyUnlocked.length,
    });
  } catch (error) {
    if (isAbsenceUnconfirmed(error)) return absenceUnconfirmedResponse(adapter, error);
    console.error('[CF] Failed to check achievements - caught error', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    logger.error('Failed to check achievements - caught error', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    return adapter.createJsonResponse(500, {
      error: error.message || 'Failed to check achievements',
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
}

/**
 * Check Single Achievement (SERVER-SIDE)
 * Targeted achievement check for immediate feedback
 * Required: owner, repo, achievementId
 * Required Header: Authorization: Bearer {token}
 */
async function handleCheckSingleAchievement(adapter, octokit, { owner, repo, achievementId }, headers) {
  console.log('[CF] handleCheckSingleAchievement called', {
    owner,
    repo,
    achievementId,
    hasHeaders: !!headers,
    authHeader: headers?.authorization ? 'present' : 'missing',
  });

  if (!owner || !repo || !achievementId) {
    console.error('[CF] Missing required fields', { owner, repo, achievementId });
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo, achievementId' });
  }

  // Extract and validate Authorization header
  const authHeader = headers?.authorization || headers?.Authorization;
  if (!authHeader) {
    console.error('[CF] Missing Authorization header');
    return adapter.createJsonResponse(401, { error: 'Missing Authorization header' });
  }

  // Validate Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    console.error('[CF] Invalid Authorization header format');
    return adapter.createJsonResponse(401, { error: 'Invalid Authorization header format. Use "Bearer {token}"' });
  }

  const userToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // 1. Validate token and fetch authenticated user
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${userToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SlayerLegend-Wiki/1.0',
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('[CF] Token validation failed', {
        status: userResponse.status,
        error: errorText
      });
      return adapter.createJsonResponse(401, { error: 'Invalid or expired token' });
    }

    const userData = await userResponse.json();
    const userId = userData.id;
    const username = userData.login;

    console.log('[CF] Checking single achievement', { userId, username, achievementId });

    // 2. Load achievement definition
    const platform = adapter.getPlatform();
    const hasFilesystemAccess = platform === 'netlify';
    let definitions;

    if (hasFilesystemAccess) {
      const fs = await import('fs');
      const path = await import('path');
      const achievementsPath = path.join(process.cwd(), 'public', 'achievements.json');
      const achievementsContent = fs.readFileSync(achievementsPath, 'utf8');
      definitions = JSON.parse(achievementsContent);
    } else {
      // Fetch from deployed site
      const host = adapter.getEnv('CF_PAGES_URL') || adapter.getEnv('URL') || headers?.host;
      const baseUrl = host ? (host.startsWith('http') ? host : `https://${host}`) : 'https://slayerlegend.wiki';
      const achievementsUrl = `${baseUrl}/achievements.json`;
      const response = await fetch(achievementsUrl);
      if (!response.ok) {
        throw new Error(`Failed to load achievements: ${response.status}`);
      }
      definitions = await response.json();
    }

    // Find the achievement definition
    const achievementDef = definitions.achievements.find(a => a.id === achievementId);
    if (!achievementDef) {
      console.warn('[CF] Achievement not found', { achievementId });
      return adapter.createJsonResponse(404, { error: `Achievement not found: ${achievementId}` });
    }

    // 3. Get user snapshot
    const userIdLabel = `user-id:${userId}`;
    const botLogin = getBotLogin(adapter);
    const { issue: snapshotIssue } = await findUserSnapshotIssue(octokit, {
      owner,
      repo,
      userIdLabel,
      fallbackTitle: `[User Snapshot] ${username}`,
      botLogin,
    });

    let userSnapshot = null;
    if (snapshotIssue) {
      try {
        userSnapshot = JSON.parse(snapshotIssue.body);
      } catch (error) {
        console.error('[CF] Failed to parse user snapshot', error);
      }
    }

    // If no snapshot, use minimal data
    if (!userSnapshot) {
      userSnapshot = {
        userId,
        user: userData,
        stats: { totalPRs: 0, mergedPRs: 0, totalAdditions: 0, closedPRs: 0, totalFiles: 0 },
        pullRequests: [],
      };
    }

    // 4. Check if already unlocked
    const { issue: achievementsIssue, legacy: legacyAchievements } = await findUserAchievementsIssue(octokit, {
      owner,
      repo,
      userIdLabel,
      fallbackTitle: `[Achievements] ${username}`,
      botLogin,
    });

    let existingAchievements = [];

    if (achievementsIssue) {
      try {
        const data = JSON.parse(achievementsIssue.body);
        existingAchievements = data.achievements || [];
      } catch (error) {
        console.error('[CF] Failed to parse achievements', error);
      }
    }

    // Check if already unlocked
    const alreadyUnlocked = existingAchievements.some(a => a.id === achievementId);
    if (alreadyUnlocked) {
      console.log('[CF] Achievement already unlocked', { achievementId });
      return adapter.createJsonResponse(200, {
        unlocked: false,
        alreadyHas: true,
        message: 'Achievement already unlocked'
      });
    }

    // 5. Run the decider
    const platform2 = adapter.getPlatform();
    const hasFilesystemAccess2 = platform2 === 'netlify';
    let baseUrl = 'https://slayerlegend.wiki';

    if (!hasFilesystemAccess2) {
      const host = adapter.getEnv('CF_PAGES_URL') || adapter.getEnv('URL') || headers?.host;
      if (host) {
        baseUrl = host.startsWith('http') ? host : `https://${host}`;
      }
    }

    const isUnlocked = await runDecider(achievementId, userSnapshot, {
      octokit,
      owner,
      repo,
      userId,
      username,
      releaseDate: null, // TODO: get from env if needed
      baseUrl,
    });

    if (!isUnlocked) {
      console.log('[CF] Achievement not yet unlocked', { achievementId });
      return adapter.createJsonResponse(200, {
        unlocked: false,
        message: 'Achievement requirements not met'
      });
    }

    // 6. Save the achievement
    const newAchievement = {
      id: achievementId,
      unlockedAt: new Date().toISOString(),
      progress: 100,
    };

    const allAchievements = [...existingAchievements, newAchievement];
    const issueData = {
      userId,
      username,
      lastUpdated: new Date().toISOString(),
      achievements: allAchievements,
      version: '1.0',
    };

    const { created } = await saveUserAchievements(octokit, {
      owner,
      repo,
      username,
      userIdLabel,
      existingIssue: achievementsIssue,
      legacy: legacyAchievements,
      issueData,
      botLogin,
    });
    logger.info(created ? 'Created achievements' : 'Updated achievements', { username, achievementId });

    // Return the full achievement data for client
    return adapter.createJsonResponse(200, {
      unlocked: true,
      achievement: {
        ...achievementDef,
        ...newAchievement,
      }
    });

  } catch (error) {
    if (isAbsenceUnconfirmed(error)) return absenceUnconfirmedResponse(adapter, error);
    console.error('[CF] Failed to check single achievement', {
      error: error.message,
      stack: error.stack,
    });
    return adapter.createJsonResponse(500, {
      error: error.message || 'Failed to check achievement'
    });
  }
}

/**
 * Run achievement decider logic server-side
 * Uses plugin-based decider registry (framework defaults + custom)
 */
async function runDecider(achievementId, userData, context) {
  try {
    // Load deciders from registry
    const deciders = await loadAchievementDeciders();

    // Get decider function for this achievement
    const deciderFn = deciders[achievementId];

    if (!deciderFn) {
      logger.warn('No decider found for achievement', { achievementId });
      return false;
    }

    // Run the decider
    return await deciderFn(userData, context);
  } catch (error) {
    logger.error('Decider execution failed', { achievementId, error: error.message });
    return false;
  }
}

// ============================================================================
// Content Creator Handler Functions
// ============================================================================

const CREATOR_INDEX_LABEL = 'content-creator-index';
const CREATOR_INDEX_TITLE = '[Content Creator Index]';
const CREATOR_INDEX_HEADER = '# Content Creator Index\n\n## Approved Creators\n';
const PENDING_APPROVALS_HEADER = '\n## Pending Approvals\n';
const CREATOR_INDEX_FOOTER = '\n---\n\n🤖 Managed by wiki bot';
const CREATOR_INDEX_INITIAL_BODY = CREATOR_INDEX_HEADER + PENDING_APPROVALS_HEADER + CREATOR_INDEX_FOOTER;
const CREATOR_INDEX_LOCK_REASON = 'resolved';
/** How long a finished index lookup keeps answering reads in this isolate; writes always look up afresh. */
const CREATOR_INDEX_CACHE_TTL_MS = 5000;

/**
 * Coalesced index lookups, keyed by "owner/repo" (creation uses its own key).
 * Each entry records when it started, so freshness is judged on read and
 * nothing depends on a timer firing after the response has been sent, which
 * Cloudflare Workers do not guarantee.
 */
const creatorIndexLookups = new Map();

/** GitHub stores bodies edited in the web UI with CRLF; the parsers below anchor on LF. */
function normalizeIndexBody(body) {
  return String(body ?? '').replace(/\r\n?/g, '\n');
}

/**
 * Parse creator index map from issue body
 * Returns: Map<creatorId, commentId>
 */
function parseCreatorIndex(body) {
  const map = new Map();
  const text = normalizeIndexBody(body);
  if (!text) return map;

  // Find the Approved Creators section
  const approvedSection = text.match(/## Approved Creators\n([\s\S]*?)(?=\n##|\n---|\n🤖|$)/);
  if (!approvedSection) return map;

  // Match lines like: [creator-id]=comment-id
  const regex = /\[([a-z0-9-]+)\]=(\d+)/gi;
  let match;

  while ((match = regex.exec(approvedSection[1])) !== null) {
    const creatorId = match[1];
    const commentId = parseInt(match[2], 10);
    map.set(creatorId, commentId);
  }

  return map;
}

/**
 * Parse pending approvals from issue body
 * Returns: Array<{ creatorId, checked, commentUrl, channelName, platform, submittedBy }>
 */
function parsePendingApprovals(body) {
  const pending = [];
  const text = normalizeIndexBody(body);
  if (!text) return pending;

  // Find the Pending Approvals section
  const pendingSection = text.match(/## Pending Approvals\n([\s\S]*?)(?=\n---|\n🤖|$)/);
  if (!pendingSection) return pending;

  // Match lines like: - [ ] [Name](URL#comment-123) - Platform - submitted by @user
  const regex = /- \[([ x])\] \[([^\]]+)\]\(([^)]+#issuecomment-(\d+))\) - ([^-]+) - submitted by @([^\n]+)/gi;
  let match;

  while ((match = regex.exec(pendingSection[1])) !== null) {
    const checked = match[1] === 'x';
    const channelName = match[2].trim();
    const commentUrl = match[3].trim();
    const commentId = match[4];
    const platform = match[5].trim().toLowerCase();
    const submittedBy = match[6].trim();

    // Extract creator ID from comment data (will need to fetch)
    pending.push({
      commentId: parseInt(commentId, 10),
      checked,
      channelName,
      platform,
      submittedBy,
      commentUrl
    });
  }

  return pending;
}

/**
 * Serialize creator index map to issue body
 */
function serializeCreatorIndex(approvedMap, pendingList) {
  let body = CREATOR_INDEX_HEADER;

  // Add approved creators
  for (const [creatorId, commentId] of approvedMap.entries()) {
    body += `[${creatorId}]=${commentId}\n`;
  }

  // Add pending approvals section
  body += PENDING_APPROVALS_HEADER;
  for (const pending of pendingList) {
    const checkbox = pending.checked ? 'x' : ' ';
    body += `- [${checkbox}] [${pending.channelName}](${pending.commentUrl}) - ${pending.platform} - submitted by @${pending.submittedBy}\n`;
  }

  body += CREATOR_INDEX_FOOTER;
  return body;
}

/** The index is "empty" when it has never received a submission: template body, no comments. */
function isCreatorIndexEmpty(issue) {
  return (issue.comments ?? 0) === 0
    && parseCreatorIndex(issue.body).size === 0
    && parsePendingApprovals(issue.body).length === 0;
}

/**
 * Merge strategy for duplicate index issues: union the approved map and the
 * pending list into the canonical (oldest) issue. Comment IDs stay valid on
 * closed issues, so submissions themselves never move.
 */
function createCreatorIndexMerge(octokit, owner, repo) {
  return async (canonical, duplicate) => {
    if (isCreatorIndexEmpty(duplicate)) return;

    const approved = parseCreatorIndex(canonical.body);
    const pending = parsePendingApprovals(canonical.body);
    let changed = false;

    for (const [creatorId, commentId] of parseCreatorIndex(duplicate.body)) {
      if (!approved.has(creatorId)) {
        approved.set(creatorId, commentId);
        changed = true;
      }
    }

    const knownComments = new Set(pending.map(entry => entry.commentId));
    for (const entry of parsePendingApprovals(duplicate.body)) {
      if (!knownComments.has(entry.commentId)) {
        pending.push(entry);
        changed = true;
      }
    }

    if (!changed) return;
    const body = serializeCreatorIndex(approved, pending);
    await updateCreatorIndexBody(octokit, { owner, repo, issueNumber: canonical.number, body });
    canonical.body = body;
    logger.info('Merged duplicate content creator index', { canonical: canonical.number, duplicate: duplicate.number });
  };
}

function toCreatorIndexData(issue) {
  return { issueNumber: issue.number, issueUrl: issue.html_url, body: issue.body || '' };
}

/**
 * Load the JSON submissions stored as comments, concurrently. Comments that
 * cannot be read or parsed are logged and skipped.
 * @param {Array<{creatorId?: string, commentId: number}>} entries
 * @returns {Promise<Object[]>}
 */
async function fetchCreatorComments(octokit, { owner, repo }, entries) {
  const results = await Promise.all(entries.map(async ({ creatorId, commentId }) => {
    try {
      const { data: comment } = await octokit.rest.issues.getComment({ owner, repo, comment_id: commentId });
      return JSON.parse(comment.body);
    } catch (error) {
      logger.warn('Failed to fetch creator comment', { creatorId, commentId, error: error.message });
      return null;
    }
  }));
  return results.filter(Boolean);
}

const creatorIndexCacheKey = (owner, repo) => `${owner}/${repo}`;

/** Drop cached lookups for a repository; every write to the index must call this. */
function forgetCreatorIndex(owner, repo) {
  const key = creatorIndexCacheKey(owner, repo);
  creatorIndexLookups.delete(key);
  creatorIndexLookups.delete(`${key}#create`);
}

/** Rewrite the index body and make sure no cached copy of the old body survives. */
async function updateCreatorIndexBody(octokit, { owner, repo, issueNumber, body }) {
  try {
    await octokit.rest.issues.update({ owner, repo, issue_number: issueNumber, body });
  } finally {
    forgetCreatorIndex(owner, repo);
  }
}

/** Share one in-flight lookup with concurrent callers; a failure is evicted at once so nobody inherits it. */
function rememberCreatorIndexLookup(key, promise) {
  const entry = { promise, at: Date.now() };
  creatorIndexLookups.set(key, entry);
  promise.catch(() => {
    if (creatorIndexLookups.get(key) === entry) creatorIndexLookups.delete(key);
  });
  return promise;
}

/** A cached lookup that is still fresh, or null. */
function cachedCreatorIndexLookup(key) {
  const entry = creatorIndexLookups.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CREATOR_INDEX_CACHE_TTL_MS) {
    creatorIndexLookups.delete(key);
    return null;
  }
  return entry.promise;
}

/**
 * Find the canonical content creator index WITHOUT creating it.
 *
 * Reads share a short-lived cached lookup and never write. Write and admin
 * paths pass `fresh` (skip the cache, so the body they rewrite is current)
 * and `reconcile` (merge and close duplicates left behind by earlier races).
 * @returns {Promise<{issue: Object|null, confirmedAbsent: boolean}>}
 */
function findCreatorIndex(octokit, { owner, repo, botLogin, fresh = false, reconcile = false }) {
  const key = creatorIndexCacheKey(owner, repo);

  if (!fresh) {
    const cached = cachedCreatorIndexLookup(key);
    if (cached) {
      logger.debug('Reusing recent creator index lookup', { key });
      return cached;
    }
  }

  const request = (async () => {
    const result = await findCanonicalIssue(octokit, {
      owner,
      repo,
      labels: [CREATOR_INDEX_LABEL],
      title: CREATOR_INDEX_TITLE,
      logger: lookupLogger,
    });

    if (reconcile && result.issue && result.duplicates.length > 0) {
      const reconciled = await reconcileDuplicates(octokit, {
        owner,
        repo,
        canonical: result.issue,
        duplicates: result.duplicates,
        merge: createCreatorIndexMerge(octokit, owner, repo),
        botLogin,
        logger: lookupLogger,
      });
      logger.warn('Duplicate content creator index issues reconciled', { canonical: result.issue.number, ...reconciled });
    }

    return { issue: result.issue, confirmedAbsent: result.confirmedAbsent };
  })();

  return rememberCreatorIndexLookup(key, request);
}

/**
 * Get the canonical index, creating it only once its absence is confirmed.
 * Only submissions (writes) may call this; reads use findCreatorIndex. The
 * body returned is always current: the lookup is fresh, and a coalesced
 * creation is re-read by number before it is handed out.
 * @returns {Promise<{issueNumber: number, issueUrl: string, body: string}>}
 */
async function getOrCreateCreatorIndex(octokit, { owner, repo, botLogin }) {
  const found = await findCreatorIndex(octokit, { owner, repo, botLogin, fresh: true, reconcile: true });
  if (found.issue) {
    return toCreatorIndexData(found.issue);
  }

  // Concurrent submissions in this isolate share one creation
  const createKey = `${creatorIndexCacheKey(owner, repo)}#create`;
  const creating = cachedCreatorIndexLookup(createKey) ?? rememberCreatorIndexLookup(createKey, (async () => {
    const { issue, created } = await getOrCreateIssue(octokit, {
      owner,
      repo,
      labels: [CREATOR_INDEX_LABEL],
      matchTitle: CREATOR_INDEX_TITLE,
      title: CREATOR_INDEX_TITLE,
      body: CREATOR_INDEX_INITIAL_BODY,
      lock: true,
      lockReason: CREATOR_INDEX_LOCK_REASON,
      merge: createCreatorIndexMerge(octokit, owner, repo),
      botLogin,
      logger: lookupLogger,
    });
    if (created) {
      logger.info('Created content creator index issue', { issueNumber: issue.number });
    }
    creatorIndexLookups.delete(creatorIndexCacheKey(owner, repo));
    return { issue, confirmedAbsent: false };
  })());

  const { issue } = await creating;
  // Another caller may have written to the index since it was created
  const current = await getIssue(octokit, { owner, repo, number: issue.number });
  return toCreatorIndexData(current ?? issue);
}

/**
 * Get or create content creator index issue (a write: creates when confirmed absent)
 * Required: owner, repo
 */
async function handleGetOrCreateCreatorIndex(adapter, octokit, { owner, repo }) {
  if (!owner || !repo) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo' });
  }

  try {
    const data = await getOrCreateCreatorIndex(octokit, { owner, repo, botLogin: getBotLogin(adapter) });
    return adapter.createJsonResponse(200, data);
  } catch (error) {
    if (isAbsenceUnconfirmed(error)) return absenceUnconfirmedResponse(adapter, error);
    logger.error('Failed to get/create creator index', { error: error.message });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Submit content creator (create comment + add pending checkbox)
 * Required: owner, repo, creatorId, channelUrl, channelName, platform, submittedBy
 */
async function handleSubmitContentCreator(adapter, octokit, { owner, repo, creatorId, channelUrl, channelName, platform, submittedBy }) {
  if (!owner || !repo || !creatorId || !channelUrl || !channelName || !platform || !submittedBy) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, creatorId, channelUrl, channelName, platform, submittedBy'
    });
  }

  try {
    // Submission is the only creator-index path allowed to create the index
    const indexData = await getOrCreateCreatorIndex(octokit, { owner, repo, botLogin: getBotLogin(adapter) });
    const issueNumber = indexData.issueNumber;
    const currentBody = indexData.body;

    // Check if already exists
    const indexMap = parseCreatorIndex(currentBody);
    if (indexMap.has(creatorId)) {
      return adapter.createJsonResponse(409, { error: 'This creator has already been submitted' });
    }

    // Create comment with submission data
    const submissionData = {
      creatorId,
      platform,
      channelUrl,
      channelName,
      submittedBy,
      submittedAt: new Date().toISOString(),
      approved: false,
      approvedBy: null,
      approvedAt: null
    };

    const { data: comment } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: JSON.stringify(submissionData, null, 2)
    });

    // Parse current pending list
    const pendingList = parsePendingApprovals(currentBody);

    // Add new pending entry
    const commentUrl = `https://github.com/${owner}/${repo}/issues/${issueNumber}#issuecomment-${comment.id}`;
    pendingList.push({
      commentId: comment.id,
      checked: false,
      channelName,
      platform,
      submittedBy,
      commentUrl
    });

    // Update issue body with new pending entry
    const updatedBody = serializeCreatorIndex(indexMap, pendingList);
    await updateCreatorIndexBody(octokit, { owner, repo, issueNumber, body: updatedBody });

    logger.info('Created content creator submission', { creatorId, commentId: comment.id });

    return adapter.createJsonResponse(201, {
      creatorId,
      commentId: comment.id,
      issueNumber,
      issueUrl: `https://github.com/${owner}/${repo}/issues/${issueNumber}`
    });
  } catch (error) {
    if (isAbsenceUnconfirmed(error)) return absenceUnconfirmedResponse(adapter, error);
    logger.error('Failed to submit content creator', { error: error.message, creatorId });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Get approved creators
 * Required: owner, repo
 */
async function handleGetApprovedCreators(adapter, octokit, { owner, repo }) {
  if (!owner || !repo) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo' });
  }

  try {
    // Reads never create the index; no index simply means no creators yet
    const { issue: indexIssue } = await findCreatorIndex(octokit, { owner, repo, botLogin: getBotLogin(adapter) });

    // Parse index map
    const indexMap = parseCreatorIndex(indexIssue?.body);

    if (indexMap.size === 0) {
      return adapter.createJsonResponse(200, { creators: [] });
    }

    // Fetch all approved creator comments
    const creators = await fetchCreatorComments(octokit, { owner, repo }, [...indexMap.entries()].map(
      ([creatorId, commentId]) => ({ creatorId, commentId })
    ));

    return adapter.createJsonResponse(200, { creators });
  } catch (error) {
    logger.error('Failed to get approved creators', { error: error.message });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Get all creator submissions (for admin panel)
 * Required: owner, repo
 */
async function handleGetAllCreatorSubmissions(adapter, octokit, { owner, repo }) {
  if (!owner || !repo) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo' });
  }

  try {
    // Reads never create the index; no index simply means no submissions yet
    const { issue: indexIssue } = await findCreatorIndex(octokit, { owner, repo, botLogin: getBotLogin(adapter) });
    const body = indexIssue?.body ?? '';

    // Parse both approved and pending
    const indexMap = parseCreatorIndex(body);
    const pendingList = parsePendingApprovals(body);

    // Fetch approved and pending comments together
    const submissions = await fetchCreatorComments(octokit, { owner, repo }, [
      ...[...indexMap.entries()].map(([creatorId, commentId]) => ({ creatorId, commentId })),
      ...pendingList.map((pending) => ({ commentId: pending.commentId })),
    ]);

    return adapter.createJsonResponse(200, { submissions });
  } catch (error) {
    logger.error('Failed to get all creator submissions', { error: error.message });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Sync creator approvals from checkboxes
 * Required: owner, repo, adminUsername, userToken
 */
async function handleSyncCreatorApprovals(adapter, octokit, { owner, repo, adminUsername, userToken }) {
  if (!owner || !repo || !adminUsername || !userToken) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, adminUsername, userToken'
    });
  }

  // Verify admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return adapter.createJsonResponse(403, { error: 'Only repository owner and admins can perform this action' });
    }
  } catch (error) {
    logger.error('Permission check failed', { error: error.message });
    return adapter.createJsonResponse(403, { error: 'Permission verification failed' });
  }

  try {
    // Admin actions operate on the existing index only; there is nothing to act on without one
    const { issue: indexIssue } = await findCreatorIndex(octokit, {
      owner,
      repo,
      botLogin: getBotLogin(adapter),
      fresh: true,
      reconcile: true,
    });
    if (!indexIssue) {
      return adapter.createJsonResponse(404, { error: 'No content creator index exists yet' });
    }
    const issueNumber = indexIssue.number;
    const body = indexIssue.body || '';

    // Parse current state
    const indexMap = parseCreatorIndex(body);
    const pendingList = parsePendingApprovals(body);

    let updatesCount = 0;

    // Process newly checked boxes
    for (const pending of pendingList) {
      if (pending.checked && !indexMap.has(pending.creatorId)) {
        // Fetch comment data
        try {
          const { data: comment } = await octokit.rest.issues.getComment({
            owner,
            repo,
            comment_id: pending.commentId
          });

          const creatorData = JSON.parse(comment.body);

          // Update approval status
          creatorData.approved = true;
          creatorData.approvedBy = adminUsername;
          creatorData.approvedAt = new Date().toISOString();

          // Update comment
          await octokit.rest.issues.updateComment({
            owner,
            repo,
            comment_id: pending.commentId,
            body: JSON.stringify(creatorData, null, 2)
          });

          // Add to index (remember the creatorId so the pending entry is retired below)
          pending.creatorId = creatorData.creatorId;
          indexMap.set(creatorData.creatorId, pending.commentId);
          updatesCount++;

          logger.info('Approved creator via checkbox sync', { creatorId: creatorData.creatorId });
        } catch (error) {
          logger.error('Failed to process checked creator', { commentId: pending.commentId, error: error.message });
        }
      }
    }

    // Update pending list to remove approved items
    const updatedPendingList = pendingList.filter(p => !p.checked || !indexMap.has(p.creatorId));

    // Update issue body
    const updatedBody = serializeCreatorIndex(indexMap, updatedPendingList);
    await updateCreatorIndexBody(octokit, { owner, repo, issueNumber, body: updatedBody });

    return adapter.createJsonResponse(200, {
      updatesCount,
      message: `Synced ${updatesCount} approval(s)`
    });
  } catch (error) {
    logger.error('Failed to sync creator approvals', { error: error.message });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Approve creator manually
 * Required: owner, repo, creatorId, adminUsername, userToken
 */
async function handleApproveCreator(adapter, octokit, { owner, repo, creatorId, adminUsername, userToken }) {
  if (!owner || !repo || !creatorId || !adminUsername || !userToken) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, creatorId, adminUsername, userToken'
    });
  }

  // Verify admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return adapter.createJsonResponse(403, { error: 'Only repository owner and admins can perform this action' });
    }
  } catch (error) {
    logger.error('Permission check failed', { error: error.message });
    return adapter.createJsonResponse(403, { error: 'Permission verification failed' });
  }

  try {
    // Admin actions operate on the existing index only; there is nothing to act on without one
    const { issue: indexIssue } = await findCreatorIndex(octokit, {
      owner,
      repo,
      botLogin: getBotLogin(adapter),
      fresh: true,
      reconcile: true,
    });
    if (!indexIssue) {
      return adapter.createJsonResponse(404, { error: 'No content creator index exists yet' });
    }
    const issueNumber = indexIssue.number;
    const body = indexIssue.body || '';

    // Parse current state
    const indexMap = parseCreatorIndex(body);
    const pendingList = parsePendingApprovals(body);

    // Check if already approved
    if (indexMap.has(creatorId)) {
      return adapter.createJsonResponse(409, { error: 'Creator already approved' });
    }

    // Find in pending list
    const pending = pendingList.find(p => {
      // We need to fetch the comment to get the creatorId
      return true; // Will check in loop
    });

    let commentId = null;
    let creatorData = null;

    // Search through pending comments to find the matching creator
    for (const p of pendingList) {
      try {
        const { data: comment } = await octokit.rest.issues.getComment({
          owner,
          repo,
          comment_id: p.commentId
        });

        const data = JSON.parse(comment.body);
        if (data.creatorId === creatorId) {
          commentId = p.commentId;
          creatorData = data;
          break;
        }
      } catch (error) {
        logger.warn('Failed to check pending comment', { commentId: p.commentId, error: error.message });
      }
    }

    if (!commentId || !creatorData) {
      return adapter.createJsonResponse(404, { error: 'Creator not found in pending list' });
    }

    // Update approval status
    creatorData.approved = true;
    creatorData.approvedBy = adminUsername;
    creatorData.approvedAt = new Date().toISOString();

    // Update comment
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body: JSON.stringify(creatorData, null, 2)
    });

    // Add to index
    indexMap.set(creatorId, commentId);

    // Remove from pending list and check the checkbox
    const updatedPendingList = pendingList.map(p => {
      if (p.commentId === commentId) {
        return { ...p, checked: true };
      }
      return p;
    }).filter(p => p.commentId !== commentId);

    // Update issue body
    const updatedBody = serializeCreatorIndex(indexMap, updatedPendingList);
    await updateCreatorIndexBody(octokit, { owner, repo, issueNumber, body: updatedBody });

    logger.info('Approved creator manually', { creatorId, adminUsername });

    return adapter.createJsonResponse(200, {
      message: 'Creator approved successfully',
      creatorId
    });
  } catch (error) {
    logger.error('Failed to approve creator', { error: error.message, creatorId });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Delete creator submission
 * Required: owner, repo, creatorId, adminUsername, userToken
 */
async function handleDeleteCreatorSubmission(adapter, octokit, { owner, repo, creatorId, adminUsername, userToken }) {
  if (!owner || !repo || !creatorId || !adminUsername || !userToken) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, creatorId, adminUsername, userToken'
    });
  }

  // Verify admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return adapter.createJsonResponse(403, { error: 'Only repository owner and admins can perform this action' });
    }
  } catch (error) {
    logger.error('Permission check failed', { error: error.message });
    return adapter.createJsonResponse(403, { error: 'Permission verification failed' });
  }

  try {
    // Admin actions operate on the existing index only; there is nothing to act on without one
    const { issue: indexIssue } = await findCreatorIndex(octokit, {
      owner,
      repo,
      botLogin: getBotLogin(adapter),
      fresh: true,
      reconcile: true,
    });
    if (!indexIssue) {
      return adapter.createJsonResponse(404, { error: 'No content creator index exists yet' });
    }
    const issueNumber = indexIssue.number;
    const body = indexIssue.body || '';

    // Parse current state
    const indexMap = parseCreatorIndex(body);
    const pendingList = parsePendingApprovals(body);

    let commentId = null;

    // Check if in approved list
    if (indexMap.has(creatorId)) {
      commentId = indexMap.get(creatorId);
      indexMap.delete(creatorId);
    } else {
      // Search in pending list
      for (const p of pendingList) {
        try {
          const { data: comment } = await octokit.rest.issues.getComment({
            owner,
            repo,
            comment_id: p.commentId
          });

          const data = JSON.parse(comment.body);
          if (data.creatorId === creatorId) {
            commentId = p.commentId;
            break;
          }
        } catch (error) {
          logger.warn('Failed to check pending comment', { commentId: p.commentId, error: error.message });
        }
      }
    }

    if (!commentId) {
      return adapter.createJsonResponse(404, { error: 'Creator not found' });
    }

    // Delete comment
    await octokit.rest.issues.deleteComment({
      owner,
      repo,
      comment_id: commentId
    });

    // Remove from pending list
    const updatedPendingList = pendingList.filter(p => p.commentId !== commentId);

    // Update issue body
    const updatedBody = serializeCreatorIndex(indexMap, updatedPendingList);
    await updateCreatorIndexBody(octokit, { owner, repo, issueNumber, body: updatedBody });

    logger.info('Deleted creator submission', { creatorId, adminUsername });

    return adapter.createJsonResponse(200, {
      message: 'Creator deleted successfully',
      creatorId
    });
  } catch (error) {
    logger.error('Failed to delete creator submission', { error: error.message, creatorId });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Submit video guide (YouTube link)
 * Creates a PR to add guide to video-guides.json
 * Supports both authenticated and anonymous submissions
 */
async function handleSubmitVideoGuide(adapter, octokit, body) {
  const { owner, repo, guideData, userEmail, verificationToken, userToken } = body;

  // Validate required fields
  if (!owner || !repo || !guideData) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, guideData'
    });
  }

  if (!guideData.videoUrl || !guideData.title || !guideData.description) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required guide fields: videoUrl, title, description'
    });
  }

  try {
    // Determine if authenticated or anonymous
    let submittedBy = 'anonymous';
    let useOctokit = octokit; // Bot token by default

    if (userToken) {
      // Authenticated user - validate token and get user info
      const userOctokit = new Octokit({
        auth: userToken,
        userAgent: 'GitHub-Wiki-Bot/1.0'
      });

      try {
        const { data: userData } = await userOctokit.rest.users.getAuthenticated();
        submittedBy = userData.login;
        useOctokit = userOctokit; // Use user's token for PR
        logger.info('Authenticated video guide submission', { username: submittedBy });
      } catch (error) {
        logger.warn('Token validation failed, falling back to anonymous', { error: error.message });
      }
    }

    // For anonymous submissions, verify email
    if (!userToken) {
      if (!userEmail || !verificationToken) {
        return adapter.createJsonResponse(400, {
          error: 'Anonymous submissions require email verification'
        });
      }

      // Verify email token
      const jwt = await import('../jwt.js');
      const secret = adapter.getEnv('EMAIL_VERIFICATION_SECRET');
      if (!secret) {
        return adapter.createJsonResponse(500, { error: 'Email verification not configured' });
      }

      try {
        const decoded = await jwt.verify(verificationToken, secret);
        if (!decoded || decoded.email !== userEmail) {
          return adapter.createJsonResponse(400, { error: 'Email verification expired or invalid' });
        }
        logger.debug('Email verification token valid', { email: userEmail });
      } catch (error) {
        logger.warn('Email verification failed', { error: error.message });
        return adapter.createJsonResponse(400, { error: 'Email verification expired or invalid' });
      }
    }

    // Fetch current video-guides.json
    const { data: fileData } = await useOctokit.rest.repos.getContent({
      owner,
      repo,
      path: 'public/data/video-guides.json',
      ref: 'main'
    });

    // Decode and parse
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const videoGuidesData = JSON.parse(currentContent);
    const existingGuides = videoGuidesData.videoGuides || [];

    // Check for duplicate URL
    const duplicateUrl = existingGuides.find(g => g.videoUrl === guideData.videoUrl);
    if (duplicateUrl) {
      return adapter.createJsonResponse(400, { error: 'This video has already been submitted' });
    }

    // Generate unique ID
    const id = generateGuideId(guideData.title, existingGuides);

    // Extract YouTube video ID for thumbnail
    const videoIdMatch = guideData.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    const thumbnailUrl = videoIdMatch
      ? `https://i.ytimg.com/vi/${videoIdMatch[1]}/maxresdefault.jpg`
      : null;

    // Build new guide entry
    const newGuide = {
      id,
      sourceType: 'youtube',
      videoUrl: guideData.videoUrl,
      title: guideData.title,
      description: guideData.description,
      thumbnailUrl,
      submittedBy,
      submittedAt: new Date().toISOString(),
      featured: false
    };

    // Add optional fields
    if (guideData.creator) newGuide.creator = guideData.creator;
    if (guideData.category) newGuide.category = guideData.category;
    if (guideData.tags && Array.isArray(guideData.tags) && guideData.tags.length > 0) newGuide.tags = guideData.tags;
    if (guideData.difficulty) newGuide.difficulty = guideData.difficulty;

    // Add to guides array
    existingGuides.push(newGuide);
    videoGuidesData.videoGuides = existingGuides;

    // Serialize
    const updatedContent = JSON.stringify(videoGuidesData, null, 2);
    const updatedContentBase64 = Buffer.from(updatedContent).toString('base64');

    // Create branch
    const branchName = `video-guide-${id}-${Date.now()}`;
    const { data: mainRef } = await useOctokit.rest.git.getRef({
      owner,
      repo,
      ref: 'heads/main'
    });

    await useOctokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: mainRef.object.sha
    });

    // Commit file
    await useOctokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'public/data/video-guides.json',
      message: `Add video guide: ${guideData.title}`,
      content: updatedContentBase64,
      branch: branchName,
      sha: fileData.sha
    });

    // Create PR body
    const prBody = `## Video Guide Submission

**Title:** ${guideData.title}
**Video:** ${guideData.videoUrl}
**Description:** ${guideData.description}
${guideData.creator ? `**Creator:** ${guideData.creator}` : ''}
${guideData.category ? `**Category:** ${guideData.category}` : ''}
${guideData.difficulty ? `**Difficulty:** ${guideData.difficulty}` : ''}
${guideData.tags && guideData.tags.length > 0 ? `**Tags:** ${guideData.tags.join(', ')}` : ''}

---

Submitted by ${userToken ? `@${submittedBy}` : 'anonymous user'}

**For reviewers:** Please review the video content before merging to ensure it's appropriate and follows community guidelines.`;

    // Prepare labels
    const labels = ['video-guide'];

    // Add ref label for anonymous submissions (enables linking later)
    // GitHub labels max 50 chars: "ref:" (4) + hash (46) = 50
    if (!userToken && userEmail) {
      const { hashEmail } = await import('../utils.js');
      const fullHash = await hashEmail(userEmail);
      const { createEmailLabel } = await import('../../../wiki-framework/src/utils/githubLabelUtils.js');
      const LABEL_MAX_HASH_LENGTH = 46; // Max hash chars that fit in GitHub label (50 - len('ref:'))
      const refLabel = createEmailLabel(fullHash, LABEL_MAX_HASH_LENGTH);
      labels.push(refLabel);
      labels.push('linkable'); // Enable account linking for anonymous submissions
      logger.debug('Added ref label for anonymous submission', { refLabel });
    }

    // Create PR
    const { data: pr } = await useOctokit.rest.pulls.create({
      owner,
      repo,
      title: `[Video Guide] ${guideData.title}`,
      body: prBody,
      head: branchName,
      base: 'main'
    });

    // Add labels
    if (labels.length > 0) {
      await useOctokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: pr.number,
        labels
      });
    }

    logger.info('Video guide PR created successfully', {
      prNumber: pr.number,
      prUrl: pr.html_url,
      guideId: id,
      submittedBy
    });

    return adapter.createJsonResponse(200, {
      prNumber: pr.number,
      prUrl: pr.html_url,
      guideId: id
    });
  } catch (error) {
    logger.error('Failed to submit video guide', { error: error.message });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

// Helper: Generate unique guide ID (URL-safe slug)
function generateGuideId(title, existingGuides) {
  // Create base slug from title
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Ensure uniqueness
  let finalSlug = slug;
  let counter = 1;
  while (existingGuides.some(g => g.id === finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
}

/**
 * Delete video guide (admin only)
 * Creates a PR to remove guide from video-guides.json
 */
async function handleDeleteVideoGuide(adapter, octokit, { owner, repo, guideId, adminUsername, userToken }) {
  if (!owner || !repo || !guideId || !adminUsername || !userToken) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, guideId, adminUsername, userToken'
    });
  }

  // Verify admin permissions
  const userOctokit = new Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return adapter.createJsonResponse(403, { error: 'Only repository owner and admins can perform this action' });
    }
  } catch (error) {
    logger.error('Permission check failed', { error: error.message });
    return adapter.createJsonResponse(403, { error: 'Permission verification failed' });
  }

  try {
    // Fetch current video-guides.json from main branch
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: 'public/data/video-guides.json',
      ref: 'main'
    });

    // Decode and parse
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const videoGuidesData = JSON.parse(currentContent);
    const existingGuides = videoGuidesData.videoGuides || [];

    // Find guide to delete
    const guideIndex = existingGuides.findIndex(g => g.id === guideId);
    if (guideIndex === -1) {
      return adapter.createJsonResponse(404, { error: 'Video guide not found' });
    }

    const guideToDelete = existingGuides[guideIndex];

    // Remove from array
    existingGuides.splice(guideIndex, 1);
    videoGuidesData.videoGuides = existingGuides;

    // Serialize
    const updatedContent = JSON.stringify(videoGuidesData, null, 2);
    const updatedContentBase64 = Buffer.from(updatedContent).toString('base64');

    // Create branch
    const branchName = `delete-video-guide-${guideId}-${Date.now()}`;
    const { data: mainRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: 'heads/main'
    });

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: mainRef.object.sha
    });

    // Commit to branch
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'public/data/video-guides.json',
      message: `Delete video guide: ${guideToDelete.title}`,
      content: updatedContentBase64,
      branch: branchName,
      sha: fileData.sha
    });

    // Create PR
    const prTitle = `[Video Guide] Delete: ${guideToDelete.title}`;
    const prBody = `## Video Guide Deletion

**Title:** ${guideToDelete.title}
**Video:** ${guideToDelete.videoUrl}
**Guide ID:** ${guideToDelete.id}
**Originally Submitted By:** ${guideToDelete.submittedBy || 'Unknown'}

---

Deleted by @${adminUsername}

**For reviewers:** This PR removes the video guide from the database.`;

    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: prBody,
      head: branchName,
      base: 'main'
    });

    // Add labels to track this deletion PR
    const labels = ['delete-video-guide', `guide-id:${guideId}`];
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels
    });

    logger.info('Video guide deletion PR created', {
      prNumber: pr.number,
      prUrl: pr.html_url,
      guideId,
      adminUsername
    });

    return adapter.createJsonResponse(200, {
      message: 'Video guide deletion PR created successfully',
      prNumber: pr.number,
      prUrl: pr.html_url,
      guideId
    });
  } catch (error) {
    logger.error('Failed to delete video guide', { error: error.message, guideId });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Get pending video guide deletion PRs
 * Fetches open PRs with 'delete-video-guide' label
 * Required: owner, repo
 */
async function handleGetPendingVideoGuideDeletions(adapter, octokit, { owner, repo }) {
  if (!owner || !repo) {
    return adapter.createJsonResponse(400, { error: 'Missing required fields: owner, repo' });
  }

  try {
    // Fetch all open PRs with 'delete-video-guide' label
    const { data: prs } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'open',
      per_page: 100
    });

    // Filter PRs with delete-video-guide label and extract guide ID from labels
    const deletionPRs = prs
      .filter(pr => pr.labels.some(label => label.name === 'delete-video-guide'))
      .map(pr => {
        // Extract guide ID from guide-id: label
        const guideIdLabel = pr.labels.find(label => label.name.startsWith('guide-id:'));
        const guideId = guideIdLabel ? guideIdLabel.name.replace('guide-id:', '') : null;

        return {
          prNumber: pr.number,
          prUrl: pr.html_url,
          guideId,
          title: pr.title,
          createdAt: pr.created_at,
          createdBy: pr.user.login
        };
      })
      .filter(pr => pr.guideId); // Only return PRs with valid guide IDs

    logger.debug('Fetched pending video guide deletions', { count: deletionPRs.length });

    return adapter.createJsonResponse(200, {
      deletions: deletionPRs
    });
  } catch (error) {
    logger.error('Failed to fetch pending video guide deletions', { error: error.message });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Assign donator badge to a user
 * Required: owner, repo, username, userId, adminUsername, userToken
 * Optional: amount, transactionId, reason
 */
async function handleAssignDonatorBadge(adapter, octokit, { owner, repo, username, userId, adminUsername, userToken, amount, transactionId, reason }, botToken) {
  if (!owner || !repo || !username || !adminUsername || !userToken) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, username, adminUsername, userToken'
    });
  }

  // Verify admin permissions
  const userOctokit = new (await import('@octokit/rest')).Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return adapter.createJsonResponse(403, { error: 'Only repository owner and admins can assign donator badges' });
    }
  } catch (error) {
    logger.error('Permission check failed for donator badge assignment', { error: error.message });
    return adapter.createJsonResponse(403, { error: 'Permission verification failed' });
  }

  try {
    // If userId not provided, fetch it from GitHub
    let targetUserId = userId;
    if (!targetUserId) {
      try {
        const { data: targetUser } = await octokit.rest.users.getByUsername({ username });
        targetUserId = targetUser.id;
      } catch (error) {
        logger.error('Failed to fetch user ID', { username, error: error.message });
        return adapter.createJsonResponse(404, { error: `User not found: ${username}` });
      }
    }

    // Create donator status object
    const donatorStatus = {
      isDonator: true,
      donatedAt: new Date().toISOString(),
      badge: '💎',
      color: '#ffd700',
      assignedBy: `admin:${adminUsername}`,
    };

    // Add optional fields
    if (amount) donatorStatus.amount = amount;
    if (transactionId) donatorStatus.transactionId = transactionId;
    if (reason) donatorStatus.reason = reason;

    // Save donator status (pass bot token for serverless context)
    const { saveDonatorStatus } = await getDonatorRegistry();
    await saveDonatorStatus(owner, repo, username, targetUserId, donatorStatus, botToken);

    logger.info('Donator badge assigned via bot', { username, userId: targetUserId, assignedBy: adminUsername });

    return adapter.createJsonResponse(200, {
      success: true,
      message: `Donator badge assigned to ${username}`,
      donatorStatus
    });
  } catch (error) {
    logger.error('Failed to assign donator badge', { username, error: error.message });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Remove donator badge from a user
 * Required: owner, repo, username, adminUsername, userToken
 * Optional: userId, reason
 */
async function handleRemoveDonatorBadge(adapter, octokit, { owner, repo, username, userId, adminUsername, userToken, reason }, botToken) {
  if (!owner || !repo || !username || !adminUsername || !userToken) {
    return adapter.createJsonResponse(400, {
      error: 'Missing required fields: owner, repo, username, adminUsername, userToken'
    });
  }

  // Verify admin permissions
  const userOctokit = new (await import('@octokit/rest')).Octokit({
    auth: userToken,
    userAgent: 'GitHub-Wiki-Bot/1.0'
  });

  try {
    const { data: repoData } = await userOctokit.rest.repos.get({ owner, repo });
    const { data: userData } = await userOctokit.rest.users.getAuthenticated();

    const isOwner = repoData.owner.login === userData.login;
    const { data: permData } = await userOctokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: userData.login,
    });
    const hasAdminPerm = permData.permission === 'admin';

    if (!isOwner && !hasAdminPerm) {
      return adapter.createJsonResponse(403, { error: 'Only repository owner and admins can remove donator badges' });
    }
  } catch (error) {
    logger.error('Permission check failed for donator badge removal', { error: error.message });
    return adapter.createJsonResponse(403, { error: 'Permission verification failed' });
  }

  try {
    // If userId not provided, fetch it from GitHub
    let targetUserId = userId;
    if (!targetUserId) {
      try {
        const { data: targetUser } = await octokit.rest.users.getByUsername({ username });
        targetUserId = targetUser.id;
      } catch (error) {
        logger.warn('Failed to fetch user ID for removal, proceeding with username only', { username });
      }
    }

    // Remove donator status (pass bot token for serverless context)
    const { removeDonatorStatus } = await getDonatorRegistry();
    await removeDonatorStatus(owner, repo, username, targetUserId, botToken);

    logger.info('Donator badge removed via bot', { username, userId: targetUserId, removedBy: adminUsername, reason });

    return adapter.createJsonResponse(200, {
      success: true,
      message: `Donator badge removed from ${username}`
    });
  } catch (error) {
    logger.error('Failed to remove donator badge', { username, error: error.message });
    return adapter.createJsonResponse(500, { error: error.message });
  }
}

/**
 * Create user snapshot automatically (no authentication required)
 * Builds snapshot from scratch by fetching all user PRs and stats
 * Required: username
 * Optional: userId (informational only; the permanent ID is always resolved from
 *   GitHub so a caller can never point one user's snapshot at another's label)
 */
async function handleCreateUserSnapshot(adapter, octokit, body) {
  const { owner, repo, username, userId } = body;

  if (!username) {
    return adapter.createJsonResponse(400, { error: 'Missing required field: username' });
  }

  const SNAPSHOT_TITLE_PREFIX = '[User Snapshot]';
  const MAX_PRS_IN_SNAPSHOT = 100;
  const BOT_USERNAME = adapter.getEnv('WIKI_BOT_USERNAME') || adapter.getEnv('VITE_WIKI_BOT_USERNAME') || 'slayer-wiki-bot';

  try {
    logger.info('Creating user snapshot', { username, userId });

    // Skip bot account
    if (username === BOT_USERNAME) {
      logger.info('Skipping snapshot for bot account', { username });
      return adapter.createJsonResponse(200, {
        success: true,
        skipped: true,
        reason: 'Bot accounts do not get snapshots'
      });
    }

    // Resolve the permanent user ID first: snapshots are keyed by their user-id label
    const { data: userData } = await octokit.rest.users.getByUsername({
      username,
    });

    logger.info('Fetched user data', { username, userId: userData.id });

    // Check if snapshot already exists. Duplicates are merged into the oldest
    // issue; a legacy title-only snapshot is adopted and relabelled on update.
    const botLogin = getBotLogin(adapter);
    const userIdLabel = `user-id:${userData.id}`;
    const { issue: existingSnapshot } = await findUserSnapshotIssue(octokit, {
      owner,
      repo,
      userIdLabel,
      fallbackTitle: `${SNAPSHOT_TITLE_PREFIX} ${username}`,
      botLogin,
    });

    // If snapshot exists and is recent (< 1 hour), return it
    if (existingSnapshot) {
      try {
        const snapshotData = JSON.parse(existingSnapshot.body);
        const lastUpdated = new Date(snapshotData.lastUpdated);
        const ageInMinutes = (Date.now() - lastUpdated.getTime()) / 1000 / 60;

        if (ageInMinutes < 60) {
          logger.info('Recent snapshot already exists', { username, ageInMinutes: ageInMinutes.toFixed(1) });
          return adapter.createJsonResponse(200, {
            success: true,
            alreadyExists: true,
            snapshot: snapshotData,
            issueNumber: existingSnapshot.number,
            ageInMinutes: ageInMinutes.toFixed(1)
          });
        }
      } catch (err) {
        logger.warn('Failed to parse existing snapshot', { error: err.message });
      }
    }

    // Fetch all PRs by this user (direct PRs + linked anonymous edits)
    logger.info('Fetching pull requests', { username });
    const allPRs = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data: prs } = await octokit.rest.pulls.list({
        owner,
        repo,
        state: 'all',
        per_page: 100,
        page,
      });

      // Filter PRs by this user (direct PRs + linked anonymous edits)
      const userPRs = prs.filter(pr => {
        // Direct PR from user
        const isDirectPR = pr.user.login === username;

        // Linked anonymous PR (has user-id label)
        const isLinkedPR = pr.labels.some(label => {
          const labelName = typeof label === 'string' ? label : label.name;
          return labelName === `user-id:${userData.id}`;
        });

        return isDirectPR || isLinkedPR;
      });
      allPRs.push(...userPRs);

      hasMore = prs.length === 100;
      page++;
    }

    logger.info('Found pull requests', { username, count: allPRs.length });

    // Fetch detailed data for each PR
    logger.info('Fetching detailed PR data', { username });
    const detailedPRs = [];

    for (const pr of allPRs) {
      try {
        const { data: detailedPR } = await octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: pr.number,
        });

        // If stats are missing, fetch from commits
        if (!detailedPR.additions && !detailedPR.deletions) {
          try {
            const { data: commits } = await octokit.rest.pulls.listCommits({
              owner,
              repo,
              pull_number: pr.number,
              per_page: 100,
            });

            let totalAdditions = 0;
            let totalDeletions = 0;
            let totalFiles = 0;

            for (const commit of commits) {
              const { data: commitData } = await octokit.rest.repos.getCommit({
                owner,
                repo,
                ref: commit.sha,
              });

              totalAdditions += commitData.stats?.additions || 0;
              totalDeletions += commitData.stats?.deletions || 0;
              totalFiles += commitData.files?.length || 0;
            }

            detailedPR.additions = totalAdditions;
            detailedPR.deletions = totalDeletions;
            detailedPR.changed_files = totalFiles;
          } catch (commitError) {
            logger.warn('Failed to fetch commit stats', { prNumber: pr.number, error: commitError.message });
          }
        }

        detailedPRs.push(detailedPR);
      } catch (error) {
        logger.warn('Failed to fetch PR details', { prNumber: pr.number, error: error.message });
        detailedPRs.push(pr);
      }
    }

    logger.info('Fetched detailed PR data', { username, count: detailedPRs.length });

    // Calculate statistics (only count merged PRs for additions/deletions)
    const mergedPRs = detailedPRs.filter(pr => pr.merged_at || pr.state === 'merged');
    const stats = {
      totalPRs: detailedPRs.length,
      openPRs: detailedPRs.filter(pr => pr.state === 'open').length,
      mergedPRs: mergedPRs.length,
      closedPRs: detailedPRs.filter(pr => (pr.state === 'closed' || pr.state === 'merged') && !pr.merged_at).length,
      totalAdditions: mergedPRs.reduce((sum, pr) => sum + (pr.additions || 0), 0),
      totalDeletions: mergedPRs.reduce((sum, pr) => sum + (pr.deletions || 0), 0),
      totalFiles: mergedPRs.reduce((sum, pr) => sum + (pr.changed_files || 0), 0),
      mostRecentEdit: detailedPRs.length > 0
        ? new Date(Math.max(...detailedPRs.map(pr => new Date(pr.created_at).getTime()))).toISOString()
        : null,
    };

    // Build pull requests list (limit to most recent PRs)
    const recentPRs = detailedPRs
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, MAX_PRS_IN_SNAPSHOT);

    const pullRequests = recentPRs.map(pr => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      merged_at: pr.merged_at,
      closed_at: pr.closed_at,
      additions: pr.additions,
      deletions: pr.deletions,
      changed_files: pr.changed_files,
      html_url: pr.html_url,
      user: {
        login: pr.user.login,
        id: pr.user.id,
        avatar_url: pr.user.avatar_url,
        html_url: pr.user.html_url,
      },
      labels: pr.labels.map(label => ({
        name: typeof label === 'string' ? label : label.name,
        color: typeof label === 'object' ? label.color : undefined,
      })),
    }));

    // Build snapshot object
    const snapshot = {
      userId: userData.id,
      username: userData.login,
      lastUpdated: new Date().toISOString(),
      stats,
      pullRequests,
      pullRequestsCount: detailedPRs.length,
      pullRequestsStored: recentPRs.length,
      pullRequestsTruncated: detailedPRs.length > MAX_PRS_IN_SNAPSHOT,
      user: {
        id: userData.id,
        login: userData.login,
        name: userData.name,
        avatar_url: userData.avatar_url,
        bio: userData.bio,
      },
    };

    logger.info('Built snapshot', {
      username,
      totalPRs: stats.totalPRs,
      mergedPRs: stats.mergedPRs,
      additions: stats.totalAdditions,
      deletions: stats.totalDeletions
    });

    // Save snapshot to issue
    const issueTitle = `${SNAPSHOT_TITLE_PREFIX} ${username}`;
    const issueBody = JSON.stringify(snapshot, null, 2);

    let issue;
    let createdSnapshot = false;

    if (existingSnapshot) {
      // Update existing snapshot
      const { data: updatedIssue } = await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: existingSnapshot.number,
        title: issueTitle,
        body: issueBody,
      });

      // Add user ID label if missing
      try {
        await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: existingSnapshot.number,
          labels: [userIdLabel],
        });
      } catch (err) {
        logger.warn('Failed to add user-id label', { error: err.message });
      }

      issue = updatedIssue;
      logger.info('Updated user snapshot', { username, issueNumber: existingSnapshot.number });
    } else {
      // Create the snapshot only once its absence is confirmed. If a concurrent
      // run created one first, this fresher snapshot replaces its body instead.
      const { issue: canonical, created } = await getOrCreateIssue(octokit, {
        owner,
        repo,
        labels: [USER_SNAPSHOT_LABEL, userIdLabel],
        createLabels: [USER_SNAPSHOT_LABEL, userIdLabel, AUTOMATED_LABEL],
        selectorLabel: userIdLabel,
        title: issueTitle,
        body: issueBody,
        lock: true,
        lockReason: RECORD_LOCK_REASON,
        merge: createSnapshotMerge(octokit, owner, repo),
        botLogin,
        logger: lookupLogger,
      });

      if (!created) {
        await octokit.rest.issues.update({
          owner,
          repo,
          issue_number: canonical.number,
          title: issueTitle,
          body: issueBody,
        });
      }

      issue = canonical;
      createdSnapshot = created;
      logger.info(created ? 'Created user snapshot' : 'Updated user snapshot created concurrently', {
        username,
        issueNumber: canonical.number,
      });
    }

    return adapter.createJsonResponse(200, {
      success: true,
      created: createdSnapshot,
      updated: !createdSnapshot,
      snapshot,
      issueNumber: issue.number,
      issueUrl: issue.html_url
    });

  } catch (error) {
    if (isAbsenceUnconfirmed(error)) return absenceUnconfirmedResponse(adapter, error);
    logger.error('Failed to create user snapshot', { username, error: error.message, stack: error.stack });
    return adapter.createJsonResponse(500, { error: error.message || 'Failed to create user snapshot' });
  }
}

