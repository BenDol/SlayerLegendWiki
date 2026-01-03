/**
 * Battle Loadout Serialization/Deserialization Utilities
 *
 * Handles conversion between:
 * - Serialized format (build IDs only) - for storage/API
 * - Deserialized format (full build objects) - for display
 * - Share format (full serialized builds) - for sharing via checksum
 * - Encoded format (base64) - for URL parameters
 *
 * Usage:
 * - serializeForStorage: Before saving to API/cache (uses build IDs)
 * - serializeForSharing: Before sharing via buildShare service (full objects)
 * - deserializeLoadout: After loading from API/cache (resolves IDs to objects)
 * - encodeLoadout/decodeLoadout: For URL parameters
 */

import { createLogger } from './logger.js';
import { serializeBuild, deserializeBuild, serializeBuildForSharing } from './spiritSerialization.js';

const logger = createLogger('BattleLoadoutSerializer');

/**
 * Serialize skill build for storage (skill objects -> skill IDs)
 *
 * @param {Object} build - Skill build with full skill objects
 * @returns {Object} Serialized build with skill IDs only
 */
export const serializeSkillBuild = (build) => {
  if (!build) return null;
  return {
    id: build.id,
    name: build.name,
    maxSlots: build.maxSlots,
    slots: build.slots.map(slot => ({
      skillId: slot.skillId !== undefined ? slot.skillId : (slot.skill?.id || null),
      level: slot.level
    }))
  };
};

/**
 * Deserialize skill build (skill IDs -> full skill objects)
 *
 * @param {Object} build - Serialized skill build
 * @param {Array} skillsArray - Array of all skills
 * @returns {Object} Deserialized build with full skill objects
 */
export const deserializeSkillBuild = (build, skillsArray) => {
  if (!build) return null;

  logger.debug('deserializeSkillBuild input', {
    buildId: build.id,
    buildName: build.name,
    hasSlots: !!build.slots,
    slotsCount: build.slots?.length
  });

  const deserialized = {
    ...build,
    slots: build.slots.map(slot => {
      if (slot.skillId !== undefined) {
        const skill = skillsArray.find(s => s.id === slot.skillId);
        return {
          skill: skill || null,
          level: slot.level || 1
        };
      } else if (slot.skill) {
        // Already deserialized or partial data
        let skill = skillsArray.find(s => s.id === slot.skill.id);
        if (!skill) {
          skill = skillsArray.find(s => s.name === slot.skill.name);
        }
        return {
          skill: skill || slot.skill,
          level: slot.level || 1
        };
      } else {
        return { skill: null, level: 1 };
      }
    })
  };

  logger.debug('deserializeSkillBuild output', {
    deserializedId: deserialized.id,
    deserializedName: deserialized.name,
    deserializedMaxSlots: deserialized.maxSlots,
    deserializedSlotsCount: deserialized.slots?.length
  });

  return deserialized;
};

/**
 * Serialize spirit build for storage (spirit objects -> spirit IDs)
 * Uses shared serialization utility
 *
 * @param {Object} build - Spirit build with full spirit objects
 * @returns {Object} Serialized build
 */
export const serializeSpiritBuild = (build) => {
  if (!build) return null;
  return serializeBuild(build);
};

/**
 * Serialize soul weapon build by stripping redundant shape definitions
 *
 * @param {Object} build - Soul weapon build with full shape objects
 * @returns {Object} Serialized build with minimal data
 */
export const serializeSoulWeaponBuild = (build) => {
  if (!build) return null;

  return {
    weaponId: build.weaponId,
    weaponName: build.weaponName,
    gridState: build.gridState?.map(row =>
      row.map(cell => {
        if (!cell || !cell.piece) {
          return { active: cell?.active || false, piece: null };
        }
        // Strip out full shape object, keep only essential piece data
        return {
          active: cell.active,
          piece: {
            shapeId: cell.piece.shapeId,
            rarity: cell.piece.rarity,
            level: cell.piece.level,
            rotation: cell.piece.rotation,
            anchorRow: cell.piece.anchorRow,
            anchorCol: cell.piece.anchorCol,
            inventoryIndex: cell.piece.inventoryIndex
          }
        };
      })
    ) || [],
    inventory: build.inventory?.map(item => {
      if (!item) return null;
      // Strip out full shape object, keep only essential item data
      return {
        shapeId: item.shapeId,
        rarity: item.rarity,
        level: item.level
      };
    }) || []
  };
};

