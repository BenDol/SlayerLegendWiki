import React, { useState, useEffect } from 'react';
import { Share2, Download, Upload, Settings, Trash2, Copy, Check } from 'lucide-react';
import SkillSlot from './SkillSlot';
import SkillSelector from './SkillSelector';
import { encodeBuild, decodeBuild } from '../../wiki-framework/src/components/wiki/BuildEncoder';

/**
 * SkillBuilder Component
 *
 * Main component for creating and sharing skill builds
 * Features:
 * - Configurable skill slots (1-10)
 * - URL sharing with encoded build data
 * - Import/Export builds as JSON
 * - Build statistics
 * - Game-accurate UI design
 */
const SkillBuilder = () => {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buildName, setBuildName] = useState('My Build');
  const [maxSlots, setMaxSlots] = useState(10);
  const [autoMaxLevel, setAutoMaxLevel] = useState(false);
  const [build, setBuild] = useState({
    slots: Array(10).fill(null).map(() => ({ skill: null, level: 1 }))
  });
  const [showSkillSelector, setShowSkillSelector] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load skills data
  useEffect(() => {
    loadSkills();
  }, []);

  // Load build from URL after skills are loaded
  useEffect(() => {
    if (skills.length === 0) return; // Wait for skills to load

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const encodedBuild = urlParams.get('data');

    if (encodedBuild) {
      try {
        const decodedBuild = decodeBuild(encodedBuild);
        if (decodedBuild) {
          setBuildName(decodedBuild.name || 'My Skill Build');
          setMaxSlots(decodedBuild.maxSlots || 10);

          // Deserialize build (convert skill IDs back to full skill objects)
          const deserializedBuild = deserializeBuild(decodedBuild, skills);
          setBuild({ slots: deserializedBuild.slots });
        }
      } catch (error) {
        console.error('Failed to load build from URL:', error);
      }
    }
  }, [skills]); // Trigger when skills load

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

  /**
   * Serialize build for URL encoding (skill objects -> skill IDs only)
   * This makes URLs resilient to skill data changes
   */
  const serializeBuild = (build) => {
    return {
      name: buildName,
      maxSlots,
      slots: build.slots.map(slot => ({
        skillId: slot.skill?.id || null,
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

  // Share build
  const handleShareBuild = () => {
    // Serialize build to only include skill IDs (not full skill objects)
    const serializedBuild = serializeBuild(build);

    const encoded = encodeBuild(serializedBuild);
    if (!encoded) {
      alert('Failed to encode build');
      return;
    }

    const baseURL = window.location.origin + window.location.pathname;
    const shareURL = `${baseURL}#/skill-builder?data=${encoded}`;

    navigator.clipboard.writeText(shareURL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
  };

  // Import build from JSON
  const handleImportBuild = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buildData = JSON.parse(e.target.result);
        setBuildName(buildData.name || 'Imported Build');
        setMaxSlots(buildData.maxSlots || 10);

        // Deserialize build to ensure skill objects are current
        const deserializedBuild = deserializeBuild(buildData, skills);
        setBuild({ slots: deserializedBuild.slots });
      } catch (error) {
        console.error('Failed to import build:', error);
        alert('Failed to import build. Invalid file format.');
      }
    };
    reader.readAsText(file);
  };

  // Clear build
  const handleClearBuild = () => {
    if (!confirm('Clear all skills from this build?')) return;
    setBuild({ slots: Array(maxSlots).fill(null).map(() => ({ skill: null, level: 1 })) });
  };

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
        distribution[attr] = (distribution[attr] || 0) + 1;
      }
    });
    return distribution;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-black">
        <div className="text-white text-xl">Loading skills...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col gap-3">
            {/* Title */}
            <div className="flex items-center gap-3">
              <img src="/images/skills/Icon_skillCard.png" alt="" className="w-8 h-8 flex-shrink-0" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Skill Builder</h1>
            </div>

            {/* Build Name - Full Width on Mobile */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Build Name:</label>
              <input
                type="text"
                value={buildName}
                onChange={(e) => setBuildName(e.target.value)}
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                placeholder="Enter build name..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        {/* Actions Panel */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleShareBuild}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              {copied ? (
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
        </div>

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
                onSelectSkill={() => handleSelectSlot(index)}
                onRemoveSkill={() => handleRemoveSkill(index)}
                onLevelChange={(newLevel) => handleLevelChange(index, newLevel)}
              />
            ))}
          </div>
        </div>

        {/* Bulk Level Actions */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-800 shadow-sm mb-6">
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
};

export default SkillBuilder;
