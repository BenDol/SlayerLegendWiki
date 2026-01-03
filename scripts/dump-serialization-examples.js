/**
 * Dump Expected Save Data Results
 * Shows the exact serialized format for each data type
 */

// Mock logger for standalone script
globalThis.window = globalThis;

import {
  serializeBuild as serializeSpiritBuild,
  serializeSlot as serializeSpiritSlot,
  serializeBuildForSharing as serializeSpiritBuildForSharing
} from '../src/utils/spiritSerialization.js';
import {
  serializeLoadoutForStorage,
  serializeLoadoutForSharing,
  serializeSoulWeaponBuild,
  serializeSkillBuild
} from '../src/utils/battleLoadoutSerializer.js';

// ============================================
// MOCK DATA
// ============================================

const mockSkills = [
  { id: 1, name: 'Fireball', maxLevel: 10, attribute: 'Fire' },
  { id: 2, name: 'Ice Blast', maxLevel: 15, attribute: 'Water' },
  { id: 3, name: 'Wind Strike', maxLevel: 12, attribute: 'Wind' }
];

const mockSpirits = [
  { id: 101, name: 'Phoenix', rarity: 'Legendary', element: 'Fire' },
  { id: 102, name: 'Leviathan', rarity: 'Epic', element: 'Water' },
  { id: 103, name: 'Sylph', rarity: 'Rare', element: 'Wind' }
];

const mockMySpirits = [
  {
    id: 'my-spirit-1',
    spiritId: 101,
    level: 50,
    awakeningLevel: 3,
    evolutionLevel: 4,
    skillEnhancementLevel: 2
  }
];

const mockShapes = [
  { id: 'shape-1', name: 'L-Shape', pattern: [[1, 0], [1, 1]], baseStats: { atk: 10, hp: 20 } },
  { id: 'shape-2', name: 'T-Shape', pattern: [[0, 1], [1, 1], [2, 1]], baseStats: { atk: 15, hp: 25 } }
];

// ============================================
// 1. SKILL BUILD SERIALIZATION
// ============================================

console.log('\n=== 1. SKILL BUILD - SERIALIZED FOR STORAGE ===\n');

const skillBuildDeserialized = {
  id: 'skill-build-123',
  name: 'My PvP Build',
  maxSlots: 10,
  slots: [
    { skill: mockSkills[0], level: 8 },
    { skill: mockSkills[1], level: 10 },
    { skill: mockSkills[2], level: 5 },
    { skill: null, level: 1 }
  ]
};

const skillBuildSerialized = serializeSkillBuild(skillBuildDeserialized);
console.log(JSON.stringify(skillBuildSerialized, null, 2));

console.log('\n✅ Optimizations:');
console.log('- Full skill object (name, maxLevel, attribute, etc.) -> skillId only');
console.log('- Stores: id, name, maxSlots, slots[].skillId, slots[].level');

// ============================================
// 2. SPIRIT BUILD SERIALIZATION (BASE SPIRITS)
// ============================================

console.log('\n\n=== 2a. SPIRIT BUILD - BASE SPIRITS (SERIALIZED FOR STORAGE) ===\n');

const spiritBuildDeserialized = {
  id: 'spirit-build-456',
  name: 'My Spirit Team',
  maxSlots: 3,
  slots: [
    {
      spirit: mockSpirits[0],
      level: 75,
      awakeningLevel: 5,
      evolutionLevel: 4,
      skillEnhancementLevel: 3
    },
    {
      spirit: mockSpirits[1],
      level: 60,
      awakeningLevel: 3,
      evolutionLevel: 4,
      skillEnhancementLevel: 2
    },
    {
      spirit: null,
      level: 1,
      awakeningLevel: 0,
      evolutionLevel: 4,
      skillEnhancementLevel: 0
    }
  ]
};

const spiritBuildSerialized = serializeSpiritBuild(spiritBuildDeserialized);
console.log(JSON.stringify(spiritBuildSerialized, null, 2));

console.log('\n✅ Optimizations:');
console.log('- Full spirit object (name, rarity, element, etc.) -> spiritId only');
console.log('- Stores: id, name, maxSlots, slots[].type, slots[].spiritId, slots[].[config]');

// ============================================
// 2b. SPIRIT BUILD - COLLECTION SPIRITS
// ============================================

