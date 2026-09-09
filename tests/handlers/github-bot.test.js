/**
 * GitHub Bot Handler Tests
 * Comprehensive integration tests for all 11 GitHub bot actions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleGithubBot } from '../../functions/_shared/handlers/github-bot.js';
import { NetlifyAdapter, CloudflareAdapter } from '../../wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { CryptoAdapter } from '../../functions/_shared/adapters/CryptoAdapter.js';
import {
  createMockNetlifyEvent,
  createMockCloudflareContext,
  createMockConfigAdapter
} from '../helpers/adapterHelpers.js';
import { createMockOctokit } from '../mocks/octokit.js';
import { setupAPIMocks } from '../mocks/externalApis.js';
import * as jwt from '../../functions/_shared/jwt.js';

/**
 * In-memory GitHub issue store shared by every mocked Octokit instance.
 * Both the GraphQL endpoint and the REST list answer from it, so tests
 * describe repository state once and can make the backends disagree the way
 * production does: `restEmpty` (the REST list silently returns nothing),
 * `failRest`, `graphqlEmpty` and `failGraphql`. `comments` maps comment ids to
 * bodies for the creator submissions stored as comments.
 */
const github = vi.hoisted(() => {
  const state = {
    issues: [],
    comments: {},
    nextNumber: 1000,
    graphqlCalls: 0,
    failRest: false,
    restEmpty: false,
    failGraphql: false,
    graphqlEmpty: false,
  };

  const issue = (number, { title = `Issue ${number}`, body = '', labels = [], login = 'test-wiki-bot', comments = 0, state: issueState = 'open' } = {}) => ({
    id: number,
    number,
    title,
    body,
    state: issueState,
    locked: false,
    html_url: `https://github.com/test-owner/test-repo/issues/${number}`,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    user: { login },
    labels: labels.map((name) => ({ name })),
    comments,
  });

  const reset = () => {
    state.issues = [issue(1, { title: 'Test Issue', body: 'Test issue body', labels: ['bug'] })];
    state.comments = {};
    state.nextNumber = 1000;
    state.graphqlCalls = 0;
    state.failRest = false;
    state.restEmpty = false;
    state.failGraphql = false;
    state.graphqlEmpty = false;
  };

  reset();
  return { state, issue, reset };
});

