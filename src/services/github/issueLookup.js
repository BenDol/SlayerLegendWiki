/**
 * Issue Lookup
 *
 * The one way this project finds GitHub issues that act as database records
 * (singleton indexes such as "[Content Creator Index]", per-user records such
 * as "[Achievements] <user>", per-entity records such as soul weapon grids).
 *
 * Why this module exists
 * ----------------------
 * Measured on 2026-09-09 against BenDol/SlayerLegendWiki with the bot token,
 * 25 calls each, while FOUR open issues carried the `content-creator-index`
 * label:
 *
 *   REST    GET /repos/{o}/{r}/issues?labels=...     12-32 % of calls returned []
 *   REST    GET /search/issues?q=label:...            35 % returned total_count 0
 *   GraphQL repository.issues(labels: [...])           0 % (consistent, 25/25)
 *   REST    GET /repos/{o}/{r}/issues/{number}         0 % (consistent, 25/25)
 *
 * The REST list endpoint is served from an eventually consistent index (its
 * Link header now carries an `after=` cursor), so an empty list is NOT
 * evidence that nothing exists. Every caller that created a record when the
 * list came back empty produced duplicates: 13 "[Content Creator Index]"
 * issues, paired "[Achievements]" issues created seconds apart.
 *
 * Rules encoded here
 * ------------------
 * 1. Read through GraphQL, filtered server-side by the MOST SELECTIVE label
 *    (`user-id:...`, `page:...`, ...), then match the full label set locally.
 *    GraphQL's `labels` argument is OR-semantics, so the selector keeps the
 *    result set tiny (a user's handful of records) instead of scanning a type.
 * 2. Absence must be confirmed by a second, independent backend (the REST
 *    list) before anyone may create. If the backends disagree or one is down,
 *    absence is "unconfirmed" and creation is refused rather than risked.
 * 3. When duplicates exist, the LOWEST issue number is canonical. Every
 *    caller, on every platform, therefore agrees on the same record.
 * 4. Reads never create. Only `getOrCreateIssue` creates, and it reconciles
 *    duplicates afterwards (merging through a caller-supplied strategy, then
 *    closing) so a lost race heals itself.
 *
 * This file has no imports on purpose: it is shared by the browser bundle,
 * the Cloudflare/Netlify functions and the GitHub Actions workflows.
 */

/** GitHub's maximum page size for issue listings. */
export const ISSUE_PAGE_SIZE = 100;

/** GitHub allows at most this many labels on one issue, so one page always holds them all. */
export const LABELS_PER_ISSUE = 100;

/** Hard ceiling on pages walked per lookup (1,000 issues carrying the selector label). */
export const ISSUE_MAX_PAGES = 10;

/** Consecutive empty REST lists required to call a record absent when GraphQL is unavailable. */
export const ABSENCE_CONFIRMATION_ATTEMPTS = 3;

/** Pause between those REST attempts, so they hit different index replicas. */
export const ABSENCE_RETRY_DELAY_MS = 300;

/** `state_reason` used when closing a duplicate record. */
export const DUPLICATE_CLOSE_REASON = 'not_planned';

/** Error code raised when a caller asks to create but absence could not be confirmed. */
export const ABSENCE_UNCONFIRMED = 'ABSENCE_UNCONFIRMED';

/** Error code raised for bad arguments. */
export const INVALID_ARGUMENTS = 'INVALID_ARGUMENTS';

/** Which backend produced a lookup result. */
export const LOOKUP_SOURCE = Object.freeze({
  GRAPHQL: 'graphql',
  REST: 'rest',
  NONE: 'none',
});

/**
 * Label families ordered by selectivity. Identity labels pin a single
 * record (a user, a page, an entity); type labels group a whole feature;
 * partition labels span everything.
 */
const IDENTITY_LABEL_PREFIXES = Object.freeze([
  'user-id:',
  'page:',
  'weapon-id:',
  'guide-id:',
  'ref:',
  'email:',
  'name:',
]);
const PARTITION_LABEL_PREFIXES = Object.freeze(['data-version:', 'branch:']);
const PARTITION_LABELS = Object.freeze(['automated']);

const SELECTIVITY = Object.freeze({ IDENTITY: 0, TYPE: 1, PARTITION: 2 });