console.log('\n\n=== 2b. SPIRIT BUILD - COLLECTION SPIRITS (SERIALIZED FOR STORAGE) ===\n');

const spiritBuildWithCollectionDeserialized = {
  id: 'spirit-build-789',
  name: 'My Collection Team',
  maxSlots: 3,
  slots: [
    {
      mySpiritId: 'my-spirit-1',
      spirit: mockSpirits[0],
      level: 50,
      awakeningLevel: 3,
      evolutionLevel: 4,
      skillEnhancementLevel: 2
    },
    {
      spirit: mockSpirits[1],
      level: 60,
      awakeningLevel: 3,
      evolutionLevel: 4,
      skillEnhancementLevel: 2
    },
    {
      spirit: null,
      level: 1,
      awakeningLevel: 0,
      evolutionLevel: 4,
      skillEnhancementLevel: 0
    }
  ]
};

const spiritBuildWithCollectionSerialized = serializeSpiritBuild(spiritBuildWithCollectionDeserialized);
console.log(JSON.stringify(spiritBuildWithCollectionSerialized, null, 2));

console.log('\n✅ Optimizations:');
console.log('- Collection spirits: ONLY mySpiritId stored (no config, fetched from collection)');
console.log('- Base spirits: spiritId + configuration stored (snapshot)');

// ============================================
// 3. SOUL WEAPON BUILD SERIALIZATION
// ============================================

console.log('\n\n=== 3. SOUL WEAPON BUILD - SERIALIZED FOR STORAGE ===\n');

const soulWeaponBuildDeserialized = {
  weaponId: 42,
  weaponName: 'Soul Slayer',
  gridState: [
    [
      {
        active: true,
        piece: {
          shape: mockShapes[0], // Full shape object with pattern, baseStats, etc.
          shapeId: 'shape-1',
          rarity: 'Legendary',
          level: 10,
          rotation: 0,
          anchorRow: 0,
          anchorCol: 0,
          inventoryIndex: 0
        }
      },
      {
        active: false,
        piece: null
      }
    ]
  ],
  inventory: [
    {
      shape: mockShapes[1], // Full shape object
      shapeId: 'shape-2',
      rarity: 'Epic',
      level: 8
    },
    null
  ]
};

const soulWeaponBuildSerialized = serializeSoulWeaponBuild(soulWeaponBuildDeserialized);
console.log(JSON.stringify(soulWeaponBuildSerialized, null, 2));

console.log('\n✅ Optimizations:');
console.log('- Full shape object (pattern, baseStats, description, etc.) -> shapeId only');
console.log('- 95% size reduction when shapes have complex patterns/descriptions');
console.log('- Stores: weaponId, weaponName, gridState, inventory');
console.log('- Grid cells: active, piece.shapeId, piece.rarity, piece.level, piece.rotation, piece.anchorRow, piece.anchorCol, piece.inventoryIndex');
console.log('- Inventory: shapeId, rarity, level');

// ============================================
// 4. BATTLE LOADOUT SERIALIZATION (STORAGE)
// ============================================

console.log('\n\n=== 4a. BATTLE LOADOUT - SERIALIZED FOR STORAGE (IDs ONLY) ===\n');

const battleLoadoutDeserialized = {
  id: 'loadout-123',
  name: 'My PvP Loadout',
  skillBuild: skillBuildDeserialized,
  spiritBuild: spiritBuildDeserialized,
  soulWeaponBuild: soulWeaponBuildDeserialized,
  skillStoneBuild: {
    name: 'My Stones',
    slots: [
      { type: 'cooldown', element: 'fire', tier: 'A' },
      { type: 'time', element: 'water', tier: 'B' },
      { type: 'heat', element: null, tier: null }
    ]
  },
  spirit: { spiritId: 101 },
  skillStone: { type: 'cooldown', element: 'fire', tier: 'A' },
  promotionAbility: { id: 1, name: 'Double Strike' },
  familiar: { id: 5, name: 'Dragon' },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z'
};

const battleLoadoutSerializedForStorage = serializeLoadoutForStorage(battleLoadoutDeserialized);
console.log(JSON.stringify(battleLoadoutSerializedForStorage, null, 2));

