import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Share2, Download, Upload, Trash2, Check, Save, Loader, CheckCircle2 } from 'lucide-react';
import SpiritSlot from './SpiritSlot';
import SpiritSelector from './SpiritSelector';
import SavedSpiritBuildsPanel from './SavedSpiritBuildsPanel';
import SavedSpiritsGallery from './SavedSpiritsGallery';
import { encodeBuild, decodeBuild } from '../../wiki-framework/src/components/wiki/BuildEncoder';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { setCache } from '../utils/buildCache';
import { saveBuild as saveSharedBuild, loadBuild as loadSharedBuild, generateShareUrl } from '../../wiki-framework/src/services/github/buildShare';
import { useDraftStorage } from '../../wiki-framework/src/hooks/useDraftStorage';
import { getSaveDataEndpoint } from '../utils/apiEndpoints.js';

/**
 * SpiritBuilder Component
 *
 * Main component for creating and sharing spirit builds
 * Features:
 * - 3 Spirit Slots (1 companion + 2 partners)
 * - Configuration per slot (level, evolution, skill enhancement)
 * - URL sharing with encoded build data
 * - Import/Export builds as JSON
 * - Save system with GitHub backend
 * - Draft auto-save to localStorage
 *
 * @param {boolean} isModal - If true, renders in modal mode with Save button
 * @param {object} initialBuild - Initial build data to load (for modal mode)
 * @param {function} onSave - Callback when Save is clicked in modal mode
 * @param {boolean} allowSavingBuilds - If true, shows build name field and save-related UI (default: true)
 */
