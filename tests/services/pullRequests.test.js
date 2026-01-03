/**
 * Pull Requests Service Tests
 * Tests for centralized PR fetching and isPRForUser utility
 */

import { describe, it, expect } from 'vitest';
import { isPRForUser } from '../../wiki-framework/src/services/github/pullRequests.js';

describe('isPRForUser', () => {
  const username = 'testuser';
  const userId = 12345;

  describe('Direct PR ownership', () => {
    it('should return true for direct PR by user', () => {
      const pr = {
        number: 101,
        user: { login: 'testuser', id: 12345 },
        labels: [],
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(true);
    });

    it('should return false for PR by different user', () => {
      const pr = {
        number: 102,
        user: { login: 'otheruser', id: 99999 },
        labels: [],
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(false);
    });
  });

  describe('Linked anonymous PR ownership', () => {
    it('should return true for PR with user-id label (string format)', () => {
      const pr = {
        number: 103,
        user: { login: 'wiki-bot', id: 88888 },
        labels: ['anonymous-edit', 'needs-review', `user-id:${userId}`],
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(true);
    });

    it('should return true for PR with user-id label (object format)', () => {
      const pr = {
        number: 104,
        user: { login: 'wiki-bot', id: 88888 },
        labels: [
          { name: 'anonymous-edit' },
          { name: 'needs-review' },
          { name: `user-id:${userId}` },
        ],
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(true);
    });

    it('should return false for anonymous PR without user-id label', () => {
      const pr = {
        number: 105,
        user: { login: 'wiki-bot', id: 88888 },
        labels: ['anonymous-edit', 'needs-review', 'ref:abcd1234'],
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(false);
    });

    it('should return false for anonymous PR with different user-id', () => {
      const pr = {
        number: 106,
        user: { login: 'wiki-bot', id: 88888 },
        labels: ['anonymous-edit', `user-id:99999`],
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(false);
    });
  });

  describe('Mixed label formats', () => {
    it('should handle mix of string and object labels', () => {
      const pr = {
        number: 107,
        user: { login: 'wiki-bot', id: 88888 },
        labels: [
          'anonymous-edit',
          { name: 'needs-review' },
          `user-id:${userId}`,
        ],
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should return false when PR has no labels', () => {
      const pr = {
        number: 108,
        user: { login: 'otheruser', id: 99999 },
        labels: [],
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(false);
    });

    it('should return false when PR labels is undefined', () => {
      const pr = {
        number: 109,
        user: { login: 'otheruser', id: 99999 },
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(false);
    });

    it('should return false when PR labels is null', () => {
      const pr = {
        number: 110,
        user: { login: 'otheruser', id: 99999 },
        labels: null,
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(false);
    });

    it('should handle both direct ownership AND user-id label (redundant but valid)', () => {
      const pr = {
        number: 111,
        user: { login: 'testuser', id: 12345 },
        labels: [`user-id:${userId}`],
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(true);
    });
  });

  describe('Label format variations', () => {
    it('should match exact user-id format only', () => {
      const pr = {
        number: 112,
        user: { login: 'wiki-bot', id: 88888 },
        labels: [
          'user-123', // Wrong format
          'user_id:123', // Wrong format
          'userid:123', // Wrong format
          `user-id:${userId}`, // Correct format
        ],
      };

      const result = isPRForUser(pr, username, userId);
      expect(result).toBe(true);
    });

    it('should not match partial user-id', () => {
      const pr = {
        number: 113,
        user: { login: 'wiki-bot', id: 88888 },
        labels: [`user-id:1234`], // userId is 12345, this is only 1234
      };

      const result = isPRForUser(pr, username, 12345);
      expect(result).toBe(false);
    });

    it('should not match user-id as substring', () => {
      const pr = {
        number: 114,
        user: { login: 'wiki-bot', id: 88888 },
        labels: [`user-id:123456`], // userId is 12345, this has extra digit
      };

      const result = isPRForUser(pr, username, 12345);
      expect(result).toBe(false);
    });
  });
});
