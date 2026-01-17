import React, { useState } from 'react';
import { Plus, X, Save, Move, Star, Check } from 'lucide-react';
import FamiliarSprite from './FamiliarSprite';
import { getRarityForStars } from '../utils/familiarHelpers';
import { resolveImagePath } from '../../wiki-framework/src/utils/imageResolver';

/**
 * FamiliarSlot Component
 *
 * Displays a single familiar slot in the Familiar Builder
 * Features:
 * - Category label (Element, Attribute, Weapon)
 * - Animated familiar sprite
 * - Star level configuration (0-10)
 * - Collection familiar badge and save-to-collection button
 * - Drag & drop support
 *
 * @param {object} slot - Full slot data (includes type, myFamiliarId, missing, category, etc.)
 * @param {object} familiar - Familiar data object
 * @param {number} starLevel - Star level (0-10)
 * @param {string} category - Slot category (element, attribute, weapon)
 * @param {number} slotIndex - Slot index (0-2)
 * @param {Array} progressionData - Star progression data
 * @param {function} onSelectFamiliar - Callback when clicking to select familiar
 * @param {function} onRemoveFamiliar - Callback when removing familiar
 * @param {function} onSaveToCollection - Callback when saving base familiar to collection
 * @param {function} onStarLevelChange - Callback when star level changes
 * @param {boolean} readOnly - If true, disable all interactions
 * @param {function} onDragStart - Drag start handler
 * @param {function} onDragOver - Drag over handler
 * @param {function} onDrop - Drop handler
 * @param {boolean} isDragging - Is this slot being dragged
 * @param {boolean} savingToCollection - Is this slot currently being saved to collection
 * @param {boolean} isValidDropTarget - Is this slot a valid drop target for the current drag
 */
