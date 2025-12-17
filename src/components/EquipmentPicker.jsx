import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { getEquipmentRarityColor } from '../../wiki-framework/src/utils/rarityColors';

// Import imageService from parent project
let imageService = null;
try {
  imageService = require('../services/imageService');
} catch (err) {
  console.warn('Image service not found in parent project');
}

/**
 * EquipmentPicker Modal - Select equipment to insert into markdown
 * Features:
 * - Browse equipment with card grid
 * - Search and filter by rarity
 * - Preview panel with equipment details and image
 * - Display mode selection (compact/detailed/advanced)
 * - Pagination for large equipment lists
 */
const EquipmentPicker = ({ isOpen, onClose, onSelect, renderPreview = null }) => {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('All');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [displayMode, setDisplayMode] = useState('detailed');
  const [alignment, setAlignment] = useState('none');
  const [equipmentImages, setEquipmentImages] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const equipmentPerPage = 12;

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

    const loadEquipment = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/equipment.json');
        if (!response.ok) {
          throw new Error('Failed to load equipment');
        }
        const data = await response.json();
        setEquipment(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadEquipment();
  }, [isOpen]);

  // Load images for equipment
  useEffect(() => {
    if (!equipment.length || !imageService) return;

    const loadImages = async () => {
      const images = {};
      for (const item of equipment) {
        try {
          const imagePath = await imageService.getEquipmentImage(item.name);
          images[item.id] = imagePath;
        } catch (err) {
          console.warn(`Failed to load image for ${item.name}:`, err);
        }
      }
      setEquipmentImages(images);
    };

    loadImages();
  }, [equipment]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
    }
  }, [searchTerm, selectedRarity, isOpen]);

  // Get rarity tier from requirements
  const getRarityTier = (requirements) => {
    if (requirements >= 100000000000) return 'Legendary';
    if (requirements >= 1000000000) return 'Epic';
    if (requirements >= 10000000) return 'Rare';
    if (requirements >= 100000) return 'Great';
    return 'Common';
  };

  // Get unique rarities
  const rarities = ['All', ...new Set(equipment.map(e => getRarityTier(e.requirements)))];

  // Filter equipment
  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.stageRequirement && item.stageRequirement.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRarity = selectedRarity === 'All' || getRarityTier(item.requirements) === selectedRarity;
    return matchesSearch && matchesRarity;
  });

  // Pagination
  const totalPages = Math.ceil(filteredEquipment.length / equipmentPerPage);
  const startIndex = (currentPage - 1) * equipmentPerPage;
  const endIndex = startIndex + equipmentPerPage;
  const currentEquipment = filteredEquipment.slice(startIndex, endIndex);

  const handleEquipmentSelect = (item) => {
    setSelectedEquipment(item);
  };

  const handleInsert = () => {
    if (!selectedEquipment) return;
    onSelect({ equipment: selectedEquipment, mode: displayMode, alignment });
    onClose();
  };

  // Format large numbers with commas
  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
            Insert Equipment Card
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
              placeholder="Search equipment..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={selectedRarity}
                onChange={(e) => setSelectedRarity(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="All">All Rarities ({equipment.length})</option>
                {rarities.slice(1).map(rarity => {
                  const count = equipment.filter(e => getRarityTier(e.requirements) === rarity).length;
                  return <option key={rarity} value={rarity}>{rarity} ({count})</option>;
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-3"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading equipment...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-red-600 dark:text-red-400">
                <p className="font-semibold mb-2">Error loading equipment</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : filteredEquipment.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <p className="font-semibold mb-1">No equipment found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {currentEquipment.map(item => {
                const rarity = getRarityTier(item.requirements);
                const rarityColor = getEquipmentRarityColor(rarity);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleEquipmentSelect(item)}
                    className={`group relative rounded-lg overflow-hidden border-2 transition-all ${
                      selectedEquipment?.id === item.id
                        ? 'border-blue-500 ring-2 ring-blue-500 scale-105'
                        : `${rarityColor.border} ${rarityColor.glow} ${rarityColor.glowHover}`
                    }`}
                  >
                    <div className="aspect-square p-2 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex flex-col items-center justify-center">
                      {equipmentImages[item.id] && (
                        <img
                          src={equipmentImages[item.id]}
                          alt={item.name}
                          className="w-12 h-12 object-contain mb-1"
                        />
                      )}
                      <h3 className="text-[10px] font-semibold text-center text-gray-900 dark:text-white line-clamp-2 leading-tight">
                        {item.name}
                      </h3>
                    </div>
                    {/* Selected checkmark */}
                    {selectedEquipment?.id === item.id && (
                      <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
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

        {/* Equipment Preview Panel (if selected) */}
        {selectedEquipment && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
            <div className="flex flex-col gap-4">
              {/* Top: Display Mode & Alignment Selection */}
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
              </div>

              {/* Bottom: Preview */}
              <div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 max-h-[400px] overflow-y-auto">
                  {renderPreview ? (
                    renderPreview({ equipment: selectedEquipment, mode: displayMode })
                  ) : (
                    <div className="flex items-start gap-3">
                      {equipmentImages[selectedEquipment.id] && (
                        <img
                          src={equipmentImages[selectedEquipment.id]}
                          alt={selectedEquipment.name}
                          className="w-20 h-20 flex-shrink-0 object-contain bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 dark:text-white text-lg">{selectedEquipment.name}</h3>
                          <span className={`${getEquipmentRarityColor(getRarityTier(selectedEquipment.requirements)).background} text-white text-xs px-2 py-0.5 rounded-full`}>
                            {getRarityTier(selectedEquipment.requirements)}
                          </span>
                          <span className="bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full">
                            #{selectedEquipment.id}
                          </span>
                        </div>
                        {selectedEquipment.stageRequirement && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            📍 {selectedEquipment.stageRequirement}
                          </p>
                        )}
                        <div className="flex gap-3 text-xs text-gray-600 dark:text-gray-400">
                          <span>⚔️ ATK: {formatNumber(selectedEquipment.attack)}</span>
                          <span>💰 Cost: {formatNumber(selectedEquipment.requirements)}</span>
                          <span>♻️ Disassembly: {formatNumber(selectedEquipment.disassemblyReward)}</span>
                        </div>
                      </div>
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
              Page {currentPage} of {totalPages || 1} • {filteredEquipment.length} items
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
              disabled={!selectedEquipment}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Insert Equipment
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default EquipmentPicker;