const GRAPHQL_STATES = Object.freeze({
  open: ['OPEN'],
  closed: ['CLOSED'],
  all: ['OPEN', 'CLOSED'],
});

const ISSUES_BY_LABEL_QUERY = `
query IssuesByLabel($owner: String!, $repo: String!, $labels: [String!]!, $states: [IssueState!]!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    issues(labels: $labels, states: $states, first: $first, after: $after, orderBy: { field: CREATED_AT, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        databaseId
        number
        title
        body
        state
        stateReason
        locked
        url
        createdAt
        updatedAt
        closedAt
        author { login }
        labels(first: ${LABELS_PER_ISSUE}) { nodes { name color } }
        comments { totalCount }
      }
    }
  }
}`;

const NOOP_LOGGER = Object.freeze({
  debug() {},
  info() {},
  warn() {},
  error() {},
});

/**
 * Error raised by this module. `code` is one of ABSENCE_UNCONFIRMED,
 * INVALID_ARGUMENTS or LOOKUP_FAILED.
 */
export class IssueLookupError extends Error {
  constructor(message, { code = 'LOOKUP_FAILED', cause } = {}) {
    super(message);
    this.name = 'IssueLookupError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

const sleep = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

/**
 * Normalise labels given as an array, a comma-separated string, or REST label
 * objects into a de-duplicated array of trimmed names.
 * @param {string|Array<string|{name:string}>} labels
 * @returns {string[]}
 */
export function normalizeLabels(labels) {
  const list = Array.isArray(labels) ? labels : String(labels ?? '').split(',');
  const names = list
    .map((label) => (typeof label === 'string' ? label : label?.name ?? ''))
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Set(names)];
}

/**
 * Label names carried by an issue (REST or GraphQL-mapped shape).
 * @param {Object} issue
 * @returns {string[]}
 */
export function labelNamesOf(issue) {
  return normalizeLabels(issue?.labels ?? []);
}

/**
 * True when the issue carries every label in `labels` (case-insensitive,
 * as GitHub label names are).
 * @param {Object} issue
 * @param {string|string[]} labels
 * @returns {boolean}
 */
export function issueHasLabels(issue, labels) {
  const carried = new Set(labelNamesOf(issue).map((name) => name.toLowerCase()));
  return normalizeLabels(labels).every((name) => carried.has(name.toLowerCase()));
}

/**
 * The REST issues list also returns pull requests; records are never PRs.
 * @param {Object} issue
 * @returns {boolean}
 */
export function isPullRequest(issue) {
  return Boolean(issue?.pull_request);
}

function selectivityOf(label) {
  const lower = label.toLowerCase();
  if (IDENTITY_LABEL_PREFIXES.some((prefix) => lower.startsWith(prefix))) return SELECTIVITY.IDENTITY;
  if (PARTITION_LABELS.includes(lower) || PARTITION_LABEL_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return SELECTIVITY.PARTITION;
  }
  return SELECTIVITY.TYPE;
}

/**
 * Choose the label used to filter server-side. GraphQL's `labels` argument is
 * OR-semantics, so exactly one label is sent and the rest are matched locally;
 * the most selective label keeps the fetched set small.
 * @param {string|string[]} labels - Every label the record must carry
 * @param {string} [preferred] - Caller override; must be one of `labels`
 * @returns {string}
 */
export function pickSelectorLabel(labels, preferred) {
  const names = normalizeLabels(labels);
  if (names.length === 0) {
    throw new IssueLookupError('At least one label is required to look up issues', { code: INVALID_ARGUMENTS });
  }
  if (preferred) {
    const match = names.find((name) => name.toLowerCase() === String(preferred).trim().toLowerCase());
    if (!match) {
      throw new IssueLookupError(`Selector label "${preferred}" is not one of the required labels`, {
        code: INVALID_ARGUMENTS,
      });
    }
    return match;
  }
  // Stable sort: ties keep the caller's order.
  return names
    .map((name, index) => ({ name, index, rank: selectivityOf(name) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)[0].name;
}

/**
 * Map a lookup state ('open' | 'closed' | 'all') to GraphQL IssueState values.
 * @param {string} [state='open']
 * @returns {string[]}
 */
export function toIssueStates(state = 'open') {
  const states = GRAPHQL_STATES[String(state).toLowerCase()];
  if (!states) {
    throw new IssueLookupError(`Unsupported issue state "${state}" (expected open, closed or all)`, {
      code: INVALID_ARGUMENTS,
    });
  }
  return states;
}

/**
 * Convert a GraphQL issue node into the subset of the REST issue shape that
 * callers in this project read, so both backends are interchangeable.
 * @param {Object} node
 * @returns {Object}
 */
export function issueFromGraphQlNode(node) {
  return {
    id: node.databaseId ?? null,
    node_id: node.id,
    number: node.number,
    title: node.title ?? '',
    body: node.body ?? '',
    state: String(node.state ?? 'OPEN').toLowerCase(),
    state_reason: node.stateReason ? String(node.stateReason).toLowerCase() : null,
    locked: Boolean(node.locked),
    html_url: node.url,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
    closed_at: node.closedAt ?? null,
    user: { login: node.author?.login ?? null },
    labels: (node.labels?.nodes ?? []).map((label) => ({ name: label.name, color: label.color ?? null })),
    comments: node.comments?.totalCount ?? 0,
  };
}

/**
 * Compare GitHub logins the way both backends report them: REST says
 * `github-actions[bot]`, GraphQL says `github-actions`. Case-insensitive.
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {boolean}
 */
export function sameLogin(a, b) {
  const normalize = (login) => String(login ?? '').replace(/\[bot\]$/i, '').trim().toLowerCase();
  const left = normalize(a);
  return Boolean(left) && left === normalize(b);
}

/**
 * Sort issues by number ascending (oldest first). Returns a new array.
 * @param {Object[]} issues
 * @returns {Object[]}
 */
export function sortByNumber(issues) {
  return [...issues].sort((a, b) => a.number - b.number);
}

function dedupeByNumber(issues) {
  const seen = new Map();
  for (const issue of issues) {
    if (issue && !seen.has(issue.number)) seen.set(issue.number, issue);
  }
  return [...seen.values()];
}

function titleMatches(issue, title) {
  if (title === null || title === undefined) return true;
  if (typeof title === 'function') return Boolean(title(issue.title ?? ''));
  return (issue.title ?? '').trim() === String(title).trim();
}

function matchesFilters(issue, { labels, title, state }) {
  if (isPullRequest(issue)) return false;
  if (state !== 'all' && String(issue.state ?? '').toLowerCase() !== state) return false;
  if (!issueHasLabels(issue, labels)) return false;
  return titleMatches(issue, title);
}

function requireArguments(octokit, owner, repo) {
  if (!octokit || !owner || !repo) {
    throw new IssueLookupError('octokit, owner and repo are required', { code: INVALID_ARGUMENTS });
  }
}

/**
 * Walk the GraphQL issues connection for one selector label.
 * @private
 */
async function listIssuesViaGraphQl(octokit, { owner, repo, selectorLabel, state, maxPages }) {
  const issues = [];
  let after = null;

  for (let page = 0; page < maxPages; page++) {
    const data = await octokit.graphql(ISSUES_BY_LABEL_QUERY, {
      owner,
      repo,
      labels: [selectorLabel],
      states: toIssueStates(state),
      first: ISSUE_PAGE_SIZE,
      after,
    });

    const connection = data?.repository?.issues;
    if (!connection) {
      throw new IssueLookupError('GraphQL response did not include repository.issues');
    }

    issues.push(...(connection.nodes ?? []).map(issueFromGraphQlNode));

    if (!connection.pageInfo?.hasNextPage) {
      return { issues, truncated: false };
    }
    after = connection.pageInfo.endCursor;
  }

  return { issues, truncated: true };
}

/**
 * Walk the REST issues list (server-side AND filter on all labels).
 * @private
 */
async function listIssuesViaRest(octokit, { owner, repo, labels, state, maxPages }) {
  const issues = [];

  for (let page = 1; page <= maxPages; page++) {
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: labels.join(','),
      state,
      per_page: ISSUE_PAGE_SIZE,
      page,
      sort: 'created',
      direction: 'asc',
    });

    issues.push(...data);

    if (data.length < ISSUE_PAGE_SIZE) {
      return { issues, truncated: false };
    }
  }

  return { issues, truncated: true };
}

/**
 * Find every issue carrying all of `labels` (and optionally an exact title).
 *
 * GraphQL is consulted first. If it returns nothing, the REST list is used as
 * an independent cross-check. If GraphQL is unavailable, the REST list must
 * come back empty ABSENCE_CONFIRMATION_ATTEMPTS times in a row before the
 * record is called absent. `confirmedAbsent` is only true when the backends
 * agreed and neither result was truncated by `maxPages`.
 *
 * Reads that never create should pass `confirmAbsence: false`: a miss then
 * costs at most one REST attempt and no sleeps, and `confirmedAbsent` is only
 * reported when GraphQL itself answered.
 *
 * @param {Object} octokit - Octokit instance (REST required; GraphQL used when present)
 * @param {Object} options
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string|string[]} options.labels - Every label the record must carry
 * @param {string|Function|null} [options.title] - Exact title, or predicate on the title
 * @param {string} [options.state='open'] - 'open' | 'closed' | 'all'
 * @param {string} [options.selectorLabel] - Label to filter by server-side (default: most selective)
 * @param {boolean} [options.confirmAbsence=true] - Run the full absence protocol when GraphQL is unavailable
 * @param {number} [options.maxPages=ISSUE_MAX_PAGES]
 * @param {number} [options.retryDelayMs=ABSENCE_RETRY_DELAY_MS]
 * @param {Object} [options.logger] - Object with debug/info/warn/error
 * @returns {Promise<{issues: Object[], confirmedAbsent: boolean, degraded: boolean, source: string, attempts: Object[]}>}
 *   `issues` is sorted by number ascending; `degraded` is true when GraphQL was available but failed
 */
export async function findIssues(octokit, options = {}) {
  const {
    owner,
    repo,
    title = null,
    confirmAbsence = true,
    maxPages = ISSUE_MAX_PAGES,
    retryDelayMs = ABSENCE_RETRY_DELAY_MS,
    logger = NOOP_LOGGER,
  } = options;
  requireArguments(octokit, owner, repo);

  const state = String(options.state ?? 'open').toLowerCase();
  toIssueStates(state); // validates
  const labels = normalizeLabels(options.labels);
  const selectorLabel = pickSelectorLabel(labels, options.selectorLabel);
  const filters = { labels, title, state };
  const context = { owner, repo, labels, selectorLabel, state };
  const attempts = [];
  const graphqlAvailable = typeof octokit.graphql === 'function';

  let graphqlAnswered = false;
  let graphqlTruncated = false;
  const degraded = () => graphqlAvailable && !graphqlAnswered;

  if (graphqlAvailable) {
    try {
      const { issues, truncated } = await listIssuesViaGraphQl(octokit, { owner, repo, selectorLabel, state, maxPages });
      graphqlAnswered = true;
      graphqlTruncated = truncated;
      attempts.push({ source: LOOKUP_SOURCE.GRAPHQL, fetched: issues.length, truncated });

      const matched = sortByNumber(issues.filter((issue) => matchesFilters(issue, filters)));
      if (matched.length > 0) {
        return { issues: matched, confirmedAbsent: false, degraded: false, source: LOOKUP_SOURCE.GRAPHQL, attempts };
      }
      if (truncated) {
        logger.warn('GraphQL lookup hit the page ceiling without a match; absence cannot be confirmed', {
          ...context,
          maxPages,
        });
      }
    } catch (error) {
      attempts.push({ source: LOOKUP_SOURCE.GRAPHQL, error: error.message });
      logger.warn('GraphQL lookup failed; falling back to REST', { ...context, error: error.message });
    }
  }

  // With a GraphQL answer the REST list is a single cross-check; without one
  // it is the only source and must agree with itself several times before a
  // record may be called absent. Callers that never create skip that protocol.
  const requiredEmptyRuns = graphqlAnswered || !confirmAbsence ? 1 : ABSENCE_CONFIRMATION_ATTEMPTS;
  let emptyRuns = 0;
  let restTruncated = false;

  for (let attempt = 1; attempt <= requiredEmptyRuns; attempt++) {
    if (attempt > 1) await sleep(retryDelayMs);

    let listed;
    try {
      listed = await listIssuesViaRest(octokit, { owner, repo, labels, state, maxPages });
    } catch (error) {
      attempts.push({ source: LOOKUP_SOURCE.REST, error: error.message });
      if (!graphqlAnswered) {
        throw new IssueLookupError(`Issue lookup failed on every backend: ${error.message}`, { cause: error });
      }
      logger.warn('REST cross-check failed; absence cannot be confirmed', { ...context, error: error.message });
      return { issues: [], confirmedAbsent: false, degraded: degraded(), source: LOOKUP_SOURCE.NONE, attempts };
    }

    restTruncated = restTruncated || listed.truncated;
    attempts.push({ source: LOOKUP_SOURCE.REST, fetched: listed.issues.length, truncated: listed.truncated });

    const matched = sortByNumber(listed.issues.filter((issue) => matchesFilters(issue, filters)));
    if (matched.length > 0) {
      if (graphqlAnswered) {
        logger.warn('GraphQL returned no match but the REST list did; using the REST result', {
          ...context,
          numbers: matched.map((issue) => issue.number),
        });
      }
      return { issues: matched, confirmedAbsent: false, degraded: degraded(), source: LOOKUP_SOURCE.REST, attempts };
    }
    emptyRuns++;
  }

  // A single unconfirmed REST miss (GraphQL silent, protocol skipped) never counts as absence.
  const protocolComplete = graphqlAnswered || confirmAbsence;
  const confirmedAbsent = protocolComplete && emptyRuns === requiredEmptyRuns && !graphqlTruncated && !restTruncated;
  logger.debug('No matching issue found', { ...context, confirmedAbsent, attempts });
  return { issues: [], confirmedAbsent, degraded: degraded(), source: LOOKUP_SOURCE.NONE, attempts };
}

/**
 * Like `findIssues`, but splits the result into the canonical record (lowest
 * issue number) and any duplicates.
 * @param {Object} octokit
 * @param {Object} options - See `findIssues`
 * @returns {Promise<{issue: Object|null, duplicates: Object[], confirmedAbsent: boolean, source: string, attempts: Object[]}>}
 */
export async function findCanonicalIssue(octokit, options) {
  const result = await findIssues(octokit, options);
  const [issue = null, ...duplicates] = result.issues;
  return {
    issue,
    duplicates,
    confirmedAbsent: result.confirmedAbsent,
    degraded: result.degraded,
    source: result.source,
    attempts: result.attempts,
  };
}

/**
 * Direct read by issue number (strongly consistent). Returns null on 404.
 * @param {Object} octokit
 * @param {{owner: string, repo: string, number: number}} params
 * @returns {Promise<Object|null>}
 */
export async function getIssue(octokit, { owner, repo, number }) {
  requireArguments(octokit, owner, repo);
  try {
    const { data } = await octokit.rest.issues.get({ owner, repo, issue_number: number });
    return data;
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

/**
 * Close a duplicate record, leaving a pointer to the canonical one.
 * @param {Object} octokit
 * @param {Object} params
 * @param {string} params.owner
 * @param {string} params.repo
 * @param {Object} params.duplicate - Issue to close
 * @param {Object} params.canonical - Issue that survives
 * @param {Object} [params.logger]
 */
export async function closeDuplicateIssue(octokit, { owner, repo, duplicate, canonical, logger = NOOP_LOGGER }) {
  requireArguments(octokit, owner, repo);
  try {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: duplicate.number,
      body: `Duplicate of #${canonical.number}. Closed automatically by the wiki bot.`,
    });
  } catch (error) {
    logger.warn('Could not leave a pointer comment on the duplicate before closing it', {
      duplicate: duplicate.number,
      canonical: canonical.number,
      error: error.message,
    });
  }

  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: duplicate.number,
    state: 'closed',
    state_reason: DUPLICATE_CLOSE_REASON,
  });
  logger.info('Closed duplicate issue', { duplicate: duplicate.number, canonical: canonical.number });
}

