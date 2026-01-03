import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getUserLoadouts,
  saveUserLoadouts,
  addUserLoadout,
  updateUserLoadout,
  deleteUserLoadout
} from '../../src/services/battleLoadouts.js';

// Mock the framework dependencies
vi.mock('../../wiki-framework/src/services/github/api.js', () => ({
  getOctokit: vi.fn()
}));

vi.mock('../../wiki-framework/src/utils/githubLabelUtils.js', () => ({
  createUserIdLabel: vi.fn((userId) => `user-id:${userId}`)
}));

import { getOctokit } from '../../wiki-framework/src/services/github/api.js';

describe('battleLoadouts', () => {
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

  describe('getUserLoadouts', () => {
    it('should return empty array when no loadouts found', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: []
      });

      const loadouts = await getUserLoadouts('owner', 'repo', 'testuser', 12345);

      expect(loadouts).toEqual([]);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('No loadouts found for user: testuser')
      );
    });

    it('should find loadouts by user ID label (primary)', async () => {
      const mockIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify([
          { id: 'loadout-1', name: 'Test Loadout 1' },
          { id: 'loadout-2', name: 'Test Loadout 2' }
        ]),
        labels: [{ name: 'battle-loadouts' }, { name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [mockIssue]
      });

      const loadouts = await getUserLoadouts('owner', 'repo', 'testuser', 12345);

      expect(loadouts).toHaveLength(2);
      expect(loadouts[0].name).toBe('Test Loadout 1');
      expect(loadouts[1].name).toBe('Test Loadout 2');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Found loadouts for user testuser by ID: 12345')
      );
    });

    it('should find loadouts by username in title (fallback)', async () => {
      const mockIssue = {
        number: 2,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify([{ id: 'loadout-1', name: 'Legacy Loadout' }]),
        labels: [{ name: 'battle-loadouts' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [mockIssue]
      });

      const loadouts = await getUserLoadouts('owner', 'repo', 'testuser', null);

      expect(loadouts).toHaveLength(1);
      expect(loadouts[0].name).toBe('Legacy Loadout');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Found legacy loadouts for testuser by title')
      );
    });

    it('should handle string labels from GitHub API', async () => {
      const mockIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify([{ id: 'loadout-1', name: 'Test' }]),
        labels: ['battle-loadouts', 'user-id:12345'] // String format
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [mockIssue]
      });

      const loadouts = await getUserLoadouts('owner', 'repo', 'testuser', 12345);

      expect(loadouts).toHaveLength(1);
    });

    it('should return empty array on parse error', async () => {
      const mockIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: 'invalid json',
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [mockIssue]
      });

      const loadouts = await getUserLoadouts('owner', 'repo', 'testuser', 12345);

      expect(loadouts).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse loadouts data'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should return empty array on API error', async () => {
      mockOctokit.rest.issues.listForRepo.mockRejectedValue(
        new Error('API Error')
      );

      const loadouts = await getUserLoadouts('owner', 'repo', 'testuser', 12345);

      expect(loadouts).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get loadouts'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should handle empty issue body', async () => {
      const mockIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: '',
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [mockIssue]
      });

      const loadouts = await getUserLoadouts('owner', 'repo', 'testuser', 12345);

      expect(loadouts).toEqual([]);
    });

    it('should prioritize user ID over username', async () => {
      const mockIssues = [
        {
          number: 1,
          title: '[Battle Loadout] testuser',
          body: JSON.stringify([{ id: 'old', name: 'Legacy' }]),
          labels: [{ name: 'battle-loadouts' }]
        },
        {
          number: 2,
          title: '[Battle Loadout] testuser',
          body: JSON.stringify([{ id: 'new', name: 'Current' }]),
          labels: [{ name: 'battle-loadouts' }, { name: 'user-id:12345' }]
        }
      ];

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: mockIssues
      });

      const loadouts = await getUserLoadouts('owner', 'repo', 'testuser', 12345);

      expect(loadouts[0].id).toBe('new'); // Should get the one with user-id label
    });
  });

  describe('saveUserLoadouts', () => {
    it('should create new loadouts issue when none exists', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: {
          number: 123,
          title: '[Battle Loadout] testuser',
          body: JSON.stringify([{ id: 'loadout-1', name: 'New Loadout' }])
        }
      });
      mockOctokit.rest.issues.lock.mockResolvedValue({});

      const loadouts = [{ id: 'loadout-1', name: 'New Loadout' }];
      const result = await saveUserLoadouts('owner', 'repo', 'testuser', 12345, loadouts);

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: '[Battle Loadout] testuser',
        body: JSON.stringify(loadouts, null, 2),
        labels: ['battle-loadouts', 'user-id:12345']
      });

      expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        lock_reason: 'off-topic'
      });

      expect(result.number).toBe(123);
    });

    it('should update existing loadouts issue', async () => {
      const existingIssue = {
        number: 456,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify([{ id: 'old', name: 'Old Loadout' }]),
        labels: [{ name: 'battle-loadouts' }, { name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });

      mockOctokit.rest.issues.update.mockResolvedValue({
        data: { ...existingIssue, body: JSON.stringify([{ id: 'new', name: 'New Loadout' }]) }
      });

      const loadouts = [{ id: 'new', name: 'New Loadout' }];
      const result = await saveUserLoadouts('owner', 'repo', 'testuser', 12345, loadouts);

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 456,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify(loadouts, null, 2)
      });

      expect(mockOctokit.rest.issues.lock).not.toHaveBeenCalled();
    });

    it('should add user-id label to legacy issues', async () => {
      const legacyIssue = {
        number: 789,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify([{ id: 'loadout-1', name: 'Loadout' }]),
        labels: [{ name: 'battle-loadouts' }] // No user-id label
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [legacyIssue]
      });

      mockOctokit.rest.issues.update.mockResolvedValue({ data: legacyIssue });
      mockOctokit.rest.issues.addLabels.mockResolvedValue({});

      const loadouts = [{ id: 'loadout-1', name: 'Loadout' }];
      await saveUserLoadouts('owner', 'repo', 'testuser', 12345, loadouts);

      expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 789,
        labels: ['user-id:12345']
      });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Adding user-id label to legacy loadouts')
      );
    });

    it('should reject non-array loadouts', async () => {
      await expect(
        saveUserLoadouts('owner', 'repo', 'testuser', 12345, 'not-an-array')
      ).rejects.toThrow('Loadouts must be an array');
    });

    it('should enforce max loadouts limit', async () => {
      const tooManyLoadouts = Array(11).fill({ id: 'loadout', name: 'Loadout' });

      await expect(
        saveUserLoadouts('owner', 'repo', 'testuser', 12345, tooManyLoadouts)
      ).rejects.toThrow('Maximum 10 loadouts allowed per user');
    });

    it('should handle lock failure gracefully', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 123, title: '[Battle Loadout] testuser' }
      });
      mockOctokit.rest.issues.lock.mockRejectedValue(new Error('Lock failed'));

      const loadouts = [{ id: 'loadout-1', name: 'Loadout' }];
      const result = await saveUserLoadouts('owner', 'repo', 'testuser', 12345, loadouts);

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

      const loadouts = [{ id: 'loadout-1', name: 'Loadout' }];
      await saveUserLoadouts('owner', 'repo', 'testuser', null, loadouts);

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: '[Battle Loadout] testuser',
        body: expect.any(String),
        labels: ['battle-loadouts'] // No user-id label
      });
    });

    it('should throw error on API failure', async () => {
      mockOctokit.rest.issues.listForRepo.mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        saveUserLoadouts('owner', 'repo', 'testuser', 12345, [])
      ).rejects.toThrow('API Error');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save loadouts'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('addUserLoadout', () => {
    beforeEach(() => {
      // Mock getUserLoadouts to return empty array
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 123 }
      });
      mockOctokit.rest.issues.lock.mockResolvedValue({});
    });

    it('should add loadout with generated ID and timestamps', async () => {
      const loadout = { name: 'My Loadout', skillBuild: {}, spirit: {} };
      const result = await addUserLoadout('owner', 'repo', 'testuser', 12345, loadout);

      expect(result).toHaveLength(1);
      expect(result[0].id).toMatch(/^loadout-\d+-[a-z0-9]+$/);
      expect(result[0].createdAt).toBeDefined();
      expect(result[0].updatedAt).toBeDefined();
      expect(result[0].name).toBe('My Loadout');
    });

    it('should preserve provided ID', async () => {
      const loadout = { id: 'custom-id', name: 'My Loadout', skillBuild: {} };
      const result = await addUserLoadout('owner', 'repo', 'testuser', 12345, loadout);

      expect(result[0].id).toBe('custom-id');
    });

    it('should enforce max loadouts limit', async () => {
      const existingLoadouts = Array(10).fill(null).map((_, i) => ({
        id: `loadout-${i}`,
        name: `Loadout ${i}`
      }));

      const existingIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify(existingLoadouts),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });

      const newLoadout = { name: 'Loadout 11' };

      await expect(
        addUserLoadout('owner', 'repo', 'testuser', 12345, newLoadout)
      ).rejects.toThrow('Maximum 10 loadouts allowed');
    });

    it('should log loadout addition', async () => {
      const loadout = { name: 'My Loadout', skillBuild: {} };
      await addUserLoadout('owner', 'repo', 'testuser', 12345, loadout);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Added loadout "My Loadout" for testuser')
      );
    });
  });

  describe('updateUserLoadout', () => {
    it('should update existing loadout', async () => {
      const existingLoadouts = [
        { id: 'loadout-1', name: 'Old Name', createdAt: '2024-01-01T00:00:00Z' }
      ];

      const existingIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify(existingLoadouts),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: existingIssue });

      const updatedLoadout = { name: 'New Name', skillBuild: {} };
      const result = await updateUserLoadout('owner', 'repo', 'testuser', 12345, 'loadout-1', updatedLoadout);

      expect(result[0].name).toBe('New Name');
      expect(result[0].id).toBe('loadout-1');
      expect(result[0].createdAt).toBe('2024-01-01T00:00:00Z'); // Preserved
      expect(result[0].updatedAt).toBeDefined(); // Updated
      expect(result[0].updatedAt).not.toBe('2024-01-01T00:00:00Z');
    });

    it('should throw error for non-existent loadout', async () => {
      const existingLoadouts = [{ id: 'loadout-1', name: 'Loadout 1' }];

      const existingIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify(existingLoadouts),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });

      await expect(
        updateUserLoadout('owner', 'repo', 'testuser', 12345, 'non-existent', { name: 'Updated' })
      ).rejects.toThrow('Loadout with ID non-existent not found');
    });

    it('should create createdAt if missing', async () => {
      const existingLoadouts = [
        { id: 'loadout-1', name: 'Old Name' } // No createdAt
      ];

      const existingIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify(existingLoadouts),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: existingIssue });

      const result = await updateUserLoadout('owner', 'repo', 'testuser', 12345, 'loadout-1', { name: 'New' });

      expect(result[0].createdAt).toBeDefined();
    });

    it('should log loadout update', async () => {
      const existingLoadouts = [{ id: 'loadout-1', name: 'Old' }];
      const existingIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify(existingLoadouts),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: existingIssue });

      await updateUserLoadout('owner', 'repo', 'testuser', 12345, 'loadout-1', { name: 'New' });

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Updated loadout "New" for testuser')
      );
    });
  });

  describe('deleteUserLoadout', () => {
    it('should delete existing loadout', async () => {
      const existingLoadouts = [
        { id: 'loadout-1', name: 'Loadout 1' },
        { id: 'loadout-2', name: 'Loadout 2' }
      ];

      const existingIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify(existingLoadouts),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: existingIssue });

      const result = await deleteUserLoadout('owner', 'repo', 'testuser', 12345, 'loadout-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('loadout-2');
      expect(result.find(l => l.id === 'loadout-1')).toBeUndefined();
    });

    it('should throw error for non-existent loadout', async () => {
      const existingLoadouts = [{ id: 'loadout-1', name: 'Loadout 1' }];

      const existingIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify(existingLoadouts),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });

      await expect(
        deleteUserLoadout('owner', 'repo', 'testuser', 12345, 'non-existent')
      ).rejects.toThrow('Loadout with ID non-existent not found');
    });

    it('should log loadout deletion', async () => {
      const existingLoadouts = [{ id: 'loadout-1', name: 'Loadout 1' }];
      const existingIssue = {
        number: 1,
        title: '[Battle Loadout] testuser',
        body: JSON.stringify(existingLoadouts),
        labels: [{ name: 'user-id:12345' }]
      };

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [existingIssue]
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: existingIssue });

      await deleteUserLoadout('owner', 'repo', 'testuser', 12345, 'loadout-1');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Deleted loadout loadout-1 for testuser')
      );
    });
  });
});
