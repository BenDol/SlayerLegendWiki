/**
 * WikiGitHubStorage Tests
 *
 * Drives the storage wrapper against an in-memory GitHub store that answers
 * both GraphQL and REST, so the lookup, create-only-when-confirmed-absent,
 * lost-race merge, delete-to-empty and comment-based grid paths are all
 * exercised end to end without a network.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import WikiGitHubStorage from '../../functions/_shared/WikiGitHubStorage.js';
import { ABSENCE_UNCONFIRMED } from '../../src/services/github/issueLookup.js';

const github = vi.hoisted(() => {
  const state = {
    issues: [],
    issueComments: {},
    nextNumber: 1000,
    nextCommentId: 500,
    failRest: false,
    restEmpty: false,
    onCreate: null,
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
    state.issues = [];
    state.issueComments = {};
    state.nextNumber = 1000;
    state.nextCommentId = 500;
    state.failRest = false;
    state.restEmpty = false;
    state.onCreate = null;
  };

  reset();
  return { state, issue, reset };
});

vi.mock('@octokit/rest', () => {
  const { state } = github;
  const labelNames = (issue) => issue.labels.map((label) => (typeof label === 'string' ? label : label.name));
  const hasLabels = (issue, labels) => labels.every((name) => labelNames(issue).includes(name));
  const toNode = (issue) => ({
    id: `I_${issue.number}`,
    databaseId: issue.number,
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
    labels: { nodes: labelNames(issue).map((name) => ({ name, color: null })) },
    comments: { totalCount: (state.issueComments[issue.number] ?? []).length },
  });
  const find = (number) => state.issues.find((issue) => issue.number === number);

  return {
    Octokit: class MockOctokit {
      constructor() {
        this.graphql = async (query, variables) => {
          const nodes = state.issues
            .filter((issue) => issue.state === 'open' && hasLabels(issue, variables.labels))
            .map(toNode);
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
              if (state.onCreate) state.onCreate(created);
              return { data: created };
            },
            update: async (params) => {
              const target = find(params.issue_number);
              if (target) {
                if (params.body !== undefined) target.body = params.body;
                if (params.title !== undefined) target.title = params.title;
                if (params.state !== undefined) target.state = params.state;
                if (params.labels !== undefined) target.labels = params.labels.map((name) => ({ name }));
              }
              return { data: target };
            },
            get: async ({ issue_number }) => {
              const target = find(issue_number);
              if (!target) throw Object.assign(new Error('Not Found'), { status: 404 });
              return { data: target };
            },
            listForRepo: async (params) => {
              if (state.failRest) throw new Error('rest unavailable');
              if (state.restEmpty) return { data: [] };
              const labels = String(params.labels ?? '').split(',').filter(Boolean);
              return { data: state.issues.filter((issue) => issue.state === (params.state ?? 'open') && hasLabels(issue, labels)) };
            },
            listComments: async ({ issue_number }) => ({ data: [...(state.issueComments[issue_number] ?? [])] }),
            createComment: async ({ issue_number, body }) => {
              const comment = { id: state.nextCommentId++, body };
              (state.issueComments[issue_number] ??= []).push(comment);
              const target = find(issue_number);
              if (target) target.comments += 1;
              return { data: comment };
            },
            updateComment: async ({ comment_id, body }) => {
              for (const comments of Object.values(state.issueComments)) {
                const comment = comments.find((entry) => entry.id === comment_id);
                if (comment) {
                  comment.body = body;
                  return { data: comment };
                }
              }
              throw new Error('comment not found');
            },
            addLabels: async () => ({ data: {} }),
            lock: async () => ({ data: {} }),
          },
        };
      }
    },
  };
});

const OWNER = 'test-owner';
const REPO = 'test-repo';
const BOT = 'test-wiki-bot';
const TYPE = 'skill-builds';
const USER_ID = 42;
const USERNAME = 'alice';
const RECORD_LABELS = [TYPE, `user-id:${USER_ID}`, 'data-version:v1'];

const storage = () => new WikiGitHubStorage({ botToken: 'token', botLogin: BOT, owner: OWNER, repo: REPO, version: 'v1' });
const recordIssue = (number, items, extra = {}) =>
  github.issue(number, { title: `[Skill Build] ${USERNAME}`, body: JSON.stringify(items), labels: RECORD_LABELS, ...extra });
const itemsOf = (number) => JSON.parse(github.state.issues.find((issue) => issue.number === number).body);
const open = () => github.state.issues.filter((issue) => issue.state === 'open').map((issue) => issue.number);

describe('WikiGitHubStorage', () => {
  beforeEach(() => {
    github.reset();
  });

  describe('load', () => {
    it('returns the items stored in the user\'s record issue', async () => {
      github.state.issues.push(recordIssue(10, [{ id: 'a' }, { id: 'b' }]));

      expect(await storage().load(TYPE, USER_ID)).toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('returns an empty list, and creates nothing, when the user has no record', async () => {
      expect(await storage().load(TYPE, USER_ID)).toEqual([]);
      expect(github.state.issues).toHaveLength(0);
    });

    it('reads the oldest record when duplicates exist, folding the newer one into it and closing it', async () => {
      github.state.issues.push(
        recordIssue(20, [{ id: 'b', name: 'from newer' }]),
        recordIssue(10, [{ id: 'a', name: 'from older' }])
      );

      const items = await storage().load(TYPE, USER_ID);

      expect(items.map((item) => item.id)).toEqual(['a', 'b']);
      expect(open()).toEqual([10]);
    });

    it('never closes a duplicate that the bot did not author', async () => {
      github.state.issues.push(
        recordIssue(10, [{ id: 'a' }]),
        recordIssue(20, [{ id: 'b' }], { login: 'someone-else' })
      );

      await storage().load(TYPE, USER_ID);

      expect(open()).toEqual([10, 20]);
    });
  });

  describe('save', () => {
    it('updates the existing record with the wiki title and full label set', async () => {
      github.state.issues.push(recordIssue(10, [{ id: 'a', name: 'old' }], { labels: [TYPE, `user-id:${USER_ID}`] }));

      const items = await storage().save(TYPE, USERNAME, USER_ID, { id: 'a', name: 'new' });

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: 'a', name: 'new' });
      const issue = github.state.issues.find((entry) => entry.number === 10);
      expect(issue.title).toBe(`[Skill Build] ${USERNAME}`);
      expect(issue.labels.map((label) => label.name)).toEqual(RECORD_LABELS);
      expect(github.state.issues).toHaveLength(1);
    });

    it('creates the record only once both backends confirm it is absent', async () => {
      const items = await storage().save(TYPE, USERNAME, USER_ID, { id: 'a', name: 'first' });

      expect(items).toHaveLength(1);
      expect(github.state.issues).toHaveLength(1);
      expect(github.state.issues[0].labels.map((label) => label.name)).toEqual(RECORD_LABELS);
      expect(github.state.issues[0].title).toBe(`[Skill Build] ${USERNAME}`);
    });

    it('refuses to create when absence cannot be confirmed, surfacing the retryable code', async () => {
      github.state.failRest = true;

      await expect(storage().save(TYPE, USERNAME, USER_ID, { id: 'a' })).rejects.toMatchObject({ code: ABSENCE_UNCONFIRMED });
      expect(github.state.issues).toHaveLength(0);
    });

    it('folds its items into a record that a concurrent save created first', async () => {
      // A rival save lands a lower-numbered record between our lookup and our create
      github.state.onCreate = () => {
        github.state.issues.push(recordIssue(999, [{ id: 'rival' }]));
        github.state.onCreate = null;
      };

      const items = await storage().save(TYPE, USERNAME, USER_ID, { id: 'mine' });

      expect(items.map((item) => item.id).sort()).toEqual(['mine', 'rival']);
      expect(open()).toEqual([999]);
      expect(itemsOf(999).map((item) => item.id).sort()).toEqual(['mine', 'rival']);
    });

    it('rejects items without an id', async () => {
      await expect(storage().save(TYPE, USERNAME, USER_ID, { name: 'no id' })).rejects.toThrow('Item must have an id field');
    });
  });

  describe('delete', () => {
    it('removes the item and rewrites the record', async () => {
      github.state.issues.push(recordIssue(10, [{ id: 'a' }, { id: 'b' }]));

      const items = await storage().delete(TYPE, USERNAME, USER_ID, 'a');

      expect(items).toEqual([{ id: 'b' }]);
      expect(itemsOf(10)).toEqual([{ id: 'b' }]);
    });

    it('closes the record once the last item is gone', async () => {
      github.state.issues.push(recordIssue(10, [{ id: 'a' }]));

      const items = await storage().delete(TYPE, USERNAME, USER_ID, 'a');

      expect(items).toEqual([]);
      expect(open()).toEqual([]);
    });

    it('fails clearly when the item or the record does not exist', async () => {
      await expect(storage().delete(TYPE, USERNAME, USER_ID, 'a')).rejects.toThrow('Issue not found');

      github.state.issues.push(recordIssue(10, [{ id: 'a' }]));
      await expect(storage().delete(TYPE, USERNAME, USER_ID, 'zzz')).rejects.toThrow('Item not found');
    });
  });

  describe('grid submissions', () => {
    const WEAPON = 'soul-weapon-57';
    const GRID_LABELS = [`weapon-id:${WEAPON}`, 'data-version:v1', 'soul-weapon-grids'];
    const gridIssue = (number) => github.issue(number, { title: `[Soul Weapon Grid] soul-weapon-${WEAPON}`, labels: GRID_LABELS });

    it('returns the parsed submissions stored as comments on the weapon\'s issue', async () => {
      github.state.issues.push(gridIssue(30));
      github.state.issueComments[30] = [
        { id: 1, body: JSON.stringify({ id: 'g1', userId: 42 }) },
        { id: 2, body: 'not json' },
      ];

      expect(await storage().loadGridSubmissions(WEAPON)).toEqual([{ id: 'g1', userId: 42 }]);
    });

    it('returns an empty list, and creates nothing, when the weapon has no issue', async () => {
      expect(await storage().loadGridSubmissions(WEAPON)).toEqual([]);
      expect(github.state.issues).toHaveLength(0);
    });

    it('creates the weapon issue once absence is confirmed, then stores the submission as a comment', async () => {
      const saved = await storage().saveGridSubmission(USERNAME, USER_ID, WEAPON, { id: 'g1', cells: [] });

      expect(saved).toMatchObject({ id: 'g1', username: USERNAME, userId: USER_ID, entityId: WEAPON });
      expect(github.state.issues).toHaveLength(1);
      expect(github.state.issues[0].labels.map((label) => label.name)).toEqual(GRID_LABELS);
      expect(github.state.issueComments[1000]).toHaveLength(1);
    });

    it('updates the user\'s existing comment instead of adding another', async () => {
      github.state.issues.push(gridIssue(30));
      github.state.issueComments[30] = [{ id: 7, body: JSON.stringify({ id: 'g1', userId: USER_ID, cells: ['old'] }) }];

      await storage().saveGridSubmission(USERNAME, USER_ID, WEAPON, { id: 'g1', cells: ['new'] });

      expect(github.state.issueComments[30]).toHaveLength(1);
      expect(JSON.parse(github.state.issueComments[30][0].body).cells).toEqual(['new']);
    });
  });
});
