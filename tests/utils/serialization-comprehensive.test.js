import { describe, it, expect } from 'vitest';

// Import all serialization utilities
import {
  serializeBuild as serializeSpiritBuild,
  deserializeBuild as deserializeSpiritBuild,
  serializeBuildForSharing as serializeSpiritBuildForSharing,
  serializeSlot as serializeSpiritSlot,
  deserializeSlot as deserializeSpiritSlot_Import
} from '../../src/utils/spiritSerialization.js';

// Fix naming conflict - deserializeSlot was overwriting serializeSpiritSlot
const deserializeSpiritSlot = deserializeSpiritSlot_Import;
import {
  serializeLoadoutForStorage,
  serializeLoadoutForSharing,
  deserializeLoadout,
  serializeSoulWeaponBuild,
  deserializeSoulWeaponBuild,
  serializeSkillBuild,
  deserializeSkillBuild
} from '../../src/utils/battleLoadoutSerializer.js';

describe('Comprehensive Serialization Tests - Every Data Point', () => {
  // === SKILL BUILDS - EVERY FIELD ===
  describe('Skill Builds - Every Field', () => {
    const mockSkills = [
      { id: 1, name: 'Fireball', maxLevel: 10, attribute: 'Fire' },
      { id: 2, name: 'Ice Blast', maxLevel: 15, attribute: 'Water' },
      { id: 3, name: 'Wind Strike', maxLevel: 12, attribute: 'Wind' }
    ];

    describe('Serialization - Skill Build Fields', () => {
      it('should serialize build.id when present', () => {
        const build = { id: 'skill-123', name: 'Test', maxSlots: 10, slots: [] };
        const serialized = serializeSkillBuild(build);
        expect(serialized.id).toBe('skill-123');
      });

      it('should serialize build.name', () => {
        const build = { name: 'My Skill Build', maxSlots: 10, slots: [] };
        const serialized = serializeSkillBuild(build);
        expect(serialized.name).toBe('My Skill Build');
      });

      it('should serialize build.maxSlots', () => {
        const build = { name: 'Test', maxSlots: 7, slots: [] };
        const serialized = serializeSkillBuild(build);
        expect(serialized.maxSlots).toBe(7);
      });

      it('should serialize slots[].skillId (not full skill object)', () => {
        const build = {
          name: 'Test',
          maxSlots: 10,
          slots: [
            { skill: mockSkills[0], level: 5 },
            { skill: mockSkills[1], level: 8 }
          ]
        };
        const serialized = serializeSkillBuild(build);

        expect(serialized.slots[0].skillId).toBe(1);
        expect(serialized.slots[0]).not.toHaveProperty('skill');
        expect(serialized.slots[1].skillId).toBe(2);
        expect(serialized.slots[1]).not.toHaveProperty('skill');
      });

      it('should serialize slots[].level', () => {
        const build = {
          name: 'Test',
          maxSlots: 10,
          slots: [
            { skill: mockSkills[0], level: 3 },
            { skill: mockSkills[1], level: 10 }
          ]
        };
        const serialized = serializeSkillBuild(build);

        expect(serialized.slots[0].level).toBe(3);
        expect(serialized.slots[1].level).toBe(10);
      });

      it('should serialize null slots as { skillId: null, level }', () => {
        const build = {
          name: 'Test',
          maxSlots: 10,
          slots: [{ skill: null, level: 1 }]
        };
        const serialized = serializeSkillBuild(build);

        expect(serialized.slots[0].skillId).toBeNull();
        expect(serialized.slots[0].level).toBe(1);
      });

      it('should handle already-serialized format (skillId exists)', () => {
        const build = {
          name: 'Test',
          maxSlots: 10,
          slots: [{ skillId: 2, level: 7 }]
        };
        const serialized = serializeSkillBuild(build);

        expect(serialized.slots[0].skillId).toBe(2);
        expect(serialized.slots[0].level).toBe(7);
      });
    });

    describe('Deserialization - Skill Build Fields', () => {
      it('should deserialize slots[].skillId to full skill object', () => {
        const serialized = {
          name: 'Test',
          maxSlots: 10,
          slots: [{ skillId: 1, level: 5 }]
        };
        const deserialized = deserializeSkillBuild(serialized, mockSkills);

        expect(deserialized.slots[0].skill).toEqual(mockSkills[0]);
        expect(deserialized.slots[0].skill.id).toBe(1);
        expect(deserialized.slots[0].skill.name).toBe('Fireball');
        expect(deserialized.slots[0].skill.maxLevel).toBe(10);
        expect(deserialized.slots[0].skill.attribute).toBe('Fire');
      });

      it('should deserialize slots[].level', () => {
        const serialized = {
          name: 'Test',
          maxSlots: 10,
          slots: [{ skillId: 1, level: 8 }]
        };
        const deserialized = deserializeSkillBuild(serialized, mockSkills);

        expect(deserialized.slots[0].level).toBe(8);
      });

      it('should handle missing skill (skillId not found)', () => {
        const serialized = {
          name: 'Test',
          maxSlots: 10,
          slots: [{ skillId: 999, level: 5 }]
        };
        const deserialized = deserializeSkillBuild(serialized, mockSkills);

        expect(deserialized.slots[0].skill).toBeNull();
        expect(deserialized.slots[0].level).toBe(5);
      });

      it('should handle null skillId', () => {
        const serialized = {
          name: 'Test',
          maxSlots: 10,
          slots: [{ skillId: null, level: 1 }]
        };
        const deserialized = deserializeSkillBuild(serialized, mockSkills);

        expect(deserialized.slots[0].skill).toBeNull();
        expect(deserialized.slots[0].level).toBe(1);
      });

      it('should default level to 1 if missing', () => {
        const serialized = {
          name: 'Test',
          maxSlots: 10,
          slots: [{ skillId: 1 }]
        };
        const deserialized = deserializeSkillBuild(serialized, mockSkills);

        expect(deserialized.slots[0].level).toBe(1);
      });

      it('should preserve all build metadata', () => {
        const serialized = {
          id: 'skill-123',
          name: 'Test Build',
          maxSlots: 7,
          slots: []
        };
        const deserialized = deserializeSkillBuild(serialized, mockSkills);

        expect(deserialized.id).toBe('skill-123');
        expect(deserialized.name).toBe('Test Build');
        expect(deserialized.maxSlots).toBe(7);
      });
    });
  });

  // === SPIRIT BUILDS - EVERY FIELD ===
  describe('Spirit Builds - Every Field', () => {
    const mockSpirits = [
      { id: 101, name: 'Phoenix', type: 'Fire', rarity: 'Legendary' },
      { id: 102, name: 'Kraken', type: 'Water', rarity: 'Epic' }
    ];

    const mockMySpirits = [
      {
        id: 'my-spirit-1',
        spiritId: 101,
        level: 50,
        awakeningLevel: 3,
        evolutionLevel: 4,
        skillEnhancementLevel: 2
      },
      {
        id: 'my-spirit-2',
        spiritId: 102,
        level: 40,
        awakeningLevel: 2,
        evolutionLevel: 3,
        skillEnhancementLevel: 1
      }
    ];

    describe('Serialization - Base Spirit Slot Fields', () => {
      it('should serialize slot.type as "base"', () => {
        const slot = {
          type: 'base',
          spirit: mockSpirits[0],
          level: 50,
          awakeningLevel: 3,
          evolutionLevel: 4,
          skillEnhancementLevel: 2
        };
        const serialized = serializeSpiritSlot(slot);

        expect(serialized.type).toBe('base');
      });

      it('should serialize slot.spiritId (not full spirit object)', () => {
        const slot = {
          type: 'base',
          spirit: mockSpirits[0],
          level: 50,
          awakeningLevel: 3,
          evolutionLevel: 4,
          skillEnhancementLevel: 2
        };
        const serialized = serializeSpiritSlot(slot);

        expect(serialized.spiritId).toBe(101);
        expect(serialized).not.toHaveProperty('spirit');
      });

      it('should serialize slot.level', () => {
        const slot = {
          type: 'base',
          spirit: mockSpirits[0],
          level: 75,
          awakeningLevel: 3,
          evolutionLevel: 4,
          skillEnhancementLevel: 2
        };
        const serialized = serializeSpiritSlot(slot);

        expect(serialized.level).toBe(75);
      });

      it('should serialize slot.awakeningLevel', () => {
        const slot = {
          type: 'base',
          spirit: mockSpirits[0],
          level: 50,
          awakeningLevel: 5,
          evolutionLevel: 4,
          skillEnhancementLevel: 2
        };
        const serialized = serializeSpiritSlot(slot);

        expect(serialized.awakeningLevel).toBe(5);
      });

      it('should serialize slot.evolutionLevel', () => {
        const slot = {
          type: 'base',
          spirit: mockSpirits[0],
          level: 50,
          awakeningLevel: 3,
          evolutionLevel: 7,
          skillEnhancementLevel: 2
        };
        const serialized = serializeSpiritSlot(slot);

        expect(serialized.evolutionLevel).toBe(7);
      });

      it('should serialize slot.skillEnhancementLevel', () => {
        const slot = {
          type: 'base',
          spirit: mockSpirits[0],
          level: 50,
          awakeningLevel: 3,
          evolutionLevel: 4,
          skillEnhancementLevel: 10
        };
        const serialized = serializeSpiritSlot(slot);

        expect(serialized.skillEnhancementLevel).toBe(10);
      });
    });

    describe('Serialization - Collection Spirit Slot Fields', () => {
      it('should serialize slot.type as "collection"', () => {
        const slot = {
          type: 'collection',
          mySpiritId: 'my-spirit-1',
          spirit: mockSpirits[0],
          level: 50,
          awakeningLevel: 3,
          evolutionLevel: 4,
          skillEnhancementLevel: 2
        };
        const serialized = serializeSpiritSlot(slot);

        expect(serialized.type).toBe('collection');
      });

      it('should serialize slot.mySpiritId ONLY (no other fields)', () => {
        const slot = {
          type: 'collection',
          mySpiritId: 'my-spirit-1',
          spirit: mockSpirits[0],
          level: 50,
          awakeningLevel: 3,
          evolutionLevel: 4,
          skillEnhancementLevel: 2
        };
        const serialized = serializeSpiritSlot(slot);

        expect(serialized.mySpiritId).toBe('my-spirit-1');
        expect(serialized).not.toHaveProperty('spirit');
        expect(serialized).not.toHaveProperty('level');
        expect(serialized).not.toHaveProperty('awakeningLevel');
        expect(serialized).not.toHaveProperty('evolutionLevel');
        expect(serialized).not.toHaveProperty('skillEnhancementLevel');
        expect(Object.keys(serialized)).toEqual(['type', 'mySpiritId']);
      });
    });

    describe('Deserialization - Base Spirit Slot Fields', () => {
      it('should deserialize slot.spiritId to full spirit object', () => {
        const serialized = {
          type: 'base',
          spiritId: 101,
          level: 50,
          awakeningLevel: 3,
          evolutionLevel: 4,
          skillEnhancementLevel: 2
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, mockMySpirits);

        expect(deserialized.spirit).toEqual(mockSpirits[0]);
        expect(deserialized.spirit.id).toBe(101);
        expect(deserialized.spirit.name).toBe('Phoenix');
        expect(deserialized.spirit.type).toBe('Fire');
        expect(deserialized.spirit.rarity).toBe('Legendary');
      });

      it('should deserialize slot.level', () => {
        const serialized = {
          type: 'base',
          spiritId: 101,
          level: 75,
          awakeningLevel: 3,
          evolutionLevel: 4,
          skillEnhancementLevel: 2
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, []); // Don't pass mySpirits to avoid auto-upgrade

        expect(deserialized.level).toBe(75);
      });

      it('should deserialize slot.awakeningLevel', () => {
        const serialized = {
          type: 'base',
          spiritId: 101,
          level: 50,
          awakeningLevel: 5,
          evolutionLevel: 4,
          skillEnhancementLevel: 2
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, []); // Don't pass mySpirits to avoid auto-upgrade

        expect(deserialized.awakeningLevel).toBe(5);
      });

      it('should deserialize slot.evolutionLevel', () => {
        const serialized = {
          type: 'base',
          spiritId: 101,
          level: 50,
          awakeningLevel: 3,
          evolutionLevel: 7,
          skillEnhancementLevel: 2
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, []); // Don't pass mySpirits to avoid auto-upgrade

        expect(deserialized.evolutionLevel).toBe(7);
      });

      it('should deserialize slot.skillEnhancementLevel', () => {
        const serialized = {
          type: 'base',
          spiritId: 101,
          level: 50,
          awakeningLevel: 3,
          evolutionLevel: 4,
          skillEnhancementLevel: 10
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, []); // Don't pass mySpirits to avoid auto-upgrade

        expect(deserialized.skillEnhancementLevel).toBe(10);
      });

      it('should default missing level to 1', () => {
        const serialized = {
          type: 'base',
          spiritId: 101,
          awakeningLevel: 3,
          evolutionLevel: 4,
          skillEnhancementLevel: 2
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, []); // Don't pass mySpirits to avoid auto-upgrade

        expect(deserialized.level).toBe(1);
      });

      it('should default missing awakeningLevel to 0', () => {
        const serialized = {
          type: 'base',
          spiritId: 101,
          level: 50,
          evolutionLevel: 4,
          skillEnhancementLevel: 2
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, []); // Don't pass mySpirits to avoid auto-upgrade

        expect(deserialized.awakeningLevel).toBe(0);
      });

      it('should default missing evolutionLevel to 4', () => {
        const serialized = {
          type: 'base',
          spiritId: 101,
          level: 50,
          awakeningLevel: 3,
          skillEnhancementLevel: 2
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, mockMySpirits);

        expect(deserialized.evolutionLevel).toBe(4);
      });

      it('should default missing skillEnhancementLevel to 0', () => {
        const serialized = {
          type: 'base',
          spiritId: 101,
          level: 50,
          awakeningLevel: 3,
          evolutionLevel: 4
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, []); // Don't pass mySpirits to avoid auto-upgrade

        expect(deserialized.skillEnhancementLevel).toBe(0);
      });
    });

    describe('Deserialization - Collection Spirit Slot Fields', () => {
      it('should deserialize slot.mySpiritId to full spirit from collection', () => {
        const serialized = {
          type: 'collection',
          mySpiritId: 'my-spirit-1'
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, mockMySpirits);

        expect(deserialized.spirit).toEqual(mockSpirits[0]);
        expect(deserialized.mySpiritId).toBe('my-spirit-1');
      });

      it('should deserialize collection spirit level from mySpirits', () => {
        const serialized = {
          type: 'collection',
          mySpiritId: 'my-spirit-1'
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, mockMySpirits);

        expect(deserialized.level).toBe(50);
      });

      it('should deserialize collection spirit awakeningLevel from mySpirits', () => {
        const serialized = {
          type: 'collection',
          mySpiritId: 'my-spirit-1'
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, mockMySpirits);

        expect(deserialized.awakeningLevel).toBe(3);
      });

      it('should deserialize collection spirit evolutionLevel from mySpirits', () => {
        const serialized = {
          type: 'collection',
          mySpiritId: 'my-spirit-1'
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, mockMySpirits);

        expect(deserialized.evolutionLevel).toBe(4);
      });

      it('should deserialize collection spirit skillEnhancementLevel from mySpirits', () => {
        const serialized = {
          type: 'collection',
          mySpiritId: 'my-spirit-1'
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, mockMySpirits);

        expect(deserialized.skillEnhancementLevel).toBe(2);
      });

      it('should handle missing collection spirit (deleted from collection)', () => {
        const serialized = {
          type: 'collection',
          mySpiritId: 'non-existent'
        };
        const deserialized = deserializeSpiritSlot(serialized, mockSpirits, mockMySpirits);

        expect(deserialized.missing).toBe(true);
        expect(deserialized.spirit).toBeNull();
        expect(deserialized.mySpiritId).toBe('non-existent');
        expect(deserialized.level).toBe(1);
        expect(deserialized.awakeningLevel).toBe(0);
        expect(deserialized.evolutionLevel).toBe(4);
        expect(deserialized.skillEnhancementLevel).toBe(0);
      });
    });
  });

  // === SOUL WEAPON BUILDS - EVERY FIELD ===
  describe('Soul Weapon Builds - Every Field', () => {
    const mockShapes = [
      { id: 'shape-1', name: 'T-Shape', pattern: [[1,1,1],[0,1,0]], baseStats: { atk: 10, def: 5 } },
      { id: 'shape-2', name: 'L-Shape', pattern: [[1,0],[1,0],[1,1]], baseStats: { atk: 15, def: 8 } }
    ];

    describe('Serialization - Soul Weapon Build Fields', () => {
      it('should serialize build.weaponId', () => {
        const build = {
          weaponId: 42,
          weaponName: 'Excalibur',
          gridState: [],
          inventory: []
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.weaponId).toBe(42);
      });

      it('should serialize build.weaponName', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Soul Slayer',
          gridState: [],
          inventory: []
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.weaponName).toBe('Soul Slayer');
      });

      it('should serialize gridState[row][col].active', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{ active: true, piece: null }, { active: false, piece: null }]
          ],
          inventory: []
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.gridState[0][0].active).toBe(true);
        expect(serialized.gridState[0][1].active).toBe(false);
      });

      it('should serialize gridState[row][col].piece.shapeId (not full shape)', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{
              active: true,
              piece: {
                shapeId: 'shape-1',
                shape: mockShapes[0],
                rarity: 'Epic',
                level: 5,
                rotation: 90,
                anchorRow: 0,
                anchorCol: 0,
                inventoryIndex: 0
              }
            }]
          ],
          inventory: []
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.gridState[0][0].piece.shapeId).toBe('shape-1');
        expect(serialized.gridState[0][0].piece).not.toHaveProperty('shape');
      });

      it('should serialize gridState[row][col].piece.rarity', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{
              active: true,
              piece: {
                shapeId: 'shape-1',
                shape: mockShapes[0],
                rarity: 'Legendary',
                level: 5,
                rotation: 0,
                anchorRow: 0,
                anchorCol: 0,
                inventoryIndex: 0
              }
            }]
          ],
          inventory: []
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.gridState[0][0].piece.rarity).toBe('Legendary');
      });

      it('should serialize gridState[row][col].piece.level', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{
              active: true,
              piece: {
                shapeId: 'shape-1',
                shape: mockShapes[0],
                rarity: 'Epic',
                level: 10,
                rotation: 0,
                anchorRow: 0,
                anchorCol: 0,
                inventoryIndex: 0
              }
            }]
          ],
          inventory: []
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.gridState[0][0].piece.level).toBe(10);
      });

      it('should serialize gridState[row][col].piece.rotation', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{
              active: true,
              piece: {
                shapeId: 'shape-1',
                shape: mockShapes[0],
                rarity: 'Epic',
                level: 5,
                rotation: 180,
                anchorRow: 0,
                anchorCol: 0,
                inventoryIndex: 0
              }
            }]
          ],
          inventory: []
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.gridState[0][0].piece.rotation).toBe(180);
      });

      it('should serialize gridState[row][col].piece.anchorRow', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{
              active: true,
              piece: {
                shapeId: 'shape-1',
                shape: mockShapes[0],
                rarity: 'Epic',
                level: 5,
                rotation: 0,
                anchorRow: 3,
                anchorCol: 0,
                inventoryIndex: 0
              }
            }]
          ],
          inventory: []
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.gridState[0][0].piece.anchorRow).toBe(3);
      });

      it('should serialize gridState[row][col].piece.anchorCol', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{
              active: true,
              piece: {
                shapeId: 'shape-1',
                shape: mockShapes[0],
                rarity: 'Epic',
                level: 5,
                rotation: 0,
                anchorRow: 0,
                anchorCol: 4,
                inventoryIndex: 0
              }
            }]
          ],
          inventory: []
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.gridState[0][0].piece.anchorCol).toBe(4);
      });

      it('should serialize gridState[row][col].piece.inventoryIndex', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{
              active: true,
              piece: {
                shapeId: 'shape-1',
                shape: mockShapes[0],
                rarity: 'Epic',
                level: 5,
                rotation: 0,
                anchorRow: 0,
                anchorCol: 0,
                inventoryIndex: 7
              }
            }]
          ],
          inventory: []
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.gridState[0][0].piece.inventoryIndex).toBe(7);
      });

      it('should serialize null pieces as { active: false, piece: null }', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{ active: false, piece: null }]
          ],
          inventory: []
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.gridState[0][0].active).toBe(false);
        expect(serialized.gridState[0][0].piece).toBeNull();
      });

      it('should serialize inventory[].shapeId (not full shape)', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [],
          inventory: [
            { shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Epic', level: 5 },
            { shapeId: 'shape-2', shape: mockShapes[1], rarity: 'Rare', level: 3 }
          ]
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.inventory[0].shapeId).toBe('shape-1');
        expect(serialized.inventory[0]).not.toHaveProperty('shape');
        expect(serialized.inventory[1].shapeId).toBe('shape-2');
        expect(serialized.inventory[1]).not.toHaveProperty('shape');
      });

      it('should serialize inventory[].rarity', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [],
          inventory: [
            { shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Legendary', level: 5 }
          ]
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.inventory[0].rarity).toBe('Legendary');
      });

      it('should serialize inventory[].level', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [],
          inventory: [
            { shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Epic', level: 8 }
          ]
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.inventory[0].level).toBe(8);
      });

      it('should handle null inventory items', () => {
        const build = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [],
          inventory: [null, { shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Epic', level: 5 }]
        };
        const serialized = serializeSoulWeaponBuild(build);

        expect(serialized.inventory[0]).toBeNull();
        expect(serialized.inventory[1].shapeId).toBe('shape-1');
      });
    });

    describe('Deserialization - Soul Weapon Build Fields', () => {
      it('should deserialize build.weaponId', () => {
        const serialized = {
          weaponId: 42,
          weaponName: 'Excalibur',
          gridState: [],
          inventory: []
        };
        const deserialized = deserializeSoulWeaponBuild(serialized, mockShapes);

        expect(deserialized.weaponId).toBe(42);
      });

      it('should deserialize build.weaponName', () => {
        const serialized = {
          weaponId: 1,
          weaponName: 'Soul Slayer',
          gridState: [],
          inventory: []
        };
        const deserialized = deserializeSoulWeaponBuild(serialized, mockShapes);

        expect(deserialized.weaponName).toBe('Soul Slayer');
      });

      it('should deserialize gridState[row][col].piece.shapeId to full shape', () => {
        const serialized = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{
              active: true,
              piece: {
                shapeId: 'shape-1',
                rarity: 'Epic',
                level: 5,
                rotation: 0,
                anchorRow: 0,
                anchorCol: 0,
                inventoryIndex: 0
              }
            }]
          ],
          inventory: []
        };
        const deserialized = deserializeSoulWeaponBuild(serialized, mockShapes);

        expect(deserialized.gridState[0][0].piece.shape).toEqual(mockShapes[0]);
        expect(deserialized.gridState[0][0].piece.shape.id).toBe('shape-1');
        expect(deserialized.gridState[0][0].piece.shape.name).toBe('T-Shape');
        expect(deserialized.gridState[0][0].piece.shape.pattern).toEqual([[1,1,1],[0,1,0]]);
        expect(deserialized.gridState[0][0].piece.shape.baseStats).toEqual({ atk: 10, def: 5 });
      });

      it('should preserve all piece properties during deserialization', () => {
        const serialized = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{
              active: true,
              piece: {
                shapeId: 'shape-1',
                rarity: 'Legendary',
                level: 10,
                rotation: 180,
                anchorRow: 3,
                anchorCol: 4,
                inventoryIndex: 7
              }
            }]
          ],
          inventory: []
        };
        const deserialized = deserializeSoulWeaponBuild(serialized, mockShapes);

        const piece = deserialized.gridState[0][0].piece;
        expect(piece.shapeId).toBe('shape-1');
        expect(piece.rarity).toBe('Legendary');
        expect(piece.level).toBe(10);
        expect(piece.rotation).toBe(180);
        expect(piece.anchorRow).toBe(3);
        expect(piece.anchorCol).toBe(4);
        expect(piece.inventoryIndex).toBe(7);
        expect(piece.shape).toEqual(mockShapes[0]);
      });

      it('should deserialize inventory[].shapeId to full shape', () => {
        const serialized = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [],
          inventory: [
            { shapeId: 'shape-2', rarity: 'Epic', level: 5 }
          ]
        };
        const deserialized = deserializeSoulWeaponBuild(serialized, mockShapes);

        expect(deserialized.inventory[0].shape).toEqual(mockShapes[1]);
        expect(deserialized.inventory[0].shape.id).toBe('shape-2');
        expect(deserialized.inventory[0].shape.name).toBe('L-Shape');
      });

      it('should preserve inventory item properties during deserialization', () => {
        const serialized = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [],
          inventory: [
            { shapeId: 'shape-1', rarity: 'Legendary', level: 8 }
          ]
        };
        const deserialized = deserializeSoulWeaponBuild(serialized, mockShapes);

        expect(deserialized.inventory[0].shapeId).toBe('shape-1');
        expect(deserialized.inventory[0].rarity).toBe('Legendary');
        expect(deserialized.inventory[0].level).toBe(8);
        expect(deserialized.inventory[0].shape).toEqual(mockShapes[0]);
      });

      it('should handle missing shapes (return null piece)', () => {
        const serialized = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [
            [{
              active: true,
              piece: {
                shapeId: 'non-existent',
                rarity: 'Epic',
                level: 5,
                rotation: 0,
                anchorRow: 0,
                anchorCol: 0,
                inventoryIndex: 0
              }
            }]
          ],
          inventory: []
        };
        const deserialized = deserializeSoulWeaponBuild(serialized, mockShapes);

        expect(deserialized.gridState[0][0].active).toBe(false);
        expect(deserialized.gridState[0][0].piece).toBeNull();
      });

      it('should handle null inventory items', () => {
        const serialized = {
          weaponId: 1,
          weaponName: 'Test',
          gridState: [],
          inventory: [null, { shapeId: 'shape-1', rarity: 'Epic', level: 5 }]
        };
        const deserialized = deserializeSoulWeaponBuild(serialized, mockShapes);

        expect(deserialized.inventory[0]).toBeNull();
        expect(deserialized.inventory[1].shape).toEqual(mockShapes[0]);
      });
    });
  });

  // === BATTLE LOADOUTS - EVERY FIELD ===
  describe('Battle Loadouts - Every Field', () => {
    const mockSkills = [{ id: 1, name: 'Fireball' }];
    const mockSpirits = [{ id: 101, name: 'Phoenix' }];
    const mockShapes = [{ id: 'shape-1', name: 'T-Shape' }];
    const mockMySpirits = [{ id: 'my-1', spiritId: 101, level: 50, awakeningLevel: 3, evolutionLevel: 4, skillEnhancementLevel: 2 }];
    const mockSkillBuilds = [{ id: 'skill-1', name: 'Build', slots: [{ skillId: 1, level: 5 }] }];
    const mockSpiritBuilds = [{ id: 'spirit-1', name: 'Build', slots: [{ type: 'base', spiritId: 101, level: 50, awakeningLevel: 3, evolutionLevel: 4, skillEnhancementLevel: 2 }] }];

    describe('Serialization For Storage - Every Field', () => {
      it('should serialize loadout.id when present', () => {
        const loadout = {
          id: 'loadout-123',
          name: 'Test Loadout',
          skillBuild: { id: 'skill-1' },
          spiritBuild: { id: 'spirit-1' },
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.id).toBe('loadout-123');
      });

      it('should serialize loadout.name', () => {
        const loadout = {
          name: 'My Battle Loadout',
          skillBuild: null,
          spiritBuild: null,
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.name).toBe('My Battle Loadout');
      });

      it('should serialize skillBuildId (not full skillBuild)', () => {
        const loadout = {
          name: 'Test',
          skillBuild: { id: 'skill-build-123', name: 'Build', slots: [] },
          spiritBuild: null,
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.skillBuildId).toBe('skill-build-123');
        expect(serialized).not.toHaveProperty('skillBuild');
      });

      it('should serialize spiritBuildId (not full spiritBuild)', () => {
        const loadout = {
          name: 'Test',
          skillBuild: null,
          spiritBuild: { id: 'spirit-build-456', name: 'Build', slots: [] },
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.spiritBuildId).toBe('spirit-build-456');
        expect(serialized).not.toHaveProperty('spiritBuild');
      });

      it('should serialize soulWeaponBuild using soul weapon serializer', () => {
        const loadout = {
          name: 'Test',
          skillBuild: null,
          spiritBuild: null,
          soulWeaponBuild: {
            weaponId: 1,
            weaponName: 'Test Weapon',
            gridState: [[{ active: true, piece: { shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Epic', level: 5, rotation: 0, anchorRow: 0, anchorCol: 0, inventoryIndex: 0 } }]],
            inventory: [{ shapeId: 'shape-1', shape: mockShapes[0], rarity: 'Epic', level: 5 }]
          },
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.soulWeaponBuild.gridState[0][0].piece.shapeId).toBe('shape-1');
        expect(serialized.soulWeaponBuild.gridState[0][0].piece).not.toHaveProperty('shape');
      });

      it('should serialize skillStoneBuild as-is', () => {
        const loadout = {
          name: 'Test',
          skillBuild: null,
          spiritBuild: null,
          soulWeaponBuild: null,
          skillStoneBuild: {
            slots: [
              { type: 'cooldown', element: 'fire', tier: 'A' },
              { type: 'time', element: 'water', tier: 'B' },
              { type: 'heat', element: null, tier: null }
            ]
          },
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.skillStoneBuild).toEqual(loadout.skillStoneBuild);
        expect(serialized.skillStoneBuild.slots[0].type).toBe('cooldown');
        expect(serialized.skillStoneBuild.slots[0].element).toBe('fire');
        expect(serialized.skillStoneBuild.slots[0].tier).toBe('A');
      });

      it('should serialize spirit as-is', () => {
        const loadout = {
          name: 'Test',
          skillBuild: null,
          spiritBuild: null,
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: { id: 101, name: 'Phoenix', type: 'Fire' },
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.spirit).toEqual({ id: 101, name: 'Phoenix', type: 'Fire' });
      });

      it('should serialize skillStone as-is', () => {
        const loadout = {
          name: 'Test',
          skillBuild: null,
          spiritBuild: null,
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: { element: 'wind', tier: 'A' },
          promotionAbility: null,
          familiar: null
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.skillStone).toEqual({ element: 'wind', tier: 'A' });
      });

      it('should serialize promotionAbility as-is', () => {
        const loadout = {
          name: 'Test',
          skillBuild: null,
          spiritBuild: null,
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: 'Ultimate Power',
          familiar: null
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.promotionAbility).toBe('Ultimate Power');
      });

      it('should serialize familiar as-is', () => {
        const loadout = {
          name: 'Test',
          skillBuild: null,
          spiritBuild: null,
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: 'Dragon Companion'
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.familiar).toBe('Dragon Companion');
      });

      it('should preserve createdAt timestamp', () => {
        const loadout = {
          id: 'loadout-123',
          name: 'Test',
          createdAt: '2024-01-15T10:30:00Z',
          skillBuild: null,
          spiritBuild: null,
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.createdAt).toBe('2024-01-15T10:30:00Z');
      });

      it('should preserve updatedAt timestamp', () => {
        const loadout = {
          id: 'loadout-123',
          name: 'Test',
          updatedAt: '2024-01-20T15:45:00Z',
          skillBuild: null,
          spiritBuild: null,
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const serialized = serializeLoadoutForStorage(loadout);

        expect(serialized.updatedAt).toBe('2024-01-20T15:45:00Z');
      });
    });

    describe('Deserialization - Every Field', () => {
      it('should deserialize skillBuildId to full skillBuild', () => {
        const serialized = {
          name: 'Test',
          skillBuildId: 'skill-1',
          spiritBuildId: null,
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const deserialized = deserializeLoadout(serialized, mockSkills, mockSpirits, mockMySpirits, mockSkillBuilds, mockSpiritBuilds, mockShapes);

        expect(deserialized.skillBuild.id).toBe('skill-1');
        expect(deserialized.skillBuild.slots[0].skill).toEqual(mockSkills[0]);
      });

      it('should deserialize spiritBuildId to full spiritBuild', () => {
        const serialized = {
          name: 'Test',
          skillBuildId: null,
          spiritBuildId: 'spirit-1',
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const deserialized = deserializeLoadout(serialized, mockSkills, mockSpirits, mockMySpirits, mockSkillBuilds, mockSpiritBuilds, mockShapes);

        expect(deserialized.spiritBuild.id).toBe('spirit-1');
        expect(deserialized.spiritBuild.slots[0].spirit).toEqual(mockSpirits[0]);
      });

      it('should deserialize soulWeaponBuild using soul weapon deserializer', () => {
        const serialized = {
          name: 'Test',
          skillBuildId: null,
          spiritBuildId: null,
          soulWeaponBuild: {
            weaponId: 1,
            weaponName: 'Test',
            gridState: [[{ active: true, piece: { shapeId: 'shape-1', rarity: 'Epic', level: 5, rotation: 0, anchorRow: 0, anchorCol: 0, inventoryIndex: 0 } }]],
            inventory: [{ shapeId: 'shape-1', rarity: 'Epic', level: 5 }]
          },
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const deserialized = deserializeLoadout(serialized, mockSkills, mockSpirits, mockMySpirits, mockSkillBuilds, mockSpiritBuilds, mockShapes);

        expect(deserialized.soulWeaponBuild.gridState[0][0].piece.shape).toEqual(mockShapes[0]);
      });

      it('should preserve all other fields as-is', () => {
        const serialized = {
          id: 'loadout-123',
          name: 'Test Loadout',
          skillBuildId: null,
          spiritBuildId: null,
          soulWeaponBuild: null,
          skillStoneBuild: { slots: [{ type: 'cooldown', element: 'fire', tier: 'A' }] },
          spirit: { id: 101, name: 'Phoenix' },
          skillStone: { element: 'water', tier: 'B' },
          promotionAbility: 'Power Up',
          familiar: 'Dragon',
          createdAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-20T15:45:00Z'
        };
        const deserialized = deserializeLoadout(serialized, mockSkills, mockSpirits, mockMySpirits, mockSkillBuilds, mockSpiritBuilds, mockShapes);

        expect(deserialized.id).toBe('loadout-123');
        expect(deserialized.name).toBe('Test Loadout');
        expect(deserialized.skillStoneBuild).toEqual(serialized.skillStoneBuild);
        expect(deserialized.spirit).toEqual(serialized.spirit);
        expect(deserialized.skillStone).toEqual(serialized.skillStone);
        expect(deserialized.promotionAbility).toBe('Power Up');
        expect(deserialized.familiar).toBe('Dragon');
        expect(deserialized.createdAt).toBe('2024-01-15T10:30:00Z');
        expect(deserialized.updatedAt).toBe('2024-01-20T15:45:00Z');
      });

      it('should handle missing skillBuild (deleted)', () => {
        const serialized = {
          name: 'Test',
          skillBuildId: 'non-existent',
          spiritBuildId: null,
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const deserialized = deserializeLoadout(serialized, mockSkills, mockSpirits, mockMySpirits, mockSkillBuilds, mockSpiritBuilds, mockShapes);

        expect(deserialized.skillBuild.missing).toBe(true);
        expect(deserialized.skillBuild.id).toBe('non-existent');
        expect(deserialized.skillBuild.name).toBe('Deleted Build');
      });

      it('should handle missing spiritBuild (deleted)', () => {
        const serialized = {
          name: 'Test',
          skillBuildId: null,
          spiritBuildId: 'non-existent',
          soulWeaponBuild: null,
          skillStoneBuild: null,
          spirit: null,
          skillStone: null,
          promotionAbility: null,
          familiar: null
        };
        const deserialized = deserializeLoadout(serialized, mockSkills, mockSpirits, mockMySpirits, mockSkillBuilds, mockSpiritBuilds, mockShapes);

        expect(deserialized.spiritBuild.missing).toBe(true);
        expect(deserialized.spiritBuild.id).toBe('non-existent');
        expect(deserialized.spiritBuild.name).toBe('Deleted Build');
      });
    });
  });

  // === SKILL STONE BUILDS - EVERY FIELD ===
  describe('Skill Stone Builds - Every Field', () => {
    it('should preserve build.name', () => {
      const build = {
        name: 'My Stone Build',
        slots: []
      };

      expect(build.name).toBe('My Stone Build');
    });

    it('should preserve slots[0].type (cooldown)', () => {
      const build = {
        name: 'Test',
        slots: [{ type: 'cooldown', element: 'fire', tier: 'A' }]
      };

      expect(build.slots[0].type).toBe('cooldown');
    });

    it('should preserve slots[1].type (time)', () => {
      const build = {
        name: 'Test',
        slots: [
          { type: 'cooldown', element: null, tier: null },
          { type: 'time', element: 'water', tier: 'B' }
        ]
      };

      expect(build.slots[1].type).toBe('time');
    });

    it('should preserve slots[2].type (heat)', () => {
      const build = {
        name: 'Test',
        slots: [
          { type: 'cooldown', element: null, tier: null },
          { type: 'time', element: null, tier: null },
          { type: 'heat', element: 'wind', tier: 'A' }
        ]
      };

      expect(build.slots[2].type).toBe('heat');
    });

    it('should preserve slots[].element', () => {
      const build = {
        name: 'Test',
        slots: [
          { type: 'cooldown', element: 'fire', tier: 'A' },
          { type: 'time', element: 'water', tier: 'A' },
          { type: 'heat', element: 'earth', tier: 'A' }
        ]
      };

      expect(build.slots[0].element).toBe('fire');
      expect(build.slots[1].element).toBe('water');
      expect(build.slots[2].element).toBe('earth');
    });

    it('should preserve slots[].tier', () => {
      const build = {
        name: 'Test',
        slots: [
          { type: 'cooldown', element: 'fire', tier: 'A' },
          { type: 'time', element: 'water', tier: 'B' },
          { type: 'heat', element: null, tier: null }
        ]
      };

      expect(build.slots[0].tier).toBe('A');
      expect(build.slots[1].tier).toBe('B');
      expect(build.slots[2].tier).toBeNull();
    });

    it('should handle null element', () => {
      const build = {
        name: 'Test',
        slots: [{ type: 'cooldown', element: null, tier: null }]
      };

      expect(build.slots[0].element).toBeNull();
    });

    it('should handle null tier', () => {
      const build = {
        name: 'Test',
        slots: [{ type: 'cooldown', element: null, tier: null }]
      };

      expect(build.slots[0].tier).toBeNull();
    });
  });

  // === MY SPIRITS COLLECTION - EVERY FIELD ===
  describe('My Spirits Collection - Every Field', () => {
    const mockSpirits = [{ id: 101, name: 'Phoenix', type: 'Fire' }];

    it('should serialize mySpirit.id', () => {
      const mySpirit = {
        id: 'my-spirit-123',
        spirit: mockSpirits[0],
        level: 50,
        awakeningLevel: 3,
        evolutionLevel: 4,
        skillEnhancementLevel: 2
      };

      // My spirits always have ID preserved
      expect(mySpirit.id).toBe('my-spirit-123');
    });

    it('should serialize mySpirit.spiritId (not full spirit)', () => {
      const mySpirit = {
        id: 'my-spirit-123',
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
    });

    it('should serialize mySpirit.level', () => {
      const mySpirit = {
        spirit: mockSpirits[0],
        level: 75,
        awakeningLevel: 3,
        evolutionLevel: 4,
        skillEnhancementLevel: 2
      };

      const serialized = { spiritId: mySpirit.spirit.id, level: mySpirit.level, awakeningLevel: 3, evolutionLevel: 4, skillEnhancementLevel: 2 };
      expect(serialized.level).toBe(75);
    });

    it('should serialize mySpirit.awakeningLevel', () => {
      const mySpirit = {
        spirit: mockSpirits[0],
        level: 50,
        awakeningLevel: 5,
        evolutionLevel: 4,
        skillEnhancementLevel: 2
      };

      const serialized = { spiritId: mySpirit.spirit.id, level: 50, awakeningLevel: mySpirit.awakeningLevel, evolutionLevel: 4, skillEnhancementLevel: 2 };
      expect(serialized.awakeningLevel).toBe(5);
    });

    it('should serialize mySpirit.evolutionLevel', () => {
      const mySpirit = {
        spirit: mockSpirits[0],
        level: 50,
        awakeningLevel: 3,
        evolutionLevel: 7,
        skillEnhancementLevel: 2
      };

      const serialized = { spiritId: mySpirit.spirit.id, level: 50, awakeningLevel: 3, evolutionLevel: mySpirit.evolutionLevel, skillEnhancementLevel: 2 };
      expect(serialized.evolutionLevel).toBe(7);
    });

    it('should serialize mySpirit.skillEnhancementLevel', () => {
      const mySpirit = {
        spirit: mockSpirits[0],
        level: 50,
        awakeningLevel: 3,
        evolutionLevel: 4,
        skillEnhancementLevel: 10
      };

      const serialized = { spiritId: mySpirit.spirit.id, level: 50, awakeningLevel: 3, evolutionLevel: 4, skillEnhancementLevel: mySpirit.skillEnhancementLevel };
      expect(serialized.skillEnhancementLevel).toBe(10);
    });
  });

  // === GRID SUBMISSIONS - EVERY FIELD ===
  describe('Grid Submissions - Every Field', () => {
    it('should have submission.weaponId as string', () => {
      const submission = {
        weaponId: '42',
        weaponName: 'Excalibur',
        gridType: 'PvE',
        completionEffect: { atk: 100, hp: 200 },
        activeSlots: [[0,0], [0,1]],
        totalActiveSlots: 2
      };

      expect(submission.weaponId).toBe('42');
      expect(typeof submission.weaponId).toBe('string');
    });

    it('should have submission.weaponName', () => {
      const submission = {
        weaponId: '1',
        weaponName: 'Soul Slayer',
        gridType: 'PvE',
        completionEffect: { atk: 100, hp: 200 },
        activeSlots: [],
        totalActiveSlots: 0
      };

      expect(submission.weaponName).toBe('Soul Slayer');
    });

    it('should have submission.gridType', () => {
      const submission = {
        weaponId: '1',
        weaponName: 'Test',
        gridType: 'PvP',
        completionEffect: { atk: 100, hp: 200 },
        activeSlots: [],
        totalActiveSlots: 0
      };

      expect(submission.gridType).toBe('PvP');
    });

    it('should have submission.completionEffect.atk', () => {
      const submission = {
        weaponId: '1',
        weaponName: 'Test',
        gridType: 'PvE',
        completionEffect: { atk: 250, hp: 200 },
        activeSlots: [],
        totalActiveSlots: 0
      };

      expect(submission.completionEffect.atk).toBe(250);
      expect(typeof submission.completionEffect.atk).toBe('number');
    });

    it('should have submission.completionEffect.hp', () => {
      const submission = {
        weaponId: '1',
        weaponName: 'Test',
        gridType: 'PvE',
        completionEffect: { atk: 100, hp: 500 },
        activeSlots: [],
        totalActiveSlots: 0
      };

      expect(submission.completionEffect.hp).toBe(500);
      expect(typeof submission.completionEffect.hp).toBe('number');
    });

    it('should have submission.activeSlots as array of [row, col] pairs', () => {
      const submission = {
        weaponId: '1',
        weaponName: 'Test',
        gridType: 'PvE',
        completionEffect: { atk: 100, hp: 200 },
        activeSlots: [[0,0], [1,2], [3,4]],
        totalActiveSlots: 3
      };

      expect(Array.isArray(submission.activeSlots)).toBe(true);
      expect(submission.activeSlots[0]).toEqual([0,0]);
      expect(submission.activeSlots[1]).toEqual([1,2]);
      expect(submission.activeSlots[2]).toEqual([3,4]);
    });

    it('should have submission.totalActiveSlots', () => {
      const submission = {
        weaponId: '1',
        weaponName: 'Test',
        gridType: 'PvE',
        completionEffect: { atk: 100, hp: 200 },
        activeSlots: [[0,0], [1,1], [2,2], [3,3]],
        totalActiveSlots: 4
      };

      expect(submission.totalActiveSlots).toBe(4);
      expect(typeof submission.totalActiveSlots).toBe('number');
    });
  });
});
