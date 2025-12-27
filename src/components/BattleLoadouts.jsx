import React, { useState, useEffect, useRef } from 'react';
import { Share2, Download, Upload, Trash2, Copy, Check, Edit, Plus, Save, Loader, CheckCircle2, X, Move } from 'lucide-react';
import SkillBuilderModal from './SkillBuilderModal';
import SkillSlot from './SkillSlot';
import SkillInformation from './SkillInformation';
import SpiritBuilderModal from './SpiritBuilderModal';
import SpiritComponent from './SpiritComponent';
import SoulWeaponEngravingBuilderModal from './SoulWeaponEngravingBuilderModal';
import SoulWeaponEngravingGrid from './SoulWeaponEngravingGrid';
import SkillStoneBuilderModal from './SkillStoneBuilderModal';
import SkillStone from './SkillStone';
import SavedLoadoutsPanel from './SavedLoadoutsPanel';
import ValidatedInput from './ValidatedInput';
import { encodeLoadout, decodeLoadout } from '../../wiki-framework/src/utils/battleLoadoutEncoder';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { setCache } from '../utils/buildCache';
import { saveBuild, loadBuild, generateShareUrl } from '../../wiki-framework/src/services/github/buildShare';
import { useDraftStorage } from '../../wiki-framework/src/hooks/useDraftStorage';
import { getSaveDataEndpoint, getLoadDataEndpoint } from '../utils/apiEndpoints.js';
import { serializeBuild, deserializeBuild, serializeBuildForSharing } from '../utils/spiritSerialization';
import { serializeLoadoutForStorage, serializeLoadoutForSharing, deserializeSoulWeaponBuild } from '../utils/battleLoadoutSerializer';
import { validateBuildName, STRING_LIMITS } from '../utils/validation';
import { createLogger } from '../utils/logger';

