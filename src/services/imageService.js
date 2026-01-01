/**
 * Image Service - Lookup images from the image database
 * Matches skill names to images with fallbacks
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('ImageService');

const CACHE_TTL = 3600000; // 1 hour in milliseconds

// Cache for wiki config
let wikiConfig = null;

/**
 * Load and cache wiki-config.json
 * @returns {Promise<Object>} Wiki configuration
 */
async function loadWikiConfig() {
  if (wikiConfig) return wikiConfig;

  try {
    const response = await fetch('/wiki-config.json');
    if (!response.ok) throw new Error(`Failed to load wiki-config: ${response.status}`);
    wikiConfig = await response.json();
    return wikiConfig;
  } catch (err) {
    logger.error('Failed to load wiki-config', { error: err });
    return null;
  }
}

/**
 * Construct CDN URL from wiki-config
 * @returns {Promise<string|null>} CDN base URL or null if not configured
 */
async function getCdnBaseUrl() {
  const config = await loadWikiConfig();

  if (!config?.features?.gameAssets?.enabled || !config.features.gameAssets.cdn) {
    logger.warn('Game assets CDN not enabled in wiki-config');
    return null;
  }

  const cdn = config.features.gameAssets.cdn;

  if (cdn.provider === 'github') {
    const { owner, repo, basePath, servingMode, branch } = cdn.github;

    if (servingMode === 'jsdelivr') {
      return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${basePath}`;
    } else {
      // Raw GitHub serving mode
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${basePath}`;
    }
  }

  logger.warn('Unknown CDN provider', { provider: cdn.provider });
  return null;
}

// Cache for image database
let imageIndexCache = null;

/**
 * Load JSON with CDN fallback and localStorage caching
 * @param {string|null} cdnUrl - CDN URL (null to skip CDN)
 * @param {string} fallbackUrl - Fallback static URL (may not exist in production, gracefully fails)
 * @param {string} cacheKey - localStorage cache key
 * @returns {Promise<Object|null>} JSON data or null if all sources fail
 */
async function loadJSONWithCache(cdnUrl, fallbackUrl, cacheKey) {
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

  // Try CDN first (if configured)
  if (cdnUrl) {
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
      logger.warn(`CDN fetch failed for ${cacheKey}`, { status: response.status });
    } catch (err) {
      logger.warn(`CDN error for ${cacheKey}, falling back to static`, { error: err.message });
    }
  } else {
    logger.debug(`CDN not configured, using static fallback for ${cacheKey}`);
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

  const cdnBaseUrl = await getCdnBaseUrl();
  const cdnUrl = cdnBaseUrl ? `${cdnBaseUrl}/image-index.json` : null;

  imageIndexCache = await loadJSONWithCache(
    cdnUrl,
    '/data/image-index.json',
    'image-index'
  );

  return imageIndexCache;
}

/**
 * Get element type icon path
 * @param {string} element - Element name (Fire, Water, Wind, Earth)
 * @returns {string} Path to element icon
 */
export function getElementIcon(element) {
  const elementMap = {
    Fire: '/images/content/icons/typeicon_fire_1.png',
    Water: '/images/content/icons/typeicon_water_1.png',
    Wind: '/images/content/icons/typeicon_wind_1.png',
    Earth: '/images/content/icons/typeicon_earth s_1.png',
  };

  return elementMap[element] || '/images/content/skills/Icon_skillCard.png';
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
          // Convert CDN path to wiki path
          // CDN: basePath + image.path (e.g., "/images" + "/icons/fire.png" = "/images/icons/fire.png")
          // Wiki: /images/content/icons/fire.png (strip /images/, prepend /images/content/)
          const cdnPath = basePath + image.path;
          const relativePath = cdnPath.replace(/^\/images\//, '/');
          return `/images/content${relativePath}`;
        }
      }
    }
  }

  // Fallback to element icon
  return getElementIcon(attribute);
}

/**
 * Get skill card icon (generic)
 * @returns {string} Path to generic skill card icon
 */
export function getGenericSkillIcon() {
  return '/images/content/skills/Icon_skillCard.png';
}

/**
 * Preload images to cache them
 * @param {Array<string>} imagePaths - Array of image paths to preload
 */
export function preloadImages(imagePaths) {
  imagePaths.forEach(path => {
    const img = new Image();
    img.src = path;
  });
}

/**
 * Get all element icons for preloading
 * @returns {Array<string>} Array of element icon paths
 */
export function getAllElementIcons() {
  return [
    '/images/content/icons/typeicon_fire_1.png',
    '/images/content/icons/typeicon_water_1.png',
    '/images/content/icons/typeicon_wind_1.png',
    '/images/content/icons/typeicon_earth s_1.png',
    '/images/content/skills/Icon_skillCard.png',
  ];
}

/**
 * Convert /images/content/* path to full CDN URL
 * @param {string} imagePath - Relative path starting with /images/content/
 * @returns {Promise<string>} Full CDN URL or original path if CDN not configured
 */
export async function resolveImageUrl(imagePath) {
  // Only process /images/content/* paths
  if (!imagePath || !imagePath.startsWith('/images/content/')) {
    return imagePath;
  }

  // Get CDN base URL from config
  const cdnBaseUrl = await getCdnBaseUrl();

  if (!cdnBaseUrl) {
    // CDN not configured, return original path (for local dev fallback)
    logger.debug('CDN not configured, using original path', { imagePath });
    return imagePath;
  }

  // Extract path after /images/content/ (e.g., /images/content/icons/fire.png → icons/fire.png)
  const relativePath = imagePath.replace('/images/content/', '');

  // Construct full CDN URL with /images/ prefix
  // CDN structure: <base>/game-assets/images/icons/fire.png
  const cdnUrl = `${cdnBaseUrl}/images/${relativePath}`;

  logger.debug('Resolved image URL', { imagePath, cdnUrl });

  return cdnUrl;
}

/**
 * Resolve multiple image URLs at once
 * @param {Array<string>} imagePaths - Array of image paths
 * @returns {Promise<Array<string>>} Array of resolved CDN URLs
 */
export async function resolveImageUrls(imagePaths) {
  return Promise.all(imagePaths.map(path => resolveImageUrl(path)));
}
