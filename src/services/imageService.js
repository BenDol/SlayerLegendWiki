/**
 * Image Service - Lookup images from the image database
 * Matches skill names to images with fallbacks
 */

import { createLogger } from '../utils/logger';
import { setImageSrcWithCdnFallback } from '../utils/cdnFallback';

const logger = createLogger('ImageService');

const CACHE_TTL = 3600000; // 1 hour in milliseconds

// Cache for wiki config
let wikiConfig = null;
let wikiConfigPromise = null;

/**
 * Load and cache wiki-config.json
 * @returns {Promise<Object>} Wiki configuration
 */
async function loadWikiConfig() {
  if (wikiConfig) return wikiConfig;

  // If already loading, return the existing promise to avoid race conditions
  if (wikiConfigPromise) return wikiConfigPromise;

  // Start loading and cache the promise
  wikiConfigPromise = (async () => {
    try {
      const response = await fetch('/wiki-config.json');
      if (!response.ok) throw new Error(`Failed to load wiki-config: ${response.status}`);
      wikiConfig = await response.json();
      return wikiConfig;
    } catch (err) {
      logger.error('Failed to load wiki-config', { error: err });
      wikiConfigPromise = null; // Clear promise on error so it can retry
      return null;
    }
  })();

  return wikiConfigPromise;
}

/**
 * Construct CDN base URLs from wiki-config, primary first.
 * The servingMode host is primary; the other GitHub host is the fallback
 * (jsDelivr refuses files when the repo exceeds its 50 MB package limit,
 * raw.githubusercontent.com can be rate limited - each covers the other).
 * @returns {Promise<Array<string>>} CDN base URLs in priority order (may be empty)
 */
async function getCdnBaseUrls() {
  const config = await loadWikiConfig();

  if (!config?.features?.gameAssets?.enabled || !config.features.gameAssets.cdn) {
    logger.warn('Game assets CDN not enabled in wiki-config');
    return [];
  }

  const cdn = config.features.gameAssets.cdn;

  if (cdn.provider === 'github') {
    const { owner, repo, basePath, servingMode, branch } = cdn.github;
    const jsdelivrBase = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${basePath}`;
    const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${basePath}`;

    return servingMode === 'jsdelivr'
      ? [jsdelivrBase, rawBase]
      : [rawBase, jsdelivrBase];
  }

  logger.warn('Unknown CDN provider', { provider: cdn.provider });
  return [];
}

// Cache for image database
let imageIndexCache = null;

/**
 * Load JSON with CDN fallback and localStorage caching
 * @param {Array<string>} cdnUrls - CDN URLs to try in order (empty to skip CDN)
 * @param {string} fallbackUrl - Fallback static URL (may not exist in production, gracefully fails)
 * @param {string} cacheKey - localStorage cache key
 * @returns {Promise<Object|null>} JSON data or null if all sources fail
 */
async function loadJSONWithCache(cdnUrls, fallbackUrl, cacheKey) {
  // Check localStorage cache
  const cached = localStorage.getItem(cacheKey);
  const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);

  if (cached && cacheTimestamp) {
    const age = Date.now() - parseInt(cacheTimestamp, 10);
    if (age < CACHE_TTL) {
      logger.debug(`Using cached ${cacheKey}`, { age: Math.floor(age / 1000) + 's' });
      return JSON.parse(cached);
    }
  }

  // Try each CDN in priority order (if configured)
  if (cdnUrls.length === 0) {
    logger.debug(`CDN not configured, using static fallback for ${cacheKey}`);
  }
  for (const cdnUrl of cdnUrls) {
    try {
      logger.debug(`Fetching ${cacheKey} from CDN`, { url: cdnUrl });
      const response = await fetch(cdnUrl);
      if (response.ok) {
        const data = await response.json();
        // Cache in localStorage
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
        logger.debug(`Loaded ${cacheKey} from CDN`, { totalImages: data.totalImages });
        return data;
      }
      logger.warn(`CDN fetch failed for ${cacheKey}, trying next source`, { url: cdnUrl, status: response.status });
    } catch (err) {
      logger.warn(`CDN error for ${cacheKey}, trying next source`, { url: cdnUrl, error: err.message });
    }
  }

  // Fallback to static file
  try {
    logger.debug(`Fetching ${cacheKey} from static`, { url: fallbackUrl });
    const response = await fetch(fallbackUrl);
    if (!response.ok) throw new Error(`Failed to load from static: ${response.status}`);
    const data = await response.json();
    // Cache in localStorage
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
    logger.debug(`Loaded ${cacheKey} from static fallback`, { totalImages: data.totalImages });
    return data;
  } catch (err) {
    logger.error(`Failed to load ${cacheKey} from both CDN and static`, { error: err });
    return null;
  }
}