/**
 * Fold duplicate records into the canonical one and close them.
 *
 * A duplicate is closed only when the caller supplied a way to preserve its
 * data: `merge(canonical, duplicate)` folds it into the canonical record, or
 * `isEmpty(duplicate)` vouches that there is nothing to preserve. Without
 * either, or when a step fails, the duplicate is left open and reported.
 *
 * Closing is fail-closed on authorship: `botLogin` names the account that
 * owns these records and only its issues are ever closed. Without it nothing
 * is closed, so a missing environment variable can never turn a human's issue
 * into collateral.
 *
 * @param {Object} octokit
 * @param {Object} params
 * @param {string} params.owner
 * @param {string} params.repo
 * @param {Object} params.canonical
 * @param {Object[]} params.duplicates
 * @param {Function} [params.merge] - async (canonical, duplicate) => void
 * @param {Function} [params.isEmpty] - (duplicate) => boolean
 * @param {string} params.botLogin - Login that owns the records (the `[bot]` suffix is ignored); required to close
 * @param {Object} [params.logger]
 * @returns {Promise<{closed: number[], kept: number[]}>}
 */
export async function reconcileDuplicates(octokit, {
  owner,
  repo,
  canonical,
  duplicates,
  merge,
  isEmpty,
  botLogin,
  logger = NOOP_LOGGER,
}) {
  requireArguments(octokit, owner, repo);
  const closed = [];
  const kept = [];
  const candidates = (duplicates ?? []).filter((duplicate) => duplicate && duplicate.number !== canonical.number);

  if (candidates.length === 0) {
    return { closed, kept };
  }

  if (!botLogin) {
    logger.error('Duplicate issues found but no owner login was supplied; leaving them open', {
      canonical: canonical.number,
      duplicates: candidates.map((duplicate) => duplicate.number),
    });
    return { closed, kept: candidates.map((duplicate) => duplicate.number) };
  }

  for (const duplicate of candidates) {
    const detail = { duplicate: duplicate.number, canonical: canonical.number, title: duplicate.title };

    if (!sameLogin(duplicate.user?.login, botLogin)) {
      kept.push(duplicate.number);
      logger.warn('Duplicate issue was not created by the bot; left open for manual review', {
        ...detail,
        author: duplicate.user?.login,
      });
      continue;
    }

    try {
      if (typeof merge === 'function') {
        await merge(canonical, duplicate);
      } else if (typeof isEmpty !== 'function' || !isEmpty(duplicate)) {
        kept.push(duplicate.number);
        logger.error('Duplicate issue may hold data and no merge strategy was given; left open for manual review', detail);
        continue;
      }

      await closeDuplicateIssue(octokit, { owner, repo, duplicate, canonical, logger });
      closed.push(duplicate.number);
    } catch (error) {
      kept.push(duplicate.number);
      logger.error('Failed to reconcile duplicate issue; left open', { ...detail, error });
    }
  }

  return { closed, kept };
}

