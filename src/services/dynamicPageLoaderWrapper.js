/**
 * Dynamic Page Loader Wrapper
 *
 * Wraps the framework's dynamic page loader with crawler detection.
 * This ensures search engines always get static content for better SEO.
 *
 * All framework imports of '../services/github/dynamicPageLoader' are aliased
 * to this wrapper via vite.config.js resolve.alias.
 */

// Import everything from the framework module
import * as dynamicPageLoaderModule from '../../wiki-framework/src/services/github/dynamicPageLoader.js';
import { isCrawler, getCrawlerName } from '../utils/crawlerDetection.js';
import { createLogger } from '../../wiki-framework/src/utils/logger.js';

const logger = createLogger('DynamicPageLoaderWrapper');

// Re-export all functions unchanged
export const loadDynamicPage = dynamicPageLoaderModule.loadDynamicPage;
export const invalidatePageCache = dynamicPageLoaderModule.invalidatePageCache;
export const cleanupExpiredCache = dynamicPageLoaderModule.cleanupExpiredCache;
export const getCacheStats = dynamicPageLoaderModule.getCacheStats;

/**
 * Enhanced version of shouldUseDynamicLoading with crawler detection
 *
 * @param {Object} config - Wiki configuration
 * @returns {boolean} True if dynamic loading should be used
 */
export function shouldUseDynamicLoading(config) {
  // First check if dynamic loading is enabled in config
  const configEnabled = dynamicPageLoaderModule.shouldUseDynamicLoading(config);

  if (!configEnabled) {
    // Config says no - respect that
    return false;
  }

  // Config says yes - but check if user is a crawler
  if (isCrawler()) {
    const crawlerName = getCrawlerName();
    logger.info('Crawler detected - forcing static content for SEO', {
      crawlerName,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    });
    return false; // Force static loading for crawlers
  }

  // Regular user - use dynamic loading as configured
  return true;
}
