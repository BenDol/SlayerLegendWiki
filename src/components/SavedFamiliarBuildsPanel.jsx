import React, { useState, useEffect } from 'react';
import { Loader, Trash2, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { getCache, setCache, clearCache } from '../utils/buildCache';
import { getLoadDataEndpoint, getDeleteDataEndpoint, getSaveDataEndpoint } from '../utils/apiEndpoints.js';
import { createLogger } from '../utils/logger';
import { validateBuildName } from '../utils/validation';
import { useFamiliarsData } from '../hooks/useFamiliarsData';
import { deserializeBuild } from '../utils/familiarSerialization';
import FamiliarSprite from './FamiliarSprite';

const logger = createLogger('SavedFamiliarBuildsPanel');

/**
 * SavedFamiliarBuildsPanel Component
 *
 * Collapsible panel showing user's saved familiar builds
 * Used in FamiliarBuilder sidebar
 *
 * @param {function} onLoadBuild - Callback when build is selected to load
 * @param {string} currentBuildId - ID of currently loaded build (to highlight)
 * @param {number} refreshTrigger - Change this value to force a refresh of the builds list
 */
const SavedFamiliarBuildsPanel = ({
  onLoadBuild,
  currentBuildId = null,
  refreshTrigger = 0
}) => {
  const { isAuthenticated, user } = useAuthStore();
  const { familiarsData, progressionData } = useFamiliarsData();
  const [builds, setBuilds] = useState([]);
  const [myFamiliars, setMyFamiliars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load my familiars for deserializing collection familiars
  useEffect(() => {
    if (isAuthenticated && user && familiarsData.length > 0) {
      loadMyFamiliars();
    }
  }, [isAuthenticated, user, familiarsData]);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Skip cache if refreshTrigger > 0 (meaning a refresh was triggered)
      loadBuilds(refreshTrigger > 0);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user, refreshTrigger]);

  const loadMyFamiliars = async () => {
    try {
      const cached = getCache('my_familiars', user.id);
      if (cached) {
        setMyFamiliars(cached);
        return;
      }

      const response = await fetch(`${getLoadDataEndpoint()}?type=my-familiars&userId=${user.id}`);
      const data = await response.json();
      if (data.success) {
        setMyFamiliars(data.familiars || []);
      }
    } catch (error) {
      logger.error('Failed to load my familiars', { error });
    }
  };

  const loadBuilds = async (skipCache = false) => {
    try {
      setLoading(true);

      // Try cache first (unless we're forcing a refresh)
      if (!skipCache) {
        const cached = getCache('familiar_builds', user.id);
        if (cached) {
          setBuilds(cached);
          setLoading(false);
          return;
        }
      }

      // Fetch from API
      const response = await fetch(`${getLoadDataEndpoint()}?type=familiar-builds&userId=${user.id}`);
      const data = await response.json();

      if (data.success) {
        const loadedBuilds = data.builds || [];
        setBuilds(loadedBuilds);
        setCache('familiar_builds', user.id, loadedBuilds);
      }
    } catch (error) {
      logger.error('Failed to load builds', { error });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBuild = async (buildId) => {
    try {
      const token = useAuthStore.getState().getToken();
      const response = await fetch(getDeleteDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'familiar-builds',
          recordId: buildId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete build');
      }

      logger.info('Familiar build deleted', { buildId });
      await loadBuilds(true); // Skip cache to force refresh
      setDeleteConfirm(null);
    } catch (error) {
      logger.error('Failed to delete build', { error });
      alert('Failed to delete build: ' + error.message);
    }
  };

  const handleRenameBuild = async (build) => {
    if (!user || !isAuthenticated) return;

    const newName = prompt('Enter new build name:', build.name);
    if (!newName || newName.trim() === '') return; // User cancelled or entered empty name
    if (newName === build.name) return; // No change

    // Validate the name
    const validation = validateBuildName(newName);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    try {
      const updatedBuild = { ...build, name: validation.sanitized };

      const token = useAuthStore.getState().getToken();
      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'familiar-builds',
          data: updatedBuild,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rename build');
      }

      logger.info('Familiar build renamed successfully', { oldName: build.name, newName: validation.sanitized });

      // Clear cache and reload builds
      clearCache('familiar_builds', user.id);
      await loadBuilds(true); // Skip cache to force refresh
    } catch (error) {
      logger.error('Failed to rename build', { error });
      alert('Failed to rename build: ' + error.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">
        Sign in to save builds
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-96">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          Saved Builds ({builds.length})
        </h3>
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : builds.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">👹</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                No saved builds yet
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {builds.map(build => {
                const isActive = currentBuildId === build.id;

                // Deserialize build to get full familiar objects
                let deserializedBuild = null;
                if (familiarsData.length > 0) {
                  deserializedBuild = deserializeBuild(build, familiarsData, myFamiliars);
                }

                return (
                  <div
                    key={build.id}
                    className={`group relative p-3 rounded-lg border transition-all ${
                      isActive
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Build Info - Left Side */}
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          if (onLoadBuild) {
                            onLoadBuild(build);
                          }
                        }}
                      >
                        <div className="font-semibold text-sm text-gray-900 dark:text-white mb-1 pr-8">
                          {build.name || 'Unnamed Build'}
                        </div>
                        {build.primeFamiliar && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {build.primeFamiliar.name || 'Prime Familiar'}
                            {build.primeFamiliar.isCustom && (
                              <span className="ml-1 text-gray-500">(Custom)</span>
                            )}
                          </div>
                        )}
                        {build.updatedAt && (
                          <div className="text-[0.65rem] text-gray-500 dark:text-gray-500 mt-1">
                            {new Date(build.updatedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {/* Familiar Sprites Preview - Right Side (Under Action Buttons) */}
                      <div className="flex flex-col items-end gap-2">
                        {/* Action Buttons */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameBuild(build);
                            }}
                            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
                            title="Rename build"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(build.id);
                            }}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded"
                            title="Delete build"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Familiar Previews */}
                        {deserializedBuild && deserializedBuild.slots && (
                          <div className="flex gap-1 items-center">
                            {deserializedBuild.slots.map((slot, index) => (
                              <div key={index} className="w-10 h-10">
                                {slot.familiar ? (
                                  <FamiliarSprite
                                    familiarId={slot.familiar.id}
                                    starLevel={slot.starLevel || 0}
                                    progressionData={progressionData}
                                    animated={false}
                                    size="100%"
                                    familiarData={slot.familiar}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center">
                                    <div className="text-xs text-gray-400">?</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Active Indicator */}
                    {isActive && (
                      <div className="absolute top-2 left-2 w-2 h-2 bg-blue-600 rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Delete Build?
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
              This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteBuild(deleteConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedFamiliarBuildsPanel;
