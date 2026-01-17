/**
 * Canvas-based sprite recoloring utility
 * Accurately recolors sprites to match exact hex values
 */

const recoloredCache = new Map();

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calculate color brightness (0-255)
 */
function getBrightness(r, g, b) {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Check if a pixel is truly black (outline/stroke)
 * More aggressive - only preserve very dark pixels
 */
function isBlackPixel(r, g, b) {
  // Only consider truly black pixels (all channels < 30)
  return r < 30 && g < 30 && b < 30;
}

/**
 * Recolor a sprite image to match target hex color
 * @param {HTMLImageElement} image - Source image
 * @param {string} targetColor - Target hex color (e.g., "#F6473F")
 * @returns {string} Data URL of recolored image
 */
export function recolorSprite(image, targetColor) {
  // Check cache first
  const cacheKey = `${image.src}_${targetColor}`;
  if (recoloredCache.has(cacheKey)) {
    return recoloredCache.get(cacheKey);
  }

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');

  // Draw original image
  ctx.drawImage(image, 0, 0);

  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Parse target color
  const target = hexToRgb(targetColor);
  if (!target) {
    console.error('Invalid target color:', targetColor);
    return image.src;
  }

  // Find the maximum brightness among all non-black pixels
  let maxBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a > 10 && !isBlackPixel(r, g, b)) {
      const brightness = getBrightness(r, g, b);
      if (brightness > maxBrightness) {
        maxBrightness = brightness;
      }
    }
  }

  if (maxBrightness === 0) {
    console.warn('Could not find any colored pixels in sprite');
    return image.src;
  }

  // Recolor ALL non-black, non-transparent pixels
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip truly transparent pixels and truly black pixels (outline)
    if (a < 10 || isBlackPixel(r, g, b)) {
      continue;
    }

    // Calculate this pixel's brightness relative to maximum
    const pixelBrightness = getBrightness(r, g, b);
    const brightnessFactor = maxBrightness > 0 ? pixelBrightness / maxBrightness : 1;

    // Apply target color with brightness adjustment
    data[i] = Math.min(255, Math.round(target.r * brightnessFactor));
    data[i + 1] = Math.min(255, Math.round(target.g * brightnessFactor));
    data[i + 2] = Math.min(255, Math.round(target.b * brightnessFactor));
    // Alpha stays the same
  }

  // Put recolored data back
  ctx.putImageData(imageData, 0, 0);

  // Convert to data URL
  const dataUrl = canvas.toDataURL('image/png');

  // Cache result
  recoloredCache.set(cacheKey, dataUrl);

  return dataUrl;
}

/**
 * Clear recolor cache (useful for memory management)
 */
export function clearRecolorCache() {
  recoloredCache.clear();
}
