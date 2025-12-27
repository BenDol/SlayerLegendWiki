import React, { useState, useEffect } from 'react';
import { Save, Loader, Trash2, Clock, CheckCircle2, LogIn, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { useWikiConfig } from '../../wiki-framework/src/hooks/useWikiConfig';
import { useLoginFlow } from '../../wiki-framework/src/hooks/useLoginFlow';
import LoginModal from '../../wiki-framework/src/components/auth/LoginModal';
import { getUserLoadouts } from '../services/battleLoadouts';
import { getCache, setCache, mergeCacheWithGitHub } from '../utils/buildCache';
import { getDeleteDataEndpoint, getLoadDataEndpoint } from '../utils/apiEndpoints.js';
import { getSkillGradeColor, getEquipmentRarityColor } from '../config/rarityColors';
import { createLogger } from '../utils/logger';
import { deserializeSoulWeaponBuild, deserializeSkillBuild } from '../utils/battleLoadoutSerializer.js';
import { deserializeBuild as deserializeSpiritBuild } from '../utils/spiritSerialization.js';
import SkillStone from './SkillStone';

const logger = createLogger('SavedLoadoutsPanel');

/**
 * SavedLoadoutsPanel Component
 *
 * Displays and manages user's saved battle loadouts
 * Features:
 * - Load saved loadouts
 * - Delete loadouts
 * - Mobile-friendly UI
 */
const SavedLoadoutsPanel = ({ currentLoadout, onLoadLoadout, currentLoadedLoadoutId = null, onLoadoutsChange, externalLoadouts = null }) => {
  const { isAuthenticated, user } = useAuthStore();
  const { config } = useWikiConfig();
  const loginFlow = useLoginFlow();
  const [internalSavedLoadouts, setInternalSavedLoadouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [skills, setSkills] = useState([]);
  const [spirits, setSpirits] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [stoneData, setStoneData] = useState(null);
  const [allSkillBuilds, setAllSkillBuilds] = useState([]);
  const [allSpiritBuilds, setAllSpiritBuilds] = useState([]);
  const [mySpirits, setMySpirits] = useState([]);

  // Use external loadouts if provided (controlled mode), otherwise use internal state
  const rawLoadouts = externalLoadouts !== null ? externalLoadouts : internalSavedLoadouts;

  // Resolve build IDs to full builds for display
  const savedLoadouts = rawLoadouts.map(loadout => {
    let skillBuild = null;
    let spiritBuild = null;

    // Resolve skill build
    if (loadout.skillBuildId) {
      logger.debug('Resolving skill build for loadout', {
        loadoutId: loadout.id,
        skillBuildId: loadout.skillBuildId,
        allSkillBuildsCount: allSkillBuilds.length,
        skillsCount: skills.length
      });

      const found = allSkillBuilds.find(b => b.id === loadout.skillBuildId);
      if (found) {
        logger.debug('Found skill build, deserializing', {
          foundId: found.id,
          foundName: found.name,
          slotsCount: found.slots?.length
        });

        skillBuild = deserializeSkillBuild(found, skills);

        logger.debug('Skill build deserialized', {
          hasSkillBuild: !!skillBuild,
          slotsCount: skillBuild?.slots?.length,
          firstSlot: skillBuild?.slots?.[0]
        });
      } else {
        logger.warn('Skill build not found', {
          skillBuildId: loadout.skillBuildId,
          availableIds: allSkillBuilds.map(b => b.id)
        });
      }
    } else if (loadout.skillBuild) {
      logger.debug('Using embedded skill build', { hasSlots: !!loadout.skillBuild.slots });
      skillBuild = loadout.skillBuild; // Already deserialized
    }

    // Resolve spirit build
    if (loadout.spiritBuildId) {
      const found = allSpiritBuilds.find(b => b.id === loadout.spiritBuildId);
      if (found) {
        spiritBuild = deserializeSpiritBuild(found, spirits, mySpirits);
      }
    } else if (loadout.spiritBuild) {
      spiritBuild = loadout.spiritBuild; // Already deserialized
    }

    return {
      ...loadout,
      skillBuild,
      spiritBuild
    };
  });

  // Load skills, spirits, shapes, weapons, and stone data
  useEffect(() => {
    loadSkills();
    loadSpirits();
    loadShapes();
    loadWeapons();
    loadStoneData();
  }, []);

  // Load user's builds and spirits
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadUserBuildsAndSpirits();
    }
  }, [isAuthenticated, user?.id]);

  // Load saved loadouts on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      loadLoadouts();
    }
  }, [isAuthenticated, user]);

  const loadSkills = async () => {
    try {
      const response = await fetch('/data/skills.json');
      const data = await response.json();
      // Ensure we have an array
      setSkills(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.error('Failed to load skills:', { error: err });
      setSkills([]);
    }
  };

  const loadSpirits = async () => {
    try {
      const response = await fetch('/data/spirit-characters.json');
      const data = await response.json();
      // Spirits are nested under 'spirits' property
      const spiritsArray = data.spirits || [];
      setSpirits(Array.isArray(spiritsArray) ? spiritsArray : []);
    } catch (err) {
      logger.error('Failed to load spirits:', { error: err });
      setSpirits([]);
    }
  };

  const loadShapes = async () => {
    try {
      const response = await fetch('/data/soul-weapon-engravings.json');
      const data = await response.json();
      // The JSON file has shapes in a "shapes" property, not as a direct array
      const shapesArray = data.shapes || [];
      setShapes(Array.isArray(shapesArray) ? shapesArray : []);
    } catch (err) {
      logger.error('Failed to load shapes:', { error: err });
      setShapes([]);
    }
  };

  const loadWeapons = async () => {
    try {
      const response = await fetch('/data/soul-weapons.json');
      const data = await response.json();
      setWeapons(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.error('Failed to load weapons:', { error: err });
      setWeapons([]);
    }
  };

  const loadStoneData = async () => {
    try {
      logger.debug('Loading stone data...');
      const response = await fetch('/data/skill_stones.json');
      logger.debug('Stone data response', { ok: response.ok, status: response.status });
      const data = await response.json();
      logger.debug('Stone data loaded', { hasTypes: !!data.types, data });
      setStoneData(data);
    } catch (err) {
      logger.error('Failed to load stone data:', { error: err.message, stack: err.stack });
      setStoneData(null);
    }
  };

  const loadUserBuildsAndSpirits = async () => {
    if (!user?.id) return;

    try {
      // Load all three collections in parallel
      const loadDataEndpoint = getLoadDataEndpoint();
      const [skillBuildsRes, spiritBuildsRes, mySpiritsRes] = await Promise.all([
        fetch(`${loadDataEndpoint}?type=skill-builds&userId=${user.id}`),
        fetch(`${loadDataEndpoint}?type=spirit-builds&userId=${user.id}`),
        fetch(`${loadDataEndpoint}?type=my-spirits&userId=${user.id}`)
      ]);

      // Parse responses
      const skillBuildsData = skillBuildsRes.ok ? await skillBuildsRes.json() : { builds: [] };
      const spiritBuildsData = spiritBuildsRes.ok ? await spiritBuildsRes.json() : { builds: [] };
      const mySpiritsData = mySpiritsRes.ok ? await mySpiritsRes.json() : { spirits: [] };

      setAllSkillBuilds(skillBuildsData.builds || []);
      setAllSpiritBuilds(spiritBuildsData.builds || []);
      setMySpirits(mySpiritsData.spirits || []);
    } catch (error) {
      logger.error('Failed to load user builds and spirits', { error });
    }
  };

  const loadLoadouts = async () => {
    if (!user || !config) return;

    setLoading(true);
    setError(null);

    try {
      // Get cached loadouts
      let cachedLoadouts = getCache('battle_loadouts', user.id);

      // Deserialize cached soul weapon builds (reconstruct shape objects)
      if (cachedLoadouts && shapes.length > 0) {
        cachedLoadouts = cachedLoadouts.map(loadout => {
          if (loadout.soulWeaponBuild) {
            return {
              ...loadout,
              soulWeaponBuild: deserializeSoulWeaponBuild(loadout.soulWeaponBuild, shapes)
            };
          }
          return loadout;
        });
      }

      // Fetch from GitHub (already deserialized by getUserLoadouts service)
      const githubLoadouts = await getUserLoadouts(
        config.wiki.repository.owner,
        config.wiki.repository.repo,
        user.login,
        user.id
      );

      // Merge cached data with GitHub data, prioritizing cache for recent updates
      const mergedLoadouts = mergeCacheWithGitHub(cachedLoadouts, githubLoadouts);
      const sortedLoadouts = mergedLoadouts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      setInternalSavedLoadouts(sortedLoadouts);

      // Notify parent of the loaded loadouts
      if (onLoadoutsChange) {
        onLoadoutsChange(sortedLoadouts);
      }

      // Update cache with merged results
      setCache('battle_loadouts', user.id, mergedLoadouts);
    } catch (err) {
      logger.error('Failed to load loadouts:', { error: err });
      setError('Failed to load saved loadouts');
    } finally {
      setLoading(false);
    }
  };

  const deleteLoadout = async (loadoutId) => {
    if (!user || !isAuthenticated) return;
    if (!confirm('Delete this loadout?')) return;

    setError(null);

    try {
      const response = await fetch(getDeleteDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'battle-loadouts',
          username: user.login,
          userId: user.id,
          itemId: loadoutId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete loadout');
      }

      const data = await response.json();
      const sortedLoadouts = data.loadouts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      setInternalSavedLoadouts(sortedLoadouts);

      // Notify parent of the updated loadouts
      if (onLoadoutsChange) {
        onLoadoutsChange(sortedLoadouts);
      }

      // Update cache after deletion
      setCache('battle_loadouts', user.id, sortedLoadouts);
    } catch (err) {
      logger.error('Failed to delete loadout:', { error: err });
      setError(err.message || 'Failed to delete loadout');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getLoadoutSkills = (loadout) => {
    logger.debug('getLoadoutSkills called', {
      loadoutId: loadout.id,
      hasSkillBuild: !!loadout.skillBuild,
      hasSlots: !!loadout.skillBuild?.slots,
      slotsCount: loadout.skillBuild?.slots?.length,
      firstSlot: loadout.skillBuild?.slots?.[0]
    });

    if (!loadout.skillBuild?.slots) return [];
    if (!Array.isArray(skills) || skills.length === 0) return [];

    // Get skill objects from the skill build slots
    const loadoutSkills = loadout.skillBuild.slots
      .filter(slot => slot.skill || slot.skillId)
      .map(slot => {
        // Handle both full skill object and skillId reference
        if (slot.skill) {
          return slot.skill;
        } else if (slot.skillId) {
          const skill = skills.find(s => s.id === slot.skillId);
          return skill;
        }
        return null;
      })
      .filter(skill => skill); // Remove nulls and undefined (truthy check)

    logger.debug('getLoadoutSkills result', {
      loadoutId: loadout.id,
      skillsCount: loadoutSkills.length
    });

    return loadoutSkills;
  };

  const getLoadoutSpirits = (loadout) => {
    if (!loadout.spiritBuild?.slots) return [];
    if (!Array.isArray(spirits) || spirits.length === 0) return [];

    // Get spirit objects from the spirit build slots
    const loadoutSpirits = loadout.spiritBuild.slots
      .filter(slot => slot.spirit || slot.spiritId)
      .map(slot => {
        // Handle both full spirit object and spiritId reference
        if (slot.spirit) {
          return slot.spirit;
        } else if (slot.spiritId) {
          const spirit = spirits.find(s => s.id === slot.spiritId);
          return spirit;
        }
        return null;
      })
      .filter(spirit => spirit !== null);

    return loadoutSpirits;
  };

  const getLoadoutWeapon = (loadout) => {
    if (!loadout.soulWeaponBuild?.weaponId) return null;
    if (!Array.isArray(weapons) || weapons.length === 0) return null;

    const weapon = weapons.find(w => w.id === loadout.soulWeaponBuild.weaponId);
    return weapon || null;
  };

  const getLoadoutStones = (loadout) => {
    logger.debug('getLoadoutStones called', {
      loadoutId: loadout.id,
      hasSkillStoneBuild: !!loadout.skillStoneBuild,
      hasSlots: !!loadout.skillStoneBuild?.slots,
      slotsCount: loadout.skillStoneBuild?.slots?.length,
      hasStoneData: !!stoneData,
      skillStoneBuild: loadout.skillStoneBuild
    });

    if (!loadout.skillStoneBuild?.slots) return [];
    if (!stoneData) return [];

    // Get stones from the skill stone build
    const stones = loadout.skillStoneBuild.slots.filter(slot => slot.type && slot.element && slot.tier);

    logger.debug('getLoadoutStones result', {
      loadoutId: loadout.id,
      stonesCount: stones.length,
      stones
    });

    return stones;
  };

  const handleLoadLoadout = (loadout) => {
    const confirmed = window.confirm(
      `Loading "${loadout.name}" will replace your current loadout. Continue?`
    );
    if (!confirmed) return;

    onLoadLoadout(loadout);

    // Update URL with loadout parameter
    const currentHash = window.location.hash.split('?')[0];
    const newHash = `${currentHash}?loadout=${loadout.id}`;
    window.history.replaceState(null, '', newHash);
  };

  if (!isAuthenticated) {
    return (
      <>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
          <div className="text-center">
            <Save className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Sign In to Save Loadouts
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Sign in with GitHub to save your battle loadouts and access them anytime.
            </p>
            <button
              onClick={loginFlow.handleLogin}
              disabled={loginFlow.isLoading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loginFlow.isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign in</span>
                </>
              )}
            </button>
          </div>
        </div>

        <LoginModal
          showModal={loginFlow.showModal}
          deviceFlow={loginFlow.deviceFlow}
          error={loginFlow.error}
          isWaiting={loginFlow.isWaiting}
          onCancel={loginFlow.handleCancel}
          onCopyCode={loginFlow.copyUserCode}
          onOpenGitHub={loginFlow.openGitHub}
        />
      </>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Save className="w-5 h-5" />
          <span>Saved Loadouts</span>
        </h3>
        <div className="p-2 text-gray-600 dark:text-gray-400">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {isExpanded && (
        <>
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!loading && savedLoadouts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                No saved loadouts yet. Configure your loadout and click "Save Loadout" in the footer to save it.
              </p>
            </div>
          )}

          {/* Loadouts List */}
          {!loading && savedLoadouts.length > 0 && (
            <div className="max-h-[230px] overflow-y-auto space-y-2 pr-2">
              {savedLoadouts.map((loadout) => {
            const isCurrentlyLoaded = currentLoadedLoadoutId === loadout.id;
            return (
              <div
                key={loadout.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isCurrentlyLoaded
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500'
                }`}
              >
                <button
                  onClick={() => handleLoadLoadout(loadout)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-2 mb-1 min-w-0">
                    <h4 className={`font-semibold truncate max-w-[140px] sm:max-w-[200px] md:max-w-none ${
                      isCurrentlyLoaded
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {loadout.name}
                    </h4>
                    {isCurrentlyLoaded && (
                      <span className="hidden sm:inline text-xs font-medium text-blue-600 dark:text-blue-400 flex-shrink-0">
                        (Loaded)
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${
                    isCurrentlyLoaded
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(loadout.updatedAt)}</span>
                  </div>
                </button>

                {/* Preview Icons */}
                <div className="flex-shrink-0 flex gap-2 items-center">
                  {/* Skill Stones Section (First - hidden on mobile) */}
                  {getLoadoutStones(loadout).length > 0 && (
                    <div className="hidden sm:flex flex-shrink-0 -space-x-8 justify-end">
                      {getLoadoutStones(loadout).map((stone, index) => (
                        <div key={index} style={{ transform: 'scale(0.36)', transformOrigin: 'right' }}>
                          <SkillStone
                            stoneType={stone.type}
                            element={stone.element}
                            tier={stone.tier}
                            data={stoneData}
                            size="small"
                            disableHover={true}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Spirits Section */}
                  {getLoadoutSpirits(loadout).length > 0 && (
                    <div className="flex flex-wrap gap-0.5 max-w-[52px] sm:max-w-none">
                      {getLoadoutSpirits(loadout).map((spirit, index) => {
                        return (
                          <div
                            key={index}
                            className="w-[24px] h-[24px] sm:w-[29px] sm:h-[29px] rounded overflow-hidden"
                            title={spirit.name}
                          >
                            <img
                              src={spirit.thumbnail || spirit.image}
                              alt={spirit.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Soul Weapon Section (hidden on mobile) */}
                  {getLoadoutWeapon(loadout) && (
                    <div className="hidden sm:block flex-shrink-0">
                      <div
                        className="w-[32px] h-[32px] sm:w-[38px] sm:h-[38px] rounded-lg border border-purple-500 dark:border-purple-400 overflow-hidden bg-gray-900"
                        title={getLoadoutWeapon(loadout).name}
                      >
                        <img
                          src={getLoadoutWeapon(loadout).image}
                          alt={getLoadoutWeapon(loadout).name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}

                  {/* Skills Section (Right) */}
                  {getLoadoutSkills(loadout).length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-0.5">
                      {getLoadoutSkills(loadout).map((skill, index) => {
                        const gradeColors = getSkillGradeColor(skill.grade);
                        return (
                          <div
                            key={index}
                            className={`w-5 h-5 rounded border ${gradeColors.border} ${gradeColors.glow} overflow-hidden`}
                            title={skill.name}
                          >
                            <img
                              src={skill.icon}
                              alt={skill.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => deleteLoadout(loadout.id)}
                  className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete loadout"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SavedLoadoutsPanel;

