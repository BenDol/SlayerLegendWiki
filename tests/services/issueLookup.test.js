/**
 * Issue Lookup Tests
 *
 * Exercises the lookup module against a fake Octokit whose GraphQL and REST
 * backends can be made to disagree, mirroring the production failure where
 * the REST list came back empty while open records existed.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  ABSENCE_CONFIRMATION_ATTEMPTS,
  ABSENCE_UNCONFIRMED,
  DUPLICATE_CLOSE_REASON,
  INVALID_ARGUMENTS,
  ISSUE_PAGE_SIZE,
  IssueLookupError,
  LOOKUP_SOURCE,
  closeDuplicateIssue,
  createJsonArrayMerge,
  findCanonicalIssue,
  findIssues,
  findRecordIssue,
  getIssue,
  getOrCreateIssue,
  issueFromGraphQlNode,
  issueHasLabels,
  normalizeLabels,
  parseJsonArray,
  pickSelectorLabel,
  reconcileDuplicates,
  sameLogin,
  toIssueStates,
} from '../../src/services/github/issueLookup.js';

const OWNER = 'test-owner';
const REPO = 'test-repo';
const BOT = 'test-wiki-bot';

/** Build a REST-shaped issue. */
function restIssue(number, labels, overrides = {}) {
  return {
    number,
    title: `Issue ${number}`,
    body: '',
    state: 'open',
    locked: false,
    html_url: `https://github.com/${OWNER}/${REPO}/issues/${number}`,
    created_at: `2026-01-${String(number).padStart(2, '0')}T00:00:00Z`,
    updated_at: `2026-01-${String(number).padStart(2, '0')}T00:00:00Z`,
    user: { login: BOT },
    labels: labels.map((name) => ({ name })),
    comments: 0,
    ...overrides,
  };
}

/** Build a GraphQL issue node. */
function graphQlNode(number, labels, overrides = {}) {
  return {
    id: `I_${number}`,
    number,
    title: `Issue ${number}`,
    body: '',
    state: 'OPEN',
    stateReason: null,
    locked: false,
    url: `https://github.com/${OWNER}/${REPO}/issues/${number}`,
    createdAt: `2026-01-${String(number).padStart(2, '0')}T00:00:00Z`,
    updatedAt: `2026-01-${String(number).padStart(2, '0')}T00:00:00Z`,
    closedAt: null,
    author: { login: BOT },
    labels: { nodes: labels.map((name) => ({ name })) },
    comments: { totalCount: 0 },
    ...overrides,
  };
}

function graphQlPage(nodes, { hasNextPage = false, endCursor = null } = {}) {
  return { repository: { issues: { pageInfo: { hasNextPage, endCursor }, nodes } } };
}

/**
 * Fake Octokit. `graphql` may be a function, an array of responses (consumed
 * in order), or `null` to simulate a client without GraphQL. `rest` is an
 * array of REST list responses consumed in order (the last one repeats).
 */
function fakeOctokit({ graphql = [], rest = [[]], withGraphql = true } = {}) {
  const graphqlResponses = Array.isArray(graphql) ? [...graphql] : null;
  const restResponses = [...rest];

  const octokit = {
    rest: {
      issues: {
        listForRepo: vi.fn(async () => {
          const next = restResponses.length > 1 ? restResponses.shift() : restResponses[0];
          if (next instanceof Error) throw next;
          return { data: next };
        }),
        create: vi.fn(async ({ title, body, labels }) => ({
          data: restIssue(900, labels, { title, body }),
        })),
        update: vi.fn(async () => ({ data: {} })),
        lock: vi.fn(async () => ({ data: {} })),
        createComment: vi.fn(async () => ({ data: { id: 1 } })),
        get: vi.fn(async ({ issue_number }) => ({ data: restIssue(issue_number, []) })),
      },
    },
  };

  if (withGraphql) {
    octokit.graphql = typeof graphql === 'function'
      ? vi.fn(graphql)
      : vi.fn(async () => {
        const next = graphqlResponses.length > 1 ? graphqlResponses.shift() : graphqlResponses[0];
        if (next instanceof Error) throw next;
        if (next === undefined) return graphQlPage([]);
        return next;
      });
  }

  return octokit;
}

function silentLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const fast = { retryDelayMs: 0 };

