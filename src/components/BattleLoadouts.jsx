import React, { useState, useEffect, useRef } from 'react';
import { Share2, Download, Upload, Trash2, Copy, Check, Edit, Plus, Save, Loader, CheckCircle2, X, Move } from 'lucide-react';
import SkillBuilderModal from './SkillBuilderModal';
import SkillSlot from './SkillSlot';
import SkillInformation from './SkillInformation';
import SpiritBuilderModal from './SpiritBuilderModal';
import SpiritComponent from './SpiritComponent';
import SavedLoadoutsPanel from './SavedLoadoutsPanel';
import ValidatedInput from './ValidatedInput';
import { encodeLoadout, decodeLoadout } from '../../wiki-framework/src/utils/battleLoadoutEncoder';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { setCache } from '../utils/buildCache';
import { saveBuild, loadBuild, generateShareUrl } from '../../wiki-framework/src/services/github/buildShare';
import { useDraftStorage } from '../../wiki-framework/src/hooks/useDraftStorage';
import { getSaveDataEndpoint } from '../utils/apiEndpoints.js';
import { serializeBuild, deserializeBuild } from '../utils/spiritSerialization';
import { validateBuildName, STRING_LIMITS } from '../utils/validation';

/**
 * BattleLoadouts Component
 *
 * Comprehensive loadout management system matching the game's Battle Settings
 * Features:
 * - Named loadout saves (similar to skill builds)
 * - Skills section (10 slots) - integrates with Skill Builder
 * - Accompanying Spirit section (placeholder)
 * - Skill Stone section (placeholder)
 * - Slayer Promotion Additional Ability section (placeholder)
 * - Familiar Skill section (placeholder)
 * - Save/Load/Share/Import/Export functionality
 */
