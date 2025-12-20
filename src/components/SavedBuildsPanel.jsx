import React, { useState, useEffect } from 'react';
import { Save, Loader, Trash2, Clock, CheckCircle2, LogIn, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { useWikiConfig } from '../../wiki-framework/src/hooks/useWikiConfig';
import { useLoginFlow } from '../../wiki-framework/src/hooks/useLoginFlow';
import LoginModal from '../../wiki-framework/src/components/auth/LoginModal';
import { getUserBuilds } from '../../wiki-framework/src/services/github/skillBuilds';
import { getCache, setCache, mergeCacheWithGitHub } from '../utils/buildCache';
import { getSaveDataEndpoint, getDeleteDataEndpoint } from '../utils/apiEndpoints.js';

/**
 * SavedBuildsPanel Component
 *
 * Displays and manages user's saved skill builds
 * Features:
 * - Load saved builds
 * - Save current build
 * - Delete builds
 * - Mobile-friendly UI
 */
const SavedBuildsPanel = ({ currentBuild, buildName, maxSlots, onLoadBuild, allowSavingBuilds = true, currentLoadedBuildId = null, onBuildsChange = null, defaultExpanded = true, externalBuilds = null }) => {
  const { isAuthenticated, user } = useAuthStore();
  const { config } = useWikiConfig();
  const loginFlow = useLoginFlow();
  const [internalSavedBuilds, setInternalSavedBuilds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Use external builds if provided (controlled mode), otherwise use internal state
  const savedBuilds = externalBuilds !== null ? externalBuilds : internalSavedBuilds;

  // Load saved builds on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      loadBuilds();
    }
  }, [isAuthenticated, user]);

  const loadBuilds = async () => {
    if (!user || !config) return;

    setLoading(true);
    setError(null);

    try {
      // Get cached builds
      const cachedBuilds = getCache('skill_builds', user.id);

      // Fetch from GitHub
      const githubBuilds = await getUserBuilds(
        config.wiki.repository.owner,
        config.wiki.repository.repo,
        user.login,
        user.id
      );

      // Merge cached data with GitHub data, prioritizing cache for recent updates
      const mergedBuilds = mergeCacheWithGitHub(cachedBuilds, githubBuilds);
      const sortedBuilds = mergedBuilds.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      setInternalSavedBuilds(sortedBuilds);

      // Notify parent of the loaded builds
      if (onBuildsChange) {
        onBuildsChange(sortedBuilds);
      }

      // Update cache with merged results
      setCache('skill_builds', user.id, mergedBuilds);
    } catch (err) {
      console.error('[SavedBuilds] Failed to load builds:', err);
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
      const buildData = {
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
          type: 'skill-builds',
          username: user.login,
          userId: user.id,
          data: buildData,
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
      setCache('skill_builds', user.id, sortedBuilds);

      // Hide success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('[SavedBuilds] Failed to save build:', err);
      setError(err.message || 'Failed to save build');
    } finally {
      setSaving(false);
    }
  };

  const deleteBuild = async (buildId) => {
    if (!user || !isAuthenticated) return;
    if (!confirm('Delete this build?')) return;

    setError(null);

    try {
      const response = await fetch(getDeleteDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'skill-builds',
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
      setCache('skill_builds', user.id, sortedBuilds);
    } catch (err) {
      console.error('[SavedBuilds] Failed to delete build:', err);
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

  const handleLoadBuild = (build) => {
    // Check if there are any skills in the current build
    const hasSkills = currentBuild?.slots?.some(slot => slot?.skill || slot?.skillId);

    if (hasSkills) {
      const confirmed = window.confirm(
        `Loading "${build.name}" will replace your current build. Continue?`
      );
      if (!confirmed) return;
    }

    onLoadBuild(build);
  };

  if (!isAuthenticated) {
    return (
      <>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 shadow-sm mb-8">
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
    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 shadow-sm mb-8">
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
            <div className="max-h-96 overflow-y-auto space-y-2">
              {savedBuilds.map((build) => {
                const isCurrentlyLoaded = currentLoadedBuildId === build.id;
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
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex-shrink-0">
                            (Loaded)
                          </span>
                        )}
                        <span className={`text-xs flex-shrink-0 ${
                          isCurrentlyLoaded
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {build.maxSlots} slots
                        </span>
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${
                        isCurrentlyLoaded
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(build.updatedAt)}</span>
                        <span>•</span>
                        <span>{build.slots.filter(s => s.skill).length} skills</span>
                      </div>
                    </button>

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