const logger = createLogger('BattleLoadouts');

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
  const [mySpirits, setMySpirits] = useState([]);
  const [shapes, setShapes] = useState([]); // Soul weapon engraving shapes
  const [allWeapons, setAllWeapons] = useState([]); // All weapons for soul weapon preview
  const [stoneData, setStoneData] = useState(null); // Skill stones data
  const [allSkillBuilds, setAllSkillBuilds] = useState([]);
  const [allSpiritBuilds, setAllSpiritBuilds] = useState([]);
  const [userBuildsLoaded, setUserBuildsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSkillBuilder, setShowSkillBuilder] = useState(false);
  const [showSpiritBuilder, setShowSpiritBuilder] = useState(false);
  const [showSoulWeaponBuilder, setShowSoulWeaponBuilder] = useState(false);
  const [showSkillStoneBuilder, setShowSkillStoneBuilder] = useState(false);
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

  // Load skills, spirits, weapons, shapes, and stone data
  useEffect(() => {
    logger.info('BattleLoadouts: Starting initial data load (skills, spirits, weapons, shapes, stone data)');
    const loadData = async () => {
      try {
        await Promise.all([loadSkills(), loadSpirits(), loadWeapons(), loadShapes(), loadStoneData()]);
        logger.info('BattleLoadouts: All initial data loaded successfully');
      } catch (error) {
        logger.error('BattleLoadouts: Error during initial data load', { error: error.message, stack: error.stack });
      }
    };
    loadData();
  }, []);

  // Load user's builds and spirits collection when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      setUserBuildsLoaded(false); // Reset when starting to load
      loadUserBuildsAndSpirits();
    } else {
      // Not authenticated, clear builds and mark as loaded so draft can load
      setAllSkillBuilds([]);
      setAllSpiritBuilds([]);
      setMySpirits([]);
      setUserBuildsLoaded(true);
    }
  }, [isAuthenticated, user?.id]);

  // Load loadout from URL
  useEffect(() => {
    if (skills.length === 0 || spirits.length === 0 || shapes.length === 0) return; // Wait for skills, spirits, and shapes to load

    // If authenticated, wait for user builds to load before processing draft
    if (isAuthenticated && user?.id && !userBuildsLoaded) {
      logger.debug('Waiting for user builds to load before processing draft');
      return;
    }

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const shareChecksum = urlParams.get('share');
    const encodedLoadout = urlParams.get('data');
    const loadoutId = urlParams.get('loadout');

    // Load from new share system (short URL)
    if (shareChecksum) {
      const loadSharedBuild = async () => {
        try {
          setLoading(true);
          logger.info('Loading shared build', { shareChecksum });

          // Get repo info from config
          const configResponse = await fetch('/wiki-config.json');
          const config = await configResponse.json();
          const owner = config.wiki.repository.owner;
          const repo = config.wiki.repository.repo;

          const buildData = await loadBuild(owner, repo, shareChecksum);

          if (buildData.type === 'battle-loadouts') {
            // Deserialize skill build, spirit build, and soul weapon build
            const deserializedLoadout = {
              ...buildData.data,
              skillBuild: buildData.data.skillBuild ? deserializeSkillBuild(buildData.data.skillBuild, skills) : null,
              spiritBuild: buildData.data.spiritBuild ? deserializeSpiritBuild(buildData.data.spiritBuild, spirits, mySpirits) : null,
              soulWeaponBuild: buildData.data.soulWeaponBuild ? deserializeSoulWeaponBuild(buildData.data.soulWeaponBuild, shapes) : null
            };
            setCurrentLoadout(deserializedLoadout);
            setLoadoutName(deserializedLoadout.name || '');
            setHasUnsavedChanges(false);
            logger.info('Shared build loaded successfully');
          } else {
            throw new Error(`Invalid build type: ${buildData.type}`);
          }
        } catch (error) {
          logger.error('Failed to load shared build', { error });
          alert(`Failed to load shared build: ${error.message}`);
        } finally {
          setLoading(false);
        }
      };

      loadSharedBuild();
    }
    // Load from saved loadouts by ID
    else if (loadoutId && isAuthenticated && user) {
      const loadFromSavedLoadouts = async () => {
        try {
          setLoading(true);
          logger.info('Loading saved loadout', { loadoutId });

          const response = await fetch(`${getLoadDataEndpoint()}?type=battle-loadouts&userId=${user.id}`);
          if (!response.ok) {
            throw new Error('Failed to load loadouts from server');
          }
          const data = await response.json();
          const loadouts = data.loadouts || [];

          const savedLoadout = loadouts.find(l => l.id === loadoutId);
          if (savedLoadout) {
            logger.info('LOAD: Found saved loadout', {
              loadoutId,
              loadoutName: savedLoadout.name,
              hasSkillStoneBuild: !!savedLoadout.skillStoneBuild,
              skillStoneBuild: savedLoadout.skillStoneBuild
            });

            // Resolve the loadout (handles both build IDs and embedded builds)
            const resolvedLoadout = resolveLoadoutBuilds(savedLoadout);

            logger.info('LOAD: Resolved loadout', {
              hasSkillBuild: !!resolvedLoadout.skillBuild,
              hasSpiritBuild: !!resolvedLoadout.spiritBuild,
              hasSkillStoneBuild: !!resolvedLoadout.skillStoneBuild,
              skillStoneBuild: resolvedLoadout.skillStoneBuild
            });

            setCurrentLoadout(resolvedLoadout);
            setLoadoutName(resolvedLoadout.name || '');
            setCurrentLoadedLoadoutId(loadoutId);
            setHasUnsavedChanges(false);
            logger.info('Saved loadout loaded successfully', { loadoutName: resolvedLoadout.name });
          } else {
            logger.error('Loadout not found', { loadoutId });
            alert('Loadout not found');
          }
        } catch (error) {
          logger.error('Failed to load saved loadout', { error });
          alert(`Failed to load loadout: ${error.message}`);
        } finally {
          setLoading(false);
        }
      };
      loadFromSavedLoadouts();
    }
    // Fallback to old encoded system
    else if (encodedLoadout) {
      try {
        const decodedLoadout = decodeLoadout(encodedLoadout);
        if (decodedLoadout) {
          // Deserialize skill build, spirit build, and soul weapon build
          const deserializedLoadout = {
            ...decodedLoadout,
            skillBuild: decodedLoadout.skillBuild ? deserializeSkillBuild(decodedLoadout.skillBuild, skills) : null,
            spiritBuild: decodedLoadout.spiritBuild ? deserializeSpiritBuild(decodedLoadout.spiritBuild, spirits, mySpirits) : null,
            soulWeaponBuild: decodedLoadout.soulWeaponBuild ? deserializeSoulWeaponBuild(decodedLoadout.soulWeaponBuild, shapes) : null
          };
          setCurrentLoadout(deserializedLoadout);
          setLoadoutName(deserializedLoadout.name || '');
          setHasUnsavedChanges(false); // Loaded from URL, no unsaved changes yet
        }
      } catch (error) {
        logger.error('Failed to load loadout from URL', { error });
      }
    }
    // Load from localStorage if no URL params
    else {
      const draft = loadDraft();
      if (draft) {
        logger.debug('Loading draft', {
          hasSkillBuildId: !!draft.currentLoadout.skillBuildId,
          hasSpirBuildId: !!draft.currentLoadout.spiritBuildId,
          hasSkillBuild: !!draft.currentLoadout.skillBuild,
          hasSpiritBuild: !!draft.currentLoadout.spiritBuild,
          skillBuildHasId: !!draft.currentLoadout.skillBuild?.id,
          spiritBuildHasId: !!draft.currentLoadout.spiritBuild?.id
        });

        setLoadoutName(draft.loadoutName || '');

        // Always use resolveLoadoutBuilds which handles both build IDs and embedded builds
        const resolvedLoadout = resolveLoadoutBuilds(draft.currentLoadout);

        logger.debug('Draft resolved', {
          hasSkillBuild: !!resolvedLoadout.skillBuild,
          hasSpiritBuild: !!resolvedLoadout.spiritBuild,
          skillBuildId: resolvedLoadout.skillBuild?.id,
          spiritBuildId: resolvedLoadout.spiritBuild?.id
        });

        setCurrentLoadout(resolvedLoadout);
        setHasUnsavedChanges(true);
      }
    }
  }, [skills, spirits, mySpirits, shapes, allSkillBuilds, allSpiritBuilds, userBuildsLoaded, isAuthenticated, user?.id, loadDraft]);

  // Re-deserialize soul weapon build when shapes become available
  useEffect(() => {
    logger.debug('Re-deserialization useEffect triggered', {
      shapesLength: shapes.length,
      hasSoulWeaponBuild: !!currentLoadout.soulWeaponBuild,
      hasGridState: !!currentLoadout.soulWeaponBuild?.gridState
    });

    if (shapes.length > 0 && currentLoadout.soulWeaponBuild) {
      // Check if soul weapon build needs deserialization (has shapeId but no shape in pieces)
      const gridState = currentLoadout.soulWeaponBuild.gridState;
      if (gridState && Array.isArray(gridState)) {
        const needsDeserialization = gridState.some(row =>
          row.some(cell => cell.piece && cell.piece.shapeId && !cell.piece.shape)
        );

        logger.debug('Deserialization check', { needsDeserialization });

        if (needsDeserialization) {
          logger.info('Re-deserializing soul weapon build after shapes loaded');
          const deserializedSoulWeaponBuild = deserializeSoulWeaponBuild(currentLoadout.soulWeaponBuild, shapes);
          setCurrentLoadout(prev => ({
            ...prev,
            soulWeaponBuild: deserializedSoulWeaponBuild
          }));
        }
      }
    }
  }, [shapes, currentLoadout.soulWeaponBuild]);

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

  const loadSpirits = async () => {
    try {
      const response = await fetch('/data/spirit-characters.json');
      const data = await response.json();
      setSpirits(data.spirits);
    } catch (error) {
      logger.error('Failed to load spirits', { error });
    }
  };

  const loadWeapons = async () => {
    try {
      const response = await fetch('/data/soul-weapons.json');
      const data = await response.json();
      // soul-weapons.json is a direct array, not an object with a weapons property
      setAllWeapons(Array.isArray(data) ? data : []);
      logger.debug('Loaded weapons', { count: Array.isArray(data) ? data.length : 0 });
    } catch (error) {
      logger.error('Failed to load weapons', { error });
    }
  };

  const loadStoneData = async () => {
    try {
      const response = await fetch('/data/skill_stones.json');
      const data = await response.json();
      setStoneData(data);
      logger.debug('Loaded skill stones data');
    } catch (error) {
      logger.error('Failed to load skill stones', { error });
    }
  };

  const loadShapes = async () => {
    try {
      logger.debug('Starting to load soul weapon engraving shapes');
      const response = await fetch('/data/soul-weapon-engravings.json');
      logger.debug('Shapes fetch response received', { ok: response.ok, status: response.status });
      const data = await response.json();
      // The JSON file has shapes in a "shapes" property, not as a direct array
      const shapesArray = data.shapes || [];
      logger.debug('Shapes data parsed', { isArray: Array.isArray(shapesArray), length: shapesArray.length });
      setShapes(Array.isArray(shapesArray) ? shapesArray : []);
      logger.info('Loaded soul weapon engraving shapes', { count: shapesArray.length });
    } catch (error) {
      logger.error('Failed to load shapes', { error: error.message, stack: error.stack });
      setShapes([]);
    }
  };

  /**
   * Load user's skill builds, spirit builds, and my-spirits collection
   * Needed for resolving build IDs to full builds
   */
  const loadUserBuildsAndSpirits = async () => {
    if (!user?.id) return;

    try {
      logger.debug('Loading user builds and spirits', { userId: user.id });

      // Load all three collections in parallel
      const loadDataEndpoint = getLoadDataEndpoint();
      const [skillBuildsRes, spiritBuildsRes, mySpiritsRes] = await Promise.all([
        fetch(`${loadDataEndpoint}?type=skill-builds&userId=${user.id}`),
        fetch(`${loadDataEndpoint}?type=spirit-builds&userId=${user.id}`),
        fetch(`${loadDataEndpoint}?type=my-spirits&userId=${user.id}`)
      ]);

      logger.debug('Fetch responses', {
        skillBuildsOk: skillBuildsRes.ok,
        skillBuildsStatus: skillBuildsRes.status,
        spiritBuildsOk: spiritBuildsRes.ok,
        spiritBuildsStatus: spiritBuildsRes.status,
        mySpiritsOk: mySpiritsRes.ok,
        mySpiritsStatus: mySpiritsRes.status
      });

      // Parse responses
      const skillBuildsData = skillBuildsRes.ok ? await skillBuildsRes.json() : { builds: [] };
      const spiritBuildsData = spiritBuildsRes.ok ? await spiritBuildsRes.json() : { builds: [] };
      const mySpiritsData = mySpiritsRes.ok ? await mySpiritsRes.json() : { spirits: [] };

      logger.debug('Parsed data', {
        skillBuildsData,
        spiritBuildsData,
        mySpiritsData
      });

      setAllSkillBuilds(skillBuildsData.builds || []);
      setAllSpiritBuilds(spiritBuildsData.builds || []);
      setMySpirits(mySpiritsData.spirits || []);

      logger.debug('Loaded user builds and spirits', {
        skillBuilds: skillBuildsData.builds?.length || 0,
        spiritBuilds: spiritBuildsData.builds?.length || 0,
        mySpirits: mySpiritsData.spirits?.length || 0
      });

      setUserBuildsLoaded(true);
    } catch (error) {
      logger.error('Failed to load user builds and spirits', {
        error,
        errorMessage: error?.message,
        errorStack: error?.stack
      });
      // Set empty arrays on error
      setAllSkillBuilds([]);
      setAllSpiritBuilds([]);
      setMySpirits([]);
      setUserBuildsLoaded(true); // Mark as loaded even on error to avoid infinite waiting
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
   * @param {Object} build - Serialized spirit build
   * @param {Array} spiritsArray - Array of all spirits
   * @param {Array} mySpiritsArray - Array of user's collection spirits (for collection references)
   */
  const deserializeSpiritBuild = (build, spiritsArray, mySpiritsArray = []) => {
    if (!build) return null;
    return deserializeBuild(build, spiritsArray, mySpiritsArray);
  };

  /**
   * Normalize spirit build to always have 3 slots
   */
  const normalizeSpiritBuild = (build) => {
    if (!build) return null;

    const emptySlot = {
      type: 'base',
      spirit: null,
      level: 1,
      awakeningLevel: 0,
      evolutionLevel: 4,
      skillEnhancementLevel: 0
    };

    const normalizedSlots = Array(3).fill(null).map((_, index) => {
      const slot = build.slots?.[index];
      if (!slot || slot.spirit === undefined) {
        return { ...emptySlot };
      }
      return slot;
    });

    return { ...build, slots: normalizedSlots };
  };

  /**
   * Serialize entire loadout for storage (store build IDs, not full builds)
   */
  const serializeLoadout = (loadout) => {
    return {
      name: loadout.name,
      skillBuildId: loadout.skillBuild?.id || null,
      spiritBuildId: loadout.spiritBuild?.id || null,
      soulWeaponBuild: loadout.soulWeaponBuild || null,
      skillStoneBuild: loadout.skillStoneBuild || null,
      spirit: loadout.spirit ? { spiritId: loadout.spirit.id } : null,
      skillStone: loadout.skillStone,
      promotionAbility: loadout.promotionAbility,
      familiar: loadout.familiar
    };
  };

  /**
   * Serialize loadout for sharing (embed full serialized builds, not IDs)
   * Recipients won't have access to build IDs or collection IDs, so we need full build data
   */
  const serializeLoadoutForSharing = (loadout) => {
    return {
      name: loadout.name,
      skillBuild: loadout.skillBuild ? serializeSkillBuild(loadout.skillBuild) : null,
      spiritBuild: loadout.spiritBuild ? serializeBuildForSharing(loadout.spiritBuild) : null,
      soulWeaponBuild: loadout.soulWeaponBuild ? {
        weaponId: loadout.soulWeaponBuild.weaponId,
        weaponName: loadout.soulWeaponBuild.weaponName,
        gridState: loadout.soulWeaponBuild.gridState,
        inventory: loadout.soulWeaponBuild.inventory
      } : null,
      skillStoneBuild: loadout.skillStoneBuild || null,
      spirit: loadout.spirit ? { spiritId: loadout.spirit.id } : null,
      skillStone: loadout.skillStone,
      promotionAbility: loadout.promotionAbility,
      familiar: loadout.familiar
    };
  };

  /**
   * Resolve build IDs to full builds (deserialized)
   * Handles missing builds gracefully
   */
  const resolveLoadoutBuilds = (loadout) => {
    let skillBuild = null;
    let spiritBuild = null;

    // Resolve skill build
    if (loadout.skillBuildId) {
      logger.debug('Resolving skill build', {
        skillBuildId: loadout.skillBuildId,
        allSkillBuildsCount: allSkillBuilds.length,
        allSkillBuildIds: allSkillBuilds.map(b => b.id)
      });

      const found = allSkillBuilds.find(b => b.id === loadout.skillBuildId);
      if (found) {
        logger.debug('Skill build found before deserialization', {
          foundId: found.id,
          foundName: found.name,
          hasSlots: !!found.slots
        });

        skillBuild = deserializeSkillBuild(found, skills);

        logger.debug('Skill build after deserialization', {
          hasSkillBuild: !!skillBuild,
          skillBuildId: skillBuild?.id,
          skillBuildName: skillBuild?.name,
          skillBuildMaxSlots: skillBuild?.maxSlots,
          slotsCount: skillBuild?.slots?.length
        });
      } else {
        // Build not found - mark as missing
        skillBuild = {
          missing: true,
          id: loadout.skillBuildId,
          name: 'Deleted Build',
          slots: []
        };
        logger.warn('Skill build not found', {
          skillBuildId: loadout.skillBuildId,
          availableBuilds: allSkillBuilds.map(b => ({ id: b.id, name: b.name }))
        });
      }
    }
    // Handle old embedded format (migration)
    else if (loadout.skillBuild) {
      logger.debug('Using embedded skill build (migration)', {
        hasId: !!loadout.skillBuild.id,
        id: loadout.skillBuild.id
      });
      skillBuild = deserializeSkillBuild(loadout.skillBuild, skills);
    }

    // Resolve spirit build
    if (loadout.spiritBuildId) {
      logger.debug('Resolving spirit build', {
        spiritBuildId: loadout.spiritBuildId,
        allSpiritBuildsCount: allSpiritBuilds.length,
        allSpiritBuildIds: allSpiritBuilds.map(b => b.id)
      });

      const found = allSpiritBuilds.find(b => b.id === loadout.spiritBuildId);
      if (found) {
        logger.debug('Spirit build found', { buildId: found.id, buildName: found.name });
        spiritBuild = deserializeSpiritBuild(found, spirits, mySpirits);
        // Normalize to always have 3 slots
        spiritBuild = normalizeSpiritBuild(spiritBuild);
      } else {
        // Build not found - mark as missing
        spiritBuild = {
          missing: true,
          id: loadout.spiritBuildId,
          name: 'Deleted Build',
          slots: []
        };
        logger.warn('Spirit build not found', {
          spiritBuildId: loadout.spiritBuildId,
          availableBuilds: allSpiritBuilds.map(b => ({ id: b.id, name: b.name }))
        });
      }
    }
    // Handle old embedded format (migration)
    else if (loadout.spiritBuild) {
      spiritBuild = deserializeSpiritBuild(loadout.spiritBuild, spirits, mySpirits);
      // Normalize to always have 3 slots
      spiritBuild = normalizeSpiritBuild(spiritBuild);
    }

    // Deserialize soul weapon build (reconstruct shape objects from shapeIds)
    let soulWeaponBuild = null;
    if (loadout.soulWeaponBuild && shapes.length > 0) {
      soulWeaponBuild = deserializeSoulWeaponBuild(loadout.soulWeaponBuild, shapes);
      logger.debug('Deserialized soul weapon build in resolveLoadoutBuilds');
    } else if (loadout.soulWeaponBuild) {
      // Shapes not loaded yet, pass through as-is (will be deserialized later)
      soulWeaponBuild = loadout.soulWeaponBuild;
      logger.warn('Soul weapon build present but shapes not loaded yet');
    }

    return {
      ...loadout,
      skillBuild,
      spiritBuild,
      soulWeaponBuild
    };
  };

  /**
   * Check if current loadout matches a saved loadout (compare by build IDs)
   */
  const loadoutsMatch = (savedLoadout) => {
    if (!savedLoadout) {
      logger.debug('loadoutsMatch: savedLoadout is null/undefined');
      return false;
    }

    if (savedLoadout.name !== loadoutName) {
      logger.debug('loadoutsMatch: name mismatch', {
        savedName: savedLoadout.name,
        currentName: loadoutName
      });
      return false;
    }

    // Compare skill build ID
    const currentSkillBuildId = currentLoadout.skillBuild?.id || null;
    const savedSkillBuildId = savedLoadout.skillBuildId || savedLoadout.skillBuild?.id || null;
    if (currentSkillBuildId !== savedSkillBuildId) {
      logger.debug('loadoutsMatch: skill build ID mismatch', {
        currentSkillBuildId,
        savedSkillBuildId
      });
      return false;
    }

    // Compare spirit build ID
    const currentSpiritBuildId = currentLoadout.spiritBuild?.id || null;
    const savedSpiritBuildId = savedLoadout.spiritBuildId || savedLoadout.spiritBuild?.id || null;
    if (currentSpiritBuildId !== savedSpiritBuildId) {
      logger.debug('loadoutsMatch: spirit build ID mismatch', {
        currentSpiritBuildId,
        savedSpiritBuildId
      });
      return false;
    }

    // Compare other properties
    if (JSON.stringify(currentLoadout.spirit) !== JSON.stringify(savedLoadout.spirit)) {
      logger.debug('loadoutsMatch: spirit mismatch');
      return false;
    }
    if (JSON.stringify(currentLoadout.soulWeaponBuild) !== JSON.stringify(savedLoadout.soulWeaponBuild)) {
      logger.debug('loadoutsMatch: soulWeaponBuild mismatch');
      return false;
    }
    if (JSON.stringify(currentLoadout.skillStoneBuild) !== JSON.stringify(savedLoadout.skillStoneBuild)) {
      logger.debug('loadoutsMatch: skillStoneBuild mismatch');
      return false;
    }
    if (JSON.stringify(currentLoadout.skillStone) !== JSON.stringify(savedLoadout.skillStone)) {
      logger.debug('loadoutsMatch: skillStone mismatch');
      return false;
    }
    if (JSON.stringify(currentLoadout.promotionAbility) !== JSON.stringify(savedLoadout.promotionAbility)) {
      logger.debug('loadoutsMatch: promotionAbility mismatch');
      return false;
    }
    if (JSON.stringify(currentLoadout.familiar) !== JSON.stringify(savedLoadout.familiar)) {
      logger.debug('loadoutsMatch: familiar mismatch');
      return false;
    }

    logger.debug('loadoutsMatch: MATCH FOUND', { loadoutId: savedLoadout.id });
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
      currentLoadout.soulWeaponBuild !== null ||
      currentLoadout.skillStoneBuild !== null ||
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
      logger.debug('Found matching loadout, clearing unsaved changes', {
        matchingLoadoutId: matchingLoadout.id,
        hasUnsavedChanges
      });
      setCurrentLoadedLoadoutId(matchingLoadout.id);
      // Clear unsaved changes when we match a saved loadout
      if (hasUnsavedChanges) {
        setHasUnsavedChanges(false);
      }
    } else {
      logger.debug('No matching loadout found', {
        hasContent,
        hasUnsavedChanges
      });
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

  // Handle soul weapon build save
  const handleSoulWeaponBuildSave = (build) => {
    setCurrentLoadout(prev => ({ ...prev, soulWeaponBuild: build }));
    setShowSoulWeaponBuilder(false);
  };

  // Clear soul weapon build
  const handleClearSoulWeaponBuild = () => {
    if (!confirm('Remove soul weapon build from this loadout?')) return;
    setCurrentLoadout(prev => ({ ...prev, soulWeaponBuild: null }));
  };

  // Handle skill stone build save
  const handleSkillStoneBuildSave = (build) => {
    setCurrentLoadout(prev => ({ ...prev, skillStoneBuild: build }));
    setShowSkillStoneBuilder(false);
  };

  // Clear skill stone build
  const handleClearSkillStoneBuild = () => {
    if (!confirm('Remove skill stone build from this loadout?')) return;
    setCurrentLoadout(prev => ({ ...prev, skillStoneBuild: null }));
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

    // Save the skill build if it has an ID (already saved)
    if (currentLoadout.skillBuild.id && currentLoadout.skillBuild.name && isAuthenticated && user) {
      logger.info('Saving skill build after drag reorder', { buildId: currentLoadout.skillBuild.id });

      (async () => {
        try {
          const serializedBuild = {
            name: currentLoadout.skillBuild.name,
            maxSlots: currentLoadout.skillBuild.maxSlots || 10,
            slots: newSlots.map(slot => ({
              skillId: slot.skillId !== undefined ? slot.skillId : (slot.skill?.id || null),
              level: slot.level
            }))
          };

          await fetch(getSaveDataEndpoint(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'skill-builds',
              username: user.login,
              userId: user.id,
              data: serializedBuild,
            }),
          });

          logger.info('Saved skill build after drag', { buildId: currentLoadout.skillBuild.id });
        } catch (error) {
          logger.error('Failed to save skill build after drag', { error });
        }
      })();
    }
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

    // Save the spirit build if it has an ID (already saved)
    if (currentLoadout.spiritBuild.id && currentLoadout.spiritBuild.name && isAuthenticated && user) {
      logger.info('Saving spirit build after drag reorder', { buildId: currentLoadout.spiritBuild.id });

      (async () => {
        try {
          const serializedBuild = serializeBuild({ slots: newSlots });
          serializedBuild.name = currentLoadout.spiritBuild.name;

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

          logger.info('Saved spirit build after drag', { buildId: currentLoadout.spiritBuild.id });
        } catch (error) {
          logger.error('Failed to save spirit build after drag', { error });
        }
      })();
    }
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

    // Resolve build IDs to full builds (with mySpirits for spirit build resolution)
    const resolvedLoadout = resolveLoadoutBuilds(loadout);

    setCurrentLoadout(resolvedLoadout);
    setLoadoutName(resolvedLoadout.name || 'My Loadout');
    setHasUnsavedChanges(false); // Loaded from saved, no unsaved changes
    setCurrentLoadedLoadoutId(loadout.id); // Track which loadout is currently loaded

    // Trigger donation prompt on successful load
    window.triggerDonationPrompt?.({
      messages: [
        "Ready for battle! Let's go! ⚔️",
        "Loading your war machine! 🛡️",
        "This loadout slaps! 💥",
        "Locked and loaded! 🎯",
      ]
    });
  };

  /**
   * Helper: Save skill build and return its ID
   */
  const saveSkillBuildAndGetId = async (skillBuild) => {
    if (!skillBuild) return null;
    if (skillBuild.id) return skillBuild.id; // Already has ID

    logger.debug('Saving skill build before loadout save');

    const buildName = skillBuild.name || 'Untitled Skill Build';

    // Serialize skill build (skill objects -> skill IDs only)
    const serializedBuild = {
      name: buildName,
      maxSlots: skillBuild.maxSlots || 10,
      slots: skillBuild.slots.map(slot => ({
        skillId: slot.skillId !== undefined ? slot.skillId : (slot.skill?.id || null),
        level: slot.level
      }))
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
        data: serializedBuild,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save skill build: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // Response format: { builds: [...] }
    const savedBuild = data.builds?.find(b => b.name === buildName);

    if (savedBuild?.id) {
      logger.info('Skill build saved with ID', { id: savedBuild.id });
      return savedBuild.id;
    }

    throw new Error('Failed to get skill build ID from save response');
  };

  /**
   * Helper: Save spirit build and return its ID
   */
  const saveSpiritBuildAndGetId = async (spiritBuild) => {
    if (!spiritBuild) return null;
    if (spiritBuild.id) return spiritBuild.id; // Already has ID

    logger.debug('Saving spirit build before loadout save');

    const buildName = spiritBuild.name || 'Untitled Spirit Build';

    // Serialize spirit build using existing utility
    const serializedBuild = serializeBuild(spiritBuild);
    serializedBuild.name = buildName;

    const response = await fetch(getSaveDataEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'spirit-builds',
        username: user.login,
        userId: user.id,
        data: serializedBuild,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save spirit build: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // Response format: { builds: [...] }
    const savedBuild = data.builds?.find(b => b.name === buildName);

    if (savedBuild?.id) {
      logger.info('Spirit build saved with ID', { id: savedBuild.id });
      return savedBuild.id;
    }

    throw new Error('Failed to get spirit build ID from save response');
  };

  // Save loadout
  const handleSaveLoadout = async () => {
    if (!user || !isAuthenticated) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Step 1: Save skill build if it doesn't have an ID
      let skillBuildId = currentLoadout.skillBuild?.id || null;
      if (currentLoadout.skillBuild && !skillBuildId) {
        skillBuildId = await saveSkillBuildAndGetId(currentLoadout.skillBuild);
        // Update the current loadout with the new ID
        setCurrentLoadout(prev => ({
          ...prev,
          skillBuild: { ...prev.skillBuild, id: skillBuildId }
        }));
      }

      // Step 2: Save spirit build if it doesn't have an ID
      let spiritBuildId = currentLoadout.spiritBuild?.id || null;
      if (currentLoadout.spiritBuild && !spiritBuildId) {
        spiritBuildId = await saveSpiritBuildAndGetId(currentLoadout.spiritBuild);
        // Update the current loadout with the new ID
        setCurrentLoadout(prev => ({
          ...prev,
          spiritBuild: { ...prev.spiritBuild, id: spiritBuildId }
        }));
      }

      // Step 3: Serialize loadout with build IDs
      // Use dedicated serializer to optimize data (especially soul weapon builds)
      const loadoutToSave = {
        ...currentLoadout,
        name: loadoutName,
        skillBuild: currentLoadout.skillBuild ? { ...currentLoadout.skillBuild, id: skillBuildId } : null,
        spiritBuild: currentLoadout.spiritBuild ? { ...currentLoadout.spiritBuild, id: spiritBuildId } : null
      };
      const loadoutData = serializeLoadoutForStorage(loadoutToSave);

      logger.info('SAVE: Preparing to save battle loadout', {
        loadoutName: loadoutData.name,
        hasSkillStoneBuild: !!loadoutData.skillStoneBuild,
        hasSoulWeaponBuild: !!loadoutData.soulWeaponBuild,
        soulWeaponBuildSize: loadoutData.soulWeaponBuild ? JSON.stringify(loadoutData.soulWeaponBuild).length : 0
      });

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
        logger.info('SAVE: Loadout saved successfully', {
          loadoutId: savedLoadout.id,
          loadoutName: savedLoadout.name,
          hasSkillStoneBuildInResponse: !!savedLoadout.skillStoneBuild,
          skillStoneBuildInResponse: savedLoadout.skillStoneBuild
        });
      } else {
        logger.warn('SAVE: Could not find saved loadout in response', {
          loadoutName,
          responseLoadoutCount: data.loadouts?.length
        });
      }

      setSaveSuccess(true);
      setHasUnsavedChanges(false); // Successfully saved, clear unsaved changes flag

      // Clear localStorage draft after successful save
      clearDraft();

      // Trigger donation prompt on successful save
      window.triggerDonationPrompt?.({
        messages: [
          "Battle loadout saved! Nice! ⚔️",
          "Ready to crush it! 💪",
          "Your arsenal looks amazing! 🎯",
          "That's a winning combo! 🏆",
        ]
      });

      // Hide success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);

      // Trigger refresh of saved loadouts panel
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      logger.error('Failed to save loadout', { error: err });
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

      logger.debug('Generating share URL');

      // Get repo info from config
      const configResponse = await fetch('/wiki-config.json');
      const config = await configResponse.json();
      const owner = config.wiki.repository.owner;
      const repo = config.wiki.repository.repo;

      // Serialize the loadout for sharing (embed full builds for recipients)
      const serializedLoadout = serializeLoadoutForSharing(currentLoadout);

      // Save build and get checksum
      const checksum = await saveBuild(owner, repo, 'battle-loadouts', serializedLoadout);

      // Generate share URL
      const baseURL = window.location.origin + window.location.pathname;
      const shareURL = generateShareUrl(baseURL, 'battle-loadouts', checksum);

      logger.info('Share URL generated', { shareURL });

      // Copy to clipboard
      await navigator.clipboard.writeText(shareURL);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // Trigger donation prompt on successful share
      window.triggerDonationPrompt?.({
        messages: [
          "Sharing your war strategy! 🎯",
          "Your loadout is worth showing off! ⚔️",
          "Spread the battle tactics! 🛡️",
          "That's a flex-worthy setup! 💪",
        ]
      });
    } catch (error) {
      logger.error('Failed to generate share URL', { error });
      setShareError(error.message || 'Failed to generate share URL');

      // Fallback to old method if share service fails
      try {
        const serializedLoadout = serializeLoadoutForSharing(currentLoadout);

        const encoded = encodeLoadout(serializedLoadout);
        if (encoded) {
          const baseURL = window.location.origin + window.location.pathname;
          const shareURL = `${baseURL}#/battle-loadouts?data=${encoded}`;

          await navigator.clipboard.writeText(shareURL);

          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          logger.warn('Used fallback encoding method');

          // Trigger donation prompt on successful share (fallback)
          window.triggerDonationPrompt?.({
            messages: [
              "Sharing your war strategy! 🎯",
              "Your loadout is worth showing off! ⚔️",
              "Spread the battle tactics! 🛡️",
              "That's a flex-worthy setup! 💪",
            ]
          });
        } else {
          alert('Failed to generate share URL');
        }
      } catch (fallbackError) {
        logger.error('Fallback also failed', { error: fallbackError });
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

    // Trigger donation prompt on successful export
    window.triggerDonationPrompt?.({
      messages: [
        "Backing up your battle plan! 💾",
        "Strategic data secured! 🛡️",
        "Exporting tactical excellence! 📦",
        "Your loadout is archived! 📝",
      ]
    });
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

        // Deserialize skill build and spirit build (pass mySpirits for collection resolution)
        const deserializedLoadout = {
          ...data,
          skillBuild: data.skillBuild ? deserializeSkillBuild(data.skillBuild, skills) : null,
          spiritBuild: data.spiritBuild ? deserializeSpiritBuild(data.spiritBuild, spirits, mySpirits) : null
        };

        setCurrentLoadout(deserializedLoadout);
        setLoadoutName(deserializedLoadout.name || '');
        setHasUnsavedChanges(false); // Imported from file, no unsaved changes yet

        // Trigger donation prompt on successful import
        window.triggerDonationPrompt?.({
          messages: [
            "New battle strategy loaded! 📥",
            "Fresh tactics incoming! 🎯",
            "Time to dominate! ⚔️",
            "This loadout looks deadly! 💥",
          ]
        });
      } catch (error) {
        logger.error('Failed to import loadout', { error });
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
        <div className={`max-w-7xl mx-auto px-3 sm:px-4 pt-2 pb-6 ${isAuthenticated ? 'pb-24' : ''}`}>

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

          {/* Soul Weapon Engraving - Row 1, Col 2 */}
          <SoulWeaponSection
            soulWeaponBuild={currentLoadout.soulWeaponBuild}
            onEdit={() => setShowSoulWeaponBuilder(true)}
            onClear={handleClearSoulWeaponBuild}
            allWeapons={allWeapons}
          />

          {/* Skill Stones - Row 2, Col 1 */}
          <SkillStoneSection
            skillStoneBuild={currentLoadout.skillStoneBuild}
            onEdit={() => setShowSkillStoneBuilder(true)}
            onClear={handleClearSkillStoneBuild}
            stoneData={stoneData}
          />

          {/* Promotion Abilities - Row 2, Col 2 */}
          <PlaceholderSection
            title="Slayer Promotion Abilities"
            description="Promotion Ability Builder coming soon"
            icon="⭐"
          />

          {/* Familiar - Row 3, Col 1 */}
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

      {/* Soul Weapon Engraving Builder Modal */}
      <SoulWeaponEngravingBuilderModal
        isOpen={showSoulWeaponBuilder}
        onClose={() => setShowSoulWeaponBuilder(false)}
        initialBuild={currentLoadout.soulWeaponBuild}
        onSave={handleSoulWeaponBuildSave}
      />

      {/* Skill Stone Builder Modal */}
      <SkillStoneBuilderModal
        isOpen={showSkillStoneBuilder}
        onClose={() => setShowSkillStoneBuilder(false)}
        initialBuild={currentLoadout.skillStoneBuild}
        onSave={handleSkillStoneBuildSave}
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

  // Show missing indicator if skill build is marked as missing
  if (skillBuild?.missing) {
    return (
      <div style={{ paddingBottom: '2rem' }} className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Skills to use</span>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300 font-medium mb-2">Skill Build Missing</p>
          <p className="text-red-600 dark:text-red-400 text-sm mb-3">
            The skill build for this loadout has been deleted.
          </p>
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Select New Skill Build
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '2rem' }} className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
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
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
            Build: <span className="text-gray-900 dark:text-white font-medium">{skillBuild.name}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 justify-items-center">
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

  // Show missing indicator if spirit build is marked as missing
  if (spiritBuild?.missing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 md:p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl">🔮</span>
            <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Spirits</span>
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300 font-medium mb-2">Spirit Build Missing</p>
          <p className="text-red-600 dark:text-red-400 text-sm mb-3">
            The spirit build for this loadout has been deleted.
          </p>
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Select New Spirit Build
          </button>
        </div>
      </div>
    );
  }

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
 * Soul Weapon Engraving Section Component
 */
const SoulWeaponSection = ({ soulWeaponBuild, onEdit, onClear, allWeapons }) => {
  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the soul weapon build? This cannot be undone.')) {
      onClear();
    }
  };

  // Check if soul weapon build is properly deserialized
  const isDeserialized = soulWeaponBuild?.gridState ?
    !soulWeaponBuild.gridState.some(row =>
      row.some(cell => cell.piece && cell.piece.shapeId && !cell.piece.shape)
    ) : true;

  // Find the weapon object for the build
  const weapon = soulWeaponBuild?.weaponId
    ? allWeapons.find(w => w.id === soulWeaponBuild.weaponId)
    : null;

  // Calculate base cell size (smaller for preview)
  const gridSize = soulWeaponBuild?.gridState?.length || 5;
  const baseCellSize = 45;

  // Scale factor to fit nicely in the panel - increased to compensate for removed padding
  const scale = gridSize === 4 ? 1.15 : 1.0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 md:p-6 border border-gray-200 dark:border-gray-800 flex flex-col">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-2xl sm:text-3xl">⚔️</span>
          <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Soul Weapon</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors"
          >
            <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{soulWeaponBuild ? 'Edit' : 'Create'}</span>
          </button>
          {soulWeaponBuild && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      </div>

      {soulWeaponBuild ? (
        !isDeserialized ? (
          <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-300 dark:border-gray-700 p-4 w-full">
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm">Loading soul weapon data...</p>
          </div>
        ) : (
        <div className="flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-4 lg:gap-6">
          {weapon ? (
            <>
              {/* Weapon Info Card */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[200px] max-w-[220px] flex flex-col">
                {/* Weapon Image */}
                <div className="flex justify-center mb-2.5">
                  <div className="relative w-[72px] h-[72px] bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg border-2 border-purple-400/50 dark:border-purple-500/50 p-1 shadow-lg">
                    <img
                      src={weapon.image}
                      alt={weapon.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.src = '/images/equipment/weapons/sword_201.png';
                      }}
                    />
                    {/* Weapon Name Overlay */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-gray-900/90 dark:bg-gray-950/90 px-1.5 py-[2px] rounded shadow-lg">
                      <span className="text-[9px] font-semibold text-white whitespace-nowrap leading-none block">{weapon.name}</span>
                    </div>
                  </div>
                </div>

                {/* Weapon Stats */}
                <div className="flex-1 flex flex-col justify-center">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-[11px] text-gray-600 dark:text-gray-400">ATK</span>
                      <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">{weapon.attack.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-[11px] text-gray-600 dark:text-gray-400">Required</span>
                      <span className="text-[11px] font-semibold text-gray-900 dark:text-white">{weapon.requirements.toLocaleString()} 🔮</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-[11px] text-gray-600 dark:text-gray-400">Stage</span>
                      <span className="text-[11px] font-semibold text-gray-900 dark:text-white truncate ml-2">{weapon.stageRequirement}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[11px] text-gray-600 dark:text-gray-400">Disasm.</span>
                      <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">{weapon.disassemblyReward.toLocaleString()} 🔮</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid Preview */}
              <div className="flex flex-col items-center justify-center gap-3">
                <div
                  className="relative inline-block"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center'
                  }}
                >
                  <SoulWeaponEngravingGrid
                    gridState={soulWeaponBuild.gridState}
                    selectedWeapon={weapon}
                    cellSize={baseCellSize}
                    gapSize={4}
                    gridPadding={8}
                    lineThickness={8}
                    interactive={false}
                    isComplete={false}
                    className="!bg-gray-400 dark:!bg-gray-900"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-300 dark:border-gray-700 p-4 w-full">
              <p className="text-center text-gray-500 dark:text-gray-400 text-sm">Loading weapon data...</p>
            </div>
          )}
        </div>
        )
      ) : (
        <button
          onClick={onEdit}
          className="w-full flex items-center justify-center py-8 sm:py-10 md:py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
        >
          <div className="text-center px-2">
            <Plus className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">No soul weapon build configured</p>
            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">Click here or "Create" to get started</p>
          </div>
        </button>
      )}
    </div>
  );
};

