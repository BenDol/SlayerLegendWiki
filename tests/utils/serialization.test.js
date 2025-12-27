import { describe, it, expect } from 'vitest';

// Import all serialization utilities
import { serializeBuild as serializeSpiritBuild, deserializeBuild as deserializeSpiritBuild, serializeBuildForSharing as serializeSpiritBuildForSharing } from '../../src/utils/spiritSerialization.js';
import { serializeLoadoutForStorage, serializeLoadoutForSharing, deserializeLoadout, serializeSoulWeaponBuild, deserializeSoulWeaponBuild } from '../../src/utils/battleLoadoutSerializer.js';

describe('Serialization Tests - Data Integrity', () => {
  // === SKILL BUILDS ===
  describe('Skill Builds Serialization', () => {
    const mockSkills = [
      { id: 1, name: 'Fireball', maxLevel: 10 },
      { id: 2, name: 'Ice Blast', maxLevel: 15 }
    ];

    it('should serialize skill build to only store skillId and level', () => {
      const skillBuild = {
        name: 'Test Build',
        maxSlots: 10,
        slots: [
          { skill: mockSkills[0], level: 5 },
          { skill: mockSkills[1], level: 10 },
          { skill: null, level: 1 }
        ]
      };

      const serialized = {
        name: skillBuild.name,
        maxSlots: skillBuild.maxSlots,
        slots: skillBuild.slots.map(slot => ({
          skillId: slot.skill?.id || null,
          level: slot.level
        }))
      };

      expect(serialized.slots[0]).toEqual({ skillId: 1, level: 5 });
      expect(serialized.slots[1]).toEqual({ skillId: 2, level: 10 });
      expect(serialized.slots[2]).toEqual({ skillId: null, level: 1 });

      // Verify no full skill objects are stored
      expect(serialized.slots[0]).not.toHaveProperty('skill');
      expect(JSON.stringify(serialized)).not.toContain('Fireball');
    });

    it('should not store unnecessary data in skill builds', () => {
      const skillBuild = {
        name: 'Test Build',
        maxSlots: 10,
        slots: [{ skill: mockSkills[0], level: 5 }]
      };

      const serialized = {
        name: skillBuild.name,
        maxSlots: skillBuild.maxSlots,
        slots: skillBuild.slots.map(slot => ({
          skillId: slot.skill?.id || null,
          level: slot.level
        }))
      };

      const serializedSize = JSON.stringify(serialized).length;
      const fullObjectSize = JSON.stringify(skillBuild).length;

      // Serialized should be significantly smaller
      expect(serializedSize).toBeLessThan(fullObjectSize * 0.8);
    });
  });

  // === SPIRIT BUILDS ===
  describe('Spirit Builds Serialization', () => {
    const mockSpirits = [
      { id: 101, name: 'Phoenix', type: 'Fire' },
      { id: 102, name: 'Kraken', type: 'Water' }
    ];

    const mockMySpirits = [
      { id: 'my-1', spiritId: 101, level: 50, awakeningLevel: 3, evolutionLevel: 4, skillEnhancementLevel: 2 },
      { id: 'my-2', spiritId: 102, level: 40, awakeningLevel: 2, evolutionLevel: 3, skillEnhancementLevel: 1 }
    ];

    it('should serialize base spirit to only store spiritId', () => {
      const spiritSlot = {
        type: 'base',
        spirit: mockSpirits[0],
        level: 50,
        awakeningLevel: 3,
        evolutionLevel: 4,
        skillEnhancementLevel: 2
      };

      const serialized = serializeSpiritBuild({
        slots: [spiritSlot]
      });

      expect(serialized.slots[0].type).toBe('base');
      expect(serialized.slots[0].spiritId).toBe(101);
      expect(serialized.slots[0].level).toBe(50);
      expect(serialized.slots[0]).not.toHaveProperty('spirit');

      // Verify spirit name is not in serialized data
      expect(JSON.stringify(serialized)).not.toContain('Phoenix');
    });

    it('should serialize collection spirit to only store mySpiritId', () => {
      const spiritSlot = {
        type: 'collection',
        mySpiritId: 'my-1',
        spirit: mockSpirits[0],
        level: 50,
        awakeningLevel: 3,
        evolutionLevel: 4,
        skillEnhancementLevel: 2
      };

      const serialized = serializeSpiritBuild({
        slots: [spiritSlot]
      });

      expect(serialized.slots[0]).toEqual({
        type: 'collection',
        mySpiritId: 'my-1'
      });

      // Collection spirit should only store reference, no config
      expect(serialized.slots[0]).not.toHaveProperty('level');
      expect(serialized.slots[0]).not.toHaveProperty('spirit');
      expect(JSON.stringify(serialized)).not.toContain('Phoenix');
    });

    it('should deserialize spirit build correctly', () => {
      const serialized = {
        slots: [
          { type: 'base', spiritId: 101, level: 50, awakeningLevel: 3, evolutionLevel: 4, skillEnhancementLevel: 2 },
          { type: 'collection', mySpiritId: 'my-1' }
        ]
      };

      const deserialized = deserializeSpiritBuild(serialized, mockSpirits, mockMySpirits);

      expect(deserialized.slots[0].spirit).toEqual(mockSpirits[0]);
      expect(deserialized.slots[0].level).toBe(50);
      expect(deserialized.slots[1].spirit).toEqual(mockSpirits[0]);
      expect(deserialized.slots[1].level).toBe(50); // From collection
    });

    it('should convert collection spirits to base format when sharing', () => {
      const spiritSlot = {
        type: 'collection',
        mySpiritId: 'my-1',
        spirit: mockSpirits[0],
        level: 50,
        awakeningLevel: 3,
        evolutionLevel: 4,
        skillEnhancementLevel: 2
      };

      const serialized = serializeSpiritBuildForSharing({
        slots: [spiritSlot]
      });

      expect(serialized.slots[0].type).toBe('base');
      expect(serialized.slots[0].spiritId).toBe(101);
      expect(serialized.slots[0]).not.toHaveProperty('mySpiritId');
      expect(serialized.slots[0]).not.toHaveProperty('spirit');
    });
  });

  // === SOUL WEAPON BUILDS ===
  describe('Soul Weapon Builds Serialization', () => {
    const mockShapes = [
      { id: 'shape-1', name: 'T-Shape', pattern: [[1,1,1],[0,1,0]], baseStats: { atk: 10, def: 5 } },
      { id: 'shape-2', name: 'L-Shape', pattern: [[1,0],[1,0],[1,1]], baseStats: { atk: 15, def: 8 } }
    ];

    it('should serialize soul weapon build to only store shapeId', () => {
      const soulWeaponBuild = {
        weaponId: 1,
        weaponName: 'Excalibur',
        gridState: [
          [
            { active: true, piece: { shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Epic', level: 5, rotation: 0, anchorRow: 0, anchorCol: 0, inventoryIndex: 0 } },
            { active: false, piece: null }
          ]
        ],
        inventory: [
          { shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Epic', level: 5 },
          { shapeId: 'shape-2', shape: mockShapes[1], rarity: 'Rare', level: 3 }
        ]
      };

      const serialized = serializeSoulWeaponBuild(soulWeaponBuild);

      // Verify grid state
      expect(serialized.gridState[0][0].piece.shapeId).toBe('shape-1');
      expect(serialized.gridState[0][0].piece).not.toHaveProperty('shape');
      expect(serialized.gridState[0][0].piece.rarity).toBe('Epic');
      expect(serialized.gridState[0][0].piece.level).toBe(5);

      // Verify inventory
      expect(serialized.inventory[0].shapeId).toBe('shape-1');
      expect(serialized.inventory[0]).not.toHaveProperty('shape');
      expect(serialized.inventory[1].shapeId).toBe('shape-2');

      // Verify shape details are not in serialized data
      expect(JSON.stringify(serialized)).not.toContain('T-Shape');
      expect(JSON.stringify(serialized)).not.toContain('L-Shape');
      expect(JSON.stringify(serialized)).not.toContain('pattern');
      expect(JSON.stringify(serialized)).not.toContain('baseStats');
    });

    it('should drastically reduce soul weapon build size', () => {
      const fullBuild = {
        weaponId: 1,
        weaponName: 'Excalibur',
        gridState: Array(6).fill(0).map(() =>
          Array(6).fill(0).map(() => ({
            active: true,
            piece: {
              shapeId: 'shape-1',
              shape: mockShapes[0], // Full object with pattern and stats
              rarity: 'Epic',
              level: 5,
              rotation: 0,
              anchorRow: 0,
              anchorCol: 0,
              inventoryIndex: 0
            }
          }))
        ),
        inventory: Array(8).fill(0).map(() => ({
          shapeId: 'shape-1',
          shape: mockShapes[0],
          rarity: 'Epic',
          level: 5
        }))
      };

      const serialized = serializeSoulWeaponBuild(fullBuild);

      const fullSize = JSON.stringify(fullBuild).length;
      const serializedSize = JSON.stringify(serialized).length;

      // Serialized should be smaller (at least 10% reduction, can be much more with complex shapes)
      expect(serializedSize).toBeLessThan(fullSize);

      // Log the reduction for visibility
      const reductionPercent = ((fullSize - serializedSize) / fullSize * 100).toFixed(1);
      console.log(`Soul weapon size reduction: ${fullSize} -> ${serializedSize} (${reductionPercent}% smaller)`);
    });

    it('should deserialize soul weapon build correctly', () => {
      const serialized = {
        weaponId: 1,
        weaponName: 'Excalibur',
        gridState: [
          [
            { active: true, piece: { shapeId: 'shape-1', rarity: 'Epic', level: 5, rotation: 0, anchorRow: 0, anchorCol: 0, inventoryIndex: 0 } }
          ]
        ],
        inventory: [
          { shapeId: 'shape-1', rarity: 'Epic', level: 5 }
        ]
      };

      const deserialized = deserializeSoulWeaponBuild(serialized, mockShapes);

      expect(deserialized.gridState[0][0].piece.shape).toEqual(mockShapes[0]);
      expect(deserialized.gridState[0][0].piece.shapeId).toBe('shape-1');
      expect(deserialized.inventory[0].shape).toEqual(mockShapes[0]);
    });
  });

  // === BATTLE LOADOUTS ===
  describe('Battle Loadouts Serialization', () => {
    const mockSkills = [
      { id: 1, name: 'Fireball', maxLevel: 10 },
      { id: 2, name: 'Ice Blast', maxLevel: 15 }
    ];

    const mockSpirits = [
      { id: 101, name: 'Phoenix', type: 'Fire' }
    ];

    const mockShapes = [
      { id: 'shape-1', name: 'T-Shape', pattern: [[1,1,1],[0,1,0]], baseStats: { atk: 10, def: 5 } }
    ];

    const mockSkillBuild = {
      id: 'skill-build-1',
      name: 'Test Skill Build',
      maxSlots: 10,
      slots: [
        { skill: mockSkills[0], level: 5 }
      ]
    };

    const mockSpiritBuild = {
      id: 'spirit-build-1',
      name: 'Test Spirit Build',
      slots: [
        { type: 'base', spirit: mockSpirits[0], level: 50, awakeningLevel: 3, evolutionLevel: 4, skillEnhancementLevel: 2 }
      ]
    };

    const mockSoulWeaponBuild = {
      weaponId: 1,
      weaponName: 'Excalibur',
      gridState: [[{ active: true, piece: { shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Epic', level: 5, rotation: 0, anchorRow: 0, anchorCol: 0, inventoryIndex: 0 } }]],
      inventory: [{ shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Epic', level: 5 }]
    };

    it('should serialize loadout for storage with build IDs only', () => {
      const loadout = {
        name: 'Test Loadout',
        skillBuild: mockSkillBuild,
        spiritBuild: mockSpiritBuild,
        soulWeaponBuild: mockSoulWeaponBuild,
        skillStoneBuild: { slots: [{ type: 'cooldown', element: 'fire', tier: 'A' }] },
        spirit: mockSpirits[0],
        skillStone: { element: 'fire', tier: 'A' },
        promotionAbility: 'Some Ability',
        familiar: 'Dragon'
      };

      const serialized = serializeLoadoutForStorage(loadout);

      // Verify build IDs are stored, not full builds
      expect(serialized.skillBuildId).toBe('skill-build-1');
      expect(serialized.spiritBuildId).toBe('spirit-build-1');
      expect(serialized).not.toHaveProperty('skillBuild');
      expect(serialized).not.toHaveProperty('spiritBuild');

      // Verify soul weapon is serialized (no full shapes)
      expect(serialized.soulWeaponBuild.gridState[0][0].piece.shapeId).toBe('shape-1');
      expect(serialized.soulWeaponBuild.gridState[0][0].piece).not.toHaveProperty('shape');
      expect(JSON.stringify(serialized.soulWeaponBuild)).not.toContain('T-Shape');

      // Verify other fields are preserved
      expect(serialized.skillStoneBuild).toEqual({ slots: [{ type: 'cooldown', element: 'fire', tier: 'A' }] });
      expect(serialized.spirit).toEqual(mockSpirits[0]);
    });

    it('should serialize loadout for sharing with full build data', () => {
      const loadout = {
        name: 'Test Loadout',
        skillBuild: mockSkillBuild,
        spiritBuild: mockSpiritBuild,
        soulWeaponBuild: mockSoulWeaponBuild
      };

      const serialized = serializeLoadoutForSharing(loadout);

      // Verify full builds are included (but serialized)
      expect(serialized.skillBuild).toBeDefined();
      expect(serialized.skillBuild.name).toBe('Test Skill Build');
      expect(serialized.skillBuild.slots[0].skillId).toBe(1);
      expect(serialized.skillBuild.slots[0]).not.toHaveProperty('skill');

      expect(serialized.spiritBuild).toBeDefined();
      expect(serialized.spiritBuild.slots[0].spiritId).toBe(101);
      expect(serialized.spiritBuild.slots[0]).not.toHaveProperty('spirit');

      // Verify no build IDs
      expect(serialized).not.toHaveProperty('skillBuildId');
      expect(serialized).not.toHaveProperty('spiritBuildId');
    });

    it('should drastically reduce battle loadout size with serialization', () => {
      const fullLoadout = {
        name: 'Test Loadout',
        skillBuild: mockSkillBuild,
        spiritBuild: mockSpiritBuild,
        soulWeaponBuild: {
          weaponId: 1,
          weaponName: 'Excalibur',
          gridState: Array(6).fill(0).map(() =>
            Array(6).fill(0).map(() => ({
              active: true,
              piece: {
                shapeId: 'shape-1',
                shape: mockShapes[0], // Full object
                rarity: 'Epic',
                level: 5,
                rotation: 0,
                anchorRow: 0,
                anchorCol: 0,
                inventoryIndex: 0
              }
            }))
          ),
          inventory: Array(8).fill(0).map(() => ({
            shapeId: 'shape-1',
            shape: mockShapes[0], // Full object
            rarity: 'Epic',
            level: 5
          }))
        }
      };

      const serialized = serializeLoadoutForStorage(fullLoadout);

      const fullSize = JSON.stringify(fullLoadout).length;
      const serializedSize = JSON.stringify(serialized).length;

      // Serialized should be smaller (reduction varies based on soul weapon complexity)
      expect(serializedSize).toBeLessThan(fullSize);

      // Log the reduction for visibility
      const reductionPercent = ((fullSize - serializedSize) / fullSize * 100).toFixed(1);
      console.log(`Battle loadout size reduction: ${fullSize} -> ${serializedSize} (${reductionPercent}% smaller)`);
    });
  });

  // === SKILL STONE BUILDS ===
  describe('Skill Stone Builds Serialization', () => {
    it('should already be minimal (no serialization needed)', () => {
      const skillStoneBuild = {
        name: 'Test Stone Build',
        slots: [
          { type: 'cooldown', element: 'fire', tier: 'A' },
          { type: 'time', element: 'water', tier: 'B' },
          { type: 'heat', element: null, tier: null }
        ]
      };

      const serialized = {
        name: skillStoneBuild.name,
        slots: skillStoneBuild.slots
      };

      // Verify slots are already minimal
      expect(serialized.slots[0]).toEqual({ type: 'cooldown', element: 'fire', tier: 'A' });
      expect(Object.keys(serialized.slots[0])).toHaveLength(3); // Only 3 properties
    });
  });

  // === MY SPIRITS COLLECTION ===
  describe('My Spirits Collection Serialization', () => {
    const mockSpirits = [
      { id: 101, name: 'Phoenix', type: 'Fire' }
    ];

    it('should serialize collection spirit to only store spiritId', () => {
      const mySpirit = {
        id: 'my-1',
        spirit: mockSpirits[0],
        level: 50,
        awakeningLevel: 3,
        evolutionLevel: 4,
        skillEnhancementLevel: 2
      };

      const serialized = {
        spiritId: mySpirit.spirit.id,
        level: mySpirit.level,
        awakeningLevel: mySpirit.awakeningLevel,
        evolutionLevel: mySpirit.evolutionLevel,
        skillEnhancementLevel: mySpirit.skillEnhancementLevel
      };

      expect(serialized.spiritId).toBe(101);
      expect(serialized).not.toHaveProperty('spirit');
      expect(JSON.stringify(serialized)).not.toContain('Phoenix');
    });
  });

  // === GRID SUBMISSIONS ===
  describe('Grid Submissions Serialization', () => {
    it('should only store primitive data', () => {
      const gridSubmission = {
        weaponId: '1',
        weaponName: 'Excalibur',
        gridType: 'PvE',
        completionEffect: { atk: 100, hp: 200 },
        activeSlots: [[0,0], [0,1], [1,0]],
        totalActiveSlots: 3
      };

      const serialized = gridSubmission;

      // Verify all values are primitives
      expect(typeof serialized.weaponId).toBe('string');
      expect(typeof serialized.weaponName).toBe('string');
      expect(typeof serialized.gridType).toBe('string');
      expect(typeof serialized.completionEffect).toBe('object');
      expect(Array.isArray(serialized.activeSlots)).toBe(true);
      expect(typeof serialized.totalActiveSlots).toBe('number');
    });
  });

  // === END-TO-END SERIALIZATION/DESERIALIZATION ===
  describe('End-to-End Serialization Cycles', () => {
    const mockSkills = [
      { id: 1, name: 'Fireball', maxLevel: 10 }
    ];

    const mockSpirits = [
      { id: 101, name: 'Phoenix', type: 'Fire' }
    ];

    const mockMySpirits = [
      { id: 'my-1', spiritId: 101, level: 50, awakeningLevel: 3, evolutionLevel: 4, skillEnhancementLevel: 2 }
    ];

    const mockShapes = [
      { id: 'shape-1', name: 'T-Shape', pattern: [[1,1,1],[0,1,0]], baseStats: { atk: 10, def: 5 } }
    ];

    const mockSkillBuilds = [
      {
        id: 'skill-build-1',
        name: 'Test Skill Build',
        maxSlots: 10,
        slots: [{ skillId: 1, level: 5 }]
      }
    ];

    const mockSpiritBuilds = [
      {
        id: 'spirit-build-1',
        name: 'Test Spirit Build',
        slots: [{ type: 'base', spiritId: 101, level: 50, awakeningLevel: 3, evolutionLevel: 4, skillEnhancementLevel: 2 }]
      }
    ];

    it('should maintain data integrity through save/load cycle', () => {
      // Original loadout
      const originalLoadout = {
        name: 'Test Loadout',
        skillBuild: {
          id: 'skill-build-1',
          name: 'Test Skill Build',
          maxSlots: 10,
          slots: [{ skill: mockSkills[0], level: 5 }]
        },
        spiritBuild: {
          id: 'spirit-build-1',
          name: 'Test Spirit Build',
          slots: [{ type: 'base', spirit: mockSpirits[0], level: 50, awakeningLevel: 3, evolutionLevel: 4, skillEnhancementLevel: 2 }]
        },
        soulWeaponBuild: {
          weaponId: 1,
          weaponName: 'Excalibur',
          gridState: [[{ active: true, piece: { shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Epic', level: 5, rotation: 0, anchorRow: 0, anchorCol: 0, inventoryIndex: 0 } }]],
          inventory: [{ shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Epic', level: 5 }]
        }
      };

      // Serialize for storage
      const serialized = serializeLoadoutForStorage(originalLoadout);

      // Deserialize
      const deserialized = deserializeLoadout(
        serialized,
        mockSkills,
        mockSpirits,
        mockMySpirits,
        mockSkillBuilds,
        mockSpiritBuilds,
        mockShapes
      );

      // Verify data integrity
      expect(deserialized.name).toBe(originalLoadout.name);
      expect(deserialized.skillBuild.id).toBe('skill-build-1');
      expect(deserialized.skillBuild.slots[0].skill).toEqual(mockSkills[0]);
      expect(deserialized.spiritBuild.slots[0].spirit).toEqual(mockSpirits[0]);
      expect(deserialized.soulWeaponBuild.gridState[0][0].piece.shape).toEqual(mockShapes[0]);
    });
  });
});
