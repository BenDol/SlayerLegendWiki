import React, { useState, useEffect } from 'react';
import { Loader, RefreshCw } from 'lucide-react';
import SpiritComponent from './SpiritComponent';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { getCache, setCache, clearCache } from '../utils/buildCache';

/**
 * SavedSpiritsGallery Component
 *
 * Display saved spirits in a compact gallery for quick selection
 * Used in Spirit Builder to quickly add spirits to slots
 *
 * @param {function} onSelectSpirit - Callback when a spirit is clicked
 * @param {array} excludedSpiritIds - Array of spirit IDs already in use (to gray out)
 */
const SavedSpiritsGallery = ({ onSelectSpirit, excludedSpiritIds = [] }) => {
  const { isAuthenticated, user } = useAuthStore();
  const [spirits, setSpirits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadSpirits();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const loadSpirits = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (!forceRefresh) {
        // Try cache first
        const cached = getCache('my-spirits', user.id);
        if (cached) {
          setSpirits(cached);
          setLoading(false);
          return;
        }
      }

      // Fetch from API
      const response = await fetch(`/.netlify/functions/load-data?type=my-spirit&userId=${user.id}`);
      const data = await response.json();

      if (data.success) {
        const loadedSpirits = data.spirits || [];
        setSpirits(loadedSpirits);
        setCache('my-spirits', user.id, loadedSpirits);
      }
    } catch (error) {
      console.error('Failed to load spirits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    clearCache('my-spirits', user.id);
    loadSpirits(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          Sign in to access your spirit collection
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <Loader className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (spirits.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
          No saved spirits yet
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
          Visit <a href="/#/my-spirits" className="text-blue-600 dark:text-blue-400 hover:underline">My Spirit Collection</a> to add spirits
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          My Saved Spirits
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="Refresh spirits"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {spirits.map((spirit) => {
          const isInUse = excludedSpiritIds.includes(spirit.spirit?.id);
          return (
            <div
              key={spirit.id}
              className={`relative bg-white dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-800 shadow-sm transition-all ${
                isInUse
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:shadow-md hover:scale-105'
              }`}
              onClick={() => !isInUse && onSelectSpirit(spirit)}
            >
              {isInUse && (
                <div className="absolute top-1 right-1 bg-gray-600 text-white text-xs px-1.5 py-0.5 rounded z-10">
                  In Use
                </div>
              )}
              <SpiritComponent
                spirit={spirit.spirit}
                level={spirit.level}
                awakeningLevel={spirit.awakeningLevel}
                evolutionLevel={spirit.evolutionLevel}
                skillEnhancementLevel={spirit.skillEnhancementLevel}
                showLevelOverlays={true}
                showPlatform={true}
                showSkillName={false}
                showElementIcon={true}
                size="small"
              />
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-3">
        Click a spirit to add it to your build
      </p>
    </div>
  );
};

export default SavedSpiritsGallery;