describe('issueLookup helpers', () => {
  it('normalizes labels from strings, arrays and REST objects', () => {
    expect(normalizeLabels('a, b ,,a')).toEqual(['a', 'b']);
    expect(normalizeLabels(['a', { name: 'b' }, '', null])).toEqual(['a', 'b']);
    expect(normalizeLabels(undefined)).toEqual([]);
  });

  it('matches labels case-insensitively and requires all of them', () => {
    const issue = restIssue(1, ['Achievements', 'user-id:42']);
    expect(issueHasLabels(issue, ['achievements', 'USER-ID:42'])).toBe(true);
    expect(issueHasLabels(issue, ['achievements', 'user-id:43'])).toBe(false);
  });

  it('picks the most selective label by default and honours a valid override', () => {
    expect(pickSelectorLabel(['achievements', 'automated', 'user-id:42'])).toBe('user-id:42');
    expect(pickSelectorLabel(['data-version:v1', 'skill-builds'])).toBe('skill-builds');
    expect(pickSelectorLabel(['branch:main', 'automated'])).toBe('branch:main');
    expect(pickSelectorLabel(['content-creator-index'])).toBe('content-creator-index');
    expect(pickSelectorLabel(['achievements', 'user-id:42'], 'achievements')).toBe('achievements');
  });

  it('rejects an empty label set and a selector outside the label set', () => {
    expect(() => pickSelectorLabel([])).toThrow(IssueLookupError);
    expect(() => pickSelectorLabel(['a'], 'b')).toThrowError(expect.objectContaining({ code: INVALID_ARGUMENTS }));
  });

  it('maps lookup states to GraphQL states', () => {
    expect(toIssueStates('open')).toEqual(['OPEN']);
    expect(toIssueStates('closed')).toEqual(['CLOSED']);
    expect(toIssueStates('all')).toEqual(['OPEN', 'CLOSED']);
    expect(() => toIssueStates('weird')).toThrow(IssueLookupError);
  });

  it('maps a GraphQL node onto the REST issue shape the callers read', () => {
    const issue = issueFromGraphQlNode(graphQlNode(7, ['x'], {
      databaseId: 7007,
      comments: { totalCount: 3 },
      locked: true,
      labels: { nodes: [{ name: 'x', color: 'ff0000' }] },
    }));
    expect(issue).toMatchObject({
      id: 7007,
      node_id: 'I_7',
      number: 7,
      state: 'open',
      locked: true,
      html_url: `https://github.com/${OWNER}/${REPO}/issues/7`,
      user: { login: BOT },
      labels: [{ name: 'x', color: 'ff0000' }],
      comments: 3,
    });
  });

  it('compares logins the way both backends report bot accounts', () => {
    expect(sameLogin('github-actions', 'github-actions[bot]')).toBe(true);
    expect(sameLogin('Slayer-Wiki-Bot', 'slayer-wiki-bot')).toBe(true);
    expect(sameLogin('someone-else', 'slayer-wiki-bot')).toBe(false);
    expect(sameLogin(null, 'slayer-wiki-bot')).toBe(false);
    expect(sameLogin('', '')).toBe(false);
  });
});

