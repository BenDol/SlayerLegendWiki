import React, { useState, useEffect } from 'react';
import { X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import FamiliarSprite from './FamiliarSprite';
import { createLogger } from '../utils/logger';

const logger = createLogger('FamiliarSelector');

/**
 * FamiliarSelector Component
 *
 * Modal for selecting a familiar from available familiars
 * Filters by category constraint (element/attribute/weapon)
 *
 * @param {boolean} isOpen - Is the modal open?
 * @param {function} onClose - Callback when closing modal
 * @param {function} onSelectFamiliar - Callback when familiar is selected
 * @param {object} currentBuild - Current familiar build to check for duplicates
 * @param {string} categoryFilter - Category constraint for this slot (element, attribute, weapon)
 * @param {object} categoriesData - Categories data from familiar-categories.json
 * @param {Array} progressionData - Star progression data
 */
const FamiliarSelector = ({
  isOpen,
  onClose,
  onSelectFamiliar,
  currentBuild = null,
  categoryFilter = null,
  categoriesData = {},
  progressionData = []
}) => {
  const [familiars, setFamiliars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [elementFilter, setElementFilter] = useState('All');
  const [attributeFilter, setAttributeFilter] = useState('All');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    loadFamiliars();
  }, []);

  const loadFamiliars = async () => {
    try {
      const response = await fetch('/data/familiars.json');
      const data = await response.json();
      setFamiliars(Array.isArray(data) ? data : []);
    } catch (error) {
      logger.error('Failed to load familiars', { error });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Get familiar categories from categoriesData
  const getFamiliarCategories = (familiarId) => {
    const familiarCat = categoriesData?.familiarCategories?.find(fc => fc.familiarId === familiarId);
    return familiarCat?.categories || {};
  };

  // Check if familiar matches the category filter for this slot
  const matchesCategoryFilter = (familiar) => {
    if (!categoryFilter) return true;

    const familiarCategories = getFamiliarCategories(familiar.id);

    // Check if familiar's primary category matches the slot's required category
    return familiarCategories.primary === categoryFilter;
  };

  // Filter familiars
  const filteredFamiliars = familiars.filter(familiar => {
    // Search filter
    if (searchQuery && !familiar.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Element filter
    if (elementFilter !== 'All' && familiar.element !== elementFilter) {
      return false;
    }

    // Type filter
    if (attributeFilter !== 'All' && familiar.type !== attributeFilter) {
      return false;
    }

    // Category constraint filter
    if (!matchesCategoryFilter(familiar)) {
      return false;
    }

    return true;
  });

  // Check if familiar is already in build
  const isFamiliarInBuild = (familiarId) => {
    if (!currentBuild || !currentBuild.slots) return false;
    return currentBuild.slots.some(slot => slot.familiar && slot.familiar.id === familiarId);
  };

  // Get unique elements and types
  const elements = ['All', ...new Set(familiars.map(f => f.element).filter(Boolean))];
  const types = ['All', ...new Set(familiars.map(f => f.type).filter(Boolean))];

  // Category display name
  const categoryNames = {
    element: 'Element',
    attribute: 'Battle',
    weapon: 'Weapon'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Select Familiar
            </h2>
            {categoryFilter && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Category: {categoryNames[categoryFilter] || categoryFilter}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Current Build Preview */}
        {currentBuild && currentBuild.slots && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">Current Build</div>
            <div className="grid grid-cols-3 gap-3">
              {currentBuild.slots.map((slot, index) => {
                const slotCategories = ['Element', 'Battle', 'Weapon'];
                return (
                  <div
                    key={index}
                    className="relative bg-white dark:bg-gray-900 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-3"
                  >
                    <div className="text-[0.65rem] font-medium text-gray-500 dark:text-gray-400 mb-2 text-center">
                      {slotCategories[index]}
                    </div>
                    {slot.familiar ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 mb-1 flex items-center justify-center">
                          <FamiliarSprite
                            familiarId={slot.familiar.id}
                            starLevel={slot.starLevel || 0}
                            progressionData={progressionData}
                            animated={false}
                            size="48px"
                          />
                        </div>
                        <div className="text-[0.65rem] font-medium text-gray-900 dark:text-white text-center truncate w-full">
                          {slot.familiar.name}
                        </div>
                        <div className="text-[0.6rem] text-gray-500 dark:text-gray-400">
                          ⭐ {slot.starLevel || 0}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-12 text-gray-400 dark:text-gray-600 text-xs">
                        Empty
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search familiars..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Toggle Advanced Filters Button */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {showAdvancedFilters ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Hide Filters</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Show Filters (Element & Type)</span>
              </>
            )}
          </button>

          {/* Advanced Filters (Hidden by default) */}
          {showAdvancedFilters && (
            <>
              {/* Element Filter */}
              <div>
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Element</div>
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

              {/* Type Filter */}
              <div>
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Type</div>
                <div className="flex flex-wrap gap-2">
                  {types.map(type => (
                    <button
                      key={type}
                      onClick={() => setAttributeFilter(type)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        attributeFilter === type
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Familiar Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-600 dark:text-gray-400">Loading familiars...</div>
            </div>
          ) : filteredFamiliars.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-gray-600 dark:text-gray-400 mb-2">No familiars found</div>
                {categoryFilter && (
                  <div className="text-sm text-gray-500 dark:text-gray-500">
                    Try adjusting filters or selecting a different category
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredFamiliars.map(familiar => {
                const isInBuild = isFamiliarInBuild(familiar.id);
                return (
                  <button
                    key={familiar.id}
                    onClick={() => {
                      if (isInBuild) {
                        alert('This familiar is already in your build!');
                        return;
                      }
                      onSelectFamiliar(familiar);
                      onClose();
                    }}
                    className={`group relative p-3 rounded-lg border-2 transition-all ${
                      isInBuild
                        ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg cursor-pointer'
                    }`}
                    disabled={isInBuild}
                  >
                    {/* Familiar Sprite */}
                    <div className="aspect-square mb-2">
                      <FamiliarSprite
                        familiarId={familiar.id}
                        starLevel={0}
                        progressionData={progressionData}
                        animated={false}
                        size="100%"
                      />
                    </div>

                    {/* Familiar Info */}
                    <div className="text-center">
                      <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {familiar.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {familiar.element}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 capitalize">
                        {familiar.type}
                      </div>
                    </div>

                    {/* Already in build indicator */}
                    {isInBuild && (
                      <div className="absolute top-2 right-2 bg-gray-600 text-white text-[0.6rem] px-1.5 py-0.5 rounded">
                        In Build
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredFamiliars.length} of {familiars.length} familiars
        </div>
      </div>
    </div>
  );
};

export default FamiliarSelector;
