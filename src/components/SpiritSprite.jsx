import { useState, useEffect, useRef } from 'react';
import spiritData from '../../public/data/spirit-characters.json';

/**
 * SpiritSprite - Animated spirit sprite component
 * Displays a spirit with frame-by-frame animation from sprite sheets
 *
 * Sprite sheet layout (up to 16 frames total, 4 rows):
 * - Row 1 (frames 0-3): Attack animation
 * - Row 2 (frames 4-7): Side attack animation
 * - Row 3 (frames 8-11): Sideway movement animation
 * - Row 4 (frames 12-15): Idle animation
 *
 * Note: Frame layouts vary significantly between spirit levels.
 * Early levels may only have 2 frames total, while higher levels have 16.
 * The component intelligently detects ALL frames (0-15) and maps them to
 * animation types using priority-based fallback ranges. This prevents
 * blinking effects and handles any frame layout automatically.
 *
 * @param {number} spiritId - Spirit ID (1-12)
 * @param {number} level - Evolution level (0-7)
 * @param {string} animationType - Animation type: 'idle', 'attack', 'sideAttack', 'movement' (default: 'idle')
 * @param {boolean} animated - Whether to animate the sprite (default: true)
 * @param {number} fps - Animation speed in frames per second (default: 8)
 * @param {boolean} showInfo - Whether to show spirit name and level (default: false)
 * @param {string} size - Size preset: 'small' (64px), 'medium' (128px), 'large' (256px), or custom CSS value
 * @param {function} onAnimationTypesDetected - Callback with available animation types: { idle: {available, frameCount, frames: [12,13,14,15]}, attack: {...}, ... }
 */
