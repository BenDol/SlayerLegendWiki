import { useMemo } from 'react';
import { createLogger } from '../utils/logger';
import { resolveImagePath } from '../../wiki-framework/src/utils/imageResolver';
import { getRarityForStars, getWeaponTier } from '../utils/familiarHelpers';
import FamiliarSprite from './FamiliarSprite';

const logger = createLogger('PrimeFamiliarPreview');

/**
 * PrimeFamiliarPreview - Composite sprite renderer for Prime Familiars
 * Combines element familiar (determines weapon color), battle familiar (body), and weapon familiar (weapon overlay)
 *
 * Rendering layers (bottom to top):
 * 1. Glow effect (if mythology tier)
 * 2. Rarity border
 * 3. Weapon overlay (pre-colored sprite based on element familiar ID, positioned behind body)
 * 4. Body sprite (from battle/attributeFamiliar, animated, recolored with canvas-based technique based on element)
 * 5. Star rating display
 * 6. Prime Familiar name and skill
 *
 * Element color system:
 * - Body sprite: Recolored using canvas-based pixel replacement for accurate color matching
 * - Weapon sprite: Uses pre-colored variants (Demon{WeaponType}_{ElementId}_{BattleId}.png)
 *   - Element ID 1 = Fire (#F6473F red), 2 = Water (#4CB0F9 blue), 3 = Wind (#64E69A green), 4 = Earth (#F59B25 orange)
 *
 * @param {Object} elementFamiliar - Familiar in element slot (determines weapon sprite variant and body color)
 * @param {Object} attributeFamiliar - Familiar in battle slot (provides body sprite)
 * @param {Object} weaponFamiliar - Familiar in weapon slot (provides weapon type: Scythe/Spear/Wand/Sword)
 * @param {number} elementStarLevel - Star level of element familiar
 * @param {number} attributeStarLevel - Star level of battle familiar
 * @param {number} weaponStarLevel - Star level of weapon familiar (not used for sprite selection)
 * @param {Object} primeFamiliar - Prime Familiar data (name, skill, etc.)
 * @param {Array} progressionData - Star progression data
 * @param {string} size - Size preset: 'small', 'medium', 'large'
 * @param {boolean} showDetails - Show Prime Familiar name and skill (default: true)
 * @param {boolean} animated - Whether to animate sprites (default: true)
 * @param {string} className - Additional CSS classes
 */
