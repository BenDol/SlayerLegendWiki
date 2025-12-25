import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Loader, CheckCircle2 } from 'lucide-react';
import SpiritComponent from './SpiritComponent';
import SpiritSlot from './SpiritSlot';
import SpiritSelector from './SpiritSelector';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { useConfigStore } from '../../wiki-framework/src/store/configStore';
import { getCache, setCache, clearCache } from '../utils/buildCache';
import { getSaveDataEndpoint, getLoadDataEndpoint, getDeleteDataEndpoint } from '../utils/apiEndpoints.js';
import { useSpiritsData } from '../hooks/useSpiritsData';
import { serializeSpirit, deserializeSpirit } from '../utils/spiritSerialization';
import { createLogger } from '../utils/logger';
import { queueAchievementCheck } from '../../wiki-framework/src/services/achievements/achievementQueue.js';

const logger = createLogger('MySpiritCollection');

/**
 * MySpiritCollection Component
 *
 * Manage a collection of configured spirits that can be used in builds
 * Features:
 * - Add spirits with full configuration (level, awakening, evolution, skill enhancement)
 * - View all saved spirits in a grid
 * - Edit or delete spirits
 * - Saved to GitHub backend
 */
const MySpiritCollection = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { spiritsData } = useSpiritsData(); // Load spirits database
  const [spirits, setSpirits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSpiritSelector, setShowSpiritSelector] = useState(false);
  const [editingSpirit, setEditingSpirit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [spiritBuilds, setSpiritBuilds] = useState([]);
  const [hoveredSpiritId, setHoveredSpiritId] = useState(null);

  // Load saved spirits
  useEffect(() => {
    if (isAuthenticated && user && spiritsData.length > 0) {
      loadSpirits();
    } else if (!isAuthenticated) {
      setLoading(false);
    }
  }, [isAuthenticated, user, spiritsData]);

  // Load spirit builds to track usage
  useEffect(() => {
    if (isAuthenticated && user) {
      loadSpiritBuilds();
    }
  }, [isAuthenticated, user]);

  const loadSpiritBuilds = async () => {
    try {
      const response = await fetch(`${getLoadDataEndpoint()}?type=spirit-builds&userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setSpiritBuilds(data.builds || []);
      }
    } catch (error) {
      logger.error('Failed to load spirit builds for usage tracking:', { error });
    }
  };

  // Get builds that use a specific spirit
  const getBuildsUsingSpirit = (spiritId) => {
    return spiritBuilds.filter(build => {
      return build.slots?.some(slot =>
        slot && slot.type === 'collection' && slot.mySpiritId === spiritId
      );
    });
  };

  const loadSpirits = async () => {
    try {
      setLoading(true);

      // Try cache first
      const cached = getCache('my_spirits', user.id);
      if (cached) {
        // Deserialize cached spirits, preserving record IDs
        const deserializedSpirits = cached
          .map(s => deserializeSpirit(s, spiritsData, s.id))
          .filter(s => s !== null && s.spirit !== null);
        setSpirits(deserializedSpirits);
        setLoading(false);
        return;
      }

      // Fetch from API
      const response = await fetch(`${getLoadDataEndpoint()}?type=my-spirits&userId=${user.id}`);
      const data = await response.json();

      if (data.success) {
        const loadedSpirits = data.spirits || [];
        // Deserialize loaded spirits, preserving record IDs
        const deserializedSpirits = loadedSpirits
          .map(s => deserializeSpirit(s, spiritsData, s.id))
          .filter(s => s !== null && s.spirit !== null);
        setSpirits(deserializedSpirits);
        setCache('my_spirits', user.id, loadedSpirits); // Cache serialized version
      }
    } catch (error) {
      logger.error('Failed to load spirits:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSpirit = (selectedSpirit) => {
    setEditingSpirit({
      id: Date.now(), // Temporary ID for new spirit
      spirit: selectedSpirit,
      level: 1,
      awakeningLevel: 0,
      evolutionLevel: 4,
      skillEnhancementLevel: 0,
      isNew: true
    });
    setShowSpiritSelector(false);
  };

  const handleSaveSpirit = async () => {
    if (!editingSpirit || !editingSpirit.spirit) return;

    try {
      setSaving(true);
      setSaveError(null);

      // Serialize spirit to only store ID (reduces storage and is resilient to data changes)
      const spiritData = serializeSpirit(editingSpirit);

      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'my-spirits',
          username: user.login,
          userId: user.id,
          data: spiritData,
          spiritId: editingSpirit.isNew ? undefined : editingSpirit.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save spirit');
      }

      const data = await response.json();

      // Update cache with serialized version
      if (data.spirits) {
        setCache('my_spirits', user.id, data.spirits);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      // Trigger donation prompt on successful save
      window.triggerDonationPrompt?.({
        messages: [
          "Another spirit for the collection! 👻",
          "Your spirit roster is growing! ✨",
          "That's a keeper! 🔮",
          "Collector vibes! Love it! 💜",
        ]
      });

      // Reload spirits (will deserialize the saved data)
      await loadSpirits();

      // Reload spirit builds to update usage badges
      await loadSpiritBuilds();

      // Queue spirit collection achievement checks
      if (user?.id && user?.login) {
        const { config } = useConfigStore.getState();
        if (config?.wiki?.repository) {
          const spiritAchievements = ['spirit-collector', 'collector'];

          logger.info('Queueing spirit achievement checks', {
            userId: user.id,
            username: user.login,
            count: spiritAchievements.length
          });

          spiritAchievements.forEach(achievementId => {
            queueAchievementCheck(achievementId, {
              owner: config.wiki.repository.owner,
              repo: config.wiki.repository.repo,
              userId: user.id,
              username: user.login,
              delay: 2000,       // Wait for GitHub to sync
              retryDelay: 5000,  // Retry delay
              maxRetries: 3,     // Max retries
            }).catch(error => {
              logger.error(`Failed to queue ${achievementId} check`, { error: error.message });
            });
          });
        }
      }

      setEditingSpirit(null);
    } catch (error) {
      logger.error('Failed to save spirit:', { error: error });
      setSaveError(error.message || 'Failed to save spirit');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSpirit = async (spiritId) => {
    logger.debug('handleDeleteSpirit called', { spiritId });

    // First confirmation: Standard delete prompt
    if (!confirm('Delete this spirit from your collection?')) {
      logger.debug('User cancelled deletion at first prompt');
      return;
    }

    // Check if this spirit is used in any spirit builds
    try {
      logger.debug('Fetching spirit builds to check usage');
      const buildsResponse = await fetch(`${getLoadDataEndpoint()}?type=spirit-builds&userId=${user.id}`);

      logger.debug('Builds response', { ok: buildsResponse.ok, status: buildsResponse.status });

      if (buildsResponse.ok) {
        const buildsData = await buildsResponse.json();
        const builds = buildsData.builds || [];

        logger.debug('Loaded spirit builds', { buildCount: builds.length, builds });

        // Check if this spirit (by mySpiritId) is used in any build
        const usedInBuilds = builds.filter(build => {
          return build.slots?.some(slot =>
            slot && slot.type === 'collection' && slot.mySpiritId === spiritId
          );
        });

        logger.debug('Checked build usage', { usedInBuildsCount: usedInBuilds.length, usedInBuilds });

        // Second confirmation: Warning if spirit is used in builds
        if (usedInBuilds.length > 0) {
          const buildNames = usedInBuilds.map(b => b.name).join(', ');
          logger.info('Spirit is used in builds, showing warning', { buildNames });
          if (!confirm(`⚠️ Warning: This spirit is used in ${usedInBuilds.length} spirit build(s): ${buildNames}\n\nDeleting it will remove it from those builds. Continue?`)) {
            logger.debug('User cancelled deletion at warning prompt');
            return;
          }
        }
      } else {
        logger.warn('Failed to load builds, continuing with deletion', { status: buildsResponse.status });
      }
    } catch (err) {
      logger.error('Failed to check build usage, continuing with deletion:', { error: err });
    }

    try {
      const response = await fetch(getDeleteDataEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'my-spirits',
          username: user.login,
          userId: user.id,
          spiritId: spiritId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete spirit');
      }

      const data = await response.json();

      // Update cache with the remaining spirits from server response
      if (data.spirits) {
        setCache('my_spirits', user.id, data.spirits);

        // Deserialize and update local state immediately
        const deserializedSpirits = data.spirits
          .map(s => deserializeSpirit(s, spiritsData, s.id))
          .filter(s => s !== null && s.spirit !== null);
        setSpirits(deserializedSpirits);
      } else {
        // Fallback: clear cache and reload if response doesn't contain spirits
        clearCache('my_spirits', user.id);
        await loadSpirits();
      }

      // Reload spirit builds to update usage badges
      await loadSpiritBuilds();
    } catch (error) {
      logger.error('Failed to delete spirit:', { error: error });
      alert('Failed to delete spirit');
    }
  };

  const handleEditSpirit = (spirit) => {
    setEditingSpirit({ ...spirit, isNew: false });
  };

  const handleCancelEdit = () => {
    setEditingSpirit(null);
    setSaveError(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-8 border border-gray-200 dark:border-gray-800 shadow-sm max-w-md w-full">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Authentication Required</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Sign in to save and manage your spirit collection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🔮</span>
                <span>My Spirit Collection</span>
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Save and manage your configured spirits for quick access in builds
              </p>
            </div>
            <button
              onClick={() => setShowSpiritSelector(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Spirit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : spirits.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg p-12 border border-gray-200 dark:border-gray-800 shadow-sm text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No spirits in your collection yet
            </p>
            <button
              onClick={() => setShowSpiritSelector(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors mx-auto"
            >
              <Plus className="w-4 h-4" />
              Add Your First Spirit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {spirits.map((spirit) => {
              const buildsUsingSpirit = getBuildsUsingSpirit(spirit.id);
              const isUsedInBuilds = buildsUsingSpirit.length > 0;
              const isHovered = hoveredSpiritId === spirit.id;

              return (
                <div
                  key={spirit.id}
                  className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center relative"
                >
                  {/* Usage Badge */}
                  {isUsedInBuilds && (
                    <div
                      className="absolute top-0 left-0 z-50"
                      onMouseEnter={() => setHoveredSpiritId(spirit.id)}
                      onMouseLeave={() => setHoveredSpiritId(null)}
                    >
                      <div className="relative">
                        <div className="bg-blue-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-tl-lg rounded-br-lg shadow-md cursor-help">
                          Used in {buildsUsingSpirit.length}
                        </div>

                        {/* Hover Popup - no gap to prevent hover loss */}
                        {isHovered && (
                          <div className="absolute top-full left-0 pt-1">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[200px]">
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Used in these builds:
                              </div>
                              <div className="space-y-1">
                                {buildsUsingSpirit.map((build) => (
                                  <a
                                    key={build.id}
                                    href={`#/spirit-builder?build=${build.id}`}
                                    className="block text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                                    onClick={() => setHoveredSpiritId(null)}
                                  >
                                    {build.name}
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
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
                    showEnhancementLevel={true}
                    showElementIcon={true}
                    size="medium"
                  />
                  <div className="mt-3 flex gap-2 w-full">
                    <button
                      onClick={() => handleEditSpirit(spirit)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs font-medium transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSpirit(spirit.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs font-medium transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add Spirit Placeholder Button */}
            <button
              onClick={() => setShowSpiritSelector(true)}
              className="bg-white dark:bg-gray-900 rounded-lg p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 shadow-sm transition-all flex flex-col items-center justify-center min-h-[200px] group"
            >
              <div className="w-16 h-16 rounded-full border-2 border-gray-400 dark:border-gray-600 group-hover:border-blue-500 dark:group-hover:border-blue-400 flex items-center justify-center transition-colors mb-3">
                <Plus className="w-8 h-8 text-gray-400 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Add Spirit
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Spirit Selector Modal */}
      <SpiritSelector
        isOpen={showSpiritSelector}
        onClose={() => setShowSpiritSelector(false)}
        onSelectSpirit={handleAddSpirit}
      />

      {/* Edit Spirit Modal */}
      {editingSpirit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingSpirit.isNew ? 'Add Spirit' : 'Edit Spirit'}
            </h2>

            <div className="flex justify-center mb-4">
              <SpiritSlot
                spirit={editingSpirit.spirit}
                level={editingSpirit.level}
                awakeningLevel={editingSpirit.awakeningLevel}
                evolutionLevel={editingSpirit.evolutionLevel}
                skillEnhancementLevel={editingSpirit.skillEnhancementLevel}
                isCompanionSlot={false}
                onLevelChange={(newLevel) => setEditingSpirit({ ...editingSpirit, level: newLevel })}
                onAwakeningLevelChange={(newAwakening) => setEditingSpirit({ ...editingSpirit, awakeningLevel: newAwakening })}
                onEvolutionChange={(newEvolution) => setEditingSpirit({ ...editingSpirit, evolutionLevel: newEvolution })}
                onSkillEnhancementChange={(newSkillEnh) => setEditingSpirit({ ...editingSpirit, skillEnhancementLevel: newSkillEnh })}
                readOnly={false}
                configAsPopup={false}
              />
            </div>

            {saveError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                {saveError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSpirit}
                disabled={saving || saveSuccess}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Saved!
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySpiritCollection;