const SpiritSprite = ({
  spiritId,
  level = 0,
  animationType = 'idle',
  animated = true,
  fps = 8,
  showInfo = false,
  size = 'medium',
  className = '',
  onAnimationTypesDetected = null // Callback to report available animation types
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(animated);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [validFrames, setValidFrames] = useState([]);
  const [framesDetected, setFramesDetected] = useState(false);
  const [availableAnimationTypes, setAvailableAnimationTypes] = useState({});
  const animationRef = useRef(null);
  const preloadedImages = useRef({});
  const detectionCompleteRef = useRef(false);

  // Animation type to frame range mapping (max possible frames)
  const animationFrameRanges = {
    attack: { start: 0, count: 4 },      // Frames 0-3
    sideAttack: { start: 4, count: 4 },  // Frames 4-7
    movement: { start: 8, count: 4 },    // Frames 8-11
    idle: { start: 12, count: 4 }        // Frames 12-15
  };

  // Find the spirit in the data
  const spirit = spiritData.spirits.find(s => s.id === spiritId);

  if (!spirit) {
    return (
      <div className="text-red-500 dark:text-red-400 p-4 border border-red-500 rounded">
        Spirit ID {spiritId} not found
      </div>
    );
  }

  // Get sprite data for the specified level
  const spriteLevel = spirit.sprites?.[level];

  if (!spriteLevel) {
    return (
      <div className="text-red-500 dark:text-red-400 p-4 border border-red-500 rounded">
        Level {level} not found for {spirit.name}
      </div>
    );
  }

  // Get the current animation range
  const animationRange = animationFrameRanges[animationType] || animationFrameRanges.idle;

  // Get the actual frame number for the sprite sheet
  const getActualFrameNumber = () => {
    const animationInfo = availableAnimationTypes[animationType];

    if (!animationInfo || !animationInfo.available || validFrames.length === 0) {
      return 0; // Fallback
    }

    // Use the actual frame numbers we detected
    const frameNumbers = animationInfo.frames;
    const frameIndex = currentFrame % frameNumbers.length;
    return frameNumbers[frameIndex];
  };

  // Get the current frame image path
  const getCurrentFramePath = () => {
    const { spriteSheet } = spriteLevel;
    return spriteSheet.replace('{frame}', getActualFrameNumber());
  };

  // Size presets
  const sizeMap = {
    small: '64px',
    medium: '128px',
    large: '256px',
  };

  const spriteSize = sizeMap[size] || size;

  // Sync isPlaying with animated prop
  useEffect(() => {
    setIsPlaying(animated);
  }, [animated]);

  // Detect all available animation types on mount/change
  useEffect(() => {
    const detectAllAnimationTypes = async () => {
      // Step 1: Detect ALL frames that exist (0-15)
      const allFramesPromises = [];
      for (let frameNum = 0; frameNum < 16; frameNum++) {
        const framePath = spriteLevel.spriteSheet.replace('{frame}', frameNum);

        const promise = new Promise((resolve) => {
          const img = new Image();

          img.onload = () => {
            // Check if the image has valid dimensions
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              // Check if image is not empty by drawing to canvas and checking pixels
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);

              try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels = imageData.data;

                // Check if any pixel has non-zero alpha (is not fully transparent)
                let hasContent = false;
                for (let i = 3; i < pixels.length; i += 4) { // Check alpha channel (every 4th value)
                  if (pixels[i] > 10) { // Alpha > 10 (allow for slight transparency artifacts)
                    hasContent = true;
                    break;
                  }
                }

                if (hasContent) {
                  resolve(frameNum);
                } else {
                  resolve(null);
                }
              } catch (e) {
                // Canvas security error or other issue - assume frame is valid
                resolve(frameNum);
              }
            } else {
              resolve(null);
            }
          };

          img.onerror = () => {
            resolve(null);
          };

          img.src = framePath;

          // Add timeout
          setTimeout(() => {
            if (!img.complete) {
              resolve(null);
            }
          }, 3000);
        });
        allFramesPromises.push(promise);
      }

      const allFrameResults = await Promise.all(allFramesPromises);
      const existingFrames = allFrameResults.filter(r => r !== null);

      // Step 2: Intelligently map existing frames to animation types
      // Try multiple possible frame ranges for each animation type
      const results = {};
      const framePriorities = {
        // For each animation type, define possible frame ranges in priority order
        idle: [
          [12, 13, 14, 15], // Standard idle position
          [0, 1, 2, 3],     // Fallback: first 4 frames
          [0, 1],           // Fallback: first 2 frames
        ],
        attack: [
          [0, 1, 2, 3],     // Standard attack position
          [4, 5, 6, 7],     // Alternative
          [0, 1],           // Fallback: any 2 frames
        ],
        sideAttack: [
          [4, 5, 6, 7],     // Standard side attack position
          [0, 1],           // Fallback: first 2 frames (common for low levels)
          [2, 3],           // Alternative
          [0, 1, 2, 3],     // Fallback: first 4 frames
        ],
        movement: [
          [8, 9, 10, 11],   // Standard movement position
          [2, 3, 4, 5],     // Alternative
          [0, 1],           // Fallback
        ]
      };

      const usedFrames = new Set();

      for (const [typeName, priorityRanges] of Object.entries(framePriorities)) {
        let bestMatch = null;
        let bestMatchCount = 0;

        // Try each priority range
        for (const frameRange of priorityRanges) {
          const matchingFrames = frameRange.filter(f =>
            existingFrames.includes(f) && !usedFrames.has(f)
          );

          if (matchingFrames.length > bestMatchCount) {
            bestMatch = matchingFrames;
            bestMatchCount = matchingFrames.length;
          }
        }

        if (bestMatch && bestMatch.length > 0) {
          // Mark these frames as used
          bestMatch.forEach(f => usedFrames.add(f));

          results[typeName] = {
            available: true,
            frameCount: bestMatch.length,
            frames: bestMatch // Store actual frame numbers
          };
        } else {
          results[typeName] = {
            available: false,
            frameCount: 0,
            frames: []
          };
        }
      }

      setAvailableAnimationTypes(results);
      detectionCompleteRef.current = true;

      // Report to parent component if callback provided
      if (onAnimationTypesDetected) {
        onAnimationTypesDetected(results);
      }
    };

    detectionCompleteRef.current = false;
    detectAllAnimationTypes();
  }, [spiritId, level, spirit.name]);

  // Use pre-detected frames for current animation type
  useEffect(() => {
    const loadFramesForAnimationType = async () => {
      // Wait for animation type detection to complete
      if (!detectionCompleteRef.current) {
        return;
      }

      const animationInfo = availableAnimationTypes[animationType];

      if (!animationInfo || !animationInfo.available) {
        setValidFrames([]);
        setFramesDetected(true);
        return;
      }

      // Use the pre-detected frame numbers
      const frameNumbers = animationInfo.frames;
      const tempPreloaded = {};
      const promises = [];

      // Preload the actual frames
      for (let i = 0; i < frameNumbers.length; i++) {
        const frameNumber = frameNumbers[i];
        const framePath = spriteLevel.spriteSheet.replace('{frame}', frameNumber);

        const promise = new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            tempPreloaded[frameNumber] = img;
            resolve(i);
          };
          img.onerror = () => {
            resolve(null);
          };
          img.src = framePath;
        });

        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const validIndices = results.filter(r => r !== null);

      // Update preloaded images cache
      preloadedImages.current = tempPreloaded;

      // Store the indices (0, 1, 2...) for animation loop
      setValidFrames(validIndices);
      setFramesDetected(true);
    };

    // Reset state and start loading
    setFramesDetected(false);
    setCurrentFrame(0);
    // Don't pause during loading - keep current playing state

    loadFramesForAnimationType().then(() => {
      // Always resume playing if animated prop is true
      // This ensures rapid level changes don't break the animation
      if (animated) {
        setIsPlaying(true);
      }
    });
  }, [animationType, availableAnimationTypes, spiritId, level, spirit.name, animated]);

  // Reset frame when animation type changes
  useEffect(() => {
    setCurrentFrame(0);
  }, [animationType]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || !framesDetected || validFrames.length === 0) return;

    const frameDelay = 1000 / fps;

    animationRef.current = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % validFrames.length);
    }, frameDelay);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isPlaying, fps, validFrames.length, framesDetected]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentFrame(0);
  };

  return (
    <div className={`spirit-sprite-container inline-block ${className}`}>
      <div className="relative group">
        {/* Sprite Image */}
        <div
          className="relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700"
          style={{ width: spriteSize, height: spriteSize }}
        >
          {/* Show loading spinner while detecting frames */}
          {!framesDetected && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {/* Show image only after frame detection completes and we have valid frames */}
          {framesDetected && validFrames.length > 0 && (
            <img
              src={getCurrentFramePath()}
              alt={`${spirit.name} - Level ${level} - Frame ${currentFrame}`}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.src = '/images/placeholder-spirit.png'; // Fallback image
              }}
            />
          )}

          {/* Show error if no valid frames found */}
          {framesDetected && validFrames.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-red-500 dark:text-red-400 text-xs p-2 text-center">
              No frames found for this animation
            </div>
          )}

          {/* Animation Controls (show on hover) - only show if we have valid frames and size is not small */}
          {framesDetected && validFrames.length > 0 && size !== 'small' && (
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-1">
              <div className="flex items-center justify-center gap-2">
              <button
                onClick={handlePlayPause}
                className="text-white hover:text-blue-400 transition-colors p-1"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 4.1c-.3-.2-.7-.2-1 0-.3.2-.5.5-.5.9v10c0 .4.2.7.5.9.3.2.7.2 1 0l8-5c.3-.2.5-.5.5-.9s-.2-.7-.5-.9l-8-5z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleReset}
                className="text-white hover:text-blue-400 transition-colors p-1"
                title="Reset to first frame"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 2v6h6M16 18v-6h-6" />
                  <path d="M16 2a8 8 0 0 0-11.3 11.3M4 18a8 8 0 0 0 11.3-11.3" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              </button>
              <span className="text-white text-xs ml-1">
                {currentFrame + 1}/{validFrames.length || animationRange.count}
              </span>
            </div>
            <div className="text-center text-xs text-blue-300">
              {animationType === 'sideAttack' ? 'Side Attack' :
               animationType.charAt(0).toUpperCase() + animationType.slice(1)}
            </div>
          </div>
          )}
        </div>

        {/* Spirit Info */}
        {showInfo && (
          <div className="mt-2 text-center">
            <div className="font-bold text-gray-900 dark:text-white">
              {spirit.name}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Level {level}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {spirit.skill.name}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpiritSprite;
