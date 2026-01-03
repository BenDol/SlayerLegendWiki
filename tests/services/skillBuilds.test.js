import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getUserBuilds,
  saveUserBuilds,
  addUserBuild,
  updateUserBuild,
  deleteUserBuild
} from '../../src/services/skillBuilds.js';

// Mock the framework dependencies
vi.mock('../../wiki-framework/src/services/github/api.js', () => ({
  getOctokit: vi.fn()
}));

vi.mock('../../wiki-framework/src/utils/githubLabelUtils.js', () => ({
  createUserIdLabel: vi.fn((userId) => `user-id:${userId}`)
}));

import { getOctokit } from '../../wiki-framework/src/services/github/api.js';

describe('skillBuilds', () => {
  let mockOctokit;
  let consoleSpy;

  beforeEach(() => {
    // Mock Octokit instance
    mockOctokit = {
      rest: {
        issues: {
          listForRepo: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          addLabels: vi.fn(),
          lock: vi.fn()
        }
      }
    };

    getOctokit.mockReturnValue(mockOctokit);

    // Spy on console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleSpy.log.mockRestore();
    consoleSpy.info.mockRestore();
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
  });

  describe('getUserBuilds', () => {
    it('should return empty array when no builds found', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: []
      });

      const builds = await getUserBuilds('owner', 'repo', 'testuser', 12345);

      expect(builds).toEqual([]);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('No builds found for user: testuser')
      );
    });

    it('should find builds by user ID label (primary)', async () => {
      const mockIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: JSON.stringify([
          { id: 'build-1', name: 'Test Build 1' },
          { id: 'build-2', name: 'Test Build 2' }
        ]),
        labels: [{ name: 'skill-builds' }, { name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [mockIssue]
      });

      const builds = await getUserBuilds('owner', 'repo', 'testuser', 12345);

      expect(builds).toHaveLength(2);
      expect(builds[0].name).toBe('Test Build 1');
      expect(builds[1].name).toBe('Test Build 2');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Found builds for user testuser by ID: 12345')
      );
    });

    it('should find builds by username in title (fallback)', async () => {
      const mockIssue = {
        number: 2,
        title: '[Skill Build] testuser',
        body: JSON.stringify([{ id: 'build-1', name: 'Legacy Build' }]),
        labels: [{ name: 'skill-builds' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [mockIssue]
      });

      const builds = await getUserBuilds('owner', 'repo', 'testuser', null);

      expect(builds).toHaveLength(1);
      expect(builds[0].name).toBe('Legacy Build');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Found legacy builds for testuser by title')
      );
    });

    it('should handle string labels from GitHub API', async () => {
      const mockIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: JSON.stringify([{ id: 'build-1', name: 'Test' }]),
        labels: ['skill-builds', 'user-id:12345'] // String format
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [mockIssue]
      });

      const builds = await getUserBuilds('owner', 'repo', 'testuser', 12345);

      expect(builds).toHaveLength(1);
    });

    it('should return empty array on parse error', async () => {
      const mockIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: 'invalid json',
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [mockIssue]
      });

      const builds = await getUserBuilds('owner', 'repo', 'testuser', 12345);

      expect(builds).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse builds data'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should return empty array on API error', async () => {
      mockOctokit.rest.issues.listForRepo.mockRejectedValue(
        new Error('API Error')
      );

      const builds = await getUserBuilds('owner', 'repo', 'testuser', 12345);

      expect(builds).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get builds'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should handle empty issue body', async () => {
      const mockIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: '',
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [mockIssue]
      });

      const builds = await getUserBuilds('owner', 'repo', 'testuser', 12345);

      expect(builds).toEqual([]);
    });

    it('should prioritize user ID over username', async () => {
      const mockIssues = [
        {
          number: 1,
          title: '[Skill Build] testuser',
          body: JSON.stringify([{ id: 'old', name: 'Legacy' }]),
          labels: [{ name: 'skill-builds' }]
        },
        {
          number: 2,
          title: '[Skill Build] testuser',
          body: JSON.stringify([{ id: 'new', name: 'Current' }]),
          labels: [{ name: 'skill-builds' }, { name: 'user-id:12345' }]
        }
      ];

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: mockIssues
      });

      const builds = await getUserBuilds('owner', 'repo', 'testuser', 12345);

      expect(builds[0].id).toBe('new'); // Should get the one with user-id label
    });
  });

  describe('saveUserBuilds', () => {
    it('should create new builds issue when none exists', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: {
          number: 123,
          title: '[Skill Build] testuser',
          body: JSON.stringify([{ id: 'build-1', name: 'New Build' }])
        }
      });
      mockOctokit.rest.issues.lock.mockResolvedValue({});

      const builds = [{ id: 'build-1', name: 'New Build' }];
      const result = await saveUserBuilds('owner', 'repo', 'testuser', 12345, builds);

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: '[Skill Build] testuser',
        body: JSON.stringify(builds, null, 2),
        labels: ['skill-builds', 'user-id:12345']
      });

      expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        lock_reason: 'off-topic'
      });

      expect(result.number).toBe(123);
    });

    it('should update existing builds issue', async () => {
      const existingIssue = {
        number: 456,
        title: '[Skill Build] testuser',
        body: JSON.stringify([{ id: 'old', name: 'Old Build' }]),
        labels: [{ name: 'skill-builds' }, { name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });

      mockOctokit.rest.issues.update.mockResolvedValue({
        data: { ...existingIssue, body: JSON.stringify([{ id: 'new', name: 'New Build' }]) }
      });

      const builds = [{ id: 'new', name: 'New Build' }];
      const result = await saveUserBuilds('owner', 'repo', 'testuser', 12345, builds);

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 456,
        title: '[Skill Build] testuser',
        body: JSON.stringify(builds, null, 2)
      });

      expect(mockOctokit.rest.issues.lock).not.toHaveBeenCalled();
    });

    it('should add user-id label to legacy issues', async () => {
      const legacyIssue = {
        number: 789,
        title: '[Skill Build] testuser',
        body: JSON.stringify([{ id: 'build-1', name: 'Build' }]),
        labels: [{ name: 'skill-builds' }] // No user-id label
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [legacyIssue]
      });

      mockOctokit.rest.issues.update.mockResolvedValue({ data: legacyIssue });
      mockOctokit.rest.issues.addLabels.mockResolvedValue({});

      const builds = [{ id: 'build-1', name: 'Build' }];
      await saveUserBuilds('owner', 'repo', 'testuser', 12345, builds);

      expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 789,
        labels: ['user-id:12345']
      });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Adding user-id label to legacy builds')
      );
    });

    it('should reject non-array builds', async () => {
      await expect(
        saveUserBuilds('owner', 'repo', 'testuser', 12345, 'not-an-array')
      ).rejects.toThrow('Builds must be an array');
    });

    it('should enforce max builds limit', async () => {
      const tooManyBuilds = Array(11).fill({ id: 'build', name: 'Build' });

      await expect(
        saveUserBuilds('owner', 'repo', 'testuser', 12345, tooManyBuilds)
      ).rejects.toThrow('Maximum 10 builds allowed per user');
    });

    it('should handle lock failure gracefully', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 123, title: '[Skill Build] testuser' }
      });
      mockOctokit.rest.issues.lock.mockRejectedValue(new Error('Lock failed'));

      const builds = [{ id: 'build-1', name: 'Build' }];
      const result = await saveUserBuilds('owner', 'repo', 'testuser', 12345, builds);

      expect(result.number).toBe(123);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to lock issue'),
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('should create without user-id label when userId is null', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 123 }
      });
      mockOctokit.rest.issues.lock.mockResolvedValue({});

      const builds = [{ id: 'build-1', name: 'Build' }];
      await saveUserBuilds('owner', 'repo', 'testuser', null, builds);

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: '[Skill Build] testuser',
        body: expect.any(String),
        labels: ['skill-builds'] // No user-id label
      });
    });

    it('should throw error on API failure', async () => {
      mockOctokit.rest.issues.listForRepo.mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        saveUserBuilds('owner', 'repo', 'testuser', 12345, [])
      ).rejects.toThrow('API Error');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save builds'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('addUserBuild', () => {
    beforeEach(() => {
      // Mock getUserBuilds to return empty array
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 123 }
      });
      mockOctokit.rest.issues.lock.mockResolvedValue({});
    });

    it('should add build with generated ID and timestamps', async () => {
      const build = { name: 'My Build', slots: [] };
      const result = await addUserBuild('owner', 'repo', 'testuser', 12345, build);

      expect(result).toHaveLength(1);
      expect(result[0].id).toMatch(/^build-\d+-[a-z0-9]+$/);
      expect(result[0].createdAt).toBeDefined();
      expect(result[0].updatedAt).toBeDefined();
      expect(result[0].name).toBe('My Build');
    });

    it('should preserve provided ID', async () => {
      const build = { id: 'custom-id', name: 'My Build', slots: [] };
      const result = await addUserBuild('owner', 'repo', 'testuser', 12345, build);

      expect(result[0].id).toBe('custom-id');
    });

    it('should enforce max builds limit', async () => {
      const existingBuilds = Array(10).fill(null).map((_, i) => ({
        id: `build-${i}`,
        name: `Build ${i}`
      }));

      const existingIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: JSON.stringify(existingBuilds),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });

      const newBuild = { name: 'Build 11' };

      await expect(
        addUserBuild('owner', 'repo', 'testuser', 12345, newBuild)
      ).rejects.toThrow('Maximum 10 builds allowed');
    });

    it('should log build addition', async () => {
      const build = { name: 'My Build', slots: [] };
      await addUserBuild('owner', 'repo', 'testuser', 12345, build);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Added build "My Build" for testuser')
      );
    });
  });

  describe('updateUserBuild', () => {
    it('should update existing build', async () => {
      const existingBuilds = [
        { id: 'build-1', name: 'Old Name', createdAt: '2024-01-01T00:00:00Z' }
      ];

      const existingIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: JSON.stringify(existingBuilds),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: existingIssue });

      const updatedBuild = { name: 'New Name', slots: [] };
      const result = await updateUserBuild('owner', 'repo', 'testuser', 12345, 'build-1', updatedBuild);

      expect(result[0].name).toBe('New Name');
      expect(result[0].id).toBe('build-1');
      expect(result[0].createdAt).toBe('2024-01-01T00:00:00Z'); // Preserved
      expect(result[0].updatedAt).toBeDefined(); // Updated
      expect(result[0].updatedAt).not.toBe('2024-01-01T00:00:00Z');
    });

    it('should throw error for non-existent build', async () => {
      const existingBuilds = [{ id: 'build-1', name: 'Build 1' }];

      const existingIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: JSON.stringify(existingBuilds),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });

      await expect(
        updateUserBuild('owner', 'repo', 'testuser', 12345, 'non-existent', { name: 'Updated' })
      ).rejects.toThrow('Build with ID non-existent not found');
    });

    it('should create createdAt if missing', async () => {
      const existingBuilds = [
        { id: 'build-1', name: 'Old Name' } // No createdAt
      ];

      const existingIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: JSON.stringify(existingBuilds),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: existingIssue });

      const result = await updateUserBuild('owner', 'repo', 'testuser', 12345, 'build-1', { name: 'New' });

      expect(result[0].createdAt).toBeDefined();
    });

    it('should log build update', async () => {
      const existingBuilds = [{ id: 'build-1', name: 'Old' }];
      const existingIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: JSON.stringify(existingBuilds),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: existingIssue });

      await updateUserBuild('owner', 'repo', 'testuser', 12345, 'build-1', { name: 'New' });

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Updated build "New" for testuser')
      );
    });
  });

  describe('deleteUserBuild', () => {
    it('should delete existing build', async () => {
      const existingBuilds = [
        { id: 'build-1', name: 'Build 1' },
        { id: 'build-2', name: 'Build 2' }
      ];

      const existingIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: JSON.stringify(existingBuilds),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: existingIssue });

      const result = await deleteUserBuild('owner', 'repo', 'testuser', 12345, 'build-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('build-2');
      expect(result.find(b => b.id === 'build-1')).toBeUndefined();
    });

    it('should throw error for non-existent build', async () => {
      const existingBuilds = [{ id: 'build-1', name: 'Build 1' }];

      const existingIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: JSON.stringify(existingBuilds),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });

      await expect(
        deleteUserBuild('owner', 'repo', 'testuser', 12345, 'non-existent')
      ).rejects.toThrow('Build with ID non-existent not found');
    });

    it('should log build deletion', async () => {
      const existingBuilds = [{ id: 'build-1', name: 'Build 1' }];
      const existingIssue = {
        number: 1,
        title: '[Skill Build] testuser',
        body: JSON.stringify(existingBuilds),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: existingIssue });

      await deleteUserBuild('owner', 'repo', 'testuser', 12345, 'build-1');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Deleted build build-1 for testuser')
      );
    });
  });
});