/**
 * Return the canonical record, creating it only when its absence has been
 * confirmed by both backends. After creating, the lookup is repeated so a
 * concurrent creator that won the race becomes canonical and the newer issue
 * is reconciled away.
 *
 * @param {Object} octokit
 * @param {Object} options
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string|string[]} options.labels - Labels the record must carry
 * @param {string} options.title - Title for a newly created issue
 * @param {string} options.body - Body for a newly created issue
 * @param {string|Function|null} [options.matchTitle] - Also require this title when looking up
 * @param {string|string[]} [options.createLabels] - Labels applied on creation (default: `labels`)
 * @param {string} [options.selectorLabel] - See `findIssues`
 * @param {boolean} [options.lock=false] - Lock the issue after creating it
 * @param {string} [options.lockReason='off-topic']
 * @param {boolean} [options.reconcile=true] - Merge and close duplicates; pass false from code that must never write to other issues
 * @param {Object|null} [options.precomputed] - A `findCanonicalIssue` result (computed with absence confirmation) to reuse instead of looking up again
 * @param {Function} [options.merge] - See `reconcileDuplicates`
 * @param {Function} [options.isEmpty] - See `reconcileDuplicates`
 * @param {string} [options.botLogin] - See `reconcileDuplicates`
 * @param {number} [options.maxPages]
 * @param {number} [options.retryDelayMs]
 * @param {Object} [options.logger]
 * @returns {Promise<{issue: Object, created: boolean, createdNumber: number|null, duplicates: Object[], reconciled: {closed: number[], kept: number[]}}>}
 * @throws {IssueLookupError} with code ABSENCE_UNCONFIRMED when creation would be a gamble
 */
