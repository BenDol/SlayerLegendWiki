/**
 * Image Service - Lookup images from the image database
 * Matches spell/skill names to images with fallbacks
 */

// Cache for image database
let imageIndexCache = null;
let imageSearchCache = null;

/**
 * Load the image index database
 * @returns {Promise<Object>} Image index data
 */
async function loadImageIndex() {
  if (imageIndexCache) return imageIndexCache;

  try {
    const response = await fetch('/data/image-index.json');
    if (!response.ok) throw new Error('Failed to load image index');
    imageIndexCache = await response.json();
    return imageIndexCache;
  } catch (err) {
    console.error('Failed to load image index:', err);
    return null;
  }
}

/**
 * Load the image search index database
 * @returns {Promise<Object>} Image search index data
 */
async function loadImageSearchIndex() {
  if (imageSearchCache) return imageSearchCache;

  try {
    const response = await fetch('/data/image-search-index.json');
    if (!response.ok) throw new Error('Failed to load image search index');
    imageSearchCache = await response.json();
    return imageSearchCache;
  } catch (err) {
    console.error('Failed to load image search index:', err);
    return null;
  }
}

/**
 * Get element type icon path
 * @param {string} element - Element name (Fire, Water, Wind, Earth)
 * @returns {string} Path to element icon
 */
function getElementIcon(element) {
  const elementMap = {
    Fire: '/images/icons/typeicon_fire_1.png',
    Water: '/images/icons/typeicon_water_1.png',
    Wind: '/images/icons/typeicon_wind_1.png',
    Earth: '/images/icons/typeicon_earth s_1.png',
  };

  return elementMap[element] || '/images/skills/Icon_skillCard.png';
}

/**
 * Search for spell/skill image by name
 * @param {string} spellName - Name of the spell
 * @param {string} attribute - Element attribute (Fire, Water, Wind, Earth)
 * @returns {Promise<string>} Image path
 */
export async function getSpellImage(spellName, attribute) {
  // Try to load image search index
  const searchIndex = await loadImageSearchIndex();

  if (searchIndex && searchIndex.images) {
    // Search for images matching the spell name
    const searchTerm = spellName.toLowerCase().replace(/\s+/g, '');

    // Search through images
    for (const [id, image] of Object.entries(searchIndex.images)) {
      if (image.category === 'skills' && image.type === 'icon') {
        // Check if filename or keywords match
        const filename = image.filename.toLowerCase().replace(/[_\s]+/g, '');
        const keywords = image.keywords.map(k => k.toLowerCase().replace(/\s+/g, ''));

        if (filename.includes(searchTerm) || keywords.some(k => k.includes(searchTerm))) {
          return image.path;
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
  return '/images/skills/Icon_skillCard.png';
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
    '/images/icons/typeicon_fire_1.png',
    '/images/icons/typeicon_water_1.png',
    '/images/icons/typeicon_wind_1.png',
    '/images/icons/typeicon_earth s_1.png',
    '/images/skills/Icon_skillCard.png',
  ];
}
