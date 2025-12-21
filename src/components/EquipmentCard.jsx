import React, { useState, useEffect } from 'react';
import { getRarityBackgroundColor, getEquipmentRarityColor } from '../config/rarityColors';
import { createLogger } from '../utils/logger';

const logger = createLogger('EquipmentCard');

/**
 * EquipmentCard Component
 *
 * Displays detailed information about equipment items (Soul Weapons or Equipment Drops)
 *
 * Usage:
 * 1. By Name: <EquipmentCard name="Innocence" type="soul-weapons" />
 * 2. By ID: <EquipmentCard id={1} type="equipment-drops" />
 * 3. With Data: <EquipmentCard equipment={{...}} type="soul-weapons" />
 * 4. With Mode: <EquipmentCard name="Innocence" mode="compact" type="soul-weapons" />
 *
 * In Markdown:
 * <!-- equipment:Innocence:soul-weapons -->
 * <!-- equipment:Innocence:soul-weapons:compact -->
 * <!-- equipment:1:equipment-drops -->
 *
 * @param {string} mode - Display mode: 'compact', 'detailed' (default), 'advanced' (future)
 * @param {string} type - Equipment type: 'soul-weapons' (default) or 'equipment-drops'
 */
const EquipmentCard = ({ name, id, equipment, mode = 'detailed', type = 'soul-weapons' }) => {
  const [equipmentData, setEquipmentData] = useState(equipment || null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(!equipment);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If equipment data provided directly, use it
    if (equipment) {
      setEquipmentData(equipment);
      // Use image directly from data
      if (equipment.image) {
        setImageUrl(equipment.image);
      }
      setLoading(false);
      return;
    }

    // Otherwise, load from appropriate JSON file
    const loadEquipment = async () => {
      try {
        setLoading(true);

        let dataUrl = type === 'equipment-drops' ? '/data/equipment-drops.json' : '/data/soul-weapons.json';
        const response = await fetch(dataUrl);

        if (!response.ok) {
          throw new Error('Failed to load equipment data');
        }

        let equipmentList;
        if (type === 'equipment-drops') {
          const jsonData = await response.json();
          equipmentList = jsonData.equipmentDrops || [];
        } else {
          equipmentList = await response.json();
        }

        // Find equipment by ID or name
        let foundEquipment = null;
        if (id !== undefined) {
          foundEquipment = equipmentList.find(e => e.id === parseInt(id));
        } else if (name) {
          foundEquipment = equipmentList.find(e =>
            e.name && e.name.toLowerCase() === name.toLowerCase()
          );
        }

        if (!foundEquipment) {
          throw new Error(`Equipment not found: ${name || id}`);
        }

        setEquipmentData(foundEquipment);
        // Use image directly from data
        if (foundEquipment.image) {
          setImageUrl(foundEquipment.image);
        }
      } catch (err) {
        logger.error('Error loading equipment:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadEquipment();
  }, [id, name, equipment, type]);


  // Format large numbers with commas
  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Get rarity tier from requirements (Soul Weapons) or rarity field (Equipment Drops)
  const getRarityTier = () => {
    if (!equipmentData) return 'Common';

    if (type === 'equipment-drops') {
      // Equipment drops have rarity like "Common 4", extract base rarity
      const rarity = equipmentData.rarity || 'Common';
      const baseRarity = rarity.split(' ')[0]; // "Common 4" -> "Common"
      return baseRarity;
    }

    // Soul weapons use requirements
    const requirements = equipmentData.requirements || 0;
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

  const rarity = getRarityTier();
  const rarityColor = getRarityColor(rarity);
  const rarityBadgeColor = getRarityBackgroundColor(rarity);
  const equipmentName = type === 'soul-weapons' ? equipmentData.name : `${equipmentData.type} - ${equipmentData.rarity}`;

  const rarityGlow = getEquipmentRarityColor(rarity);

  // Render based on mode
  if (mode === 'compact') {
    return (
      <div className={`not-prose inline-flex items-center gap-2 bg-white dark:bg-gray-800 rounded-md shadow-sm border-2 px-2 py-1.5 my-1 max-w-fit ${rarityGlow.border} ${rarityGlow.glow}`}>
        {/* Icon */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={equipmentName}
            className="w-8 h-8 rounded bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 p-0.5 m-0"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate m-0">{equipmentName}</h4>
            <span className={`${rarityBadgeColor} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0`}>
              {rarity}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
            {type === 'soul-weapons' ? (
              <>
                <span>⚔️ {formatNumber(equipmentData.attack)}</span>
                <span>💰 {formatNumber(equipmentData.requirements)}</span>
                {equipmentData.stageRequirement && <span>📍 {equipmentData.stageRequirement}</span>}
              </>
            ) : (
              <>
                <span>📦 {equipmentData.type}</span>
                <span>🎲 {equipmentData.probability}%</span>
              </>
            )}
          </div>
        </div>

        {/* Type Badge - Only show for Soul Weapons */}
        {type === 'soul-weapons' && (
          <span className={`bg-gradient-to-r ${rarityColor} text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0`}>
            Soul Weapon
          </span>
        )}
      </div>
    );
  }

  if (mode === 'advanced') {
    return (
      <div className={`not-prose bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 my-2 ${rarityGlow.border} ${rarityGlow.glow} max-w-md`}>
        {/* Header with gradient background */}
        <div className={`bg-gradient-to-r ${rarityColor} p-2 text-white`}>
          <div className="flex items-start gap-2">
            {/* Equipment Icon */}
            {imageUrl && (
              <div className="flex-shrink-0">
                <img
                  src={imageUrl}
                  alt={equipmentName}
                  className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm p-1 shadow-lg border border-white/20"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}

            {/* Equipment Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold mb-0.5">{equipmentName}</h3>
              <p className="text-[9px] opacity-90">
                {type === 'soul-weapons'
                  ? (equipmentData.stageRequirement || 'Available from start')
                  : `${equipmentData.type} Equipment Drop`}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-col items-end gap-0.5 ml-1 flex-shrink-0">
              <span className={`${rarityBadgeColor} text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full`}>
                {rarity}
              </span>
              <span className="bg-white/20 backdrop-blur-sm text-white text-[8px] font-semibold px-1.5 py-0.5 rounded-full">
                #{equipmentData.id}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-2">
          {type === 'soul-weapons' ? (
            <>
              {/* Stats Grid - All Stats */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5">
                  <div className="text-[8px] text-gray-500 dark:text-gray-500 mb-0.5">Attack</div>
                  <div className="text-xs font-bold text-red-600 dark:text-red-400">
                    {formatNumber(equipmentData.attack)}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5">
                  <div className="text-[8px] text-gray-500 dark:text-gray-500 mb-0.5">Cost</div>
                  <div className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                    {formatNumber(equipmentData.requirements)}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5">
                  <div className="text-[8px] text-gray-500 dark:text-gray-500 mb-0.5">Disassembly</div>
                  <div className="text-xs font-bold text-green-600 dark:text-green-400">
                    {formatNumber(equipmentData.disassemblyReward)}
                  </div>
                </div>
              </div>

              {/* Efficiency Analysis */}
              <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-900/50 dark:to-gray-800/50 rounded p-2 border border-gray-200 dark:border-gray-700 mb-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[8px] text-gray-600 dark:text-gray-400 mb-0.5">
                      Efficiency
                    </div>
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      {(equipmentData.attack / equipmentData.requirements * 100000).toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] text-gray-600 dark:text-gray-400 mb-0.5">
                      Return Rate
                    </div>
                    <div className="text-xs font-bold text-green-600 dark:text-green-400">
                      {(equipmentData.disassemblyReward / equipmentData.requirements * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced: Progression Info */}
              {equipmentData.id > 1 && equipmentData.id <= 57 && (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-2 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-[9px] font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1.5">
                    Progression Analysis
                  </h4>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Position:</span>
                      <span className="font-bold text-gray-900 dark:text-white">Weapon {equipmentData.id}/57</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Progress:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{((equipmentData.id / 57) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Stats Grid - Equipment Drops */}
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5">
                  <div className="text-[8px] text-gray-500 dark:text-gray-500 mb-0.5">Type</div>
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {equipmentData.type}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5">
                  <div className="text-[8px] text-gray-500 dark:text-gray-500 mb-0.5">Drop Rate</div>
                  <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    {equipmentData.probability}%
                  </div>
                </div>
              </div>

              {/* Rarity Information */}
              <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-900/50 dark:to-gray-800/50 rounded p-2 border border-gray-200 dark:border-gray-700">
                <div className="text-[8px] text-gray-600 dark:text-gray-400 mb-1">Equipment Drop Information</div>
                <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  {equipmentData.rarity} Rarity
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Default: detailed mode
  return (
    <div className={`not-prose bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 my-2 ${rarityGlow.border} ${rarityGlow.glow} max-w-md`}>
      {/* Header with gradient background */}
      <div className={`bg-gradient-to-r ${rarityColor} p-2 text-white`}>
        <div className="flex items-start gap-2">
          {/* Equipment Icon */}
          {imageUrl && (
            <div className="flex-shrink-0">
              <img
                src={imageUrl}
                alt={equipmentName}
                className="w-12 h-12 rounded-lg bg-white/10 backdrop-blur-sm p-1 shadow-lg border border-white/20"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}

          {/* Equipment Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold mb-0.5">{equipmentName}</h3>
            <p className="text-[10px] opacity-90">
              {type === 'soul-weapons'
                ? (equipmentData.stageRequirement || 'Available from start')
                : `${equipmentData.type} Equipment Drop`}
            </p>
          </div>

          {/* Badges */}
          <div className="flex flex-col items-end gap-1 ml-1 flex-shrink-0">
            <span className={`${rarityBadgeColor} text-white text-[9px] font-bold px-2 py-0.5 rounded-full`}>
              {rarity}
            </span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
              #{equipmentData.id}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-2">
        {type === 'soul-weapons' ? (
          <>
            {/* Stats Grid - Soul Weapons */}
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5">
                <div className="text-[9px] text-gray-500 dark:text-gray-500 mb-0.5">Attack</div>
                <div className="text-xs font-bold text-red-600 dark:text-red-400">
                  {formatNumber(equipmentData.attack)}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5">
                <div className="text-[9px] text-gray-500 dark:text-gray-500 mb-0.5">Cost</div>
                <div className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                  {formatNumber(equipmentData.requirements)}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5">
                <div className="text-[9px] text-gray-500 dark:text-gray-500 mb-0.5">Disassembly</div>
                <div className="text-xs font-bold text-green-600 dark:text-green-400">
                  {formatNumber(equipmentData.disassemblyReward)}
                </div>
              </div>
            </div>

            {/* Efficiency Information */}
            <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-900/50 dark:to-gray-800/50 rounded p-2 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] text-gray-600 dark:text-gray-400 mb-0.5">Efficiency</div>
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    {(equipmentData.attack / equipmentData.requirements * 100000).toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-gray-600 dark:text-gray-400 mb-0.5">Return</div>
                  <div className="text-sm font-bold text-green-600 dark:text-green-400">
                    {(equipmentData.disassemblyReward / equipmentData.requirements * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Stats Grid - Equipment Drops */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5">
                <div className="text-[9px] text-gray-500 dark:text-gray-500 mb-0.5">Type</div>
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {equipmentData.type}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5">
                <div className="text-[9px] text-gray-500 dark:text-gray-500 mb-0.5">Drop Rate</div>
                <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
                  {equipmentData.probability}%
                </div>
              </div>
            </div>

            {/* Rarity Information */}
            <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-900/50 dark:to-gray-800/50 rounded p-2 border border-gray-200 dark:border-gray-700">
              <div className="text-[9px] text-gray-600 dark:text-gray-400 mb-1">Rarity</div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                {equipmentData.rarity}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EquipmentCard;