/**
 * Deserialize spirit build (spirit IDs -> full spirit objects)
 * Uses shared deserialization utility
 *
 * @param {Object} build - Serialized spirit build
 * @param {Array} spiritsArray - Array of all spirits
 * @param {Array} mySpiritsArray - Array of user's collection spirits
 * @returns {Object} Deserialized build with full spirit objects
 */
export const deserializeSpiritBuild = (build, spiritsArray, mySpiritsArray = []) => {
  if (!build) return null;
  return deserializeBuild(build, spiritsArray, mySpiritsArray);
};

/**
 * Deserialize soul weapon build by reconstructing shape objects
 *
 * @param {Object} build - Serialized soul weapon build
 * @param {Array} shapesArray - Array of all engraving shapes
 * @returns {Object} Deserialized build with full shape objects
 */
export const deserializeSoulWeaponBuild = (build, shapesArray) => {
  if (!build) return null;

  return {
    ...build,
    gridState: build.gridState?.map(row =>
      row.map(cell => {
        if (!cell || !cell.piece) {
          // Empty cell - preserve active state (indicates if cell is part of weapon grid)
          return { active: cell?.active || false, piece: null };
        }
        // Reconstruct full shape object from shapeId
        const shape = shapesArray.find(s => s.id === cell.piece.shapeId);
        if (!shape) {
          // Shape not found - data corruption, mark as inactive
          logger.warn('Shape not found', { shapeId: cell.piece.shapeId });
          return { active: false, piece: null };
        }
        return {
          active: cell.active,
          piece: {
            ...cell.piece,
            shape: shape
          }
        };
      })
    ) || [],
    inventory: build.inventory?.map(item => {
      if (!item) return null;
      // Reconstruct full shape object from shapeId
      const shape = shapesArray.find(s => s.id === item.shapeId);
      if (!shape) {
        logger.warn('Shape not found in inventory', { shapeId: item.shapeId });
        return null;
      }
      return {
        ...item,
        shape: shape
      };
    }) || []
  };
};

/**
 * Serialize loadout for storage (uses build IDs, not full builds)
 * Optimized for API storage - stores references to saved builds
 *
 * @param {Object} loadout - Loadout with deserialized builds
 * @returns {Object} Serialized loadout with build IDs only
 */
export const serializeLoadoutForStorage = (loadout) => {
  if (!loadout) return null;

  const serialized = {
    name: loadout.name,
    skillBuildId: loadout.skillBuild?.id || null,
    spiritBuildId: loadout.spiritBuild?.id || null,
    soulWeaponBuild: loadout.soulWeaponBuild ? serializeSoulWeaponBuild(loadout.soulWeaponBuild) : null,
    skillStoneBuild: loadout.skillStoneBuild || null,
    spirit: loadout.spirit || null,
    skillStone: loadout.skillStone || null,
    promotionAbility: loadout.promotionAbility || null,
    familiar: loadout.familiar || null
  };

  // Preserve ID and timestamps if they exist
  if (loadout.id) serialized.id = loadout.id;
  if (loadout.createdAt) serialized.createdAt = loadout.createdAt;
  if (loadout.updatedAt) serialized.updatedAt = loadout.updatedAt;

  return serialized;
};

/**
 * Serialize loadout for sharing (uses full build objects, not IDs)
 * Recipients won't have access to build IDs, so include full data
 *
 * @param {Object} loadout - Loadout with deserialized builds
 * @returns {Object} Serialized loadout with full build data
 */
export const serializeLoadoutForSharing = (loadout) => {
  if (!loadout) return null;

  return {
    name: loadout.name,
    skillBuild: loadout.skillBuild ? serializeSkillBuild(loadout.skillBuild) : null,
    spiritBuild: loadout.spiritBuild ? serializeBuildForSharing(loadout.spiritBuild) : null,
    soulWeaponBuild: loadout.soulWeaponBuild ? serializeSoulWeaponBuild(loadout.soulWeaponBuild) : null,
    skillStoneBuild: loadout.skillStoneBuild || null,
    spirit: loadout.spirit || null,
    skillStone: loadout.skillStone || null,
    promotionAbility: loadout.promotionAbility || null,
    familiar: loadout.familiar || null
  };
};

