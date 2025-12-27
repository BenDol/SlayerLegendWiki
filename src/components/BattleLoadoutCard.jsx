import React, { useState, useEffect } from 'react';
import { Share2, Copy, Loader, Check, AlertCircle } from 'lucide-react';
import SkillSlot from './SkillSlot';
import SpiritComponent from './SpiritComponent';
import SoulWeaponEngravingGrid from './SoulWeaponEngravingGrid';
import SkillStone from './SkillStone';
import BattleLoadoutModal from './BattleLoadoutModal';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { loadBuild, saveBuild, generateShareUrl } from '../../wiki-framework/src/services/github/buildShare';
import {
  deserializeLoadout,
  serializeLoadoutForStorage,
  serializeLoadoutForSharing,
  isLoadoutId
} from '../utils/battleLoadoutSerializer';
import { getSaveDataEndpoint, getLoadDataEndpoint } from '../utils/apiEndpoints';
import { getSkillGradeColor } from '../config/rarityColors';
import { createLogger } from '../utils/logger';

const logger = createLogger('BattleLoadoutCard');

/**
 * BattleLoadoutCard Component
 *
 * Displays a battle loadout in a compact card format resembling the Battle Loadouts builder.
 * Shows a miniature version of the actual builder interface.
 *
 * Display modes:
 * - Compact: Very dense icon grid (~150px height)
 * - Detailed: Builder-like layout scaled down (~400px height)
 * - Advanced: Full builder-like layout (~600px height)
 */
