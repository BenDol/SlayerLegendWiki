import React from 'react';
import SpiritSprite from './SpiritSprite';

/**
 * SpiritComponent - Pure display component for spirits
 *
 * A clean, reusable component that displays a spirit with:
 * - Animated sprite with level overlays
 * - Optional ring platform glow effects
 * - Awakening stars (progress to next evolution) under the sprite
 * - Spirit name and optional skill name/element below
 *
 * This component is READ-ONLY and should be used for display purposes.
 * Use SpiritSlot for editable configurations with box containers.
 *
 * @param {object} spirit - Spirit data object with { id, name, element, skill, etc. }
 * @param {number} level - Spirit level (1-300)
 * @param {number} awakeningLevel - Awakening level (0+)
 * @param {number} evolutionLevel - Evolution level (0-7)
 * @param {number} skillEnhancementLevel - Skill enhancement level (0-5)
 * @param {boolean} showLevelOverlays - Show level badges on sprite (default: true)
 * @param {boolean} showPlatform - Show ring platform glow effects (default: true)
 * @param {boolean} showSkillName - Show skill name below name (default: false)
 * @param {boolean} showElementIcon - Show element icon overlay on sprite (default: true)
 * @param {boolean} showEnhancementLevel - Show enhancement level below name (default: false)
 * @param {string} subtitle - Optional subtitle text to show below name
 * @param {string} size - Size variant: 'small', 'medium', 'large' (default: 'medium')
 * @param {string} className - Additional CSS classes for container
 * @param {function} onClick - Optional click handler for the entire component
 */
const SpiritComponent = ({
  spirit,
  level = 1,
  awakeningLevel = 0,
  evolutionLevel = 4,
  skillEnhancementLevel = 0,
  showLevelOverlays = true,
  showPlatform = true,
  showSkillName = false,
  showElementIcon = true,
  showEnhancementLevel = false,
  subtitle = null,
  size = 'medium',
  className = '',
  onClick = null
}) => {
  if (!spirit) return null;

  // Calculate effective evolution level
  const effectiveEvolutionLevel = evolutionLevel >= 4 && awakeningLevel > 0
    ? evolutionLevel + Math.floor(awakeningLevel / 6)
    : evolutionLevel;
  const cappedEvolutionLevel = Math.min(effectiveEvolutionLevel, 7);

  // Calculate awakening stars (0-5)
  // Stars represent progress to next evolution level
  // Every 6 awakening levels = +1 evolution, so stars = awakeningLevel % 6
  const awakeningStars = awakeningLevel > 0 ? awakeningLevel % 6 : 0;

  // Size variants
  const sizes = {
    small: {
      container: 'w-20 h-24',
      sprite: 'w-20 h-20',
      star: 'w-3 h-3',
      elementIcon: 'w-5 h-5',
      text: 'text-xs',
      nameText: 'text-sm',
      padding: 'p-2',
      gap: 'gap-0.5'
    },
    medium: {
      container: 'w-24 h-28 sm:w-28 sm:h-32',
      sprite: 'w-24 h-24 sm:w-28 sm:h-28',
      star: 'w-3.5 h-3.5',
      elementIcon: 'w-6 h-6 sm:w-7 sm:h-7',
      text: 'text-xs',
      nameText: 'text-sm',
      padding: 'p-3',
      gap: 'gap-1'
    },
    large: {
      container: 'w-32 h-36 sm:w-36 sm:h-40',
      sprite: 'w-32 h-32 sm:w-36 sm:h-36',
      star: 'w-4 h-4',
      elementIcon: 'w-8 h-8',
      text: 'text-sm',
      nameText: 'text-base',
      padding: 'p-4',
      gap: 'gap-1'
    }
  };

  const sizeConfig = sizes[size] || sizes.medium;

  // Element icon mapping
  const elementIcons = {
    Fire: '/images/icons/typeicon_fire_1.png',
    Water: '/images/icons/typeicon_water_1.png',
    Wind: '/images/icons/typeicon_wind_1.png',
    Earth: '/images/icons/typeicon_earth s_1.png',
    Light: '/images/icons/typeicon_random_1.png', // Fallback to random icon
    Dark: '/images/icons/typeicon_random_1.png', // Fallback to random icon
  };

  const elementIcon = elementIcons[spirit.element] || '/images/icons/typeicon_random_1.png';

  return (
    <div
      className={`flex flex-col items-center ${sizeConfig.gap} ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Spirit Sprite with Optional Platform */}
      <div className="relative">
        {/* Ring Platform Background */}
        {showPlatform && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 blur-xl"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-20 h-6 sm:w-24 sm:h-7 md:w-32 md:h-8 rounded-full bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent blur-sm"></div>
            </div>
          </>
        )}

        {/* Spirit Sprite Container */}
        <div className={`relative ${sizeConfig.container} flex flex-col items-center justify-center`}>
          <SpiritSprite
            spiritId={spirit.id}
            level={cappedEvolutionLevel}
            animationType="idle"
            animated={true}
            fps={8}
            size="100%"
            showInfo={false}
            displayLevel={showLevelOverlays ? level : null}
            displayAwakeningLevel={null}
            displaySkillEnhancement={null}
          />

          {/* Awakening Stars - Directly Under Sprite */}
          {awakeningStars > 0 && (
            <div
              className="flex items-center justify-center gap-0.5 cursor-help absolute bottom-0.5 left-1/2 -translate-x-1/2"
              title={`Awakening Level: ${awakeningLevel} total (${awakeningStars}/6 progress to next evolution)`}
            >
              {Array.from({ length: 5 }).map((_, index) => (
                <img
                  key={index}
                  src="/images/other/Star_1.png"
                  alt="star"
                  className={`${sizeConfig.star} ${index < awakeningStars ? 'opacity-100' : 'opacity-20'}`}
                />
              ))}
            </div>
          )}

          {/* Element Icon Overlay */}
          {showElementIcon && (
            <img
              src={elementIcon}
              alt={spirit.element}
              className={`absolute top-0 -right-1 ${sizeConfig.elementIcon} drop-shadow-lg z-10`}
              title={spirit.element}
            />
          )}
        </div>
      </div>

      {/* Spirit Info Below */}
      <div className="flex flex-col items-center gap-0.5 w-full">
        {/* Spirit Name */}
        <div className={`${sizeConfig.nameText} font-bold text-gray-900 dark:text-white text-center truncate w-full px-1`}>
          {spirit.name}
        </div>

        {/* Subtitle (if provided) */}
        {subtitle && (
          <div className={`${sizeConfig.text} text-gray-600 dark:text-gray-400 text-center truncate w-full px-1`}>
            {subtitle}
          </div>
        )}

        {/* Enhancement Level or Placeholder */}
        {showEnhancementLevel && !subtitle && (
          <div className={`${sizeConfig.text} text-center truncate w-full px-1 ${skillEnhancementLevel > 0 ? 'text-gray-600 dark:text-gray-400' : 'opacity-0 pointer-events-none select-none'}`}>
            {skillEnhancementLevel > 0 ? `Enhanced +${skillEnhancementLevel}` : 'Placeholder'}
          </div>
        )}

        {/* Skill Name */}
        {showSkillName && !subtitle && !showEnhancementLevel && (
          <div className={`${sizeConfig.text} text-gray-600 dark:text-gray-400 text-center truncate w-full px-1 hidden sm:block`}>
            {spirit.skill?.name || ''}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpiritComponent;
