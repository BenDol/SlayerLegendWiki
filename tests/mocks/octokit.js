/**
 * Octokit Mock
 * Mock implementation of Octokit REST API for testing
 */

import { vi } from 'vitest';
import { mockIssue, mockComment, mockPullRequest } from '../fixtures/testData.js';

export function createMockOctokit(overrides = {}) {
  const mockOctokit = {
    rest: {
      issues: {
        create: vi.fn().mockResolvedValue({ data: mockIssue }),
        update: vi.fn().mockResolvedValue({ data: mockIssue }),
        createComment: vi.fn().mockResolvedValue({ data: mockComment }),
        getComment: vi.fn().mockResolvedValue({ data: mockComment }),
        listForRepo: vi.fn().mockResolvedValue({ data: [mockIssue] }),
        addLabels: vi.fn().mockResolvedValue({ data: mockIssue }),
        lock: vi.fn().mockResolvedValue({ data: {} }),
        ...overrides.issues
      },
      pulls: {
        create: vi.fn().mockResolvedValue({ data: mockPullRequest }),
        ...overrides.pulls
      },
      repos: {
        get: vi.fn().mockResolvedValue({
          data: {
            owner: { login: 'test-owner' },
            name: 'test-repo'
          }
        }),
        getContent: vi.fn().mockResolvedValue({
          data: {
            sha: 'test-file-sha-123',
            content: Buffer.from('# Test Content').toString('base64')
          }
        }),
        createOrUpdateFileContents: vi.fn().mockResolvedValue({
          data: {
            content: {
              sha: 'test-new-sha-456'
            }
          }
        }),
        getBranch: vi.fn().mockResolvedValue({
          data: {
            commit: { sha: 'test-commit-sha-789' }
          }
        }),
        getCollaboratorPermissionLevel: vi.fn().mockResolvedValue({
          data: { permission: 'admin' }
        }),
        ...overrides.repos
      },
      git: {
        createRef: vi.fn().mockResolvedValue({
          data: { ref: 'refs/heads/test-branch' }
        }),
        ...overrides.git
      },
      users: {
        getAuthenticated: vi.fn().mockResolvedValue({
          data: {
            login: 'testuser',
            id: 12345,
            email: 'test@example.com'
          }
        }),
        ...overrides.users
      }
    }
  };

  return mockOctokit;
}

export function createFailingOctokit(error = new Error('API Error')) {
  return {
    rest: {
      issues: {
        create: vi.fn().mockRejectedValue(error),
        update: vi.fn().mockRejectedValue(error),
        createComment: vi.fn().mockRejectedValue(error),
        getComment: vi.fn().mockRejectedValue(error),
        listForRepo: vi.fn().mockRejectedValue(error),
        addLabels: vi.fn().mockRejectedValue(error),
        lock: vi.fn().mockRejectedValue(error)
      },
      pulls: {
        create: vi.fn().mockRejectedValue(error)
      },
      repos: {
        get: vi.fn().mockRejectedValue(error),
        getContent: vi.fn().mockRejectedValue(error),
        createOrUpdateFileContents: vi.fn().mockRejectedValue(error),
        getBranch: vi.fn().mockRejectedValue(error),
        getCollaboratorPermissionLevel: vi.fn().mockRejectedValue(error)
      },
      git: {
        createRef: vi.fn().mockRejectedValue(error)
      },
      users: {
        getAuthenticated: vi.fn().mockRejectedValue(error)
      }
    }
  };
}
