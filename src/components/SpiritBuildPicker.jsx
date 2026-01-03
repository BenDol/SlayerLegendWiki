import React, { useState, useEffect } from 'react';
import { X, Search, Loader } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { getLoadDataEndpoint } from '../utils/apiEndpoints';
import { createLogger } from '../utils/logger';

const logger = createLogger('SpiritBuildPicker');

/**
 * SpiritBuildPicker Component
 *
 * Modal for browsing and selecting saved spirit builds to insert into markdown pages.
 * Displays builds from the current user when authenticated, or public builds when not.
 */
const SpiritBuildPicker = ({ isOpen, onClose, onSelect, renderPreview = null }) => {
  const { isAuthenticated, user } = useAuthStore();

  // Data state
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuild, setSelectedBuild] = useState(null);
  const [displayMode, setDisplayMode] = useState('detailed');
  const [currentPage, setCurrentPage] = useState(1);

  const buildsPerPage = 12;

  // Load builds when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadBuilds = async () => {
      try {
        setLoading(true);
        setError(null);

        let response;
        if (isAuthenticated && user) {
          // Load user's own builds
          response = await fetch(
            getLoadDataEndpoint() + `?type=spirit-builds&userId=${user.id}`
          );
        } else {
          // Load public builds from all users
          response = await fetch(
            getLoadDataEndpoint() + `?type=spirit-builds&public=true`
          );
        }

        if (!response.ok) {
          throw new Error('Failed to load spirit builds');
        }

        const data = await response.json();
        setBuilds(data.builds || []);

        logger.debug('Loaded spirit builds', {
          count: data.builds?.length || 0,
          mode: isAuthenticated ? 'user' : 'public'
        });
      } catch (err) {
        logger.error('Failed to load spirit builds', { error: err });
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadBuilds();
  }, [isOpen, isAuthenticated, user]);

  // Filter builds based on search
  const filteredBuilds = builds.filter(build => {
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = build.name?.toLowerCase().includes(searchLower);
    const usernameMatch = build.username?.toLowerCase().includes(searchLower);
    return nameMatch || usernameMatch;
  });

  // Paginate filtered builds
  const totalPages = Math.ceil(filteredBuilds.length / buildsPerPage);
  const paginatedBuilds = filteredBuilds.slice(
    (currentPage - 1) * buildsPerPage,
    currentPage * buildsPerPage
  );

  // Handle build selection
  const handleSelectBuild = (build) => {
    setSelectedBuild(build);
  };

  // Handle insert
  const handleInsert = () => {
    if (!selectedBuild) return;

    // Include userId in syntax for efficient loading
    // Format: {{spirit-build:userId:buildId:mode}}
    const userId = selectedBuild.userId || (user ? user.id : null);
    const syntax = `{{spirit-build:${userId}:${selectedBuild.id}:${displayMode}}}`;

    onSelect({
      build: selectedBuild,
      mode: displayMode,
      syntax,
      userId: selectedBuild.userId,
      username: selectedBuild.username
    });

    logger.info('Inserted spirit build', {
      buildName: selectedBuild.name,
      buildId: selectedBuild.id,
      userId,
      mode: displayMode,
      owner: selectedBuild.username
    });

    onClose();
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedBuild(null);
      setCurrentPage(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Select Spirit Build
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg"
              >
                Close
              </button>
            </div>
          ) : builds.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {isAuthenticated
                  ? "You don't have any saved spirit builds yet."
                  : "No public spirit builds found. Be the first to create one!"}
              </p>
              <button
                onClick={() => (window.location.href = '/spirit-builder')}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                {isAuthenticated ? 'Create Your First Build' : 'Go to Spirit Builder'}
              </button>
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder={isAuthenticated ? "Search builds..." : "Search by build name or username..."}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1); // Reset to first page on search
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {filteredBuilds.length} build{filteredBuilds.length !== 1 ? 's' : ''} found
                </p>
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
                        key={build.id}
                        onClick={() => handleSelectBuild(build)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedBuild?.id === build.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
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
                                  <span className="ml-1 text-blue-600 dark:text-blue-400 font-medium">
                                    (You)
                                  </span>
                                )}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {build.updatedAt
                                ? `Updated ${new Date(build.updatedAt).toLocaleDateString()}`
                                : `Created ${new Date(build.createdAt).toLocaleDateString()}`}
                            </p>
                          </div>
                          {selectedBuild?.id === build.id && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Spirit Preview - 3 slots */}
                        <div className="flex gap-1 mt-3">
                          {build.slots?.slice(0, 3).map((slot, index) => (
                            <div
                              key={index}
                              className="w-10 h-10 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-100 dark:bg-gray-700"
                            >
                              {slot.spirit ? (
                                <span className="text-xs text-gray-700 dark:text-gray-300">
                                  {slot.spirit.name?.[0] || 'S'}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        Next
                      </button>
                    </div>
                  )}

                  {/* Preview Panel */}
                  {selectedBuild && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
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
                          renderPreview({ build: selectedBuild, mode: displayMode })
                        ) : (
                          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Preview will be available once SpiritBuildCard component is implemented.
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
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Insert Build
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SpiritBuildPicker;
