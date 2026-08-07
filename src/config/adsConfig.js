/**
 * Google AdSense configuration + helpers
 *
 * Everything ad-related is driven from `features.ads` in the ROOT wiki-config.json
 * (never public/wiki-config.json - that one is generated).
 *
 * Design notes:
 * - IN-PAGE units (top of content, in-article, bottom multiplex, tool pages) are placed
 *   manually by this project so we control exactly how many appear and where.
 * - OVERLAY units (anchor, side rail, vignette) are NOT hand-rolled. They are served by
 *   Google's Auto ads and toggled in the AdSense dashboard - the loader script below is
 *   all the code they need. See .claude/google-ads-setup.md.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('AdsConfig');

/** AdSense loader script. Serves both Auto ads and manual units. */
export const ADSENSE_SCRIPT_BASE_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
export const ADSENSE_SCRIPT_ID = 'adsbygoogle-js';

/** Placement keys - map 1:1 to `features.ads.adsense.slots` in wiki-config.json. */
export const AD_PLACEMENT = {
  CONTENT_TOP: 'contentTop',
  IN_ARTICLE: 'inArticle',
  CONTENT_BOTTOM: 'contentBottom',
  TOOL_TOP: 'toolTop',
};

/** AdSense ad unit formats we support. */
export const AD_FORMAT = {
  DISPLAY: 'display', // Responsive display unit
  IN_ARTICLE: 'in-article', // Native fluid unit that blends into prose
  MULTIPLEX: 'multiplex', // Native grid of ads (AdSense "autorelaxed")
};

/** Which format each placement renders as. */
export const AD_PLACEMENT_FORMAT = {
  [AD_PLACEMENT.CONTENT_TOP]: AD_FORMAT.DISPLAY,
  [AD_PLACEMENT.IN_ARTICLE]: AD_FORMAT.IN_ARTICLE,
  [AD_PLACEMENT.CONTENT_BOTTOM]: AD_FORMAT.MULTIPLEX,
  [AD_PLACEMENT.TOOL_TOP]: AD_FORMAT.DISPLAY,
};

/** Reserved height per format, in px. Prevents layout shift (CLS) while the ad loads. */
export const AD_RESERVED_HEIGHT = {
  [AD_FORMAT.DISPLAY]: 120,
  [AD_FORMAT.IN_ARTICLE]: 140,
  [AD_FORMAT.MULTIPLEX]: 320,
};

/** Start loading an ad unit this far before it scrolls into view. */
export const AD_LAZY_LOAD_MARGIN = '400px';

/** Defaults for automatic in-content ad injection - overridable via `features.ads.placement`. */
export const DEFAULT_PLACEMENT_RULES = {
  /** Pages shorter than this get no in-content ads at all (thin-content policy + UX). */
  minWords: 250,
  /** Never place the first in-article ad before this much content has been read. */
  minWordsBeforeFirstAd: 120,
  /** Minimum content between two in-article ads. */
  minWordsBetweenAds: 350,
  /** Hard cap on in-article units injected into a markdown page. */
  maxInArticleAds: 2,
  /** Append the native multiplex grid at the end of long articles. */
  contentBottomAd: true,
};

/**
 * Routes that must never show ads.
 * Editors/history (would corrupt the preview), thin pages, and payment flows.
 */
export const AD_EXCLUDED_PATH_PATTERNS = [
  /\/edit\/?$/,
  /\/new\/?$/,
  /\/history\/?$/,
  /^\/search/,
  /^\/donate/,
  /^\/donation-success/,
  /^\/profile/,
  /^\/admin/,
  /^\/dev-tools/,
  /^\/debug/,
  /^\/404/,
  /^\/maintenance/,
];

/** Default label shown above each unit (AdSense requires ads be identifiable as ads). */
export const DEFAULT_AD_LABEL = 'Advertisement';

/**
 * Read the ads block from config, falling back to the global config snapshot so
 * non-React code (the markdown content processor) can use it too.
 *
 * @param {object} [config] - Wiki config object, if the caller already has one
 * @returns {object|null} The `features.ads` block, or null
 */
export function getAdsConfig(config = null) {
  const source = config || (typeof window !== 'undefined' ? window.__WIKI_CONFIG__ : null);
  return source?.features?.ads || null;
}

/**
 * AdSense publisher ID, e.g. "ca-pub-1234567890123456".
 *
 * @param {object} [config]
 * @returns {string} Client ID, or empty string when unconfigured
 */
export function getAdClientId(config = null) {
  return getAdsConfig(config)?.adsense?.client?.trim() || '';
}

/**
 * Ad unit ID for a placement, e.g. "1234567890".
 *
 * @param {string} placement - One of AD_PLACEMENT
 * @param {object} [config]
 * @returns {string} Slot ID, or empty string when unconfigured
 */
export function getAdSlotId(placement, config = null) {
  return getAdsConfig(config)?.adsense?.slots?.[placement]?.trim() || '';
}

/**
 * Merged in-content injection rules (defaults + config overrides).
 *
 * @param {object} [config]
 * @returns {object} Placement rules
 */
export function getPlacementRules(config = null) {
  return { ...DEFAULT_PLACEMENT_RULES, ...(getAdsConfig(config)?.placement || {}) };
}

/**
 * Whether ads may render on a given route.
 *
 * @param {string} pathname - window.location.pathname
 * @returns {boolean}
 */
export function isAdAllowedPath(pathname) {
  if (!pathname) return false;
  return !AD_EXCLUDED_PATH_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * Baseline check: ads turned on, publisher ID present, and (unless explicitly overridden)
 * not running in local dev. Audience-level gating (donators, crawlers) lives in AdsProvider.
 *
 * @param {object} [config]
 * @returns {boolean}
 */
export function isAdsConfigured(config = null) {
  const ads = getAdsConfig(config);

  if (!ads?.enabled) return false;

  if (!getAdClientId(config)) {
    logger.warn('Ads enabled but features.ads.adsense.client is empty - ads disabled');
    return false;
  }

  if (import.meta.env.DEV && !ads.showInDevelopment) return false;

  return true;
}
