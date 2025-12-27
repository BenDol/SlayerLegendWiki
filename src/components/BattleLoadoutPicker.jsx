import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import BattleLoadoutCard from './BattleLoadoutCard';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { getLoadDataEndpoint } from '../utils/apiEndpoints';
import { getSkillGradeColor } from '../config/rarityColors';
import { createLogger } from '../utils/logger';

const logger = createLogger('BattleLoadoutPicker');

/**
 * BattleLoadoutPicker Modal - Select a battle loadout to insert into markdown
 * Features:
 * - Browse user's saved battle loadouts
 * - Search and filter by name
 * - Preview panel with loadout details
 * - Display mode selection (compact/detailed/advanced)
 * - Pagination for loadout lists
 */
const BattleLoadoutPicker = ({ isOpen, onClose, onSelect, renderPreview = null }) => {
  const { isAuthenticated, user } = useAuthStore();
  const [loadouts, setLoadouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoadout, setSelectedLoadout] = useState(null);
  const [displayMode, setDisplayMode] = useState('detailed');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [skills, setSkills] = useState([]);
  const [spirits, setSpirits] = useState([]);
  const loadoutsPerPage = 12;

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load skills and spirits data
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const [skillsRes, spiritsRes] = await Promise.all([
          fetch('/data/skills.json'),
          fetch('/data/spirit-characters.json')
        ]);

        const skillsData = await skillsRes.json();
        const spiritsData = await spiritsRes.json();

        setSkills(skillsData);
        setSpirits(spiritsData.spirits || []);
      } catch (err) {
        logger.error('Failed to load game data', { error: err });
      }
    };

    loadGameData();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const loadLoadouts = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!isAuthenticated || !user) {
          setError('Please log in to access your saved loadouts');
          setLoading(false);
          return;
        }

        const response = await fetch(
          getLoadDataEndpoint() + `?type=battle-loadouts&userId=${user.id}`
        );

        if (!response.ok) {
          throw new Error('Failed to load loadouts');
        }

        const data = await response.json();
        setLoadouts(data.loadouts || []);
        setLoading(false);

        logger.debug('Loaded battle loadouts', {
          count: data.loadouts?.length || 0
        });
      } catch (err) {
        logger.error('Failed to load loadouts', { error: err });
        setError(err.message);
        setLoading(false);
      }
    };

    loadLoadouts();
  }, [isOpen, isAuthenticated, user]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
    }
  }, [searchTerm, isOpen]);

  if (!isOpen) return null;

  // Filter loadouts by search term
  const filteredLoadouts = loadouts.filter(loadout => {
    const matchesSearch = loadout.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }).sort((a, b) => {
    // Sort by most recently updated
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });

  // Pagination
  const totalPages = Math.ceil(filteredLoadouts.length / loadoutsPerPage);
  const startIndex = (currentPage - 1) * loadoutsPerPage;
  const paginatedLoadouts = filteredLoadouts.slice(startIndex, startIndex + loadoutsPerPage);

  // Handle loadout selection
  const handleSelectLoadout = (loadout) => {
    setSelectedLoadout(loadout);
  };

  // Handle insert
  const handleInsert = () => {
    if (!selectedLoadout) return;

    const syntax = `{{battle-loadout:${selectedLoadout.id}:${displayMode}}}`;

    onSelect({
      loadout: selectedLoadout,
      mode: displayMode,
      syntax
    });

    logger.info('Inserted battle loadout', {
      loadoutName: selectedLoadout.name,
      mode: displayMode
    });

    onClose();
  };

  // Helper: Get skills from loadout
  const getLoadoutSkills = (loadout) => {
    if (!loadout.skillBuild?.slots) return [];
    if (!Array.isArray(skills) || skills.length === 0) return [];

    const loadoutSkills = loadout.skillBuild.slots
      .filter(slot => slot.skill || slot.skillId)
      .map(slot => {
        if (slot.skill) {
          return slot.skill;
        } else if (slot.skillId) {
          return skills.find(s => s.id === slot.skillId);
        }
        return null;
      })
      .filter(skill => skill !== null);

    return loadoutSkills;
  };

  // Helper: Get spirits from loadout
  const getLoadoutSpirits = (loadout) => {
    if (!loadout.spiritBuild?.slots) return [];
    if (!Array.isArray(spirits) || spirits.length === 0) return [];

    const loadoutSpirits = loadout.spiritBuild.slots
      .filter(slot => slot.spirit || slot.spiritId)
      .map(slot => {
        if (slot.spirit) {
          return slot.spirit;
        } else if (slot.spiritId) {
          return spirits.find(s => s.id === slot.spiritId);
        }
        return null;
      })
      .filter(spirit => spirit !== null);

    return loadoutSpirits;
  };

  // Modal content
  const modalContent = (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 ${
        isMobile ? 'p-0' : ''
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden ${
          isMobile ? 'w-full h-full max-w-full max-h-full' : 'max-w-6xl w-full max-h-[90vh]'
        } flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-purple-600">
          <h2 className="text-xl font-bold text-white">Insert Battle Loadout</h2>
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6">
              <p className="text-red-800 dark:text-red-200 font-semibold">Error</p>
              <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
              {error.includes('log in') && (
                <button
                  onClick={() => (window.location.href = '/login')}
                  className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                >
                  Log In
                </button>
              )}
            </div>
          ) : loadouts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You don't have any saved battle loadouts yet.
              </p>
              <button
                onClick={() => (window.location.href = '#/battle-loadouts')}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                Create Your First Loadout
              </button>
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search loadouts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {filteredLoadouts.length} loadout{filteredLoadouts.length !== 1 ? 's' : ''} found
                </p>
              </div>

              {/* Loadouts Grid */}
              {filteredLoadouts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">No loadouts match your search.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {paginatedLoadouts.map((loadout) => (
                      <button
                        key={loadout.id}
                        onClick={() => handleSelectLoadout(loadout)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedLoadout?.id === loadout.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                              {loadout.name}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {loadout.updatedAt
                                ? `Updated ${new Date(loadout.updatedAt).toLocaleDateString()}`
                                : `Created ${new Date(loadout.createdAt).toLocaleDateString()}`}
                            </p>
                          </div>
                          {selectedLoadout?.id === loadout.id && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Preview Icons */}
                        <div className="flex gap-2 items-center mt-3">
                          {/* Spirits Section */}
                          {getLoadoutSpirits(loadout).length > 0 && (
                            <div className="flex flex-wrap gap-0.5">
                              {getLoadoutSpirits(loadout).map((spirit, index) => (
                                <div
                                  key={index}
                                  className="w-6 h-6 rounded overflow-hidden"
                                  title={spirit.name}
                                >
                                  <img
                                    src={spirit.thumbnail || spirit.image}
                                    alt={spirit.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Skills Section */}
                          {getLoadoutSkills(loadout).length > 0 && (
                            <div className="grid grid-cols-5 gap-0.5">
                              {getLoadoutSkills(loadout).slice(0, 10).map((skill, index) => {
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
                      </button>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mb-6">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {/* Preview Panel */}
                  {selectedLoadout && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Preview
                      </h3>

                      {/* Display Mode Selector */}
                      <div className="flex gap-2 mb-4">
                        {['compact', 'detailed', 'advanced'].map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setDisplayMode(mode)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              displayMode === mode
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </button>
                        ))}
                      </div>

                      {/* Preview Card */}
                      <div className="max-h-[400px] overflow-y-auto">
                        {renderPreview ? (
                          renderPreview({ loadout: selectedLoadout, mode: displayMode })
                        ) : (
                          <BattleLoadoutCard
                            identifier={selectedLoadout.id}
                            mode={displayMode}
                            showActions={false}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={!selectedLoadout}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Insert Loadout
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default BattleLoadoutPicker;
