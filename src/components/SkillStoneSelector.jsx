import React, { useState, useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import SkillStone from './SkillStone';

/**
 * SkillStoneSelector Component
 *
 * Two-step modal for selecting skill stone element and tier:
 * Step 1: Select element (fire, water, wind, earth)
 * Step 2: Select tier (A or B)
 *
 * Props:
 * - isOpen: boolean - Whether modal is visible
 * - onClose: function - Close modal callback
 * - onSelectStone: function(element, tier) - Selection callback
 * - stoneType: string - Type of stone ('cooldown', 'time', 'heat')
 * - stoneData: object - Skill stones data from skill_stones.json
 */
const SkillStoneSelector = ({
  isOpen,
  onClose,
  onSelectStone,
  stoneType,
  stoneData
}) => {
  const [step, setStep] = useState(1); // 1 = element selection, 2 = tier selection
  const [selectedElement, setSelectedElement] = useState(null);

  // Reset to step 1 when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedElement(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !stoneData) return null;

  const stoneTypeInfo = stoneData.stoneTypes[stoneType];
  const elements = Object.keys(stoneData.elements);
  const tiers = stoneData.tiers;

  // Handle element selection (go to step 2)
  const handleElementSelect = (element) => {
    setSelectedElement(element);
    setStep(2);
  };

  // Handle tier selection (complete and close)
  const handleTierSelect = (tier) => {
    onSelectStone(selectedElement, tier);
    onClose();
  };

  // Handle back button (return to step 1)
  const handleBack = () => {
    setStep(1);
    setSelectedElement(null);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full pointer-events-auto max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button
                  onClick={handleBack}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              )}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Select {stoneTypeInfo?.name || stoneType}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 1 ? (
              // Step 1: Element Selection
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Choose an element for your {stoneTypeInfo?.name || stoneType}:
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {elements.map((element) => {
                    const elementData = stoneData.elements[element];
                    return (
                      <button
                        key={element}
                        onClick={() => handleElementSelect(element)}
                        className="group relative bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border-2 border-gray-300 dark:border-gray-700 hover:border-blue-500 transition-all hover:shadow-lg"
                        style={{
                          borderColor: elementData.color
                        }}
                      >
                        {/* Element Icon */}
                        <div className="flex flex-col items-center gap-3">
                          <div className="relative">
                            <img
                              src={getElementIcon(element)}
                              alt={elementData.name}
                              className="w-20 h-20 object-contain"
                            />
                            {/* Glow effect */}
                            <div
                              className="absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-50 transition-opacity"
                              style={{
                                backgroundColor: elementData.glowColor
                              }}
                            />
                          </div>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {elementData.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Step 2: Tier Selection
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Choose a tier for your {stoneData.elements[selectedElement]?.name} {stoneTypeInfo?.name}:
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {tiers.map((tier) => {
                    const bonus = stoneTypeInfo.bonuses[tier];
                    const bonusText = stoneTypeInfo.bonusFormat.replace('{value}', bonus);

                    return (
                      <button
                        key={tier}
                        onClick={() => handleTierSelect(tier)}
                        className="group relative bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border-2 border-gray-300 dark:border-gray-700 hover:border-blue-500 transition-all hover:shadow-lg"
                      >
                        <div className="flex flex-col items-center gap-3">
                          {/* Stone Preview */}
                          <div className="transform scale-90">
                            <SkillStone
                              stoneType={stoneType}
                              element={selectedElement}
                              tier={tier}
                              data={stoneData}
                              size="medium"
                            />
                          </div>

                          {/* Tier Info */}
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                              Tier {tier}
                            </div>
                            <div className="text-sm text-blue-600 dark:text-blue-400 font-semibold">
                              {bonusText}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {stoneTypeInfo.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// Helper function to get element icon path
const getElementIcon = (element) => {
  const iconMap = {
    fire: '/images/icons/typeicon_fire_1.png',
    water: '/images/icons/typeicon_water_1.png',
    wind: '/images/icons/typeicon_wind_1.png',
    earth: '/images/icons/typeicon_earth s_1.png'
  };
  return iconMap[element];
};

export default SkillStoneSelector;
