/**
 * Game-Specific Storage Migrations
 * Migrations for Slayer Legend-specific localStorage keys
 * These are registered with the framework's migration system
 */

/**
 * Slayer Legend game-specific migrations
 */
export const gameMigrations = [
  // Soul Weapon Engraving caches
  {
    name: 'soulWeaponEngraving_submissionsCache',
    matcher: (key) => key === 'soulWeaponEngraving_submissionsCache',
    migrator: (key) => 'cache:soul_weapon_submissions',
  },
  {
    name: 'soulWeaponEngraving_bestWeaponCache',
    matcher: (key) => key === 'soulWeaponEngraving_bestWeaponCache',
    migrator: (key) => 'cache:soul_weapon_best',
  },
  {
    name: 'soulWeapon_highestUnlocked',
    matcher: (key) => key === 'soulWeapon_highestUnlocked',
    migrator: (key) => {
      // This needs user context, we'll use 'anonymous' as fallback
      // In actual usage, this should be migrated with proper user context
      return 'cache:anonymous:soul_weapon_highest';
    },
  },

  // Builder draft keys (Skill Builder, Spirit Builder, Battle Loadouts)
  {
    name: 'draft keys (skillBuilder, spiritBuilder, battleLoadouts)',
    matcher: (key) => /^(skillBuilder|spiritBuilder|battleLoadouts)_draft_(.+)$/.test(key),
    migrator: (key) => {
      const match = key.match(/^(skillBuilder|spiritBuilder|battleLoadouts)_draft_(.+)$/);
      if (!match) return key;

      const [, builder, userId] = match;
      const builderName = builder
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
      return `cache:${userId}:${builderName}_draft`;
    },
  },

  // Build cache keys (skill-builds, battle-loadouts)
  {
    name: 'build cache keys (skill-builds, battle-loadouts)',
    matcher: (key) => /^(skill-builds|battle-loadouts):(.+)$/.test(key),
    migrator: (key) => {
      const match = key.match(/^(skill-builds|battle-loadouts):(.+)$/);
      if (!match) return key;

      const [, type, userId] = match;
      const cacheName = type.replace(/-/g, '_');
      return `cache:${userId}:${cacheName}`;
    },
  },
];

export default gameMigrations;
