import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Trash2, Upload, AlertCircle, Tag } from 'lucide-react';
import SpiritSprite from './SpiritSprite';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { getCache, setCache, clearCache } from '../utils/buildCache';
import { getLoadDataEndpoint, getDeleteDataEndpoint } from '../utils/apiEndpoints.js';
import { getUserLoadouts } from '../services/battleLoadouts';
import { useSpiritsData } from '../hooks/useSpiritsData';
import { deserializeBuild } from '../utils/spiritSerialization';
import { createLogger } from '../utils/logger';

const logger = createLogger('SavedSpiritBuildsPanel');

/**
 * SavedSpiritBuildsPanel Component
 *
 * Manages saved spirit builds with GitHub backend
 * Features:
 * - Load saved builds
 * - Delete builds
 * - Highlight currently loaded build
 * - Local caching
 *
 * @param {object} currentBuild - Current build state
 * @param {string} buildName - Current build name
 * @param {function} onLoadBuild - Callback when loading a build
 * @param {function} onBuildsChange - Callback when builds list changes
 * @param {string} currentLoadedBuildId - ID of currently loaded build
 * @param {boolean} defaultExpanded - Whether panel should be expanded by default
 * @param {array} savedBuilds - External saved builds list (optional, for controlled mode)
 * @param {array} mySpiritsFromParent - User's spirit collection from parent (optional, prevents duplicate loading)
 */
