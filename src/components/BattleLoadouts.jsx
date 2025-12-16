import React, { useState, useEffect } from 'react';
import { Share2, Download, Upload, Trash2, Copy, Check, Edit, Plus, Save, Loader, CheckCircle2 } from 'lucide-react';
import SkillBuilderModal from './SkillBuilderModal';
import SkillSlot from './SkillSlot';
import SavedLoadoutsPanel from './SavedLoadoutsPanel';
import { encodeLoadout, decodeLoadout } from '../../wiki-framework/src/utils/battleLoadoutEncoder';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { setCache } from '../utils/buildCache';

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
  const [loadoutName, setLoadoutName] = useState('My Loadout');
  const [currentLoadout, setCurrentLoadout] = useState(createEmptyLoadout('My Loadout'));
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSkillBuilder, setShowSkillBuilder] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load skills data
  useEffect(() => {
    loadSkills();
  }, []);

  // Load loadout from URL
  useEffect(() => {
    if (skills.length === 0) return; // Wait for skills to load

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const encodedLoadout = urlParams.get('data');

    if (encodedLoadout) {
      try {
        const decodedLoadout = decodeLoadout(encodedLoadout);
        if (decodedLoadout) {
          // Deserialize skill build
          const deserializedLoadout = {
            ...decodedLoadout,
            skillBuild: decodedLoadout.skillBuild ? deserializeSkillBuild(decodedLoadout.skillBuild, skills) : null
          };
          setCurrentLoadout(deserializedLoadout);
          setLoadoutName(deserializedLoadout.name || 'My Loadout');
          setHasUnsavedChanges(false); // Loaded from URL, no unsaved changes yet
        }
      } catch (error) {
        console.error('Failed to load loadout from URL:', error);
      }
    }
  }, [skills]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Track hash changes for in-app navigation
  useEffect(() => {
    const handleHashChange = (e) => {
      if (hasUnsavedChanges) {
        const confirmed = window.confirm(
          'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.'
        );
        if (!confirmed) {
          e.preventDefault();
          // Restore the previous hash
          window.history.pushState(null, '', e.oldURL);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [hasUnsavedChanges]);

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
        skillId: slot.skill?.id || null,
        level: slot.level
      }))
    };
  };

  // Update loadout name in current loadout
  useEffect(() => {
    setCurrentLoadout(prev => ({ ...prev, name: loadoutName }));
    setHasUnsavedChanges(true);
  }, [loadoutName]);

  // Handle skill builder save
  const handleSkillBuildSave = (build) => {
    setCurrentLoadout(prev => ({ ...prev, skillBuild: build }));
    setShowSkillBuilder(false);
    setHasUnsavedChanges(true);
  };

  // Clear skill build
  const handleClearSkillBuild = () => {
    if (!confirm('Remove skill build from this loadout?')) return;
    setCurrentLoadout(prev => ({ ...prev, skillBuild: null }));
    setHasUnsavedChanges(true);
  };

  // Load saved loadout
  const handleLoadLoadout = (loadout) => {
    // Deserialize the skill build if it exists
    const deserializedLoadout = {
      ...loadout,
      skillBuild: loadout.skillBuild ? deserializeSkillBuild(loadout.skillBuild, skills) : null
    };

    setCurrentLoadout(deserializedLoadout);
    setLoadoutName(deserializedLoadout.name || 'My Loadout');
    setHasUnsavedChanges(false); // Loaded from saved, no unsaved changes
  };

  // Save loadout
  const handleSaveLoadout = async () => {
    if (!user || !isAuthenticated) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const loadoutData = {
        name: currentLoadout.name,
        skillBuild: currentLoadout.skillBuild,
        spirit: currentLoadout.spirit,
        skillStone: currentLoadout.skillStone,
        promotionAbility: currentLoadout.promotionAbility,
        familiar: currentLoadout.familiar,
      };

      const response = await fetch('/.netlify/functions/save-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'battle-loadout',
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
        setCache('battle-loadouts', user.id, data.loadouts);
      }

      setSaveSuccess(true);
      setHasUnsavedChanges(false); // Successfully saved, clear unsaved changes flag

      // Hide success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);

      // Trigger refresh of saved loadouts panel
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('[BattleLoadouts] Failed to save loadout:', err);
      setSaveError(err.message || 'Failed to save loadout');
    } finally {
      setSaving(false);
    }
  };

  // Share loadout
  const handleShareLoadout = () => {
    // Serialize the loadout
    const serializedLoadout = {
      ...currentLoadout,
      skillBuild: serializeSkillBuild(currentLoadout.skillBuild)
    };

    const encoded = encodeLoadout(serializedLoadout);
    if (!encoded) {
      alert('Failed to encode loadout');
      return;
    }

    const baseURL = window.location.origin + window.location.pathname;
    const shareURL = `${baseURL}#/battle-loadouts?data=${encoded}`;

    navigator.clipboard.writeText(shareURL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Deserialize skill build
        const deserializedLoadout = {
          ...data,
          skillBuild: data.skillBuild ? deserializeSkillBuild(data.skillBuild, skills) : null
        };

        setCurrentLoadout(deserializedLoadout);
        setLoadoutName(deserializedLoadout.name || 'My Loadout');
        setHasUnsavedChanges(false); // Imported from file, no unsaved changes yet
      } catch (error) {
        console.error('Failed to import loadout:', error);
        alert('Failed to import loadout. Invalid file format.');
      }
    };
    reader.readAsText(file);
  };

  // Clear loadout
  const handleClearLoadout = () => {
    if (!confirm('Clear current loadout? This cannot be undone.')) return;
    setCurrentLoadout(createEmptyLoadout(loadoutName));
    setHasUnsavedChanges(true);
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
        {/* Loadout Name Field - Sticky */}
        <div className="sticky top-16 z-30 bg-gray-50 dark:bg-gray-950 pt-6 pb-2">
          <div className="max-w-7xl mx-auto px-3 sm:px-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Loadout Name:</label>
                <input
                  type="text"
                  value={loadoutName}
                  onChange={(e) => setLoadoutName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  placeholder="Enter loadout name..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className={`max-w-7xl mx-auto px-3 sm:px-4 pb-6 ${isAuthenticated ? 'pb-24' : ''}`}>

        {/* Actions Panel */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleShareLoadout}
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
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Saved Loadouts Panel */}
        <SavedLoadoutsPanel
          key={refreshTrigger}
          currentLoadout={currentLoadout}
          onLoadLoadout={handleLoadLoadout}
        />

        {/* Skills Section */}
        <SkillsSection
          skillBuild={currentLoadout.skillBuild}
          onEdit={() => setShowSkillBuilder(true)}
          onClear={handleClearSkillBuild}
        />

        {/* Other Sections - Placeholders */}
        <PlaceholderSection
          title="Accompanying Spirit"
          description="Spirit Builder coming soon"
          icon="🔮"
        />

        <PlaceholderSection
          title="Skill Stone"
          description="Skill Stone Builder coming soon"
          icon="💎"
        />

        <PlaceholderSection
          title="Slayer Promotion Additional Ability"
          description="Promotion Ability Builder coming soon"
          icon="⭐"
        />

        <PlaceholderSection
          title="Familiar Skill"
          description="Familiar Builder coming soon"
          icon="🐾"
        />
        </div>

        {/* Sticky Footer with Save Button */}
        {isAuthenticated && (
          <div className="sticky bottom-0 left-0 right-0 z-40 mt-6">
            <div className="max-w-7xl mx-auto px-3 sm:px-4">
              <div className="bg-gray-900 rounded-t-lg border border-gray-700 border-b-0 shadow-2xl py-3">
                <div className="flex flex-col items-center gap-2">
                  {/* Error Message */}
                  {saveError && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                      {saveError}
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
        )}
      </div>

      {/* Skill Builder Modal */}
      <SkillBuilderModal
        isOpen={showSkillBuilder}
        onClose={() => setShowSkillBuilder(false)}
        initialBuild={currentLoadout.skillBuild}
        onSave={handleSkillBuildSave}
      />
    </div>
  );
};

