/**
 * Slayer Legend Wiki - Rarity Color Configuration
 *
 * This file registers game-specific rarity colors with the framework's styleRegistry.
 * The framework is now generic, so all color schemes must be registered by the parent project.
 */

import { styleRegistry } from '../../wiki-framework/src/utils/styleRegistry.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('RarityColors');

// Register skill rarity colors
styleRegistry.registerCategory('skill-rarity', {
  Common: {
    name: 'Common',
    background: 'bg-gray-500',
    border: 'border-gray-500',
    glow: 'shadow-[0_0_10px_rgba(107,114,128,0.5)] dark:shadow-[0_0_10px_rgba(156,163,175,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(107,114,128,0.7)] dark:hover:shadow-[0_0_15px_rgba(156,163,175,0.7)]',
  },
  Great: {
    name: 'Great',
    background: 'bg-green-500',
    border: 'border-green-500',
    glow: 'shadow-[0_0_10px_rgba(34,197,94,0.5)] dark:shadow-[0_0_10px_rgba(74,222,128,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(34,197,94,0.7)] dark:hover:shadow-[0_0_15px_rgba(74,222,128,0.7)]',
  },
  Rare: {
    name: 'Rare',
    background: 'bg-orange-500',
    border: 'border-orange-500',
    glow: 'shadow-[0_0_10px_rgba(249,115,22,0.5)] dark:shadow-[0_0_10px_rgba(251,146,60,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(249,115,22,0.7)] dark:hover:shadow-[0_0_15px_rgba(251,146,60,0.7)]',
  },
  Epic: {
    name: 'Epic',
    background: 'bg-purple-500',
    border: 'border-purple-500',
    glow: 'shadow-[0_0_10px_rgba(168,85,247,0.5)] dark:shadow-[0_0_10px_rgba(192,132,252,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(168,85,247,0.7)] dark:hover:shadow-[0_0_15px_rgba(192,132,252,0.7)]',
  },
  Legendary: {
    name: 'Legendary',
    background: 'bg-red-500',
    border: 'border-red-500',
    glow: 'shadow-[0_0_10px_rgba(239,68,68,0.5)] dark:shadow-[0_0_10px_rgba(248,113,113,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(239,68,68,0.7)] dark:hover:shadow-[0_0_15px_rgba(248,113,113,0.7)]',
  },
  Mythic: {
    name: 'Mythic',
    background: 'bg-teal-500',
    border: 'border-teal-500',
    glow: 'shadow-[0_0_10px_rgba(20,184,166,0.5)] dark:shadow-[0_0_10px_rgba(45,212,191,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(20,184,166,0.7)] dark:hover:shadow-[0_0_15px_rgba(45,212,191,0.7)]',
  },
});

// Register equipment rarity colors
styleRegistry.registerCategory('equipment-rarity', {
  Common: {
    name: 'Common',
    background: 'bg-gray-500',
    border: 'border-gray-500',
    glow: 'shadow-[0_0_10px_rgba(107,114,128,0.5)] dark:shadow-[0_0_10px_rgba(156,163,175,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(107,114,128,0.7)] dark:hover:shadow-[0_0_15px_rgba(156,163,175,0.7)]',
  },
  Great: {
    name: 'Great',
    background: 'bg-green-500',
    border: 'border-green-500',
    glow: 'shadow-[0_0_10px_rgba(34,197,94,0.5)] dark:shadow-[0_0_10px_rgba(74,222,128,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(34,197,94,0.7)] dark:hover:shadow-[0_0_15px_rgba(74,222,128,0.7)]',
  },
  Rare: {
    name: 'Rare',
    background: 'bg-orange-500',
    border: 'border-orange-500',
    glow: 'shadow-[0_0_10px_rgba(249,115,22,0.5)] dark:shadow-[0_0_10px_rgba(251,146,60,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(249,115,22,0.7)] dark:hover:shadow-[0_0_15px_rgba(251,146,60,0.7)]',
  },
  Epic: {
    name: 'Epic',
    background: 'bg-purple-500',
    border: 'border-purple-500',
    glow: 'shadow-[0_0_10px_rgba(168,85,247,0.5)] dark:shadow-[0_0_10px_rgba(192,132,252,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(168,85,247,0.7)] dark:hover:shadow-[0_0_15px_rgba(192,132,252,0.7)]',
  },
  Legendary: {
    name: 'Legendary',
    background: 'bg-red-500',
    border: 'border-red-500',
    glow: 'shadow-[0_0_10px_rgba(239,68,68,0.5)] dark:shadow-[0_0_10px_rgba(248,113,113,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(239,68,68,0.7)] dark:hover:shadow-[0_0_15px_rgba(248,113,113,0.7)]',
  },
  Mythic: {
    name: 'Mythic',
    background: 'bg-blue-500',
    border: 'border-blue-500',
    glow: 'shadow-[0_0_10px_rgba(59,130,246,0.5)] dark:shadow-[0_0_10px_rgba(96,165,250,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(59,130,246,0.7)] dark:hover:shadow-[0_0_15px_rgba(96,165,250,0.7)]',
  },
  Immortal: {
    name: 'Immortal',
    background: 'bg-yellow-400',
    border: 'border-yellow-400',
    glow: 'shadow-[0_0_10px_rgba(250,204,21,0.5)] dark:shadow-[0_0_10px_rgba(253,224,71,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(250,204,21,0.7)] dark:hover:shadow-[0_0_15px_rgba(253,224,71,0.7)]',
  },
});

logger.info('Registered skill and equipment rarity colors with styleRegistry');

/**
 * Helper functions for backwards compatibility
 * These maintain the same API as the old framework rarityColors.js file
 */

// Export constants for direct access (backwards compatible)
export const SKILL_GRADE_COLORS = styleRegistry.getAllStyles('skill-rarity');
export const EQUIPMENT_RARITY_COLORS = styleRegistry.getAllStyles('equipment-rarity');

/**
 * Get skill grade color configuration
 * @param {string} grade - The skill grade (Common, Great, Rare, Epic, Legendary, Mythic)
 * @returns {object} Color configuration object
 */
export const getSkillGradeColor = (grade) => {
  return styleRegistry.getStyles('skill-rarity', grade) ||
         styleRegistry.getStyles('skill-rarity', 'Common');
};

/**
 * Get equipment rarity color configuration
 * @param {string} rarity - The equipment rarity (Common, Great, Rare, Epic, Legendary, Mythic, Immortal)
 * @returns {object} Color configuration object
 */
export const getEquipmentRarityColor = (rarity) => {
  return styleRegistry.getStyles('equipment-rarity', rarity) ||
         styleRegistry.getStyles('equipment-rarity', 'Common');
};

/**
 * Legacy color mapping for backward compatibility
 * Returns only the background color class
 */
export const getGradeBackgroundColor = (grade) => {
  return getSkillGradeColor(grade).background;
};

export const getRarityBackgroundColor = (rarity) => {
  return getEquipmentRarityColor(rarity).background;
};
