/**
 * CDN Fallback - jsDelivr → raw.githubusercontent.com
 *
 * jsDelivr is the primary CDN for game assets (aggressive edge caching, no
 * rate limits), but the SlayerLegendCDN repo exceeds jsDelivr's 50 MB package
 * limit, so files not already in jsDelivr's cache are refused (403 "Package
 * size exceeded"). This module retries those failures against
 * raw.githubusercontent.com, which has no package size limit.
 *
 * Two mechanisms:
 * 1. installCdnImageFallback() - a global capture-phase error listener that
 *    rewrites failed jsDelivr <img> loads in the DOM. It stops propagation on
 *    the first failure so component-level onError fallbacks (placeholders,
 *    hide-on-error) only engage if the raw retry also fails.
 * 2. setImageSrcWithCdnFallback() - for images created with `new Image()`,
 *    whose error events never reach the document.
 */

import { createLogger } from './logger';

const logger = createLogger('CdnFallback');

const JSDELIVR_GH_PATTERN = /^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/@]+)\/([^/@]+)@([^/]+)\/(.+)$/;

let installed = false;

/**
 * Convert a jsDelivr GitHub CDN URL to its raw.githubusercontent.com equivalent
 * @param {string} url - URL to convert
 * @returns {string|null} Raw URL, or null if not a jsDelivr GitHub URL
 */
export function jsdelivrToRaw(url) {
  const match = JSDELIVR_GH_PATTERN.exec(url || '');
  if (!match) return null;

  const [, owner, repo, branch, path] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

/**
 * Assign img.src with automatic raw fallback on jsDelivr failure.
 * Call AFTER the caller has set its own onload/onerror handlers - the caller's
 * onerror only fires if the raw retry fails too (or the URL isn't jsDelivr).
 * @param {HTMLImageElement} img - Image element (DOM or `new Image()`)
 * @param {string} url - URL to load
 */
export function setImageSrcWithCdnFallback(img, url) {
  const rawUrl = jsdelivrToRaw(url);

  if (rawUrl) {
    const originalOnError = img.onerror;
    img.onerror = () => {
      // Restore the caller's handler so a raw failure reaches it
      img.onerror = originalOnError;
      logger.debug('jsDelivr image failed, retrying via raw', { url });
      img.src = rawUrl;
    };
  }

  img.src = url;
}

/**
 * Install a global fallback for <img> elements in the DOM.
 * Idempotent - safe to call more than once.
 */
export function installCdnImageFallback() {
  if (typeof document === 'undefined' || installed) return;
  installed = true;

  document.addEventListener('error', (event) => {
    const el = event.target;
    if (!el || el.tagName !== 'IMG') return;

    const rawUrl = jsdelivrToRaw(el.currentSrc || el.src);
    if (!rawUrl) return;

    // Keep component-level onError fallbacks from firing on this first
    // failure; a raw failure won't match jsdelivrToRaw and passes through.
    event.stopPropagation();
    logger.debug('jsDelivr image failed, retrying via raw', { src: el.src });
    el.src = rawUrl;
  }, true);

  logger.info('CDN image fallback installed (jsDelivr → raw.githubusercontent.com)');
}