/**
 * Skill Stones Section Component
 */
const SkillStoneSection = ({ skillStoneBuild, onEdit, onClear, stoneData }) => {
  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the skill stone build? This cannot be undone.')) {
      onClear();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 md:p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-2xl sm:text-3xl">💎</span>
          <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Skill Stones</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors"
          >
            <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{skillStoneBuild ? 'Edit' : 'Create'}</span>
          </button>
          {skillStoneBuild && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      </div>

      {skillStoneBuild ? (
        <div>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 sm:mb-3">
            Build: <span className="text-gray-900 dark:text-white font-medium">{skillStoneBuild.name}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 justify-items-center">
            {skillStoneBuild.slots.map((slot, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                {slot.element && slot.tier ? (
                  <SkillStone
                    stoneType={slot.type}
                    element={slot.element}
                    tier={slot.tier}
                    data={stoneData}
                    size="medium"
                  />
                ) : (
                  <div className="w-24 h-28 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                    <span className="text-gray-400 dark:text-gray-500 text-xs">Empty</span>
                  </div>
                )}
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {stoneData?.stoneTypes[slot.type]?.name || slot.type}
                </span>
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
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">No skill stone build configured</p>
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
    soulWeaponBuild: null,
    skillStoneBuild: null,
    spirit: null,
    skillStone: null,
    promotionAbility: null,
    familiar: null
  };
}

export default BattleLoadouts;



