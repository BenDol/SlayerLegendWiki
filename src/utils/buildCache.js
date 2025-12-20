/**
 * Local cache for skill builds and battle loadouts
 * Handles GitHub API caching delays by storing recent saves locally
 */

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Cache structure:
 * {
 *   'cache:userId:skill_builds': {
 *     timestamp: number,
 *     builds: array
 *   },
 *   'cache:userId:battle_loadouts': {
 *     timestamp: number,
 *     loadouts: array
 *   },
 *   'cache:userId:spirit_builds': {
 *     timestamp: number,
 *     builds: array
 *   },
 *   'cache:userId:my_spirits': {
 *     timestamp: number,
 *     spirits: array
 *   }
 * }
 */

/**
 * Get cache key for user builds/loadouts
 */
const getCacheKey = (type, userId) => {
  // Ensure type uses underscores (handles legacy kebab-case if any exists)
  const cacheName = type.replace(/-/g, '_');
  return `cache:${userId}:${cacheName}`;
};

/**
 * Check if cache entry is still valid
 */
const isCacheValid = (timestamp) => {
  return Date.now() - timestamp < CACHE_DURATION;
};

/**
 * Get cached builds/loadouts for user
 */
export const getCache = (type, userId) => {
  try {
    const key = getCacheKey(type, userId);
    const cached = localStorage.getItem(key);

    if (!cached) return null;

    const data = JSON.parse(cached);

    // Check if cache is expired
    if (!isCacheValid(data.timestamp)) {
      localStorage.removeItem(key);
      return null;
    }

    return data.items;
  } catch (error) {
    console.error('[buildCache] Failed to get cache:', error);
    return null;
  }
};

/**
 * Set cached builds/loadouts for user
 */
export const setCache = (type, userId, items) => {
  try {
    const key = getCacheKey(type, userId);
    const data = {
      timestamp: Date.now(),
      items: items
    };

    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('[buildCache] Failed to set cache:', error);
  }
};

/**
 * Clear cache for user
 */
export const clearCache = (type, userId) => {
  try {
    const key = getCacheKey(type, userId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[buildCache] Failed to clear cache:', error);
  }
};

/**
 * Clear all caches
 */
export const clearAllCaches = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes(':skill_builds') ||
          key.includes(':battle_loadouts') ||
          key.includes(':spirit_builds') ||
          key.includes(':my_spirits')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('[buildCache] Failed to clear all caches:', error);
  }
};

/**
 * Merge cached data with GitHub data, prioritizing cache for recent updates
 */
export const mergeCacheWithGitHub = (cachedItems, githubItems) => {
  if (!cachedItems || cachedItems.length === 0) {
    return githubItems;
  }

  if (!githubItems || githubItems.length === 0) {
    return cachedItems;
  }

  // Create a map of GitHub items by ID
  const githubMap = new Map(githubItems.map(item => [item.id, item]));

  // Create a map of cached items by ID
  const cachedMap = new Map(cachedItems.map(item => [item.id, item]));

  // Start with GitHub items
  const merged = [...githubItems];

  // Replace with cached versions if they're newer
  cachedItems.forEach(cachedItem => {
    const githubItem = githubMap.get(cachedItem.id);

    if (githubItem) {
      // Compare timestamps, use cached if it's newer
      const cachedTime = new Date(cachedItem.updatedAt).getTime();
      const githubTime = new Date(githubItem.updatedAt).getTime();

      if (cachedTime > githubTime) {
        // Replace GitHub version with cached version
        const index = merged.findIndex(item => item.id === cachedItem.id);
        if (index !== -1) {
          merged[index] = cachedItem;
        }
      }
    } else {
      // Item is in cache but not in GitHub (recently created)
      merged.push(cachedItem);
    }
  });

  // Sort by updatedAt descending
  return merged.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};
