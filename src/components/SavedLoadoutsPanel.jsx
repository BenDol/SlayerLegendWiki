import React, { useState, useEffect } from 'react';
import { Save, Loader, Trash2, Clock, CheckCircle2, LogIn, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { useWikiConfig } from '../../wiki-framework/src/hooks/useWikiConfig';
import { useLoginFlow } from '../../wiki-framework/src/hooks/useLoginFlow';
import LoginModal from '../../wiki-framework/src/components/auth/LoginModal';
import { getUserLoadouts } from '../services/battleLoadouts';
import { getCache, setCache, mergeCacheWithGitHub } from '../utils/buildCache';
import { getDeleteDataEndpoint } from '../utils/apiEndpoints.js';
import { getSkillGradeColor, getEquipmentRarityColor } from '../config/rarityColors';
import { createLogger } from '../utils/logger';

const logger = createLogger('SavedLoadoutsPanel');

/**
 * SavedLoadoutsPanel Component
 *
 * Displays and manages user's saved battle loadouts
 * Features:
 * - Load saved loadouts
 * - Delete loadouts
 * - Mobile-friendly UI
 */
const SavedLoadoutsPanel = ({ currentLoadout, onLoadLoadout, currentLoadedLoadoutId = null, onLoadoutsChange, externalLoadouts = null }) => {
  const { isAuthenticated, user } = useAuthStore();
  const { config } = useWikiConfig();
  const loginFlow = useLoginFlow();
  const [internalSavedLoadouts, setInternalSavedLoadouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [skills, setSkills] = useState([]);
  const [spirits, setSpirits] = useState([]);

  // Use external loadouts if provided (controlled mode), otherwise use internal state
  const savedLoadouts = externalLoadouts !== null ? externalLoadouts : internalSavedLoadouts;

  // Load skills and spirits data
  useEffect(() => {
    loadSkills();
    loadSpirits();
  }, []);

  // Load saved loadouts on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      loadLoadouts();
    }
  }, [isAuthenticated, user]);

  const loadSkills = async () => {
    try {
      const response = await fetch('/data/skills.json');
      const data = await response.json();
      // Ensure we have an array
      setSkills(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.error('Failed to load skills:', { error: err });
      setSkills([]);
    }
  };

  const loadSpirits = async () => {
    try {
      const response = await fetch('/data/spirit-characters.json');
      const data = await response.json();
      // Spirits are nested under 'spirits' property
      const spiritsArray = data.spirits || [];
      setSpirits(Array.isArray(spiritsArray) ? spiritsArray : []);
    } catch (err) {
      logger.error('Failed to load spirits:', { error: err });
      setSpirits([]);
    }
  };

  const loadLoadouts = async () => {
    if (!user || !config) return;

    setLoading(true);
    setError(null);

    try {
      // Get cached loadouts
      const cachedLoadouts = getCache('battle_loadouts', user.id);

      // Fetch from GitHub
      const githubLoadouts = await getUserLoadouts(
        config.wiki.repository.owner,
        config.wiki.repository.repo,
        user.login,
        user.id
      );

      // Merge cached data with GitHub data, prioritizing cache for recent updates
      const mergedLoadouts = mergeCacheWithGitHub(cachedLoadouts, githubLoadouts);
      const sortedLoadouts = mergedLoadouts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      setInternalSavedLoadouts(sortedLoadouts);

      // Notify parent of the loaded loadouts
      if (onLoadoutsChange) {
        onLoadoutsChange(sortedLoadouts);
      }

      // Update cache with merged results
      setCache('battle_loadouts', user.id, mergedLoadouts);
    } catch (err) {
      logger.error('Failed to load loadouts:', { error: err });
      setError('Failed to load saved loadouts');
    } finally {
      setLoading(false);
    }
  };

  const deleteLoadout = async (loadoutId) => {
    if (!user || !isAuthenticated) return;
    if (!confirm('Delete this loadout?')) return;

    setError(null);

    try {
      const response = await fetch(getDeleteDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'battle-loadouts',
          username: user.login,
          userId: user.id,
          itemId: loadoutId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete loadout');
      }

      const data = await response.json();
      const sortedLoadouts = data.loadouts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      setInternalSavedLoadouts(sortedLoadouts);

      // Notify parent of the updated loadouts
      if (onLoadoutsChange) {
        onLoadoutsChange(sortedLoadouts);
      }

      // Update cache after deletion
      setCache('battle_loadouts', user.id, sortedLoadouts);
    } catch (err) {
      logger.error('Failed to delete loadout:', { error: err });
      setError(err.message || 'Failed to delete loadout');
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

  const getLoadoutSkills = (loadout) => {
    if (!loadout.skillBuild?.slots) return [];
    if (!Array.isArray(skills) || skills.length === 0) return [];

    // Get skill objects from the skill build slots
    const loadoutSkills = loadout.skillBuild.slots
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
      .filter(skill => skill !== null);

    return loadoutSkills;
  };

  const getLoadoutSpirits = (loadout) => {
    if (!loadout.spiritBuild?.slots) return [];
    if (!Array.isArray(spirits) || spirits.length === 0) return [];

    // Get spirit objects from the spirit build slots
    const loadoutSpirits = loadout.spiritBuild.slots
      .filter(slot => slot.spirit || slot.spiritId)
      .map(slot => {
        // Handle both full spirit object and spiritId reference
        if (slot.spirit) {
          return slot.spirit;
        } else if (slot.spiritId) {
          const spirit = spirits.find(s => s.id === slot.spiritId);
          return spirit;
        }
        return null;
      })
      .filter(spirit => spirit !== null);

    return loadoutSpirits;
  };

  const handleLoadLoadout = (loadout) => {
    const confirmed = window.confirm(
      `Loading "${loadout.name}" will replace your current loadout. Continue?`
    );
    if (!confirmed) return;

    onLoadLoadout(loadout);

    // Update URL with loadout parameter
    const currentHash = window.location.hash.split('?')[0];
    const newHash = `${currentHash}?loadout=${loadout.id}`;
    window.history.replaceState(null, '', newHash);
  };

  if (!isAuthenticated) {
    return (
      <>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
          <div className="text-center">
            <Save className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Sign In to Save Loadouts
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Sign in with GitHub to save your battle loadouts and access them anytime.
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Save className="w-5 h-5" />
          <span>Saved Loadouts</span>
        </h3>
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
          {!loading && savedLoadouts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                No saved loadouts yet. Configure your loadout and click "Save Loadout" in the footer to save it.
              </p>
            </div>
          )}

          {/* Loadouts List */}
          {!loading && savedLoadouts.length > 0 && (
            <div className="max-h-[230px] overflow-y-auto space-y-2 pr-2">
              {savedLoadouts.map((loadout) => {
            const isCurrentlyLoaded = currentLoadedLoadoutId === loadout.id;
            return (
              <div
                key={loadout.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isCurrentlyLoaded
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500'
                }`}
              >
                <button
                  onClick={() => handleLoadLoadout(loadout)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-2 mb-1 min-w-0">
                    <h4 className={`font-semibold truncate max-w-[140px] sm:max-w-[200px] md:max-w-none ${
                      isCurrentlyLoaded
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {loadout.name}
                    </h4>
                    {isCurrentlyLoaded && (
                      <span className="hidden sm:inline text-xs font-medium text-blue-600 dark:text-blue-400 flex-shrink-0">
                        (Loaded)
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${
                    isCurrentlyLoaded
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(loadout.updatedAt)}</span>
                  </div>
                </button>

                {/* Preview Icons */}
                <div className="flex-shrink-0 flex gap-2 items-center">
                  {/* Spirits Section (Left) */}
                  {getLoadoutSpirits(loadout).length > 0 && (
                    <div className="flex flex-wrap gap-0.5 max-w-[52px] sm:max-w-none">
                      {getLoadoutSpirits(loadout).map((spirit, index) => {
                        return (
                          <div
                            key={index}
                            className="w-[24px] h-[24px] sm:w-[29px] sm:h-[29px] rounded overflow-hidden"
                            title={spirit.name}
                          >
                            <img
                              src={spirit.thumbnail || spirit.image}
                              alt={spirit.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Skills Section (Right) */}
                  {getLoadoutSkills(loadout).length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-0.5">
                      {getLoadoutSkills(loadout).map((skill, index) => {
                        const gradeColors = getSkillGradeColor(skill.grade);
                        return (
                          <div
                            key={index}
                            className={`w-5 h-5 rounded border ${gradeColors.border} ${gradeColors.glow} overflow-hidden`}
                            title={skill.name}
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
                </div>

                <button
                  onClick={() => deleteLoadout(loadout.id)}
                  className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete loadout"
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

export default SavedLoadoutsPanel;