/**
 * Skills Section Component
 */
const SkillsSection = ({ skillBuild, onEdit, onClear }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white">Skills to use</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Edit className="w-4 h-4" />
            {skillBuild ? 'Edit Build' : 'Create Build'}
          </button>
          {skillBuild && (
            <button
              onClick={onClear}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {skillBuild ? (
        <div>
          <div className="text-sm text-gray-400 mb-4">
            Build: <span className="text-white font-medium">{skillBuild.name}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 justify-items-center">
            {skillBuild.slots.slice(0, 10).map((slot, index) => (
              <SkillSlot
                key={index}
                skill={slot.skill}
                level={slot.level}
                isLocked={false}
                slotNumber={index + 1}
                onSelectSkill={() => {}}
                onRemoveSkill={() => {}}
                onLevelChange={() => {}}
                readOnly={true}
              />
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={onEdit}
          className="w-full flex items-center justify-center py-12 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 hover:bg-gray-700/50 transition-colors cursor-pointer"
        >
          <div className="text-center">
            <Plus className="w-12 h-12 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400">No skill build configured</p>
            <p className="text-sm text-gray-500 mt-1">Click here or "Create Build" to get started</p>
          </div>
        </button>
      )}
    </div>
  );
};

/**
 * Placeholder Section Component
 */
const PlaceholderSection = ({ title, description, icon }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6 opacity-60">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{icon}</span>
        <span className="text-xl font-bold text-white">{title}</span>
      </div>
      <div className="flex items-center justify-center py-12 border-2 border-dashed border-gray-600 rounded-lg">
        <div className="text-center">
          <p className="text-gray-400 text-lg">{description}</p>
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
    spirit: null,
    skillStone: null,
    promotionAbility: null,
    familiar: null
  };
}

export default BattleLoadouts;