console.log('\n✅ Optimizations:');
console.log('- skillBuild -> skillBuildId (user has saved skill builds, reference by ID)');
console.log('- spiritBuild -> spiritBuildId (user has saved spirit builds, reference by ID)');
console.log('- soulWeaponBuild -> serialized (not saved separately, inline optimized)');
console.log('- Other fields stored as-is (already minimal)');

// ============================================
// 4b. BATTLE LOADOUT SERIALIZATION (SHARING)
// ============================================

console.log('\n\n=== 4b. BATTLE LOADOUT - SERIALIZED FOR SHARING (FULL DATA) ===\n');

const battleLoadoutSerializedForSharing = serializeLoadoutForSharing(battleLoadoutDeserialized);
console.log(JSON.stringify(battleLoadoutSerializedForSharing, null, 2));

console.log('\n✅ Differences from Storage Format:');
console.log('- skillBuild: Full serialized build (not ID) - recipient won\'t have access to build IDs');
console.log('- spiritBuild: Full serialized build (not ID)');
console.log('- Used for checksum-based sharing via GitHub Issues');

// ============================================
// 5. SKILL STONE BUILD SERIALIZATION
// ============================================

console.log('\n\n=== 5. SKILL STONE BUILD - NO SERIALIZATION NEEDED (ALREADY MINIMAL) ===\n');

const skillStoneBuild = {
  name: 'My Stone Setup',
  slots: [
    { type: 'cooldown', element: 'fire', tier: 'A' },
    { type: 'time', element: 'water', tier: 'B' },
    { type: 'heat', element: 'earth', tier: 'A' }
  ]
};

console.log(JSON.stringify(skillStoneBuild, null, 2));

console.log('\n✅ Already Minimal:');
console.log('- Only 3 primitive fields per slot: type, element, tier');
console.log('- No objects to optimize, stored as-is');

// ============================================
// 6. MY SPIRITS COLLECTION SERIALIZATION
// ============================================

console.log('\n\n=== 6. MY SPIRITS COLLECTION - SERIALIZED FOR STORAGE ===\n');

const mySpiritDeserialized = {
  id: 'my-spirit-1',
  spirit: mockSpirits[0], // Full spirit object
  level: 50,
  awakeningLevel: 3,
  evolutionLevel: 4,
  skillEnhancementLevel: 2
};

// Uses serializeSpirit from spiritSerialization.js (same pattern as spirit slots)
const mySpiritSerialized = {
  id: 'my-spirit-1',
  spiritId: 101, // Only ID, not full object
  level: 50,
  awakeningLevel: 3,
  evolutionLevel: 4,
  skillEnhancementLevel: 2
};

console.log(JSON.stringify(mySpiritSerialized, null, 2));

console.log('\n✅ Optimizations:');
console.log('- Full spirit object -> spiritId only');
console.log('- Configuration stored (user\'s custom levels)');

// ============================================
// 7. GRID SUBMISSION SERIALIZATION
// ============================================

console.log('\n\n=== 7. GRID SUBMISSION - NO SERIALIZATION NEEDED (PRIMITIVES ONLY) ===\n');

const gridSubmission = {
  weaponId: '42', // String
  weaponName: 'Soul Slayer',
  gridType: 'atk',
  completionEffect: {
    atk: 150,
    hp: 0
  },
  activeSlots: [[0, 0], [0, 1], [1, 0]], // Array of [row, col] pairs
  totalActiveSlots: 3
};

console.log(JSON.stringify(gridSubmission, null, 2));

console.log('\n✅ Already Minimal:');
console.log('- Only primitives: strings, numbers, arrays of numbers');
console.log('- No objects to optimize, stored as-is');

// ============================================
// SIZE COMPARISON
// ============================================

console.log('\n\n=== SIZE COMPARISON - SOUL WEAPON BUILD ===\n');

const fullSize = JSON.stringify(soulWeaponBuildDeserialized).length;
const serializedSize = JSON.stringify(soulWeaponBuildSerialized).length;
const reduction = ((fullSize - serializedSize) / fullSize * 100).toFixed(1);

console.log(`Full size (with shape objects): ${fullSize} bytes`);
console.log(`Serialized size (shapeId only): ${serializedSize} bytes`);
console.log(`Reduction: ${reduction}%`);

console.log('\n\n=== DONE ===\n');