// Mock Octokit - must be inline since vi.mock() is hoisted before imports
vi.mock('@octokit/rest', () => {
  const { state } = github;
  const labelNames = (issue) => issue.labels.map((label) => (typeof label === 'string' ? label : label.name));
  const hasLabels = (issue, labels) => labels.every((name) => labelNames(issue).includes(name));
  const inState = (issue, wanted) => wanted === 'all' || issue.state === wanted;
  const toNode = (issue) => ({
    id: `I_${issue.number}`,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state.toUpperCase(),
    stateReason: null,
    locked: issue.locked,
    url: issue.html_url,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: null,
    author: { login: issue.user.login },
    labels: { nodes: labelNames(issue).map((name) => ({ name })) },
    comments: { totalCount: issue.comments },
  });

  return {
    Octokit: class MockOctokit {
      constructor() {
        this.graphql = async (query, variables) => {
          state.graphqlCalls++;
          if (state.failGraphql) throw new Error('graphql unavailable');
          const wanted = variables.states.includes('OPEN') && variables.states.includes('CLOSED') ? 'all' : variables.states[0].toLowerCase();
          const nodes = state.graphqlEmpty
            ? []
            : state.issues.filter((issue) => inState(issue, wanted) && hasLabels(issue, variables.labels)).map(toNode);
          return { repository: { issues: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } };
        };

        this.rest = {
          issues: {
            create: async (params) => {
              const created = github.issue(state.nextNumber++, {
                title: params.title,
                body: params.body || '',
                labels: params.labels || [],
              });
              state.issues.push(created);
              return { data: created };
            },
            update: async (params) => {
              const target = state.issues.find((issue) => issue.number === params.issue_number);
              if (target) {
                if (params.body !== undefined) target.body = params.body;
                if (params.title !== undefined) target.title = params.title;
                if (params.state !== undefined) target.state = params.state;
                if (params.labels !== undefined) target.labels = params.labels.map((name) => ({ name }));
              }
              return { data: target ?? { id: 1, number: params.issue_number } };
            },
            createComment: async (params) => {
              const target = state.issues.find((issue) => issue.number === params.issue_number);
              if (target) target.comments += 1;
              return { data: { id: 1, body: 'test' } };
            },
            getComment: async ({ comment_id }) => {
              const body = state.comments[comment_id];
              if (body === undefined) return { data: { id: comment_id, body: 'test' } };
              return { data: { id: comment_id, body } };
            },
            updateComment: async ({ comment_id, body }) => {
              state.comments[comment_id] = body;
              return { data: { id: comment_id, body } };
            },
            deleteComment: async ({ comment_id }) => {
              delete state.comments[comment_id];
              return { data: {} };
            },
            get: async ({ issue_number }) => {
              const target = state.issues.find((issue) => issue.number === issue_number);
              if (!target) throw Object.assign(new Error('Not Found'), { status: 404 });
              return { data: target };
            },
            listForRepo: async (params) => {
              if (state.failRest) throw new Error('rest unavailable');
              if (state.restEmpty) return { data: [] };
              const labels = String(params.labels ?? '').split(',').filter(Boolean);
              const wanted = params.state ?? 'open';
              return { data: state.issues.filter((issue) => inState(issue, wanted) && hasLabels(issue, labels)) };
            },
            addLabels: () => Promise.resolve({ data: { id: 1 } }),
            lock: () => Promise.resolve({ data: {} }),
          },
          pulls: {
            create: () => Promise.resolve({ data: { id: 1, number: 1 } }),
          },
          repos: {
            get: () => Promise.resolve({ data: { owner: { login: 'test-owner' }, name: 'test-repo' } }),
            getContent: () => Promise.resolve({ data: { sha: 'test-sha', content: Buffer.from('test').toString('base64') } }),
            createOrUpdateFileContents: () => Promise.resolve({ data: { content: { sha: 'new-sha' } } }),
            getBranch: () => Promise.resolve({ data: { commit: { sha: 'commit-sha' } } }),
            getCollaboratorPermissionLevel: () => Promise.resolve({ data: { permission: 'admin' } }),
          },
          git: {
            createRef: () => Promise.resolve({ data: { ref: 'refs/heads/test' } }),
            createTree: () => Promise.resolve({ data: { sha: 'tree-sha' } }),
            createCommit: () => Promise.resolve({ data: { sha: 'commit-sha' } }),
          },
          users: {
            getByUsername: () => Promise.resolve({ data: { id: 123, login: 'testuser' } }),
            getAuthenticated: () => Promise.resolve({ data: { id: 1, login: 'test-owner' } }),
          },
        };
      }
    }
  };
});

