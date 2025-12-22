import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Settings, Move, Save } from 'lucide-react';
import SpiritSprite from './SpiritSprite';

/**
 * SpiritSlot Component
 *
 * Displays a single spirit slot in the Spirit Builder
 * Features:
 * - Ring platform effect
 * - Animated spirit sprite
 * - Configuration controls (level, awakening level, evolution, skill enhancement)
 * - Companion slot special indicator
 * - Collection spirit badge and save-to-collection button
 *
 * @param {object} slot - Full slot data (includes type, mySpiritId, missing, etc.)
 * @param {object} spirit - Spirit data object
 * @param {number} level - Spirit level (1-300)
 * @param {number} awakeningLevel - Awakening level (0+), every 6 levels = +1 evolution
 * @param {number} evolutionLevel - Evolution level (0-7), used when awakeningLevel is 0
 * @param {number} skillEnhancementLevel - Skill enhancement level (0-5)
 * @param {boolean} isCompanionSlot - Is this the companion slot?
 * @param {number} slotNumber - Slot number (1-3)
 * @param {function} onSelectSpirit - Callback when clicking to select spirit
 * @param {function} onRemoveSpirit - Callback when removing spirit
 * @param {function} onSaveToCollection - Callback when saving base spirit to collection
 * @param {function} onLevelChange - Callback when level changes
 * @param {function} onAwakeningLevelChange - Callback when awakening level changes
 * @param {function} onEvolutionChange - Callback when evolution level changes
 * @param {function} onSkillEnhancementChange - Callback when skill enhancement changes
 * @param {boolean} readOnly - If true, disable all interactions
 * @param {boolean} configAsPopup - If true, show config in popup modal instead of inline
 */