/**
 * Load the image index database
 * @returns {Promise<Object>} Image index data
 */
async function loadImageIndex() {
  if (imageIndexCache) return imageIndexCache;

  const cdnBaseUrls = await getCdnBaseUrls();
  // Image index is located at game-assets/images/image-index.json
  const cdnUrls = cdnBaseUrls.map(base => `${base}/images/image-index.json`);

  imageIndexCache = await loadJSONWithCache(
    cdnUrls,
    '/data/image-index.json',
    'image-index'
  );

  return imageIndexCache;
}

/**
 * Get element type icon path (relative path without /images/content/ prefix)
 * @param {string} element - Element name (Fire, Water, Wind, Earth)
 * @returns {string} Relative path to element icon
 */
export function getElementIcon(element) {
  const elementMap = {
    Fire: 'icons/typeicon_fire_1.png',
    Water: 'icons/typeicon_water_1.png',
    Wind: 'icons/typeicon_wind_1.png',
    Earth: 'icons/typeicon_earth s_1.png',
  };

  return elementMap[element] || 'skills/Icon_skillCard.png';
}

/**
 * Search for skill image by name
 * @param {string} skillName - Name of the skill
 * @param {string} attribute - Element attribute (Fire, Water, Wind, Earth)
 * @returns {Promise<string>} Image path
 */
export async function getSkillImage(skillName, attribute) {
  // Try to load image index
  const imageIndex = await loadImageIndex();

  if (imageIndex && imageIndex.images) {
    // Search for images matching the skill name
    const searchTerm = skillName.toLowerCase().replace(/\s+/g, '');
    const basePath = imageIndex.path || '';  // e.g., "/images"

    // Search through images
    for (const image of imageIndex.images) {
      if (image.category === 'skills' && image.type === 'icon') {
        // Check if filename or keywords match
        const filename = image.filename.toLowerCase().replace(/[_\s]+/g, '');
        const keywords = image.keywords.map(k => k.toLowerCase().replace(/\s+/g, ''));

        if (filename.includes(searchTerm) || keywords.some(k => k.includes(searchTerm))) {
          // Convert CDN path to relative path (without /images/content/ prefix)
          // CDN: basePath + image.path (e.g., "/images" + "/icons/fire.png" = "/images/icons/fire.png")
          // Return relative path: icons/fire.png
          const cdnPath = basePath + image.path;
          const relativePath = cdnPath.replace(/^\/images\//, '');
          return relativePath;
        }
      }
    }
  }

  // Fallback to element icon
  return getElementIcon(attribute);
}

/**
 * Get skill card icon (generic) - relative path without /images/content/ prefix
 * @returns {string} Relative path to generic skill card icon
 */
export function getGenericSkillIcon() {
  return 'skills/Icon_skillCard.png';
}

/**
 * Preload images to cache them
 * @param {Array<string>} imagePaths - Array of image paths to preload
 */
export function preloadImages(imagePaths) {
  imagePaths.forEach(path => {
    const img = new Image();
    setImageSrcWithCdnFallback(img, path);
  });
}

/**
 * Get all element icons for preloading (relative paths without /images/content/ prefix)
 * @returns {Array<string>} Array of element icon relative paths
 */
export function getAllElementIcons() {
  return [
    'icons/typeicon_fire_1.png',
    'icons/typeicon_water_1.png',
    'icons/typeicon_wind_1.png',
    'icons/typeicon_earth s_1.png',
    'skills/Icon_skillCard.png',
  ];
}

// NOTE: resolveImageUrl() and resolveImageUrls() have been removed.
// Use resolveImagePath() from src/utils/imageResolver.js instead.
// The new resolver is synchronous and uses preloaded config for better performance.