const BattleLoadouts = () => {
  const { isAuthenticated, user } = useAuthStore();
  const loadoutNameInputRef = useRef(null);
  const [loadoutName, setLoadoutName] = useState('');
  const [currentLoadout, setCurrentLoadout] = useState(createEmptyLoadout(''));
  const [skills, setSkills] = useState([]);
  const [spirits, setSpirits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSkillBuilder, setShowSkillBuilder] = useState(false);
  const [showSpiritBuilder, setShowSpiritBuilder] = useState(false);
  const [showSkillInfo, setShowSkillInfo] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentLoadedLoadoutId, setCurrentLoadedLoadoutId] = useState(null);
  const [highlightNameField, setHighlightNameField] = useState(false);
  const [draggedSkillSlotIndex, setDraggedSkillSlotIndex] = useState(null);
  const [draggedSpiritSlotIndex, setDraggedSpiritSlotIndex] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [savedLoadouts, setSavedLoadouts] = useState([]);

  // Draft storage hook for auto-save/restore
  const { loadDraft, clearDraft } = useDraftStorage(
    'battleLoadouts',
    user,
    false, // Never in modal mode for BattleLoadouts
    { loadoutName, currentLoadout }
  );

  // Load skills and spirits data
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([loadSkills(), loadSpirits()]);
    };
    loadData();
  }, []);

  // Load loadout from URL
  useEffect(() => {
    if (skills.length === 0 || spirits.length === 0) return; // Wait for skills and spirits to load

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const shareChecksum = urlParams.get('share');
    const encodedLoadout = urlParams.get('data');

    // Load from new share system (short URL)
    if (shareChecksum) {
      const loadSharedBuild = async () => {
        try {
          setLoading(true);
          console.log('[BattleLoadouts] Loading shared build:', shareChecksum);

          // Get repo info from config
          const configResponse = await fetch('/wiki-config.json');
          const config = await configResponse.json();
          const owner = config.wiki.repository.owner;
          const repo = config.wiki.repository.repo;

          const buildData = await loadBuild(owner, repo, shareChecksum);

          if (buildData.type === 'battle-loadouts') {
            // Deserialize skill build and spirit build
            const deserializedLoadout = {
              ...buildData.data,
              skillBuild: buildData.data.skillBuild ? deserializeSkillBuild(buildData.data.skillBuild, skills) : null,
              spiritBuild: buildData.data.spiritBuild ? deserializeSpiritBuild(buildData.data.spiritBuild, spirits) : null
            };
            setCurrentLoadout(deserializedLoadout);
            setLoadoutName(deserializedLoadout.name || '');
            setHasUnsavedChanges(false);
            console.log('[BattleLoadouts] ✓ Shared build loaded successfully');
          } else {
            throw new Error(`Invalid build type: ${buildData.type}`);
          }
        } catch (error) {
          console.error('[BattleLoadouts] Failed to load shared build:', error);
          alert(`Failed to load shared build: ${error.message}`);
        } finally {
          setLoading(false);
        }
      };

      loadSharedBuild();
    }
    // Fallback to old encoded system
    else if (encodedLoadout) {
      try {
        const decodedLoadout = decodeLoadout(encodedLoadout);
        if (decodedLoadout) {
          // Deserialize skill build and spirit build
          const deserializedLoadout = {
            ...decodedLoadout,
            skillBuild: decodedLoadout.skillBuild ? deserializeSkillBuild(decodedLoadout.skillBuild, skills) : null,
            spiritBuild: decodedLoadout.spiritBuild ? deserializeSpiritBuild(decodedLoadout.spiritBuild, spirits) : null
          };
          setCurrentLoadout(deserializedLoadout);
          setLoadoutName(deserializedLoadout.name || '');
          setHasUnsavedChanges(false); // Loaded from URL, no unsaved changes yet
        }
      } catch (error) {
        console.error('[BattleLoadouts] Failed to load loadout from URL:', error);
      }
    }
    // Load from localStorage if no URL params
    else {
      const draft = loadDraft();
      if (draft) {
        setLoadoutName(draft.loadoutName || '');

        // Deserialize loadout to ensure skill and spirit objects are current
        const deserializedLoadout = {
          ...draft.currentLoadout,
          skillBuild: draft.currentLoadout.skillBuild ? deserializeSkillBuild(draft.currentLoadout.skillBuild, skills) : null,
          spiritBuild: draft.currentLoadout.spiritBuild ? deserializeSpiritBuild(draft.currentLoadout.spiritBuild, spirits) : null
        };
        setCurrentLoadout(deserializedLoadout);
        setHasUnsavedChanges(true);
      }
    }
  }, [skills, spirits, loadDraft]);

  const loadSkills = async () => {
    try {
      const response = await fetch('/data/skills.json');
      const data = await response.json();
      setSkills(data);
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSpirits = async () => {
    try {
      const response = await fetch('/data/spirit-characters.json');
      const data = await response.json();
      setSpirits(data.spirits);
    } catch (error) {
      console.error('Failed to load spirits:', error);
    }
  };

  /**
   * Deserialize skill build (skill IDs -> full skill objects)
   */
  const deserializeSkillBuild = (build, skillsArray) => {
    return {
      ...build,
      slots: build.slots.map(slot => {
        if (slot.skillId !== undefined) {
          const skill = skillsArray.find(s => s.id === slot.skillId);
          return {
            skill: skill || null,
            level: slot.level || 1
          };
        } else if (slot.skill) {
          let skill = skillsArray.find(s => s.id === slot.skill.id);
          if (!skill) {
            skill = skillsArray.find(s => s.name === slot.skill.name);
          }
          return {
            skill: skill || slot.skill,
            level: slot.level || 1
          };
        } else {
          return { skill: null, level: 1 };
        }
      })
    };
  };

  /**
   * Serialize skill build for storage (skill objects -> skill IDs)
   */
  const serializeSkillBuild = (build) => {
    if (!build) return null;
    return {
      name: build.name,
      maxSlots: build.maxSlots,
      slots: build.slots.map(slot => ({
        skillId: slot.skillId !== undefined ? slot.skillId : (slot.skill?.id || null),
        level: slot.level
      }))
    };
  };

  /**
   * Serialize spirit build for storage (spirit objects -> spirit IDs)
   * Uses shared serialization utility
   */
  const serializeSpiritBuild = (build) => {
    if (!build) return null;
    return serializeBuild(build);
  };

  /**
   * Deserialize spirit build (spirit IDs -> full spirit objects)
   * Uses shared deserialization utility
   */
  const deserializeSpiritBuild = (build, spiritsArray) => {
    if (!build) return null;
    return deserializeBuild(build, spiritsArray);
  };

  /**
   * Serialize entire loadout for storage (only store IDs)
   */
  const serializeLoadout = (loadout) => {
    return {
      name: loadout.name,
      skillBuild: serializeSkillBuild(loadout.skillBuild),
      spiritBuild: serializeSpiritBuild(loadout.spiritBuild),
      spirit: loadout.spirit ? { spiritId: loadout.spirit.id } : null,
      skillStone: loadout.skillStone, // Assuming this is already simple data
      promotionAbility: loadout.promotionAbility, // Assuming this is already simple data
      familiar: loadout.familiar // Assuming this is already simple data
    };
  };

  /**
   * Check if current loadout matches a saved loadout
   */
  const loadoutsMatch = (savedLoadout) => {
    if (!savedLoadout) return false;
    if (savedLoadout.name !== loadoutName) return false;

    // Compare skill build (serialize both for consistent comparison)
    const currentSkillBuild = serializeSkillBuild(currentLoadout.skillBuild);
    const savedSkillBuild = serializeSkillBuild(savedLoadout.skillBuild);
    if (JSON.stringify(currentSkillBuild) !== JSON.stringify(savedSkillBuild)) return false;

    // Compare spirit build (serialize both for consistent comparison)
    const currentSpiritBuild = serializeSpiritBuild(currentLoadout.spiritBuild);
    const savedSpiritBuild = serializeSpiritBuild(savedLoadout.spiritBuild);
    if (JSON.stringify(currentSpiritBuild) !== JSON.stringify(savedSpiritBuild)) return false;

    // Compare other properties
    if (JSON.stringify(currentLoadout.spirit) !== JSON.stringify(savedLoadout.spirit)) return false;
    if (JSON.stringify(currentLoadout.skillStone) !== JSON.stringify(savedLoadout.skillStone)) return false;
    if (JSON.stringify(currentLoadout.promotionAbility) !== JSON.stringify(savedLoadout.promotionAbility)) return false;
    if (JSON.stringify(currentLoadout.familiar) !== JSON.stringify(savedLoadout.familiar)) return false;

    return true;
  };

  // Update loadout name in current loadout
  useEffect(() => {
    setCurrentLoadout(prev => ({ ...prev, name: loadoutName }));
  }, [loadoutName]);

  /**
   * Check if current loadout matches any saved loadout and update highlighting
   */
  useEffect(() => {
    // Check if there's any content
    const hasContent = loadoutName.trim() !== '' ||
      currentLoadout.skillBuild !== null ||
      currentLoadout.spiritBuild !== null ||
      currentLoadout.spirit !== null ||
      currentLoadout.skillStone !== null ||
      currentLoadout.promotionAbility !== null ||
      currentLoadout.familiar !== null;

    if (!isAuthenticated || savedLoadouts.length === 0) {
      if (currentLoadedLoadoutId !== null) {
        setCurrentLoadedLoadoutId(null);
      }
      // If not authenticated or no saved loadouts, only update unsaved changes if no content
      if (!hasContent && hasUnsavedChanges) {
        setHasUnsavedChanges(false);
      } else if (hasContent && !hasUnsavedChanges) {
        setHasUnsavedChanges(true);
      }
      return;
    }

    // Find matching loadout
    const matchingLoadout = savedLoadouts.find(savedLoadout => loadoutsMatch(savedLoadout));

    if (matchingLoadout) {
      setCurrentLoadedLoadoutId(matchingLoadout.id);
      // Don't automatically clear hasUnsavedChanges when matching
    } else {
      setCurrentLoadedLoadoutId(null);
      // Mark as having changes if there's content and no match
      if (hasContent && !hasUnsavedChanges) {
        setHasUnsavedChanges(true);
      }
    }
  }, [loadoutName, currentLoadout, savedLoadouts, isAuthenticated, currentLoadedLoadoutId, hasUnsavedChanges]);

  // Handle skill builder save
  const handleSkillBuildSave = (build) => {
    setCurrentLoadout(prev => ({ ...prev, skillBuild: build }));
    setShowSkillBuilder(false);
  };

  // Clear skill build
  const handleClearSkillBuild = () => {
    if (!confirm('Remove skill build from this loadout?')) return;
    setCurrentLoadout(prev => ({ ...prev, skillBuild: null }));
  };

  // Handle spirit builder save
  const handleSpiritBuildSave = (build) => {
    setCurrentLoadout(prev => ({ ...prev, spiritBuild: build }));
    setShowSpiritBuilder(false);
  };

  // Clear spirit build
  const handleClearSpiritBuild = () => {
    if (!confirm('Remove spirit build from this loadout?')) return;
    setCurrentLoadout(prev => ({ ...prev, spiritBuild: null }));
  };

  // Remove individual spirit from slot
  const handleRemoveSpirit = (slotIndex) => {
    setCurrentLoadout(prev => {
      if (!prev.spiritBuild) return prev;

      const updatedSlots = [...prev.spiritBuild.slots];
      updatedSlots[slotIndex] = {
        spirit: null,
        level: 1,
        awakeningLevel: 0,
        evolutionLevel: 0,
        skillEnhancementLevel: 0
      };

      return {
        ...prev,
        spiritBuild: {
          ...prev.spiritBuild,
          slots: updatedSlots
        }
      };
    });
  };

  // Drag and drop handlers for skills
  const handleSkillDragStart = (e, index) => {
    setDraggedSkillSlotIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSkillDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSkillDrop = (e, targetIndex) => {
    e.preventDefault();

    if (draggedSkillSlotIndex === null || draggedSkillSlotIndex === targetIndex) {
      setDraggedSkillSlotIndex(null);
      return;
    }

    if (!currentLoadout.skillBuild) return;

    const newSlots = [...currentLoadout.skillBuild.slots];
    const draggedSlot = newSlots[draggedSkillSlotIndex];
    const targetSlot = newSlots[targetIndex];

    // Swap slots
    newSlots[draggedSkillSlotIndex] = targetSlot;
    newSlots[targetIndex] = draggedSlot;

    setCurrentLoadout(prev => ({
      ...prev,
      skillBuild: {
        ...prev.skillBuild,
        slots: newSlots
      }
    }));
    setDraggedSkillSlotIndex(null);
  };

  // Drag and drop handlers for spirits
  const handleSpiritDragStart = (e, index) => {
    setDraggedSpiritSlotIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSpiritDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSpiritDrop = (e, targetIndex) => {
    e.preventDefault();

    if (draggedSpiritSlotIndex === null || draggedSpiritSlotIndex === targetIndex) {
      setDraggedSpiritSlotIndex(null);
      return;
    }

    if (!currentLoadout.spiritBuild) return;

    const newSlots = [...currentLoadout.spiritBuild.slots];
    const draggedSlot = newSlots[draggedSpiritSlotIndex];
    const targetSlot = newSlots[targetIndex];

    // Swap slots
    newSlots[draggedSpiritSlotIndex] = targetSlot;
    newSlots[targetIndex] = draggedSlot;

    setCurrentLoadout(prev => ({
      ...prev,
      spiritBuild: {
        ...prev.spiritBuild,
        slots: newSlots
      }
    }));
    setDraggedSpiritSlotIndex(null);
  };

  // Load saved loadout
  const handleLoadLoadout = (loadout) => {
    // Check for unsaved changes before loading
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Loading this loadout will discard your current changes. Continue?'
      );
      if (!confirmed) return;
    }

    // Deserialize the skill build and spirit build if they exist
    const deserializedLoadout = {
      ...loadout,
      skillBuild: loadout.skillBuild ? deserializeSkillBuild(loadout.skillBuild, skills) : null,
      spiritBuild: loadout.spiritBuild ? deserializeSpiritBuild(loadout.spiritBuild, spirits) : null
    };

    setCurrentLoadout(deserializedLoadout);
    setLoadoutName(deserializedLoadout.name || 'My Loadout');
    setHasUnsavedChanges(false); // Loaded from saved, no unsaved changes
    setCurrentLoadedLoadoutId(loadout.id); // Track which loadout is currently loaded
  };

  // Save loadout
  const handleSaveLoadout = async () => {
    if (!user || !isAuthenticated) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Serialize loadout to only store IDs (reduces storage and is resilient to data changes)
      const loadoutData = serializeLoadout(currentLoadout);

      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'battle-loadouts',
          username: user.login,
          userId: user.id,
          data: loadoutData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save loadout');
      }

      const data = await response.json();

      // Cache the updated loadouts
      if (data.loadouts) {
        setCache('battle_loadouts', user.id, data.loadouts);
      }

      // Find the saved loadout ID (it's the one with the matching name)
      const savedLoadout = data.loadouts?.find(l => l.name === loadoutName);
      if (savedLoadout) {
        setCurrentLoadedLoadoutId(savedLoadout.id);
      }

      setSaveSuccess(true);
      setHasUnsavedChanges(false); // Successfully saved, clear unsaved changes flag

      // Clear localStorage draft after successful save
      clearDraft();

      // Hide success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);

      // Trigger refresh of saved loadouts panel
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('[BattleLoadouts] Failed to save loadout:', err);
      const errorMessage = err.message || 'Failed to save loadout';
      setSaveError(errorMessage);

      // If error is about missing name, scroll to and focus the name input
      if (errorMessage.toLowerCase().includes('name')) {
        // Scroll to the name input
        loadoutNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Focus the input
        setTimeout(() => {
          loadoutNameInputRef.current?.focus();

          // Trigger highlight animation
          setHighlightNameField(true);
          setTimeout(() => setHighlightNameField(false), 2000);
        }, 300);
      }
    } finally {
      setSaving(false);
    }
  };

  // Share loadout
  const handleShareLoadout = async () => {
    try {
      setSharing(true);
      setShareError(null);

      console.log('[BattleLoadouts] Generating share URL...');

      // Get repo info from config
      const configResponse = await fetch('/wiki-config.json');
      const config = await configResponse.json();
      const owner = config.wiki.repository.owner;
      const repo = config.wiki.repository.repo;

      // Serialize the loadout (only store IDs)
      const serializedLoadout = serializeLoadout(currentLoadout);

      // Save build and get checksum
      const checksum = await saveBuild(owner, repo, 'battle-loadouts', serializedLoadout);

      // Generate share URL
      const baseURL = window.location.origin + window.location.pathname;
      const shareURL = generateShareUrl(baseURL, 'battle-loadouts', checksum);

      console.log('[BattleLoadouts] ✓ Share URL generated:', shareURL);

      // Copy to clipboard
      await navigator.clipboard.writeText(shareURL);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[BattleLoadouts] Failed to generate share URL:', error);
      setShareError(error.message || 'Failed to generate share URL');

      // Fallback to old method if share service fails
      try {
        const serializedLoadout = serializeLoadout(currentLoadout);

        const encoded = encodeLoadout(serializedLoadout);
        if (encoded) {
          const baseURL = window.location.origin + window.location.pathname;
          const shareURL = `${baseURL}#/battle-loadouts?data=${encoded}`;

          await navigator.clipboard.writeText(shareURL);

          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          console.log('[BattleLoadouts] ⚠️ Used fallback encoding method');
        } else {
          alert('Failed to generate share URL');
        }
      } catch (fallbackError) {
        console.error('[BattleLoadouts] Fallback also failed:', fallbackError);
        alert('Failed to generate share URL');
      }
    } finally {
      setSharing(false);
    }
  };

  // Export loadout as JSON
  const handleExportLoadout = () => {
    const data = {
      ...currentLoadout,
      exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${loadoutName.replace(/\s+/g, '_').toLowerCase()}_loadout.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  // Import loadout from JSON
  const handleImportLoadout = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check for unsaved changes before importing
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Importing a loadout will discard your current changes. Continue?'
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
        const data = JSON.parse(e.target.result);

        // Deserialize skill build and spirit build
        const deserializedLoadout = {
          ...data,
          skillBuild: data.skillBuild ? deserializeSkillBuild(data.skillBuild, skills) : null,
          spiritBuild: data.spiritBuild ? deserializeSpiritBuild(data.spiritBuild, spirits) : null
        };

        setCurrentLoadout(deserializedLoadout);
        setLoadoutName(deserializedLoadout.name || '');
        setHasUnsavedChanges(false); // Imported from file, no unsaved changes yet
      } catch (error) {
        console.error('Failed to import loadout:', error);
        alert('Failed to import loadout. Invalid file format.');
      }
    };
    reader.readAsText(file);

    // Reset file input for next import
    event.target.value = '';
  };

  // Clear loadout
  const handleClearLoadout = () => {
    if (!confirm('Clear current loadout? This cannot be undone.')) return;
    setCurrentLoadout(createEmptyLoadout(loadoutName));
    clearDraft(); // Clear localStorage draft
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Battle Loadouts</h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Configure your battle settings with skills, spirits, skill stones, and more.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative">
        <div className={`max-w-7xl mx-auto px-3 sm:px-4 pt-6 pb-6 ${isAuthenticated ? 'pb-24' : ''}`}>

        {/* Saved Loadouts Panel */}
        <SavedLoadoutsPanel
          key={refreshTrigger}
          currentLoadout={currentLoadout}
          onLoadLoadout={handleLoadLoadout}
          currentLoadedLoadoutId={currentLoadedLoadoutId}
          onLoadoutsChange={setSavedLoadouts}
          externalLoadouts={savedLoadouts}
        />

        {/* Loadout Name Panel */}
        <div className={`bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm transition-all ${highlightNameField ? 'ring-4 ring-red-500 ring-opacity-50' : ''}`}>
          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap pt-2">Loadout Name:</label>
            <div className="flex-1">
              <ValidatedInput
                value={loadoutName}
                onChange={(e) => setLoadoutName(e.target.value)}
                validator={validateBuildName}
                placeholder="Enter loadout name..."
                maxLength={STRING_LIMITS.BUILD_NAME_MAX}
                required={isAuthenticated}
                showCounter={true}
                validateOnBlur={false}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleShareLoadout}
              disabled={sharing}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sharing ? (
                <>
                  <Loader className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400 animate-spin" />
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
              onClick={handleExportLoadout}
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
                onChange={handleImportLoadout}
                className="hidden"
              />
            </label>

            <button
              onClick={handleClearLoadout}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
            </button>
          </div>
        </div>

        {/* Skills Section */}
        <SkillsSection
          skillBuild={currentLoadout.skillBuild}
          onEdit={() => setShowSkillBuilder(true)}
          onClear={handleClearSkillBuild}
          onSkillClick={(skill) => {
            setSelectedSkill(skill);
            setShowSkillInfo(true);
          }}
          onDragStart={handleSkillDragStart}
          onDragOver={handleSkillDragOver}
          onDrop={handleSkillDrop}
          draggedSlotIndex={draggedSkillSlotIndex}
        />

        {/* Two Column Layout for Other Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:auto-rows-min">
          {/* Spirits Section - Row 1, Col 1 */}
          <SpiritsSection
            spiritBuild={currentLoadout.spiritBuild}
            onEdit={() => setShowSpiritBuilder(true)}
            onClear={handleClearSpiritBuild}
            onRemoveSpirit={handleRemoveSpirit}
            onDragStart={handleSpiritDragStart}
            onDragOver={handleSpiritDragOver}
            onDrop={handleSpiritDrop}
            draggedSlotIndex={draggedSpiritSlotIndex}
          />

          {/* Skill Stones - Row 1, Col 2 */}
          <PlaceholderSection
            title="Skill Stones"
            description="Skill Stone Builder coming soon"
            icon="💎"
            matchHeight={true}
          />

          {/* Promotion Abilities - Row 2, Col 1 */}
          <PlaceholderSection
            title="Slayer Promotion Abilities"
            description="Promotion Ability Builder coming soon"
            icon="⭐"
          />

          {/* Familiar - Row 2, Col 2 */}
          <PlaceholderSection
            title="Familiar"
            description="Familiar Builder coming soon"
            icon="🐾"
          />
        </div>
        </div>

        {/* Sticky Footer with Save Button */}
        {isAuthenticated && (
          <div className="sticky bottom-0 left-0 right-0 z-40 mt-6">
            <div className="max-w-7xl mx-auto px-3 sm:px-4">
              <div className="bg-white dark:bg-gray-900 rounded-t-lg border border-gray-200 dark:border-gray-700 border-b-0 shadow-2xl py-3">
                <div className="flex flex-col items-center gap-2">
                  {/* Error Message */}
                  {saveError && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                      {saveError}
                    </div>
                  )}

                  {/* Save Button with Unsaved Changes Indicator */}
                  <div className="flex items-center gap-3">
                    {/* Unsaved Changes Indicator */}
                    {hasUnsavedChanges && (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="hidden sm:inline text-sm">Unsaved changes</span>
                      </div>
                    )}

                    {/* Save Button */}
                    <button
                      onClick={handleSaveLoadout}
                      disabled={saving || saveSuccess}
                      className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-base font-semibold transition-colors shadow-lg"
                    >
                      {saving ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin flex-shrink-0" />
                          <span>Saving...</span>
                        </>
                      ) : saveSuccess ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                          <span>Saved!</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5 flex-shrink-0" />
                          <span>Save Loadout</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Skill Builder Modal */}
      <SkillBuilderModal
        isOpen={showSkillBuilder}
        onClose={() => setShowSkillBuilder(false)}
        initialBuild={currentLoadout.skillBuild}
        onSave={handleSkillBuildSave}
      />

      {/* Spirit Builder Modal */}
      <SpiritBuilderModal
        isOpen={showSpiritBuilder}
        onClose={() => setShowSpiritBuilder(false)}
        initialBuild={currentLoadout.spiritBuild}
        onSave={handleSpiritBuildSave}
      />

      {/* Skill Information Modal */}
      <SkillInformation
        skill={selectedSkill}
        isOpen={showSkillInfo}
        onClose={() => {
          setShowSkillInfo(false);
          setSelectedSkill(null);
        }}
      />
    </div>
  );
};

