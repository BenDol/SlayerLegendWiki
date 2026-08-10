/**
 * Automatic in-content ad injection for markdown wiki pages
 *
 * Runs as part of the registered content processor (see main.jsx), turning long
 * articles into pages with a small number of well-spaced ad slots without anyone
 * having to hand-place `{{AD:...}}` markers in the markdown.
 *
 * Placement philosophy: the reader gets real content first, ads are spaced by how
 * much they have actually read (word count, not line count), and short pages get
 * nothing but the trailing unit. Fewer, better-placed units beat more units - they
 * keep viewability and Core Web Vitals high, which is what actually drives RPM.
 */

import { areAdsRuntimeEnabled } from '../components/ads/AdsProvider';
import {
  AD_PLACEMENT,
  getAdSlotId,
  getPlacementRules,
  isAdAllowedPath,
} from '../config/adsConfig';
import { createLogger } from './logger';

const logger = createLogger('AdInjection');

/** Placements used for injected body ads, in order. Extras reuse the last entry. */
const BODY_AD_PLACEMENTS = [AD_PLACEMENT.CONTENT_TOP, AD_PLACEMENT.IN_ARTICLE];

const FENCE_PATTERN = /^\s{0,3}(```|~~~)/;
const H2_PATTERN = /^##\s+\S/;
const FRONTMATTER_DELIMITER = '---';

/** Lines that are structure rather than prose - they don't count toward "words read". */
const NON_PROSE_PATTERN = /^\s*(#{1,6}\s|\||>|!\[|<|\{\{)/;

/**
 * Build the marker a paragraph-level renderer will turn into an ad unit.
 * @param {string} placement - One of AD_PLACEMENT
 * @returns {string} Marker line
 */
const adMarker = placement => `{{AD:${placement}}}`;

/**
 * Rough word count for a line of markdown prose.
 * @param {string} line
 * @returns {number}
 */
function countWords(line) {
  const trimmed = line.trim();
  if (!trimmed || NON_PROSE_PATTERN.test(trimmed)) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Index of the first line after any YAML front matter block.
 * @param {string[]} lines
 * @returns {number}
 */
function findContentStart(lines) {
  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) return 0;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FRONTMATTER_DELIMITER) return i + 1;
  }
  return 0;
}

/**
 * Walk the document and pick line indices to insert body ads before.
 *
 * Preference order:
 * 1. Immediately before an `##` section heading (a natural reading break)
 * 2. On pages with no headings, at a blank line between paragraphs
 *
 * @param {string[]} lines - Markdown split into lines
 * @param {number} startIndex - First line after front matter
 * @param {object} rules - Merged placement rules
 * @returns {{insertions: number[], totalWords: number}}
 */
function findInsertionPoints(lines, startIndex, rules) {
  const insertions = [];
  let inFence = false;
  let totalWords = 0;
  let wordsSinceLastAd = 0;
  let lastParagraphBreak = -1;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const isHeading = H2_PATTERN.test(line);
    const isBlank = line.trim() === '';

    if (isBlank && !isHeading) lastParagraphBreak = i;

    const enoughRead = totalWords >= rules.minWordsBeforeFirstAd;
    const enoughSinceLastAd =
      insertions.length === 0 || wordsSinceLastAd >= rules.minWordsBetweenAds;
    const underCap = insertions.length < rules.maxInArticleAds;

    if (isHeading && underCap && enoughRead && enoughSinceLastAd) {
      insertions.push(i);
      wordsSinceLastAd = 0;
      continue;
    }

    const words = countWords(line);
    totalWords += words;
    wordsSinceLastAd += words;

    // Heading-less pages: fall back to a paragraph boundary once enough has been read
    const noHeadingFallback =
      !isHeading &&
      underCap &&
      enoughRead &&
      enoughSinceLastAd &&
      lastParagraphBreak > startIndex &&
      wordsSinceLastAd >= rules.minWordsBetweenAds;

    if (noHeadingFallback) {
      insertions.push(lastParagraphBreak);
      wordsSinceLastAd = 0;
    }
  }

  return { insertions, totalWords };
}

/**
 * Insert `{{AD:...}}` markers into markdown content.
 *
 * No-ops when ads are disabled, when the visitor is on an excluded route (editor
 * preview, thin pages), when the relevant ad slots are unconfigured, or when the
 * page is too short to carry ads.
 *
 * @param {string} content - Markdown content
 * @returns {string} Content with ad markers, or the input unchanged
 */
export function injectAdMarkers(content) {
  if (!content || typeof content !== 'string') return content;
  if (!areAdsRuntimeEnabled()) return content;

  // Hand-placed markers mean the author has taken manual control of ad
  // placement for this page (e.g. the custom home page) - never stack more.
  if (content.includes('{{AD:')) return content;

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  if (!isAdAllowedPath(pathname)) return content;

  const rules = getPlacementRules();
  const bodyPlacements = BODY_AD_PLACEMENTS.filter(placement => getAdSlotId(placement));
  const bottomSlotConfigured = Boolean(getAdSlotId(AD_PLACEMENT.CONTENT_BOTTOM));

  if (bodyPlacements.length === 0 && !bottomSlotConfigured) return content;

  const lines = content.split('\n');
  const startIndex = findContentStart(lines);
  const { insertions, totalWords } = bodyPlacements.length
    ? findInsertionPoints(lines, startIndex, rules)
    : { insertions: [], totalWords: content.split(/\s+/).length };

  if (totalWords < rules.minWords) {
    logger.debug('Page too short for ads', { pathname, totalWords, minWords: rules.minWords });
    return content;
  }

  // Splice from the end so earlier indices stay valid
  const output = [...lines];
  for (let i = insertions.length - 1; i >= 0; i--) {
    const placement = bodyPlacements[Math.min(i, bodyPlacements.length - 1)];
    output.splice(insertions[i], 0, '', adMarker(placement), '');
  }

  if (rules.contentBottomAd && bottomSlotConfigured) {
    output.push('', adMarker(AD_PLACEMENT.CONTENT_BOTTOM), '');
  }

  logger.debug('Injected ad markers', {
    pathname,
    totalWords,
    bodyAds: insertions.length,
    bottomAd: rules.contentBottomAd && bottomSlotConfigured,
  });

  return output.join('\n');
}

export default injectAdMarkers;
