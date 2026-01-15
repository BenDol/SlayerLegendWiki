import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Save, Share2, Download, Upload, Trash2, Copy, Check } from 'lucide-react';
import FamiliarSlot from './FamiliarSlot';
import FamiliarSelector from './FamiliarSelector';
import PrimeFamiliarPreview from './PrimeFamiliarPreview';
import SavedFamiliarBuildsPanel from './SavedFamiliarBuildsPanel';
import SavedFamiliarsGallery from './SavedFamiliarsGallery';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { useFamiliarsData } from '../hooks/useFamiliarsData';
import { serializeBuild, deserializeBuild, createEmptyBuild } from '../utils/familiarSerialization';
import { findPrimeFamiliar, isBuildComplete, validateBuildCategories } from '../utils/familiarHelpers';
import { useDraftStorage } from '../../wiki-framework/src/hooks/useDraftStorage';
import { getCache, setCache } from '../utils/buildCache';
import { getSaveDataEndpoint, getLoadDataEndpoint } from '../utils/apiEndpoints.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('FamiliarBuilder');

/**
 * FamiliarBuilder Component
 *
 * Main builder for creating Prime Familiar builds
 * Features:
 * - 3 slots with category constraints (element, attribute, weapon)
 * - Prime Familiar preview (combines 3 familiars)
 * - Save/Load/Share/Export/Import
 * - Draft auto-save
 * - Drag & drop from collection
 *
 * @param {boolean} isModal - Is this rendered in a modal? (for battle loadouts)
 * @param {boolean} allowSavingBuilds - Allow saving builds to backend
 * @param {object} initialBuild - Initial build data
 * @param {function} onSave - Callback when build is saved (modal mode)
 */
const FamiliarBuilder = forwardRef(({
  isModal = false,
  allowSavingBuilds = true,
  initialBuild = null,
  onSave = null
}, ref) => {
  const { isAuthenticated, user } = useAuthStore();
  const { familiarsData, primeFamiliarsData, categoriesData, progressionData, loading } = useFamiliarsData();

  // Build state
  const [build, setBuild] = useState(createEmptyBuild());
  const [buildName, setBuildName] = useState('');
  const [primeFamiliar, setPrimeFamiliar] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // UI state
  const [selectorState, setSelectorState] = useState({ open: false, slotIndex: null });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [showSavedBuilds, setShowSavedBuilds] = useState(false);
  const [myFamiliars, setMyFamiliars] = useState([]);
  const [draggedSlotIndex, setDraggedSlotIndex] = useState(null);

  // Serialize draft data for auto-save
  const serializedDraft = hasUnsavedChanges && !isModal ? {
    ...serializeBuild(build),
    name: buildName
  } : null;

  // Draft auto-save hook (auto-saves when serializedDraft changes)
  const { loadDraft, clearDraft } = useDraftStorage(
    'familiarBuilder',
    user,
    isModal,
    serializedDraft
  );

  // Load initial build or draft
  useEffect(() => {
    // Don't deserialize until familiars data is loaded
    if (!familiarsData || familiarsData.length === 0) {
      logger.debug('Skipping build initialization - familiars data not loaded yet');
      return;
    }

    if (initialBuild) {
      logger.debug('Loading initial build', { initialBuild });
      const deserialized = deserializeBuild(initialBuild, familiarsData, myFamiliars);
      if (deserialized) {
        logger.debug('Setting initial build', { slotsCount: deserialized.slots?.length });
        setBuild(deserialized);
        setBuildName(initialBuild.name || '');
      }
    } else {
      const draft = loadDraft();
      if (draft) {
        logger.debug('Loading draft', { draft, draftSlotsCount: draft.slots?.length });

        // Validate draft has slots
        if (!draft.slots || draft.slots.length === 0) {
          logger.warn('Draft is invalid (no slots), clearing and using empty build');
          clearDraft();
          // Keep the createEmptyBuild() from initial state
          return;
        }

        const deserialized = deserializeBuild(draft, familiarsData, myFamiliars);
        if (deserialized && deserialized.slots && deserialized.slots.length > 0) {
          logger.debug('Setting draft build', { slotsCount: deserialized.slots?.length });
          setBuild(deserialized);
          setBuildName(draft.name || '');
        } else {
          logger.warn('Deserialized draft has no slots, clearing draft');
          clearDraft();
        }
      } else {
        logger.debug('No draft found, using empty build');
      }
    }
  }, [initialBuild, familiarsData]);

  // Update Prime Familiar when slots change
  useEffect(() => {
    if (isBuildComplete(build)) {
      const elementFamiliar = build.slots[0]?.familiar;
      const attributeFamiliar = build.slots[1]?.familiar;
      const weaponFamiliar = build.slots[2]?.familiar;

      const prime = findPrimeFamiliar(
        elementFamiliar?.id,
        attributeFamiliar?.id,
        weaponFamiliar?.id,
        primeFamiliarsData,
        familiarsData // Pass familiarsData for name generation
      );

      setPrimeFamiliar(prime);
      logger.debug('Prime Familiar updated', { prime });
    } else {
      setPrimeFamiliar(null);
    }
  }, [build, primeFamiliarsData, familiarsData]);

  // Load my familiars for collection mode
  useEffect(() => {
    if (isAuthenticated && user) {
      loadMyFamiliars();
    }
  }, [isAuthenticated, user, familiarsData]);

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

  // Handle familiar selection
  const handleSelectFamiliar = (slotIndex) => {
    setSelectorState({ open: true, slotIndex });
  };

  const handleFamiliarSelected = (familiar) => {
    const { slotIndex } = selectorState;
    const newSlots = [...build.slots];

    newSlots[slotIndex] = {
      type: 'base',
      category: newSlots[slotIndex].category,
      familiar,
      starLevel: 0
    };

    setBuild({ ...build, slots: newSlots });
    setHasUnsavedChanges(true);
    setSelectorState({ open: false, slotIndex: null });
  };

  // Handle familiar removal
  const handleRemoveFamiliar = (slotIndex) => {
    const newSlots = [...build.slots];
    newSlots[slotIndex] = {
      type: 'base',
      category: newSlots[slotIndex].category,
      familiar: null,
      starLevel: 0
    };

    setBuild({ ...build, slots: newSlots });
    setHasUnsavedChanges(true);
  };

  // Handle star level change
  const handleStarLevelChange = (slotIndex, newStarLevel) => {
    const newSlots = [...build.slots];
    newSlots[slotIndex] = { ...newSlots[slotIndex], starLevel: newStarLevel };

    setBuild({ ...build, slots: newSlots });
    setHasUnsavedChanges(true);
  };

  // Handle save to collection
  const handleSaveToCollection = async (slotIndex) => {
    const slot = build.slots[slotIndex];
    if (!slot || !slot.familiar) return;

    try {
      const token = useAuthStore.getState().getToken();
      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'my-familiars',
          data: {
            familiarId: slot.familiar.id,
            starLevel: slot.starLevel
          }
        })
      });

      if (response.ok) {
        logger.info('Familiar saved to collection', { familiarId: slot.familiar.id });
        await loadMyFamiliars();
      }
    } catch (error) {
      logger.error('Failed to save to collection', { error });
    }
  };

  // Handle drag & drop
  const handleDragStart = (e, slotIndex) => {
    setDraggedSlotIndex(slotIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', slotIndex);
  };

  const handleDragOver = (e, slotIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetSlotIndex) => {
    e.preventDefault();

    // Check if dropping from collection
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const data = JSON.parse(jsonData);
        if (data.type === 'collection-familiar') {
          const newSlots = [...build.slots];
          newSlots[targetSlotIndex] = {
            type: 'collection',
            myFamiliarId: data.myFamiliarId,
            category: newSlots[targetSlotIndex].category,
            familiar: data.familiar,
            starLevel: data.starLevel
          };
          setBuild({ ...build, slots: newSlots });
          setHasUnsavedChanges(true);
          setDraggedSlotIndex(null);
          return;
        }
      }
    } catch (err) {
      // Not collection data, continue with slot swap
    }

    // Swap slots
    const sourceIndex = draggedSlotIndex;
    if (sourceIndex !== null && sourceIndex !== targetSlotIndex) {
      const newSlots = [...build.slots];
      [newSlots[sourceIndex], newSlots[targetSlotIndex]] = [newSlots[targetSlotIndex], newSlots[sourceIndex]];
      setBuild({ ...build, slots: newSlots });
      setHasUnsavedChanges(true);
    }

    setDraggedSlotIndex(null);
  };

  // Handle save build
  const handleSaveBuild = async () => {
    if (!allowSavingBuilds) return;

    if (!buildName.trim()) {
      alert('Please enter a build name');
      return;
    }

    try {
      setSaving(true);

      const buildData = {
        ...serializeBuild(build),
        name: buildName,
        primeFamiliar: primeFamiliar ? {
          id: primeFamiliar.id,
          isCustom: primeFamiliar.isCustom
        } : null
      };

      const token = useAuthStore.getState().getToken();
      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'familiar-builds',
          data: buildData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save build');
      }

      setSaveSuccess(true);
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveSuccess(false), 2000);

      logger.info('Familiar build saved', { buildName });

      if (isModal && onSave) {
        const data = await response.json();
        onSave(data.build);
      }
    } catch (error) {
      logger.error('Failed to save build', { error });
      alert('Failed to save build: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle share
  const handleShare = () => {
    const serialized = serializeBuild(build);
    const encoded = btoa(JSON.stringify(serialized));
    const url = `${window.location.origin}/familiar-builder?data=${encoded}`;
    setShareUrl(url);
    navigator.clipboard.writeText(url);
  };

  // Handle export
  const handleExport = () => {
    const exportData = {
      ...serializeBuild(build),
      name: buildName,
      primeFamiliar
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${buildName || 'familiar-build'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle import
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        const deserialized = deserializeBuild(imported, familiarsData, myFamiliars);
        if (deserialized) {
          setBuild(deserialized);
          setBuildName(imported.name || '');
          setHasUnsavedChanges(true);
        }
      } catch (error) {
        logger.error('Failed to import build', { error });
        alert('Invalid build file');
      }
    };
    reader.readAsText(file);
  };

  // Validation
  const validation = validateBuildCategories(build);
  const isValid = validation.valid && isBuildComplete(build);

  // Expose saveBuild function to parent via ref (for modal footer button)
  useImperativeHandle(ref, () => ({
    saveBuild: handleSaveBuild
  }));

  // Debug logging
  logger.debug('FamiliarBuilder render', {
    buildSlots: build?.slots?.length,
    loading,
    hasBuild: !!build
  });

  // Show loading state while data loads
  if (loading) {
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
    <div className="max-w-7xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Familiar Builder
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Combine 3 familiars to create a Prime Familiar
            </p>
          </div>

          {/* Build Name Panel */}
          {allowSavingBuilds && (
            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap pt-2">
                  Build Name:
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    value={buildName}
                    onChange={(e) => {
                      setBuildName(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Enter build name..."
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {isAuthenticated && (
                  <button
                    onClick={handleSaveBuild}
                    disabled={saving || !isValid || saveSuccess}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <Save className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Saved!</span>
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
            </div>
          )}

          {/* Prime Familiar Preview */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <div className="flex justify-center">
              <PrimeFamiliarPreview
                elementFamiliar={build.slots[0]?.familiar}
                attributeFamiliar={build.slots[1]?.familiar}
                weaponFamiliar={build.slots[2]?.familiar}
                elementStarLevel={build.slots[0]?.starLevel || 0}
                attributeStarLevel={build.slots[1]?.starLevel || 0}
                weaponStarLevel={build.slots[2]?.starLevel || 0}
                primeFamiliar={primeFamiliar}
                progressionData={progressionData}
                size="large"
                showDetails={true}
                animated={true}
              />
            </div>
          </div>

          {/* Familiar Slots - FIXED ORDER: Element (0), Battle (1), Weapon (2 - ALWAYS LAST) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {build.slots.map((slot, index) => (
              <FamiliarSlot
                key={index}
                slot={slot}
                familiar={slot.familiar}
                starLevel={slot.starLevel}
                category={slot.category}
                slotIndex={index}
                progressionData={progressionData}
                onSelectFamiliar={() => handleSelectFamiliar(index)}
                onRemoveFamiliar={() => handleRemoveFamiliar(index)}
                onSaveToCollection={() => handleSaveToCollection(index)}
                onStarLevelChange={(newStarLevel) => handleStarLevelChange(index, newStarLevel)}
                readOnly={false}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragging={draggedSlotIndex === index}
              />
            ))}
          </div>

          {/* Actions Panel */}
          {!isModal && (
            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mt-6 border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleShare}
                  disabled={!isValid}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {shareUrl ? (
                    <>
                      <Check className="w-4 h-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>Share</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleExport}
                  disabled={!isValid}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <Download className="w-4 h-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                  <span>Export</span>
                </button>

                <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap">
                  <Upload className="w-4 h-4 flex-shrink-0 text-purple-600 dark:text-purple-400" />
                  <span>Import</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6 sticky top-6 self-start">
          {/* Saved Familiars */}
          {isAuthenticated && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <SavedFamiliarsGallery enableDrag={true} />
            </div>
          )}

          {/* Saved Builds */}
          {allowSavingBuilds && isAuthenticated && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <SavedFamiliarBuildsPanel />
            </div>
          )}
        </div>
      </div>

      {/* Familiar Selector Modal */}
      {selectorState.open && (
        <FamiliarSelector
          isOpen={selectorState.open}
          onClose={() => setSelectorState({ open: false, slotIndex: null })}
          onSelectFamiliar={handleFamiliarSelected}
          currentBuild={build}
          categoryFilter={build.slots[selectorState.slotIndex]?.category}
          categoriesData={categoriesData}
          progressionData={progressionData}
        />
      )}
    </div>
  );
});

export default FamiliarBuilder;