export async function getOrCreateIssue(octokit, options = {}) {
  const {
    owner,
    repo,
    title,
    body,
    matchTitle = null,
    lock = false,
    lockReason = 'off-topic',
    reconcile = true,
    precomputed = null,
    merge,
    isEmpty,
    botLogin,
    logger = NOOP_LOGGER,
  } = options;
  requireArguments(octokit, owner, repo);
  if (!title) {
    throw new IssueLookupError('A title is required to create an issue', { code: INVALID_ARGUMENTS });
  }

  const labels = normalizeLabels(options.labels);
  const createLabels = normalizeLabels(options.createLabels ?? labels);
  const lookup = {
    owner,
    repo,
    labels,
    title: matchTitle,
    state: 'open',
    logger,
    ...(options.selectorLabel ? { selectorLabel: options.selectorLabel } : {}),
    ...(options.maxPages ? { maxPages: options.maxPages } : {}),
    ...(options.retryDelayMs !== undefined ? { retryDelayMs: options.retryDelayMs } : {}),
  };
  const reconcileWith = (canonical, duplicates) =>
    reconcile && duplicates.length > 0
      ? reconcileDuplicates(octokit, { owner, repo, canonical, duplicates, merge, isEmpty, botLogin, logger })
      : Promise.resolve({ closed: [], kept: [] });

  const found = precomputed ?? (await findCanonicalIssue(octokit, lookup));
  if (found.issue) {
    const reconciled = await reconcileWith(found.issue, found.duplicates);
    return { issue: found.issue, created: false, createdNumber: null, duplicates: found.duplicates, reconciled };
  }

  if (!found.confirmedAbsent) {
    throw new IssueLookupError(
      `Refusing to create "${title}": could not confirm that no open issue with labels [${labels.join(', ')}] exists`,
      { code: ABSENCE_UNCONFIRMED }
    );
  }

  const { data: created } = await octokit.rest.issues.create({ owner, repo, title, body, labels: createLabels });
  logger.info('Created issue', { number: created.number, title, labels: createLabels });

  if (lock) {
    try {
      await octokit.rest.issues.lock({ owner, repo, issue_number: created.number, lock_reason: lockReason });
    } catch (error) {
      logger.warn('Failed to lock newly created issue', { number: created.number, error: error.message });
    }
  }

  // A concurrent request may have created the same record a moment earlier.
  let after = { issue: null, duplicates: [] };
  try {
    after = await findCanonicalIssue(octokit, lookup);
  } catch (error) {
    logger.warn('Post-create lookup failed; duplicates (if any) will be reconciled on the next lookup', {
      number: created.number,
      error: error.message,
    });
  }

  const all = sortByNumber(dedupeByNumber([created, after.issue, ...after.duplicates]));
  const [canonical, ...duplicates] = all;
  const reconciled = await reconcileWith(canonical, duplicates);

  return {
    issue: canonical,
    created: canonical.number === created.number,
    createdNumber: created.number,
    duplicates,
    reconciled,
  };
}