const FamiliarSlot = ({
  slot,
  familiar,
  starLevel = 0,
  category,
  slotIndex,
  progressionData = [],
  onSelectFamiliar,
  onRemoveFamiliar,
  onSaveToCollection,
  onStarLevelChange,
  readOnly = false,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging = false,
  savingToCollection = false,
  isValidDropTarget = false
}) => {
  const isEmpty = !familiar;
  const [showConfig, setShowConfig] = useState(false);

  // Get rarity data for current star level
  const rarityData = getRarityForStars(starLevel, progressionData);

  // Category display names
  const categoryNames = {
    element: 'Attribute',
    attribute: 'Battle',
    weapon: 'Weapon'
  };

  // Category colors
  const categoryColors = {
    element: 'bg-red-500',
    attribute: 'bg-blue-500',
    weapon: 'bg-purple-500'
  };

  // Handle star level change
  const handleStarLevelChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    const clampedValue = Math.max(0, Math.min(10, value));
    onStarLevelChange(clampedValue);
  };

  return (
    <div
      className={`relative flex flex-col items-center transition-all ${isDragging ? 'opacity-50' : ''} ${
        isValidDropTarget ? 'scale-105 animate-pulse' : ''
      }`}
      draggable={!isEmpty && !readOnly && onDragStart}
      onDragStart={(e) => {
        if (!isEmpty && !readOnly && onDragStart) {
          onDragStart(e, slotIndex);
        }
      }}
      onDragOver={(e) => {
        if (!readOnly && onDragOver) {
          onDragOver(e, slotIndex);
        }
      }}
      onDrop={(e) => {
        if (!readOnly && onDrop) {
          onDrop(e, slotIndex);
        }
      }}
    >
      {/* Category Label */}
      <div className={`${categoryColors[category] || 'bg-gray-500'} text-white text-xs font-semibold px-3 py-1 rounded-t-lg transition-all ${
        isValidDropTarget ? 'ring-4 ring-green-400 ring-opacity-75 shadow-lg' : ''
      }`}>
        {categoryNames[category] || category}
      </div>

      {/* Slot Container */}
      <div className={`relative bg-gray-100 dark:bg-gray-800 rounded-b-lg p-4 w-full max-w-xs transition-all ${
        isValidDropTarget ? 'ring-4 ring-green-400 ring-opacity-75 bg-green-50 dark:bg-green-900/20 shadow-lg' : ''
      }`}>
        {/* Empty Slot */}
        {isEmpty && (
          <div
            className={`relative aspect-square border-2 border-dashed ${readOnly ? 'border-gray-300 dark:border-gray-700' : 'border-gray-400 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer'} rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors`}
            onClick={() => {
              if (!readOnly && onSelectFamiliar) {
                onSelectFamiliar();
              }
            }}
            onDragOver={(e) => {
              // Allow drop on empty slot
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              // Forward drop to parent
              e.stopPropagation();
              if (!readOnly && onDrop) {
                onDrop(e, slotIndex);
              }
            }}
          >
            <div className="text-center" style={{ pointerEvents: 'none' }}>
              <Plus className="w-12 h-12 mx-auto mb-2 text-gray-400 dark:text-gray-600" />
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Select {categoryNames[category]}
              </div>
            </div>

            {/* Drop indicator */}
            {!readOnly && onDrop && (
              <div className="absolute inset-0 border-4 border-blue-500 rounded-lg opacity-0 pointer-events-none transition-opacity" />
            )}
          </div>
        )}

        {/* Filled Slot */}
        {!isEmpty && (
          <div className="space-y-3">
            {/* Star Level Controls */}
            {!readOnly && onStarLevelChange && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Star Level: {starLevel}
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={starLevel}
                  onChange={handleStarLevelChange}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  style={{
                    background: `linear-gradient(to right, ${rarityData.color} 0%, ${rarityData.color} ${starLevel * 10}%, rgb(229 231 235) ${starLevel * 10}%, rgb(229 231 235) 100%)`
                  }}
                />
              </div>
            )}

            {/* Read-only star level display */}
            {readOnly && (
              <div className="text-center text-xs text-gray-600 dark:text-gray-400">
                Star Level: {starLevel}
              </div>
            )}

            {/* Familiar Display */}
            <div
              className={`group relative aspect-square ${!readOnly && onSelectFamiliar ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (!readOnly && onSelectFamiliar) {
                  onSelectFamiliar();
                }
              }}
            >
              {/* Missing Indicator */}
              {slot?.missing && (
                <div className="absolute inset-0 bg-red-500/20 backdrop-blur-sm rounded-lg flex items-center justify-center z-20">
                  <div className="text-center p-4">
                    <div className="text-red-600 dark:text-red-400 font-bold mb-1">Missing</div>
                    <div className="text-xs text-gray-700 dark:text-gray-300">
                      Familiar was deleted
                    </div>
                  </div>
                </div>
              )}

              {/* Sprite Container with Rarity Border */}
              <div
                className="relative w-full h-full rounded-lg overflow-hidden"
                style={{
                  border: `1px solid ${rarityData.color}`,
                  boxShadow: `0 0 25px ${rarityData.color}80`
                }}
              >
                <FamiliarSprite
                  familiarId={familiar.id}
                  starLevel={starLevel}
                  progressionData={progressionData}
                  animated={true}
                  size="100%"
                  familiarData={familiar}
                />

                {/* Star Display - Directly Under Sprite */}
                {starLevel > 0 && (() => {
                  // 0-5 stars: regular stars, 6-10 stars: red stars
                  const useRedStar = starLevel > 5;
                  const displayStars = starLevel > 5 ? starLevel - 5 : starLevel;
                  const starImage = useRedStar ? 'familiars/Demonstar_2.png' : 'familiars/Demonstar_1.png';

                  return (
                    <div
                      className="flex items-center justify-center cursor-help absolute bottom-0.5 left-1/2 -translate-x-1/2 z-20"
                      title={`Star Level: ${starLevel}/10${useRedStar ? ' (Red Stars)' : ''}`}
                    >
                      {Array.from({ length: 5 }).map((_, index) => (
                        <img
                          key={index}
                          src={resolveImagePath(starImage)}
                          alt="star"
                          className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 ${index < displayStars ? 'opacity-100' : 'opacity-20'}`}
                          style={{ marginLeft: index > 0 ? '-6px' : '0' }}
                        />
                      ))}
                    </div>
                  );
                })()}

                {/* Collection Badge */}
                {slot?.type === "collection" && !slot?.missing && (
                  <div
                    className="absolute top-0 left-0 bg-yellow-500 text-white text-[0.5rem] sm:text-xs px-1.5 py-0.5 rounded-br-lg rounded-tl-lg font-medium shadow-md z-10 flex items-center gap-1"
                    title="From Your Collection"
                  >
                    <Star className="w-3 h-3 fill-current" />
                    <span>Collection</span>
                  </div>
                )}

                {/* Save to Collection Button */}
                {slot?.type === "base" && familiar && !readOnly && onSaveToCollection && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!savingToCollection) {
                        onSaveToCollection();
                      }
                    }}
                    disabled={savingToCollection}
                    className={`absolute bottom-0 left-0 text-white rounded-tr-lg rounded-bl-lg p-1 sm:p-1.5 shadow-lg transition-all z-10 ${
                      savingToCollection
                        ? 'bg-blue-600 opacity-100'
                        : 'bg-green-600 hover:bg-green-700 opacity-70 hover:opacity-100'
                    }`}
                    title={savingToCollection ? 'Saved!' : 'Save to My Familiar Collection'}
                  >
                    {savingToCollection ? (
                      <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                    ) : (
                      <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                  </button>
                )}

                {/* Drag Indicator */}
                {onDragStart && !readOnly && (
                  <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/20 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                    <div className="bg-gray-900/50 rounded-lg p-2">
                      <Move className="w-5 h-5 sm:w-6 sm:h-6 text-white/70" />
                    </div>
                  </div>
                )}
              </div>

              {/* Remove Button */}
              {!readOnly && onRemoveFamiliar && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFamiliar();
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-30"
                  title="Remove familiar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Familiar Name */}
            <div className="text-center">
              <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                {familiar.name}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {familiar.element}
              </div>
            </div>

            {/* Star Rating Display */}
            <div className="flex items-center justify-center gap-1">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300" style={{ color: rarityData.color }}>
                {rarityData.rarityDisplay}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FamiliarSlot;
