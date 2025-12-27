import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Share2, Download, Upload, Trash2, Check, Save, Loader, CheckCircle2 } from 'lucide-react';
import SkillStoneSlot from './SkillStoneSlot';
import SkillStoneSelector from './SkillStoneSelector';
import SavedBuildsPanel from './SavedBuildsPanel';
import ValidatedInput from './ValidatedInput';
import { encodeBuild, decodeBuild } from '../../wiki-framework/src/components/wiki/BuildEncoder';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { setCache } from '../utils/buildCache';
import { saveBuild as saveSharedBuild, loadBuild as loadSharedBuild, generateShareUrl } from '../../wiki-framework/src/services/github/buildShare';
import { useDraftStorage } from '../../wiki-framework/src/hooks/useDraftStorage';
import { getSaveDataEndpoint, getLoadDataEndpoint } from '../utils/apiEndpoints.js';
import { validateBuildName, STRING_LIMITS } from '../utils/validation';
import { createLogger } from '../utils/logger';

const logger = createLogger('SkillStoneBuilder');

/**
 * SkillStoneBuilder Component
 *
 * Main component for creating and sharing skill stone builds
 * Features:
 * - 3 fixed slots (Cooldown, Time, Heat)
 * - Element and tier selection for each slot
 * - URL sharing with encoded build data
 * - Import/Export builds as JSON
 * - Draft auto-save to localStorage
 *
 * @param {boolean} isModal - If true, renders in modal mode with Save button instead of Share
 * @param {object} initialBuild - Initial build data to load (for modal mode)
 * @param {function} onSave - Callback when Save is clicked in modal mode
 * @param {boolean} allowSavingBuilds - If true, shows build name field and save-related UI (default: true)
 */
