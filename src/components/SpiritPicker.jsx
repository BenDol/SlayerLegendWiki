import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import SpiritSprite from './SpiritSprite';
import SpiritCard from './SpiritCard';

/**
 * SpiritPicker Modal - Select a spirit to insert into markdown
 * Features:
 * - Browse spirits with animated sprite grid
 * - Search and filter by skill type
 * - Preview panel with spirit details and animated sprite
 * - Display mode selection (compact/detailed/advanced)
 * - Pagination for spirit lists
 */
const SpiritPicker = ({ isOpen, onClose, onSelect, renderPreview = null }) => {
  const [spirits, setSpirits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedElement, setSelectedElement] = useState('All');
  const [selectedSpirit, setSelectedSpirit] = useState(null);
  const [selectedSpiritList, setSelectedSpiritList] = useState([]); // For multiselect
  const [multiselectMode, setMultiselectMode] = useState(false);
  const [displayMode, setDisplayMode] = useState('detailed');
  const [alignment, setAlignment] = useState('none');
  const [selectedLevel, setSelectedLevel] = useState(4);
  const [displayInline, setDisplayInline] = useState(true); // Inline by default for compact mode
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const spiritsPerPage = 12;

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const loadSpirits = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/spirit-characters.json');
        if (!response.ok) {
          throw new Error('Failed to load spirits');
        }
        const data = await response.json();
        setSpirits(data.spirits || []);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadSpirits();
  }, [isOpen]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
    }
  }, [searchTerm, selectedElement, isOpen]);

  if (!isOpen) return null;

  // Get unique elements from spirit data
  const uniqueElements = [...new Set(spirits.map(s => s.element))].sort();

  // Element definitions with colors (mapping game elements to display colors)
  const elementColorMap = {
    'Fire': { color: 'red', label: 'Fire' },
    'Water': { color: 'blue', label: 'Water' },
    'Wind': { color: 'green', label: 'Wind' },
    'Earth': { color: 'amber', label: 'Earth' }
  };

  const elements = [
    { name: 'All', color: 'gray', label: 'All' },
    ...uniqueElements.map(element => ({
      name: element,
      color: elementColorMap[element]?.color || 'gray',
      label: elementColorMap[element]?.label || element
    }))
  ];

  // Filter spirits
  const filteredSpirits = spirits.filter(spirit => {
    const matchesSearch = spirit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          spirit.skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          spirit.skill.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesElement = selectedElement === 'All' || spirit.element === selectedElement;
    return matchesSearch && matchesElement;
  }).sort((a, b) => {
    // Sort by element first, then by ID
    const elementA = a.element || 'Unknown';
    const elementB = b.element || 'Unknown';
    if (elementA !== elementB) {
      return elementA.localeCompare(elementB);
    }
    return a.id - b.id;
  });

  // Pagination
  const totalPages = Math.ceil(filteredSpirits.length / spiritsPerPage);
  const startIndex = (currentPage - 1) * spiritsPerPage;
  const endIndex = startIndex + spiritsPerPage;
  const currentSpirits = filteredSpirits.slice(startIndex, endIndex);

  const handleSpiritSelect = (spirit, event) => {
    const isCtrlClick = event?.ctrlKey || event?.metaKey; // Ctrl on Windows/Linux, Cmd on Mac

    // Enable multiselect mode automatically on Ctrl+Click
    if (isCtrlClick && !multiselectMode) {
      setMultiselectMode(true);
    }

    if (multiselectMode || isCtrlClick) {
      // Multiselect mode: toggle selection in array
      setSelectedSpiritList(prev => {
        const existing = prev.find(s => s.id === spirit.id);

        if (existing) {
          // Remove from selection
          return prev.filter(s => s.id !== spirit.id);
        } else {
          // Add to selection
          return [...prev, spirit];
        }
      });

      // Update primary selection for preview
      setSelectedSpirit(spirit);
    } else {
      // Single select mode
      setSelectedSpirit(spirit);
      setSelectedSpiritList([spirit]);
    }
  };

  const handleInsert = () => {
    if (multiselectMode && selectedSpiritList.length > 0) {
      // Multiselect: send array of spirits
      onSelect({ spiritList: selectedSpiritList, mode: displayMode, alignment, level: selectedLevel, inline: displayInline });
    } else if (selectedSpirit) {
      // Single select: send single spirit
      onSelect({ spirit: selectedSpirit, mode: displayMode, alignment, level: selectedLevel, inline: displayInline });
    } else {
      return;
    }
    onClose();
  };

  // Spirit-specific color mapping (matches SpiritCard)
  const spiritColors = {
    'Sala': 'from-red-500 via-red-500/40 to-transparent',          // Red
    'Ark': 'from-blue-500 via-blue-500/40 to-transparent',          // Blue
    'Herh': 'from-green-500 via-green-500/40 to-transparent',        // Green
    'Loar': 'from-amber-600 via-amber-600/40 to-transparent',        // Sienna (brown-orange)
    'Mum': 'from-red-500 via-red-500/40 to-transparent',           // Red
    'Todd': 'from-blue-500 via-blue-500/40 to-transparent',         // Blue
    'Zappy': 'from-green-500 via-green-500/40 to-transparent',       // Green
    'Radon': 'from-amber-600 via-amber-600/40 to-transparent',       // Sienna (brown-orange)
    'Bo': 'from-red-500 via-red-500/40 to-transparent',            // Red
    'Luga': 'from-blue-500 via-blue-500/40 to-transparent',         // Blue
    'Kart': 'from-green-500 via-green-500/40 to-transparent',        // Green
    'Noah': 'from-amber-600 via-amber-600/40 to-transparent',        // Sienna (brown-orange)
  };

  if (!isOpen) return null;

  const modal = (
    <div className={`fixed inset-0 ${isMobile ? 'z-[9999]' : 'z-50'} flex ${isMobile ? 'items-start' : 'items-center justify-center p-4'} ${isMobile ? 'p-0' : ''}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full bg-white dark:bg-gray-800 shadow-2xl overflow-hidden flex flex-col ${
        isMobile
          ? 'h-full'
          : 'max-w-6xl rounded-lg max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Insert Spirit Card
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search spirits..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Element Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              {elements.map(element => {
                const count = element.name === 'All'
                  ? spirits.length
                  : spirits.filter(s => s.element === element.name).length;

                return (
                  <button
                    key={element.name}
                    onClick={() => setSelectedElement(element.name)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedElement === element.name
                        ? `bg-${element.color}-500 text-white`
                        : `bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-${element.color}-400`
                    }`}
                  >
                    {element.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-3"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading spirits...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-red-600 dark:text-red-400">
                <p className="font-semibold mb-2">Error loading spirits</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : filteredSpirits.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <p className="font-semibold mb-1">No spirits found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            </div>
          ) : (
            <>
              {/* Multiselect Toggle - Above Grid - Compact */}
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Mode:</span>
                  <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded p-0.5">
                    <button
                      onClick={() => {
                        setMultiselectMode(false);
                        setSelectedSpiritList(selectedSpirit ? [selectedSpirit] : []);
                      }}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                        !multiselectMode
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Single
                    </button>
                    <button
                      onClick={() => {
                        setMultiselectMode(true);
                        setSelectedSpiritList(selectedSpirit ? [selectedSpirit] : []);
                      }}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                        multiselectMode
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Multi
                    </button>
                  </div>
                </div>
                {multiselectMode && selectedSpiritList.length > 0 && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-blue-600 dark:text-blue-400">{selectedSpiritList.length}</span> selected
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {currentSpirits.map(spirit => {
                const typeGradient = spiritColors[spirit.name] || 'from-gray-500 to-gray-600';
                const isSelected = multiselectMode
                  ? selectedSpiritList.some(s => s.id === spirit.id)
                  : selectedSpirit?.id === spirit.id;

                return (
                  <button
                    key={spirit.id}
                    onClick={(e) => handleSpiritSelect(spirit, e)}
                    className={`group relative rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500 scale-105'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}
                  >
                    <div className={`bg-gradient-to-br ${typeGradient} p-2 flex flex-col items-center justify-center`}>
                      {/* Animated Spirit Sprite */}
                      <div className="w-16 h-16 mb-1">
                        <SpiritSprite
                          spiritId={spirit.id}
                          level={4}
                          animationType="idle"
                          animated={true}
                          fps={8}
                          size="small"
                          showInfo={false}
                        />
                      </div>
                      <h3 className="text-xs font-semibold text-center text-white line-clamp-1 leading-tight px-1">
                        {spirit.name}
                      </h3>
                      <p className="text-[9px] text-white/80 text-center line-clamp-1">
                        #{spirit.id}
                      </p>
                    </div>
                    {/* Selected checkmark */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            </>
          )}
        </div>

        {/* Spirit Preview Panel (if selected) - Compact */}
        {selectedSpirit && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2">
            <div className="flex flex-col gap-2">
              {/* Header with Close Button */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Preview</h3>
                <button
                  onClick={() => setSelectedSpirit(null)}
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Close preview"
                >
                  <X className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Compact: All Controls in Single Row */}
              <div className="flex items-center gap-2 flex-wrap text-[10px]">
                {/* Display Mode */}
                <div className="flex items-center gap-1">
                  <label className="font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Display:
                  </label>
                  <div className="flex gap-0.5">
                    {[
                      { value: 'compact', label: 'Compact' },
                      { value: 'detailed', label: 'Detailed' },
                      { value: 'advanced', label: 'Advanced' }
                    ].map(mode => (
                      <button
                        key={mode.value}
                        onClick={() => setDisplayMode(mode.value)}
                        className={`px-1.5 py-0.5 rounded font-medium transition-all ${
                          displayMode === mode.value
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inline/Block Toggle (only for compact mode) */}
                {displayMode === 'compact' && (
                  <div className="flex items-center gap-1">
                    <label className="font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Layout:
                    </label>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => setDisplayInline(true)}
                        className={`px-1.5 py-0.5 rounded font-medium transition-all ${
                          displayInline
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                        }`}
                      >
                        Inline
                      </button>
                      <button
                        onClick={() => setDisplayInline(false)}
                        className={`px-1.5 py-0.5 rounded font-medium transition-all ${
                          !displayInline
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                        }`}
                      >
                        Block
                      </button>
                    </div>
                  </div>
                )}

                {/* Alignment */}
                <div className="flex items-center gap-1">
                  <label className="font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Align:
                  </label>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => setAlignment('none')}
                      title="No Alignment"
                      className={`px-1.5 py-0.5 rounded transition-all flex items-center justify-center ${
                        alignment === 'none'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setAlignment('left')}
                      title="Align Left"
                      className={`px-1.5 py-0.5 rounded transition-all flex items-center justify-center ${
                        alignment === 'left'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <AlignLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setAlignment('center')}
                      title="Align Center"
                      className={`px-1.5 py-0.5 rounded transition-all flex items-center justify-center ${
                        alignment === 'center'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <AlignCenter className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setAlignment('right')}
                      title="Align Right"
                      className={`px-1.5 py-0.5 rounded transition-all flex items-center justify-center ${
                        alignment === 'right'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <AlignRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Evolution Level Selector */}
                <div className="flex items-center gap-1">
                  <label className="font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Level:
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="range"
                      min="0"
                      max="7"
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(parseInt(e.target.value))}
                      className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-[10px] font-medium text-gray-900 dark:text-white min-w-[2ch] text-center">
                      {selectedLevel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Preview - Smaller Max Height */}
              <div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 max-h-[200px] overflow-y-auto">
                  {renderPreview ? (
                    renderPreview({ spirit: selectedSpirit, mode: displayMode, level: selectedLevel })
                  ) : (
                    <div className="spirit-card-preview">
                      <SpiritCard
                        id={selectedSpirit.id}
                        mode={displayMode}
                        level={selectedLevel}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {/* Pagination */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages || 1} • {filteredSpirits.length} spirits
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={multiselectMode ? selectedSpiritList.length === 0 : !selectedSpirit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {multiselectMode && selectedSpiritList.length > 1
                ? `Insert ${selectedSpiritList.length} Spirits`
                : 'Insert Spirit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default SpiritPicker;
