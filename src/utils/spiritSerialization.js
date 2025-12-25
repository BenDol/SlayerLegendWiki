/**
 * Spirit Serialization/Deserialization Utilities
 *
 * Handles conversion between:
 * - Serialized format (spiritId only) - for storage/API
 * - Deserialized format (full spirit object) - for display
 *
 * Usage:
 * - serialize: Before saving to API/cache
 * - deserialize: After loading from API/cache
 */

import { createLogger } from './logger';

const logger = createLogger('SpiritSerialization');

/**
 * Serialize a spirit configuration for storage
 * Converts full spirit object to just ID
 *
 * @param {Object} spiritConfig - Spirit configuration with full spirit object
 * @returns {Object} Serialized spirit with only spiritId
 */
export const serializeSpirit = (spiritConfig) => {
  if (!spiritConfig) return null;

  return {
    spiritId: spiritConfig.spiritId !== undefined ? spiritConfig.spiritId : (spiritConfig.spirit?.id || null),
    level: spiritConfig.level,
    awakeningLevel: spiritConfig.awakeningLevel,
    evolutionLevel: spiritConfig.evolutionLevel,
    skillEnhancementLevel: spiritConfig.skillEnhancementLevel
  };
};

/**
 * Deserialize a spirit configuration
 * Converts spiritId to full spirit object using spirits database
 *
 * @param {Object} serializedSpirit - Serialized spirit with spiritId
 * @param {Array} spiritsData - Full spirits database
 * @param {string|number} recordId - Optional record ID to preserve
 * @returns {Object} Deserialized spirit with full spirit object
 */
export const deserializeSpirit = (serializedSpirit, spiritsData, recordId = null) => {
  if (!serializedSpirit) return null;

  // Check if already deserialized (has spirit object with name)
  if (serializedSpirit.spirit && typeof serializedSpirit.spirit === 'object' && serializedSpirit.spirit.name) {
    return {
      ...serializedSpirit,
      id: recordId || serializedSpirit.id // Preserve record ID
    };
  }

  // Deserialize from ID
  const spirit = spiritsData.find(s => s.id === serializedSpirit.spiritId);
  return {
    id: recordId || serializedSpirit.id, // Preserve record ID for edit/delete
    spirit: spirit || null,
    level: serializedSpirit.level || 1,
    awakeningLevel: serializedSpirit.awakeningLevel || 0,
    evolutionLevel: serializedSpirit.evolutionLevel || 4,
    skillEnhancementLevel: serializedSpirit.skillEnhancementLevel || 0
  };
};

/**
 * Serialize a spirit slot (handles both collection and base types)
 *
 * @param {Object} slot - Spirit slot with full data
 * @returns {Object} Serialized slot
 */
export const serializeSlot = (slot) => {
  if (!slot) {
    return {
      type: "base",
      spiritId: null,
      level: 1,
      awakeningLevel: 0,
      evolutionLevel: 4,
      skillEnhancementLevel: 0
    };
  }

  // If slot has mySpiritId, it's a collection spirit (reference)
  // Check this BEFORE checking spirit, because deleted collection spirits have spirit: null
  if (slot.mySpiritId) {
    return {
      type: "collection",
      mySpiritId: slot.mySpiritId
    };
  }

  // Empty slot (no spirit and no collection reference)
  if (!slot.spirit) {
    return {
      type: "base",
      spiritId: null,
      level: 1,
      awakeningLevel: 0,
      evolutionLevel: 4,
      skillEnhancementLevel: 0
    };
  }

  // Otherwise, it's a base spirit (snapshot)
  return {
    type: "base",
    spiritId: slot.spirit?.id || null,
    level: slot.level,
    awakeningLevel: slot.awakeningLevel,
    evolutionLevel: slot.evolutionLevel,
    skillEnhancementLevel: slot.skillEnhancementLevel
  };
};

/**
 * Deserialize a spirit slot in a build
 * Handles empty slots (spirit: null), serialized slots, and both collection and base types
 *
 * @param {Object} slot - Slot with spiritId or mySpiritId
 * @param {Array} spiritsData - Full spirits database
 * @param {Array} mySpirits - User's spirit collection (optional)
 * @returns {Object} Deserialized slot with full spirit object or null
 */