/**
 * Deserialize loadout (resolves build IDs to full objects)
 * Handles both storage format (IDs) and share format (full objects)
 *
 * @param {Object} loadout - Serialized loadout
 * @param {Array} skills - All skills data
 * @param {Array} spirits - All spirits data
 * @param {Array} mySpirits - User's spirit collection
 * @param {Array} allSkillBuilds - All saved skill builds (for ID resolution)
 * @param {Array} allSpiritBuilds - All saved spirit builds (for ID resolution)
 * @param {Array} shapes - All engraving shapes (for soul weapon deserialization)
 * @returns {Object} Deserialized loadout with full build objects
 */
export const deserializeLoadout = (
  loadout,
  skills = [],
  spirits = [],
  mySpirits = [],
  allSkillBuilds = [],
  allSpiritBuilds = [],
  shapes = []
) => {
  if (!loadout) return null;

  let skillBuild = null;
  let spiritBuild = null;
  let soulWeaponBuild = null;

  // Resolve skill build
  if (loadout.skillBuildId) {
    // Storage format: resolve ID to build
    const found = allSkillBuilds.find(b => b.id === loadout.skillBuildId);
    if (found) {
      skillBuild = deserializeSkillBuild(found, skills);
    } else {
      // Build not found - mark as missing
      skillBuild = {
        missing: true,
        id: loadout.skillBuildId,
        name: 'Deleted Build',
        maxSlots: 10,
        slots: []
      };
      logger.warn('Skill build not found', { buildId: loadout.skillBuildId });
    }
  } else if (loadout.skillBuild) {
    // Share format or embedded: already has full build data
    skillBuild = deserializeSkillBuild(loadout.skillBuild, skills);
  }

  // Resolve spirit build
  if (loadout.spiritBuildId) {
    // Storage format: resolve ID to build
    const found = allSpiritBuilds.find(b => b.id === loadout.spiritBuildId);
    if (found) {
      spiritBuild = deserializeSpiritBuild(found, spirits, mySpirits);
    } else {
      // Build not found - mark as missing
      spiritBuild = {
        missing: true,
        id: loadout.spiritBuildId,
        name: 'Deleted Build',
        maxSlots: 3,
        slots: []
      };
      logger.warn('Spirit build not found', { buildId: loadout.spiritBuildId });
    }
  } else if (loadout.spiritBuild) {
    // Share format or embedded: already has full build data
    spiritBuild = deserializeSpiritBuild(loadout.spiritBuild, spirits, mySpirits);
  }

  // Deserialize soul weapon build (reconstruct shape objects if needed)
  if (loadout.soulWeaponBuild && shapes.length > 0) {
    soulWeaponBuild = deserializeSoulWeaponBuild(loadout.soulWeaponBuild, shapes);
  } else {
    soulWeaponBuild = loadout.soulWeaponBuild;
  }

  return {
    ...loadout,
    skillBuild,
    spiritBuild,
    soulWeaponBuild
  };
};

/**
 * Encode loadout for URL parameters (base64)
 *
 * @param {Object} loadout - Loadout object
 * @returns {string} Base64 encoded string
 */
export const encodeLoadout = (loadout) => {
  if (!loadout) return '';
  try {
    const serialized = serializeLoadoutForSharing(loadout);
    const json = JSON.stringify(serialized);
    return btoa(unescape(encodeURIComponent(json)));
  } catch (error) {
    logger.error('Failed to encode loadout', { error });
    return '';
  }
};

/**
 * Decode loadout from URL parameters (base64)
 *
 * @param {string} encoded - Base64 encoded string
 * @returns {Object|null} Decoded loadout object
 */
export const decodeLoadout = (encoded) => {
  if (!encoded) return null;
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch (error) {
    logger.error('Failed to decode loadout', { error });
    return null;
  }
};

/**
 * Check if identifier is a loadout ID (UUID format) vs checksum (hex)
 *
 * @param {string} identifier - Identifier string
 * @returns {boolean} True if UUID format, false if checksum
 */
export const isLoadoutId = (identifier) => {
  if (!identifier) return false;
  // UUID format: loadout-123456789, battle-loadouts-timestamp-random, or uuid-v4 format
  return identifier.startsWith('loadout-') ||
         identifier.startsWith('battle-loadouts-') ||
         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
};
