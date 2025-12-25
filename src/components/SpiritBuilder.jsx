import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Share2, Download, Upload, Trash2, Check, Save, Loader, CheckCircle2 } from 'lucide-react';
import SpiritSlot from './SpiritSlot';
import SpiritSelector from './SpiritSelector';
import SavedSpiritBuildsPanel from './SavedSpiritBuildsPanel';
import SavedSpiritsGallery from './SavedSpiritsGallery';
import ValidatedInput from './ValidatedInput';
import { encodeBuild, decodeBuild } from '../../wiki-framework/src/components/wiki/BuildEncoder';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { useConfigStore } from '../../wiki-framework/src/store/configStore';
import { setCache } from '../utils/buildCache';
import { saveBuild as saveSharedBuild, loadBuild as loadSharedBuild, generateShareUrl } from '../../wiki-framework/src/services/github/buildShare';
import { useDraftStorage } from '../../wiki-framework/src/hooks/useDraftStorage';
import { getSaveDataEndpoint, getLoadDataEndpoint } from '../utils/apiEndpoints.js';
import { serializeBuild, deserializeBuild, serializeBuildForSharing } from '../utils/spiritSerialization';
import { validateBuildName, STRING_LIMITS } from '../utils/validation';
import { createLogger } from '../utils/logger';
import { queueAchievementCheck } from '../../wiki-framework/src/services/achievements/achievementQueue.js';

