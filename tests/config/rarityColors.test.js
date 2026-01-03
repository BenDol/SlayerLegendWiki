import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { styleRegistry } from '../../wiki-framework/src/utils/styleRegistry.js';
import {
  SKILL_GRADE_COLORS,
  EQUIPMENT_RARITY_COLORS,
  getSkillGradeColor,
  getEquipmentRarityColor,
  getGradeBackgroundColor,
  getRarityBackgroundColor
} from '../../src/config/rarityColors.js';

describe('rarityColors', () => {
  let consoleSpy;

  beforeEach(() => {
    // Note: rarityColors.js automatically registers on import
    // The styleRegistry is already populated

    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
  });

  describe('styleRegistry integration', () => {
    it('should register skill-rarity category with all grades', () => {
      expect(styleRegistry.hasCategory('skill-rarity')).toBe(true);

      const allStyles = styleRegistry.getAllStyles('skill-rarity');
      expect(allStyles).toBeDefined();
      expect(Object.keys(allStyles)).toContain('Common');
      expect(Object.keys(allStyles)).toContain('Great');
      expect(Object.keys(allStyles)).toContain('Rare');
      expect(Object.keys(allStyles)).toContain('Epic');
      expect(Object.keys(allStyles)).toContain('Legendary');
      expect(Object.keys(allStyles)).toContain('Mythic');
    });

    it('should register equipment-rarity category with all rarities', () => {
      expect(styleRegistry.hasCategory('equipment-rarity')).toBe(true);

      const allStyles = styleRegistry.getAllStyles('equipment-rarity');
      expect(allStyles).toBeDefined();
      expect(Object.keys(allStyles)).toContain('Common');
      expect(Object.keys(allStyles)).toContain('Great');
      expect(Object.keys(allStyles)).toContain('Rare');
      expect(Object.keys(allStyles)).toContain('Epic');
      expect(Object.keys(allStyles)).toContain('Legendary');
      expect(Object.keys(allStyles)).toContain('Mythic');
      expect(Object.keys(allStyles)).toContain('Immortal');
    });

    it('should have complete style objects for each grade', () => {
      const legendary = styleRegistry.getStyles('skill-rarity', 'Legendary');

      expect(legendary).toBeDefined();
      expect(legendary.name).toBe('Legendary');
      expect(legendary.background).toBeDefined();
      expect(legendary.border).toBeDefined();
      expect(legendary.glow).toBeDefined();
      expect(legendary.glowHover).toBeDefined();
    });

    it('should have Tailwind CSS classes', () => {
      const common = styleRegistry.getStyles('skill-rarity', 'Common');

      expect(common.background).toMatch(/^bg-/);
      expect(common.border).toMatch(/^border-/);
      expect(common.glow).toMatch(/shadow/);
      expect(common.glowHover).toMatch(/hover:shadow/);
    });

    // Note: Console log test removed because registration happens at import time,
    // before the spy is set up in beforeEach. The registration is verified by
    // the other tests checking that categories are properly populated.
  });

  describe('SKILL_GRADE_COLORS constant', () => {
    it('should export all skill grades', () => {
      expect(SKILL_GRADE_COLORS).toBeDefined();
      expect(SKILL_GRADE_COLORS.Common).toBeDefined();
      expect(SKILL_GRADE_COLORS.Great).toBeDefined();
      expect(SKILL_GRADE_COLORS.Rare).toBeDefined();
      expect(SKILL_GRADE_COLORS.Epic).toBeDefined();
      expect(SKILL_GRADE_COLORS.Legendary).toBeDefined();
      expect(SKILL_GRADE_COLORS.Mythic).toBeDefined();
    });

    it('should have complete style objects', () => {
      const legendary = SKILL_GRADE_COLORS.Legendary;

      expect(legendary.name).toBe('Legendary');
      expect(legendary.background).toBe('bg-red-500');
      expect(legendary.border).toBe('border-red-500');
      expect(legendary.glow).toContain('shadow');
      expect(legendary.glowHover).toContain('hover:shadow');
    });

    it('should match styleRegistry data', () => {
      const registryCommon = styleRegistry.getStyles('skill-rarity', 'Common');
      const exportedCommon = SKILL_GRADE_COLORS.Common;

      expect(exportedCommon).toEqual(registryCommon);
    });
  });

  describe('EQUIPMENT_RARITY_COLORS constant', () => {
    it('should export all equipment rarities', () => {
      expect(EQUIPMENT_RARITY_COLORS).toBeDefined();
      expect(EQUIPMENT_RARITY_COLORS.Common).toBeDefined();
      expect(EQUIPMENT_RARITY_COLORS.Great).toBeDefined();
      expect(EQUIPMENT_RARITY_COLORS.Rare).toBeDefined();
      expect(EQUIPMENT_RARITY_COLORS.Epic).toBeDefined();
      expect(EQUIPMENT_RARITY_COLORS.Legendary).toBeDefined();
      expect(EQUIPMENT_RARITY_COLORS.Mythic).toBeDefined();
      expect(EQUIPMENT_RARITY_COLORS.Immortal).toBeDefined();
    });

    it('should have different Mythic color than skills', () => {
      const skillMythic = SKILL_GRADE_COLORS.Mythic;
      const equipmentMythic = EQUIPMENT_RARITY_COLORS.Mythic;

      // Skill Mythic is teal, Equipment Mythic is blue
      expect(skillMythic.background).toBe('bg-teal-500');
      expect(equipmentMythic.background).toBe('bg-blue-500');
    });

    it('should have Immortal rarity (equipment only)', () => {
      const immortal = EQUIPMENT_RARITY_COLORS.Immortal;

      expect(immortal).toBeDefined();
      expect(immortal.name).toBe('Immortal');
      expect(immortal.background).toBe('bg-yellow-400');
    });
  });

  describe('getSkillGradeColor', () => {
    it('should return color config for valid grade', () => {
      const legendary = getSkillGradeColor('Legendary');

      expect(legendary).toBeDefined();
      expect(legendary.name).toBe('Legendary');
      expect(legendary.background).toBe('bg-red-500');
    });

    it('should return Common as fallback for invalid grade', () => {
      const invalid = getSkillGradeColor('NonExistent');

      expect(invalid).toBeDefined();
      expect(invalid.name).toBe('Common');
      expect(invalid.background).toBe('bg-gray-500');
    });

    it('should work with all valid grades', () => {
      const grades = ['Common', 'Great', 'Rare', 'Epic', 'Legendary', 'Mythic'];

      grades.forEach(grade => {
        const color = getSkillGradeColor(grade);
        expect(color).toBeDefined();
        expect(color.name).toBe(grade);
      });
    });
  });

  describe('getEquipmentRarityColor', () => {
    it('should return color config for valid rarity', () => {
      const immortal = getEquipmentRarityColor('Immortal');

      expect(immortal).toBeDefined();
      expect(immortal.name).toBe('Immortal');
      expect(immortal.background).toBe('bg-yellow-400');
    });

    it('should return Common as fallback for invalid rarity', () => {
      const invalid = getEquipmentRarityColor('NonExistent');

      expect(invalid).toBeDefined();
      expect(invalid.name).toBe('Common');
      expect(invalid.background).toBe('bg-gray-500');
    });

    it('should work with all valid rarities', () => {
      const rarities = ['Common', 'Great', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Immortal'];

      rarities.forEach(rarity => {
        const color = getEquipmentRarityColor(rarity);
        expect(color).toBeDefined();
        expect(color.name).toBe(rarity);
      });
    });
  });

  describe('getGradeBackgroundColor (legacy)', () => {
    it('should return just the background class', () => {
      const bg = getGradeBackgroundColor('Legendary');

      expect(bg).toBe('bg-red-500');
      expect(typeof bg).toBe('string');
    });

    it('should work with all grades', () => {
      const grades = ['Common', 'Great', 'Rare', 'Epic', 'Legendary', 'Mythic'];

      grades.forEach(grade => {
        const bg = getGradeBackgroundColor(grade);
        expect(bg).toMatch(/^bg-/);
      });
    });

    it('should return Common background for invalid grade', () => {
      const bg = getGradeBackgroundColor('Invalid');
      expect(bg).toBe('bg-gray-500');
    });
  });

  describe('getRarityBackgroundColor (legacy)', () => {
    it('should return just the background class', () => {
      const bg = getRarityBackgroundColor('Immortal');

      expect(bg).toBe('bg-yellow-400');
      expect(typeof bg).toBe('string');
    });

    it('should work with all rarities', () => {
      const rarities = ['Common', 'Great', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Immortal'];

      rarities.forEach(rarity => {
        const bg = getRarityBackgroundColor(rarity);
        expect(bg).toMatch(/^bg-/);
      });
    });

    it('should return Common background for invalid rarity', () => {
      const bg = getRarityBackgroundColor('Invalid');
      expect(bg).toBe('bg-gray-500');
    });
  });

  describe('color consistency', () => {
    it('should have consistent colors between skill and equipment for shared grades', () => {
      const sharedGrades = ['Common', 'Great', 'Rare', 'Epic', 'Legendary'];

      sharedGrades.forEach(grade => {
        const skillColor = SKILL_GRADE_COLORS[grade];
        const equipmentColor = EQUIPMENT_RARITY_COLORS[grade];

        // Common, Great, Rare, Epic, and Legendary should be the same
        expect(skillColor.background).toBe(equipmentColor.background);
        expect(skillColor.border).toBe(equipmentColor.border);
      });
    });

    it('should have different Mythic colors (teal vs blue)', () => {
      const skillMythic = SKILL_GRADE_COLORS.Mythic;
      const equipmentMythic = EQUIPMENT_RARITY_COLORS.Mythic;

      expect(skillMythic.background).toBe('bg-teal-500');
      expect(equipmentMythic.background).toBe('bg-blue-500');
    });
  });

  describe('dark mode support', () => {
    it('should include dark mode classes in glow', () => {
      const legendary = getSkillGradeColor('Legendary');

      expect(legendary.glow).toContain('dark:shadow');
      expect(legendary.glowHover).toContain('dark:hover:shadow');
    });

    it('should have dark mode for all grades', () => {
      const grades = ['Common', 'Great', 'Rare', 'Epic', 'Legendary', 'Mythic'];

      grades.forEach(grade => {
        const color = getSkillGradeColor(grade);
        expect(color.glow).toContain('dark:');
        expect(color.glowHover).toContain('dark:');
      });
    });
  });

  describe('backwards compatibility', () => {
    it('should maintain the same API as framework rarityColors.js', () => {
      // Test that all exported functions and constants exist
      expect(SKILL_GRADE_COLORS).toBeDefined();
      expect(EQUIPMENT_RARITY_COLORS).toBeDefined();
      expect(typeof getSkillGradeColor).toBe('function');
      expect(typeof getEquipmentRarityColor).toBe('function');
      expect(typeof getGradeBackgroundColor).toBe('function');
      expect(typeof getRarityBackgroundColor).toBe('function');
    });

    it('should work with code that expects old framework API', () => {
      // Old usage pattern
      const color = SKILL_GRADE_COLORS.Legendary;
      expect(color.background).toBe('bg-red-500');

      // Old function usage
      const bg = getGradeBackgroundColor('Legendary');
      expect(bg).toBe('bg-red-500');
    });

    it('should preserve color structure', () => {
      const color = getSkillGradeColor('Epic');

      // Verify structure matches old framework
      expect(color).toHaveProperty('name');
      expect(color).toHaveProperty('background');
      expect(color).toHaveProperty('border');
      expect(color).toHaveProperty('glow');
      expect(color).toHaveProperty('glowHover');
    });
  });

  describe('real-world usage scenarios', () => {
    it('should support component prop usage', () => {
      const grade = 'Legendary';
      const { background, border, glow } = getSkillGradeColor(grade);

      // Simulating React component props
      const className = `${background} ${border} ${glow}`;
      expect(className).toContain('bg-red-500');
      expect(className).toContain('border-red-500');
      expect(className).toContain('shadow');
    });

    it('should support dynamic grade selection', () => {
      const userGrade = 'Epic'; // From user data
      const color = getSkillGradeColor(userGrade);

      expect(color.background).toBe('bg-purple-500');
    });

    it('should handle case-sensitive grade names', () => {
      // Should work with exact case match
      const proper = getSkillGradeColor('Legendary');
      expect(proper.name).toBe('Legendary');

      // Falls back to Common for wrong case
      const wrong = getSkillGradeColor('legendary');
      expect(wrong.name).toBe('Common');
    });
  });
});