/**
 * Skills Section Component
 */
const SkillsSection = ({ skillBuild, onEdit, onClear, onSkillClick, onDragStart, onDragOver, onDrop, draggedSlotIndex }) => {
  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the skill build? This cannot be undone.')) {
      onClear();
    }
  };

  return (
    <div style={{ paddingBottom: '2.5rem' }} className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Skills to use</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors"
          >
            <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{skillBuild ? 'Edit' : 'Create'}</span>
          </button>
          {skillBuild && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      </div>

      {skillBuild ? (
        <div>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 sm:mb-3 md:mb-4">
            Build: <span className="text-gray-900 dark:text-white font-medium">{skillBuild.name}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4 justify-items-center">
            {skillBuild.slots.slice(0, 10).map((slot, index) => (
              <SkillSlot
                key={index}
                skill={slot.skill}
                level={slot.level}
                isLocked={false}
                slotNumber={index + 1}
                slotIndex={index}
                onSelectSkill={onEdit}
                onRemoveSkill={() => {}}
                onLevelChange={() => {}}
                readOnly={true}
                onSkillClick={onSkillClick}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                isDragging={draggedSlotIndex === index}
              />
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={onEdit}
          className="w-full flex items-center justify-center py-8 sm:py-10 md:py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
        >
          <div className="text-center px-2">
            <Plus className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">No skill build configured</p>
            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">Click here or "Create" to get started</p>
          </div>
        </button>
      )}
    </div>
  );
};

/**
 * Spirits Section Component
 */
const SpiritsSection = ({ spiritBuild, onEdit, onClear, onRemoveSpirit, onDragStart, onDragOver, onDrop, draggedSlotIndex }) => {
  // Check if spirit build has any spirits configured
  const hasAnySpirits = spiritBuild && spiritBuild.slots.some(slot => slot.spirit !== null);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the spirit build? This cannot be undone.')) {
      onClear();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 md:p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-2xl sm:text-3xl">🔮</span>
          <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Spirits</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors"
          >
            <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{hasAnySpirits ? 'Edit' : 'Create'}</span>
          </button>
          {hasAnySpirits && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      </div>

      {spiritBuild ? (
        <div>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 sm:mb-3 md:mb-4">
            Build: <span className="text-gray-900 dark:text-white font-medium">{spiritBuild.name}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-4 lg:gap-6">
            {spiritBuild.slots.slice(0, 3).map((slot, index) => (
              <div
                key={index}
                className={`flex justify-center transition-opacity ${draggedSlotIndex === index ? 'opacity-50' : ''}`}
                draggable={slot.spirit !== null}
                onDragStart={(e) => slot.spirit && onDragStart?.(e, index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  onDragOver?.(e, index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop?.(e, index);
                }}
              >
                {slot.spirit ? (
                  <div className="relative group">
                    {/* Mobile X Button - Bottom Center */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSpirit(index);
                      }}
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors lg:hidden"
                      aria-label="Remove spirit"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Spirit Card */}
                    <button
                      onClick={onEdit}
                      className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-1.5 sm:p-2 md:p-3 border border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors cursor-pointer relative"
                    >
                      <div className="scale-75 sm:scale-90 md:scale-100 origin-center">
                        <SpiritComponent
                          spirit={slot.spirit}
                          level={slot.level}
                          awakeningLevel={slot.awakeningLevel || 0}
                          evolutionLevel={slot.evolutionLevel}
                          skillEnhancementLevel={slot.skillEnhancementLevel}
                          showLevelOverlays={true}
                          showPlatform={true}
                          showEnhancementLevel={true}
                          showElementIcon={true}
                          size="medium"
                        />
                      </div>

                      {/* Drag Indicator Overlay */}
                      <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/20 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                        <div className="bg-gray-900/50 rounded-lg p-2">
                          <Move className="w-5 h-5 sm:w-6 sm:h-6 text-white/70" />
                        </div>
                      </div>
                    </button>

                    {/* Desktop Remove Button - Bottom (hover only) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSpirit(index);
                      }}
                      className="hidden lg:flex absolute bottom-0 left-0 right-0 bg-red-600/90 hover:bg-red-600 text-white py-2 rounded-b-lg items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium"
                      aria-label="Remove spirit"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onEdit}
                    className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-1.5 sm:p-2 md:p-3 border border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors group"
                  >
                    <div className="scale-75 sm:scale-90 md:scale-100 origin-center">
                      <div className="w-24 h-28 sm:w-28 sm:h-32 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg group-hover:border-blue-500 transition-colors">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-10 h-10 rounded-full border-2 border-gray-400 dark:border-gray-500 flex items-center justify-center group-hover:border-blue-500 transition-colors">
                            <Plus className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
                          </div>
                          <span className="text-gray-600 dark:text-gray-500 text-xs group-hover:text-blue-400 transition-colors">Add Spirit</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={onEdit}
          className="w-full flex items-center justify-center py-8 sm:py-10 md:py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
        >
          <div className="text-center px-2">
            <Plus className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">No spirit build configured</p>
            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">Click here or "Create" to get started</p>
          </div>
        </button>
      )}
    </div>
  );
};

/**
 * Placeholder Section Component
 */
const PlaceholderSection = ({ title, description, icon, matchHeight = false }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 md:p-6 opacity-60 border border-gray-200 dark:border-gray-800 ${matchHeight ? 'flex flex-col h-full' : ''}`}>
      <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
        <span className="text-2xl sm:text-3xl">{icon}</span>
        <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{title}</span>
      </div>
      <div className={`flex items-center justify-center ${matchHeight ? 'flex-1' : 'py-8 sm:py-10 md:py-12'} border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg`}>
        <div className="text-center px-2">
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base md:text-lg">{description}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Create empty loadout helper
 */
function createEmptyLoadout(name) {
  return {
    name,
    skillBuild: null,
    spiritBuild: null,
    spirit: null,
    skillStone: null,
    promotionAbility: null,
    familiar: null
  };
}

export default BattleLoadouts;