describe('findIssues', () => {
  it('requires octokit, owner and repo', async () => {
    await expect(findIssues(null, { owner: OWNER, repo: REPO, labels: ['a'] })).rejects.toThrow(IssueLookupError);
    await expect(findIssues(fakeOctokit(), { owner: OWNER, labels: ['a'] })).rejects.toThrow(IssueLookupError);
  });

  it('reads through GraphQL by the selector label and matches the full label set locally', async () => {
    const octokit = fakeOctokit({
      graphql: [graphQlPage([
        graphQlNode(5, ['achievements', 'user-id:1']),
        graphQlNode(3, ['achievements', 'user-id:42']),
        graphQlNode(9, ['user-snapshot', 'user-id:42']),
      ])],
    });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['achievements', 'user-id:42'], ...fast });

    expect(result.source).toBe(LOOKUP_SOURCE.GRAPHQL);
    expect(result.issues.map((issue) => issue.number)).toEqual([3]);
    expect(result.confirmedAbsent).toBe(false);
    expect(octokit.graphql).toHaveBeenCalledTimes(1);
    expect(octokit.graphql.mock.calls[0][1]).toMatchObject({ labels: ['user-id:42'], states: ['OPEN'], first: ISSUE_PAGE_SIZE });
    expect(octokit.rest.issues.listForRepo).not.toHaveBeenCalled();
  });

  it('sorts matches by issue number ascending regardless of arrival order', async () => {
    const octokit = fakeOctokit({
      graphql: [graphQlPage([graphQlNode(12, ['idx']), graphQlNode(4, ['idx']), graphQlNode(8, ['idx'])])],
    });

    const { issues } = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], ...fast });

    expect(issues.map((issue) => issue.number)).toEqual([4, 8, 12]);
  });

  it('walks GraphQL cursors across pages', async () => {
    const octokit = fakeOctokit({
      graphql: [
        graphQlPage([graphQlNode(1, ['t', 'user-id:1'])], { hasNextPage: true, endCursor: 'c1' }),
        graphQlPage([graphQlNode(2, ['t', 'user-id:2'])]),
      ],
    });

    const { issues } = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['t', 'user-id:2'], selectorLabel: 't', ...fast });

    expect(issues.map((issue) => issue.number)).toEqual([2]);
    expect(octokit.graphql).toHaveBeenCalledTimes(2);
    expect(octokit.graphql.mock.calls[1][1].after).toBe('c1');
  });

  it('filters by exact title or a title predicate', async () => {
    const nodes = [graphQlNode(1, ['idx'], { title: '[Index]' }), graphQlNode(2, ['idx'], { title: 'Other' })];
    const byString = await findIssues(fakeOctokit({ graphql: [graphQlPage(nodes)] }), {
      owner: OWNER, repo: REPO, labels: ['idx'], title: '[Index]', ...fast,
    });
    const byPredicate = await findIssues(fakeOctokit({ graphql: [graphQlPage(nodes)] }), {
      owner: OWNER, repo: REPO, labels: ['idx'], title: (title) => title.startsWith('Oth'), ...fast,
    });

    expect(byString.issues.map((issue) => issue.number)).toEqual([1]);
    expect(byPredicate.issues.map((issue) => issue.number)).toEqual([2]);
  });

  it('uses the REST list as a cross-check when GraphQL returns nothing, and trusts REST when it finds the record', async () => {
    const logger = silentLogger();
    const octokit = fakeOctokit({ graphql: [graphQlPage([])], rest: [[restIssue(260, ['idx'])]] });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], logger, ...fast });

    expect(result.source).toBe(LOOKUP_SOURCE.REST);
    expect(result.issues.map((issue) => issue.number)).toEqual([260]);
    expect(octokit.rest.issues.listForRepo).toHaveBeenCalledTimes(1);
    expect(octokit.rest.issues.listForRepo.mock.calls[0][0]).toMatchObject({
      labels: 'idx', state: 'open', per_page: ISSUE_PAGE_SIZE, page: 1, sort: 'created', direction: 'asc',
    });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('confirms absence only when GraphQL and REST both come back empty', async () => {
    const octokit = fakeOctokit({ graphql: [graphQlPage([])], rest: [[]] });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], ...fast });

    expect(result.issues).toEqual([]);
    expect(result.confirmedAbsent).toBe(true);
    expect(result.source).toBe(LOOKUP_SOURCE.NONE);
    expect(octokit.rest.issues.listForRepo).toHaveBeenCalledTimes(1);
  });

  it('does not confirm absence when the REST cross-check fails', async () => {
    const octokit = fakeOctokit({ graphql: [graphQlPage([])], rest: [new Error('rate limited')] });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], ...fast });

    expect(result.issues).toEqual([]);
    expect(result.confirmedAbsent).toBe(false);
  });

  it('does not confirm absence when GraphQL truncated at the page ceiling', async () => {
    const octokit = fakeOctokit({
      graphql: [graphQlPage([graphQlNode(1, ['t', 'user-id:1'])], { hasNextPage: true, endCursor: 'c1' })],
      rest: [[]],
    });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['t', 'user-id:2'], selectorLabel: 't', maxPages: 1, ...fast });

    expect(result.issues).toEqual([]);
    expect(result.confirmedAbsent).toBe(false);
  });

  it('falls back to REST alone when GraphQL throws and needs repeated empty lists to confirm absence', async () => {
    const logger = silentLogger();
    const octokit = fakeOctokit({ graphql: [new Error('graphql down')], rest: [[]] });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], logger, ...fast });

    expect(result.confirmedAbsent).toBe(true);
    expect(octokit.rest.issues.listForRepo).toHaveBeenCalledTimes(ABSENCE_CONFIRMATION_ATTEMPTS);
    expect(result.attempts[0]).toMatchObject({ source: LOOKUP_SOURCE.GRAPHQL, error: 'graphql down' });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns the record as soon as a REST retry finds it in GraphQL-less mode', async () => {
    const octokit = fakeOctokit({ withGraphql: false, rest: [[], [restIssue(5, ['idx'])]] });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], ...fast });

    expect(result.source).toBe(LOOKUP_SOURCE.REST);
    expect(result.issues.map((issue) => issue.number)).toEqual([5]);
    expect(result.confirmedAbsent).toBe(false);
    expect(octokit.rest.issues.listForRepo).toHaveBeenCalledTimes(2);
  });

  it('throws when every backend fails', async () => {
    const octokit = fakeOctokit({ graphql: [new Error('graphql down')], rest: [new Error('rest down')] });

    await expect(findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], ...fast })).rejects.toThrow(/every backend/);
  });

  it('paginates the REST list and stops on a short page', async () => {
    const fullPage = Array.from({ length: ISSUE_PAGE_SIZE }, (_, i) => restIssue(i + 1, ['t']));
    const octokit = fakeOctokit({ withGraphql: false, rest: [fullPage, [restIssue(500, ['t'])]] });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['t'], ...fast });

    expect(result.issues).toHaveLength(ISSUE_PAGE_SIZE + 1);
    expect(octokit.rest.issues.listForRepo).toHaveBeenCalledTimes(2);
    expect(octokit.rest.issues.listForRepo.mock.calls[1][0].page).toBe(2);
  });

  it('does not confirm absence when the REST walk was truncated by the page ceiling', async () => {
    const fullPage = Array.from({ length: ISSUE_PAGE_SIZE }, (_, i) => restIssue(i + 1, ['t', 'other']));
    const octokit = fakeOctokit({ withGraphql: false, rest: [fullPage] });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['t', 'wanted'], maxPages: 1, ...fast });

    expect(result.issues).toEqual([]);
    expect(result.confirmedAbsent).toBe(false);
  });

  it('ignores pull requests and issues in the wrong state', async () => {
    const octokit = fakeOctokit({
      withGraphql: false,
      rest: [[
        restIssue(1, ['idx'], { pull_request: { url: 'x' } }),
        restIssue(2, ['idx'], { state: 'closed' }),
        restIssue(3, ['idx']),
      ]],
    });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], ...fast });

    expect(result.issues.map((issue) => issue.number)).toEqual([3]);
  });

  it('passes the requested state to both backends', async () => {
    const octokit = fakeOctokit({ graphql: [graphQlPage([])], rest: [[]] });

    await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], state: 'all', ...fast });

    expect(octokit.graphql.mock.calls[0][1].states).toEqual(['OPEN', 'CLOSED']);
    expect(octokit.rest.issues.listForRepo.mock.calls[0][0].state).toBe('all');
  });

  it('lets reads skip the absence protocol: one REST attempt, no sleeps, absence never confirmed', async () => {
    const octokit = fakeOctokit({ withGraphql: false, rest: [[]] });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], confirmAbsence: false, retryDelayMs: 5000 });

    expect(result.issues).toEqual([]);
    expect(result.confirmedAbsent).toBe(false);
    expect(octokit.rest.issues.listForRepo).toHaveBeenCalledTimes(1);
  });

  it('still confirms absence for reads when GraphQL itself answered', async () => {
    const octokit = fakeOctokit({ graphql: [graphQlPage([])], rest: [[]] });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], confirmAbsence: false, ...fast });

    expect(result.confirmedAbsent).toBe(true);
    expect(result.degraded).toBe(false);
  });

  it('reports a degraded lookup when GraphQL was available but failed', async () => {
    const octokit = fakeOctokit({ graphql: [new Error('graphql down')], rest: [[restIssue(5, ['idx'])]] });

    const result = await findIssues(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], ...fast });

    expect(result.degraded).toBe(true);
    expect(result.issues.map((issue) => issue.number)).toEqual([5]);
  });
});

