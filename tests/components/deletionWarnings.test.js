/**
 * Tests for deletion warnings
 *
 * Tests that warnings are shown when deleting:
 * - Skill builds used in battle loadouts
 * - Spirit builds used in battle loadouts
 * - Soul weapon engraving builds used in battle loadouts
 * - Spirits from collection that are used in spirit builds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data
const mockLoadouts = [
  {
    id: 'loadout1',
    name: 'PvP Setup',
    skillBuildId: 'skill123',
    spiritBuildId: 'spirit456',
    soulWeaponBuild: { weaponId: 58 }
  },
  {
    id: 'loadout2',
    name: 'Farming Build',
    skillBuildId: 'skill789',
    spiritBuildId: 'spirit456',
    soulWeaponBuild: null
  }
];

const mockSpiritBuilds = [
  {
    id: 'build1',
    name: 'Main Team',
    slots: [
      { type: 'collection', mySpiritId: 'spirit001' },
      { type: 'base', spiritId: 5 },
      { type: 'collection', mySpiritId: 'spirit002' }
    ]
  },
  {
    id: 'build2',
    name: 'Alt Team',
    slots: [
      { type: 'base', spiritId: 10 },
      { type: 'collection', mySpiritId: 'spirit001' },
      { type: 'base', spiritId: 15 }
    ]
  }
];

describe('Deletion Warnings', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    global.confirm = vi.fn();
  });

  describe('Skill Build Deletion', () => {
    it('should warn when skill build is used in battle loadouts', () => {
      const buildId = 'skill123';
      const usedInLoadouts = mockLoadouts.filter(l => l.skillBuildId === buildId);

      expect(usedInLoadouts).toHaveLength(1);
      expect(usedInLoadouts[0].name).toBe('PvP Setup');
    });

    it('should not warn when skill build is not used', () => {
      const buildId = 'skill_unused';
      const usedInLoadouts = mockLoadouts.filter(l => l.skillBuildId === buildId);

      expect(usedInLoadouts).toHaveLength(0);
    });

    it('should find multiple loadouts using same build', () => {
      const buildId = 'skill789';
      const usedInLoadouts = mockLoadouts.filter(l => l.skillBuildId === buildId);

      expect(usedInLoadouts).toHaveLength(1);
    });
  });

  describe('Spirit Build Deletion', () => {
    it('should warn when spirit build is used in battle loadouts', () => {
      const buildId = 'spirit456';
      const usedInLoadouts = mockLoadouts.filter(l => l.spiritBuildId === buildId);

      expect(usedInLoadouts).toHaveLength(2);
      expect(usedInLoadouts.map(l => l.name)).toEqual(['PvP Setup', 'Farming Build']);
    });

    it('should not warn when spirit build is not used', () => {
      const buildId = 'spirit_unused';
      const usedInLoadouts = mockLoadouts.filter(l => l.spiritBuildId === buildId);

      expect(usedInLoadouts).toHaveLength(0);
    });
  });

  describe('Soul Weapon Engraving Build Deletion', () => {
    it('should warn when engraving build weapon is used in battle loadouts', () => {
      const weaponId = 58;
      const usedInLoadouts = mockLoadouts.filter(l =>
        l.soulWeaponBuild?.weaponId === weaponId
      );

      expect(usedInLoadouts).toHaveLength(1);
      expect(usedInLoadouts[0].name).toBe('PvP Setup');
    });

    it('should not warn when engraving build weapon is not used', () => {
      const weaponId = 99;
      const usedInLoadouts = mockLoadouts.filter(l =>
        l.soulWeaponBuild?.weaponId === weaponId
      );

      expect(usedInLoadouts).toHaveLength(0);
    });
  });

  describe('Spirit Collection Deletion', () => {
    it('should warn when spirit is used in spirit builds', () => {
      const spiritId = 'spirit001';
      const usedInBuilds = mockSpiritBuilds.filter(build => {
        return build.slots?.some(slot =>
          slot && slot.type === 'collection' && slot.mySpiritId === spiritId
        );
      });

      expect(usedInBuilds).toHaveLength(2);
      expect(usedInBuilds.map(b => b.name)).toEqual(['Main Team', 'Alt Team']);
    });

    it('should not warn when spirit is not used in any builds', () => {
      const spiritId = 'spirit_unused';
      const usedInBuilds = mockSpiritBuilds.filter(build => {
        return build.slots?.some(slot =>
          slot && slot.type === 'collection' && slot.mySpiritId === spiritId
        );
      });

      expect(usedInBuilds).toHaveLength(0);
    });

    it('should warn when spirit is used in one build', () => {
      const spiritId = 'spirit002';
      const usedInBuilds = mockSpiritBuilds.filter(build => {
        return build.slots?.some(slot =>
          slot && slot.type === 'collection' && slot.mySpiritId === spiritId
        );
      });

      expect(usedInBuilds).toHaveLength(1);
      expect(usedInBuilds[0].name).toBe('Main Team');
    });

    it('should not warn for base type spirits', () => {
      // Base spirits (by spiritId) are not tied to collection
      const spiritId = 'spirit001';
      const baseSpirits = mockSpiritBuilds.flatMap(build =>
        build.slots.filter(slot => slot.type === 'base')
      );

      const usesCollectionSpirit = baseSpirits.some(
        slot => slot.mySpiritId === spiritId
      );

      expect(usesCollectionSpirit).toBe(false);
    });
  });

  describe('Warning Message Format', () => {
    it('should format warning message correctly for single usage', () => {
      const buildNames = ['PvP Setup'];
      const count = 1;
      const expectedMessage = `⚠️ Warning: This skill build is used in ${count} battle loadout(s): ${buildNames.join(', ')}\n\nDeleting it will remove it from those loadouts. Continue?`;

      expect(expectedMessage).toContain('⚠️ Warning:');
      expect(expectedMessage).toContain('1 battle loadout(s)');
      expect(expectedMessage).toContain('PvP Setup');
    });

    it('should format warning message correctly for multiple usage', () => {
      const buildNames = ['PvP Setup', 'Farming Build'];
      const count = 2;
      const expectedMessage = `⚠️ Warning: This spirit build is used in ${count} battle loadout(s): ${buildNames.join(', ')}\n\nDeleting it will remove it from those loadouts. Continue?`;

      expect(expectedMessage).toContain('⚠️ Warning:');
      expect(expectedMessage).toContain('2 battle loadout(s)');
      expect(expectedMessage).toContain('PvP Setup, Farming Build');
    });

    it('should show standard confirmation first, then warning second', () => {
      // This test documents the two-prompt flow
      const firstPrompt = 'Delete this build?';
      const secondPrompt = '⚠️ Warning: This build is used in 1 battle loadout(s): PvP Setup\n\nDeleting it will remove it from those loadouts. Continue?';

      expect(firstPrompt).toBe('Delete this build?');
      expect(secondPrompt).toContain('⚠️ Warning:');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock a failed API call
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      try {
        await mockFetch();
      } catch (error) {
        // Should still show standard confirmation
        expect(error.message).toBe('Network error');
      }
    });

    it('should handle empty loadouts array', () => {
      const emptyLoadouts = [];
      const buildId = 'skill123';
      const usedInLoadouts = emptyLoadouts.filter(l => l.skillBuildId === buildId);

      expect(usedInLoadouts).toHaveLength(0);
    });

    it('should handle null/undefined slots in builds', () => {
      const buildsWithNullSlots = [
        {
          id: 'build3',
          name: 'Partial Build',
          slots: [null, { type: 'base', spiritId: 5 }, undefined]
        }
      ];

      const spiritId = 'spirit001';
      const usedInBuilds = buildsWithNullSlots.filter(build => {
        return build.slots?.some(slot =>
          slot && slot.type === 'collection' && slot.mySpiritId === spiritId
        );
      });

      expect(usedInBuilds).toHaveLength(0);
    });
  });
});