const SpiritSlot = ({
  slot,
  spirit,
  level = 1,
  awakeningLevel = 0,
  evolutionLevel = 4,
  skillEnhancementLevel = 0,
  isCompanionSlot = false,
  slotNumber = 1,
  slotIndex,
  onSelectSpirit,
  onRemoveSpirit,
  onSaveToCollection,
  onLevelChange,
  onAwakeningLevelChange,
  onEvolutionChange,
  onSkillEnhancementChange,
  readOnly = false,
  configAsPopup = false,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging = false
}) => {
  const isEmpty = !spirit;
  const [showConfigPopup, setShowConfigPopup] = useState(false);

  // Refs for input fields to attach wheel event listeners with passive: false
  const inlineLevelInputRef = useRef(null);
  const modalLevelInputRef = useRef(null);
  const inlineAwakeningInputRef = useRef(null);
  const modalAwakeningInputRef = useRef(null);

  // Element icon mapping
  const elementIcons = {
    Fire: '/images/icons/typeicon_fire_1.png',
    Water: '/images/icons/typeicon_water_1.png',
    Wind: '/images/icons/typeicon_wind_1.png',
    Earth: '/images/icons/typeicon_earth s_1.png',
    Light: '/images/icons/typeicon_random_1.png',
    Dark: '/images/icons/typeicon_random_1.png',
  };

  // Calculate effective evolution level
  // Awakening is only available starting at Evolution Level 4 (Legendary)
  // Every 6 awakening levels adds +1 to the base evolution level
  const effectiveEvolutionLevel = evolutionLevel >= 4 && awakeningLevel > 0
    ? evolutionLevel + Math.floor(awakeningLevel / 6)
    : evolutionLevel;

  // Cap effective evolution at 7 (max evolution level)
  const cappedEvolutionLevel = Math.min(effectiveEvolutionLevel, 7);

  // Calculate awakening stars (0-5)
  // Stars represent progress to next evolution level
  // Every 6 awakening levels = +1 evolution, so stars = awakeningLevel % 6
  const awakeningStars = awakeningLevel > 0 ? awakeningLevel % 6 : 0;

  // Awakening and Skill Enhancement are disabled below Evolution Level 4
  const isAwakeningEnabled = evolutionLevel >= 4;
  const isSkillEnhancementEnabled = evolutionLevel >= 4;

  // Calculate max awakening level: (max_evolution - current_evolution) * 6
  // Example: At Evo 4, max awakening = (7 - 4) * 6 = 18
  const maxAwakeningLevel = isAwakeningEnabled ? (7 - evolutionLevel) * 6 : 0;

  // Handle level input change
  const handleLevelInput = (e) => {
    const value = parseInt(e.target.value) || 1;
    const clampedValue = Math.max(1, Math.min(300, value));
    onLevelChange(clampedValue);
  };

  // Handle awakening level input change
  const handleAwakeningLevelInput = (e) => {
    const value = parseInt(e.target.value) || 0;
    const clampedValue = Math.max(0, Math.min(maxAwakeningLevel, value));
    onAwakeningLevelChange(clampedValue);
  };

  // Handle evolution change - clear awakening/skill enhancement if dropping below level 4, or clamp if exceeds new max
  const handleEvolutionChangeWithAwakeningCheck = (newEvolution) => {
    onEvolutionChange(newEvolution);

    // If dropping below evolution 4, reset awakening and skill enhancement to 0
    if (newEvolution < 4) {
      if (awakeningLevel > 0) {
        onAwakeningLevelChange(0);
      }
      if (skillEnhancementLevel > 0) {
        onSkillEnhancementChange(0);
      }
    }
    // If awakening exceeds new max, clamp it
    else if (newEvolution >= 4) {
      const newMaxAwakening = (7 - newEvolution) * 6;
      if (awakeningLevel > newMaxAwakening) {
        onAwakeningLevelChange(newMaxAwakening);
      }
    }
  };

  // Add wheel event listener for inline awakening input with passive: false
  useEffect(() => {
    const input = inlineAwakeningInputRef.current;
    if (!input || readOnly || !isAwakeningEnabled) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -1 : 1;
      const newLevel = Math.max(0, Math.min(awakeningLevel + delta, maxAwakeningLevel));
      handleAwakeningLevelInput({ target: { value: newLevel } });
    };

    input.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      input.removeEventListener('wheel', handleWheel);
    };
  }, [awakeningLevel, maxAwakeningLevel, isAwakeningEnabled, readOnly]);

  // Add wheel event listener for modal awakening input with passive: false
  useEffect(() => {
    const input = modalAwakeningInputRef.current;
    if (!input || !isAwakeningEnabled) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -1 : 1;
      const newLevel = Math.max(0, Math.min(awakeningLevel + delta, maxAwakeningLevel));
      handleAwakeningLevelInput({ target: { value: newLevel } });
    };

    input.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      input.removeEventListener('wheel', handleWheel);
    };
  }, [awakeningLevel, maxAwakeningLevel, isAwakeningEnabled]);

  // Add wheel event listener for inline level input with passive: false
  useEffect(() => {
    const input = inlineLevelInputRef.current;
    if (!input || readOnly) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -1 : 1;
      const newLevel = Math.max(1, Math.min(level + delta, 300));
      handleLevelInput({ target: { value: newLevel } });
    };

    input.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      input.removeEventListener('wheel', handleWheel);
    };
  }, [level, readOnly]);

  // Add wheel event listener for modal level input with passive: false
  useEffect(() => {
    const input = modalLevelInputRef.current;
    if (!input) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -1 : 1;
      const newLevel = Math.max(1, Math.min(level + delta, 300));
      handleLevelInput({ target: { value: newLevel } });
    };

    input.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      input.removeEventListener('wheel', handleWheel);
    };
  }, [level]);

  return (
    <div
      className={`flex flex-col items-center gap-2 transition-opacity ${isDragging ? 'opacity-50' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e, slotIndex ?? slotNumber);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(e, slotIndex ?? slotNumber);
      }}
    >
      {/* Slot Label */}
      <div className="text-center">
        <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
          {isCompanionSlot ? (
            <span className="text-yellow-600 dark:text-yellow-400 font-bold">
              Accompanying
            </span>
          ) : (
            <>
              <span className="hidden sm:inline">Partner Spirit {slotNumber}</span>
              <span className="inline sm:hidden">Partner {slotNumber}</span>
            </>
          )}
        </div>
        {/* Subtitle - visible for companion, placeholder for partners to maintain alignment */}
        <div className="hidden sm:block text-xs mt-0.5 h-4">
          {isCompanionSlot ? (
            <span className="text-yellow-700 dark:text-yellow-500">
              Enhanced passive effect
            </span>
          ) : (
            <span className="opacity-0 pointer-events-none select-none" aria-hidden="true">
              &nbsp;
            </span>
          )}
        </div>
      </div>

      {/* Spirit Display with Ring Platform */}
      <div className="relative">
        {/* Ring Platform Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 blur-xl"></div>
        </div>

        {/* Spirit Container */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 flex items-center justify-center">
          {isEmpty ? (
            <button
              onClick={onSelectSpirit}
              disabled={!onSelectSpirit}
              className={`w-full h-full border-2 border-dashed ${
                isCompanionSlot
                  ? 'border-yellow-500 dark:border-yellow-400 bg-yellow-500/5 hover:bg-yellow-500/10'
                  : 'border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              } rounded-full flex items-center justify-center transition-colors ${
                onSelectSpirit ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <Plus className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 ${
                isCompanionSlot
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-gray-400 dark:text-gray-600'
              }`} />
            </button>
          ) : (
            <div className="relative group">
              {/* Spirit Sprite */}
              <div
                className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32"
                draggable={!readOnly && !!onDragStart}
                onDragStart={(e) => {
                  if (!readOnly && onDragStart) {
                    onDragStart(e, slotIndex ?? slotNumber);
                  }
                }}
              >
                {/* Missing Spirit Indicator */}
                {slot?.missing && (
                  <div className="absolute inset-0 bg-red-500/30 rounded-lg border-2 border-red-500 flex items-center justify-center z-20 pointer-events-none">
                    <div className="text-center text-red-900 dark:text-red-100 font-bold text-xs sm:text-sm">
                      <div>Spirit</div>
                      <div>Deleted</div>
                    </div>
                  </div>
                )}

                <SpiritSprite
                  spiritId={spirit.id}
                  level={cappedEvolutionLevel}
                  animationType="idle"
                  animated={true}
                  fps={8}
                  size="100%"
                  showInfo={false}
                  displayLevel={readOnly && configAsPopup ? level : null}
                  displayAwakeningLevel={null}
                  displaySkillEnhancement={readOnly && configAsPopup ? skillEnhancementLevel : null}
                />

                {/* Awakening Stars - Directly Under Sprite */}
                {awakeningStars > 0 && (
                  <div
                    className="flex items-center justify-center gap-0.5 cursor-help absolute bottom-0.5 left-1/2 -translate-x-1/2 z-20"
                    title={`Awakening Level: ${awakeningLevel} total (${awakeningStars}/6 progress to next evolution)`}
                  >
                    {Array.from({ length: 5 }).map((_, index) => (
                      <img
                        key={index}
                        src="/images/other/Star_1.png"
                        alt="star"
                        className={`w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 ${index < awakeningStars ? 'opacity-100' : 'opacity-20'}`}
                      />
                    ))}
                  </div>
                )}

                {/* Element Icon Overlay */}
                <img
                  src={elementIcons[spirit.element] || '/images/icons/typeicon_random_1.png'}
                  alt={spirit.element}
                  className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 drop-shadow-lg z-10"
                  title={spirit.element}
                />

                {/* Collection Badge */}
                {slot?.type === "collection" && !slot?.missing && (
                  <div
                    className="absolute top-0 left-0 bg-blue-600 text-white text-[0.5rem] sm:text-xs px-1.5 py-0.5 rounded-br-lg rounded-tl-lg font-medium shadow-md z-10"
                    title="From Your Collection"
                  >
                    Collection
                  </div>
                )}

                {/* Save to Collection Button (bottom-left) */}
                {slot?.type === "base" && spirit && !readOnly && onSaveToCollection && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSaveToCollection();
                    }}
                    className="absolute bottom-0 left-0 bg-green-600 hover:bg-green-700 text-white rounded-tr-lg rounded-bl-lg p-1 sm:p-1.5 shadow-lg opacity-70 hover:opacity-100 transition-opacity z-10"
                    title="Save to My Spirit Collection"
                  >
                    <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                )}

                {/* Drag Indicator (show on hover when draggable) */}
                {onDragStart && (
                  <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/20 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                    <div className="bg-gray-900/50 rounded-lg p-2">
                      <Move className="w-5 h-5 sm:w-6 sm:h-6 text-white/70" />
                    </div>
                  </div>
                )}
              </div>

              {/* Remove Button (show on hover, not in readOnly mode) */}
              {!readOnly && onRemoveSpirit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSpirit();
                  }}
                  className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-30"
                  title="Remove spirit"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Spirit Info & Controls */}
      {!isEmpty && (
        <div className="w-full max-w-xs space-y-2">
          {/* Spirit Name */}
          <div className="text-center">
            <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
              {spirit.name}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 hidden sm:block">
              {spirit.skill.name}
            </div>
          </div>

          {/* Configuration Controls - Inline Mode */}
          {!configAsPopup && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 sm:p-3 space-y-1.5 sm:space-y-2">
              <div className="sm:max-w-[180px] sm:mx-auto space-y-1.5 sm:space-y-2">
                {/* Level Input */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Level:
                  </label>
                  <input
                    ref={inlineLevelInputRef}
                    type="number"
                    value={level}
                    onChange={handleLevelInput}
                    disabled={readOnly}
                    min="1"
                    max="300"
                    className="w-full sm:w-20 px-2 py-1.5 sm:py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Evolution Level */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Evolution:
                  </label>
                  <select
                    value={evolutionLevel}
                    onChange={(e) => handleEvolutionChangeWithAwakeningCheck(parseInt(e.target.value))}
                    disabled={readOnly}
                    className="w-full sm:w-20 px-2 py-1.5 sm:py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title={cappedEvolutionLevel !== evolutionLevel ? `Effective: ${cappedEvolutionLevel} (${evolutionLevel} + ${Math.floor(awakeningLevel / 6)} from awakening)` : "Base evolution level (max 4, use awakening for higher)"}
                  >
                    {[0, 1, 2, 3, 4].map(lvl => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Awakening Level (only available at Evolution 4+) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Awakening:
                  </label>
                  <input
                    ref={inlineAwakeningInputRef}
                    type="number"
                    value={awakeningLevel}
                    onChange={handleAwakeningLevelInput}
                    disabled={readOnly || !isAwakeningEnabled}
                    min="0"
                    max={maxAwakeningLevel}
                    className="w-full sm:w-20 px-2 py-1.5 sm:py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!isAwakeningEnabled ? "Awakening unlocks at Evolution Level 4 (Legendary)" : `Every 6 awakening = +1 evolution (Max: ${maxAwakeningLevel}, Current bonus: +${Math.floor(awakeningLevel / 6)})`}
                  />
                </div>

                {/* Skill Enhancement Level (only available at Evolution 4+) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Skill Enh:
                  </label>
                <select
                  value={skillEnhancementLevel}
                  onChange={(e) => onSkillEnhancementChange(parseInt(e.target.value))}
                  disabled={readOnly || !isSkillEnhancementEnabled}
                  className="w-full sm:w-20 px-2 py-1.5 sm:py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!isSkillEnhancementEnabled ? "Skill Enhancement unlocks at Evolution Level 4 (Legendary)" : "Skill enhancement level"}
                >
                  {[0, 1, 2, 3, 4, 5].map(lvl => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
                </div>
              </div>
            </div>
          )}

          {/* Configuration Button - Popup Mode */}
          {configAsPopup && !readOnly && (
            <button
              onClick={() => setShowConfigPopup(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors border border-gray-300 dark:border-gray-600"
            >
              <Settings className="w-4 h-4" />
              <span>Configure</span>
            </button>
          )}

          {/* Read-only Stats Display - Popup Mode (removed, now shown on sprite) */}
        </div>
      )}

      {/* Configuration Popup Modal */}
      {configAsPopup && showConfigPopup && !isEmpty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" onClick={() => setShowConfigPopup(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Configure {spirit.name}
              </h3>
              <button
                onClick={() => setShowConfigPopup(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Configuration Controls */}
            <div className="space-y-4">
              {/* Level Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Level
                </label>
                <input
                  ref={modalLevelInputRef}
                  type="number"
                  value={level}
                  onChange={handleLevelInput}
                  min="1"
                  max="300"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                  Range: 1-300
                </div>
              </div>

              {/* Evolution Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Evolution Level (Base)
                </label>
                <select
                  value={evolutionLevel}
                  onChange={(e) => handleEvolutionChangeWithAwakeningCheck(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {[0, 1, 2, 3, 4].map(lvl => (
                    <option key={lvl} value={lvl}>
                      Evolution {lvl}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                  Max base evolution is 4 (use awakening to reach 5-7)
                </div>
                {cappedEvolutionLevel !== evolutionLevel && (
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1 text-center font-medium">
                    Effective Evolution: {cappedEvolutionLevel} ({evolutionLevel} + {Math.floor(awakeningLevel / 6)} from awakening)
                  </div>
                )}
              </div>

              {/* Awakening Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Awakening Level {!isAwakeningEnabled && '(Locked)'}
                </label>
                <input
                  ref={modalAwakeningInputRef}
                  type="number"
                  value={awakeningLevel}
                  onChange={handleAwakeningLevelInput}
                  disabled={!isAwakeningEnabled}
                  min="0"
                  max={maxAwakeningLevel}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                  {!isAwakeningEnabled
                    ? '🔒 Unlocks at Evolution Level 4 (Legendary)'
                    : `Range: 0-${maxAwakeningLevel} (Every 6 = +1 evolution, Current bonus: +${Math.floor(awakeningLevel / 6)})`}
                </div>
              </div>

              {/* Skill Enhancement Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Skill Enhancement Level {!isSkillEnhancementEnabled && '(Locked)'}
                </label>
                <select
                  value={skillEnhancementLevel}
                  onChange={(e) => onSkillEnhancementChange(parseInt(e.target.value))}
                  disabled={!isSkillEnhancementEnabled}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {[0, 1, 2, 3, 4, 5].map(lvl => (
                    <option key={lvl} value={lvl}>
                      +{lvl}
                    </option>
                  ))}
                </select>
                {!isSkillEnhancementEnabled && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                    🔒 Unlocks at Evolution Level 4 (Legendary)
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowConfigPopup(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpiritSlot;
