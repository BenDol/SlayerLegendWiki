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
  const [displayMode, setDisplayMode] = useState('detailed');
  const [alignment, setAlignment] = useState('none');
  const [selectedLevel, setSelectedLevel] = useState(4);
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

  const handleSpiritSelect = (spirit) => {
    setSelectedSpirit(spirit);
  };

  const handleInsert = () => {
    if (!selectedSpirit) return;
    onSelect({ spirit: selectedSpirit, mode: displayMode, alignment, level: selectedLevel });
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
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {currentSpirits.map(spirit => {
                const typeGradient = spiritColors[spirit.name] || 'from-gray-500 to-gray-600';
                return (
                  <button
                    key={spirit.id}
                    onClick={() => handleSpiritSelect(spirit)}
                    className={`group relative rounded-lg overflow-hidden border-2 transition-all ${
                      selectedSpirit?.id === spirit.id
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
                    {selectedSpirit?.id === spirit.id && (
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
          )}
        </div>

        {/* Spirit Preview Panel (if selected) */}
        {selectedSpirit && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
            <div className="flex flex-col gap-4">
              {/* Top: Display Mode, Alignment & Level Selection */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Display Mode */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide whitespace-nowrap">
                    Display:
                  </label>
                  <div className="flex gap-1">
                    {[
                      { value: 'compact', label: 'Compact' },
                      { value: 'detailed', label: 'Detailed' },
                      { value: 'advanced', label: 'Advanced' }
                    ].map(mode => (
                      <button
                        key={mode.value}
                        onClick={() => setDisplayMode(mode.value)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
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

                {/* Alignment */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide whitespace-nowrap">
                    Align:
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setAlignment('none')}
                      title="No Alignment"
                      className={`px-2.5 py-1 rounded transition-all flex items-center justify-center ${
                        alignment === 'none'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setAlignment('left')}
                      title="Align Left"
                      className={`px-2.5 py-1 rounded transition-all flex items-center justify-center ${
                        alignment === 'left'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setAlignment('center')}
                      title="Align Center"
                      className={`px-2.5 py-1 rounded transition-all flex items-center justify-center ${
                        alignment === 'center'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setAlignment('right')}
                      title="Align Right"
                      className={`px-2.5 py-1 rounded transition-all flex items-center justify-center ${
                        alignment === 'right'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Evolution Level Selector */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide whitespace-nowrap">
                    Level:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="7"
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(parseInt(e.target.value))}
                      className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[2ch] text-center">
                      {selectedLevel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom: Preview */}
              <div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 max-h-80 overflow-y-auto">
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
              disabled={!selectedSpirit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Insert Spirit
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default SpiritPicker;
