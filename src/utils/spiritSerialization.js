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
 * Deserialize a spirit slot in a build
 * Handles empty slots (spirit: null) and serialized slots
 *
 * @param {Object} slot - Slot with spiritId or null
 * @param {Array} spiritsData - Full spirits database
 * @returns {Object} Deserialized slot with full spirit object or null
 */
export const deserializeSlot = (slot, spiritsData) => {
  if (!slot) return null;

  // Check if already deserialized (has full spirit object with name)
  if (slot.spirit && typeof slot.spirit === 'object' && slot.spirit.name) {
    return slot;
  }

  // Deserialize from spiritId - create clean structure
  if (slot.spiritId !== undefined) {
    const spirit = spiritsData.find(s => s.id === slot.spiritId);
    return {
      spirit: spirit || null,
      level: slot.level || 1,
      awakeningLevel: slot.awakeningLevel || 0,
      evolutionLevel: slot.evolutionLevel || 4,
      skillEnhancementLevel: slot.skillEnhancementLevel || 0
    };
  }

  // Empty slot or already has spirit: null
  return {
    spirit: null,
    level: slot.level || 1,
    awakeningLevel: slot.awakeningLevel || 0,
    evolutionLevel: slot.evolutionLevel || 4,
    skillEnhancementLevel: slot.skillEnhancementLevel || 0
  };
};

/**
 * Deserialize a spirit build
 * Converts all slots with spiritId to full spirit objects
 *
 * @param {Object} build - Build with serialized slots
 * @param {Array} spiritsData - Full spirits database
 * @returns {Object} Deserialized build with full spirit objects
 */
export const deserializeBuild = (build, spiritsData) => {
  if (!build) return null;

  return {
    ...build,
    slots: build.slots?.map(slot => deserializeSlot(slot, spiritsData)) || []
  };
};

/**
 * Serialize a spirit build
 * Converts all slots with full spirit objects to spiritId only
 *
 * @param {Object} build - Build with full spirit objects
 * @returns {Object} Serialized build with only spiritIds
 */
export const serializeBuild = (build) => {
  if (!build) return null;

  return {
    ...build,
    slots: build.slots?.map(slot => {
      if (!slot) return slot;

      // Always create clean structure with only necessary fields
      return {
        spiritId: slot.spiritId !== undefined ? slot.spiritId : (slot.spirit?.id || null),
        level: slot.level,
        awakeningLevel: slot.awakeningLevel,
        evolutionLevel: slot.evolutionLevel,
        skillEnhancementLevel: slot.skillEnhancementLevel
      };
    }) || []
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
