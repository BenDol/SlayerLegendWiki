import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Share2, Download, Upload, Settings, Trash2, Copy, Check, Save, Loader, CheckCircle2 } from 'lucide-react';
import SkillSlot from './SkillSlot';
import SkillSelector from './SkillSelector';
import SavedBuildsPanel from './SavedBuildsPanel';
import ValidatedInput from './ValidatedInput';
import { encodeBuild, decodeBuild } from '../../wiki-framework/src/components/wiki/BuildEncoder';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { setCache } from '../utils/buildCache';
import { saveBuild as saveSharedBuild, loadBuild as loadSharedBuild, generateShareUrl } from '../../wiki-framework/src/services/github/buildShare';
import { useDraftStorage } from '../../wiki-framework/src/hooks/useDraftStorage';
import { getSaveDataEndpoint } from '../utils/apiEndpoints.js';
import { validateBuildName, STRING_LIMITS } from '../utils/validation';
import { createLogger } from '../utils/logger';

const logger = createLogger('SkillBuilder');

/**
 * SkillBuilder Component
 *
 * Main component for creating and sharing skill builds
 * Features:
 * - Configurable skill slots (1-10)
 * - URL sharing with encoded build data
 * - Import/Export builds as JSON
 * - Build statistics
 * - Draft auto-save to localStorage
 *
 * @param {boolean} isModal - If true, renders in modal mode with Save button instead of Share
 * @param {object} initialBuild - Initial build data to load (for modal mode)
 * @param {function} onSave - Callback when Save is clicked in modal mode
 * @param {boolean} allowSavingBuilds - If true, shows build name field and save-related UI (default: true)
 */
