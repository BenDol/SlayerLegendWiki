import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import SpiritSprite from './SpiritSprite';

/**
 * SpiritSelector Component
 *
 * Modal for selecting a spirit from available spirits
 * Similar to SkillSelector but for spirits
 *
 * @param {boolean} isOpen - Is the modal open?
 * @param {function} onClose - Callback when closing modal
 * @param {function} onSelectSpirit - Callback when spirit is selected
 * @param {object} currentBuild - Current spirit build to check for duplicates
 */
const SpiritSelector = ({ isOpen, onClose, onSelectSpirit, currentBuild = null }) => {
  const [spirits, setSpirits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [elementFilter, setElementFilter] = useState('All');

  // Element icon mapping
  const elementIcons = {
    Fire: '/images/icons/typeicon_fire_1.png',
    Water: '/images/icons/typeicon_water_1.png',
    Wind: '/images/icons/typeicon_wind_1.png',
    Earth: '/images/icons/typeicon_earth s_1.png',
    Light: '/images/icons/typeicon_random_1.png',
    Dark: '/images/icons/typeicon_random_1.png',
  };

  useEffect(() => {
    loadSpirits();
  }, []);

  const loadSpirits = async () => {
    try {
      const response = await fetch('/data/spirit-characters.json');
      const data = await response.json();
      setSpirits(data.spirits);
    } catch (error) {
      console.error('Failed to load spirits:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter spirits
  const filteredSpirits = spirits.filter(spirit => {
    // Search filter
    if (searchQuery && !spirit.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Element filter
    if (elementFilter !== 'All' && spirit.element !== elementFilter) {
      return false;
    }

    return true;
  });

  // Check if spirit is already in build
  const isSpiritInBuild = (spiritId) => {
    if (!currentBuild || !currentBuild.slots) return false;
    return currentBuild.slots.some(slot => slot.spirit && slot.spirit.id === spiritId);
  };

  // Get unique elements
  const elements = ['All', ...new Set(spirits.map(s => s.element).filter(Boolean))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Select Spirit
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search spirits..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Element Filter */}
          <div className="flex flex-wrap gap-2">
            {elements.map(element => (
              <button
                key={element}
                onClick={() => setElementFilter(element)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  elementFilter === element
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {element}
              </button>
            ))}
          </div>
        </div>

        {/* Spirit Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-600 dark:text-gray-400">Loading spirits...</div>
            </div>
          ) : filteredSpirits.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-600 dark:text-gray-400">No spirits found</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredSpirits.map(spirit => {
                const isInBuild = isSpiritInBuild(spirit.id);
                return (
                  <button
                    key={spirit.id}
                    onClick={() => {
                      if (isInBuild) {
                        alert('This spirit is already in your build!');
                        return;
                      }
                      onSelectSpirit(spirit);
                      onClose();
                    }}
                    disabled={isInBuild}
                    className={`relative p-3 rounded-lg border-2 transition-all ${
                      isInBuild
                        ? 'border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                        : 'border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 bg-white dark:bg-gray-800 hover:shadow-lg cursor-pointer'
                    }`}
                  >
                    {/* Already in build indicator */}
                    {isInBuild && (
                      <div className="absolute top-1 right-1 bg-gray-600 text-white text-xs px-1.5 py-0.5 rounded z-20">
                        In Build
                      </div>
                    )}

                    {/* Spirit Sprite */}
                    <div className="flex justify-center mb-2">
                      <div className="relative w-20 h-20">
                        <SpiritSprite
                          spiritId={spirit.id}
                          level={4}
                          animationType="idle"
                          animated={true}
                          fps={8}
                          size="80px"
                          showInfo={false}
                        />

                        {/* Element Icon Overlay */}
                        <img
                          src={elementIcons[spirit.element] || '/images/icons/typeicon_random_1.png'}
                          alt={spirit.element}
                          className="absolute -top-1 -right-1 w-6 h-6 drop-shadow-lg z-10"
                          title={spirit.element}
                        />
                      </div>
                    </div>

                    {/* Spirit Info */}
                    <div className="text-center">
                      <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
                        {spirit.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">
                        {spirit.skill.type}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Click on a spirit to add it to your build
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpiritSelector;
