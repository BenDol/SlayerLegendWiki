import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Search } from 'lucide-react';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { getLoadDataEndpoint } from '../utils/apiEndpoints';
import { getSkillGradeColor } from '../config/rarityColors';
import { createLogger } from '../utils/logger';
import { resolveImagePath } from '../../wiki-framework/src/utils/imageResolver';

const logger = createLogger('SkillBuildPicker');

/**
 * SkillBuildPicker Modal - Select a skill build to insert into markdown
 * Features:
 * - Browse user's saved skill builds
 * - Search by build name
 * - Filter by max slots (1-10)
 * - Preview panel with build details
 * - Display mode selection (compact/detailed/advanced)
 * - Pagination for build lists
 */
const SkillBuildPicker = ({ isOpen, onClose, onSelect, renderPreview = null }) => {
  const { isAuthenticated, user } = useAuthStore();
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaxSlots, setSelectedMaxSlots] = useState('All');
  const [selectedBuild, setSelectedBuild] = useState(null);
  const [displayMode, setDisplayMode] = useState('detailed');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [skills, setSkills] = useState([]);
  const buildsPerPage = 12;

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load skills data
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const response = await fetch('/data/skills.json');
        const data = await response.json();
        setSkills(data || []);
      } catch (err) {
        logger.error('Failed to load skills data', { error: err });
      }
    };

    loadSkills();
  }, []);

  // Load skill builds when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadBuilds = async () => {
      try {
        setLoading(true);
        setError(null);

        logger.debug('Loading skill builds for picker');

        let response;
        if (isAuthenticated && user) {
          // Load user's own builds
          response = await fetch(
            getLoadDataEndpoint() + `?type=skill-builds&userId=${user.id}`
          );
        } else {
          // Load public builds from all users
          response = await fetch(
            getLoadDataEndpoint() + `?type=skill-builds&public=true`
          );
        }

        if (!response.ok) {
          throw new Error('Failed to load skill builds');
        }

        const data = await response.json();
        const buildsData = data.builds || [];

        setBuilds(buildsData);
        logger.debug('Skill builds loaded', {
          count: buildsData.length,
          mode: isAuthenticated ? 'user' : 'public'
        });
      } catch (err) {
        logger.error('Failed to load skill builds', { error: err });
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadBuilds();
  }, [isOpen, isAuthenticated, user]);

  // Get unique max slots values for filter
  const maxSlotsOptions = useMemo(() => {
    const slots = builds
      .map(b => b.maxSlots)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort((a, b) => a - b);
    return ['All', ...slots];
  }, [builds]);

  // Filter and search builds
  const filteredBuilds = useMemo(() => {
    return builds.filter(build => {
      const matchesSearch = !searchQuery ||
        build.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        build.username?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSlots = selectedMaxSlots === 'All' || build.maxSlots === parseInt(selectedMaxSlots);

      return matchesSearch && matchesSlots;
    }).sort((a, b) => {
      // Sort by most recently updated
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
  }, [builds, searchQuery, selectedMaxSlots]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
    }
  }, [searchQuery, selectedMaxSlots, isOpen]);

  if (!isOpen) return null;

  // Pagination
  const totalPages = Math.ceil(filteredBuilds.length / buildsPerPage);
  const startIndex = (currentPage - 1) * buildsPerPage;
  const paginatedBuilds = filteredBuilds.slice(startIndex, startIndex + buildsPerPage);

  // Handle build selection
  const handleSelectBuild = (build) => {
    setSelectedBuild(build);
  };

  // Handle insert
  const handleInsert = () => {
    if (!selectedBuild) return;

    // Include userId in syntax for efficient loading
    // Format: {{skill-build:userId:buildId:mode}}
    const userId = selectedBuild.userId || (user ? user.id : null);
    const syntax = `{{skill-build:${userId}:${selectedBuild.id}:${displayMode}}}`;

    onSelect({
      build: selectedBuild,
      mode: displayMode,
      syntax,
      userId: selectedBuild.userId,
      username: selectedBuild.username
    });

    logger.info('Inserted skill build', {
      buildName: selectedBuild.name,
      buildId: selectedBuild.id,
      userId,
      mode: displayMode,
      owner: selectedBuild.username
    });

    onClose();
  };

  // Helper: Get skills from build
  const getBuildSkills = (build) => {
    if (!build.slots) return [];
    if (!Array.isArray(skills) || skills.length === 0) return [];

    const buildSkills = build.slots
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

    return buildSkills;
  };

  // Helper: Format timestamp
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-500 to-pink-600">
          <h2 className="text-xl font-bold text-white">Insert Skill Build</h2>
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6">
              <p className="text-red-800 dark:text-red-200 font-semibold">Error</p>
              <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
              {error.includes('sign in') && (
                <button
                  onClick={() => (window.location.href = '/login')}
                  className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                >
                  Sign In
                </button>
              )}
            </div>
          ) : builds.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {isAuthenticated
                  ? "You don't have any saved skill builds yet."
                  : "No public skill builds found. Be the first to create one!"}
              </p>
              <button
                onClick={() => (window.location.href = '/skill-builder')}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg"
              >
                {isAuthenticated ? 'Create Your First Build' : 'Go to Skill Builder'}
              </button>
            </div>
          ) : (
            <>
              {/* Search and Filters */}
              <div className="mb-6 space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder={isAuthenticated ? "Search by build name..." : "Search by build name or username..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Filters */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">
                      Max Slots:
                    </label>
                    <select
                      value={selectedMaxSlots}
                      onChange={(e) => setSelectedMaxSlots(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {maxSlotsOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {filteredBuilds.length} build{filteredBuilds.length !== 1 ? 's' : ''} found
                  </p>
                </div>
              </div>

              {/* Builds Grid */}
              {filteredBuilds.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">No builds match your search.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {paginatedBuilds.map((build) => (
                      <button
                        key={`${build.userId}-${build.id}`}
                        onClick={() => handleSelectBuild(build)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedBuild?.id === build.id
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                              {build.name}
                            </h3>
                            {build.username && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                by {build.username}
                                {user && build.userId === user.id && (
                                  <span className="ml-1 text-purple-600 dark:text-purple-400 font-medium">
                                    (You)
                                  </span>
                                )}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {build.updatedAt
                                ? `Updated ${formatDate(build.updatedAt)}`
                                : `Created ${formatDate(build.createdAt)}`}
                            </p>
                          </div>
                          {selectedBuild?.id === build.id && (
                            <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
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

                        {/* Build Info */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {build.maxSlots} slots
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {getBuildSkills(build).length} skills
                          </span>
                        </div>

                        {/* Skill Preview - 2x5 Grid */}
                        {getBuildSkills(build).length > 0 && (
                          <div className="grid grid-cols-5 gap-1">
                            {Array.from({ length: 10 }, (_, index) => {
                              const skill = getBuildSkills(build)[index];
                              if (!skill) {
                                return (
                                  <div
                                    key={index}
                                    className="w-8 h-8 rounded border-2 border-dashed border-gray-300 dark:border-gray-600"
                                  />
                                );
                              }
                              const gradeColors = getSkillGradeColor(skill.grade);
                              return (
                                <div
                                  key={index}
                                  className={`w-8 h-8 rounded border-2 ${gradeColors.border} ${gradeColors.glow} overflow-hidden`}
                                  title={skill.name}
                                >
                                  <img
                                    src={resolveImagePath(skill.icon)}
                                    alt={skill.name}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
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
                  {selectedBuild && (
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
                                ? 'bg-purple-500 text-white'
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
                          renderPreview({ build: selectedBuild, mode: displayMode })
                        ) : (
                          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Preview will be available once SkillBuildCard component is implemented.
                            </p>
                          </div>
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
            disabled={!selectedBuild}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Insert Build
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default SkillBuildPicker;