const SkillBuilder = forwardRef(({ isModal = false, initialBuild = null, onSave = null, allowSavingBuilds = true }, ref) => {
  const { isAuthenticated, user } = useAuthStore();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buildName, setBuildName] = useState('');
  const [maxSlots, setMaxSlots] = useState(10);
  const [autoMaxLevel, setAutoMaxLevel] = useState(false);
  const [build, setBuild] = useState({
    slots: Array(10).fill(null).map(() => ({ skill: null, level: 1 }))
  });
  const [showSkillSelector, setShowSkillSelector] = useState(false);
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
    'skillBuilder',
    user,
    isModal,
    { buildName, maxSlots, autoMaxLevel, build }
  );

  // Load skills data
  useEffect(() => {
    loadSkills();
  }, []);

  // Load build from URL after skills are loaded (only in page mode)
  useEffect(() => {
    if (skills.length === 0) return; // Wait for skills to load
    if (isModal) return; // Skip URL loading in modal mode

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const shareChecksum = urlParams.get('share');
    const encodedBuild = urlParams.get('data');

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

          if (buildData.type === 'skill-builds') {
            const deserializedBuild = deserializeBuild(buildData.data, skills);
            setBuildName(buildData.data.name || '');
            setMaxSlots(buildData.data.maxSlots || 10);
            setBuild({ slots: deserializedBuild.slots });
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
    // Fallback to old encoded system
    else if (encodedBuild) {
      try {
        const decodedBuild = decodeBuild(encodedBuild);
        if (decodedBuild) {
          setBuildName(decodedBuild.name || '');
          setMaxSlots(decodedBuild.maxSlots || 10);

          // Deserialize build (convert skill IDs back to full skill objects)
          const deserializedBuild = deserializeBuild(decodedBuild, skills);
          setBuild({ slots: deserializedBuild.slots });
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
        setMaxSlots(draft.maxSlots || 10);
        setAutoMaxLevel(draft.autoMaxLevel || false);

        // Deserialize build to ensure skill objects are current
        const deserializedBuild = deserializeBuild(draft.build, skills);
        setBuild(deserializedBuild);
        setHasUnsavedChanges(true);
      }
    }
  }, [skills, isModal, loadDraft]); // Trigger when skills load

  // Load initial build in modal mode
  useEffect(() => {
    if (skills.length === 0) return; // Wait for skills to load
    if (!isModal || !initialBuild) return; // Only in modal mode with initial data

    setBuildName(initialBuild.name || 'My Build');
    setMaxSlots(initialBuild.maxSlots || 10);

    // Deserialize build to ensure skill objects are current
    const deserializedBuild = deserializeBuild(initialBuild, skills);
    setBuild({ slots: deserializedBuild.slots });
    setHasUnsavedChanges(true); // Mark as having changes to block navigation
  }, [skills, isModal, initialBuild]);

  const loadSkills = async () => {
    try {
      const response = await fetch('/data/skills.json');
      const data = await response.json();
      setSkills(data);
    } catch (error) {
      logger.error('Failed to load skills', { error });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Serialize build for URL encoding (skill objects -> skill IDs only)
   * This makes URLs resilient to skill data changes
   */
  const serializeBuild = (buildToSerialize) => {
    return {
      name: buildToSerialize.name || buildName,
      maxSlots: buildToSerialize.maxSlots || maxSlots,
      slots: buildToSerialize.slots.map(slot => ({
        skillId: slot.skillId !== undefined ? slot.skillId : (slot.skill?.id || null),
        level: slot.level
      }))
    };
  };

  /**
   * Deserialize build after decoding (skill IDs -> full skill objects)
   * Handles both new format (IDs) and old format (full objects) for backward compatibility
   */
  const deserializeBuild = (serializedBuild, skillsArray) => {
    return {
      slots: serializedBuild.slots.map(slot => {
        // Handle new format (skillId)
        if (slot.skillId !== undefined) {
          const skill = skillsArray.find(s => s.id === slot.skillId);
          return {
            skill: skill || null,
            level: slot.level || 1
          };
        }
        // Handle old format (full skill object) for backward compatibility
        else if (slot.skill) {
          // Try to find skill by ID first, fallback to name
          let skill = skillsArray.find(s => s.id === slot.skill.id);
          if (!skill) {
            skill = skillsArray.find(s => s.name === slot.skill.name);
          }
          return {
            skill: skill || slot.skill, // Use found skill or keep old data
            level: slot.level || 1
          };
        }
        // Empty slot
        else {
          return { skill: null, level: 1 };
        }
      })
    };
  };

  /**
   * Compare current build with a saved build to check if they match
   */
  const buildsMatch = (savedBuild) => {
    if (!savedBuild) return false;

    // Check name and maxSlots
    if (savedBuild.name !== buildName) return false;
    if (savedBuild.maxSlots !== maxSlots) return false;

    // Serialize both for consistent comparison (handles both serialized and deserialized formats)
    const currentSerialized = serializeBuild({ ...build, name: buildName, maxSlots });
    const savedSerialized = serializeBuild(savedBuild);

    // Compare serialized slots
    if (currentSerialized.slots.length !== savedSerialized.slots.length) return false;

    for (let i = 0; i < currentSerialized.slots.length; i++) {
      const currentSlot = currentSerialized.slots[i];
      const savedSlot = savedSerialized.slots[i];

      if (currentSlot.skillId !== savedSlot.skillId) return false;
      if (currentSlot.level !== savedSlot.level) return false;
    }

    return true;
  };

  /**
   * Check if current build matches any saved build and update highlighting
   * Note: This only tracks which build is loaded, not unsaved changes
   */
  useEffect(() => {
    // Check if there's any content
    const hasContent = buildName.trim() !== '' || build.slots.some(slot => slot.skill !== null);

    if (!isAuthenticated || savedBuilds.length === 0) {
      if (currentLoadedBuildId !== null) {
        setCurrentLoadedBuildId(null);
      }
      // If not authenticated or no saved builds, only update if no content
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
      // Don't automatically clear hasUnsavedChanges when matching
      // It should only be cleared when explicitly loading or after successful save
    } else {
      setCurrentLoadedBuildId(null);
      // Mark as having changes if there's content and no match
      if (hasContent && !hasUnsavedChanges) {
        setHasUnsavedChanges(true);
      }
    }
  }, [buildName, maxSlots, build, savedBuilds, isAuthenticated, hasUnsavedChanges]);

  // Handle slot actions
  const handleSelectSlot = (index) => {
    setSelectedSlotIndex(index);
    setShowSkillSelector(true);
  };

  const handleSkillSelected = (skill) => {
    if (selectedSlotIndex === null) return;

    // Check if skill is already equipped in another slot
    const isAlreadyEquipped = build.slots.some((slot, index) =>
      slot.skill && slot.skill.id === skill.id && index !== selectedSlotIndex
    );

    if (isAlreadyEquipped) {
      alert('This skill is already equipped in another slot!');
      return;
    }

    const newSlots = [...build.slots];
    newSlots[selectedSlotIndex] = {
      skill: skill,
      level: autoMaxLevel ? (skill.maxLevel || 130) : 1
    };
    setBuild({ slots: newSlots });
  };

  const handleRemoveSkill = (index) => {
    const newSlots = [...build.slots];
    newSlots[index] = { skill: null, level: 1 };
    setBuild({ slots: newSlots });
  };

  const handleLevelChange = (index, newLevel) => {
    const newSlots = [...build.slots];
    newSlots[index].level = newLevel;
    setBuild({ slots: newSlots });
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedSlotIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();

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

      logger.debug('Generating share URL');

      const configResponse = await fetch('/wiki-config.json');
      const config = await configResponse.json();
      const owner = config.wiki.repository.owner;
      const repo = config.wiki.repository.repo;

      // Serialize build to only include skill IDs
      const serializedBuild = serializeBuild({ ...build, name: buildName, maxSlots });
      const buildData = {
        name: serializedBuild.name,
        maxSlots: serializedBuild.maxSlots,
        slots: serializedBuild.slots
      };

      // Save build and get checksum
      const checksum = await saveSharedBuild(owner, repo, 'skill-builds', buildData);

      logger.debug('Generated checksum', { checksum });

      // Generate share URL
      const baseURL = window.location.origin + window.location.pathname;
      const shareURL = generateShareUrl(baseURL, 'skill-builds', checksum);

      await navigator.clipboard.writeText(shareURL);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      logger.info('Share URL copied to clipboard');

      // Trigger donation prompt on successful share
      window.triggerDonationPrompt?.({
        messages: [
          "Sharing your OP build? Nice! ⚔️",
          "That's a build worth flexing! 💪",
          "Your friends are gonna love this one! 🎮",
          "Spreading the meta like a pro! 🔥",
        ]
      });
    } catch (error) {
      logger.error('Failed to generate share URL', { error });
      setShareError(error.message || 'Failed to generate share URL');

      // Fallback to old method if share service fails
      try {
        logger.warn('Falling back to old encoding method');
        const serializedBuild = serializeBuild({ ...build, name: buildName, maxSlots });
        const encoded = encodeBuild(serializedBuild);
        if (encoded) {
          const baseURL = window.location.origin + window.location.pathname;
          const shareURL = `${baseURL}#/skill-builder?data=${encoded}`;
          await navigator.clipboard.writeText(shareURL);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          logger.info('Fallback URL copied to clipboard');

          // Trigger donation prompt on successful share (fallback)
          window.triggerDonationPrompt?.({
            messages: [
              "Sharing your OP build? Nice! ⚔️",
              "That's a build worth flexing! 💪",
              "Your friends are gonna love this one! 🎮",
              "Spreading the meta like a pro! 🔥",
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
      maxSlots,
      slots: build.slots,
      exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(buildData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${buildName.replace(/\s+/g, '_')}.json`;
    link.click();

    URL.revokeObjectURL(url);

    // Trigger donation prompt on successful export
    window.triggerDonationPrompt?.({
      messages: [
        "Smart move backing that up! 💾",
        "Data safety first, nice! 🛡️",
        "A true strategist saves their work! 📝",
        "Exporting the goods, I see! 📦",
      ]
    });
  };

  // Import build from JSON
  const handleImportBuild = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if there are actual meaningful changes (not just initial state)
    const hasActualChanges = hasUnsavedChanges && (
      buildName.trim() !== '' ||
      build.slots.some(slot => slot.skill !== null)
    );

    // Check for unsaved changes before importing
    if (hasActualChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Importing a build will discard your current changes. Continue?'
      );
      if (!confirmed) {
        // Reset file input
        event.target.value = '';
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buildData = JSON.parse(e.target.result);
        setBuildName(buildData.name || '');
        setMaxSlots(buildData.maxSlots || 10);

        // Deserialize build to ensure skill objects are current
        const deserializedBuild = deserializeBuild(buildData, skills);
        setBuild({ slots: deserializedBuild.slots });
        setHasUnsavedChanges(true); // Mark as having changes to block navigation

        // Trigger donation prompt on successful import
        window.triggerDonationPrompt?.({
          messages: [
            "Loading up the good stuff? 📥",
            "Fresh builds incoming! 🚀",
            "Time to try something new! ✨",
            "Importing excellence, I see! 🎯",
          ]
        });
      } catch (error) {
        logger.error('Failed to import build', { error });
        alert('Failed to import build. Invalid file format.');
      }
    };
    reader.readAsText(file);

    // Reset file input for next import
    event.target.value = '';
  };

  // Clear build
  const handleClearBuild = () => {
    if (!confirm('Clear all skills from this build?')) return;
    setBuild({ slots: Array(maxSlots).fill(null).map(() => ({ skill: null, level: 1 })) });
    setBuildName('');
    setHasUnsavedChanges(false); // No content after clearing
    setCurrentLoadedBuildId(null); // No loaded build after clearing
    clearDraft(); // Clear localStorage draft
  };

  // Load build from saved builds
  const handleLoadBuild = (savedBuild) => {
    // Check if there are actual meaningful changes (not just initial state)
    const hasActualChanges = hasUnsavedChanges && (
      buildName.trim() !== '' ||
      build.slots.some(slot => slot.skill !== null)
    );

    // Check for unsaved changes before loading
    if (hasActualChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Loading this build will discard your current changes. Continue?'
      );
      if (!confirmed) return;
    }

    setBuildName(savedBuild.name);
    setMaxSlots(savedBuild.maxSlots);

    // Deserialize build to ensure skill objects are current
    const deserializedBuild = deserializeBuild(savedBuild, skills);
    setBuild({ slots: deserializedBuild.slots });
    setHasUnsavedChanges(true); // Mark as having changes to block navigation
    setCurrentLoadedBuildId(savedBuild.id); // Track which build is currently loaded

    // Trigger donation prompt on successful load
    window.triggerDonationPrompt?.({
      messages: [
        "Back to the classics! 📚",
        "Revisiting perfection? 😎",
        "That was a good one! 👌",
        "Loading up your masterpiece! 🎨",
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
      // Serialize build to only store IDs (reduces storage and is resilient to data changes)
      const serializedBuild = serializeBuild({ ...build, name: buildName, maxSlots });
      const buildData = {
        name: serializedBuild.name,
        maxSlots: serializedBuild.maxSlots,
        slots: serializedBuild.slots, // Only store { skillId, level }
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
      setSavedBuilds(sortedBuilds);

      // Find the saved build ID (it's the one with the matching name)
      const savedBuild = sortedBuilds.find(b => b.name === buildName);
      if (savedBuild) {
        setCurrentLoadedBuildId(savedBuild.id);
      }

      setSaveSuccess(true);
      setHasUnsavedChanges(false); // Clear unsaved changes after successful save

      // Cache the updated builds
      setCache('skill_builds', user.id, sortedBuilds);

      // Clear localStorage draft after successful save
      clearDraft();

      // Hide success message after 2 seconds
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
        maxSlots,
        slots: build.slots
      };
      onSave(buildData);
    }
  };

  // Expose saveBuild function to parent via ref (for modal footer button)
  useImperativeHandle(ref, () => ({
    saveBuild: handleSaveBuild
  }));

  // Get element icon
  const getElementIcon = (element) => {
    const icons = {
      Fire: '/images/icons/typeicon_fire_1.png',
      Water: '/images/icons/typeicon_water_1.png',
      Wind: '/images/icons/typeicon_wind_1.png',
      Earth: '/images/icons/typeicon_earth s_1.png'
    };
    return icons[element];
  };

  // Calculate build stats
  const getEquippedSkillsCount = () => {
    return build.slots.filter(slot => slot.skill !== null).length;
  };

  const getElementDistribution = () => {
    const distribution = {};
    build.slots.forEach(slot => {
      if (slot.skill) {
        const attr = slot.skill.attribute;
        // Only count skills with valid element types (exclude null, undefined, or empty string)
        if (attr && attr !== '') {
          distribution[attr] = (distribution[attr] || 0) + 1;
        }
      }
    });
    return distribution;
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${isModal ? 'min-h-[400px]' : 'min-h-screen'} bg-gradient-to-b from-gray-900 to-black`}>
        <div className="text-white text-xl">Loading skills...</div>
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
              <img src="/images/skills/Icon_skillCard.png" alt="" className="w-8 h-8 flex-shrink-0" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Skill Builder</h1>
            </div>
          </div>
        </div>
      )}

      {/* Saved Builds Panel */}
      <div className={`${isModal ? 'px-4 pt-6 pb-0' : 'max-w-7xl mx-auto px-3 sm:px-4 pt-2 pb-0'}`}>
        <SavedBuildsPanel
          currentBuild={build}
          buildName={buildName}
          maxSlots={maxSlots}
          onLoadBuild={handleLoadBuild}
          allowSavingBuilds={false}
          currentLoadedBuildId={currentLoadedBuildId}
          onBuildsChange={setSavedBuilds}
          defaultExpanded={!isModal}
          externalBuilds={savedBuilds}
        />
      </div>

      {/* Main Content */}
      <div className={`${isModal ? 'px-4 pt-1 pb-3' : 'max-w-7xl mx-auto px-3 sm:px-4 pt-1 pb-3'}`}>
        {/* Build Name Panel - Controlled by allowSavingBuilds */}
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
            {/* Save Error Message */}
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

        {/* Settings Bar */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* Settings Row */}
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
              <div className="flex items-center gap-2 sm:gap-3">
                <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Max Slots:</label>
                <select
                  value={maxSlots}
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value);
                    setMaxSlots(newMax);
                    const newSlots = [...build.slots];
                    while (newSlots.length < newMax) {
                      newSlots.push({ skill: null, level: 1 });
                    }
                    setBuild({ slots: newSlots.slice(0, newMax) });
                  }}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                  {[...Array(10)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <label htmlFor="autoMaxLevel" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="autoMaxLevel"
                    checked={autoMaxLevel}
                    onChange={(e) => setAutoMaxLevel(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Auto-max level
                  </span>
                </label>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-4 sm:gap-6 text-sm flex-wrap pt-2 border-t border-gray-200 dark:border-gray-700">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Equipped:</span>
                <span className="ml-2 font-semibold text-gray-900 dark:text-white">{getEquippedSkillsCount()}/{maxSlots}</span>
              </div>

              {/* Element Distribution */}
              {Object.entries(getElementDistribution()).map(([element, count]) => (
                <div key={element} className="flex items-center gap-1.5" title={element}>
                  <img
                    src={getElementIcon(element)}
                    alt={element}
                    className="w-4 h-4 cursor-help"
                  />
                  <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Skill Slots Grid */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 justify-items-center">
            {build.slots.slice(0, maxSlots).map((slot, index) => (
              <SkillSlot
                key={index}
                skill={slot.skill}
                level={slot.level}
                isLocked={index >= maxSlots}
                slotNumber={index + 1}
                slotIndex={index}
                onSelectSkill={() => handleSelectSlot(index)}
                onRemoveSkill={() => handleRemoveSkill(index)}
                onLevelChange={(newLevel) => handleLevelChange(index, newLevel)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragging={draggedSlotIndex === index}
              />
            ))}
          </div>
        </div>

        {/* Bulk Level Actions */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
          <div className="flex justify-center gap-2">
            <button
              onClick={() => {
                if (confirm('Set all equipped skills to level 1?')) {
                  const newSlots = build.slots.map(slot =>
                    slot.skill ? { ...slot, level: 1 } : slot
                  );
                  setBuild({ slots: newSlots });
                }
              }}
              className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium transition-colors"
            >
              Min All Levels
            </button>
            <button
              onClick={() => {
                if (confirm('Set all equipped skills to their maximum level?')) {
                  const newSlots = build.slots.map(slot =>
                    slot.skill ? { ...slot, level: slot.skill.maxLevel || 130 } : slot
                  );
                  setBuild({ slots: newSlots });
                }
              }}
              className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium transition-colors"
            >
              Max All Levels
            </button>
          </div>
        </div>

        {/* Build Info */}
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-900">
          <h3 className="text-base font-semibold mb-2 text-blue-900 dark:text-blue-100">How to Use:</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Click the <span className="font-medium">+ icon</span> on an empty slot to add a skill</li>
            <li>• Click on a skill to remove it from your build</li>
            <li>• Click the <span className="font-medium">level badge</span> to adjust skill levels</li>
            <li>• Use <span className="font-medium">Share</span> to get a shareable URL for your build</li>
            <li>• Use <span className="font-medium">Export/Import</span> to save and load builds as files</li>
          </ul>
        </div>
      </div>

      {/* Skill Selector Modal */}
      <SkillSelector
        isOpen={showSkillSelector}
        onClose={() => setShowSkillSelector(false)}
        onSelectSkill={handleSkillSelected}
        skills={skills}
        currentBuild={build}
      />
    </div>
  );
});

SkillBuilder.displayName = 'SkillBuilder';

export default SkillBuilder;



