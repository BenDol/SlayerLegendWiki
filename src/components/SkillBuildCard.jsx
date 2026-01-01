import React, { useState, useEffect } from 'react';
import { Share2, Copy, Loader, Check, AlertCircle } from 'lucide-react';
import SkillSlot from './SkillSlot';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { loadBuild, saveBuild, generateShareUrl } from '../../wiki-framework/src/services/github/buildShare';
import { getLoadDataEndpoint } from '../utils/apiEndpoints';
import { getSkillGradeColor } from '../config/rarityColors';
import { createLogger } from '../utils/logger';
import { getCache, setCache } from '../utils/buildCache';

const logger = createLogger('SkillBuildCard');

// Constants for grid configuration
const GRID_COLS = 5;
const GRID_ROWS = 2;
const TOTAL_SLOTS = GRID_COLS * GRID_ROWS;

/**
 * Check if identifier looks like a build ID
 */
const isBuildId = (str) => {
  return /^skill-builds-\d+-[a-z0-9]+$/.test(str);
};

/**
 * SkillBuildCard Component
 *
 * Displays a skill build in a card format resembling the Skill Builder.
 * Shows a 2x5 grid of skill slots.
 *
 * Display modes:
 * - Compact: 70-75% scale, minimal spacing (~200px height)
 * - Detailed: 100% scale, standard spacing (~300px height)
 * - Advanced: 100% scale with extended stats (~400px height)
 */
