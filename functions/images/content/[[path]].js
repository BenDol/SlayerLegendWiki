/**
 * Cloudflare Pages Function: /images/content/*
 *
 * Content markdown references game images as `/images/content/<path>`. The
 * app rewrites those to the CDN client-side and the prerenderer rewrites
 * them at build time, so this route only sees the long tail: image search
 * crawlers, non-JS fetches, link previews, and old external links. Without
 * it those requests fell through to the SPA catch-all and received the
 * homepage HTML with a 200 - a broken image for every one of them.
 *
 * Redirects (rather than proxies) to the raw GitHub URL: no bandwidth
 * through the Function, and raw serves every file regardless of the CDN
 * repo's size (jsDelivr refuses uncached files from oversized packages).
 */

import config from '../../_shared/config-loader.js';
import { buildCdnImageUrl } from '../../_shared/utils/imageCdn.js';

/** raw.githubusercontent.com always serves; see cdnFallback.js in the app. */
export const IMAGE_SERVING_MODE = 'raw';

/** Let edges and browsers keep the redirect for a day; revalidation after that picks up a CDN move. */
export const CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400';

/**
 * 302, not 301: browsers keep a 301 past its Cache-Control, so a later change
 * to `features.gameAssets.cdn` (owner, repo, branch) would leave returning
 * visitors pinned to the old target with no way to invalidate. A cached 302
 * expires with the header above.
 */
export const REDIRECT_STATUS = 302;

/**
 * Build the redirect for a `[[path]]` catch-all param.
 * Exported for tests; `onRequest` is the Pages entry point.
 *
 * @param {string|string[]|undefined} pathParam - context.params.path
 * @param {Object} wikiConfig - wiki-config.json contents
 * @returns {Response}
 */
export function redirectToCdn(pathParam, wikiConfig = config) {
  const relative = Array.isArray(pathParam) ? pathParam.join('/') : String(pathParam || '');
  const target = buildCdnImageUrl(relative, wikiConfig?.features?.gameAssets, IMAGE_SERVING_MODE);

  if (!target) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  return new Response(null, {
    status: REDIRECT_STATUS,
    headers: {
      Location: target,
      'Cache-Control': CACHE_CONTROL,
    },
  });
}

/**
 * Pages Function entry point for GET/HEAD /images/content/<path>.
 * Any other method is answered 405 with an Allow header; a path that does
 * not map to the CDN (disabled CDN, empty or traversing path) is a 404.
 *
 * @param {{ request: Request, params: { path?: string[] } }} context
 * @returns {Promise<Response>}
 */
export async function onRequest(context) {
  const method = context.request?.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  return redirectToCdn(context.params?.path);
}