const PrimeFamiliarPreview = ({
  elementFamiliar,
  attributeFamiliar,
  weaponFamiliar,
  elementStarLevel = 0,
  attributeStarLevel = 0,
  weaponStarLevel = 0,
  primeFamiliar,
  progressionData = [],
  size = 'large',
  showDetails = true,
  animated = true,
  className = ''
}) => {
  // Calculate average star level for display
  const averageStarLevel = useMemo(() => {
    const slots = [elementStarLevel, attributeStarLevel, weaponStarLevel].filter(s => s !== null);
    if (slots.length === 0) return 0;
    return Math.round(slots.reduce((sum, s) => sum + s, 0) / slots.length);
  }, [elementStarLevel, attributeStarLevel, weaponStarLevel]);

  // Get rarity data based on average star level
  const rarityData = useMemo(() => {
    return getRarityForStars(averageStarLevel, progressionData);
  }, [averageStarLevel, progressionData]);

  // Get weapon sprite path
  // Weapon sprites are pre-colored based on element familiar and have tier variants based on weapon star level
  // Pattern: Demon{WeaponType}_{ElementId}_{WeaponTier}[_BattleVariant].png
  // - ElementId: 1 = Fire, 2 = Water, 3 = Wind, 4 = Earth
  // - WeaponTier: 0-2 stars = 01, 3-5 = 02, 6-8 = 03, 9-10 = 04
  // - BattleVariant: 0-5 battle stars = no suffix, 6-10 = _1
  const weaponSpritePath = useMemo(() => {
    if (!weaponFamiliar || !weaponFamiliar.weaponType || !attributeFamiliar || !elementFamiliar) {
      logger.info('No weapon sprite (missing data)', {
        hasWeaponFamiliar: !!weaponFamiliar,
        weaponType: weaponFamiliar?.weaponType,
        hasAttributeFamiliar: !!attributeFamiliar,
        hasElementFamiliar: !!elementFamiliar,
        weaponFamiliarId: weaponFamiliar?.id
      });
      return null;
    }

    // Pattern: Demon{WeaponType}_{ElementVariant}_{WeaponTier}[_BattleFamiliarVariant].png
    // Example: DemonScythe_1_01.png (tier 1) or DemonScythe_1_04_1.png (tier 4, battle variant 1)
    const weaponType = weaponFamiliar.weaponType; // "Scythe", "Spear", "Wand", "Sword"
    const elementVariant = elementFamiliar.id; // 1=Fire, 2=Water, 3=Wind, 4=Earth

    // Calculate weapon tier based on weapon star level: 0-2 stars = 01, 3-5 = 02, 6-8 = 03, 9-10 = 04
    const weaponTier = Math.min(4, Math.floor(weaponStarLevel / 3) + 1);
    const weaponTierString = String(weaponTier).padStart(2, '0');

    // Battle familiar variant: 0-5 stars = no suffix, 6-10 stars = _1
    const battleVariant = attributeStarLevel >= 6 ? '_1' : '';

    const imagePath = `familiars/Demon${weaponType}_${elementVariant}_${weaponTierString}${battleVariant}.png`;

    logger.info('Generated weapon sprite path', {
      weaponFamiliarId: weaponFamiliar.id,
      weaponFamiliarName: weaponFamiliar.name,
      weaponType,
      elementFamiliarId: elementFamiliar.id,
      elementFamiliarName: elementFamiliar.name,
      elementVariant,
      attributeFamiliarId: attributeFamiliar.id,
      weaponStarLevel,
      weaponTier,
      weaponTierString,
      attributeStarLevel,
      battleVariant,
      imagePath
    });

    return resolveImagePath(imagePath);
  }, [weaponFamiliar, attributeFamiliar, elementFamiliar, weaponStarLevel, attributeStarLevel]);

  // Get element color for recoloring the battle familiar
  const elementColor = useMemo(() => {
    const color = elementFamiliar?.color || null;
    logger.debug('Element color for recoloring', {
      hasElementFamiliar: !!elementFamiliar,
      elementName: elementFamiliar?.name,
      color
    });
    return color;
  }, [elementFamiliar]);

  // Size presets
  const sizeMap = {
    small: { container: '128px', weapon: '64px' },
    medium: { container: '192px', weapon: '96px' },
    large: { container: '256px', weapon: '128px' },
  };

  const dimensions = sizeMap[size] || sizeMap.large;

  // Check if we have enough data to render
  if (!attributeFamiliar) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}
           style={{ width: dimensions.container, height: dimensions.container }}>
        <div className="text-center p-4">
          <div className="text-4xl mb-2">👹</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Select familiars to create<br/>a Prime Familiar
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width: dimensions.container }}>
      {/* Main composite sprite container */}
      <div
        className="relative rounded-lg overflow-visible"
        style={{ width: dimensions.container, height: dimensions.container }}
      >
        {/* Glow effect layer (if mythology tier) */}
        {rarityData.glow && (
          <div
            className="absolute inset-0 animate-pulse"
            style={{
              backgroundColor: rarityData.color,
              opacity: 0.3,
              filter: 'blur(20px)'
            }}
          />
        )}

        {/* Weapon overlay (behind body sprite but above border) */}
        {/* Note: Weapon sprites are already pre-colored based on element, no filter needed */}
        {weaponSpritePath && (
          <div
            className="absolute"
            style={{
              right: '-10%',
              top: '25%',
              width: dimensions.weapon,
              height: dimensions.weapon,
              transform: 'translate(30px, calc(-25% + 26px)) rotate(-10deg) scale(1.5)',
              zIndex: 10
            }}
          >
            <img
              key={`weapon-${weaponFamiliar?.id}-${weaponStarLevel}`}
              src={weaponSpritePath}
              alt={`${weaponFamiliar?.name || 'Weapon'}`}
              className="w-full h-full object-contain"
              style={{
                imageRendering: 'pixelated',
                filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))'
              }}
            />
          </div>
        )}

        {/* Body sprite (front layer) - from battle familiar (attributeFamiliar) */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            zIndex: 11
          }}
        >
          <FamiliarSprite
            familiarId={attributeFamiliar.id}
            starLevel={attributeStarLevel}
            progressionData={progressionData}
            animated={animated}
            size={dimensions.container}
            familiarData={attributeFamiliar}
            recolorHex={elementColor}
          />
        </div>

        {/* Rarity border */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            border: `1px solid ${rarityData.color}`,
            boxShadow: `0 0 30px ${rarityData.color}80`,
            zIndex: 9
          }}
        />

        {/* Rarity badge (top-right corner) */}
        <div className="absolute top-2 right-2 bg-black bg-opacity-70 rounded px-2 py-1 z-20">
          <div className="text-xs font-bold" style={{ color: rarityData.color }}>
            {rarityData.rarityDisplay}
          </div>
        </div>

        {/* Star rating display (bottom) */}
        {averageStarLevel > 0 && (() => {
          // 0-5 stars: regular stars, 6-10 stars: red stars
          const useRedStar = averageStarLevel > 5;
          const displayStars = averageStarLevel > 5 ? averageStarLevel - 5 : averageStarLevel;
          const starImage = useRedStar ? 'familiars/Demonstar_2.png' : 'familiars/Demonstar_1.png';

          return (
            <div
              className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center z-20"
              title={`Average Star Level: ${averageStarLevel}/10${useRedStar ? ' (Red Stars)' : ''}`}
            >
              {Array.from({ length: 5 }).map((_, index) => (
                <img
                  key={index}
                  src={resolveImagePath(starImage)}
                  alt="star"
                  className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 ${index < displayStars ? 'opacity-100' : 'opacity-20'}`}
                  style={{ marginLeft: index > 0 ? '-8px' : '0' }}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Prime Familiar Name */}
      {primeFamiliar && showDetails && (
        <div className="mt-4 text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {primeFamiliar.name}
            {primeFamiliar.isCustom && (
              <span className="ml-2 text-sm sm:text-base font-normal text-gray-500 dark:text-gray-400">
                (Custom)
              </span>
            )}
          </h3>
        </div>
      )}
    </div>
  );
};

export default PrimeFamiliarPreview;