const SavedSpiritBuildsPanel = ({
  currentBuild,
  buildName,
  onLoadBuild,
  onBuildsChange = null,
  currentLoadedBuildId = null,
  defaultExpanded = false,
  savedBuilds: externalSavedBuilds = null,
  mySpiritsFromParent = null
}) => {
  const { isAuthenticated, user } = useAuthStore();
  const { spiritsData } = useSpiritsData(); // Load spirits database
  const [internalSavedBuilds, setInternalSavedBuilds] = useState([]);
  const [internalMySpirits, setInternalMySpirits] = useState([]); // Load user's spirit collection (fallback)

  // Use parent's mySpirits if provided, otherwise use internal state
  const mySpirits = mySpiritsFromParent !== null ? mySpiritsFromParent : internalMySpirits;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [deletingId, setDeletingId] = useState(null);
  const [showEnhancementTags, setShowEnhancementTags] = useState(false);

  // Load user's my-spirits collection (only if not provided by parent)
  useEffect(() => {
    if (mySpiritsFromParent === null && isAuthenticated && user?.id) {
      loadMySpirits();
    }
  }, [isAuthenticated, user?.id, mySpiritsFromParent]);
  // NOTE: Only loads if parent doesn't provide mySpirits to prevent duplicate loading

  // Load saved builds
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }

    // If in controlled mode (external builds provided), don't load
    if (externalSavedBuilds !== null) {
      setLoading(false);
      return;
    }

    // Wait for spirits data to load before loading builds
    if (spiritsData.length > 0) {
      loadSavedBuilds();
    }
  }, [isAuthenticated, user, externalSavedBuilds, spiritsData]);

  // Use external builds if provided (controlled mode), otherwise use internal state
  // Deserialize whichever builds we're using (pass mySpirits for collection resolution)
  const savedBuilds = useMemo(() => {
    const builds = externalSavedBuilds !== null ? externalSavedBuilds : internalSavedBuilds;
    if (spiritsData.length === 0) return builds; // Can't deserialize without spirits data

    logger.debug('Deserializing saved builds', {
      buildCount: builds.length,
      mySpiritsCount: mySpirits.length,
      firstBuildSlots: builds[0]?.slots
    });

    const deserialized = builds.map(build => {
      const result = deserializeBuild(build, spiritsData, mySpirits);

      // Normalize to always have 3 slots (for consistent comparison)
      const emptySlot = {
        type: 'base',
        spirit: null,
        level: 1,
        awakeningLevel: 0,
        evolutionLevel: 4,
        skillEnhancementLevel: 0
      };

      const normalizedSlots = Array(3).fill(null).map((_, index) => {
        const slot = result.slots?.[index];
        if (!slot || slot.spirit === undefined) {
          return { ...emptySlot };
        }
        return slot;
      });

      logger.debug('Build deserialized and normalized', {
        buildId: build.id,
        originalSlotCount: build.slots?.length,
        normalizedSlotCount: normalizedSlots.length,
        slots: normalizedSlots.map(s => ({
          type: s.type,
          mySpiritId: s.mySpiritId,
          spiritId: s.spirit?.id,
          missing: s.missing
        }))
      });

      return { ...result, slots: normalizedSlots };
    });

    return deserialized;
  }, [externalSavedBuilds, internalSavedBuilds, spiritsData]);
  // NOTE: mySpirits intentionally NOT in dependencies to prevent re-deserialization
  // when collection spirits are updated, which would trigger unnecessary recalculations
  // and could interfere with the user's current build edits

  const loadMySpirits = async () => {
    if (!user?.id) return;

    try {
      logger.debug('Loading my-spirits collection', { userId: user.id });
      const endpoint = `${getLoadDataEndpoint()}?type=my-spirits&userId=${user.id}`;
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // API returns { spirits: [...] }, extract the array
      const spiritsArray = data.spirits || data || [];
      setInternalMySpirits(Array.isArray(spiritsArray) ? spiritsArray : []);
      logger.debug('Loaded my-spirits collection', { count: spiritsArray?.length || 0 });
    } catch (error) {
      logger.error('Failed to load my-spirits collection', { error });
      setInternalMySpirits([]); // Set empty array on error
    }
  };

  const loadSavedBuilds = async () => {
    if (!user || !isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);

      // Try cache first
      const cached = getCache('spirit_builds', user.id);
      if (cached) {
        // Store serialized builds (will be deserialized by useMemo)
        setInternalSavedBuilds(cached);
        // Notify parent component of loaded builds
        if (onBuildsChange) {
          onBuildsChange(cached);
        }
        setLoading(false);
        return;
      }

      // Fetch from API
      const response = await fetch(`${getLoadDataEndpoint()}?type=spirit-builds&userId=${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Check if response is HTML (likely 404 page) instead of JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('Serverless functions not available. Make sure to run "npm run dev" (Netlify dev server) instead of "npm run dev:vite".');
      }

      if (!response.ok) {
        throw new Error('Failed to load builds');
      }

      const data = await response.json();
      const builds = data.builds || [];

      // Sort by updatedAt (newest first)
      const sortedBuilds = builds.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      // Store serialized builds (will be deserialized by useMemo)
      setInternalSavedBuilds(sortedBuilds);

      // Notify parent component of loaded builds
      if (onBuildsChange) {
        onBuildsChange(sortedBuilds);
      }

      // Cache the serialized builds
      setCache('spirit_builds', user.id, sortedBuilds);
    } catch (err) {
      logger.error('Failed to load builds:', { error: err });
      setError(err.message || 'Failed to load builds');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBuild = (build) => {
    onLoadBuild(build);

    // Update URL with build parameter
    const currentHash = window.location.hash.split('?')[0];
    const newHash = `${currentHash}?build=${build.id}`;
    window.history.replaceState(null, '', newHash);
  };

  const handleDeleteBuild = async (buildId) => {
    // First confirmation: Standard delete prompt
    if (!confirm('Delete this spirit build? This cannot be undone.')) return;

    // Check if this build is used in any battle loadouts
    try {
      const loadouts = await getUserLoadouts(user.id, user.login);
      const usedInLoadouts = loadouts.filter(loadout => loadout.spiritBuildId === buildId);

      // Second confirmation: Warning if build is used in loadouts
      if (usedInLoadouts.length > 0) {
        const loadoutNames = usedInLoadouts.map(l => l.name).join(', ');
        if (!confirm(`⚠️ Warning: This spirit build is used in ${usedInLoadouts.length} battle loadout(s): ${loadoutNames}\n\nDeleting it will remove it from those loadouts. Continue?`)) {
          return;
        }
      }
    } catch (err) {
      logger.error('Failed to check loadout usage, continuing with deletion:', { error: err });
    }

    setDeletingId(buildId);

    try {
      const response = await fetch(getDeleteDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'spirit-builds',
          username: user.login,
          userId: user.id,
          itemId: buildId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete build');
      }

      const data = await response.json();
      const updatedBuilds = data.builds || [];

      // Clear cache
      clearCache('spirit_builds', user.id);

      // Update state based on mode (store serialized, will be deserialized by useMemo)
      if (externalSavedBuilds !== null) {
        // Controlled mode: update parent via callback
        if (onBuildsChange) {
          onBuildsChange(updatedBuilds);
        }
      } else {
        // Uncontrolled mode: update internal state
        setInternalSavedBuilds(updatedBuilds);
      }
    } catch (err) {
      logger.error('Failed to delete build:', { error: err });
      alert('Failed to delete build: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Compact Spirit Preview Component
  const CompactSpiritPreview = ({ slot }) => {
    if (!slot.spirit) return null;

    const { spirit, level, awakeningLevel, evolutionLevel, skillEnhancementLevel } = slot;

    // Calculate effective evolution level
    const effectiveEvolutionLevel = evolutionLevel >= 4 && awakeningLevel > 0
      ? evolutionLevel + Math.floor(awakeningLevel / 6)
      : evolutionLevel;
    const cappedEvolutionLevel = Math.min(effectiveEvolutionLevel, 7);

    // Calculate awakening stars (0-5)
    const awakeningStars = awakeningLevel > 0 ? awakeningLevel % 6 : 0;

    return (
      <div className="flex flex-col items-center gap-0.5">
        {/* Sprite with awakening stars */}
        <div className="relative w-10 h-10 [&_.spirit-sprite-container>div>div]:!border-0 [&_.spirit-sprite-container>div>div]:!bg-transparent [&_.spirit-sprite-container>div>div]:!rounded-none">
          <SpiritSprite
            spiritId={spirit.id}
            level={cappedEvolutionLevel}
            animationType="idle"
            animated={true}
            fps={8}
            size="100%"
            showInfo={false}
            displayLevel={null}
            displayAwakeningLevel={null}
            displaySkillEnhancement={null}
          />

          {/* Awakening Stars */}
          {awakeningStars > 0 && (
            <div className="flex items-center justify-center gap-0.1 absolute -bottom-1 left-1/2 -translate-x-1/2">
              {Array.from({ length: 5 }).map((_, index) => (
                <img
                  key={index}
                  src="/images/other/Star_1.png"
                  alt="star"
                  className={`w-2 h-2 ${index < awakeningStars ? 'opacity-100' : 'opacity-20'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Skill Enhancement Tag (Toggleable) */}
        {showEnhancementTags && skillEnhancementLevel > 0 && (
          <div className="px-0.5 bg-purple-500 text-white text-[9px] font-semibold rounded">
            +{skillEnhancementLevel}
          </div>
        )}
      </div>
    );
  };

  if (!isAuthenticated) {
    return null; // Don't show if not authenticated
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            Saved Spirit Builds
          </span>
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          )}
          {!loading && savedBuilds.length > 0 && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              ({savedBuilds.length})
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          )}
        </button>

        {/* Toggle Enhancement Tags Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowEnhancementTags(!showEnhancementTags);
          }}
          className={`p-2 rounded transition-colors ${
            showEnhancementTags
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title={showEnhancementTags ? 'Hide enhancement tags' : 'Show enhancement tags'}
        >
          <Tag className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
            </div>
          )}

          {!loading && savedBuilds.length === 0 && (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              <p className="text-sm">No saved spirit builds yet</p>
              <p className="text-xs mt-1">Create and save your first spirit build!</p>
            </div>
          )}

          {!loading && savedBuilds.length > 0 && (
            <div className="max-h-[230px] overflow-y-auto pr-2">
              <div className="space-y-2">
                {savedBuilds.map(build => {
                const isCurrentlyLoaded = currentLoadedBuildId === build.id;
                const spirits = build.slots?.filter(s => s.spirit !== null) || [];

                return (
                  <div
                    key={build.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isCurrentlyLoaded
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Build Info */}
                      <button
                        onClick={() => handleLoadBuild(build)}
                        className="flex-1 text-left hover:opacity-80 transition-opacity"
                      >
                        <div className="flex items-center justify-between gap-3">
                          {/* Left Side: Name and Date */}
                          <div className="flex flex-col gap-1 min-w-0 flex-shrink">
                            {/* Name and Loaded Badge */}
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[80px] sm:max-w-none">
                                {build.name || 'Unnamed Build'}
                              </div>
                              {isCurrentlyLoaded && (
                                <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full flex-shrink-0">
                                  Loaded
                                </span>
                              )}
                            </div>

                            {/* Date */}
                            <div className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0">
                              {new Date(build.updatedAt || build.createdAt).toLocaleDateString()}
                            </div>
                          </div>

                          {/* Right Side: Spirit Previews */}
                          {spirits.length > 0 ? (
                            <div className="flex items-center gap-2">
                              {spirits.map((slot, index) => (
                                <CompactSpiritPreview key={index} slot={slot} />
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-500 italic">
                              Empty build
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Actions */}
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleDeleteBuild(build.id)}
                          disabled={deletingId === build.id}
                          className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                          title="Delete build"
                        >
                          {deletingId === build.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SavedSpiritBuildsPanel;

