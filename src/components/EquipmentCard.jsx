import React, { useState, useEffect } from 'react';
import { getRarityBackgroundColor } from '../../wiki-framework/src/utils/rarityColors';

/**
 * EquipmentCard Component
 *
 * Displays detailed information about equipment items (weapons) from equipment.json
 *
 * Usage:
 * 1. By Name: <EquipmentCard name="Innocence" />
 * 2. By ID: <EquipmentCard id={1} />
 * 3. With Data: <EquipmentCard equipment={{...}} />
 * 4. With Mode: <EquipmentCard name="Innocence" mode="compact" />
 *
 * In Markdown:
 * <!-- equipment:Innocence -->
 * <!-- equipment:Innocence:compact -->
 * <!-- equipment:1 -->
 *
 * @param {string} mode - Display mode: 'compact', 'detailed' (default), 'advanced' (future)
 */
const EquipmentCard = ({ name, id, equipment, mode = 'detailed' }) => {
  const [equipmentData, setEquipmentData] = useState(equipment || null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(!equipment);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If equipment data provided directly, use it
    if (equipment) {
      setEquipmentData(equipment);
      loadImage(equipment.name);
      setLoading(false);
      return;
    }

    // Otherwise, load from equipment.json
    const loadEquipment = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/equipment.json');

        if (!response.ok) {
          throw new Error('Failed to load equipment data');
        }

        const equipmentList = await response.json();

        // Find equipment by ID or name
        let foundEquipment = null;
        if (id !== undefined) {
          foundEquipment = equipmentList.find(e => e.id === parseInt(id));
        } else if (name) {
          foundEquipment = equipmentList.find(e =>
            e.name.toLowerCase() === name.toLowerCase()
          );
        }

        if (!foundEquipment) {
          throw new Error(`Equipment not found: ${name || id}`);
        }

        setEquipmentData(foundEquipment);
        loadImage(foundEquipment.name);
      } catch (err) {
        console.error('Error loading equipment:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadEquipment();
  }, [id, name, equipment]);

  // Load equipment image from image database
  const loadImage = async (equipmentName) => {
    try {
      const response = await fetch('/data/image-index.json');
      if (!response.ok) return;

      const imageData = await response.json();

      // Search for equipment image by name (fuzzy match)
      const searchName = equipmentName.toLowerCase().replace(/\s+/g, '');
      const foundImage = imageData.images.find(img => {
        const imgName = img.path.toLowerCase().replace(/\s+/g, '');
        return (img.category === 'equipment/weapons' || img.category === 'equipment') &&
               (imgName.includes(searchName) || searchName.includes(img.keywords?.[0] || ''));
      });

      if (foundImage) {
        setImageUrl(foundImage.path);
      }
    } catch (err) {
      console.warn('Could not load equipment image:', err);
    }
  };

  // Format large numbers with commas
  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Get rarity tier from requirements
  const getRarityTier = (requirements) => {
    if (requirements >= 100000000000) return 'Legendary';
    if (requirements >= 1000000000) return 'Epic';
    if (requirements >= 10000000) return 'Rare';
    if (requirements >= 100000) return 'Great';
    return 'Common';
  };

  // Get rarity color classes
  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'Legendary':
        return 'from-orange-500 to-yellow-500';
      case 'Epic':
        return 'from-purple-500 to-pink-500';
      case 'Rare':
        return 'from-blue-500 to-cyan-500';
      case 'Great':
        return 'from-green-500 to-emerald-500';
      case 'Common':
      default:
        return 'from-gray-500 to-slate-500';
    }
  };


  // Loading state
  if (loading) {
    return (
      <div className="not-prose bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-48 bg-gray-700 rounded-lg mb-4"></div>
        <div className="h-8 bg-gray-700 rounded mb-2"></div>
        <div className="h-4 bg-gray-700 rounded mb-4 w-3/4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="not-prose bg-red-900/20 border border-red-500 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-red-400 font-semibold text-lg m-0">Equipment Not Found</h3>
        </div>
        <p className="text-red-300 m-0">{error}</p>
      </div>
    );
  }

  if (!equipmentData) {
    return null;
  }

  const rarity = getRarityTier(equipmentData.requirements);
  const rarityColor = getRarityColor(rarity);
  const rarityBadgeColor = getRarityBackgroundColor(rarity);

  // Render based on mode
  if (mode === 'compact') {
    return (
      <div className="not-prose inline-flex items-center gap-2 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 px-2 py-1.5 my-1 max-w-fit">
        {/* Icon */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={equipmentData.name}
            className="w-8 h-8 rounded bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 p-0.5 m-0"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate m-0">{equipmentData.name}</h4>
            <span className={`${rarityBadgeColor} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0`}>
              {rarity}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
            <span>⚔️ {formatNumber(equipmentData.attack)}</span>
            <span>💰 {formatNumber(equipmentData.requirements)}</span>
            {equipmentData.stageRequirement && <span>📍 {equipmentData.stageRequirement}</span>}
          </div>
        </div>

        {/* Rarity Badge */}
        <span className={`bg-gradient-to-r ${rarityColor} text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0`}>
          Weapon
        </span>
      </div>
    );
  }

  if (mode === 'advanced') {
    return (
      <div className="not-prose bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 my-4">
        {/* Header with gradient background */}
        <div className={`bg-gradient-to-r ${rarityColor} p-4 text-white`}>
          <div className="flex items-start gap-4">
            {/* Equipment Icon */}
            {imageUrl && (
              <div className="flex-shrink-0">
                <img
                  src={imageUrl}
                  alt={equipmentData.name}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-white/10 backdrop-blur-sm p-2 shadow-lg border-2 border-white/20"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}

            {/* Equipment Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold mb-1">{equipmentData.name}</h3>
              <p className="text-sm opacity-90">{equipmentData.stageRequirement || 'Available from start'}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-col items-end gap-2 ml-2 flex-shrink-0">
              <span className={`${rarityBadgeColor} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                {rarity}
              </span>
              <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
                Weapon #{equipmentData.id}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Stats Grid - All Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">Attack</div>
              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                {formatNumber(equipmentData.attack)}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">Cost</div>
              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                {formatNumber(equipmentData.requirements)}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">Disassembly</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {formatNumber(equipmentData.disassemblyReward)}
              </div>
            </div>
          </div>

          {/* Efficiency Analysis */}
          <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-900/50 dark:to-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Efficiency
                </div>
                <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                  {(equipmentData.attack / equipmentData.requirements * 100000).toFixed(2)} ATK/100k
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Return Rate
                </div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {(equipmentData.disassemblyReward / equipmentData.requirements * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Advanced: Progression Info */}
          {equipmentData.id > 1 && equipmentData.id <= 57 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-3">
                Progression Analysis
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Position in Tree:</span>
                  <span className="font-bold text-gray-900 dark:text-white">Weapon {equipmentData.id} of 57</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Progression:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{((equipmentData.id / 57) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default: detailed mode
  return (
    <div className="not-prose bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 my-4">
      {/* Header with gradient background */}
      <div className={`bg-gradient-to-r ${rarityColor} p-4 text-white`}>
        <div className="flex items-start gap-4">
          {/* Equipment Icon */}
          {imageUrl && (
            <div className="flex-shrink-0">
              <img
                src={imageUrl}
                alt={equipmentData.name}
                className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-white/10 backdrop-blur-sm p-2 shadow-lg border-2 border-white/20"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}

          {/* Equipment Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-bold mb-1">{equipmentData.name}</h3>
            <p className="text-sm opacity-90">{equipmentData.stageRequirement || 'Available from start'}</p>
          </div>

          {/* Badges */}
          <div className="flex flex-col items-end gap-2 ml-2 flex-shrink-0">
            <span className={`${rarityBadgeColor} text-white text-xs font-bold px-3 py-1 rounded-full`}>
              {rarity}
            </span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
              Weapon #{equipmentData.id}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {/* Attack */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">Attack</div>
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {formatNumber(equipmentData.attack)}
            </div>
          </div>

          {/* Cost */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">Cost</div>
            <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
              {formatNumber(equipmentData.requirements)}
            </div>
          </div>

          {/* Disassembly */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">Disassembly</div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatNumber(equipmentData.disassemblyReward)}
            </div>
          </div>
        </div>

        {/* Efficiency Information */}
        <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-900/50 dark:to-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Efficiency
              </div>
              <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                {(equipmentData.attack / equipmentData.requirements * 100000).toFixed(2)} ATK/100k
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Return Rate
              </div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {(equipmentData.disassemblyReward / equipmentData.requirements * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EquipmentCard;