describe('findCanonicalIssue', () => {
  it('returns the lowest-numbered record as canonical and the rest as duplicates', async () => {
    const octokit = fakeOctokit({
      graphql: [graphQlPage([graphQlNode(560, ['idx']), graphQlNode(260, ['idx']), graphQlNode(468, ['idx'])])],
    });

    const result = await findCanonicalIssue(octokit, { owner: OWNER, repo: REPO, labels: ['idx'], ...fast });

    expect(result.issue.number).toBe(260);
    expect(result.duplicates.map((issue) => issue.number)).toEqual([468, 560]);
  });

  it('returns null with confirmed absence when nothing exists', async () => {
    const result = await findCanonicalIssue(fakeOctokit({ graphql: [graphQlPage([])], rest: [[]] }), {
      owner: OWNER, repo: REPO, labels: ['idx'], ...fast,
    });

    expect(result.issue).toBeNull();
    expect(result.duplicates).toEqual([]);
    expect(result.confirmedAbsent).toBe(true);
  });
});

describe('getIssue', () => {
  it('returns the issue, or null on 404, and rethrows other errors', async () => {
    const octokit = fakeOctokit();
    expect((await getIssue(octokit, { owner: OWNER, repo: REPO, number: 5 })).number).toBe(5);

    octokit.rest.issues.get.mockRejectedValueOnce(Object.assign(new Error('nope'), { status: 404 }));
    expect(await getIssue(octokit, { owner: OWNER, repo: REPO, number: 6 })).toBeNull();

    octokit.rest.issues.get.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
    await expect(getIssue(octokit, { owner: OWNER, repo: REPO, number: 7 })).rejects.toThrow('boom');
  });
});

