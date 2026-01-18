import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Loader, CheckCircle2, AlertTriangle } from 'lucide-react';
import FamiliarSlot from './FamiliarSlot';
import FamiliarSelector from './FamiliarSelector';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { useConfigStore } from '../../wiki-framework/src/store/configStore';
import { getCache, setCache } from '../utils/buildCache';
import { getSaveDataEndpoint, getLoadDataEndpoint, getDeleteDataEndpoint } from '../utils/apiEndpoints.js';
import { useFamiliarsData } from '../hooks/useFamiliarsData';
import { serializeFamiliar, deserializeFamiliar } from '../utils/familiarSerialization';
import { createLogger } from '../utils/logger';
import { queueAchievementCheck } from '../../wiki-framework/src/services/achievements/achievementQueue.js';

const logger = createLogger('MyFamiliarCollection');

/**
 * MyFamiliarCollection Component
 *
 * Manage a collection of configured familiars that can be used in builds
 * Features:
 * - Add familiars with star level configuration (0-10)
 * - View all saved familiars in a grid
 * - Edit or delete familiars
 * - Track usage in familiar builds
 * - Saved to GitHub backend
 */
const MyFamiliarCollection = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { familiarsData, progressionData, categoriesData, loading: dataLoading } = useFamiliarsData();
  const [familiars, setFamiliars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFamiliarSelector, setShowFamiliarSelector] = useState(false);
  const [editingFamiliar, setEditingFamiliar] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [familiarBuilds, setFamiliarBuilds] = useState([]);
  const [hoveredFamiliarId, setHoveredFamiliarId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load saved familiars
  useEffect(() => {
    if (isAuthenticated && user && familiarsData.length > 0) {
      loadFamiliars();
    } else if (!isAuthenticated) {
      setLoading(false);
    }
  }, [isAuthenticated, user, familiarsData]);

  // Load familiar builds to track usage
  useEffect(() => {
    if (isAuthenticated && user) {
      loadFamiliarBuilds();
    }
  }, [isAuthenticated, user]);

  const loadFamiliarBuilds = async () => {
    try {
      const response = await fetch(`${getLoadDataEndpoint()}?type=familiar-builds&userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setFamiliarBuilds(data.builds || []);
      }
    } catch (error) {
      logger.error('Failed to load familiar builds for usage tracking', { error });
    }
  };

  // Get builds that use a specific familiar
  const getBuildsUsingFamiliar = (familiarId) => {
    return familiarBuilds.filter(build => {
      return build.slots?.some(slot =>
        slot && slot.type === 'collection' && slot.myFamiliarId === familiarId
      );
    });
  };

  const loadFamiliars = async () => {
    try {
      setLoading(true);

      // Try cache first
      const cached = getCache('my_familiars', user.id);
      if (cached) {
        // Deserialize cached familiars, preserving record IDs
        const deserializedFamiliars = cached
          .map(f => deserializeFamiliar(f, familiarsData, f.id))
          .filter(f => f !== null && f.familiar !== null);
        setFamiliars(deserializedFamiliars);
        setLoading(false);
        return;
      }

      // Fetch from API
      const response = await fetch(`${getLoadDataEndpoint()}?type=my-familiars&userId=${user.id}`);
      const data = await response.json();

      if (data.success) {
        const loadedFamiliars = data.familiars || [];
        // Deserialize loaded familiars, preserving record IDs
        const deserializedFamiliars = loadedFamiliars
          .map(f => deserializeFamiliar(f, familiarsData, f.id))
          .filter(f => f !== null && f.familiar !== null);
        setFamiliars(deserializedFamiliars);
        setCache('my_familiars', user.id, loadedFamiliars); // Cache serialized version
      }
    } catch (error) {
      logger.error('Failed to load familiars', { error });
    } finally {
      setLoading(false);
    }
  };

  const handleAddFamiliar = (selectedFamiliar) => {
    setEditingFamiliar({
      id: `temp-${Date.now()}`,
      familiar: selectedFamiliar,
      familiarId: selectedFamiliar.id,
      starLevel: 0,
      isNew: true
    });
    setShowFamiliarSelector(false);
  };

  const handleEditFamiliar = (familiar) => {
    setEditingFamiliar({ ...familiar, isNew: false });
  };

  const handleSaveFamiliar = async () => {
    if (!editingFamiliar || !editingFamiliar.familiar) return;

    try {
      setSaving(true);
      setSaveError(null);

      const familiarData = serializeFamiliar(editingFamiliar);

      const token = useAuthStore.getState().getToken();
      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'my-familiars',
          data: familiarData,
          familiarId: editingFamiliar.isNew ? undefined : editingFamiliar.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save familiar');
      }

      const data = await response.json();

      if (data.familiars) {
        setCache('my_familiars', user.id, data.familiars);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      logger.info('Familiar saved successfully', { familiarId: editingFamiliar.familiar.id });

      await loadFamiliars();
      await loadFamiliarBuilds();

      // Queue achievement checks
      if (user?.id && user?.login) {
        const { config } = useConfigStore.getState();
        if (config?.wiki?.repository) {
          ['familiar-collector', 'collector'].forEach(achievementId => {
            queueAchievementCheck(achievementId, {
              owner: config.wiki.repository.owner,
              repo: config.wiki.repository.repo,
              userId: user.id,
              username: user.login,
              delay: 2000
            });
          });
        }
      }

      setEditingFamiliar(null);
    } catch (error) {
      logger.error('Failed to save familiar', { error });
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFamiliar = async (familiarId) => {
    const buildsUsing = getBuildsUsingFamiliar(familiarId);
    if (buildsUsing.length > 0) {
      setDeleteConfirm({
        familiarId,
        buildsUsing
      });
      return;
    }

    await confirmDelete(familiarId);
  };

  const confirmDelete = async (familiarId) => {
    try {
      const token = useAuthStore.getState().getToken();
      const response = await fetch(getDeleteDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'my-familiars',
          recordId: familiarId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete familiar');
      }

      logger.info('Familiar deleted successfully', { familiarId });

      await loadFamiliars();
      setDeleteConfirm(null);
    } catch (error) {
      logger.error('Failed to delete familiar', { error });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
          <p className="text-blue-900 dark:text-blue-100">
            Please sign in to manage your familiar collection
          </p>
        </div>
      </div>
    );
  }

  // Show loading state while data loads
  if (dataLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-gray-600 dark:text-gray-400">Loading familiar data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          My Familiar Collection
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Manage your configured familiars to use in builds
        </p>
      </div>

      {/* Add Familiar Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowFamiliarSelector(true)}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          Add Familiar
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Empty State */}
      {!loading && familiars.length === 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">👹</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Familiars Yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Add familiars to your collection to reuse them in builds
          </p>
          <button
            onClick={() => setShowFamiliarSelector(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Your First Familiar
          </button>
        </div>
      )}

      {/* Familiar Grid */}
      {!loading && familiars.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {familiars.map(familiar => {
            const buildsUsing = getBuildsUsingFamiliar(familiar.id);
            const isHovered = hoveredFamiliarId === familiar.id;

            return (
              <div
                key={familiar.id}
                className="relative group"
              >
                <FamiliarSlot
                  slot={{ type: 'base' }}
                  familiar={familiar.familiar}
                  starLevel={familiar.starLevel}
                  category={familiar.familiar?.category || 'element'}
                  slotIndex={0}
                  progressionData={progressionData}
                  onSelectFamiliar={() => handleEditFamiliar(familiar)}
                  onRemoveFamiliar={() => handleDeleteFamiliar(familiar.id)}
                  readOnly={false}
                />

                {/* Usage Badge */}
                {buildsUsing.length > 0 && (
                  <div
                    className="absolute top-0 left-0 z-10"
                    onMouseEnter={() => setHoveredFamiliarId(familiar.id)}
                    onMouseLeave={() => setHoveredFamiliarId(null)}
                  >
                    <div className="relative">
                      <div className="bg-blue-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-tl-lg rounded-br-lg shadow-md cursor-help">
                        Used in {buildsUsing.length}
                      </div>

                      {/* Hover Popup - no gap to prevent hover loss */}
                      {isHovered && (
                        <div className="absolute top-full left-0 pt-1 z-40">
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[200px]">
                            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Used in these builds:
                            </div>
                            <div className="space-y-1">
                              {buildsUsing.slice(0, 5).map(build => (
                                <a
                                  key={build.id}
                                  href={`/familiar-builder?build=${build.id}`}
                                  className="block text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                                  onClick={() => setHoveredFamiliarId(null)}
                                >
                                  {build.name}
                                </a>
                              ))}
                              {buildsUsing.length > 5 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  + {buildsUsing.length - 5} more
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Familiar Selector Modal */}
      {showFamiliarSelector && (
        <FamiliarSelector
          isOpen={showFamiliarSelector}
          onClose={() => setShowFamiliarSelector(false)}
          onSelectFamiliar={handleAddFamiliar}
          categoriesData={categoriesData}
          progressionData={progressionData}
        />
      )}

      {/* Edit Modal */}
      {editingFamiliar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4">
              {editingFamiliar.isNew ? 'Add Familiar' : 'Edit Familiar'}
            </h3>

            <div className="mb-6">
              <FamiliarSlot
                slot={{ type: 'base' }}
                familiar={editingFamiliar.familiar}
                starLevel={editingFamiliar.starLevel}
                category="element"
                slotIndex={0}
                progressionData={progressionData}
                onStarLevelChange={(newStarLevel) => {
                  setEditingFamiliar({ ...editingFamiliar, starLevel: newStarLevel });
                }}
                readOnly={false}
              />
            </div>

            {/* Save Error */}
            {saveError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                {saveError}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 sm:gap-3">
              <button
                onClick={() => setEditingFamiliar(null)}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFamiliar}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Delete Familiar?
                </h3>
                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-3">
                  This familiar is used in {deleteConfirm.buildsUsing.length} build(s). Those builds will show this familiar as missing.
                </p>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                  {deleteConfirm.buildsUsing.slice(0, 3).map(build => (
                    <li key={build.id}>• {build.name || 'Unnamed Build'}</li>
                  ))}
                  {deleteConfirm.buildsUsing.length > 3 && (
                    <li>+ {deleteConfirm.buildsUsing.length - 3} more</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2 sm:gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteConfirm.familiarId)}
                className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors"
              >
                Delete Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyFamiliarCollection;
