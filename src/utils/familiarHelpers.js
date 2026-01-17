/**
 * Familiar Helper Functions
 *
 * Utilities for working with familiars, Prime Familiars, and star levels
 */

import { createLogger } from './logger.js';

const logger = createLogger('FamiliarHelpers');

/**
 * Find a Prime Familiar based on the combination of 3 base familiars
 * Returns a predefined Prime Familiar if found, otherwise generates a custom one
 *
 * @param {number} elementFamiliarId - ID of familiar in element slot
 * @param {number} attributeFamiliarId - ID of familiar in attribute slot
 * @param {number} weaponFamiliarId - ID of familiar in weapon slot
 * @param {Array} primeFamiliarsData - Array of Prime Familiar definitions
 * @param {Array} familiarsData - Array of base familiar data (for name generation)
 * @returns {Object} Prime Familiar object (predefined or custom)
 */
export const findPrimeFamiliar = (elementFamiliarId, attributeFamiliarId, weaponFamiliarId, primeFamiliarsData, familiarsData = null) => {
  // If any familiar is missing, return null
  if (!elementFamiliarId || !attributeFamiliarId || !weaponFamiliarId) {
    return null;
  }

  // Try to find exact match in predefined Prime Familiars
  const exactMatch = primeFamiliarsData?.find(pf =>
    pf.combination.elementFamiliarId === elementFamiliarId &&
    pf.combination.attributeFamiliarId === attributeFamiliarId &&
    pf.combination.weaponFamiliarId === weaponFamiliarId
  );

  if (exactMatch) {
    logger.debug('Found predefined Prime Familiar', { id: exactMatch.id, name: exactMatch.name });
    return { ...exactMatch, isCustom: false };
  }

  // No match found - generate custom Prime Familiar with name based on combination
  const customId = `custom_${elementFamiliarId}_${attributeFamiliarId}_${weaponFamiliarId}`;

  // Generate name from familiar names (e.g., Hi + Ku + Na = HIKUNA)
  let customName = `Custom Prime #${generateHash(elementFamiliarId, attributeFamiliarId, weaponFamiliarId)}`;

  if (familiarsData && familiarsData.length > 0) {
    const elementFamiliar = familiarsData.find(f => f.id === elementFamiliarId);
    const attributeFamiliar = familiarsData.find(f => f.id === attributeFamiliarId);
    const weaponFamiliar = familiarsData.find(f => f.id === weaponFamiliarId);

    if (elementFamiliar && attributeFamiliar && weaponFamiliar) {
      // Concatenate names and uppercase: Hi + Ku + Na = HIKUNA
      customName = (elementFamiliar.name + attributeFamiliar.name + weaponFamiliar.name).toUpperCase();
      logger.debug('Generated Prime Familiar name from combination', {
        element: elementFamiliar.name,
        attribute: attributeFamiliar.name,
        weapon: weaponFamiliar.name,
        result: customName
      });
    }
  }

  const customPrimeFamiliar = {
    id: customId,
    name: customName,
    combination: {
      elementFamiliarId,
      attributeFamiliarId,
      weaponFamiliarId
    },
    skill: {
      name: "Combined Power",
      description: "Inherits traits from all three base familiars, creating a unique synergy",
      type: "hybrid",
      cooldown: 20
    },
    isCustom: true
  };

  logger.debug('Generated custom Prime Familiar', { id: customId, name: customPrimeFamiliar.name });
  return customPrimeFamiliar;
};

/**
 * Generate a hash string from three familiar IDs
 * Used for creating unique custom Prime Familiar names
 *
 * @param {number} id1 - First familiar ID
 * @param {number} id2 - Second familiar ID
 * @param {number} id3 - Third familiar ID
 * @returns {string} Short hash string
 */