const SpiritBuilder = forwardRef(({ isModal = false, initialBuild = null, onSave = null, allowSavingBuilds = true }, ref) => {
  const { isAuthenticated, user } = useAuthStore();
  const [spirits, setSpirits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buildName, setBuildName] = useState('');
  const [build, setBuild] = useState({
    slots: Array(3).fill(null).map(() => ({
      spirit: null,
      level: 1,
      awakeningLevel: 0,
      evolutionLevel: 4,
      skillEnhancementLevel: 0
    }))
  });
  const [showSpiritSelector, setShowSpiritSelector] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [copied, setCopied] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draggedSlotIndex, setDraggedSlotIndex] = useState(null);
  const [currentLoadedBuildId, setCurrentLoadedBuildId] = useState(null);
  const [savedBuilds, setSavedBuilds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(null);

  // Draft storage hook for auto-save/restore
  const { loadDraft, clearDraft } = useDraftStorage(
    'spiritBuilder',
    user,
    isModal,
    { buildName, build }
  );

  // Load spirits data
  useEffect(() => {
    loadSpirits();
  }, []);

  // Load build from URL after spirits are loaded (only in page mode)
  useEffect(() => {
    if (spirits.length === 0) return; // Wait for spirits to load
    if (isModal) return; // Skip URL loading in modal mode

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const shareChecksum = urlParams.get('share');
    const encodedBuild = urlParams.get('data');

    // Load from new share system (short URL)
    if (shareChecksum) {
      const loadFromSharedUrl = async () => {
        try {
          setLoading(true);
          console.log('[SpiritBuilder] Loading shared build:', shareChecksum);

          const configResponse = await fetch('/wiki-config.json');
          const config = await configResponse.json();
          const owner = config.wiki.repository.owner;
          const repo = config.wiki.repository.repo;

          const buildData = await loadSharedBuild(owner, repo, shareChecksum);

          if (buildData.type === 'spirit-build') {
            const deserializedBuild = deserializeBuild(buildData.data, spirits);
            setBuildName(buildData.data.name || '');
            setBuild({ slots: deserializedBuild.slots });
            setHasUnsavedChanges(true);
            console.log('[SpiritBuilder] ✓ Shared build loaded successfully');
          } else {
            console.error('[SpiritBuilder] Invalid build type:', buildData.type);
            alert('Invalid build type. This URL is for a different builder.');
          }
        } catch (error) {
          console.error('[SpiritBuilder] Failed to load shared build:', error);
          alert(`Failed to load shared build: ${error.message}`);
        } finally {
          setLoading(false);
        }
      };
      loadFromSharedUrl();
    }
    // Fallback to old encoded system
    else if (encodedBuild) {
      try {
        const decodedBuild = decodeBuild(encodedBuild);
        if (decodedBuild) {
          setBuildName(decodedBuild.name || '');

          // Deserialize build (convert spirit IDs back to full spirit objects)
          const deserializedBuild = deserializeBuild(decodedBuild, spirits);
          setBuild({ slots: deserializedBuild.slots });
          setHasUnsavedChanges(true); // Mark as having changes to block navigation
        }
      } catch (error) {
        console.error('Failed to load build from URL:', error);
      }
    }
    // Load from localStorage if no URL params
    else {
      const draft = loadDraft();
      if (draft) {
        setBuildName(draft.buildName || '');

        // Deserialize build to ensure spirit objects are current
        const deserializedBuild = deserializeBuild(draft.build, spirits);
        setBuild(deserializedBuild);
        setHasUnsavedChanges(true);
      }
    }
  }, [spirits, isModal, loadDraft]);

  // Load initial build in modal mode
  useEffect(() => {
    if (spirits.length === 0) return; // Wait for spirits to load
    if (!isModal || !initialBuild) return; // Only in modal mode with initial data

    setBuildName(initialBuild.name || 'My Spirit Build');

    // Deserialize build to ensure spirit objects are current
    const deserializedBuild = deserializeBuild(initialBuild, spirits);
    setBuild({ slots: deserializedBuild.slots });
    setHasUnsavedChanges(true); // Mark as having changes to block navigation
  }, [spirits, isModal, initialBuild]);

  const loadSpirits = async () => {
    try {
      const response = await fetch('/data/spirit-characters.json');
      const data = await response.json();
      setSpirits(data.spirits);
    } catch (error) {
      console.error('Failed to load spirits:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Serialize build for URL encoding (spirit objects -> spirit IDs only)
   */
  const serializeBuild = (build) => {
    return {
      name: buildName,
      slots: build.slots.map(slot => ({
        spiritId: slot.spirit?.id || null,
        level: slot.level,
        awakeningLevel: slot.awakeningLevel,
        evolutionLevel: slot.evolutionLevel,
        skillEnhancementLevel: slot.skillEnhancementLevel
      }))
    };
  };

  /**
   * Deserialize build after decoding (spirit IDs -> full spirit objects)
   */
  const deserializeBuild = (serializedBuild, spiritsArray) => {
    return {
      slots: serializedBuild.slots.map(slot => {
        // Handle new format (spiritId)
        if (slot.spiritId !== undefined) {
          const spirit = spiritsArray.find(s => s.id === slot.spiritId);
          return {
            spirit: spirit || null,
            level: slot.level || 1,
            awakeningLevel: slot.awakeningLevel || 0,
            evolutionLevel: slot.evolutionLevel || 4,
            skillEnhancementLevel: slot.skillEnhancementLevel || 0
          };
        }
        // Handle old format (full spirit object) for backward compatibility
        else if (slot.spirit) {
          let spirit = spiritsArray.find(s => s.id === slot.spirit.id);
          if (!spirit) {
            spirit = spiritsArray.find(s => s.name === slot.spirit.name);
          }
          return {
            spirit: spirit || slot.spirit,
            level: slot.level || 1,
            awakeningLevel: slot.awakeningLevel || 0,
            evolutionLevel: slot.evolutionLevel || 4,
            skillEnhancementLevel: slot.skillEnhancementLevel || 0
          };
        }
        // Empty slot
        else {
          return {
            spirit: null,
            level: 1,
            awakeningLevel: 0,
            evolutionLevel: 4,
            skillEnhancementLevel: 0
          };
        }
      })
    };
  };

  /**
   * Compare current build with a saved build to check if they match
   */
  const buildsMatch = (savedBuild) => {
    if (!savedBuild) return false;

    // Check name
    if (savedBuild.name !== buildName) return false;

    // Check if all slots match
    for (let i = 0; i < 3; i++) {
      const currentSlot = build.slots[i];
      const savedSlot = savedBuild.slots[i];

      // Both empty
      if (!currentSlot?.spirit && !savedSlot?.spirit) continue;

      // One empty, one not
      if (!currentSlot?.spirit || !savedSlot?.spirit) return false;

      // Check spirit ID and levels
      if (currentSlot.spirit.id !== savedSlot.spirit?.id) return false;
      if (currentSlot.level !== savedSlot.level) return false;
      if (currentSlot.awakeningLevel !== savedSlot.awakeningLevel) return false;
      if (currentSlot.evolutionLevel !== savedSlot.evolutionLevel) return false;
      if (currentSlot.skillEnhancementLevel !== savedSlot.skillEnhancementLevel) return false;
    }

    return true;
  };

  /**
   * Check if current build matches any saved build and update highlighting
   */
  useEffect(() => {
    const hasContent = buildName.trim() !== '' || build.slots.some(slot => slot.spirit !== null);

    if (!isAuthenticated || savedBuilds.length === 0) {
      if (currentLoadedBuildId !== null) {
        setCurrentLoadedBuildId(null);
      }
      if (!hasContent && hasUnsavedChanges) {
        setHasUnsavedChanges(false);
      } else if (hasContent && !hasUnsavedChanges) {
        setHasUnsavedChanges(true);
      }
      return;
    }

    // Find matching build
    const matchingBuild = savedBuilds.find(savedBuild => buildsMatch(savedBuild));

    if (matchingBuild) {
      setCurrentLoadedBuildId(matchingBuild.id);
    } else {
      setCurrentLoadedBuildId(null);
      if (hasContent && !hasUnsavedChanges) {
        setHasUnsavedChanges(true);
      }
    }
  }, [buildName, build, savedBuilds, isAuthenticated, hasUnsavedChanges]);

  // Handle slot actions
  const handleSelectSlot = (index) => {
    setSelectedSlotIndex(index);
    setShowSpiritSelector(true);
  };

  const handleSpiritSelected = (spirit) => {
    if (selectedSlotIndex === null) return;

    // Check if spirit is already equipped in another slot
    const isAlreadyEquipped = build.slots.some((slot, index) =>
      slot.spirit && slot.spirit.id === spirit.id && index !== selectedSlotIndex
    );

    if (isAlreadyEquipped) {
      alert('This spirit is already equipped in another slot!');
      return;
    }

    const newSlots = [...build.slots];
    newSlots[selectedSlotIndex] = {
      spirit: spirit,
      level: 1,
      awakeningLevel: 0,
      evolutionLevel: 4,
      skillEnhancementLevel: 0
    };
    setBuild({ slots: newSlots });
  };

  // Handle selecting a saved spirit from gallery (includes configuration)
  const handleSavedSpiritSelected = (savedSpirit) => {
    // Auto-select slot if none is selected
    let targetSlotIndex = selectedSlotIndex;

    if (targetSlotIndex === null) {
      // Find first empty slot
      const firstEmptySlot = build.slots.findIndex(slot => slot.spirit === null);

      if (firstEmptySlot !== -1) {
        // Use first empty slot
        targetSlotIndex = firstEmptySlot;
      } else {
        // All slots are filled, use the last slot (slot 2)
        targetSlotIndex = 2;
      }
    }

    // Check if spirit is already equipped in another slot
    const isAlreadyEquipped = build.slots.some((slot, index) =>
      slot.spirit && slot.spirit.id === savedSpirit.spirit.id && index !== targetSlotIndex
    );

    if (isAlreadyEquipped) {
      alert('This spirit is already equipped in another slot!');
      return;
    }

    const newSlots = [...build.slots];
    newSlots[targetSlotIndex] = {
      spirit: savedSpirit.spirit,
      level: savedSpirit.level,
      awakeningLevel: savedSpirit.awakeningLevel,
      evolutionLevel: savedSpirit.evolutionLevel,
      skillEnhancementLevel: savedSpirit.skillEnhancementLevel
    };
    setBuild({ slots: newSlots });
    setShowSpiritSelector(false);
  };

  const handleRemoveSpirit = (index) => {
    const newSlots = [...build.slots];
    newSlots[index] = {
      spirit: null,
      level: 1,
      awakeningLevel: 0,
      evolutionLevel: 4,
      skillEnhancementLevel: 0
    };
    setBuild({ slots: newSlots });
  };

  const handleLevelChange = (index, newLevel) => {
    const newSlots = [...build.slots];
    newSlots[index].level = newLevel;
    setBuild({ slots: newSlots });
  };

  const handleAwakeningLevelChange = (index, newAwakeningLevel) => {
    const newSlots = [...build.slots];
    newSlots[index].awakeningLevel = newAwakeningLevel;
    setBuild({ slots: newSlots });
  };

  const handleEvolutionChange = (index, newEvolution) => {
    const newSlots = [...build.slots];
    newSlots[index].evolutionLevel = newEvolution;
    setBuild({ slots: newSlots });
  };

  const handleSkillEnhancementChange = (index, newSkillEnhancement) => {
    const newSlots = [...build.slots];
    newSlots[index].skillEnhancementLevel = newSkillEnhancement;
    setBuild({ slots: newSlots });
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedSlotIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    // Check if it's an external drag (from SavedSpiritsGallery) by looking at data types
    const hasExternalData = e.dataTransfer.types.includes('application/json');
    // Set appropriate drop effect: 'copy' for external, 'move' for internal slot swaps
    e.dataTransfer.dropEffect = hasExternalData ? 'copy' : 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();

    // Check for saved spirit drag from SavedSpiritsGallery
    const dragData = e.dataTransfer.getData('application/json');
    if (dragData) {
      try {
        const { type, spirit } = JSON.parse(dragData);
        if (type === 'saved-spirit') {
          console.log('[SpiritBuilder] Dropped saved spirit:', spirit.spirit.name);

          // Check if spirit is already equipped in another slot
          const isAlreadyEquipped = build.slots.some((slot, index) =>
            slot.spirit && slot.spirit.id === spirit.spirit.id && index !== targetIndex
          );

          if (isAlreadyEquipped) {
            alert('This spirit is already equipped in another slot!');
            setDraggedSlotIndex(null);
            return;
          }

          // Add saved spirit to target slot with its configuration
          const newSlots = [...build.slots];
          newSlots[targetIndex] = {
            spirit: spirit.spirit,
            level: spirit.level,
            awakeningLevel: spirit.awakeningLevel,
            evolutionLevel: spirit.evolutionLevel,
            skillEnhancementLevel: spirit.skillEnhancementLevel
          };
          setBuild({ slots: newSlots });
          setDraggedSlotIndex(null);
          return;
        }
      } catch (error) {
        console.error('[SpiritBuilder] Failed to parse drag data:', error);
      }
    }

    // Handle slot swap (existing logic)
    if (draggedSlotIndex === null || draggedSlotIndex === targetIndex) {
      setDraggedSlotIndex(null);
      return;
    }

    const newSlots = [...build.slots];
    const draggedSlot = newSlots[draggedSlotIndex];
    const targetSlot = newSlots[targetIndex];

    // Swap slots
    newSlots[draggedSlotIndex] = targetSlot;
    newSlots[targetIndex] = draggedSlot;

    setBuild({ slots: newSlots });
    setDraggedSlotIndex(null);
  };

  // Share build
  const handleShareBuild = async () => {
    try {
      setSharing(true);
      setShareError(null);

      console.log('[SpiritBuilder] Generating share URL...');

      const configResponse = await fetch('/wiki-config.json');
      const config = await configResponse.json();
      const owner = config.wiki.repository.owner;
      const repo = config.wiki.repository.repo;

      // Serialize build to only include spirit IDs
      const serializedBuild = serializeBuild(build);
      const buildData = {
        name: buildName,
        slots: serializedBuild.slots
      };

      // Save build and get checksum
      const checksum = await saveSharedBuild(owner, repo, 'spirit-build', buildData);

      console.log('[SpiritBuilder] Generated checksum:', checksum);

      // Generate share URL
      const baseURL = window.location.origin + window.location.pathname;
      const shareURL = generateShareUrl(baseURL, 'spirit-build', checksum);

      await navigator.clipboard.writeText(shareURL);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      console.log('[SpiritBuilder] ✓ Share URL copied to clipboard');
    } catch (error) {
      console.error('[SpiritBuilder] Failed to generate share URL:', error);
      setShareError(error.message || 'Failed to generate share URL');

      // Fallback to old method if share service fails
      try {
        console.log('[SpiritBuilder] Falling back to old encoding method...');
        const serializedBuild = serializeBuild(build);
        const encoded = encodeBuild(serializedBuild);
        if (encoded) {
          const baseURL = window.location.origin + window.location.pathname;
          const shareURL = `${baseURL}#/spirit-builder?data=${encoded}`;
          await navigator.clipboard.writeText(shareURL);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          console.log('[SpiritBuilder] ✓ Fallback URL copied to clipboard');
        }
      } catch (fallbackError) {
        console.error('[SpiritBuilder] Fallback also failed:', fallbackError);
        alert('Failed to generate share URL');
      }
    } finally {
      setSharing(false);
    }
  };

  // Export build as JSON
  const handleExportBuild = () => {
    const buildData = {
      name: buildName,
      slots: build.slots,
      exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(buildData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${buildName.replace(/\s+/g, '_')}_spirit_build.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  // Import build from JSON
  const handleImportBuild = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const hasActualChanges = hasUnsavedChanges && (
      buildName.trim() !== '' ||
      build.slots.some(slot => slot.spirit !== null)
    );

    if (hasActualChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Importing a build will discard your current changes. Continue?'
      );
      if (!confirmed) {
        event.target.value = '';
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buildData = JSON.parse(e.target.result);
        setBuildName(buildData.name || '');

        const deserializedBuild = deserializeBuild(buildData, spirits);
        setBuild({ slots: deserializedBuild.slots });
        setHasUnsavedChanges(true);
      } catch (error) {
        console.error('Failed to import build:', error);
        alert('Failed to import build. Invalid file format.');
      }
    };
    reader.readAsText(file);

    event.target.value = '';
  };

  // Clear build
  const handleClearBuild = () => {
    if (!confirm('Clear all spirits from this build?')) return;
    setBuild({
      slots: Array(3).fill(null).map(() => ({
        spirit: null,
        level: 1,
        evolutionLevel: 4,
        skillEnhancementLevel: 0
      }))
    });
    setBuildName('');
    setHasUnsavedChanges(false);
    setCurrentLoadedBuildId(null);
    clearDraft(); // Clear localStorage draft
  };

  // Load build from saved builds
  const handleLoadBuild = (savedBuild) => {
    const hasActualChanges = hasUnsavedChanges && (
      buildName.trim() !== '' ||
      build.slots.some(slot => slot.spirit !== null)
    );

    if (hasActualChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Loading this build will discard your current changes. Continue?'
      );
      if (!confirmed) return;
    }

    setBuildName(savedBuild.name);

    const deserializedBuild = deserializeBuild(savedBuild, spirits);
    setBuild({ slots: deserializedBuild.slots });
    setHasUnsavedChanges(true);
    setCurrentLoadedBuildId(savedBuild.id);
  };

  // Save build to backend
  const saveBuild = async () => {
    if (!user || !isAuthenticated) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const buildData = {
        name: buildName,
        slots: build.slots,
      };

      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'spirit-build',
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
      setSavedBuilds(sortedBuilds);
      setSaveSuccess(true);
      setHasUnsavedChanges(false);

      // Cache the updated builds
      setCache('spirit-builds', user.id, sortedBuilds);

      // Clear localStorage draft after successful save
      clearDraft();

      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('[SpiritBuilder] Failed to save build:', err);
      setSaveError(err.message || 'Failed to save build');
    } finally {
      setSaving(false);
    }
  };

  // Save build (modal mode only)
  const handleSaveBuild = () => {
    if (onSave) {
      const buildData = {
        name: buildName,
        slots: build.slots
      };
      onSave(buildData);
    }
  };

  // Expose saveBuild function to parent via ref (for modal footer button)
  useImperativeHandle(ref, () => ({
    saveBuild: handleSaveBuild
  }));

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${isModal ? 'min-h-[400px]' : 'min-h-screen'} bg-gradient-to-b from-gray-900 to-black`}>
        <div className="text-white text-xl">Loading spirits...</div>
      </div>
    );
  }

  return (
    <div className={isModal ? "bg-gray-50 dark:bg-gray-950" : "min-h-screen bg-gray-50 dark:bg-gray-950"}>
      {/* Header - Title (only in page mode) */}
      {!isModal && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔮</span>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Spirit Builder</h1>
            </div>
          </div>
        </div>
      )}

      {/* Saved Builds Panel */}
      <div className={`${isModal ? 'px-4 pt-6 pb-0' : 'max-w-7xl mx-auto px-3 sm:px-4 pt-2 pb-0'}`}>
        <SavedSpiritBuildsPanel
          currentBuild={build}
          buildName={buildName}
          onLoadBuild={handleLoadBuild}
          onBuildsChange={setSavedBuilds}
          currentLoadedBuildId={currentLoadedBuildId}
          defaultExpanded={!isModal}
        />
      </div>

      {/* Main Content */}
      <div className={`${isModal ? 'px-4 pt-1 pb-3' : 'max-w-7xl mx-auto px-3 sm:px-4 pt-1 pb-3'}`}>
        {/* Build Name Panel */}
        {allowSavingBuilds && (
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Build Name:</label>
              <input
                type="text"
                value={buildName}
                onChange={(e) => {
                  setBuildName(e.target.value);
                }}
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                placeholder="Enter build name..."
              />
              {isAuthenticated && (
                <button
                  onClick={saveBuild}
                  disabled={saving || saveSuccess}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {saving ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : saveSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
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
            {saveError && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                {saveError}
              </div>
            )}
          </div>
        )}

        {/* Actions Panel */}
        {!isModal && (
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleShareBuild}
                disabled={sharing}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                {sharing ? (
                  <>
                    <Loader className="w-4 h-4 flex-shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
                    <span>Generating...</span>
                  </>
                ) : copied ? (
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
                onClick={handleExportBuild}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                <span>Export</span>
              </button>

              <label className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap">
                <Upload className="w-4 h-4 flex-shrink-0 text-purple-600 dark:text-purple-400" />
                <span>Import</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBuild}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleClearBuild}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                <span>Clear</span>
              </button>
            </div>
            {/* Share Error Message */}
            {shareError && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                {shareError}
              </div>
            )}
          </div>
        )}

        {/* Spirit Slots */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-8">
            {/* Companion Slot (Slot 0) */}
            <SpiritSlot
              spirit={build.slots[0].spirit}
              level={build.slots[0].level}
              awakeningLevel={build.slots[0].awakeningLevel}
              evolutionLevel={build.slots[0].evolutionLevel}
              skillEnhancementLevel={build.slots[0].skillEnhancementLevel}
              isCompanionSlot={true}
              slotNumber={1}
              slotIndex={0}
              onSelectSpirit={() => handleSelectSlot(0)}
              onRemoveSpirit={() => handleRemoveSpirit(0)}
              onLevelChange={(newLevel) => handleLevelChange(0, newLevel)}
              onAwakeningLevelChange={(newAwakeningLevel) => handleAwakeningLevelChange(0, newAwakeningLevel)}
              onEvolutionChange={(newEvolution) => handleEvolutionChange(0, newEvolution)}
              onSkillEnhancementChange={(newSkillEnhancement) => handleSkillEnhancementChange(0, newSkillEnhancement)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragging={draggedSlotIndex === 0}
            />

            {/* Partner Spirit 1 (Slot 1) */}
            <SpiritSlot
              spirit={build.slots[1].spirit}
              level={build.slots[1].level}
              awakeningLevel={build.slots[1].awakeningLevel}
              evolutionLevel={build.slots[1].evolutionLevel}
              skillEnhancementLevel={build.slots[1].skillEnhancementLevel}
              isCompanionSlot={false}
              slotNumber={1}
              slotIndex={1}
              onSelectSpirit={() => handleSelectSlot(1)}
              onRemoveSpirit={() => handleRemoveSpirit(1)}
              onLevelChange={(newLevel) => handleLevelChange(1, newLevel)}
              onAwakeningLevelChange={(newAwakeningLevel) => handleAwakeningLevelChange(1, newAwakeningLevel)}
              onEvolutionChange={(newEvolution) => handleEvolutionChange(1, newEvolution)}
              onSkillEnhancementChange={(newSkillEnhancement) => handleSkillEnhancementChange(1, newSkillEnhancement)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragging={draggedSlotIndex === 1}
            />

            {/* Partner Spirit 2 (Slot 2) */}
            <SpiritSlot
              spirit={build.slots[2].spirit}
              level={build.slots[2].level}
              awakeningLevel={build.slots[2].awakeningLevel}
              evolutionLevel={build.slots[2].evolutionLevel}
              skillEnhancementLevel={build.slots[2].skillEnhancementLevel}
              isCompanionSlot={false}
              slotNumber={2}
              slotIndex={2}
              onSelectSpirit={() => handleSelectSlot(2)}
              onRemoveSpirit={() => handleRemoveSpirit(2)}
              onLevelChange={(newLevel) => handleLevelChange(2, newLevel)}
              onAwakeningLevelChange={(newAwakeningLevel) => handleAwakeningLevelChange(2, newAwakeningLevel)}
              onEvolutionChange={(newEvolution) => handleEvolutionChange(2, newEvolution)}
              onSkillEnhancementChange={(newSkillEnhancement) => handleSkillEnhancementChange(2, newSkillEnhancement)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragging={draggedSlotIndex === 2}
            />
          </div>
        </div>

        {/* Saved Spirits Gallery */}
        {isAuthenticated && (
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
            <SavedSpiritsGallery
              onSelectSpirit={handleSavedSpiritSelected}
              excludedSpiritIds={build.slots.map(slot => slot.spirit?.id).filter(Boolean)}
            />
          </div>
        )}

        {/* Build Info */}
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-900">
          <h3 className="text-base font-semibold mb-2 text-blue-900 dark:text-blue-100">How to Use:</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Click the <span className="font-medium">+ icon</span> to add a spirit to a slot</li>
            <li>• The <span className="font-medium text-yellow-600 dark:text-yellow-400">Companion Slot</span> provides enhanced passive effects</li>
            <li>• Configure each spirit's level and evolution (base evolution caps at 4)</li>
            <li>• <span className="font-medium">Awakening</span> and <span className="font-medium">Skill Enhancement</span> unlock at Evolution Level 4 (Legendary)</li>
            <li>• <span className="font-medium">Awakening</span>: Every 6 levels = +1 evolution beyond base (use to reach 5-7)</li>
            <li>• Use <span className="font-medium">Share</span> to get a shareable URL for your build</li>
            <li>• Use <span className="font-medium">Export/Import</span> to save and load builds as files</li>
          </ul>
        </div>
      </div>

      {/* Spirit Selector Modal */}
      <SpiritSelector
        isOpen={showSpiritSelector}
        onClose={() => setShowSpiritSelector(false)}
        onSelectSpirit={handleSpiritSelected}
        currentBuild={build}
      />
    </div>
  );
});

SpiritBuilder.displayName = 'SpiritBuilder';

export default SpiritBuilder;
