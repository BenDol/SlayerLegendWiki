import React, { useState, useEffect } from 'react';
import { Search, Loader } from 'lucide-react';
import FamiliarSprite from './FamiliarSprite';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { getCache } from '../utils/buildCache';
import { getLoadDataEndpoint } from '../utils/apiEndpoints.js';
import { useFamiliarsData } from '../hooks/useFamiliarsData';
import { createLogger } from '../utils/logger';

const logger = createLogger('SavedFamiliarsGallery');

/**
 * SavedFamiliarsGallery Component
 *
 * Browse and drag familiars from the user's collection
 * Used in FamiliarBuilder as a sidebar panel
 *
 * @param {function} onFamiliarSelect - Callback when familiar is clicked (not dragged)
 * @param {boolean} enableDrag - Enable drag & drop functionality
 */
const SavedFamiliarsGallery = ({
  onFamiliarSelect,
  enableDrag = true
}) => {
  const { isAuthenticated, user } = useAuthStore();
  const { familiarsData, progressionData } = useFamiliarsData();
  const [myFamiliars, setMyFamiliars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [starFilter, setStarFilter] = useState('All');

  useEffect(() => {
    if (isAuthenticated && user && familiarsData.length > 0) {
      loadMyFamiliars();
    } else if (!isAuthenticated) {
      setLoading(false);
    }
  }, [isAuthenticated, user, familiarsData]);

  const loadMyFamiliars = async () => {
    try {
      setLoading(true);

      // Try cache first
      const cached = getCache('my_familiars', user.id);
      if (cached) {
        const deserializedFamiliars = cached
          .map(f => deserializeFamiliar(f, familiarsData))
          .filter(f => f !== null && f.familiar !== null);
        setMyFamiliars(deserializedFamiliars);
        setLoading(false);
        return;
      }

      // Fetch from API
      const response = await fetch(`${getLoadDataEndpoint()}?type=my-familiars&userId=${user.id}`);
      const data = await response.json();

      if (data.success) {
        const loadedFamiliars = data.familiars || [];
        const deserializedFamiliars = loadedFamiliars
          .map(f => deserializeFamiliar(f, familiarsData))
          .filter(f => f !== null && f.familiar !== null);
        setMyFamiliars(deserializedFamiliars);
      }
    } catch (error) {
      logger.error('Failed to load my familiars', { error });
    } finally {
      setLoading(false);
    }
  };

  // Deserialize familiar (resolve ID to full object)
  const deserializeFamiliar = (serializedFamiliar, familiarsData) => {
    if (!serializedFamiliar) return null;

    const familiar = familiarsData.find(f => f.id === serializedFamiliar.familiarId);
    return {
      id: serializedFamiliar.id,
      familiar: familiar || null,
      familiarId: serializedFamiliar.familiarId,
      starLevel: serializedFamiliar.starLevel || 0
    };
  };

  if (!isAuthenticated) {
    return (
      <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">
        Sign in to access your familiar collection
      </div>
    );
  }

  // Filter familiars
  const filteredFamiliars = myFamiliars.filter(mf => {
    if (!mf.familiar) return false;

    // Search filter
    if (searchQuery && !mf.familiar.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Star filter
    if (starFilter !== 'All') {
      const starRange = parseInt(starFilter);
      if (isNaN(starRange)) return true;

      if (starRange === 0 && mf.starLevel !== 0) return false;
      if (starRange > 0 && (mf.starLevel < starRange || mf.starLevel >= starRange + 2)) return false;
    }

    return true;
  });

  const starRanges = ['All', '0', '1-2', '3-5', '6-7', '8-10'];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
          My Familiars ({myFamiliars.length})
        </h3>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Star Filter */}
        <div className="flex flex-wrap gap-1">
          {starRanges.map(range => (
            <button
              key={range}
              onClick={() => setStarFilter(range)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                starFilter === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {range === 'All' ? 'All' : range === '0' ? '0★' : `${range}★`}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : filteredFamiliars.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">👹</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {myFamiliars.length === 0
                ? 'No familiars in collection'
                : 'No familiars match filters'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredFamiliars.map(mf => (
              <div
                key={mf.id}
                draggable={enableDrag}
                onDragStart={(e) => {
                  if (enableDrag) {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      type: 'collection-familiar',
                      myFamiliarId: mf.id,
                      familiar: mf.familiar,
                      starLevel: mf.starLevel
                    }));
                  }
                }}
                onClick={() => {
                  if (onFamiliarSelect) {
                    onFamiliarSelect(mf);
                  }
                }}
                className={`group relative p-2 rounded-lg border border-gray-200 dark:border-gray-700 transition-all ${
                  enableDrag
                    ? 'cursor-move hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md'
                    : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {/* Sprite */}
                <div className="aspect-square mb-2">
                  <FamiliarSprite
                    familiarId={mf.familiar.id}
                    starLevel={mf.starLevel}
                    progressionData={progressionData}
                    animated={false}
                    size="100%"
                  />
                </div>

                {/* Info */}
                <div className="text-center">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                    {mf.familiar.name}
                  </div>
                  <div className="text-[0.65rem] text-yellow-400 mt-0.5">
                    {'★'.repeat(mf.starLevel)}
                  </div>
                </div>

                {/* Drag Hint */}
                {enableDrag && (
                  <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 rounded-lg transition-colors pointer-events-none" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedFamiliarsGallery;
