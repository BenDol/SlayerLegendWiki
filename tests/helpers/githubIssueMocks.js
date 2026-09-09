/**
 * GitHub Issue Mock Helpers
 *
 * The issue lookup module (src/services/github/issueLookup.js) reads through
 * GraphQL first and uses the REST list as a cross-check. These helpers let a
 * REST-only mock Octokit answer GraphQL with the same fixtures, so tests keep
 * describing repository state once, through `issues.listForRepo`.
 */

import { vi } from 'vitest';

/**
 * Convert a REST-shaped issue fixture into the GraphQL node shape the lookup
 * module queries for.
 * @param {Object} issue
 * @returns {Object}
 */
export function toGraphQlIssueNode(issue) {
  const labels = (issue.labels ?? []).map((label) => ({
    name: typeof label === 'string' ? label : label?.name,
  }));

  return {
    id: issue.node_id ?? `I_${issue.number}`,
    number: issue.number,
    title: issue.title ?? '',
    body: issue.body ?? '',
    state: String(issue.state ?? 'open').toUpperCase(),
    stateReason: null,
    locked: Boolean(issue.locked),
    url: issue.html_url ?? `https://github.com/test-owner/test-repo/issues/${issue.number}`,
    createdAt: issue.created_at ?? '2026-01-01T00:00:00Z',
    updatedAt: issue.updated_at ?? '2026-01-01T00:00:00Z',
    closedAt: null,
    author: { login: issue.user?.login ?? 'test-user' },
    labels: { nodes: labels },
    comments: { totalCount: issue.comments ?? 0 },
  };
}

/**
 * Build a single-page GraphQL `repository.issues` response from fixtures.
 * @param {Object[]} issues
 * @returns {Object}
 */
export function graphQlIssuesPage(issues) {
  return {
    repository: {
      issues: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: issues.map(toGraphQlIssueNode),
      },
    },
  };
}

/**
 * Give a REST-only mock Octokit a `graphql` endpoint that mirrors whatever
 * `rest.issues.listForRepo` currently resolves to (or rejects with).
 * @param {Object} mockOctokit
 * @returns {Object} The same mock, for chaining
 */
export function mirrorListForRepoAsGraphql(mockOctokit) {
  mockOctokit.graphql = vi.fn(async () => {
    const { data } = await mockOctokit.rest.issues.listForRepo();
    return graphQlIssuesPage(data ?? []);
  });
  return mockOctokit;
}