const SkillBuildCard = ({ identifier, mode = 'detailed', showActions = true }) => {
  const { isAuthenticated, user } = useAuthStore();

  // Data state
  const [build, setBuild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Game data
  const [skills, setSkills] = useState([]);

  // Build owner ID (for loading from specific user's data)
  const [buildOwnerId, setBuildOwnerId] = useState(null);

  // Share state
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Display mode state (for preview toggle)
  const [currentMode, setCurrentMode] = useState(mode);

  // Load skills data
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const response = await fetch('/data/skills.json');
        const data = await response.json();
        setSkills(data);
      } catch (err) {
        logger.error('Failed to load skills', { error: err });
      }
    };

    loadSkills();
  }, []);

  // Load build data
  useEffect(() => {
    if (skills.length === 0) return;

    const loadBuildData = async () => {
      try {
        setLoading(true);
        setError(null);

        let buildData;

        // Check if identifier is in format "userId:buildId" or just "buildId"
        let targetUserId, targetBuildId;

        // Check for checksum format first (12 hex chars)
        if (identifier.length === 12 && /^[a-f0-9]+$/.test(identifier)) {
          // Checksum format - load from shared builds
          logger.debug('Loading shared build', { checksum: identifier });
          const sharedBuild = await loadBuild('skill-builds', identifier);
          buildData = deserializeSkillBuild(sharedBuild);
          setBuild(buildData);
          setLoading(false);
          return;
        }

        // Check if entire identifier is a build ID (old format)
        if (isBuildId(identifier)) {
          // Old format: just buildId (use current user's data)
          targetUserId = user?.id;
          targetBuildId = identifier;
        } else {
          // New format: userId:buildId (buildId may contain hyphens/numbers)
          // Split only on first colon
          const colonIndex = identifier.indexOf(':');
          if (colonIndex !== -1) {
            targetUserId = identifier.substring(0, colonIndex);
            targetBuildId = identifier.substring(colonIndex + 1);

            // Verify the build ID part looks valid
            if (!isBuildId(targetBuildId)) {
              throw new Error('Invalid build identifier format');
            }
          } else {
            throw new Error('Invalid build identifier format');
          }
        }

        if (targetBuildId) {
          // Load by ID from specific user's builds
          const response = await fetch(
            getLoadDataEndpoint() + `?type=skill-builds&userId=${targetUserId}`
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

          // Set owner ID for potential future use
          setBuildOwnerId(targetUserId);
        }

        // Deserialize the build
        const deserializedBuild = deserializeSkillBuild(buildData);
        setBuild(deserializedBuild);

        logger.debug('Loaded skill build', {
          buildId: buildData.id,
          buildName: buildData.name,
          ownerId: targetUserId
        });

      } catch (err) {
        logger.error('Failed to load build', { error: err, identifier });
        setError(err.message || 'Failed to load build');
      } finally {
        setLoading(false);
      }
    };

    loadBuildData();
  }, [identifier, skills, user]);

  /**
   * Deserialize build (skill IDs -> full skill objects)
   */
  const deserializeSkillBuild = (serializedBuild) => {
    return {
      ...serializedBuild,
      slots: serializedBuild.slots.map(slot => {
        if (slot.skillId !== undefined && slot.skillId !== null) {
          const skill = skills.find(s => s.id === slot.skillId);
          return {
            skill: skill || null,
            level: slot.level
          };
        }
        // Already deserialized or empty slot
        return slot;
      })
    };
  };

  /**
   * Serialize build for sharing (skill objects -> skill IDs)
   */
  const serializeSkillBuild = (buildToSerialize) => {
    return {
      name: buildToSerialize.name,
      maxSlots: buildToSerialize.maxSlots,
      slots: buildToSerialize.slots.map(slot => ({
        skillId: slot.skillId !== undefined ? slot.skillId : (slot.skill?.id || null),
        level: slot.level
      }))
    };
  };

  // Handle share
  const handleShare = async () => {
    if (!build) return;

    try {
      setSharing(true);

      // Get repository info from config
      const config = await fetch('/wiki-config.json').then(r => r.json());
      const owner = config.wiki.repository.owner;
      const repo = config.wiki.repository.repo;

      const serializedBuild = serializeSkillBuild(build);
      const checksum = await saveBuild(owner, repo, 'skill-builds', serializedBuild);
      const url = generateShareUrl(window.location.origin, 'skill-builds', checksum);

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

  // Get element icon
  const getElementIcon = (element) => {
    const icons = {
      Fire: '/images/content/icons/typeicon_fire_1.png',
      Water: '/images/content/icons/typeicon_water_1.png',
      Wind: '/images/content/icons/typeicon_wind_1.png',
      Earth: '/images/content/icons/typeicon_earth s_1.png'
    };
    return icons[element];
  };

  // Calculate build stats
  const getEquippedSkillsCount = () => {
    if (!build) return 0;
    return build.slots.filter(slot => slot.skill !== null).length;
  };

  const getElementDistribution = () => {
    if (!build) return {};
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

  const getAverageLevel = () => {
    if (!build) return 0;
    const equippedSlots = build.slots.filter(slot => slot.skill !== null);
    if (equippedSlots.length === 0) return 0;
    const totalLevel = equippedSlots.reduce((sum, slot) => sum + slot.level, 0);
    return (totalLevel / equippedSlots.length).toFixed(1);
  };

  const getTotalMpCost = () => {
    if (!build) return 0;
    return build.slots.reduce((sum, slot) => {
      if (slot.skill) {
        return sum + (slot.skill.mpCost || 0);
      }
      return sum;
    }, 0);
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

  // Get display slots (limit to maxSlots if defined)
  const displaySlots = build.slots.slice(0, build.maxSlots || TOTAL_SLOTS);

  // Pad to full grid
  const paddedSlots = [...displaySlots];
  while (paddedSlots.length < TOTAL_SLOTS) {
    paddedSlots.push({ skill: null, level: 1 });
  }

  return (
    <div className={`skill-build-card bg-surface-primary dark:bg-gray-800 rounded-lg shadow-floating overflow-hidden border border-gray-200 dark:border-gray-700 ${scaleClass}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white m-0">{build.name || 'Untitled Build'}</h3>
            <div className="flex items-center gap-2 text-xs text-white/80 mt-0.5">
              <span>{getEquippedSkillsCount()}/{build.maxSlots || TOTAL_SLOTS} Skills</span>
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

      {/* Skill Grid */}
      <div className="p-4">
        <div className="grid grid-cols-5 gap-2">
          {paddedSlots.map((slot, index) => (
            <SkillSlot
              key={index}
              skill={slot.skill}
              level={slot.level}
              locked={false}
              readOnly={true}
              onSkillClick={() => {}}
            />
          ))}
        </div>

        {/* Stats Panel - Detailed Mode */}
        {currentMode === 'detailed' && (
          <div className="mt-4 p-3 bg-surface-secondary dark:bg-gray-700/50 shadow-sm rounded-lg">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              {/* Element Distribution with Icons */}
              {Object.entries(getElementDistribution()).map(([element, count]) => (
                <div key={element} className="flex items-center gap-1.5" title={element}>
                  <img
                    src={getElementIcon(element)}
                    alt={element}
                    className="w-4 h-4"
                  />
                  <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Panel - Advanced Mode */}
        {currentMode === 'advanced' && (
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-surface-secondary dark:bg-gray-700/50 shadow-sm rounded-lg">
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total MP:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                    {getTotalMpCost()}
                  </span>
                </div>
                {/* Element Distribution with Icons */}
                {Object.entries(getElementDistribution()).map(([element, count]) => (
                  <div key={element} className="flex items-center gap-1.5" title={element}>
                    <img
                      src={getElementIcon(element)}
                      alt={element}
                      className="w-4 h-4"
                    />
                    <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillBuildCard;