/**
 * Find a per-user or per-entity record.
 *
 * With an identity label (`user-id:...`, `weapon-id:...`) the lookup is pinned to
 * that label and stays proportional to that identity's handful of records.
 * When that misses and a `fallbackTitle` is known, the record is also matched
 * by exact title under the type labels: legacy records predate identity labels
 * and are only recognisable that way. Such a hit is reported with
 * `legacy: true` so the caller can add the identity label and make the next
 * lookup direct again. The title walk covers every record of the type, so it
 * only ever runs on a miss.
 *
 * @param {Object} octokit
 * @param {Object} options
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string|string[]} options.labels - Type labels the record carries
 * @param {string|null} [options.identityLabel] - Identity label, when known
 * @param {string|Function|null} [options.fallbackTitle] - Exact title (or predicate) that also identifies the record
 * @param {boolean} [options.confirmAbsence] - See `findIssues`
 * @param {Object} [options.logger]
 * @returns {Promise<{issue: Object|null, duplicates: Object[], legacy: boolean, confirmedAbsent: boolean, degraded: boolean, source: string, attempts: Object[]}>}
 */
export async function findRecordIssue(octokit, options = {}) {
  const { identityLabel = null, fallbackTitle = null, labels, ...rest } = options;
  const typeLabels = normalizeLabels(labels);
  const hasFallback = fallbackTitle !== null && fallbackTitle !== undefined;

  if (!identityLabel && !hasFallback) {
    throw new IssueLookupError('Either identityLabel or fallbackTitle is required to find a record', {
      code: INVALID_ARGUMENTS,
    });
  }

  let byIdentity = null;
  if (identityLabel) {
    byIdentity = await findCanonicalIssue(octokit, {
      ...rest,
      labels: [...typeLabels, identityLabel],
      selectorLabel: identityLabel,
    });
    if (byIdentity.issue || !hasFallback) {
      return { ...byIdentity, legacy: false };
    }
  }

  const byTitle = await findCanonicalIssue(octokit, { ...rest, labels: typeLabels, title: fallbackTitle });
  return {
    ...byTitle,
    legacy: Boolean(byTitle.issue) && Boolean(identityLabel),
    confirmedAbsent: byTitle.confirmedAbsent && (byIdentity ? byIdentity.confirmedAbsent : true),
    degraded: byTitle.degraded || Boolean(byIdentity?.degraded),
    attempts: [...(byIdentity?.attempts ?? []), ...byTitle.attempts],
  };
}

