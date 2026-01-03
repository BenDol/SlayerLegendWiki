import React from 'react';
import { Plus } from 'lucide-react';
import SkillStone from './SkillStone';

/**
 * SkillStoneSlot Component
 *
 * Displays a single skill stone slot with:
 * - Empty state with + icon
 * - Configured state with SkillStone component
 * - Hover overlay for remove action
 * - Stone type label
 *
 * Props:
 * - slot: { type, element, tier } - Slot configuration or empty
 * - slotIndex: number - Slot index (0-2)
 * - onSelectStone: function - Callback when add button clicked
 * - onRemoveStone: function - Callback when slot clicked (to remove)
 * - readOnly: boolean - If true, clicking stone does nothing
 * - stoneData: object - Skill stones data from skill_stones.json
 */
const SkillStoneSlot = ({
  slot,
  slotIndex,
  onSelectStone,
  onRemoveStone,
  readOnly = false,
  stoneData
}) => {
  // Get stone type data
  const stoneTypeData = stoneData?.stoneTypes?.[slot.type];
  const stoneName = stoneTypeData?.name || slot.type;

  // Empty slot
  if (!slot.element || !slot.tier) {
    return (
      <div className="relative flex flex-col items-center">
        {/* Empty Slot */}
        <div
          className="relative w-24 h-28 sm:w-28 sm:h-32 group cursor-pointer flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors bg-gray-50 dark:bg-gray-900/50"
          onClick={onSelectStone}
        >
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full border-2 border-gray-400 dark:border-gray-500 flex items-center justify-center group-hover:border-blue-500 transition-colors">
              <Plus className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
            </div>
            <span className="text-gray-600 dark:text-gray-500 text-[9px] group-hover:text-blue-400 transition-colors text-center px-1">
              Add<br/>{stoneName}
            </span>
          </div>
        </div>

        {/* Stone Type Label */}
        <div className="mt-2 text-[10px] sm:text-xs text-center text-gray-600 dark:text-gray-400 font-medium">
          {stoneName}
        </div>
      </div>
    );
  }

  // Get stone effect description
  const bonus = stoneTypeData?.bonuses?.[slot.tier];
  const bonusText = bonus !== undefined
    ? stoneTypeData?.bonusFormat?.replace('{value}', bonus)
    : '';
  const effectDescription = stoneTypeData?.description || '';
  const fullDescription = effectDescription && bonusText
    ? `${effectDescription}: ${bonusText}`
    : '';

  // Slot with stone configured
  return (
    <div className="relative flex flex-col items-center group">
      {/* Stone Display */}
      <div
        className={`relative cursor-pointer transition-opacity ${!readOnly ? 'hover:opacity-80' : ''}`}
        onClick={readOnly ? undefined : onRemoveStone}
      >
        <div className="relative z-0">
          <SkillStone
            stoneType={slot.type}
            element={slot.element}
            tier={slot.tier}
            data={stoneData}
            size="medium"
            disableHover={!readOnly}
          />
        </div>

        {/* Hover Remove Overlay - Only if not readOnly */}
        {!readOnly && (
          <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/20 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
            <span className="text-white text-[10px] font-bold bg-red-600 px-2 py-1 rounded shadow-lg">
              Remove
            </span>
          </div>
        )}
      </div>

      {/* Stone Effect Description - Show in builder only (not readOnly) */}
      {!readOnly && fullDescription && (
        <div className="mt-1 text-[10px] text-center text-gray-700 dark:text-gray-300 font-medium">
          {fullDescription}
        </div>
      )}

      {/* Stone Type Label */}
      <div className="mt-1 text-[10px] sm:text-xs text-center text-gray-600 dark:text-gray-400 font-medium">
        {stoneName}
      </div>
    </div>
  );
};

export default SkillStoneSlot;