describe('reconcileDuplicates', () => {
  const canonical = restIssue(260, ['idx']);

  it('merges through the caller strategy, comments, then closes the duplicate', async () => {
    const octokit = fakeOctokit();
    const merge = vi.fn(async () => {});
    const duplicate = restIssue(468, ['idx']);

    const result = await reconcileDuplicates(octokit, { owner: OWNER, repo: REPO, canonical, duplicates: [duplicate], merge, botLogin: BOT });

    expect(merge).toHaveBeenCalledWith(canonical, duplicate);
    expect(result).toEqual({ closed: [468], kept: [] });
    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 468, body: expect.stringContaining('#260') }));
    expect(octokit.rest.issues.update).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 468, state: 'closed', state_reason: DUPLICATE_CLOSE_REASON }));
  });

  it('closes only empty duplicates when given isEmpty and no merge', async () => {
    const octokit = fakeOctokit();
    const logger = silentLogger();
    const empty = restIssue(468, ['idx']);
    const full = restIssue(558, ['idx'], { comments: 2 });

    const result = await reconcileDuplicates(octokit, {
      owner: OWNER, repo: REPO, canonical, duplicates: [empty, full], isEmpty: (issue) => issue.comments === 0, botLogin: BOT, logger,
    });

    expect(result).toEqual({ closed: [468], kept: [558] });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('leaves every duplicate open when neither merge nor isEmpty is supplied', async () => {
    const octokit = fakeOctokit();

    const result = await reconcileDuplicates(octokit, { owner: OWNER, repo: REPO, canonical, duplicates: [restIssue(468, ['idx'])], botLogin: BOT });

    expect(result).toEqual({ closed: [], kept: [468] });
    expect(octokit.rest.issues.update).not.toHaveBeenCalled();
  });

  it('refuses to close anything when no owner login is supplied (fail closed)', async () => {
    const octokit = fakeOctokit();
    const logger = silentLogger();

    const result = await reconcileDuplicates(octokit, {
      owner: OWNER, repo: REPO, canonical, duplicates: [restIssue(468, ['idx']), restIssue(560, ['idx'])], isEmpty: () => true, merge: vi.fn(), logger,
    });

    expect(result).toEqual({ closed: [], kept: [468, 560] });
    expect(octokit.rest.issues.update).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('never closes issues that another account created', async () => {
    const octokit = fakeOctokit();
    const foreign = restIssue(468, ['idx'], { user: { login: 'someone-else' } });

    const result = await reconcileDuplicates(octokit, {
      owner: OWNER, repo: REPO, canonical, duplicates: [foreign], isEmpty: () => true, botLogin: BOT,
    });

    expect(result).toEqual({ closed: [], kept: [468] });
    expect(octokit.rest.issues.update).not.toHaveBeenCalled();
  });

  it('matches the owner login across the REST and GraphQL spellings of a bot account', async () => {
    const octokit = fakeOctokit();
    const fromGraphQl = restIssue(468, ['idx'], { user: { login: 'github-actions' } });

    const result = await reconcileDuplicates(octokit, {
      owner: OWNER, repo: REPO, canonical, duplicates: [fromGraphQl], isEmpty: () => true, botLogin: 'github-actions[bot]',
    });

    expect(result).toEqual({ closed: [468], kept: [] });
  });

  it('keeps a duplicate open when merging fails and logs the error itself', async () => {
    const octokit = fakeOctokit();
    const logger = silentLogger();
    const failure = new Error('merge failed');

    const result = await reconcileDuplicates(octokit, {
      owner: OWNER, repo: REPO, canonical, duplicates: [restIssue(468, ['idx'])], merge: async () => { throw failure; }, botLogin: BOT, logger,
    });

    expect(result).toEqual({ closed: [], kept: [468] });
    expect(octokit.rest.issues.update).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ error: failure }));
  });

  it('skips the canonical issue itself', async () => {
    const octokit = fakeOctokit();

    const result = await reconcileDuplicates(octokit, { owner: OWNER, repo: REPO, canonical, duplicates: [canonical], isEmpty: () => true, botLogin: BOT });

    expect(result).toEqual({ closed: [], kept: [] });
  });

  it('still closes when the explanatory comment cannot be posted, and says so at warn level', async () => {
    const octokit = fakeOctokit();
    const logger = silentLogger();
    octokit.rest.issues.createComment.mockRejectedValueOnce(new Error('locked'));

    await closeDuplicateIssue(octokit, { owner: OWNER, repo: REPO, duplicate: restIssue(468, ['idx']), canonical, logger });

    expect(octokit.rest.issues.update).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 468, state: 'closed' }));
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('getOrCreateIssue', () => {
  const base = { owner: OWNER, repo: REPO, labels: ['idx'], title: '[Index]', body: 'initial', ...fast };

  it('returns the existing canonical record without creating', async () => {
    const octokit = fakeOctokit({ graphql: [graphQlPage([graphQlNode(260, ['idx'], { title: '[Index]' })])] });

    const result = await getOrCreateIssue(octokit, base);

    expect(result).toMatchObject({ created: false, createdNumber: null, duplicates: [] });
    expect(result.issue.number).toBe(260);
    expect(octokit.rest.issues.create).not.toHaveBeenCalled();
  });

  it('reconciles duplicates found alongside an existing record', async () => {
    const octokit = fakeOctokit({
      graphql: [graphQlPage([graphQlNode(560, ['idx']), graphQlNode(260, ['idx']), graphQlNode(468, ['idx'])])],
    });

    const result = await getOrCreateIssue(octokit, { ...base, isEmpty: () => true, botLogin: BOT });

    expect(result.issue.number).toBe(260);
    expect(result.reconciled).toEqual({ closed: [468, 560], kept: [] });
    expect(octokit.rest.issues.create).not.toHaveBeenCalled();
  });

  it('leaves duplicates untouched when reconciliation is disabled', async () => {
    const octokit = fakeOctokit({
      graphql: [graphQlPage([graphQlNode(560, ['idx']), graphQlNode(260, ['idx'])])],
    });

    const result = await getOrCreateIssue(octokit, { ...base, isEmpty: () => true, botLogin: BOT, reconcile: false });

    expect(result.issue.number).toBe(260);
    expect(result.duplicates.map((issue) => issue.number)).toEqual([560]);
    expect(result.reconciled).toEqual({ closed: [], kept: [] });
    expect(octokit.rest.issues.update).not.toHaveBeenCalled();
  });

  it('reuses a precomputed lookup instead of looking up again before creating', async () => {
    const octokit = fakeOctokit({ graphql: [graphQlPage([])], rest: [[]] });
    const precomputed = { issue: null, duplicates: [], confirmedAbsent: true };

    const result = await getOrCreateIssue(octokit, { ...base, precomputed });

    expect(result.created).toBe(true);
    // only the post-create lookup ran
    expect(octokit.graphql).toHaveBeenCalledTimes(1);
  });

  it('honours an unconfirmed precomputed lookup by refusing to create', async () => {
    const octokit = fakeOctokit();
    const precomputed = { issue: null, duplicates: [], confirmedAbsent: false };

    await expect(getOrCreateIssue(octokit, { ...base, precomputed })).rejects.toThrowError(expect.objectContaining({ code: ABSENCE_UNCONFIRMED }));
    expect(octokit.rest.issues.create).not.toHaveBeenCalled();
  });

  it('refuses to create when absence is not confirmed', async () => {
    const octokit = fakeOctokit({ graphql: [graphQlPage([])], rest: [new Error('rate limited')] });

    await expect(getOrCreateIssue(octokit, base)).rejects.toThrowError(expect.objectContaining({ code: ABSENCE_UNCONFIRMED }));
    expect(octokit.rest.issues.create).not.toHaveBeenCalled();
  });

  it('creates, locks and confirms itself as canonical when absence is confirmed', async () => {
    const octokit = fakeOctokit({
      graphql: [graphQlPage([]), graphQlPage([graphQlNode(900, ['idx'], { title: '[Index]' })])],
      rest: [[]],
    });

    const result = await getOrCreateIssue(octokit, { ...base, createLabels: ['idx', 'automated'], lock: true, lockReason: 'resolved' });

    expect(result).toMatchObject({ created: true, createdNumber: 900, duplicates: [] });
    expect(result.issue.number).toBe(900);
    expect(octokit.rest.issues.create).toHaveBeenCalledWith({ owner: OWNER, repo: REPO, title: '[Index]', body: 'initial', labels: ['idx', 'automated'] });
    expect(octokit.rest.issues.lock).toHaveBeenCalledWith({ owner: OWNER, repo: REPO, issue_number: 900, lock_reason: 'resolved' });
  });

  it('treats a concurrently created lower-numbered record as canonical and closes its own', async () => {
    const octokit = fakeOctokit({
      graphql: [graphQlPage([]), graphQlPage([graphQlNode(899, ['idx']), graphQlNode(900, ['idx'])])],
      rest: [[]],
    });

    const result = await getOrCreateIssue(octokit, { ...base, isEmpty: () => true, botLogin: BOT });

    expect(result.issue.number).toBe(899);
    expect(result.created).toBe(false);
    expect(result.createdNumber).toBe(900);
    expect(result.reconciled).toEqual({ closed: [900], kept: [] });
  });

  it('keeps its own record when the post-create lookup does not see it yet', async () => {
    const octokit = fakeOctokit({ graphql: [graphQlPage([]), graphQlPage([])], rest: [[]] });

    const result = await getOrCreateIssue(octokit, base);

    expect(result.issue.number).toBe(900);
    expect(result.created).toBe(true);
    expect(result.duplicates).toEqual([]);
  });

  it('survives a failing post-create lookup', async () => {
    const octokit = fakeOctokit({ graphql: [graphQlPage([]), new Error('graphql down')], rest: [[], new Error('rest down')] });
    const logger = silentLogger();

    const result = await getOrCreateIssue(octokit, { ...base, logger });

    expect(result.issue.number).toBe(900);
    expect(result.created).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('continues when locking fails', async () => {
    const octokit = fakeOctokit({ graphql: [graphQlPage([]), graphQlPage([])], rest: [[]] });
    octokit.rest.issues.lock.mockRejectedValueOnce(new Error('cannot lock'));

    const result = await getOrCreateIssue(octokit, { ...base, lock: true });

    expect(result.created).toBe(true);
  });

  it('requires a title', async () => {
    await expect(getOrCreateIssue(fakeOctokit(), { ...base, title: '' })).rejects.toThrowError(expect.objectContaining({ code: INVALID_ARGUMENTS }));
  });

  it('applies matchTitle when looking up so an unrelated issue with the label is not adopted', async () => {
    const octokit = fakeOctokit({
      graphql: [graphQlPage([graphQlNode(1, ['idx'], { title: 'Someone else' })]), graphQlPage([])],
      rest: [[]],
    });

    const result = await getOrCreateIssue(octokit, { ...base, matchTitle: '[Index]' });

    expect(result.created).toBe(true);
  });
});

describe('findRecordIssue', () => {
  it('pins the lookup to the identity label when one is known', async () => {
    const octokit = fakeOctokit({
      graphql: [graphQlPage([graphQlNode(3, ['skill-builds', 'user-id:42']), graphQlNode(9, ['user-snapshot', 'user-id:42'])])],
    });

    const result = await findRecordIssue(octokit, {
      owner: OWNER, repo: REPO, labels: ['skill-builds'], identityLabel: 'user-id:42', fallbackTitle: '[Skill Build] someone', ...fast,
    });

    expect(result.issue.number).toBe(3);
    expect(result.legacy).toBe(false);
    expect(octokit.graphql).toHaveBeenCalledTimes(1);
    expect(octokit.graphql.mock.calls[0][1].labels).toEqual(['user-id:42']);
  });

  it('adopts a legacy title-only record when the identity lookup misses, flagging it as legacy', async () => {
    const octokit = fakeOctokit({
      graphql: [
        graphQlPage([]),
        graphQlPage([graphQlNode(4, ['skill-builds'], { title: '[Skill Build] someone' })]),
      ],
      rest: [[]],
    });

    const result = await findRecordIssue(octokit, {
      owner: OWNER, repo: REPO, labels: ['skill-builds'], identityLabel: 'user-id:42', fallbackTitle: '[Skill Build] someone', ...fast,
    });

    expect(result.issue.number).toBe(4);
    expect(result.legacy).toBe(true);
    expect(octokit.graphql).toHaveBeenCalledTimes(2);
    expect(octokit.graphql.mock.calls[1][1].labels).toEqual(['skill-builds']);
  });

  it('only confirms absence when both the identity and the title lookups confirmed it', async () => {
    const octokit = fakeOctokit({ graphql: [graphQlPage([]), graphQlPage([])], rest: [[], new Error('rate limited')] });

    const result = await findRecordIssue(octokit, {
      owner: OWNER, repo: REPO, labels: ['skill-builds'], identityLabel: 'user-id:42', fallbackTitle: '[Skill Build] someone', ...fast,
    });

    expect(result.issue).toBeNull();
    expect(result.legacy).toBe(false);
    expect(result.confirmedAbsent).toBe(false);
  });

  it('falls back to an exact title under the type label when no identity is known', async () => {
    const octokit = fakeOctokit({
      graphql: [graphQlPage([
        graphQlNode(3, ['skill-builds'], { title: '[Skill Build] other' }),
        graphQlNode(4, ['skill-builds'], { title: '[Skill Build] someone' }),
      ])],
    });

    const result = await findRecordIssue(octokit, {
      owner: OWNER, repo: REPO, labels: ['skill-builds'], fallbackTitle: '[Skill Build] someone', ...fast,
    });

    expect(result.issue.number).toBe(4);
    expect(octokit.graphql.mock.calls[0][1].labels).toEqual(['skill-builds']);
  });

  it('requires an identity label or a fallback title', async () => {
    await expect(findRecordIssue(fakeOctokit(), { owner: OWNER, repo: REPO, labels: ['skill-builds'] }))
      .rejects.toThrowError(expect.objectContaining({ code: INVALID_ARGUMENTS }));
  });
});

describe('parseJsonArray', () => {
  it('parses arrays, treats blank as empty and rejects other shapes', () => {
    expect(parseJsonArray('[1, 2]')).toEqual([1, 2]);
    expect(parseJsonArray('')).toEqual([]);
    expect(parseJsonArray('   ')).toEqual([]);
    expect(parseJsonArray('{"a":1}')).toBeNull();
    expect(parseJsonArray('not json')).toBeNull();
  });
});

describe('createJsonArrayMerge', () => {
  it('appends items the canonical record lacks and rewrites its body', async () => {
    const octokit = fakeOctokit();
    const merge = createJsonArrayMerge(octokit, { owner: OWNER, repo: REPO });
    const canonical = restIssue(1, ['t'], { body: JSON.stringify([{ id: 'a' }, { id: 'b' }]) });
    const duplicate = restIssue(2, ['t'], { body: JSON.stringify([{ id: 'b' }, { id: 'c' }, { name: 'no-id' }]) });

    await merge(canonical, duplicate);

    const written = JSON.parse(octokit.rest.issues.update.mock.calls[0][0].body);
    expect(written).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { name: 'no-id' }]);
    expect(octokit.rest.issues.update.mock.calls[0][0].issue_number).toBe(1);
    expect(JSON.parse(canonical.body)).toEqual(written);
  });

  it('writes nothing when the duplicate adds no items', async () => {
    const octokit = fakeOctokit();
    const merge = createJsonArrayMerge(octokit, { owner: OWNER, repo: REPO });

    await merge(restIssue(1, ['t'], { body: '[{"id":"a"}]' }), restIssue(2, ['t'], { body: '' }));

    expect(octokit.rest.issues.update).not.toHaveBeenCalled();
  });

  it('writes nothing when both copies of an item are identical', async () => {
    const octokit = fakeOctokit();
    const merge = createJsonArrayMerge(octokit, { owner: OWNER, repo: REPO });

    await merge(restIssue(1, ['t'], { body: '[{"id":"a","name":"A"}]' }), restIssue(2, ['t'], { body: '[{"id":"a","name":"A"}]' }));

    expect(octokit.rest.issues.update).not.toHaveBeenCalled();
  });

  it('keeps the more recently edited copy of a shared item, whichever issue holds it', async () => {
    const octokit = fakeOctokit();
    const merge = createJsonArrayMerge(octokit, { owner: OWNER, repo: REPO });
    const canonical = restIssue(1, ['t'], { body: JSON.stringify([
      { id: 'a', name: 'A newer', updatedAt: '2026-05-02T00:00:00Z' },
      { id: 'b', name: 'B older', updatedAt: '2026-05-01T00:00:00Z' },
    ]) });
    const duplicate = restIssue(2, ['t'], { body: JSON.stringify([
      { id: 'a', name: 'A older', updatedAt: '2026-05-01T00:00:00Z' },
      { id: 'b', name: 'B newer', updatedAt: '2026-05-03T00:00:00Z' },
    ]) });

    await merge(canonical, duplicate);

    const written = JSON.parse(octokit.rest.issues.update.mock.calls[0][0].body);
    expect(written.map((item) => item.name)).toEqual(['A newer', 'B newer']);
  });

  it('lets the duplicate win a shared item when neither copy carries timestamps', async () => {
    const octokit = fakeOctokit();
    const merge = createJsonArrayMerge(octokit, { owner: OWNER, repo: REPO });

    await merge(
      restIssue(1, ['t'], { body: JSON.stringify([{ id: 'a', name: 'stale' }]) }),
      restIssue(2, ['t'], { body: JSON.stringify([{ id: 'a', name: 'latest' }]) })
    );

    const written = JSON.parse(octokit.rest.issues.update.mock.calls[0][0].body);
    expect(written).toEqual([{ id: 'a', name: 'latest' }]);
  });

  it('refuses to merge bodies that are not JSON arrays', async () => {
    const merge = createJsonArrayMerge(fakeOctokit(), { owner: OWNER, repo: REPO });

    await expect(merge(restIssue(1, ['t'], { body: '{"x":1}' }), restIssue(2, ['t'], { body: '[]' }))).rejects.toThrow(IssueLookupError);
  });
});