/**
 * Parse an issue body that should hold a JSON array. An empty body is an
 * empty array; anything that is not an array yields null.
 * @param {string} text
 * @returns {Array|null}
 */
export function parseJsonArray(text) {
  if (!text || !String(text).trim()) return [];
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function timestampOf(item, field) {
  const value = item?.[field];
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Of two copies of the same item, the one the user wrote most recently wins.
 * Without comparable timestamps the duplicate's copy wins: before this module
 * existed the newest issue was the one being written to, so its copy is the
 * more recent edit.
 * @private
 */
function newerItem(baseItem, extraItem) {
  for (const field of ['updatedAt', 'createdAt']) {
    const left = timestampOf(baseItem, field);
    const right = timestampOf(extraItem, field);
    if (left !== null && right !== null && left !== right) {
      return left > right ? baseItem : extraItem;
    }
  }
  return extraItem;
}

/**
 * Build a `merge` strategy (see `reconcileDuplicates`) for records whose body
 * is a JSON array of items keyed by `key`. Items the canonical record lacks
 * are appended; for items present in both, the more recently edited copy
 * replaces the canonical one in place. Items without a key are always kept.
 *
 * @param {Object} octokit
 * @param {Object} params
 * @param {string} params.owner
 * @param {string} params.repo
 * @param {string} [params.key='id']
 * @param {Object} [params.logger]
 * @returns {Function} async (canonical, duplicate) => void
 */
export function createJsonArrayMerge(octokit, { owner, repo, key = 'id', logger = NOOP_LOGGER }) {
  requireArguments(octokit, owner, repo);

  return async (canonical, duplicate) => {
    const base = parseJsonArray(canonical.body);
    const extra = parseJsonArray(duplicate.body);
    if (base === null || extra === null) {
      throw new IssueLookupError(
        `Cannot merge #${duplicate.number} into #${canonical.number}: an issue body is not a JSON array`
      );
    }

    const hasKey = (item) => item?.[key] !== undefined && item?.[key] !== null;
    const extraByKey = new Map(extra.filter(hasKey).map((item) => [item[key], item]));

    let replaced = 0;
    const merged = base.map((item) => {
      if (!hasKey(item) || !extraByKey.has(item[key])) return item;
      const winner = newerItem(item, extraByKey.get(item[key]));
      if (winner !== item && JSON.stringify(winner) !== JSON.stringify(item)) replaced++;
      return winner;
    });

    const known = new Set(base.filter(hasKey).map((item) => item[key]));
    const added = extra.filter((item) => !hasKey(item) || !known.has(item[key]));
    if (added.length === 0 && replaced === 0) return;

    const body = JSON.stringify([...merged, ...added], null, 2);
    await octokit.rest.issues.update({ owner, repo, issue_number: canonical.number, body });
    canonical.body = body;
    logger.info('Merged duplicate record items into canonical issue', {
      canonical: canonical.number,
      duplicate: duplicate.number,
      added: added.length,
      replaced,
    });
  };
}
