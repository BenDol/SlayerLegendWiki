/**
 * Content image -> CDN URL mapping.
 *
 * Wiki markdown references game images as `/images/content/<path>`. The
 * running app rewrites those to the GitHub-hosted CDN (see the framework's
 * `imageResolver.js`); this module is the same mapping for the two places
 * that run without the app: the build-time prerenderer (crawler HTML) and
 * the `/images/content/*` Pages Function (any request that still reaches
 * the origin). Pure and dependency-free so all three agree byte for byte.
 *
 * Keep this file plain Node ESM (no JSX, no bundler-only imports such as
 * `?raw` or `import.meta.glob`): scripts/prerender.js imports it directly
 * as a postbuild step, outside Vite.
 */

/** URL prefix content pages use for game images. */
export const CONTENT_IMAGE_PREFIX = '/images/content/';

/** Supported `servingMode` values for the GitHub CDN provider. */
export const CDN_SERVING_MODES = Object.freeze(['jsdelivr', 'raw']);

/**
 * Percent-encode a relative image path segment by segment.
 *
 * Content occasionally references files whose names contain spaces
 * ("altar/DragonStat 1.png"); browsers encode those on the fly, crawlers do
 * not. Segments are decoded first so an already-encoded "%20" is never
 * double-encoded into "%2520".
 *
 * Dot segments are rejected (empty result): `encodeURIComponent('..')` is
 * still "..", so a request such as /images/content/%2e%2e/%2e%2e/x would
 * otherwise redirect to an arbitrary file in the CDN repository.
 *
 * @param {string} relativePath - e.g. "goods/Goods Emerald.png"
 * @returns {string} e.g. "goods/Goods%20Emerald.png"; "" for an empty or traversing path
 */
export function encodeImagePath(relativePath) {
  if (!relativePath) return '';
  const segments = String(relativePath)
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // Malformed escape - encode the raw segment as-is
      }
      return decoded;
    });
  if (segments.some((segment) => segment === '.' || segment === '..')) return '';
  return segments.map((segment) => encodeURIComponent(segment)).join('/');
}

/**
 * Resolve a content image path to its CDN URL.
 *
 * @param {string} imagePath - "/images/content/goods/x.png" or "goods/x.png"
 * @param {Object} gameAssets - `features.gameAssets` from wiki-config.json
 * @param {string} [servingMode] - "jsdelivr" | "raw"; defaults to the configured mode
 * @returns {string|null} Absolute CDN URL, or null when the CDN is not configured
 */
export function buildCdnImageUrl(imagePath, gameAssets, servingMode) {
  if (!imagePath) return null;
  if (!gameAssets?.enabled) return null;

  const cdn = gameAssets.cdn;
  if (!cdn || cdn.provider !== 'github' || !cdn.github) return null;

  const { owner, repo, basePath = 'game-assets', branch = 'main', servingMode: configuredMode = 'jsdelivr' } = cdn.github;
  if (!owner || !repo) return null;

  const mode = CDN_SERVING_MODES.includes(servingMode) ? servingMode : configuredMode;
  const relative = String(imagePath).replace(/^\/?images\/content\//, '').replace(/^\/+/, '');
  const encoded = encodeImagePath(relative);
  if (!encoded) return null;

  const base = String(basePath).replace(/^\/+|\/+$/g, '');
  if (mode === 'raw') {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${base}/images/${encoded}`;
  }
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${base}/images/${encoded}`;
}
