import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Video as VideoIcon, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { loadVideoGuides, areVideoGuideSubmissionsAllowed } from '../../wiki-framework/src/services/contentCreators';
import VideoGuideCard from '../../wiki-framework/src/components/contentCreators/VideoGuideCard';
import VideoGuideSubmissionModal from '../../wiki-framework/src/components/contentCreators/VideoGuideSubmissionModal';
import { useWikiConfig } from '../../wiki-framework/src/hooks/useWikiConfig';
import { createLogger } from '../../wiki-framework/src/utils/logger';

const logger = createLogger('VideoGuidePicker');

/**
 * VideoGuidePicker Modal - Select a video guide to insert into markdown
 * Features:
 * - Browse video guides with card grid
 * - Search by title/description
 * - Filter by category, difficulty, tags
 * - Preview panel with video embed
 * - Pagination for large guide lists
 */
const VideoGuidePicker = ({ isOpen, onClose, onSelect }) => {
  const { config } = useWikiConfig();
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const guidesPerPage = 9;

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load video guides when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadGuides = async () => {
      try {
        setLoading(true);
        setError(null);
        logger.debug('Loading video guides for picker');
        const data = await loadVideoGuides();
        setGuides(data);
        logger.debug('Video guides loaded', { count: data.length });
      } catch (err) {
        logger.error('Failed to load video guides', { error: err.message });
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadGuides();
  }, [isOpen]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
    }
  }, [searchQuery, selectedCategory, selectedDifficulty, isOpen]);

  // Get unique categories and difficulties
  const categories = useMemo(() => {
    const cats = guides
      .map(g => g.category)
      .filter(Boolean);
    return ['All', ...new Set(cats)];
  }, [guides]);

  const difficulties = useMemo(() => {
    const diffs = guides
      .map(g => g.difficulty)
      .filter(Boolean);
    return ['All', ...new Set(diffs)];
  }, [guides]);

  // Filter guides
  const filteredGuides = useMemo(() => {
    return guides.filter(guide => {
      const matchesSearch = !searchQuery ||
        guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.creator?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'All' || guide.category === selectedCategory;
      const matchesDifficulty = selectedDifficulty === 'All' || guide.difficulty === selectedDifficulty;

      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [guides, searchQuery, selectedCategory, selectedDifficulty]);

  if (!isOpen) return null;

  // Pagination
  const totalPages = Math.ceil(filteredGuides.length / guidesPerPage);
  const startIndex = (currentPage - 1) * guidesPerPage;
  const endIndex = startIndex + guidesPerPage;
  const currentGuides = filteredGuides.slice(startIndex, endIndex);

  const handleGuideSelect = (guide) => {
    setSelectedGuide(guide);
  };

  const handleInsert = () => {
    if (!selectedGuide) return;

    // Insert using ID syntax: {{video-guide:ID}}
    const syntax = `{{video-guide:${selectedGuide.id}}}`;
    logger.info('Inserting video guide', { id: selectedGuide.id, syntax });
    onSelect(syntax);
    onClose();
  };

  const handleUploadSuccess = () => {
    logger.info('Video guide submitted successfully');
    setShowUploadModal(false);
    // Optionally reload guides to show the new submission (if approved quickly)
    // For now, just close the modal since it requires approval
  };

  // Check if submissions are allowed
  const submissionsAllowed = areVideoGuideSubmissionsAllowed(config);

  // Modal content
  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <VideoIcon className="text-blue-500" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Insert Video Guide
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {submissionsAllowed && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                title="Upload a new video guide"
              >
                <Upload size={16} />
                Upload Video
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Close"
            >
              <X size={24} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by title, description, or creator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {difficulties.map(diff => (
                <option key={diff} value={diff}>{diff}</option>
              ))}
            </select>

            <div className="ml-auto text-sm text-gray-600 dark:text-gray-400 flex items-center">
              {filteredGuides.length} guide{filteredGuides.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Guide Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading guides...</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                  Error loading video guides
                </p>
                <p className="text-red-500 dark:text-red-500 text-xs mt-1">{error}</p>
              </div>
            )}

            {!loading && !error && filteredGuides.length === 0 && (
              <div className="text-center py-12">
                <VideoIcon size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No video guides found</p>
                {guides.length === 0 ? (
                  <>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      Be the first to contribute a video guide!
                    </p>
                    {submissionsAllowed && (
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        <Upload size={18} />
                        Upload Video Guide
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Try adjusting your filters
                  </p>
                )}
              </div>
            )}

            {!loading && !error && currentGuides.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentGuides.map(guide => (
                  <div
                    key={guide.id}
                    onClick={() => handleGuideSelect(guide)}
                    className={`cursor-pointer rounded-lg overflow-hidden transition-all ${
                      selectedGuide?.id === guide.id
                        ? 'ring-2 ring-blue-500 shadow-lg'
                        : 'hover:shadow-md'
                    }`}
                  >
                    <div className="relative pb-[56.25%] bg-gray-200 dark:bg-gray-700">
                      {guide.thumbnailUrl && (
                        <img
                          src={guide.thumbnailUrl}
                          alt={guide.title}
                          className="absolute top-0 left-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-800">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">
                        {guide.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                        {guide.description}
                      </p>
                      {guide.creator && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          By {guide.creator}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          {!isMobile && selectedGuide && (
            <div className="w-96 border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Preview
              </h3>
              <VideoGuideCard guide={selectedGuide} mode="embed" showId={true} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedGuide ? (
              <span>Selected: <span className="font-medium">{selectedGuide.title}</span></span>
            ) : (
              <span>Select a video guide to insert</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={!selectedGuide}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Insert
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}

      {/* Video Upload Modal */}
      <VideoGuideSubmissionModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
};

export default VideoGuidePicker;
