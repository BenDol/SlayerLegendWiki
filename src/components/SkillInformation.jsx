import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * SkillInformation Modal Component
 *
 * Displays detailed information about a skill in a modal overlay
 * Used in Battle Loadouts to view skill details without editing
 */
const SkillInformation = ({ skill, isOpen, onClose }) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Handle Escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);

      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !skill) return null;

  // Get element icon
  const getElementIcon = (element) => {
    const icons = {
      Fire: '/images/content/icons/typeicon_fire_1.png',
      Water: '/images/content/icons/typeicon_water_1.png',
      Wind: '/images/content/icons/typeicon_wind_1.png',
      Earth: '/images/content/icons/typeicon_earth s_1.png'
    };
    return icons[element];
  };

  // Element color mapping for badges
  const elementColors = {
    Fire: { badge: 'bg-red-600', text: 'text-red-100' },
    Water: { badge: 'bg-blue-600', text: 'text-blue-100' },
    Wind: { badge: 'bg-green-600', text: 'text-green-100' },
    Earth: { badge: 'bg-yellow-600', text: 'text-yellow-100' },
    Lightning: { badge: 'bg-purple-600', text: 'text-purple-100' },
  };

  const colors = elementColors[skill.attribute || skill.element] || elementColors.Fire;
  const elementIcon = getElementIcon(skill.attribute || skill.element);

  // Calculate damage at max level (level 20)
  const calculateMaxDamage = () => {
    if (!skill.power || !skill.maxLevel) return null;
    const basePower = skill.power;
    const maxLevel = skill.maxLevel;
    // Formula: Base Power + (Level - 1) * 5
    const maxDamage = basePower + (maxLevel - 1) * 5;
    return maxDamage;
  };

  const maxDamage = calculateMaxDamage();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[95vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors shadow-lg z-20"
          aria-label="Close"
          style={{ right: '1rem', left: 'auto' }}
        >
          <X className="w-6 h-6" />
        </button>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-4 sm:mb-6">
            {/* Skill Icon */}
            {skill.icon && (
              <div className="flex-shrink-0 aspect-square w-16 sm:w-20 rounded-lg border-2 border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <img
                  src={skill.icon}
                  alt={skill.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.src = '/images/content/skills/skill_deam.png';
                  }}
                />
              </div>
            )}

            {/* Title and Element */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1.5 break-words pr-10">
                {skill.name}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                {elementIcon && (
                  <span className={`inline-flex items-center justify-center p-0.5 rounded-full ${colors.badge}`}>
                    <img
                      src={elementIcon}
                      alt={skill.attribute || skill.element}
                      className="w-4 h-4 sm:w-5 sm:h-5"
                    />
                  </span>
                )}
                {skill.type && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium">
                    {skill.type}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {skill.description && (
            <div className="mb-4 sm:mb-6">
              <p className="text-gray-700 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
                {skill.description}
              </p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* MP Cost */}
            {skill.mpCost !== undefined && skill.mpCost !== null && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 sm:p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">MP Cost</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{skill.mpCost}</div>
              </div>
            )}

            {/* Cooldown */}
            {skill.cooldown !== undefined && skill.cooldown !== null && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 sm:p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Cooldown</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{skill.cooldown}s</div>
              </div>
            )}

            {/* Range */}
            {skill.range !== undefined && skill.range !== null && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 sm:p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Range</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{skill.range}</div>
              </div>
            )}

            {/* Power */}
            {skill.power !== undefined && skill.power !== null && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 sm:p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Base Power</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{skill.power}</div>
              </div>
            )}

            {/* Max Level */}
            {skill.maxLevel !== undefined && skill.maxLevel !== null && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 sm:p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Max Level</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{skill.maxLevel}</div>
              </div>
            )}

            {/* Max Damage */}
            {maxDamage !== null && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 sm:p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Max Damage (Lv {skill.maxLevel})</div>
                <div className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">{maxDamage}</div>
              </div>
            )}

            {/* Duration */}
            {skill.duration !== undefined && skill.duration !== null && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 sm:p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Duration</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{skill.duration}s</div>
              </div>
            )}

            {/* Effect */}
            {skill.effect && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 sm:p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Effect</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{skill.effect}</div>
              </div>
            )}

            {/* Unlock Level */}
            {skill.unlockLevel !== undefined && skill.unlockLevel !== null && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 sm:p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Unlock Level</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Lv {skill.unlockLevel}</div>
              </div>
            )}

            {/* Element Damage */}
            {skill.elementDamage !== undefined && skill.elementDamage !== null && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 sm:p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Element Damage</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{skill.elementDamage}%</div>
              </div>
            )}
          </div>

          {/* Additional Info */}
          {skill.notes && (
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 font-semibold">Notes</div>
              <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {skill.notes}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkillInformation;