const BattleLoadoutCard = ({ identifier, mode = 'detailed', showActions = true }) => {
  const { isAuthenticated, user } = useAuthStore();

  // Data state
  const [loadout, setLoadout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Game data
  const [skills, setSkills] = useState([]);
  const [spirits, setSpirits] = useState([]);
  const [mySpirits, setMySpirits] = useState([]);
  const [allSkillBuilds, setAllSkillBuilds] = useState([]);
  const [allSpiritBuilds, setAllSpiritBuilds] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [skillStonesData, setSkillStonesData] = useState(null);
  const [shapes, setShapes] = useState([]);

  // Action state
  const [sharing, setSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [duplicating, setDuplicating] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [duplicatedLoadout, setDuplicatedLoadout] = useState(null);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);

  // Load game data
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const [skillsRes, spiritsRes, weaponsRes, skillStonesRes, shapesRes] = await Promise.all([
          fetch('/data/skills.json'),
          fetch('/data/spirit-characters.json'),
          fetch('/data/soul-weapons.json'),
          fetch('/data/skill_stones.json'),
          fetch('/data/soul-weapon-engravings.json')
        ]);

        const skillsData = await skillsRes.json();
        const spiritsData = await spiritsRes.json();
        const weaponsData = await weaponsRes.json();
        const skillStonesDataRes = await skillStonesRes.json();
        const shapesData = await shapesRes.json();

        setSkills(skillsData);
        setSpirits(spiritsData.spirits || []);
        setWeapons(weaponsData || []); // soul-weapons.json is a direct array
        setSkillStonesData(skillStonesDataRes);
        setShapes(shapesData.shapes || []);

        logger.debug('Game data loaded', {
          skillsCount: skillsData?.length || 0,
          spiritsCount: spiritsData.spirits?.length || 0,
          weaponsCount: weaponsData?.length || 0,
          shapesCount: shapesData.shapes?.length || 0
        });
      } catch (err) {
        logger.error('Failed to load game data', { error: err });
      }
    };

    loadGameData();
  }, []);

  // Load user's builds and spirits (if authenticated)
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const loadUserData = async () => {
      try {
        const [skillBuildsRes, spiritBuildsRes, mySpiritsRes] = await Promise.all([
          fetch(getLoadDataEndpoint() + '?type=skill-builds&userId=' + user.id),
          fetch(getLoadDataEndpoint() + '?type=spirit-builds&userId=' + user.id),
          fetch(getLoadDataEndpoint() + '?type=my-spirits&userId=' + user.id)
        ]);

        const skillBuildsData = await skillBuildsRes.json();
        const spiritBuildsData = await spiritBuildsRes.json();
        const mySpiritsData = await mySpiritsRes.json();

        setAllSkillBuilds(skillBuildsData.builds || []);
        setAllSpiritBuilds(spiritBuildsData.builds || []);
        setMySpirits(mySpiritsData.spirits || []);
      } catch (err) {
        logger.error('Failed to load user data', { error: err });
      }
    };

    loadUserData();
  }, [isAuthenticated, user]);

  // Load loadout data
  useEffect(() => {
    if (!identifier || skills.length === 0 || spirits.length === 0) return;

    const loadLoadoutData = async () => {
      setLoading(true);
      setError(null);

      try {
        let loadoutData = null;

        if (isLoadoutId(identifier)) {
          // Load by ID (requires auth)
          if (!isAuthenticated || !user) {
            throw new Error('You must be logged in to view saved loadouts');
          }

          const response = await fetch(
            getLoadDataEndpoint() + `?type=battle-loadouts&userId=${user.id}`
          );

          if (!response.ok) {
            throw new Error('Failed to load loadouts');
          }

          const data = await response.json();
          const found = data.loadouts?.find(l => l.id === identifier);

          if (!found) {
            throw new Error('Loadout not found. It may have been deleted.');
          }

          loadoutData = found;
        } else {
          // Load by checksum (public)
          const config = await fetch('/wiki-config.json').then(r => r.json());
          const owner = config.wiki.repository.owner;
          const repo = config.wiki.repository.repo;

          loadoutData = await loadBuild(owner, repo, identifier);

          if (!loadoutData) {
            throw new Error('Shared loadout not found');
          }
        }

        // Deserialize loadout
        const deserialized = deserializeLoadout(
          loadoutData,
          skills,
          spirits,
          mySpirits,
          allSkillBuilds,
          allSpiritBuilds,
          shapes
        );

        setLoadout(deserialized);

        // Debug skill stone data
        logger.info('CARD: Loadout loaded in BattleLoadoutCard', {
          loadoutId: deserialized.id,
          loadoutName: deserialized.name,
          hasSkillStone: !!deserialized.skillStone,
          skillStone: deserialized.skillStone,
          hasSkillStoneBuild: !!deserialized.skillStoneBuild,
          skillStoneBuild: deserialized.skillStoneBuild,
          rawLoadoutDataSkillStoneBuild: loadoutData.skillStoneBuild
        });

        // Debug weapon data
        if (deserialized.soulWeaponBuild?.weaponId) {
          const weapon = weapons?.find(w => w.id === deserialized.soulWeaponBuild.weaponId);
          logger.debug('Soul weapon data', {
            weaponId: deserialized.soulWeaponBuild.weaponId,
            weaponName: deserialized.soulWeaponBuild.weaponName,
            hasWeaponData: !!weapon,
            hasGridState: !!deserialized.soulWeaponBuild.gridState,
            gridSize: deserialized.soulWeaponBuild.gridState?.length
          });
        }

        logger.info('Loadout loaded successfully', { name: deserialized.name });
      } catch (err) {
        logger.error('Failed to load loadout', { error: err, identifier });
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadLoadoutData();
  }, [identifier, skills, spirits, mySpirits, allSkillBuilds, allSpiritBuilds, isAuthenticated, user, weapons]);

  // Share handler
  const handleShare = async () => {
    if (!loadout) return;

    setSharing(true);
    setShareError(null);
    setShareSuccess(false);

    try {
      const config = await fetch('/wiki-config.json').then(r => r.json());
      const owner = config.wiki.repository.owner;
      const repo = config.wiki.repository.repo;

      const shareData = serializeLoadoutForSharing(loadout);
      const checksum = await saveBuild(owner, repo, 'battle-loadouts', shareData);
      const shareUrl = generateShareUrl(window.location.origin, 'battle-loadouts', checksum);

      await navigator.clipboard.writeText(shareUrl);

      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);

      logger.info('Loadout shared', { checksum, loadoutName: loadout.name });

      if (window.triggerDonationPrompt) {
        window.triggerDonationPrompt('Thank you for sharing your loadout!');
      }
    } catch (err) {
      logger.error('Failed to share loadout', { error: err });
      setShareError(err.message);
    } finally {
      setSharing(false);
    }
  };

  // Duplicate handler
  const handleDuplicate = async () => {
    if (!loadout || !isAuthenticated || !user) return;

    setDuplicating(true);

    try {
      // Use serializeLoadoutForSharing to embed full build data (not IDs)
      // This makes the duplicated loadout independent with no references to other builds
      const serialized = serializeLoadoutForSharing({
        ...loadout,
        name: `Copy of ${loadout.name}`
      });

      delete serialized.id;
      delete serialized.createdAt;
      delete serialized.updatedAt;

      logger.info('Duplicating loadout', {
        username: user.login,
        userId: user.id,
        serializedData: serialized
      });

      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'battle-loadouts',
          username: user.login,
          userId: user.id,
          data: serialized
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        logger.error('API returned error', { status: response.status, errorData });
        throw new Error(errorData.error || 'Failed to save loadout');
      }

      const result = await response.json();

      logger.info('Loadout duplicated', {
        originalName: loadout.name,
        newLoadouts: result.loadouts?.length
      });

      // Find the newly created loadout from the response
      const newLoadout = result.loadouts?.find(l => l.name === `Copy of ${loadout.name}`);

      if (newLoadout) {
        logger.info('Found duplicated loadout in response', {
          newLoadoutId: newLoadout.id,
          newLoadoutName: newLoadout.name,
          hasSpiritBuild: !!newLoadout.spiritBuild,
          hasSkillBuild: !!newLoadout.skillBuild
        });

        // Deserialize the loadout so spirit/skill IDs are resolved to full objects
        const deserializedLoadout = deserializeLoadout(
          newLoadout,
          skills,
          spirits,
          mySpirits,
          allSkillBuilds,
          allSpiritBuilds,
          shapes
        );

        logger.info('Deserialized duplicated loadout', {
          hasSpiritBuildSlots: !!deserializedLoadout.spiritBuild?.slots,
          firstSpiritSlot: deserializedLoadout.spiritBuild?.slots?.[0]
        });

        setDuplicatedLoadout(deserializedLoadout);
      } else {
        logger.warn('Could not find duplicated loadout in response, using serialized data');
        setDuplicatedLoadout({
          ...serialized,
          id: result.loadouts?.[0]?.id
        });
      }

      setShowDuplicateConfirm(true);

      if (window.triggerDonationPrompt) {
        window.triggerDonationPrompt('Thanks for duplicating this loadout!');
      }
    } catch (err) {
      logger.error('Failed to duplicate loadout', { error: err });
      alert(`Failed to duplicate: ${err.message}`);
    } finally {
      setDuplicating(false);
    }
  };

  // Open editor modal
  const handleOpenEditor = () => {
    setShowDuplicateConfirm(false);
    setShowEditorModal(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="not-prose bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="not-prose bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 dark:text-red-200 font-semibold m-0">
              Failed to load loadout
            </p>
            <p className="text-red-600 dark:text-red-300 text-sm mt-1 m-0">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!loadout) return null;

  // Render based on mode
  return (
    <>
      <div className="not-prose bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white m-0">{loadout.name}</h3>
            {showActions && (
              <div className="flex items-center gap-2">
                {isAuthenticated && (
                  <button
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                    title="Duplicate"
                  >
                    {duplicating ? <Loader className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Share"
                >
                  {sharing ? <Loader className="w-3 h-3 animate-spin" /> : shareSuccess ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {mode === 'compact' && <CompactLoadout loadout={loadout} weapons={weapons} skillStonesData={skillStonesData} />}
          {mode === 'detailed' && <DetailedLoadout loadout={loadout} weapons={weapons} skillStonesData={skillStonesData} />}
          {mode === 'advanced' && <AdvancedLoadout loadout={loadout} weapons={weapons} skillStonesData={skillStonesData} />}
        </div>
      </div>

      {/* Duplicate confirmation popup */}
      {showDuplicateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Loadout Duplicated!
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              "{loadout.name}" has been copied to your collection. Would you like to open the
              editor now?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDuplicateConfirm(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Maybe Later
              </button>
              <button
                onClick={handleOpenEditor}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                Open Editor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor modal */}
      {showEditorModal && duplicatedLoadout && (
        <BattleLoadoutModal
          isOpen={showEditorModal}
          onClose={() => {
            setShowEditorModal(false);
            setDuplicatedLoadout(null);
          }}
          initialLoadout={duplicatedLoadout}
        />
      )}
    </>
  );
};

/**
 * Compact mode: Very dense icon grid
 */
const CompactLoadout = ({ loadout, weapons, skillStonesData }) => {
  const hasSkills = loadout.skillBuild?.slots?.some(s => s.skill);
  const hasSpirits = loadout.spiritBuild?.slots?.some(s => s.spirit);
  const hasSoulWeapon = loadout.soulWeaponBuild?.weaponId;

  // Find weapon data
  const weapon = weapons?.find(w => w.id === loadout.soulWeaponBuild?.weaponId);

  // Calculate engraving count
  const engravingCount = hasSoulWeapon
    ? loadout.soulWeaponBuild.gridState?.flat().filter(Boolean).length || 0
    : 0;

  return (
    <div className="space-y">
      {/* Skills - Dense grid */}
      {hasSkills && (
        <div>
          <div className="max-w-xs transform scale-75 origin-top-left">
            <div className="grid grid-cols-5 gap-1">
              {loadout.skillBuild.slots.map((slot, idx) => (
                <div key={idx} className="relative">
                  {slot.skill ? (
                    <div className={`w-full aspect-square rounded border ${getSkillGradeColor(slot.skill.grade).border} overflow-hidden`}>
                      <img src={slot.skill.icon} alt={slot.skill.name} className="w-full h-full object-contain" title={slot.skill.name} />
                    </div>
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spirits - Fixed 3-column grid, compact with animations */}
      {hasSpirits && (
        <div>
          <div className="flex items-start -space-x-8">
            {loadout.spiritBuild.slots.map((slot, idx) => (
              <div key={idx} className="flex-shrink-0">
                {slot.spirit ? (
                  <div className="transform scale-[0.70] origin-top-left">
                    <SpiritComponent
                      spirit={slot.spirit}
                      level={slot.level}
                      awakeningLevel={slot.awakeningLevel}
                      evolutionLevel={slot.evolutionLevel}
                      compact={true}
                      showName={false}
                      className="!items-start"
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Soul Weapon - Image + Name Tag + Mini Grid */}
      {hasSoulWeapon && (
        <div className="-mt-1.5">
          <div className="flex gap-2 items-start max-w-xs">
            {/* Weapon Image with Name Tag + Stats */}
            {weapon && (
              <div className="flex-shrink-0">
                <div className="relative w-10 h-10 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded border border-purple-400/50 dark:border-purple-500/50 p-0.5">
                  <img
                    src={weapon.image}
                    alt={weapon.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.src = '/images/equipment/weapons/sword_201.png';
                    }}
                  />
                  {/* Name Tag Overlay */}
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-gray-900/90 dark:bg-gray-950/90 px-1 py-[1px] rounded shadow">
                    <span className="text-[7px] font-semibold text-white whitespace-nowrap leading-none block">{weapon.name}</span>
                  </div>
                </div>
              </div>
            )}
            {/* Mini Grid */}
            {weapon && loadout.soulWeaponBuild.gridState ? (
              <div className="flex-1 overflow-hidden" style={{ maxWidth: '100px', maxHeight: '100px' }}>
                <div className="transform scale-[0.35] origin-top-left" style={{ width: '285px', height: '285px' }}>
                  <SoulWeaponEngravingGrid
                    gridState={loadout.soulWeaponBuild.gridState}
                    selectedWeapon={weapon}
                    cellSize={50}
                    readOnly={true}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 text-xs text-gray-400 italic">
                Grid unavailable
              </div>
            )}
          </div>
        </div>
      )}

      {/* Skill Stones */}
      {loadout.skillStoneBuild?.slots?.some(s => s.element && s.tier) && (
        <div className="mt-6">
          <div className="flex -space-x-7 justify-start">
            {loadout.skillStoneBuild.slots.map((slot, index) => (
              <div key={index} className="flex-shrink-0">
                {slot.element && slot.tier ? (
                  <div className="transform scale-50 origin-top-left">
                    <SkillStone
                      stoneType={slot.type}
                      element={slot.element}
                      tier={slot.tier}
                      data={skillStonesData}
                      size="medium"
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Detailed mode: Builder-like layout scaled down
 */
const DetailedLoadout = ({ loadout, weapons, skillStonesData }) => {
  const hasSkills = loadout.skillBuild?.slots?.some(s => s.skill);
  const hasSpirits = loadout.spiritBuild?.slots?.some(s => s.spirit);
  const hasSoulWeapon = loadout.soulWeaponBuild?.weaponId;

  // Find weapon data
  const weapon = weapons?.find(w => w.id === loadout.soulWeaponBuild?.weaponId);

  // Calculate engraving stats
  const engravingCount = hasSoulWeapon
    ? loadout.soulWeaponBuild.gridState?.flat().filter(Boolean).length || 0
    : 0;
  const totalSlots = hasSoulWeapon
    ? loadout.soulWeaponBuild.gridState?.flat().length || 0
    : 0;

  return (
    <div className="space-y-4 -mx-1">
      {/* Skills Section - More compact */}
      {hasSkills && (
        <div className="px-1">
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">⚔️ Skills</h4>
          <div className="grid grid-cols-5 gap-y-2 w-[400px]">
            {loadout.skillBuild.slots.map((slot, idx) => (
              <SkillSlot
                key={idx}
                skill={slot.skill}
                level={slot.level}
                slotNumber={idx + 1}
                readOnly={true}
                className="!items-start"
              />
            ))}
          </div>
        </div>
      )}

      {/* Spirits Section - Single row */}
      {hasSpirits && (
        <div className="px-1">
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">🔮 Spirits</h4>
          <div className="flex gap-2 max-w-md items-start">
            {loadout.spiritBuild.slots.map((slot, idx) => (
              <div key={idx} className="flex-shrink-0">
                {slot.spirit ? (
                  <SpiritComponent
                    spirit={slot.spirit}
                    level={slot.level}
                    awakeningLevel={slot.awakeningLevel}
                    evolutionLevel={slot.evolutionLevel}
                    compact={true}
                    className="!items-start"
                  />
                ) : (
                  <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Soul Weapon Section - Image + Info + Grid */}
      {hasSoulWeapon && (
        <div>
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">⚔️ Soul Weapon</h4>
          <div className="flex gap-3 items-start max-w-md">
            {/* Weapon Image with Name Tag + Stats */}
            {weapon && (
              <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2 min-w-[140px]">
                {/* Weapon Image */}
                <div className="flex justify-center">
                  <div className="relative w-14 h-14 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg border-2 border-purple-400/50 dark:border-purple-500/50 p-1">
                    <img
                      src={weapon.image}
                      alt={weapon.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.src = '/images/equipment/weapons/sword_201.png';
                      }}
                    />
                    {/* Name Tag Overlay */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-gray-900/90 dark:bg-gray-950/90 px-1.5 py-[2px] rounded shadow">
                      <span className="text-[8px] font-semibold text-white whitespace-nowrap leading-none block">{weapon.name}</span>
                    </div>
                  </div>
                </div>
                {/* Weapon Stats */}
                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center justify-between py-0.5 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">ATK</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">{weapon.attack.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Required</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{weapon.requirements.toLocaleString()} 🔮</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-gray-600 dark:text-gray-400">Stage</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{weapon.stageRequirement}</span>
                  </div>
                </div>
              </div>
            )}
            {/* Grid */}
            {weapon && loadout.soulWeaponBuild.gridState ? (
              <div className="flex-1 overflow-hidden" style={{ maxWidth: '180px', maxHeight: '180px' }}>
                <div className="transform scale-[0.6] origin-top-left" style={{ width: '300px', height: '300px' }}>
                  <SoulWeaponEngravingGrid
                    gridState={loadout.soulWeaponBuild.gridState}
                    selectedWeapon={weapon}
                    cellSize={54}
                    readOnly={true}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400 italic p-4">
                Grid unavailable
              </div>
            )}
          </div>
        </div>
      )}

      {/* Skill Stones Section */}
      {loadout.skillStoneBuild?.slots?.some(s => s.element && s.tier) && (
        <div className="px-1">
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">💎 Skill Stones</h4>
          <div className="flex gap-2 justify-start">
            {loadout.skillStoneBuild.slots.map((slot, index) => (
              <div key={index} className="flex flex-col items-center gap-1">
                {slot.element && slot.tier ? (
                  <SkillStone
                    stoneType={slot.type}
                    element={slot.element}
                    tier={slot.tier}
                    data={skillStonesData}
                    size="small"
                  />
                ) : (
                  <div className="w-16 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                    <span className="text-gray-400 dark:text-gray-500 text-xs">Empty</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Advanced mode: Full builder-like layout
 */
const AdvancedLoadout = ({ loadout, weapons, skillStonesData }) => {
  const hasSkills = loadout.skillBuild?.slots?.some(s => s.skill);
  const hasSpirits = loadout.spiritBuild?.slots?.some(s => s.spirit);
  const hasSoulWeapon = loadout.soulWeaponBuild?.weaponId;

  // Find weapon data
  const weapon = weapons?.find(w => w.id === loadout.soulWeaponBuild?.weaponId);

  // Calculate engraving stats
  const engravingCount = hasSoulWeapon
    ? loadout.soulWeaponBuild.gridState?.flat().filter(Boolean).length || 0
    : 0;
  const totalSlots = hasSoulWeapon
    ? loadout.soulWeaponBuild.gridState?.flat().length || 0
    : 0;

  return (
    <div className="space-y-6 -mx-2">
      {/* Skills Section - More compact */}
      {hasSkills && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 px-2">
          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3 px-1">⚔️ Skills</h4>
          <div className="grid grid-cols-5 gap-y-3 px-1 w-[450px]">
            {loadout.skillBuild.slots.map((slot, idx) => (
              <SkillSlot
                key={idx}
                skill={slot.skill}
                level={slot.level}
                slotNumber={idx + 1}
                readOnly={true}
                className="!items-start"
              />
            ))}
          </div>
        </div>
      )}

      {/* Spirits Section - Single row, closer together */}
      {hasSpirits && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 px-2">
          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3 px-1">🔮 Spirits</h4>
          <div className="flex gap-2 px-1 items-start" style={{ maxWidth: '500px' }}>
            {loadout.spiritBuild.slots.map((slot, idx) => (
              <div key={idx} className="flex-shrink-0">
                {slot.spirit ? (
                  <SpiritComponent
                    spirit={slot.spirit}
                    level={slot.level}
                    awakeningLevel={slot.awakeningLevel}
                    evolutionLevel={slot.evolutionLevel}
                    compact={false}
                    className="!items-start"
                  />
                ) : (
                  <div className="w-full h-24 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                    <span className="text-xs text-gray-400">Empty Slot</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Soul Weapon Section - Image + Info + Grid */}
      {hasSoulWeapon && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 px-2">
          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3 px-1">⚔️ Soul Weapon</h4>
          <div className="flex gap-4 items-start px-1" style={{ maxWidth: '500px' }}>
            {/* Weapon Image with Name Tag + Stats Panel */}
            {weapon && (
              <div className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3 min-w-[180px]">
                {/* Weapon Image */}
                <div className="flex justify-center">
                  <div className="relative w-[72px] h-[72px] bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg border-2 border-purple-400/50 dark:border-purple-500/50 p-1 shadow-lg">
                    <img
                      src={weapon.image}
                      alt={weapon.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.src = '/images/equipment/weapons/sword_201.png';
                      }}
                    />
                    {/* Name Tag Overlay */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-gray-900/90 dark:bg-gray-950/90 px-1.5 py-[2px] rounded shadow-lg">
                      <span className="text-[9px] font-semibold text-white whitespace-nowrap leading-none block">{weapon.name}</span>
                    </div>
                  </div>
                </div>
                {/* Weapon Stats */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-[11px] text-gray-600 dark:text-gray-400">ATK</span>
                    <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">{weapon.attack.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-[11px] text-gray-600 dark:text-gray-400">Required</span>
                    <span className="text-[11px] font-semibold text-gray-900 dark:text-white">{weapon.requirements.toLocaleString()} 🔮</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-[11px] text-gray-600 dark:text-gray-400">Stage</span>
                    <span className="text-[11px] font-semibold text-gray-900 dark:text-white">{weapon.stageRequirement}</span>
                  </div>
                </div>
              </div>
            )}
            {/* Grid */}
            {weapon && loadout.soulWeaponBuild.gridState ? (
              <div className="flex-1 overflow-hidden" style={{ maxWidth: '240px', maxHeight: '240px' }}>
                <div className="transform scale-[0.8] origin-top-left" style={{ width: '300px', height: '300px' }}>
                  <SoulWeaponEngravingGrid
                    gridState={loadout.soulWeaponBuild.gridState}
                    selectedWeapon={weapon}
                    cellSize={54}
                    readOnly={true}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400 italic p-8">
                Grid unavailable
              </div>
            )}
          </div>
        </div>
      )}

      {/* Skill Stones Section */}
      {loadout.skillStoneBuild?.slots?.some(s => s.element && s.tier) && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 px-2">
          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3 px-1">💎 Skill Stones</h4>
          <div className="flex gap-4 justify-start px-1">
            {loadout.skillStoneBuild.slots.map((slot, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                {slot.element && slot.tier ? (
                  <SkillStone
                    stoneType={slot.type}
                    element={slot.element}
                    tier={slot.tier}
                    data={skillStonesData}
                    size="medium"
                  />
                ) : (
                  <div className="w-24 h-28 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                    <span className="text-gray-400 dark:text-gray-500 text-xs">Empty</span>
                  </div>
                )}
                {skillStonesData && slot.type && (
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {skillStonesData.stoneTypes[slot.type]?.name || slot.type}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BattleLoadoutCard;