const generateHash = (id1, id2, id3) => {
  // Simple hash: combine IDs and create a short identifier
  const combined = `${id1}${id2}${id3}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).substr(0, 4).toUpperCase();
};

/**
 * Get rarity tier data for a given star level
 *
 * @param {number} starLevel - Star level (0-10)
 * @param {Array} progressionData - Array of star level progression data
 * @returns {Object} Rarity tier data (color, glow, sprite variant, etc.)
 */
export const getRarityForStars = (starLevel, progressionData) => {
  if (!progressionData || progressionData.length === 0) {
    logger.warn('No progression data available');
    return {
      stars: 0,
      rarity: 'common',
      rarityDisplay: 'Common',
      spriteVariant: 'base',
      weaponTier: 1,
      color: '#9CA3AF',
      glow: false,
      statMultiplier: 1.0
    };
  }

  // Find the entry matching the star level
  const entry = progressionData.find(p => p.stars === starLevel);

  if (entry) {
    return entry;
  }

  // If exact match not found, find the closest lower star level
  const sortedData = [...progressionData].sort((a, b) => a.stars - b.stars);
  let closestEntry = sortedData[0];

  for (const data of sortedData) {
    if (data.stars <= starLevel) {
      closestEntry = data;
    } else {
      break;
    }
  }

  logger.debug('Using closest rarity tier', { requestedStars: starLevel, foundStars: closestEntry.stars });
  return closestEntry;
};

/**
 * Get weapon tier based on star level
 * Weapon tier progresses every 2-3 star levels
 *
 * @param {number} starLevel - Star level (0-10)
 * @param {Array} progressionData - Optional progression data (for precise lookup)
 * @returns {number} Weapon tier (1-4)
 */
export const getWeaponTier = (starLevel, progressionData = null) => {
  if (progressionData) {
    const rarityData = getRarityForStars(starLevel, progressionData);
    return rarityData.weaponTier || 1;
  }

  // Fallback calculation if no progression data
  if (starLevel >= 9) return 4;
  if (starLevel >= 6) return 3;
  if (starLevel >= 3) return 2;
  return 1;
};

/**
 * Get sprite variant name based on star level
 *
 * @param {number} starLevel - Star level (0-10)
 * @param {Array} progressionData - Optional progression data (for precise lookup)
 * @returns {string} Sprite variant name (base, rare, hero, legend, mythology)
 */
export const getSpriteVariant = (starLevel, progressionData = null) => {
  if (progressionData) {
    const rarityData = getRarityForStars(starLevel, progressionData);
    return rarityData.spriteVariant || 'base';
  }

  // Fallback calculation if no progression data
  if (starLevel >= 10) return 'mythology';
  if (starLevel >= 8) return 'legend';
  if (starLevel >= 6) return 'hero';
  if (starLevel >= 3) return 'rare';
  return 'base';
};

/**
 * Check if a familiar build is complete (all 3 slots filled)
 *
 * @param {Object} build - Familiar build object
 * @returns {boolean} True if all slots have familiars
 */
export const isBuildComplete = (build) => {
  if (!build || !build.slots || build.slots.length !== 3) {
    return false;
  }

  return build.slots.every(slot =>
    slot && slot.familiar && slot.familiar.id
  );
};

/**
 * Get familiar from a specific category slot
 *
 * @param {Object} build - Familiar build object
 * @param {string} category - Category name (element, attribute, weapon)
 * @returns {Object|null} Familiar object or null
 */
export const getFamiliarByCategory = (build, category) => {
  if (!build || !build.slots) return null;

  const slot = build.slots.find(s => s && s.category === category);
  return slot?.familiar || null;
};

/**
 * Get all slot categories from a build
 *
 * @param {Object} build - Familiar build object
 * @returns {Array} Array of category names
 */
export const getBuildCategories = (build) => {
  if (!build || !build.slots) return [];
  return build.slots
    .filter(slot => slot && slot.category)
    .map(slot => slot.category);
};

/**
 * Validate that a build has all required categories
 *
 * @param {Object} build - Familiar build object
 * @returns {Object} Validation result { valid: boolean, missing: Array }
 */
export const validateBuildCategories = (build) => {
  const requiredCategories = ['element', 'attribute', 'weapon'];
  const buildCategories = getBuildCategories(build);

  const missing = requiredCategories.filter(cat => !buildCategories.includes(cat));

  return {
    valid: missing.length === 0,
    missing
  };
};

/**
 * Get familiar names from a build for display
 *
 * @param {Object} build - Familiar build object
 * @returns {Object} Object with category: familiarName pairs
 */
export const getBuildFamiliarNames = (build) => {
  if (!build || !build.slots) return {};

  const names = {};
  build.slots.forEach(slot => {
    if (slot && slot.category && slot.familiar) {
      names[slot.category] = slot.familiar.name;
    }
  });

  return names;
};

/**
 * Calculate average star level across all slots
 *
 * @param {Object} build - Familiar build object
 * @returns {number} Average star level (0-10)
 */
export const getAverageStarLevel = (build) => {
  if (!build || !build.slots || build.slots.length === 0) return 0;

  const filledSlots = build.slots.filter(slot => slot && slot.familiar);
  if (filledSlots.length === 0) return 0;

  const totalStars = filledSlots.reduce((sum, slot) => sum + (slot.starLevel || 0), 0);
  return Math.round(totalStars / filledSlots.length);
};

/**
 * Get the highest star level in a build
 *
 * @param {Object} build - Familiar build object
 * @returns {number} Highest star level (0-10)
 */
export const getMaxStarLevel = (build) => {
  if (!build || !build.slots) return 0;

  return Math.max(
    ...build.slots
      .filter(slot => slot && slot.familiar)
      .map(slot => slot.starLevel || 0),
    0
  );
};

/**
 * Format a Prime Familiar skill for display
 *
 * @param {Object} primeFamiliar - Prime Familiar object
 * @returns {string} Formatted skill description
 */
export const formatPrimeFamiliarSkill = (primeFamiliar) => {
  if (!primeFamiliar || !primeFamiliar.skill) {
    return 'No skill information available';
  }

  const { name, description, type, cooldown } = primeFamiliar.skill;
  let formatted = `${name}`;

  if (type) {
    formatted += ` (${type})`;
  }

  if (description) {
    formatted += `\n${description}`;
  }

  if (cooldown) {
    formatted += `\nCooldown: ${cooldown}s`;
  }

  return formatted;
};

logger.debug('Familiar helper functions loaded');

export default {
  findPrimeFamiliar,
  getRarityForStars,
  getWeaponTier,
  getSpriteVariant,
  isBuildComplete,
  getFamiliarByCategory,
  getBuildCategories,
  validateBuildCategories,
  getBuildFamiliarNames,
  getAverageStarLevel,
  getMaxStarLevel,
  formatPrimeFamiliarSkill
};
