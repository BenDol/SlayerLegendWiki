import React, { useState, useEffect } from 'react';
import { Share2, Loader, Check, AlertCircle } from 'lucide-react';
import SpiritSlot from './SpiritSlot';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { loadBuild, saveBuild, generateShareUrl } from '../../wiki-framework/src/services/github/buildShare';
import { getLoadDataEndpoint } from '../utils/apiEndpoints';
import { createLogger } from '../utils/logger';
import { getCache, setCache } from '../utils/buildCache';
import { deserializeBuild, serializeBuildForSharing } from '../utils/spiritSerialization';

const logger = createLogger('SpiritBuildCard');

// Constants for grid configuration
const TOTAL_SLOTS = 3; // 1 companion + 2 partners

/**
 * Check if identifier looks like a build ID
 */
const isBuildId = (str) => {
  return /^spirit-builds-\d+-[a-z0-9]+$/.test(str);
};

/**
 * SpiritBuildCard Component
 *
 * Displays a spirit build in a card format resembling the Spirit Builder.
 * Shows 3 spirit slots (1 companion + 2 partners).
 *
 * Display modes:
 * - Compact: 70-75% scale, minimal spacing
 * - Detailed: 100% scale with stats
 * - Advanced: 100% scale with extended stats
 */
const SpiritBuildCard = ({ identifier, mode = 'detailed', showActions = true }) => {
  const { isAuthenticated, user } = useAuthStore();

  // Data state
  const [build, setBuild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Game data
  const [spirits, setSpirits] = useState([]);
  const [mySpirits, setMySpirits] = useState([]);

  // Build owner ID (for loading from specific user's data)
  const [buildOwnerId, setBuildOwnerId] = useState(null);

  // Share state
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Display mode state (for preview toggle)
  const [currentMode, setCurrentMode] = useState(mode);

  // Load spirits data (base spirits immediately, my-spirits when owner is known)
  useEffect(() => {
    const loadBaseSpirits = async () => {
      try {
        const response = await fetch('/data/spirits.json');
        const spiritsData = await response.json();
        setSpirits(spiritsData);
      } catch (err) {
        logger.error('Failed to load base spirits', { error: err });
      }
    };

    loadBaseSpirits();
  }, []);

  // Load my-spirits when build owner is known
  useEffect(() => {
    const loadMySpirits = async () => {
      try {
        const response = await fetch(getLoadDataEndpoint() + `?type=my-spirits&userId=${buildOwnerId}`);
        if (response.ok) {
          const mySpiritsData = await response.json();
          setMySpirits(mySpiritsData.spirits || []);
        }
      } catch (err) {
        logger.error('Failed to load my-spirits', { error: err });
      }
    };

    if (buildOwnerId) {
      loadMySpirits();
    }
  }, [buildOwnerId]);

  // Load build data
  useEffect(() => {
    if (spirits.length === 0) return;

    const loadBuildData = async () => {
      try {
        setLoading(true);
        setError(null);

        let buildData;

        // Check if identifier is checksum format first (12 hex chars)
        if (identifier.length === 12 && /^[a-f0-9]+$/.test(identifier)) {
          // Checksum format - load from shared builds
          logger.debug('Loading shared build', { checksum: identifier });
          const sharedBuild = await loadBuild('spirit-builds', identifier);
          buildData = sharedBuild;
        } else if (isBuildId(identifier)) {
          // Old format: just buildId (use current user's data)
          const targetUserId = user?.id;
          const targetBuildId = identifier;

          const response = await fetch(
            getLoadDataEndpoint() + `?type=spirit-builds&userId=${targetUserId}`
          );

          if (!response.ok) {
            throw new Error('Failed to load builds');
          }

          const data = await response.json();
          const found = data.builds?.find(b => b.id === targetBuildId);

          if (!found) {
            throw new Error('Build not found. It may have been deleted.');
          }

          buildData = found;
          setBuildOwnerId(targetUserId);
        } else {
          // New format: userId:buildId (buildId may contain hyphens/numbers)
          // Split only on first colon
          const colonIndex = identifier.indexOf(':');
          if (colonIndex !== -1) {
            const targetUserId = identifier.substring(0, colonIndex);
            const targetBuildId = identifier.substring(colonIndex + 1);

            // Verify the build ID part looks valid
            if (!isBuildId(targetBuildId)) {
              throw new Error('Invalid build identifier format');
            }

            const response = await fetch(
              getLoadDataEndpoint() + `?type=spirit-builds&userId=${targetUserId}`
            );

            if (!response.ok) {
              throw new Error('Failed to load builds');
            }

            const data = await response.json();
            const found = data.builds?.find(b => b.id === targetBuildId);

            if (!found) {
              throw new Error('Build not found. It may have been deleted.');
            }

            buildData = found;
            setBuildOwnerId(targetUserId);
          } else {
            throw new Error('Invalid build identifier format');
          }
        }

        // Deserialize the build
        const deserializedBuild = deserializeBuild(buildData, spirits, mySpirits);
        setBuild(deserializedBuild);

        logger.debug('Loaded spirit build', {
          buildId: buildData.id,
          buildName: buildData.name,
          ownerId: buildOwnerId
        });

      } catch (err) {
        logger.error('Failed to load build', { error: err, identifier });
        setError(err.message || 'Failed to load build');
      } finally {
        setLoading(false);
      }
    };

    loadBuildData();
  }, [identifier, spirits, mySpirits, user]);

  // Handle share
  const handleShare = async () => {
    if (!build) return;

    try {
      setSharing(true);

      // Get repository info from config
      const config = await fetch('/wiki-config.json').then(r => r.json());
      const owner = config.wiki.repository.owner;
      const repo = config.wiki.repository.repo;

      const serializedBuild = serializeBuildForSharing(build);
      const checksum = await saveBuild(owner, repo, 'spirit-builds', serializedBuild);
      const url = generateShareUrl(window.location.origin, 'spirit-builds', checksum);

      // Copy to clipboard automatically
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);

      logger.info('Generated share URL', {
        buildName: build.name,
        checksum,
        url
      });

      // Trigger donation prompt
      if (window.triggerDonationPrompt) {
        window.triggerDonationPrompt('Thank you for sharing your build!');
      }
    } catch (err) {
      logger.error('Failed to share build', { error: err });
    } finally {
      setSharing(false);
    }
  };

  // Calculate build stats
  const getEquippedSpiritsCount = () => {
    if (!build) return 0;
    return build.slots.filter(slot => slot.spirit !== null).length;
  };

  const getAverageLevel = () => {
    if (!build) return 0;
    const equippedSlots = build.slots.filter(slot => slot.spirit !== null);
    if (equippedSlots.length === 0) return 0;
    const totalLevel = equippedSlots.reduce((sum, slot) => sum + (slot.level || 0), 0);
    return (totalLevel / equippedSlots.length).toFixed(1);
  };

  const getAverageAwakening = () => {
    if (!build) return 0;
    const equippedSlots = build.slots.filter(slot => slot.spirit !== null);
    if (equippedSlots.length === 0) return 0;
    const totalAwakening = equippedSlots.reduce((sum, slot) => sum + (slot.awakeningLevel || 0), 0);
    return (totalAwakening / equippedSlots.length).toFixed(1);
  };

  const getAverageEvolution = () => {
    if (!build) return 0;
    const equippedSlots = build.slots.filter(slot => slot.spirit !== null);
    if (equippedSlots.length === 0) return 0;
    const totalEvolution = equippedSlots.reduce((sum, slot) => sum + (slot.evolutionLevel || 0), 0);
    return (totalEvolution / equippedSlots.length).toFixed(1);
  };

  // Scale factor for compact mode
  const scaleClass = currentMode === 'compact' ? 'scale-75' : '';

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-400 font-semibold mb-1">Failed to Load Build</h3>
            <p className="text-red-300/80 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!build) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-6">
        <p className="text-yellow-300">Build data is not available.</p>
      </div>
    );
  }

  return (
    <div className={`spirit-build-card bg-surface-primary dark:bg-gray-800 rounded-lg shadow-floating overflow-hidden border border-gray-200 dark:border-gray-700 ${scaleClass}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white m-0">{build.name || 'Untitled Build'}</h3>
            <div className="flex items-center gap-2 text-xs text-white/80 mt-0.5">
              <span>{getEquippedSpiritsCount()}/{TOTAL_SLOTS} Spirits</span>
              {build.username && (
                <>
                  <span>•</span>
                  <span>by {build.username}</span>
                </>
              )}
            </div>
          </div>

          {/* Share Action - Icon Only */}
          {showActions && (
            <button
              onClick={handleShare}
              disabled={sharing}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs transition-colors disabled:opacity-50"
              title={copied ? 'Copied!' : 'Share build'}
            >
              {sharing ? (
                <Loader className="w-3 h-3 animate-spin" />
              ) : copied ? (
                <Check className="w-3 h-3" />
              ) : (
                <Share2 className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Spirit Grid */}
      <div className="p-4">
        <div className="flex gap-4 justify-center">
          {build.slots.slice(0, TOTAL_SLOTS).map((slot, index) => (
            <div key={index} className="flex flex-col items-center">
              {index === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Companion</div>
              )}
              {index === 1 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Partner</div>
              )}
              {index === 2 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Partner</div>
              )}
              <SpiritSlot
                slot={slot}
                spirit={slot.spirit}
                level={slot.level}
                awakeningLevel={slot.awakeningLevel}
                evolutionLevel={slot.evolutionLevel}
                skillEnhancementLevel={slot.skillEnhancementLevel}
                isCompanionSlot={index === 0}
                slotNumber={index + 1}
                readOnly={true}
                onSelectSpirit={() => {}}
                onRemoveSpirit={() => {}}
              />
            </div>
          ))}
        </div>

        {/* Stats Panel - Detailed Mode */}
        {currentMode === 'detailed' && (
          <div className="mt-4 p-3 bg-surface-secondary dark:bg-gray-700/50 shadow-sm rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-600 dark:text-gray-400">Spirits</div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {getEquippedSpiritsCount()}/{TOTAL_SLOTS}
                </div>
              </div>
              <div>
                <div className="text-gray-600 dark:text-gray-400">Avg Level</div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {getAverageLevel()}
                </div>
              </div>
              <div>
                <div className="text-gray-600 dark:text-gray-400">Avg Awakening</div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {getAverageAwakening()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Panel - Advanced Mode */}
        {currentMode === 'advanced' && (
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-surface-secondary dark:bg-gray-700/50 shadow-sm rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Spirits</div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {getEquippedSpiritsCount()}/{TOTAL_SLOTS}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Avg Level</div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {getAverageLevel()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Avg Evolution</div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {getAverageEvolution()}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 bg-surface-secondary dark:bg-gray-700/50 shadow-sm rounded-lg">
              <div className="text-sm">
                <div className="text-gray-600 dark:text-gray-400 mb-2">Awakening Stats</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-700 dark:text-gray-300">Average</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{getAverageAwakening()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-700 dark:text-gray-300">Total Spirits</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{getEquippedSpiritsCount()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpiritBuildCard;
