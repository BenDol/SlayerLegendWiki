import React, { useState, useRef, useEffect } from 'react';
import { Lock, Plus, Move } from 'lucide-react';
import { getSkillGradeColor } from '../../wiki-framework/src/utils/rarityColors';

/**
 * SkillSlot Component
 *
 * Displays a single skill slot with:
 * - Skill icon
 * - Enhancement level indicator
 * - Skill name
 * - Rarity glow effect
 * - Add/Remove buttons
 * - Locked state
 *
 * Props:
 * - skill: Skill object or null if empty
 * - level: Enhancement level (1-130 or skill's maxLevel)
 * - isLocked: Whether slot is locked
 * - slotNumber: Slot index (1-10)
 * - onSelectSkill: Callback when add button clicked
 * - onRemoveSkill: Callback when skill clicked (to remove)
 * - onLevelChange: Callback when level changed
 * - readOnly: If true, clicking skill shows info instead of removing
 * - onSkillClick: Callback when skill clicked in readOnly mode
 */
const SkillSlot = ({
  skill = null,
  level = 1,
  isLocked = false,
  slotNumber,
  slotIndex,
  onSelectSkill,
  onRemoveSkill,
  onLevelChange,
  readOnly = false,
  onSkillClick,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging = false
}) => {
  const [showLevelInput, setShowLevelInput] = useState(false);
  const levelBadgeRef = useRef(null);

  // Get rarity colors
  const gradeColors = skill ? getSkillGradeColor(skill.grade) : { border: 'border-gray-600', glow: '' };

  // Get element icon
  const getElementIcon = (element) => {
    const icons = {
      Fire: '/images/icons/typeicon_fire_1.png',
      Water: '/images/icons/typeicon_water_1.png',
      Wind: '/images/icons/typeicon_wind_1.png',
      Earth: '/images/icons/typeicon_earth s_1.png'
    };
    return icons[element];
  };

  // Handle level change
  const handleLevelChange = (newLevel) => {
    const maxLevel = skill?.maxLevel || 130;
    const validLevel = Math.max(1, Math.min(newLevel, maxLevel));
    onLevelChange?.(validLevel);
  };

  // Add wheel event listener with passive: false to prevent page scroll
  useEffect(() => {
    const badge = levelBadgeRef.current;
    if (!badge || !skill) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -1 : 1; // Scroll down = decrease, scroll up = increase
      const newLevel = level + delta;
      const maxLevel = skill?.maxLevel || 130;
      const validLevel = Math.max(1, Math.min(newLevel, maxLevel));
      onLevelChange?.(validLevel);
    };

    badge.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      badge.removeEventListener('wheel', handleWheel);
    };
  }, [skill, level, onLevelChange]);

  // Locked slot
  if (isLocked) {
    return (
      <div className="relative flex flex-col items-center">
        {/* Slot Background */}
        <div className="relative w-24 h-24 sm:w-24 sm:h-24">
          <img
            src="/images/skills/skill_baseSlot_Wide.png"
            alt="Locked Slot"
            className="w-full h-full object-contain opacity-50"
          />

          {/* Lock Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gray-900/80 rounded-full p-3">
              <Lock className="w-6 h-6 text-gray-500" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty slot
  if (!skill) {
    return (
      <div
        className="relative flex flex-col items-center"
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver?.(e, slotNumber);
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop?.(e, slotNumber);
        }}
      >
        {/* Empty Slot - Similar to Spirit Placeholder */}
        <div
          className="relative w-24 h-24 sm:w-24 sm:h-24 group cursor-pointer flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors bg-gray-50 dark:bg-gray-900/50"
          onClick={onSelectSkill}
        >
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full border-2 border-gray-400 dark:border-gray-500 flex items-center justify-center group-hover:border-blue-500 transition-colors">
              <Plus className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
            </div>
            <span className="text-gray-600 dark:text-gray-500 text-[10px] group-hover:text-blue-400 transition-colors">Add Skill</span>
          </div>
        </div>

        {/* Placeholder for alignment with skill names */}
        <div className="mt-4 h-[2.25rem] max-w-[100px]"></div>
      </div>
    );
  }

  // Skill slot with skill equipped
  return (
    <div
      className="relative flex flex-col items-center group"
      draggable={!isLocked && (onDragStart !== undefined)}
      onDragStart={(e) => !isLocked && onDragStart?.(e, slotIndex ?? slotNumber)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e, slotIndex ?? slotNumber);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(e, slotIndex ?? slotNumber);
      }}
    >
      {/* Skill Icon Container */}
      <div
        className={`relative w-24 h-24 sm:w-24 sm:h-24 cursor-pointer transition-opacity ${isDragging ? 'opacity-50' : ''}`}
        onClick={readOnly ? () => onSkillClick?.(skill) : onRemoveSkill}
      >
        {/* Skill Icon with Rarity Glow */}
        <div className={`absolute inset-0 rounded-lg overflow-hidden border-2 ${gradeColors.border} ${gradeColors.glow}`}>
          <img
            src={skill.icon || '/images/skills/skill_deam.png'}
            alt={skill.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = '/images/skills/skill_deam.png';
            }}
          />

          {/* Element Icon Overlay */}
          {getElementIcon(skill.attribute) && (
            <img
              src={getElementIcon(skill.attribute)}
              alt={skill.attribute}
              className="absolute -top-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            />
          )}
        </div>

        {/* Hover indicator */}
        {!readOnly && (
          <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/20 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            {onDragStart ? (
              <div className="bg-gray-900/50 rounded-lg p-2">
                <Move className="w-6 h-6 text-white/70" />
              </div>
            ) : (
              <span className="text-white text-xs font-bold bg-red-600 px-2 py-1 rounded">
                Remove
              </span>
            )}
          </div>
        )}
        {readOnly && (
          <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/20 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            {onDragStart && (
              <div className="bg-gray-900/50 rounded-lg p-2">
                <Move className="w-6 h-6 text-white/70" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Level Badge - Top Center */}
      <div
        ref={levelBadgeRef}
        className="absolute top-[2px] left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-900 text-white text-[10px] font-bold rounded px-1.5 py-0.5 border border-gray-700 cursor-pointer hover:scale-110 transition-transform z-20 shadow-md"
        onClick={(e) => {
          e.stopPropagation();
          setShowLevelInput(!showLevelInput);
        }}
      >
        Lv.{level}
      </div>

      {/* Level Input (appears when level badge clicked) */}
      {showLevelInput && (
        <div className="absolute top-0 left-full ml-2 z-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 shadow-xl">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Level (1-{skill.maxLevel})</div>
          <input
            type="number"
            min="1"
            max={skill.maxLevel}
            value={level}
            onChange={(e) => handleLevelChange(parseInt(e.target.value) || 1)}
            onWheel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const delta = e.deltaY > 0 ? -1 : 1;
              const newLevel = level + delta;
              const maxLevel = skill?.maxLevel || 130;
              const validLevel = Math.max(1, Math.min(newLevel, maxLevel));
              handleLevelChange(validLevel);
            }}
            className="w-20 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onBlur={() => setShowLevelInput(false)}
            autoFocus
          />
          <div className="flex gap-1 mt-1">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                handleLevelChange(1);
                setShowLevelInput(false);
              }}
              className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-2 py-1 rounded"
            >
              Min
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                handleLevelChange(skill.maxLevel);
                setShowLevelInput(false);
              }}
              className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-2 py-1 rounded"
            >
              Max
            </button>
          </div>
        </div>
      )}

      {/* Skill Name */}
      <div className="mt-4 text-xs sm:text-sm text-center text-gray-900 dark:text-white font-bold max-w-[100px] leading-tight">
        {skill.name}
      </div>
    </div>
  );
};

export default SkillSlot;