const SkillStoneBuilder = forwardRef(({ isModal = false, initialBuild = null, onSave = null, allowSavingBuilds = true }, ref) => {
  const { isAuthenticated, user } = useAuthStore();
  const [stoneData, setStoneData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buildName, setBuildName] = useState('');
  const [build, setBuild] = useState({
    slots: createEmptySlots()
  });
  const [showStoneSelector, setShowStoneSelector] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [copied, setCopied] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentLoadedBuildId, setCurrentLoadedBuildId] = useState(null);
  const [savedBuilds, setSavedBuilds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(null);

  // Draft storage hook for auto-save/restore
  const { loadDraft, clearDraft } = useDraftStorage(
    'skillStoneBuilder',
    user,
    isModal,
    { buildName, build }
  );

  // Load stone data
  useEffect(() => {
    loadStoneData();
  }, []);

  // Load build from URL after data is loaded (only in page mode)
  useEffect(() => {
    if (!stoneData) return; // Wait for stone data to load
    if (isModal) return; // Skip URL loading in modal mode

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const shareChecksum = urlParams.get('share');
    const encodedBuild = urlParams.get('data');
    const buildId = urlParams.get('build');

    // Load from new share system (short URL)
    if (shareChecksum) {
      const loadFromSharedUrl = async () => {
        try {
          setLoading(true);
          logger.info('Loading shared build', { shareChecksum });

          const configResponse = await fetch('/wiki-config.json');
          const config = await configResponse.json();
          const owner = config.wiki.repository.owner;
          const repo = config.wiki.repository.repo;

          const buildData = await loadSharedBuild(owner, repo, shareChecksum);

          if (buildData.type === 'skill-stone-builds') {
            setBuildName(buildData.data.name || '');
            setBuild({ slots: buildData.data.slots || createEmptySlots() });
            setHasUnsavedChanges(true);
            logger.info('Shared build loaded successfully');
          } else {
            logger.error('Invalid build type', { type: buildData.type });
            alert('Invalid build type. This URL is for a different builder.');
          }
        } catch (error) {
          logger.error('Failed to load shared build', { error });
          alert(`Failed to load shared build: ${error.message}`);
        } finally {
          setLoading(false);
        }
      };
      loadFromSharedUrl();
    }
    // Load from saved builds by ID
    else if (buildId && isAuthenticated && user) {
      const loadFromSavedBuilds = async () => {
        try {
          setLoading(true);
          logger.info('Loading saved build', { buildId });

          const response = await fetch(`${getLoadDataEndpoint()}?type=skill-stone-builds&userId=${user.id}`);
          if (!response.ok) {
            throw new Error('Failed to load builds from server');
          }
          const data = await response.json();
          const builds = data.builds || [];

          const savedBuild = builds.find(b => b.id === buildId);
          if (savedBuild) {
            setBuildName(savedBuild.name || '');
            setBuild({ slots: savedBuild.slots || createEmptySlots() });
            setCurrentLoadedBuildId(buildId);
            setHasUnsavedChanges(false);
            logger.info('Saved build loaded successfully', { buildName: savedBuild.name });
          } else {
            logger.error('Build not found', { buildId });
            alert('Build not found');
          }
        } catch (error) {
          logger.error('Failed to load saved build', { error });
          alert(`Failed to load build: ${error.message}`);
        } finally {
          setLoading(false);
        }
      };
      loadFromSavedBuilds();
    }
    // Fallback to old encoded system
    else if (encodedBuild) {
      try {
        const decodedBuild = decodeBuild(encodedBuild);
        if (decodedBuild) {
          setBuildName(decodedBuild.name || '');
          setBuild({ slots: decodedBuild.slots || createEmptySlots() });
          setHasUnsavedChanges(true); // Mark as having changes to block navigation
        }
      } catch (error) {
        logger.error('Failed to load build from URL', { error });
      }
    }
    // Load from localStorage if no URL params
    else {
      const draft = loadDraft();
      if (draft) {
        setBuildName(draft.buildName || '');
        setBuild(draft.build || { slots: createEmptySlots() });
        setHasUnsavedChanges(true);
      }
    }
  }, [stoneData, isModal, loadDraft, isAuthenticated, user]); // Trigger when stone data loads

  // Load initial build in modal mode
  useEffect(() => {
    if (!stoneData) return; // Wait for stone data to load
    if (!isModal || !initialBuild) return; // Only in modal mode with initial data

    setBuildName(initialBuild.name || 'My Skill Stone Build');
    setBuild({ slots: initialBuild.slots || createEmptySlots() });
    setHasUnsavedChanges(true); // Mark as having changes to block navigation
  }, [stoneData, isModal, initialBuild]);

  const loadStoneData = async () => {
    try {
      const response = await fetch('/data/skill_stones.json');
      const data = await response.json();
      setStoneData(data);
    } catch (error) {
      logger.error('Failed to load skill stones data', { error });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Serialize build for storage (already minimal format)
   */
  const serializeBuild = (buildToSerialize) => {
    return {
      name: buildToSerialize.name || buildName,
      slots: buildToSerialize.slots
    };
  };

  /**
   * Check if current build matches a saved build
   */
  const buildsMatch = (savedBuild) => {
    if (!savedBuild) return false;
    if (savedBuild.name !== buildName) return false;

    return JSON.stringify(build.slots) === JSON.stringify(savedBuild.slots);
  };

  /**
   * Check if current build matches any saved build and update highlighting
   */
  useEffect(() => {
    const hasContent = buildName.trim() !== '' || build.slots.some(slot => slot.element !== null);

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

    const matchingBuild = savedBuilds.find(savedBuild => buildsMatch(savedBuild));

    if (matchingBuild) {
      setCurrentLoadedBuildId(matchingBuild.id);
      // Don't automatically clear hasUnsavedChanges
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
    setShowStoneSelector(true);
  };

  const handleStoneSelected = (element, tier) => {
    if (selectedSlotIndex === null) return;

    const newSlots = [...build.slots];
    newSlots[selectedSlotIndex] = {
      type: newSlots[selectedSlotIndex].type,
      element: element,
      tier: tier
    };
    setBuild({ slots: newSlots });
  };

  const handleRemoveStone = (index) => {
    const newSlots = [...build.slots];
    newSlots[index] = {
      type: newSlots[index].type,
      element: null,
      tier: null
    };
    setBuild({ slots: newSlots });
  };

  // Share build
  const handleShareBuild = async () => {
    try {
      setSharing(true);
      setShareError(null);

      logger.debug('Generating share URL');

      const configResponse = await fetch('/wiki-config.json');
      const config = await configResponse.json();
      const owner = config.wiki.repository.owner;
      const repo = config.wiki.repository.repo;

      // Serialize build
      const serializedBuild = serializeBuild({ ...build, name: buildName });

      // Save build and get checksum
      const checksum = await saveSharedBuild(owner, repo, 'skill-stone-builds', serializedBuild);

      logger.debug('Generated checksum', { checksum });

      // Generate share URL
      const baseURL = window.location.origin + window.location.pathname;
      const shareURL = generateShareUrl(baseURL, 'skill-stone-builds', checksum);

      await navigator.clipboard.writeText(shareURL);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      logger.info('Share URL copied to clipboard');

      // Trigger donation prompt
      window.triggerDonationPrompt?.({
        messages: [
          "Sharing your stone setup? Nice! 💎",
          "That's a solid build! ⚡",
          "Your friends will love this! 🔥",
          "Spreading the knowledge! 📚",
        ]
      });
    } catch (error) {
      logger.error('Failed to generate share URL', { error });
      setShareError(error.message || 'Failed to generate share URL');

      // Fallback to old method
      try {
        logger.warn('Falling back to old encoding method');
        const serializedBuild = serializeBuild({ ...build, name: buildName });
        const encoded = encodeBuild(serializedBuild);
        if (encoded) {
          const baseURL = window.location.origin + window.location.pathname;
          const shareURL = `${baseURL}#/skill-stone-builder?data=${encoded}`;
          await navigator.clipboard.writeText(shareURL);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          logger.info('Fallback URL copied to clipboard');

          window.triggerDonationPrompt?.({
            messages: [
              "Sharing your stone setup? Nice! 💎",
              "That's a solid build! ⚡",
              "Your friends will love this! 🔥",
              "Spreading the knowledge! 📚",
            ]
          });
        }
      } catch (fallbackError) {
        logger.error('Fallback also failed', { error: fallbackError });
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
    link.download = `${buildName.replace(/\s+/g, '_')}_skill_stones.json`;
    link.click();

    URL.revokeObjectURL(url);

    window.triggerDonationPrompt?.({
      messages: [
        "Backing up your stones! 💾",
        "Smart move saving that! 🛡️",
        "Data safety first! 📝",
        "Secured your build! 🔒",
      ]
    });
  };

  // Import build from JSON
  const handleImportBuild = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const hasActualChanges = hasUnsavedChanges && (
      buildName.trim() !== '' ||
      build.slots.some(slot => slot.element !== null)
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
        setBuild({ slots: buildData.slots || createEmptySlots() });
        setHasUnsavedChanges(true);

        window.triggerDonationPrompt?.({
          messages: [
            "Loading up the stones! 📥",
            "Fresh setup incoming! 🚀",
            "Time to try something new! ✨",
            "Imported successfully! 🎯",
          ]
        });
      } catch (error) {
        logger.error('Failed to import build', { error });
        alert('Failed to import build. Invalid file format.');
      }
    };
    reader.readAsText(file);

    event.target.value = '';
  };

  // Clear build
  const handleClearBuild = () => {
    if (!confirm('Clear all stones from this build?')) return;
    setBuild({ slots: createEmptySlots() });
    setBuildName('');
    setHasUnsavedChanges(false);
    setCurrentLoadedBuildId(null);
    clearDraft();
  };

  // Load build from saved builds
  const handleLoadBuild = (savedBuild) => {
    const hasActualChanges = hasUnsavedChanges && (
      buildName.trim() !== '' ||
      build.slots.some(slot => slot.element !== null)
    );

    if (hasActualChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Loading this build will discard your current changes. Continue?'
      );
      if (!confirmed) return;
    }

    setBuildName(savedBuild.name);
    setBuild({ slots: savedBuild.slots || createEmptySlots() });
    setHasUnsavedChanges(true);
    setCurrentLoadedBuildId(savedBuild.id);

    window.triggerDonationPrompt?.({
      messages: [
        "Back to a classic! 📚",
        "Revisiting perfection? 😎",
        "That was a good one! 👌",
        "Loading your masterpiece! 🎨",
      ]
    });
  };

  // Save build to backend
  const saveBuild = async () => {
    if (!user || !isAuthenticated) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const serializedBuild = serializeBuild({ ...build, name: buildName });

      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'skill-stone-builds',
          username: user.login,
          userId: user.id,
          data: serializedBuild,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save build');
      }

      const data = await response.json();
      const sortedBuilds = data.builds.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setSavedBuilds(sortedBuilds);

      const savedBuild = sortedBuilds.find(b => b.name === buildName);
      if (savedBuild) {
        setCurrentLoadedBuildId(savedBuild.id);
      }

      setSaveSuccess(true);
      setHasUnsavedChanges(false);

      setCache('skill_stone_builds', user.id, sortedBuilds);
      clearDraft();

      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      logger.error('Failed to save build', { error: err });
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

  // Expose saveBuild function to parent via ref
  useImperativeHandle(ref, () => ({
    saveBuild: handleSaveBuild
  }));

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${isModal ? 'min-h-[400px]' : 'min-h-screen'} bg-gradient-to-b from-gray-900 to-black`}>
        <div className="text-white text-xl">Loading skill stones...</div>
      </div>
    );
  }

  return (
    <div className={isModal ? "bg-gray-50 dark:bg-gray-950" : "min-h-screen bg-gray-50 dark:bg-gray-950"}>
      {/* Header - Title (only in page mode) */}
      {!isModal && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Skill Stone Builder</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Configure your skill stones: Cooldown Stone, Time Stone, and Heat Stone.
            </p>
          </div>
        </div>
      )}

      {/* Saved Builds Panel */}
      <div className={`${isModal ? 'px-4 pt-6 pb-0' : 'max-w-7xl mx-auto px-3 sm:px-4 pt-2 pb-0'}`}>
        <SavedBuildsPanel
          currentBuild={build}
          buildName={buildName}
          onLoadBuild={handleLoadBuild}
          allowSavingBuilds={false}
          currentLoadedBuildId={currentLoadedBuildId}
          onBuildsChange={setSavedBuilds}
          defaultExpanded={!isModal}
          externalBuilds={savedBuilds}
          buildType='skill-stone-builds'
          buildData={build}
        />
      </div>

      {/* Main Content */}
      <div className={`${isModal ? 'px-4 pt-1 pb-3' : 'max-w-7xl mx-auto px-3 sm:px-4 pt-1 pb-3'}`}>
        {/* Build Name Panel */}
        {allowSavingBuilds && (
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap pt-2">Build Name:</label>
              <div className="flex-1">
                <ValidatedInput
                  value={buildName}
                  onChange={(e) => setBuildName(e.target.value)}
                  validator={validateBuildName}
                  placeholder="Enter build name..."
                  maxLength={STRING_LIMITS.BUILD_NAME_MAX}
                  required={isAuthenticated}
                  showCounter={true}
                  validateOnBlur={false}
                  className="w-full"
                />
              </div>
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
            {shareError && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                {shareError}
              </div>
            )}
          </div>
        )}

        {/* Skill Stone Slots */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
          <div className="grid grid-cols-3 gap-6 justify-items-center">
            {build.slots.map((slot, index) => (
              <SkillStoneSlot
                key={index}
                slot={slot}
                slotIndex={index}
                onSelectStone={() => handleSelectSlot(index)}
                onRemoveStone={() => handleRemoveStone(index)}
                readOnly={false}
                stoneData={stoneData}
              />
            ))}
          </div>
        </div>

        {/* Build Info */}
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-900">
          <h3 className="text-base font-semibold mb-2 text-blue-900 dark:text-blue-100">How to Use:</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Click the <span className="font-medium">+ icon</span> on an empty slot to add a stone</li>
            <li>• First select an <span className="font-medium">element</span> (Fire, Water, Wind, Earth)</li>
            <li>• Then select a <span className="font-medium">tier</span> (A or B)</li>
            <li>• Click on a stone to remove it from your build</li>
            <li>• Use <span className="font-medium">Share</span> to get a shareable URL for your build</li>
            <li>• Use <span className="font-medium">Export/Import</span> to save and load builds as files</li>
          </ul>
        </div>
      </div>

      {/* Stone Selector Modal */}
      <SkillStoneSelector
        isOpen={showStoneSelector}
        onClose={() => setShowStoneSelector(false)}
        onSelectStone={handleStoneSelected}
        stoneType={selectedSlotIndex !== null ? build.slots[selectedSlotIndex].type : 'cooldown'}
        stoneData={stoneData}
      />
    </div>
  );
});

/**
 * Create empty slots (3 fixed slots for Cooldown, Time, Heat)
 */
function createEmptySlots() {
  return [
    { type: 'cooldown', element: null, tier: null },
    { type: 'time', element: null, tier: null },
    { type: 'heat', element: null, tier: null }
  ];
}

SkillStoneBuilder.displayName = 'SkillStoneBuilder';

export default SkillStoneBuilder;
