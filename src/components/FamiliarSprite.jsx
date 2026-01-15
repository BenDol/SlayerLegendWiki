import { useState, useEffect, useRef } from 'react';
import { createLogger } from '../utils/logger';
import { resolveImagePath } from '../../wiki-framework/src/utils/imageResolver';
import { getSpriteVariant, getWeaponTier } from '../utils/familiarHelpers';
import { recolorSprite } from '../utils/spriteRecolor';

const logger = createLogger('FamiliarSprite');

/**
 * FamiliarSprite - Animated familiar sprite component
 * Displays a familiar with frame-by-frame animation
 *
 * @param {number} familiarId - Familiar ID (1-12)
 * @param {number} starLevel - Star level (0-10)
 * @param {Array} progressionData - Star progression data (for rarity lookup)
 * @param {boolean} animated - Whether to animate the sprite (default: true)
 * @param {number} fps - Animation speed in frames per second (default: 8)
 * @param {boolean} showInfo - Whether to show familiar name and star level (default: false)
 * @param {string} size - Size preset: 'small' (64px), 'medium' (128px), 'large' (256px), or custom CSS value
 * @param {string} className - Additional CSS classes
 * @param {Object} familiarData - Familiar data object (name, element, etc.)
 * @param {string} recolorHex - Optional hex color for accurate recoloring (e.g., "#F6473F")
 */
const FamiliarSprite = ({
  familiarId,
  starLevel = 0,
  progressionData = [],
  animated = true,
  fps = 8,
  showInfo = false,
  size = 'medium',
  className = '',
  familiarData = null,
  recolorHex = null
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [recoloredUrl, setRecoloredUrl] = useState(null);
  const animationRef = useRef(null);

  // Get sprite variant based on star level
  const spriteVariant = getSpriteVariant(starLevel, progressionData);

  // Animation frames for demon sprites (typically 17 frames: 0-16)
  const totalFrames = 17;

  // Get the current frame image path
  const getCurrentFramePath = () => {
    // Determine type based on familiar ID
    const type = familiarData?.type || getFamiliarType(familiarId);

    // Determine variant based on star level
    // 0-2 stars = variant 0
    // 3-5 stars = variant 1
    // 6-8 stars = variant 2
    // 9-10 stars = variant 3
    const variant = Math.min(3, Math.floor(starLevel / 3));

    // ATTRIBUTE (Element familiars, IDs 1-4)
    // Pattern: Demon_Attribute_Display_{ID}_{Variant}.png
    if (type === 'attribute') {
      const spriteId = String(familiarId).padStart(2, '0');
      return `familiars/Demon_Attribute_Display_${spriteId}_${variant}.png`;
    }

    // ATTACKSTYLE (Battle familiars, IDs 5-8)
    // Pattern: Demon_AttackStyle_Display_{ID}_{Variant}.png
    // Note: Sprite IDs are 01-04 (subtract 4 from familiar ID)
    if (type === 'battle') {
      const spriteId = String(familiarId - 4).padStart(2, '0');
      return `familiars/Demon_AttackStyle_Display_${spriteId}_${variant}.png`;
    }

    // ATTACKRANGE (Weapon familiars, IDs 9-12)
    // Pattern: Demon_AttackRange_Display_{ID}_{Variant}.png
    // Note: Sprite IDs are 01-04 (subtract 8 from familiar ID)
    if (type === 'weapon') {
      const spriteId = String(familiarId - 8).padStart(2, '0');
      return `familiars/Demon_AttackRange_Display_${spriteId}_${variant}.png`;
    }

    // Fallback to attribute pattern
    const spriteId = String(familiarId).padStart(2, '0');
    return `familiars/Demon_Attribute_Display_${spriteId}_${variant}.png`;
  };

  // Helper function to get familiar type based on ID
  const getFamiliarType = (id) => {
    if (id >= 1 && id <= 4) return 'attribute'; // Element familiars (attribute type)
    if (id >= 5 && id <= 8) return 'battle';    // Battle familiars (battle type)
    if (id >= 9 && id <= 12) return 'weapon';   // Weapon familiars (weapon type)
    return 'attribute'; // Default
  };

  // Size presets
  const sizeMap = {
    small: '64px',
    medium: '128px',
    large: '256px',
  };

  const spriteSize = sizeMap[size] || size;

  // Animation loop
  useEffect(() => {
    if (!animated) return;

    const frameDelay = 1000 / fps;

    animationRef.current = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % totalFrames);
    }, frameDelay);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [animated, fps, totalFrames]);

  // Preload image and apply recoloring if needed
  useEffect(() => {
    const framePath = getCurrentFramePath();
    const resolvedUrl = resolveImagePath(framePath);

    const img = new Image();
    img.onload = () => {
      // Apply recoloring if hex color provided
      if (recolorHex) {
        try {
          const recolored = recolorSprite(img, recolorHex);
          setRecoloredUrl(recolored);
          logger.debug('Sprite recolored', { familiarId, starLevel, recolorHex });
        } catch (error) {
          logger.error('Failed to recolor sprite', { error, familiarId, recolorHex });
          setRecoloredUrl(null);
        }
      } else {
        setRecoloredUrl(null);
      }

      setImageLoaded(true);
      setImageError(false);
    };
    img.onerror = () => {
      logger.warn('Failed to load familiar sprite', { familiarId, starLevel, path: framePath });
      setImageError(true);
      setImageLoaded(true);
      setRecoloredUrl(null);
    };
    img.crossOrigin = 'anonymous'; // Required for canvas manipulation
    img.src = resolvedUrl;
  }, [familiarId, starLevel, recolorHex]);

  const framePath = getCurrentFramePath();
  const resolvedUrl = resolveImagePath(framePath);

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: spriteSize, height: spriteSize }}
    >
      {/* Loading skeleton */}
      {!imageLoaded && (
        <div
          className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"
          style={{ width: spriteSize, height: spriteSize }}
        />
      )}

      {/* Error state */}
      {imageError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded"
          style={{ width: spriteSize, height: spriteSize }}
        >
          <div className="text-center p-2">
            <div className="text-2xl mb-1">👹</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Familiar #{familiarId}
            </div>
          </div>
        </div>
      )}

      {/* Sprite image */}
      {!imageError && (
        <img
          src={recoloredUrl || resolvedUrl}
          alt={familiarData?.name || `Familiar ${familiarId}`}
          className={`absolute inset-0 object-contain ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
          style={{
            width: spriteSize,
            height: spriteSize,
            imageRendering: 'pixelated' // Keep pixel art crisp
          }}
        />
      )}

      {/* Info overlay */}
      {showInfo && familiarData && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 text-center">
          <div className="font-semibold truncate">{familiarData.name}</div>
          <div className="text-yellow-400">
            {'★'.repeat(starLevel)}
            {starLevel < 10 && '☆'.repeat(10 - starLevel)}
          </div>
        </div>
      )}
    </div>
  );
};

export default FamiliarSprite;