export const deserializeSlot = (slot, spiritsData, mySpirits = []) => {
  if (!slot) return null;

  // COLLECTION SPIRIT (Reference)
  if (slot.type === "collection" && slot.mySpiritId) {
    const mySpirit = mySpirits.find(s => s.id === slot.mySpiritId);

    if (!mySpirit) {
      // Spirit not found in collection (deleted)
      return {
        type: "collection",
        mySpiritId: slot.mySpiritId,
        spirit: null,
        missing: true,
        level: 1,
        awakeningLevel: 0,
        evolutionLevel: 4,
        skillEnhancementLevel: 0
      };
    }

    // Resolve the base spirit data
    const baseSpirit = spiritsData.find(s => s.id === mySpirit.spiritId);

    return {
      type: "collection",
      mySpiritId: mySpirit.id,
      spirit: baseSpirit || null,
      level: mySpirit.level,
      awakeningLevel: mySpirit.awakeningLevel,
      evolutionLevel: mySpirit.evolutionLevel,
      skillEnhancementLevel: mySpirit.skillEnhancementLevel
    };
  }

  // BASE SPIRIT (Snapshot) - already deserialized
  if (slot.spirit && typeof slot.spirit === 'object' && slot.spirit.name) {
    return {
      type: slot.type || "base",
      spirit: slot.spirit,
      level: slot.level || 1,
      awakeningLevel: slot.awakeningLevel || 0,
      evolutionLevel: slot.evolutionLevel || 4,
      skillEnhancementLevel: slot.skillEnhancementLevel || 0
    };
  }

  // BASE SPIRIT (Snapshot) - needs deserialization (includes migration from old format)
  if (slot.type === "base" || slot.spiritId !== undefined) {
    const spirit = spiritsData.find(s => s.id === slot.spiritId);
    return {
      type: "base",
      spirit: spirit || null,
      level: slot.level || 1,
      awakeningLevel: slot.awakeningLevel || 0,
      evolutionLevel: slot.evolutionLevel || 4,
      skillEnhancementLevel: slot.skillEnhancementLevel || 0
    };
  }

  // Empty slot
  return {
    type: "base",
    spirit: null,
    level: slot.level || 1,
    awakeningLevel: slot.awakeningLevel || 0,
    evolutionLevel: slot.evolutionLevel || 4,
    skillEnhancementLevel: slot.skillEnhancementLevel || 0
  };
};

/**
 * Deserialize a spirit build
 * Converts all slots with spiritId or mySpiritId to full spirit objects
 *
 * @param {Object} build - Build with serialized slots
 * @param {Array} spiritsData - Full spirits database
 * @param {Array} mySpirits - User's spirit collection (optional)
 * @returns {Object} Deserialized build with full spirit objects
 */
export const deserializeBuild = (build, spiritsData, mySpirits = []) => {
  if (!build) return null;

  return {
    ...build,
    slots: build.slots?.map(slot => deserializeSlot(slot, spiritsData, mySpirits)) || []
  };
};

/**
 * Serialize a spirit build
 * Converts all slots with full spirit objects to appropriate format (collection or base)
 *
 * @param {Object} build - Build with full spirit objects
 * @returns {Object} Serialized build with only necessary data
 */
export const serializeBuild = (build) => {
  if (!build) return null;

  return {
    ...build,
    slots: build.slots?.map(slot => serializeSlot(slot)) || []
  };
};

/**
 * Serialize a spirit slot for sharing (always use base format, never collection)
 * Recipients won't have access to collection IDs, so convert everything to base snapshots
 *
 * @param {Object} slot - Spirit slot with full data
 * @returns {Object} Serialized slot in base format
 */
export const serializeSlotForSharing = (slot) => {
  if (!slot || !slot.spirit) {
    return {
      type: "base",
      spiritId: null,
      level: 1,
      awakeningLevel: 0,
      evolutionLevel: 4,
      skillEnhancementLevel: 0
    };
  }

  // Always convert to base format (including collection spirits)
  return {
    type: "base",
    spiritId: slot.spirit?.id || null,
    level: slot.level,
    awakeningLevel: slot.awakeningLevel,
    evolutionLevel: slot.evolutionLevel,
    skillEnhancementLevel: slot.skillEnhancementLevel
  };
};

/**
 * Serialize a spirit build for sharing
 * Converts all slots to base format so recipients can see them without collection access
 *
 * @param {Object} build - Build with full spirit objects
 * @returns {Object} Serialized build with base spirits only
 */
export const serializeBuildForSharing = (build) => {
  if (!build) return null;

  return {
    ...build,
    slots: build.slots?.map(slot => serializeSlotForSharing(slot)) || []
  };
};

/**
 * Load spirits database from JSON
 * @returns {Promise<Array>} Spirits database
 */
export const loadSpiritsDatabase = async () => {
  try {
    const response = await fetch('/data/spirit-characters.json');
    const data = await response.json();
    return data.spirits || [];
  } catch (error) {
    logger.error('[spiritSerialization] Failed to load spirits database:', error);
    return [];
  }
};
