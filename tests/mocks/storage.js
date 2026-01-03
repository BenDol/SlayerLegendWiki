/**
 * Storage Mock
 * Mock implementation of WikiStorage for testing
 */

import { vi } from 'vitest';

export function createMockStorage(initialData = {}) {
  const storage = {
    // In-memory storage for testing
    data: {
      'skill-builds': initialData['skill-builds'] || {},
      'battle-loadouts': initialData['battle-loadouts'] || {},
      'my-spirits': initialData['my-spirits'] || {},
      'spirit-builds': initialData['spirit-builds'] || {},
      'engraving-builds': initialData['engraving-builds'] || {},
      'grid-submission': initialData['grid-submission'] || {},
      'email-verification': initialData['email-verification'] || {}
    },

    load: vi.fn(async function(type, userId) {
      const userKey = `${userId}`;
      return this.data[type]?.[userKey] || [];
    }),

    save: vi.fn(async function(type, username, userId, item) {
      const userKey = `${userId}`;
      if (!this.data[type]) this.data[type] = {};
      if (!this.data[type][userKey]) this.data[type][userKey] = [];

      // Find and update existing item, or add new one
      const items = this.data[type][userKey];
      const existingIndex = items.findIndex(i => i.id === item.id);

      if (existingIndex !== -1) {
        items[existingIndex] = item;
      } else {
        items.push(item);
      }

      return items;
    }),

    delete: vi.fn(async function(type, username, userId, itemId) {
      const userKey = `${userId}`;
      if (!this.data[type]?.[userKey]) return [];

      this.data[type][userKey] = this.data[type][userKey].filter(
        item => item.id !== itemId
      );

      return this.data[type][userKey];
    }),

    loadGridSubmissions: vi.fn(async function(weaponId) {
      return this.data['grid-submission']?.[weaponId] || [];
    }),

    saveGridSubmission: vi.fn(async function(username, userId, weaponId, submission) {
      if (!this.data['grid-submission']) this.data['grid-submission'] = {};
      if (!this.data['grid-submission'][weaponId]) {
        this.data['grid-submission'][weaponId] = [];
      }

      // Find and update existing submission, or add new one
      const submissions = this.data['grid-submission'][weaponId];
      const existingIndex = submissions.findIndex(s => s.id === submission.id);

      if (existingIndex !== -1) {
        submissions[existingIndex] = submission;
      } else {
        submissions.push(submission);
      }

      return submissions;
    })
  };

  return storage;
}

export function createFailingStorage(error = new Error('Storage Error')) {
  return {
    load: vi.fn().mockRejectedValue(error),
    save: vi.fn().mockRejectedValue(error),
    delete: vi.fn().mockRejectedValue(error),
    loadGridSubmissions: vi.fn().mockRejectedValue(error),
    saveGridSubmission: vi.fn().mockRejectedValue(error)
  };
}
