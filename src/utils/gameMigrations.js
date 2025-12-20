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
    matcher: (key) => key === 'soulWeapon_highestUnlocked' || key === 'soul_weapon_highest',
    migrator: (key) => {
      // This is global (not user-specific) configuration
      return 'config:soul_weapon_highest';
    },
  },

  // Builder draft keys (Skill Builder, Spirit Builder, Battle Loadouts, Soul Weapon Engraving)
  {
    name: 'draft keys (old format: builderName_draft_userId)',
    matcher: (key) => /^(skillBuilder|spiritBuilder|battleLoadouts|soulWeaponEngraving)_draft_(.+)$/.test(key),
    migrator: (key) => {
      const match = key.match(/^(skillBuilder|spiritBuilder|battleLoadouts|soulWeaponEngraving)_draft_(.+)$/);
      if (!match) return key;

      const [, builder, userId] = match;
      const builderName = builder
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
      return `cache:${userId}:draft:${builderName}`;
    },
  },
  {
    name: 'draft keys (current format: cache:userId:name_draft)',
    matcher: (key) => /^cache:(.+?):(skill_builder|spirit_builder|battle_loadouts|soul_weapon_engraving)_draft$/.test(key),
    migrator: (key) => {
      const match = key.match(/^cache:(.+?):(skill_builder|spirit_builder|battle_loadouts|soul_weapon_engraving)_draft$/);
      if (!match) return key;

      const [, userId, cacheName] = match;
      return `cache:${userId}:draft:${cacheName}`;
    },
  },

  // Build cache keys (skill-builds, battle-loadouts, spirit-builds, my-spirits)
  {
    name: 'build cache keys (skill-builds, battle-loadouts, spirit-builds, my-spirits)',
    matcher: (key) => /^(skill-builds|battle-loadouts|spirit-builds|my-spirits):(.+)$/.test(key),
    migrator: (key) => {
      const match = key.match(/^(skill-builds|battle-loadouts|spirit-builds|my-spirits):(.+)$/);
      if (!match) return key;

      const [, type, userId] = match;
      const cacheName = type.replace(/-/g, '_');
      return `cache:${userId}:${cacheName}`;
    },
  },

  // Spirit sprite cache keys
  {
    name: 'spirit sprite animation cache',
    matcher: (key) => key === 'spiritSprite_animationCache',
    migrator: (key) => 'cache:spirit_sprite_animation',
  },
  {
    name: 'spirit sprite image meta cache',
    matcher: (key) => key === 'spiritSprite_imageCacheMeta',
    migrator: (key) => 'cache:spirit_sprite_image_meta',
  },
];

export default gameMigrations;
