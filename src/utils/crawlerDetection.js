/**
 * Crawler Detection Utility
 *
 * Detects search engine crawlers and bots for SEO optimization.
 * Used to serve static content to crawlers while keeping dynamic loading for users.
 *
 * Google's official recommendation for JavaScript-heavy sites:
 * https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering
 */

import { createLogger } from '../../wiki-framework/src/utils/logger';

const logger = createLogger('CrawlerDetection');

/**
 * List of crawler User-Agent patterns
 * Based on common search engine and social media crawlers
 */
const CRAWLER_PATTERNS = [
  // Google
  'Googlebot',
  'Googlebot-Image',
  'Googlebot-News',
  'Googlebot-Video',
  'Google-InspectionTool',
  'AdsBot-Google',
  'Mediapartners-Google',
  'APIs-Google',
  'Storebot-Google',

  // Bing
  'bingbot',
  'msnbot',
  'BingPreview',
  'adidxbot',

  // Yahoo
  'Slurp',
  'Yahoo! Slurp',

  // Other search engines
  'DuckDuckBot',
  'Baiduspider',
  'YandexBot',
  'Sogou',
  'Exabot',

  // Social media crawlers
  'facebookexternalhit',
  'Twitterbot',
  'LinkedInBot',
  'Discordbot',
  'TelegramBot',
  'WhatsApp',
  'Slackbot',

  // Other bots
  'ia_archiver', // Internet Archive
  'archive.org_bot',
  'crawler',
  'spider',
  'bot',

  // Rendering services
  'Lighthouse',
  'PageSpeed',
  'Chrome-Lighthouse',
  'PTST',
];

/**
 * User-Agent patterns that are NOT crawlers (false positives)
 * These contain 'bot' but are regular browsers or legitimate services
 */
const NOT_CRAWLER_PATTERNS = [
  'robot.txt', // Common false positive
  'Chrome', // Chrome contains 'bot' in some versions
  'Safari',
  'Firefox',
  'Edge',
];

/**
 * Detect if the current user agent is a crawler
 *
 * @param {string} userAgent - User agent string (defaults to navigator.userAgent)
 * @returns {boolean} True if crawler detected
 */
export function isCrawler(userAgent = null) {
  // Use provided userAgent or get from browser
  const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');

  if (!ua) {
    return false;
  }

  // Check if it's explicitly NOT a crawler
  for (const pattern of NOT_CRAWLER_PATTERNS) {
    if (ua.includes(pattern)) {
      logger.trace('User agent identified as NOT a crawler', { ua, pattern });
      return false;
    }
  }

  // Check if it matches any crawler pattern (case-insensitive)
  const lowerUA = ua.toLowerCase();
  for (const pattern of CRAWLER_PATTERNS) {
    if (lowerUA.includes(pattern.toLowerCase())) {
      logger.info('Crawler detected', { ua, pattern });
      return true;
    }
  }

  return false;
}

/**
 * Get crawler name from user agent
 *
 * @param {string} userAgent - User agent string (defaults to navigator.userAgent)
 * @returns {string|null} Crawler name or null if not a crawler
 */
export function getCrawlerName(userAgent = null) {
  const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');

  if (!ua || !isCrawler(ua)) {
    return null;
  }

  const lowerUA = ua.toLowerCase();

  // Check for specific crawlers
  if (lowerUA.includes('googlebot')) return 'Googlebot';
  if (lowerUA.includes('bingbot')) return 'Bingbot';
  if (lowerUA.includes('slurp')) return 'Yahoo';
  if (lowerUA.includes('duckduckbot')) return 'DuckDuckGo';
  if (lowerUA.includes('baiduspider')) return 'Baidu';
  if (lowerUA.includes('yandexbot')) return 'Yandex';
  if (lowerUA.includes('facebookexternalhit')) return 'Facebook';
  if (lowerUA.includes('twitterbot')) return 'Twitter';
  if (lowerUA.includes('linkedinbot')) return 'LinkedIn';
  if (lowerUA.includes('discordbot')) return 'Discord';

  return 'Unknown Crawler';
}

/**
 * Check if we should use dynamic page loading based on crawler detection
 *
 * This overrides the config setting for crawlers to ensure they get static content.
 *
 * @param {Object} config - Wiki configuration
 * @returns {boolean} True if dynamic loading should be used
 */
export function shouldUseDynamicLoadingWithCrawlerDetection(config) {
  // If dynamic loading is disabled in config, respect that
  if (config?.features?.dynamicPageLoading?.enabled !== true) {
    return false;
  }

  // If crawler detected, force static loading for better SEO
  if (isCrawler()) {
    const crawlerName = getCrawlerName();
    logger.info('Crawler detected - serving static content', { crawlerName });
    return false;
  }

  // Regular user - use dynamic loading
  return true;
}

/**
 * Log crawler detection status (for debugging)
 */
export function logCrawlerStatus() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A';
  const detected = isCrawler();
  const name = getCrawlerName();

  logger.debug('Crawler detection status', {
    userAgent: ua,
    isCrawler: detected,
    crawlerName: name,
    willUseDynamicLoading: !detected
  });
}
