import React, { useState, useEffect } from 'react';
import { Save, Loader, Trash2, Clock, CheckCircle2, LogIn, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { useWikiConfig } from '../../wiki-framework/src/hooks/useWikiConfig';
import { useLoginFlow } from '../../wiki-framework/src/hooks/useLoginFlow';
import LoginModal from '../../wiki-framework/src/components/auth/LoginModal';
import { getCache, setCache, mergeCacheWithGitHub } from '../utils/buildCache';
import { getSaveDataEndpoint, getDeleteDataEndpoint, getLoadDataEndpoint } from '../utils/apiEndpoints.js';
import { getUserLoadouts } from '../services/battleLoadouts';
import { getSkillGradeColor } from '../config/rarityColors';
import { createLogger } from '../utils/logger';
import SkillStone from './SkillStone';

const logger = createLogger('SavedBuildsPanel');

/**
 * SavedBuildsPanel Component
 *
 * Displays and manages user's saved builds (skill builds, engraving builds, etc.)
 * Features:
 * - Load saved builds
 * - Save current build
 * - Delete builds
 * - Mobile-friendly UI
 */
const SavedBuildsPanel = ({
  currentBuild,
  buildName,
  maxSlots,
  onLoadBuild,
  allowSavingBuilds = true,
  currentLoadedBuildId = null,
  onBuildsChange = null,
  defaultExpanded = true,
  externalBuilds = null,
  buildType = 'skill-builds', // Type of build: 'skill-builds', 'engraving-builds', etc.
  buildData = null // Additional build data to save (for builders that need more than slots/maxSlots)
}) => {
  const { isAuthenticated, user } = useAuthStore();
  const { config } = useWikiConfig();
  const loginFlow = useLoginFlow();
  const [internalSavedBuilds, setInternalSavedBuilds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [weapons, setWeapons] = useState([]);
  const [skills, setSkills] = useState([]);
  const [stoneData, setStoneData] = useState(null);

  // Use external builds if provided (controlled mode), otherwise use internal state
  const savedBuilds = externalBuilds !== null ? externalBuilds : internalSavedBuilds;

  // Load weapons data for engraving builds
  useEffect(() => {
    if (buildType === 'engraving-builds') {
      loadWeapons();
    }
  }, [buildType]);

  // Load skills data for skill builds
  useEffect(() => {
    if (buildType === 'skill-builds') {
      loadSkills();
    }
  }, [buildType]);

  // Load stone data for skill stone builds
  useEffect(() => {
    if (buildType === 'skill-stone-builds') {
      loadStoneData();
    }
  }, [buildType]);

  // Load saved builds on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      loadBuilds();
    }
  }, [isAuthenticated, user]);

  const loadWeapons = async () => {
    try {
      const response = await fetch('/data/soul-weapons.json');
      const data = await response.json();
      setWeapons(data || []);
    } catch (err) {
      logger.error('Failed to load weapons:', { error: err });
    }
  };

  const loadSkills = async () => {
    try {
      const response = await fetch('/data/skills.json');
      const data = await response.json();
      setSkills(data || []);
    } catch (err) {
      logger.error('Failed to load skills:', { error: err });
    }
  };

  const loadStoneData = async () => {
    try {
      const response = await fetch('/data/skill_stones.json');
      const data = await response.json();
      setStoneData(data || null);
    } catch (err) {
      logger.error('Failed to load stone data:', { error: err });
    }
  };

  const loadBuilds = async () => {
    if (!user || !config) return;

    setLoading(true);
    setError(null);

    try {
      // Convert buildType to cache key (e.g., 'skill-builds' -> 'skill_builds')
      const cacheKey = buildType.replace(/-/g, '_');

      // Get cached builds
      const cachedBuilds = getCache(cacheKey, user.id);

      // Fetch from GitHub via load-data endpoint
      const response = await fetch(`${getLoadDataEndpoint()}?type=${buildType}&userId=${user.id}`);
      if (!response.ok) {
        throw new Error('Failed to load builds from server');
      }
      const data = await response.json();
      const githubBuilds = data.builds || [];

      // Merge cached data with GitHub data, prioritizing cache for recent updates
      const mergedBuilds = mergeCacheWithGitHub(cachedBuilds, githubBuilds);
      const sortedBuilds = mergedBuilds.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      setInternalSavedBuilds(sortedBuilds);

      // Notify parent of the loaded builds
      if (onBuildsChange) {
        onBuildsChange(sortedBuilds);
      }

      // Update cache with merged results
      setCache(cacheKey, user.id, mergedBuilds);
    } catch (err) {
      logger.error('Failed to load builds:', { error: err });
      setError('Failed to load saved builds');
    } finally {
      setLoading(false);
    }
  };

  const saveBuild = async () => {
    if (!user || !isAuthenticated) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      // Convert buildType to cache key (e.g., 'skill-builds' -> 'skill_builds')
      const cacheKey = buildType.replace(/-/g, '_');

      // Use buildData if provided, otherwise use default structure
      const dataToSave = buildData || {
        name: buildName,
        maxSlots,
        slots: currentBuild.slots,
      };

      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: buildType,
          username: user.login,
          userId: user.id,
          data: dataToSave,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save build');
      }

      const data = await response.json();
      const sortedBuilds = data.builds.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      setInternalSavedBuilds(sortedBuilds);
      setSaveSuccess(true);

      // Notify parent of the updated builds
      if (onBuildsChange) {
        onBuildsChange(sortedBuilds);
      }

      // Cache the updated builds
      setCache(cacheKey, user.id, sortedBuilds);

      // Hide success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      logger.error('Failed to save build:', { error: err });
      setError(err.message || 'Failed to save build');
    } finally {
      setSaving(false);
    }
  };

  const deleteBuild = async (buildId) => {
    if (!user || !isAuthenticated) return;

    // First confirmation: Standard delete prompt
    if (!confirm('Delete this build?')) return;

    // Check if this build is used in any battle loadouts
    try {
      const loadouts = await getUserLoadouts(user.id, user.login);
      const usedInLoadouts = loadouts.filter(loadout => {
        if (buildType === 'skill-builds' || buildType === 'skill_builds') {
          return loadout.skillBuildId === buildId;
        } else if (buildType === 'engraving-builds' || buildType === 'engraving_builds') {
          return loadout.soulWeaponBuild?.weaponId &&
                 savedBuilds.find(b => b.id === buildId && b.weaponId === loadout.soulWeaponBuild.weaponId);
        }
        return false;
      });

      // Second confirmation: Warning if build is used in loadouts
      if (usedInLoadouts.length > 0) {
        const loadoutNames = usedInLoadouts.map(l => l.name).join(', ');
        const buildTypeName = buildType === 'skill-builds' || buildType === 'skill_builds' ? 'skill build' : 'soul weapon engraving build';
        if (!confirm(`⚠️ Warning: This ${buildTypeName} is used in ${usedInLoadouts.length} battle loadout(s): ${loadoutNames}\n\nDeleting it will remove it from those loadouts. Continue?`)) {
          return;
        }
      }
    } catch (err) {
      logger.error('Failed to check loadout usage, continuing with deletion:', { error: err });
    }

    setError(null);

    try {
      // Convert buildType to cache key (e.g., 'skill-builds' -> 'skill_builds')
      const cacheKey = buildType.replace(/-/g, '_');

      const response = await fetch(getDeleteDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: buildType,
          username: user.login,
          userId: user.id,
          itemId: buildId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete build');
      }

      const data = await response.json();
      const sortedBuilds = data.builds.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      setInternalSavedBuilds(sortedBuilds);

      // Notify parent of the updated builds
      if (onBuildsChange) {
        onBuildsChange(sortedBuilds);
      }

      // Update cache after deletion
      setCache(cacheKey, user.id, sortedBuilds);
    } catch (err) {
      logger.error('Failed to delete build:', { error: err });
      setError(err.message || 'Failed to delete build');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getWeaponImage = (weaponId) => {
    const weapon = weapons.find(w => w.id === weaponId);
    return weapon?.image || null;
  };

  const getBuildSkills = (build) => {
    if (!build.slots) return [];

    // Get skill objects from the build slots
    const buildSkills = build.slots
      .filter(slot => slot.skill || slot.skillId)
      .map(slot => {
        // Handle both full skill object and skillId reference
        if (slot.skill) {
          return slot.skill;
        } else if (slot.skillId) {
          const skill = skills.find(s => s.id === slot.skillId);
          return skill;
        }
        return null;
      })
      .filter(skill => skill); // Remove nulls and undefined (truthy check)

    return buildSkills;
  };

  const getBuildStones = (build) => {
    if (!build.slots || !stoneData) return [];

    // Map over all 3 slots (even if empty) to maintain structure
    return build.slots.map((slot, index) => {
      if (!slot.element || !slot.tier) {
        return { isEmpty: true, type: slot.type };
      }

      const stoneType = stoneData.stoneTypes[slot.type];
      const tierData = stoneType?.tiers?.[slot.tier];
      const elementData = tierData?.elements?.[slot.element];

      return {
        isEmpty: false,
        type: slot.type,
        element: slot.element,
        tier: slot.tier,
        stoneType: stoneType,
        tierData: tierData,
        elementData: elementData
      };
    });
  };

  const handleLoadBuild = (build) => {
    // Check if there are any meaningful changes in the current build
    let hasContent = false;

    if (buildType === 'skill-builds') {
      hasContent = currentBuild?.slots?.some(slot => slot?.skill || slot?.skillId);
    } else if (buildType === 'engraving-builds') {
      // Check if there are pieces in grid or inventory
      const hasPiecesInGrid = currentBuild?.gridState?.some(row =>
        row?.some(cell => cell?.piece !== null)
      );
      const hasPiecesInInventory = currentBuild?.inventory?.some(piece => piece !== null);
      hasContent = hasPiecesInGrid || hasPiecesInInventory;
    } else if (buildType === 'skill-stone-builds') {
      hasContent = currentBuild?.slots?.some(slot => slot?.element && slot?.tier);
    } else {
      // Generic check for other build types
      hasContent = true; // Always confirm for unknown types
    }

    if (hasContent) {
      const confirmed = window.confirm(
        `Loading "${build.name}" will replace your current build. Continue?`
      );
      if (!confirmed) return;
    }

    onLoadBuild(build);

    // Update URL with build parameter
    const currentHash = window.location.hash.split('?')[0];
    const newHash = `${currentHash}?build=${build.id}`;
    window.history.replaceState(null, '', newHash);
  };

  if (!isAuthenticated) {
    return (
      <>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
          <div className="text-center">
            <Save className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Sign In to Save Builds
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Sign in with GitHub to save your skill builds and access them anytime.
            </p>
            <button
              onClick={loginFlow.handleLogin}
              disabled={loginFlow.isLoading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loginFlow.isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign in</span>
                </>
              )}
            </button>
          </div>
        </div>

        <LoginModal
          showModal={loginFlow.showModal}
          deviceFlow={loginFlow.deviceFlow}
          error={loginFlow.error}
          isWaiting={loginFlow.isWaiting}
          onCancel={loginFlow.handleCancel}
          onCopyCode={loginFlow.copyUserCode}
          onOpenGitHub={loginFlow.openGitHub}
        />
      </>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Save className="w-5 h-5" />
            <span>Saved Builds</span>
          </h3>
          {allowSavingBuilds && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                saveBuild();
              }}
              disabled={saving || saveSuccess}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Build</span>
                </>
              )}
            </button>
          )}
        </div>
        <div className="p-2 text-gray-600 dark:text-gray-400">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {isExpanded && (
        <>
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!loading && savedBuilds.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                No saved builds yet. Click "Save Build" to store your current build.
              </p>
            </div>
          )}

          {/* Builds List */}
          {!loading && savedBuilds.length > 0 && (
            <div className="max-h-[230px] overflow-y-auto space-y-2 pr-2">
              {savedBuilds.map((build) => {
                const isCurrentlyLoaded = currentLoadedBuildId === build.id;
                if (buildType === 'engraving-builds' && build === savedBuilds[0]) {
                  logger.debug('SavedBuildsPanel highlight check', {
                    currentLoadedBuildId,
                    firstBuildId: build.id,
                    firstBuildName: build.name,
                    isCurrentlyLoaded,
                    allBuildIds: savedBuilds.map(b => b.id)
                  });
                }
                return (
                  <div
                    key={build.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isCurrentlyLoaded
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500'
                    }`}
                  >
                    <button
                      onClick={() => handleLoadBuild(build)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <h4 className={`font-semibold truncate max-w-[140px] sm:max-w-[200px] md:max-w-none ${
                          isCurrentlyLoaded
                            ? 'text-blue-900 dark:text-blue-100'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {build.name}
                        </h4>
                        {isCurrentlyLoaded && (
                          <span className="hidden sm:inline text-xs font-medium text-blue-600 dark:text-blue-400 flex-shrink-0">
                            (Loaded)
                          </span>
                        )}
                        {/* Show maxSlots only for skill builds */}
                        {buildType === 'skill-builds' && build.maxSlots && (
                          <span className={`text-xs flex-shrink-0 ${
                            isCurrentlyLoaded
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {build.maxSlots} slots
                          </span>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${
                        isCurrentlyLoaded
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(build.updatedAt)}</span>
                        <span>•</span>
                        {/* Show different details based on build type */}
                        {buildType === 'skill-builds' && build.slots && (
                          <span>{build.slots.filter(s => s.skill || s.skillId).length} skills</span>
                        )}
                        {buildType === 'engraving-builds' && build.weaponName && (
                          <span>{build.weaponName}</span>
                        )}
                        {buildType === 'skill-stone-builds' && build.slots && (
                          <span>{build.slots.filter(s => s.element && s.tier).length}/3 stones</span>
                        )}
                      </div>
                    </button>

                    {/* Skill Icons for skill builds */}
                    {buildType === 'skill-builds' && getBuildSkills(build).length > 0 && (
                      <div className="flex-shrink-0 grid grid-cols-4 sm:grid-cols-5 gap-0.5">
                        {getBuildSkills(build).map((skill, index) => {
                          const gradeColors = getSkillGradeColor(skill.grade);
                          return (
                            <div
                              key={index}
                              className={`w-6 h-6 rounded border ${gradeColors.border} ${gradeColors.glow} overflow-hidden`}
                            >
                              <img
                                src={skill.icon}
                                alt={skill.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Weapon Image for engraving builds */}
                    {buildType === 'engraving-builds' && build.weaponId && getWeaponImage(build.weaponId) && (
                      <div className="flex-shrink-0">
                        <img
                          src={getWeaponImage(build.weaponId)}
                          alt={build.weaponName || 'Weapon'}
                          className="w-10 h-10 object-contain"
                          title={build.weaponName}
                        />
                      </div>
                    )}

                    {/* Skill Stone Icons for skill stone builds */}
                    {buildType === 'skill-stone-builds' && stoneData && (
                      <div className="flex-shrink-0 flex gap-1">
                        {getBuildStones(build).map((stone, index) => (
                          <div key={index} className="flex flex-col items-center">
                            {stone.isEmpty ? (
                              <div className="w-8 h-10 border border-dashed border-gray-300 dark:border-gray-600 rounded flex items-center justify-center">
                                <span className="text-gray-400 text-xs">-</span>
                              </div>
                            ) : (
                              <>
                                <SkillStone
                                  stoneType={stone.type}
                                  element={stone.element}
                                  tier={stone.tier}
                                  data={stoneData}
                                  size="small"
                                />
                                <div className="text-[8px] text-gray-600 dark:text-gray-400 text-center mt-0.5 max-w-[32px] leading-tight">
                                  {stone.tierData?.bonus}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                  <button
                    onClick={() => deleteBuild(build.id)}
                    className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete build"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SavedBuildsPanel;

