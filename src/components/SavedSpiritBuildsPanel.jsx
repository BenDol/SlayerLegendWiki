import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Trash2, Download, Upload, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { getCache, setCache, clearCache } from '../utils/buildCache';

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
 */
const SavedSpiritBuildsPanel = ({
  currentBuild,
  buildName,
  onLoadBuild,
  onBuildsChange = null,
  currentLoadedBuildId = null,
  defaultExpanded = false
}) => {
  const { isAuthenticated, user } = useAuthStore();
  const [savedBuilds, setSavedBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [deletingId, setDeletingId] = useState(null);

  // Load saved builds
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }

    loadSavedBuilds();
  }, [isAuthenticated, user]);

  const loadSavedBuilds = async () => {
    if (!user || !isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);

      // Try cache first
      const cached = getCache('spirit-builds', user.id);
      if (cached) {
        setSavedBuilds(cached);
        if (onBuildsChange) onBuildsChange(cached);
        setLoading(false);
        return;
      }

      // Fetch from API
      const response = await fetch(`/.netlify/functions/load-data?type=spirit-build&userId=${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load builds');
      }

      const data = await response.json();
      const builds = data.builds || [];

      // Sort by updatedAt (newest first)
      const sortedBuilds = builds.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      setSavedBuilds(sortedBuilds);
      if (onBuildsChange) onBuildsChange(sortedBuilds);

      // Cache the builds
      setCache('spirit-builds', user.id, sortedBuilds);
    } catch (err) {
      console.error('[SavedSpiritBuildsPanel] Failed to load builds:', err);
      setError(err.message || 'Failed to load builds');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBuild = async (buildId) => {
    if (!confirm('Delete this spirit build? This cannot be undone.')) return;

    setDeletingId(buildId);

    try {
      const response = await fetch('/.netlify/functions/delete-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'spirit-build',
          username: user.login,
          userId: user.id,
          buildId: buildId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete build');
      }

      // Reload builds after deletion
      clearCache('spirit-builds', user.id);
      await loadSavedBuilds();
    } catch (err) {
      console.error('[SavedSpiritBuildsPanel] Failed to delete build:', err);
      alert('Failed to delete build: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Export build as JSON
  const handleExportBuild = (build) => {
    const dataStr = JSON.stringify(build, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${build.name.replace(/\s+/g, '_')}_spirit_build.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated) {
    return null; // Don't show if not authenticated
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
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
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700">
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
            <div className="space-y-2">
              {savedBuilds.map(build => {
                const isCurrentlyLoaded = currentLoadedBuildId === build.id;
                const spiritCount = build.slots?.filter(s => s.spirit !== null).length || 0;

                return (
                  <div
                    key={build.id}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isCurrentlyLoaded
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Build Info */}
                      <button
                        onClick={() => onLoadBuild(build)}
                        className="flex-1 text-left hover:opacity-80 transition-opacity"
                      >
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {build.name || 'Unnamed Build'}
                          {isCurrentlyLoaded && (
                            <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                              Loaded
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {spiritCount} {spiritCount === 1 ? 'spirit' : 'spirits'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {new Date(build.updatedAt || build.createdAt).toLocaleDateString()}
                        </div>
                      </button>

                      {/* Actions */}
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleExportBuild(build)}
                          className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded transition-colors"
                          title="Export as JSON"
                        >
                          <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
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
          )}
        </div>
      )}
    </div>
  );
};

export default SavedSpiritBuildsPanel;