const logger = createLogger('SpiritBuilder');

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
  const { config } = useConfigStore();
  const [spirits, setSpirits] = useState([]);
  const [mySpirits, setMySpirits] = useState([]);
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
  const [savedBuilds, setSavedBuilds] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [mySpiritsLoaded, setMySpiritsLoaded] = useState(false);

  // Serialize build for draft storage (preserve type and mySpiritId)
  const serializedDraft = useMemo(() => {
    const serialized = serializeBuild(build);
    logger.debug('Serializing draft for storage', {
      slots: serialized?.slots?.map(s => ({
        type: s.type,
        mySpiritId: s.mySpiritId,
        spiritId: s.spiritId,
        hasSpirit: !!s.spiritId || !!s.mySpiritId
      }))
    });
    return {
      buildName,
      build: serialized
    };
  }, [buildName, build]);

  // Draft storage hook for auto-save/restore
  const { loadDraft, clearDraft } = useDraftStorage(
    'spiritBuilder',
    user,
    isModal,
    serializedDraft
  );

  // Load spirits data
  useEffect(() => {
    loadSpirits();
  }, []);

  // Load my-spirits collection when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadMySpirits();
    } else {
      // Not authenticated, no need to wait for mySpirits
      setMySpiritsLoaded(true);
    }
  }, [isAuthenticated, user?.id]);

  // Load build from URL after spirits are loaded (only in page mode)
  useEffect(() => {
    if (spirits.length === 0) return; // Wait for spirits to load
    if (isModal) return; // Skip URL loading in modal mode
    if (hasLoadedInitialData) return; // Already loaded, don't reload

    // If authenticated, wait for mySpirits to finish loading before deserializing
    // (needed to resolve collection spirit references)
    if (isAuthenticated && user?.id && !mySpiritsLoaded) {
      logger.debug('Waiting for mySpirits to load before deserializing draft');
      return;
    }

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

          if (buildData.type === 'spirit-builds') {
            const deserializedBuild = deserializeBuild(buildData.data, spirits, mySpirits);
            setBuildName(buildData.data.name || '');
            setBuild({ slots: normalizeSlots(deserializedBuild.slots) });
            setHasUnsavedChanges(true);
            setHasLoadedInitialData(true); // Mark as loaded
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

          const response = await fetch(`${getLoadDataEndpoint()}?type=spirit-builds&userId=${user.id}`);
          if (!response.ok) {
            throw new Error('Failed to load builds from server');
          }
          const data = await response.json();
          const builds = data.builds || [];

          const savedBuild = builds.find(b => b.id === buildId);
          if (savedBuild) {
            const deserializedBuild = deserializeBuild(savedBuild, spirits, mySpirits);
            setBuildName(savedBuild.name || '');
            setBuild({ slots: normalizeSlots(deserializedBuild.slots) });
            setCurrentLoadedBuildId(buildId);
            setHasUnsavedChanges(false);
            setHasLoadedInitialData(true);
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

          // Deserialize build (convert spirit IDs back to full spirit objects)
          const deserializedBuild = deserializeBuild(decodedBuild, spirits, mySpirits);
          setBuild({ slots: normalizeSlots(deserializedBuild.slots) });
          setHasUnsavedChanges(true); // Mark as having changes to block navigation
          setHasLoadedInitialData(true); // Mark as loaded
        }
      } catch (error) {
        logger.error('Failed to load build from URL', { error });
      }
    }
    // Load from localStorage if no URL params
    else {
      const draft = loadDraft();
      if (draft) {
        logger.info('Loading draft from localStorage', {
          buildName: draft.buildName,
          hasSlots: draft.build?.slots?.length > 0,
          mySpiritsCount: mySpirits.length,
          draftSlots: draft.build?.slots?.map(s => ({
            type: s.type,
            mySpiritId: s.mySpiritId,
            spiritId: s.spiritId
          }))
        });
        setBuildName(draft.buildName || '');

        // Deserialize build to ensure spirit objects are current
        const deserializedBuild = deserializeBuild(draft.build, spirits, mySpirits);
        logger.info('Draft deserialized', {
          deserializedSlots: deserializedBuild.slots?.map(s => ({
            type: s.type,
            mySpiritId: s.mySpiritId,
            spiritName: s.spirit?.name,
            missing: s.missing
          }))
        });
        setBuild({ slots: normalizeSlots(deserializedBuild.slots) });
        setHasUnsavedChanges(true);
        setHasLoadedInitialData(true); // Mark as loaded
        logger.info('Draft loaded successfully');
      } else {
        logger.debug('No draft found in localStorage');
        // No draft found, mark as loaded so we don't keep checking
        setHasLoadedInitialData(true);
      }
    }
  }, [spirits, mySpiritsLoaded, isAuthenticated, user?.id, isModal, loadDraft]);

  // Load initial build in modal mode
  useEffect(() => {
    if (spirits.length === 0) return; // Wait for spirits to load
    if (!isModal || !initialBuild) return; // Only in modal mode with initial data

    // If authenticated, wait for mySpirits to load before deserializing
    // (needed to resolve collection spirit references)
    if (isAuthenticated && user?.id && !mySpiritsLoaded) {
      logger.debug('Waiting for mySpirits to load before deserializing initial build in modal');
      return;
    }

    logger.debug('Loading initial build in modal', {
      buildName: initialBuild.name,
      buildId: initialBuild.id,
      mySpiritsCount: mySpirits.length
    });

    setBuildName(initialBuild.name || 'My Spirit Build');

    // Deserialize build to ensure spirit objects are current
    const deserializedBuild = deserializeBuild(initialBuild, spirits, mySpirits);
    setBuild({ slots: normalizeSlots(deserializedBuild.slots) });
    setHasUnsavedChanges(true); // Mark as having changes to block navigation
  }, [spirits, isModal, initialBuild, mySpiritsLoaded, isAuthenticated, user?.id]);
  // NOTE: mySpirits is intentionally NOT in dependencies to prevent re-deserializing
  // when collection spirits are updated, which would overwrite user's current changes

  const loadSpirits = async () => {
    try {
      const response = await fetch('/data/spirit-characters.json');
      const data = await response.json();
      setSpirits(data.spirits);
    } catch (error) {
      logger.error('Failed to load spirits', { error });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Normalize slots to ensure all 3 slots exist with proper structure
   */
  const normalizeSlots = (slots) => {
    const emptySlot = {
      type: 'base',
      spirit: null,
      level: 1,
      awakeningLevel: 0,
      evolutionLevel: 4,
      skillEnhancementLevel: 0
    };

    return Array(3).fill(null).map((_, index) => {
      const slot = slots?.[index];
      // If slot is undefined, null, or missing required properties, use empty slot
      if (!slot || slot.spirit === undefined) {
        return { ...emptySlot };
      }
      return slot;
    });
  };

  /**
   * Load user's my-spirits collection
   */
  const loadMySpirits = async () => {
    if (!user?.id) {
      logger.debug('No user ID, skipping my-spirits load');
      setMySpiritsLoaded(true);
      return;
    }

    try {
      const endpoint = `${getLoadDataEndpoint()}?type=my-spirits&userId=${user.id}`;
      logger.info('Loading my-spirits collection', { userId: user.id, endpoint });
      const response = await fetch(endpoint);

      logger.info('My-spirits response received', {
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type')
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('My-spirits HTTP error', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      logger.info('My-spirits data parsed', {
        dataType: typeof data,
        hasSpirits: !!data.spirits,
        isArray: Array.isArray(data),
        keys: Object.keys(data || {})
      });

      // API returns { spirits: [...] }, extract the array
      const spiritsArray = data.spirits || data || [];
      setMySpirits(Array.isArray(spiritsArray) ? spiritsArray : []);
      setMySpiritsLoaded(true); // Mark as loaded even if empty
      logger.info('Loaded my-spirits collection successfully', {
        count: spiritsArray?.length || 0,
        spiritIds: spiritsArray?.map(s => s.id).slice(0, 5) // First 5 IDs
      });
    } catch (error) {
      logger.error('Failed to load my-spirits collection', {
        error: error,
        errorMessage: error?.message,
        errorStack: error?.stack
      });
      setMySpirits([]); // Set empty array on error
      setMySpiritsLoaded(true); // Mark as loaded even on error
    }
  };

  /**
   * Wrapper for serializeBuild that includes build name
   */
  const serializeBuildWithName = (buildToSerialize) => {
    const serialized = serializeBuild(buildToSerialize);
    return {
      ...serialized,
      name: buildToSerialize.name || buildName,
    };
  };

  /**
   * Compare current build with a saved build to check if they match
   */
  const buildsMatch = (savedBuild) => {
    if (!savedBuild) {
      logger.debug('buildsMatch: savedBuild is null/undefined');
      return false;
    }

    // Check name
    if (savedBuild.name !== buildName) {
      logger.debug('buildsMatch: name mismatch', { savedName: savedBuild.name, currentName: buildName });
      return false;
    }

    // Deserialize and normalize saved build if it's in serialized format
    // This ensures both builds have the same structure (3 slots) for comparison
    let normalizedSavedBuild = savedBuild;
    const isSerializedBuild = savedBuild.slots?.some(s => s && (s.spiritId !== undefined || s.mySpiritId) && !s.spirit);
    if (isSerializedBuild) {
      // Deserialize first
      const deserialized = deserializeBuild(savedBuild, spirits, mySpirits);
      // Then normalize to 3 slots
      normalizedSavedBuild = { ...deserialized, slots: normalizeSlots(deserialized.slots) };
    }

    logger.debug('buildsMatch: before serialization', {
      savedBuildId: savedBuild.id,
      originalSlotCount: savedBuild.slots?.length,
      normalizedSlotCount: normalizedSavedBuild.slots?.length,
      normalizedSlots: normalizedSavedBuild.slots?.map(s => ({ type: s.type, mySpiritId: s.mySpiritId, spiritId: s.spirit?.id }))
    });

    // Serialize both for consistent comparison (handles both serialized and deserialized formats)
    const currentSerialized = serializeBuildWithName(build);
    const savedSerialized = serializeBuildWithName(normalizedSavedBuild);

    logger.debug('buildsMatch: comparing builds', {
      savedBuildId: savedBuild.id,
      currentSlots: currentSerialized.slots,
      savedSlots: savedSerialized.slots
    });

    // Compare serialized slots
    if (currentSerialized.slots.length !== savedSerialized.slots.length) {
      logger.debug('buildsMatch: slot length mismatch');
      return false;
    }

    for (let i = 0; i < currentSerialized.slots.length; i++) {
      const currentSlot = currentSerialized.slots[i];
      const savedSlot = savedSerialized.slots[i];

      // Compare type (collection vs base)
      if (currentSlot.type !== savedSlot.type) {
        logger.debug(`buildsMatch: slot ${i} type mismatch`, { current: currentSlot.type, saved: savedSlot.type });
        return false;
      }

      // For collection spirits, compare mySpiritId
      if (currentSlot.type === 'collection') {
        if (currentSlot.mySpiritId !== savedSlot.mySpiritId) {
          logger.debug(`buildsMatch: slot ${i} mySpiritId mismatch`, { current: currentSlot.mySpiritId, saved: savedSlot.mySpiritId });
          return false;
        }
        // Collection spirits don't need level/awakening comparison since those are stored in my-spirits
        continue;
      }

      // For base spirits, compare spiritId and stats
      if (currentSlot.spiritId !== savedSlot.spiritId) {
        logger.debug(`buildsMatch: slot ${i} spiritId mismatch`, { current: currentSlot.spiritId, saved: savedSlot.spiritId });
        return false;
      }
      if (currentSlot.level !== savedSlot.level) {
        logger.debug(`buildsMatch: slot ${i} level mismatch`, { current: currentSlot.level, saved: savedSlot.level });
        return false;
      }
      if (currentSlot.awakeningLevel !== savedSlot.awakeningLevel) {
        logger.debug(`buildsMatch: slot ${i} awakeningLevel mismatch`, { current: currentSlot.awakeningLevel, saved: savedSlot.awakeningLevel });
        return false;
      }
      if (currentSlot.evolutionLevel !== savedSlot.evolutionLevel) {
        logger.debug(`buildsMatch: slot ${i} evolutionLevel mismatch`, { current: currentSlot.evolutionLevel, saved: savedSlot.evolutionLevel });
        return false;
      }
      if (currentSlot.skillEnhancementLevel !== savedSlot.skillEnhancementLevel) {
        logger.debug(`buildsMatch: slot ${i} skillEnhancementLevel mismatch`, { current: currentSlot.skillEnhancementLevel, saved: savedSlot.skillEnhancementLevel });
        return false;
      }
    }

    logger.debug('buildsMatch: MATCH FOUND for build', { buildId: savedBuild.id });
    return true;
  };

  /**
   * Check if current build matches any saved build and update highlighting
   */
  useEffect(() => {
    logger.debug('useEffect: checking for build match', {
      buildName,
      hasUnsavedChanges,
      savedBuildsCount: savedBuilds?.length || 0,
      currentLoadedBuildId
    });

    const hasContent = buildName.trim() !== '' || build.slots.some(slot => slot.spirit !== null);

    if (!isAuthenticated || !savedBuilds || savedBuilds.length === 0) {
      logger.debug('useEffect: early return - no saved builds or not authenticated');
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
    logger.debug('useEffect: searching for matching build', { count: savedBuilds.length });
    const matchingBuild = savedBuilds.find(savedBuild => buildsMatch(savedBuild));

    if (matchingBuild) {
      logger.debug('useEffect: MATCH FOUND', { buildId: matchingBuild.id });
      setCurrentLoadedBuildId(matchingBuild.id);
    } else {
      logger.debug('useEffect: NO MATCH - setting currentLoadedBuildId to null');
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
      type: 'base',  // Spirits from selector are base spirits
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

    // Check if this is a collection spirit
    if (savedSpirit.type === 'collection' && savedSpirit.mySpiritId) {
      // Collection spirit - keep reference
      newSlots[targetSlotIndex] = {
        type: 'collection',
        mySpiritId: savedSpirit.mySpiritId,
        spirit: savedSpirit.spirit,
        level: savedSpirit.level,
        awakeningLevel: savedSpirit.awakeningLevel,
        evolutionLevel: savedSpirit.evolutionLevel,
        skillEnhancementLevel: savedSpirit.skillEnhancementLevel
      };
    } else {
      // Base spirit - snapshot (shouldn't happen from gallery but handle it)
      newSlots[targetSlotIndex] = {
        type: 'base',
        spirit: savedSpirit.spirit,
        level: savedSpirit.level,
        awakeningLevel: savedSpirit.awakeningLevel,
        evolutionLevel: savedSpirit.evolutionLevel,
        skillEnhancementLevel: savedSpirit.skillEnhancementLevel
      };
    }

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

  /**
   * Save a base spirit to the my-spirits collection
   */
  const handleSaveToCollection = async (slotIndex) => {
    console.log('[SpiritBuilder] handleSaveToCollection called', { slotIndex, isAuthenticated, hasUser: !!user });

    if (!isAuthenticated || !user) {
      alert('Please sign in to save spirits to your collection.');
      return;
    }

    const slot = build.slots[slotIndex];
    console.log('[SpiritBuilder] Slot data', { slot, hasSpirit: !!slot?.spirit, type: slot?.type });

    if (!slot || !slot.spirit || slot.type === 'collection') {
      console.log('[SpiritBuilder] Skipping save - invalid slot or already collection');
      return; // Nothing to save or already a collection spirit
    }

    try {
      console.log('[SpiritBuilder] Starting save process');
      logger.info('Saving base spirit to collection', {
        spiritId: slot.spirit.id,
        level: slot.level
      });

      // Prepare spirit data for saving
      const spiritData = {
        spiritId: slot.spirit.id,
        level: slot.level,
        awakeningLevel: slot.awakeningLevel,
        evolutionLevel: slot.evolutionLevel,
        skillEnhancementLevel: slot.skillEnhancementLevel
      };

      // Save to my-spirits collection
      const endpoint = getSaveDataEndpoint();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'my-spirits',
          username: user.login, // GitHub user object uses 'login' not 'username'
          userId: user.id,
          data: spiritData
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Save failed', { status: response.status, errorText });
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log('[SpiritBuilder] Got save response', { responseData });
      logger.debug('Save response', { responseData });

      // The response should contain the saved spirits array
      // Find the newly saved spirit (it should be the one matching our spiritId)
      const savedSpirits = Array.isArray(responseData) ? responseData : (responseData.spirits || []);
      const savedSpirit = savedSpirits.find(s => s.spiritId === spiritData.spiritId && s.level === spiritData.level);

      if (!savedSpirit || !savedSpirit.id) {
        // If we can't find it, just reload and use the most recent one
        console.log('[SpiritBuilder] Could not find saved spirit, reloading collection');
        await loadMySpirits();
        logger.warn('Could not find saved spirit in response, reloaded collection');
        alert(`${slot.spirit.name} has been saved to your spirit collection!`);

        // Queue achievements even on this path
        console.log('[SpiritBuilder] [EARLY EXIT PATH] About to queue achievements');
        if (user?.id && user?.login && config?.wiki?.repository) {
          console.log('[SpiritBuilder] [EARLY EXIT PATH] Conditions met, queueing');
          const spiritAchievements = ['spirit-collector', 'collector'];
          spiritAchievements.forEach(achievementId => {
            queueAchievementCheck(achievementId, {
              owner: config.wiki.repository.owner,
              repo: config.wiki.repository.repo,
              userId: user.id,
              username: user.login,
              delay: 2000,
              retryDelay: 5000,
              maxRetries: 3,
            }).catch(error => {
              logger.error(`Failed to queue ${achievementId} achievement check`, { error: error.message });
            });
          });
        } else {
          console.log('[SpiritBuilder] [EARLY EXIT PATH] Conditions NOT met', {
            hasUserId: !!user?.id,
            hasUsername: !!user?.login,
            hasConfig: !!config,
            hasRepository: !!config?.wiki?.repository
          });
        }

        return;
      }

      logger.info('Spirit saved to collection successfully', {
        mySpiritId: savedSpirit.id
      });

      // Reload my-spirits collection
      await loadMySpirits();

      // Update the slot to reference the newly saved spirit
      const newSlots = [...build.slots];
      newSlots[slotIndex] = {
        ...slot,
        type: 'collection',
        mySpiritId: savedSpirit.id
      };
      setBuild({ slots: newSlots });
      setHasUnsavedChanges(true); // Mark as having changes (draft auto-save will handle persistence)

      alert(`${slot.spirit.name} has been saved to your spirit collection!`);

      // Queue spirit collection achievement checks
      console.log('[SpiritBuilder] Checking achievement queue conditions', {
        hasUserId: !!user?.id,
        hasUsername: !!user?.login,
        hasConfig: !!config,
        hasRepository: !!config?.wiki?.repository,
        userId: user?.id,
        username: user?.login,
        config: config
      });

      if (user?.id && user?.login && config?.wiki?.repository) {
        const spiritAchievements = [
          'spirit-collector',  // 10 different spirits
          'collector',         // All spirit types
        ];

        logger.info('Queueing spirit achievement checks', { userId: user.id, username: user.login, count: spiritAchievements.length });

        spiritAchievements.forEach(achievementId => {
          queueAchievementCheck(achievementId, {
            owner: config.wiki.repository.owner,
            repo: config.wiki.repository.repo,
            userId: user.id,
            username: user.login,
            delay: 2000, // Wait 2 seconds for GitHub Issues to sync
            retryDelay: 5000,
            maxRetries: 3,
          }).catch(error => {
            logger.error(`Failed to queue ${achievementId} achievement check`, { error: error.message });
          });
        });
      }
    } catch (error) {
      logger.error('Failed to save spirit to collection', { error });
      alert('Failed to save spirit to collection. Please try again.');
    }
  };

  /**
   * Update collection spirit in the backend when stats change
   */
  const updateCollectionSpirit = async (slot) => {
    if (!slot.mySpiritId || slot.type !== 'collection') return;

    try {
      const spiritData = {
        spiritId: slot.spirit.id,
        level: slot.level,
        awakeningLevel: slot.awakeningLevel,
        evolutionLevel: slot.evolutionLevel,
        skillEnhancementLevel: slot.skillEnhancementLevel
      };

      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'my-spirits',
          username: user.login,
          userId: user.id,
          data: spiritData,
          spiritId: slot.mySpiritId // Pass spiritId to update existing entry
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to update collection spirit', { status: response.status, errorText });
        throw new Error(`Failed to update collection spirit: ${response.status}`);
      }

      // Reload collection to get updated data
      await loadMySpirits();
      logger.debug('Collection spirit updated', { mySpiritId: slot.mySpiritId });
    } catch (error) {
      logger.error('Failed to update collection spirit', { error });
      // Don't show error to user, just log it - local changes still applied
    }
  };

  const handleLevelChange = async (index, newLevel) => {
    let updatedSlots;

    // Use functional setState to get the latest state
    setBuild(prevBuild => {
      const newSlots = [...prevBuild.slots];
      newSlots[index].level = newLevel;
      updatedSlots = newSlots;
      return { slots: newSlots };
    });

    // Update collection if this is a collection spirit
    if (updatedSlots[index].type === 'collection') {
      await updateCollectionSpirit(updatedSlots[index]);
    }
  };

  const handleAwakeningLevelChange = async (index, newAwakeningLevel) => {
    let updatedSlots;

    // Use functional setState to get the latest state
    setBuild(prevBuild => {
      const newSlots = [...prevBuild.slots];
      newSlots[index].awakeningLevel = newAwakeningLevel;
      updatedSlots = newSlots; // Capture for collection update
      return { slots: newSlots };
    });

    // Update collection if this is a collection spirit
    if (updatedSlots[index].type === 'collection') {
      await updateCollectionSpirit(updatedSlots[index]);
    }
  };

  const handleEvolutionChange = async (index, newEvolution) => {
    let updatedSlots;

    // Use functional setState to get the latest state
    setBuild(prevBuild => {
      const newSlots = [...prevBuild.slots];
      newSlots[index].evolutionLevel = newEvolution;
      updatedSlots = newSlots;
      return { slots: newSlots };
    });

    // Update collection if this is a collection spirit
    if (updatedSlots[index].type === 'collection') {
      await updateCollectionSpirit(updatedSlots[index]);
    }
  };

  const handleSkillEnhancementChange = async (index, newSkillEnhancement) => {
    let updatedSlots;

    // Use functional setState to get the latest state
    setBuild(prevBuild => {
      const newSlots = [...prevBuild.slots];
      newSlots[index].skillEnhancementLevel = newSkillEnhancement;
      updatedSlots = newSlots;
      return { slots: newSlots };
    });

    // Update collection if this is a collection spirit
    if (updatedSlots[index].type === 'collection') {
      await updateCollectionSpirit(updatedSlots[index]);
    }
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
          logger.debug('Dropped saved spirit', { name: spirit.spirit.name });

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

          // Check if this is a collection spirit
          if (spirit.type === 'collection' && spirit.mySpiritId) {
            // Collection spirit - keep reference
            newSlots[targetIndex] = {
              type: 'collection',
              mySpiritId: spirit.mySpiritId,
              spirit: spirit.spirit,
              level: spirit.level,
              awakeningLevel: spirit.awakeningLevel,
              evolutionLevel: spirit.evolutionLevel,
              skillEnhancementLevel: spirit.skillEnhancementLevel
            };
          } else {
            // Base spirit - snapshot
            newSlots[targetIndex] = {
              type: 'base',
              spirit: spirit.spirit,
              level: spirit.level,
              awakeningLevel: spirit.awakeningLevel,
              evolutionLevel: spirit.evolutionLevel,
              skillEnhancementLevel: spirit.skillEnhancementLevel
            };
          }

          setBuild({ slots: newSlots });
          setDraggedSlotIndex(null);
          return;
        }
      } catch (error) {
        logger.error('Failed to parse drag data', { error });
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

    // Save immediately if in modal mode and build has an ID (already saved)
    if (isModal && initialBuild?.id && buildName && isAuthenticated && user) {
      logger.info('Saving after drag reorder', { buildId: initialBuild.id });

      (async () => {
        try {
          const serializedBuild = serializeBuild({ slots: newSlots });
          serializedBuild.name = buildName;

          await fetch(getSaveDataEndpoint(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'spirit-builds',
              username: user.login,
              userId: user.id,
              data: serializedBuild,
            }),
          });

          logger.info('Saved after drag', { buildId: initialBuild.id });
        } catch (error) {
          logger.error('Failed to save after drag', { error });
        }
      })();
    }
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

      // Serialize build for sharing (convert collection spirits to base format)
      const serializedBuild = serializeBuildForSharing(build);
      const buildData = {
        name: buildName,
        slots: serializedBuild.slots
      };

      // Save build and get checksum
      const checksum = await saveSharedBuild(owner, repo, 'spirit-builds', buildData);

      logger.debug('Generated checksum', { checksum });

      // Generate share URL
      const baseURL = window.location.origin + window.location.pathname;
      const shareURL = generateShareUrl(baseURL, 'spirit-builds', checksum);

      await navigator.clipboard.writeText(shareURL);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      logger.info('Share URL copied to clipboard');

      // Trigger donation prompt on successful share
      window.triggerDonationPrompt?.({
        messages: [
          "Sharing your spirit squad? Love it! 👻",
          "That's a ghostly good team! 🔮",
          "Your spirit game is on point! ✨",
          "Spreading the spirit love! 💜",
        ]
      });
    } catch (error) {
      logger.error('Failed to generate share URL', { error });
      setShareError(error.message || 'Failed to generate share URL');

      // Fallback to old method if share service fails
      try {
        logger.warn('Falling back to old encoding method');
        const serializedBuild = serializeBuildForSharing(build);
        const encoded = encodeBuild(serializedBuild);
        if (encoded) {
          const baseURL = window.location.origin + window.location.pathname;
          const shareURL = `${baseURL}#/spirit-builder?data=${encoded}`;
          await navigator.clipboard.writeText(shareURL);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          logger.info('Fallback URL copied to clipboard');

          // Trigger donation prompt on successful share (fallback)
          window.triggerDonationPrompt?.({
            messages: [
              "Sharing your spirit squad? Love it! 👻",
              "That's a ghostly good team! 🔮",
              "Your spirit game is on point! ✨",
              "Spreading the spirit love! 💜",
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
    link.download = `${buildName.replace(/\s+/g, '_')}_spirit_build.json`;
    link.click();

    URL.revokeObjectURL(url);

    // Trigger donation prompt on successful export
    window.triggerDonationPrompt?.({
      messages: [
        "Backing up those spirits! Smart! 💾",
        "Spirit data secured! 🛡️",
        "Exporting spectral goodness! 👻",
        "Your spirits are safe now! 💫",
      ]
    });
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

        const deserializedBuild = deserializeBuild(buildData, spirits, mySpirits);
        setBuild({ slots: normalizeSlots(deserializedBuild.slots) });
        setHasUnsavedChanges(true);

        // Trigger donation prompt on successful import
        window.triggerDonationPrompt?.({
          messages: [
            "New spirits joining the squad! 👻",
            "Importing ghostly power! 🔮",
            "These spirits look promising! ✨",
            "Fresh spiritual energy incoming! 💫",
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

    // Check if build is already deserialized (has spirit objects vs spiritId/mySpiritId)
    const isAlreadyDeserialized = savedBuild.slots?.some(slot =>
      slot && typeof slot.spirit === 'object' && slot.spirit !== null
    );

    const deserializedBuild = isAlreadyDeserialized
      ? savedBuild // Already deserialized by SavedSpiritBuildsPanel
      : deserializeBuild(savedBuild, spirits, mySpirits); // Deserialize serialized data

    setBuild({ slots: normalizeSlots(deserializedBuild.slots) });
    setHasUnsavedChanges(false); // Loaded from saved, no changes yet
    setCurrentLoadedBuildId(savedBuild.id);

    // Trigger donation prompt on successful load
    window.triggerDonationPrompt?.({
      messages: [
        "Summoning old friends! 👻",
        "This squad was legendary! 🔮",
        "Ah yes, the classic lineup! ✨",
        "Bringing back the dream team! 💫",
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
      const serializedBuild = serializeBuildWithName(build);
      const buildData = {
        name: serializedBuild.name,
        slots: serializedBuild.slots, // Only store { spiritId, level, awakeningLevel, etc. }
      };

      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'spirit-builds',
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
      logger.debug('After save - sortedBuilds', { builds: sortedBuilds });
      logger.debug('Current buildName', { buildName });

      setSavedBuilds(sortedBuilds);
      setSaveSuccess(true);
      setHasUnsavedChanges(false);

      // Find the saved build ID (it's the one with the matching name)
      const savedBuild = sortedBuilds.find(b => b.name === buildName);
      logger.debug('Found saved build', { savedBuild });
      if (savedBuild) {
        logger.debug('Setting currentLoadedBuildId', { buildId: savedBuild.id });
        setCurrentLoadedBuildId(savedBuild.id);
      } else {
        logger.warn('Could not find saved build with name', { buildName });
      }

      // Cache the updated builds
      setCache('spirit_builds', user.id, sortedBuilds);

      // Clear localStorage draft after successful save
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Spirit Builder</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Build your spirit team with 1 companion and 2 partner spirits, each with customizable levels and upgrades.
            </p>
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
          savedBuilds={savedBuilds}
          mySpiritsFromParent={mySpirits}
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
              slot={build.slots[0]}
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
              onSaveToCollection={() => handleSaveToCollection(0)}
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
              slot={build.slots[1]}
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
              onSaveToCollection={() => handleSaveToCollection(1)}
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
              slot={build.slots[2]}
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
              onSaveToCollection={() => handleSaveToCollection(2)}
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