describe('handleGithubBot', () => {
  let configAdapter;
  let cryptoAdapter;
  let cleanupMocks;

  beforeEach(() => {
    github.reset();
    configAdapter = createMockConfigAdapter();
    cryptoAdapter = new CryptoAdapter('netlify');
    cleanupMocks = setupAPIMocks();
  });

  /** POST a bot action and parse the JSON response. */
  async function post(body) {
    const event = createMockNetlifyEvent({ httpMethod: 'POST', body: JSON.stringify(body) });
    const response = await handleGithubBot(new NetlifyAdapter(event), configAdapter, cryptoAdapter);
    return { status: response.statusCode, body: JSON.parse(response.body) };
  }

  const CREATOR_INDEX_LABEL = 'content-creator-index';
  const CREATOR_INDEX_TITLE = '[Content Creator Index]';
  const CREATOR_INDEX_BODY = '# Content Creator Index\n\n## Approved Creators\n\n## Pending Approvals\n\n---\n\n🤖 Managed by wiki bot';
  const indexIssues = () => github.state.issues.filter((issue) => issue.labels.some((label) => label.name === CREATOR_INDEX_LABEL));
  const openIndexIssues = () => indexIssues().filter((issue) => issue.state === 'open');

  /** Each creator test uses its own repo so the handler's in-flight lookup cache never bleeds between tests. */
  let creatorRepoCounter = 0;
  const creatorRepo = () => `creator-repo-${++creatorRepoCounter}`;

  afterEach(() => {
    if (cleanupMocks) cleanupMocks();
    vi.restoreAllMocks();
  });

  describe('Action: create-comment', () => {
    it('should create comment successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-comment',
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 1,
          body: 'Test comment'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('comment');
    });

    it('should validate comment body', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-comment',
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 1,
          body: '' // Empty body
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Action: update-issue', () => {
    it('should update issue successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'update-issue',
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 1,
          body: 'Updated body'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Action: list-issues', () => {
    it('should list issues by label', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'list-issues',
          owner: 'test-owner',
          repo: 'test-repo',
          labels: 'bug'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('issues');
      expect(body.issues.map((issue) => issue.number)).toEqual([1]);
    });

    it('should return only bot-created issues, oldest first', async () => {
      github.state.issues.push(
        github.issue(30, { labels: ['bug'] }),
        github.issue(20, { labels: ['bug'], login: 'someone-else' }),
        github.issue(10, { labels: ['bug'] })
      );

      const { status, body } = await post({ action: 'list-issues', owner: 'test-owner', repo: 'test-repo', labels: ['bug'] });

      expect(status).toBe(200);
      expect(body.issues.map((issue) => issue.number)).toEqual([1, 10, 30]);
    });

    it('should still find issues the REST list fails to return', async () => {
      github.state.failRest = true;

      const { status, body } = await post({ action: 'list-issues', owner: 'test-owner', repo: 'test-repo', labels: 'bug' });

      expect(status).toBe(200);
      expect(body.issues.map((issue) => issue.number)).toEqual([1]);
    });

    it('should reject an unknown state and an empty label list', async () => {
      const badState = await post({ action: 'list-issues', owner: 'test-owner', repo: 'test-repo', labels: 'bug', state: 'weird' });
      const noLabels = await post({ action: 'list-issues', owner: 'test-owner', repo: 'test-repo', labels: [] });

      expect(badState.status).toBe(400);
      expect(noLabels.status).toBe(400);
    });
  });

  describe('Action: create-comment-issue (preventDuplicates)', () => {
    const request = (repo) => ({
      action: 'create-comment-issue',
      owner: 'test-owner',
      repo,
      title: 'Comments: page',
      body: 'Comment thread',
      labels: ['wiki:comment', 'page:section/page'],
      preventDuplicates: true,
    });

    it('should return the oldest existing issue instead of creating another', async () => {
      github.state.issues.push(
        github.issue(40, { labels: ['wiki:comment', 'page:section/page'] }),
        github.issue(41, { labels: ['wiki:comment', 'page:section/page'] })
      );

      const { status, body } = await post(request('test-repo'));

      expect(status).toBe(200);
      expect(body.wasExisting).toBe(true);
      expect(body.issue.number).toBe(40);
      expect(github.state.issues).toHaveLength(3);
    });

    it('should create when both backends confirm nothing exists', async () => {
      const { status, body } = await post(request('test-repo'));

      expect(status).toBe(200);
      expect(body.wasExisting).toBeUndefined();
      expect(body.issue.number).toBe(1000);
    });

    it('should refuse to create when absence cannot be confirmed', async () => {
      github.state.failRest = true;

      const { status, body } = await post(request('test-repo'));

      expect(status).toBe(503);
      expect(body.code).toBe('ABSENCE_UNCONFIRMED');
      expect(github.state.issues).toHaveLength(1);
    });

    it('should refuse labels that belong to bot-managed records', async () => {
      for (const reserved of [CREATOR_INDEX_LABEL, 'achievements', 'user-snapshot', 'skill-builds', 'user-id:123', 'data-version:v1']) {
        const { status, body } = await post({ ...request('test-repo'), labels: ['wiki:comment', reserved] });
        expect(status, reserved).toBe(400);
        expect(body.error, reserved).toContain('reserved');
      }
      expect(github.state.issues).toHaveLength(1);
    });
  });

  describe('Content creator index', () => {
    it('get-approved-creators never creates the index', async () => {
      const { status, body } = await post({ action: 'get-approved-creators', owner: 'test-owner', repo: creatorRepo() });

      expect(status).toBe(200);
      expect(body).toEqual({ creators: [] });
      expect(indexIssues()).toHaveLength(0);
    });

    it('get-all-creator-submissions never creates the index', async () => {
      const { status, body } = await post({ action: 'get-all-creator-submissions', owner: 'test-owner', repo: creatorRepo() });

      expect(status).toBe(200);
      expect(body).toEqual({ submissions: [] });
      expect(indexIssues()).toHaveLength(0);
    });

    it('sync-creator-approvals reports 404 rather than creating the index', async () => {
      const { status, body } = await post({
        action: 'sync-creator-approvals', owner: 'test-owner', repo: creatorRepo(), adminUsername: 'test-owner', userToken: 'token',
      });

      expect(status).toBe(404);
      expect(body.error).toMatch(/No content creator index/);
      expect(indexIssues()).toHaveLength(0);
    });

    const submission = (repo) => ({
      action: 'submit-content-creator',
      owner: 'test-owner',
      repo,
      creatorId: 'twitch-abc123',
      channelUrl: 'https://twitch.tv/streamer',
      channelName: 'Streamer',
      platform: 'twitch',
      submittedBy: 'fan',
    });

    it('submit-content-creator creates the index once, when both backends confirm it is absent', async () => {
      const { status, body } = await post(submission(creatorRepo()));

      expect(status).toBe(201);
      const created = openIndexIssues();
      expect(created).toHaveLength(1);
      expect(created[0].title).toBe(CREATOR_INDEX_TITLE);
      expect(created[0].body).toContain('- [ ] [Streamer]');
      expect(body.issueNumber).toBe(created[0].number);
    });

    it('submit-content-creator refuses to create the index when absence is unconfirmed', async () => {
      github.state.failRest = true;

      const { status, body } = await post(submission(creatorRepo()));

      expect(status).toBe(503);
      expect(body.code).toBe('ABSENCE_UNCONFIRMED');
      expect(indexIssues()).toHaveLength(0);
    });

    it('submit-content-creator uses the oldest open index and closes empty duplicates', async () => {
      github.state.issues.push(
        github.issue(560, { title: CREATOR_INDEX_TITLE, body: CREATOR_INDEX_BODY, labels: [CREATOR_INDEX_LABEL] }),
        github.issue(260, { title: CREATOR_INDEX_TITLE, body: CREATOR_INDEX_BODY, labels: [CREATOR_INDEX_LABEL] }),
        github.issue(468, { title: CREATOR_INDEX_TITLE, body: CREATOR_INDEX_BODY, labels: [CREATOR_INDEX_LABEL] })
      );

      const { status, body } = await post(submission(creatorRepo()));

      expect(status).toBe(201);
      expect(body.issueNumber).toBe(260);
      expect(openIndexIssues().map((issue) => issue.number)).toEqual([260]);
      expect(github.state.issues.find((issue) => issue.number === 260).body).toContain('- [ ] [Streamer]');
      expect(github.state.issues.filter((issue) => [468, 560].includes(issue.number)).every((issue) => issue.state === 'closed')).toBe(true);
    });

    it('submit-content-creator merges a duplicate that holds submissions instead of discarding it', async () => {
      const withPending = CREATOR_INDEX_BODY.replace(
        '## Pending Approvals\n',
        '## Pending Approvals\n- [ ] [Older](https://github.com/test-owner/test-repo/issues/468#issuecomment-77) - twitch - submitted by @someone\n'
      );
      github.state.issues.push(
        github.issue(260, { title: CREATOR_INDEX_TITLE, body: CREATOR_INDEX_BODY, labels: [CREATOR_INDEX_LABEL] }),
        github.issue(468, { title: CREATOR_INDEX_TITLE, body: withPending, labels: [CREATOR_INDEX_LABEL], comments: 1 })
      );

      const { status } = await post(submission(creatorRepo()));

      expect(status).toBe(201);
      const canonical = github.state.issues.find((issue) => issue.number === 260);
      expect(canonical.body).toContain('#issuecomment-77');
      expect(canonical.body).toContain('- [ ] [Streamer]');
      expect(github.state.issues.find((issue) => issue.number === 468).state).toBe('closed');
    });

    const approvedCreator = { creatorId: 'twitch-abc123', platform: 'twitch', channelUrl: 'https://twitch.tv/streamer', channelName: 'Streamer', approved: true };
    const indexWithApproved = (commentId) => CREATOR_INDEX_BODY.replace('## Approved Creators\n', `## Approved Creators\n[twitch-abc123]=${commentId}\n`);

    it('reads find the index even when the REST list throws', async () => {
      github.state.comments[77] = JSON.stringify(approvedCreator);
      github.state.issues.push(
        github.issue(260, { title: CREATOR_INDEX_TITLE, body: indexWithApproved(77), labels: [CREATOR_INDEX_LABEL], comments: 1 })
      );
      github.state.failRest = true;

      const { status, body } = await post({ action: 'get-all-creator-submissions', owner: 'test-owner', repo: creatorRepo() });

      expect(status).toBe(200);
      expect(body.submissions).toEqual([approvedCreator]);
    });

    it('reads find the index when the REST list silently returns nothing (the production failure)', async () => {
      github.state.comments[77] = JSON.stringify(approvedCreator);
      github.state.issues.push(
        github.issue(260, { title: CREATOR_INDEX_TITLE, body: indexWithApproved(77), labels: [CREATOR_INDEX_LABEL], comments: 1 })
      );
      github.state.restEmpty = true;

      const { status, body } = await post({ action: 'get-approved-creators', owner: 'test-owner', repo: creatorRepo() });

      expect(status).toBe(200);
      expect(body.creators).toEqual([approvedCreator]);
    });

    it('submit-content-creator does not create a second index when the REST list silently returns nothing', async () => {
      github.state.issues.push(
        github.issue(260, { title: CREATOR_INDEX_TITLE, body: CREATOR_INDEX_BODY, labels: [CREATOR_INDEX_LABEL] })
      );
      github.state.restEmpty = true;

      const { status, body } = await post(submission(creatorRepo()));

      expect(status).toBe(201);
      expect(body.issueNumber).toBe(260);
      expect(indexIssues()).toHaveLength(1);
    });

    it('reads still find the index when GraphQL is down or answers empty but the REST list has it', async () => {
      github.state.comments[77] = JSON.stringify(approvedCreator);
      github.state.issues.push(
        github.issue(260, { title: CREATOR_INDEX_TITLE, body: indexWithApproved(77), labels: [CREATOR_INDEX_LABEL], comments: 1 })
      );

      github.state.failGraphql = true;
      const down = await post({ action: 'get-approved-creators', owner: 'test-owner', repo: creatorRepo() });
      expect(down.status).toBe(200);
      expect(down.body.creators).toEqual([approvedCreator]);

      github.state.failGraphql = false;
      github.state.graphqlEmpty = true;
      const empty = await post({ action: 'get-approved-creators', owner: 'test-owner', repo: creatorRepo() });
      expect(empty.status).toBe(200);
      expect(empty.body.creators).toEqual([approvedCreator]);
    });

    it('reads never close duplicate indexes; the admin sync does', async () => {
      const repo = creatorRepo();
      github.state.issues.push(
        github.issue(260, { title: CREATOR_INDEX_TITLE, body: CREATOR_INDEX_BODY, labels: [CREATOR_INDEX_LABEL] }),
        github.issue(468, { title: CREATOR_INDEX_TITLE, body: CREATOR_INDEX_BODY, labels: [CREATOR_INDEX_LABEL] })
      );

      const read = await post({ action: 'get-approved-creators', owner: 'test-owner', repo });
      expect(read.status).toBe(200);
      expect(openIndexIssues().map((issue) => issue.number)).toEqual([260, 468]);

      const sync = await post({ action: 'sync-creator-approvals', owner: 'test-owner', repo, adminUsername: 'test-owner', userToken: 'token' });
      expect(sync.status).toBe(200);
      expect(openIndexIssues().map((issue) => issue.number)).toEqual([260]);
    });

    it('concurrent reads share one GitHub lookup', async () => {
      const repo = creatorRepo();
      github.state.issues.push(
        github.issue(260, { title: CREATOR_INDEX_TITLE, body: CREATOR_INDEX_BODY, labels: [CREATOR_INDEX_LABEL] })
      );

      const results = await Promise.all([
        post({ action: 'get-approved-creators', owner: 'test-owner', repo }),
        post({ action: 'get-approved-creators', owner: 'test-owner', repo }),
        post({ action: 'get-all-creator-submissions', owner: 'test-owner', repo }),
      ]);

      expect(results.every((result) => result.status === 200)).toBe(true);
      expect(github.state.graphqlCalls).toBe(1);
    });

    it('sync-creator-approvals moves a checked pending entry into the approved map', async () => {
      const pendingCreator = { ...approvedCreator, approved: false };
      github.state.comments[77] = JSON.stringify(pendingCreator);
      const withChecked = CREATOR_INDEX_BODY.replace(
        '## Pending Approvals\n',
        '## Pending Approvals\n- [x] [Streamer](https://github.com/test-owner/test-repo/issues/260#issuecomment-77) - twitch - submitted by @fan\n'
      );
      github.state.issues.push(
        github.issue(260, { title: CREATOR_INDEX_TITLE, body: withChecked, labels: [CREATOR_INDEX_LABEL], comments: 1 })
      );

      const { status, body } = await post({ action: 'sync-creator-approvals', owner: 'test-owner', repo: creatorRepo(), adminUsername: 'test-owner', userToken: 'token' });

      expect(status).toBe(200);
      expect(body.updatesCount).toBe(1);
      const index = github.state.issues.find((issue) => issue.number === 260).body;
      expect(index).toContain('[twitch-abc123]=77');
      expect(index).not.toContain('- [x] [Streamer]');
    });

    it('parses an index body that GitHub stored with CRLF line endings', async () => {
      github.state.comments[77] = JSON.stringify(approvedCreator);
      github.state.issues.push(
        github.issue(260, { title: CREATOR_INDEX_TITLE, body: indexWithApproved(77).replace(/\n/g, '\r\n'), labels: [CREATOR_INDEX_LABEL], comments: 1 }),
        github.issue(468, { title: CREATOR_INDEX_TITLE, body: CREATOR_INDEX_BODY, labels: [CREATOR_INDEX_LABEL] })
      );

      const { status, body } = await post({
        ...submission(creatorRepo()),
        creatorId: 'twitch-def456',
        channelUrl: 'https://twitch.tv/other',
        channelName: 'Other',
      });

      expect(status).toBe(201);
      expect(body.issueNumber).toBe(260);
      const index = github.state.issues.find((issue) => issue.number === 260).body;
      // the approved entry survived the CRLF parse, the duplicate was closed, the new submission landed
      expect(index).toContain('[twitch-abc123]=77');
      expect(index).toContain('- [ ] [Other]');
      expect(github.state.issues.find((issue) => issue.number === 468).state).toBe('closed');
    });

    it('a write right after another write sees the current body, not a cached one', async () => {
      const repo = creatorRepo();
      github.state.issues.push(
        github.issue(260, { title: CREATOR_INDEX_TITLE, body: CREATOR_INDEX_BODY, labels: [CREATOR_INDEX_LABEL] })
      );

      const first = await post(submission(repo));
      const second = await post({ ...submission(repo), creatorId: 'twitch-def456', channelUrl: 'https://twitch.tv/other', channelName: 'Other' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      const index = github.state.issues.find((issue) => issue.number === 260).body;
      expect(index).toContain('- [ ] [Streamer]');
      expect(index).toContain('- [ ] [Other]');
    });
  });

  describe('Action: create-comment-issue', () => {
    it('should create comment issue successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-comment-issue',
          owner: 'test-owner',
          repo: 'test-repo',
          title: 'Test Issue',
          body: 'Test body',
          labels: ['comment']
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Action: send-verification-email', () => {
    it('should send verification email successfully', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'send-verification-email',
          owner: 'test-owner',
          repo: 'test-repo',
          email: 'test@example.com'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Verification code sent');
    });

    it('should validate email format', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'send-verification-email',
          owner: 'test-owner',
          repo: 'test-repo',
          email: 'invalid-email'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Action: create-anonymous-pr', () => {
    it('should create anonymous PR with all validations', async () => {
      const verificationToken = await jwt.sign(
        { email: 'test@example.com', timestamp: Date.now(), type: 'email-verification' },
        process.env.EMAIL_VERIFICATION_SECRET,
        86400
      );

      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-anonymous-pr',
          owner: 'test-owner',
          repo: 'test-repo',
          section: 'guides',
          pageId: 'test-page',
          pageTitle: 'Test Page',
          content: '# Test Content',
          email: 'test@example.com',
          displayName: 'Test User',
          reason: 'Fixed typo',
          verificationToken,
          captchaToken: 'test-captcha-token'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('pr');
    });

    it('should reject profane display name', async () => {
      const verificationToken = await jwt.sign(
        { email: 'test@example.com', timestamp: Date.now(), type: 'email-verification' },
        process.env.EMAIL_VERIFICATION_SECRET,
        86400
      );

      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-anonymous-pr',
          owner: 'test-owner',
          repo: 'test-repo',
          section: 'guides',
          pageId: 'test-page',
          pageTitle: 'Test Page',
          content: '# Test Content',
          email: 'test@example.com',
          displayName: 'badword user', // Will be flagged by mock
          reason: 'Fixed typo',
          verificationToken,
          captchaToken: 'test-captcha-token'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('inappropriate');
    });
  });

  describe('Common Validation', () => {
    it('should reject non-POST requests', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'GET'
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(405);
    });

    it('should validate required fields', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          // missing action, owner, repo
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(400);
    });

    it('should handle unknown actions', async () => {
      const event = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'unknown-action',
          owner: 'test-owner',
          repo: 'test-repo'
        })
      });
      const adapter = new NetlifyAdapter(event);

      const response = await handleGithubBot(adapter, configAdapter, cryptoAdapter);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unknown action');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work identically on both platforms', async () => {
      const netlifyEvent = createMockNetlifyEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          action: 'create-comment',
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 1,
          body: 'Test comment'
        })
      });
      const netlifyAdapter = new NetlifyAdapter(netlifyEvent);

      const cloudflareContext = createMockCloudflareContext({
        method: 'POST',
        body: JSON.stringify({
          action: 'create-comment',
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 1,
          body: 'Test comment'
        }),
        env: {
          WIKI_BOT_TOKEN: process.env.WIKI_BOT_TOKEN
        }
      });
      const cloudflareAdapter = new CloudflareAdapter(cloudflareContext);
      const cloudflareCryptoAdapter = new CryptoAdapter('cloudflare');

      const netlifyResponse = await handleGithubBot(netlifyAdapter, configAdapter, cryptoAdapter);
      const cloudflareResponse = await handleGithubBot(cloudflareAdapter, configAdapter, cloudflareCryptoAdapter);

      expect(netlifyResponse.statusCode).toBe(cloudflareResponse.status);
    });
  });
});
