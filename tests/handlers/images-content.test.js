/**
 * /images/content/* Pages Function - redirects content image paths to the CDN.
 *
 * Before this function existed the route fell through to the SPA catch-all
 * and every content image URL returned the homepage HTML with a 200.
 */

import { describe, it, expect } from 'vitest';
import { onRequest, redirectToCdn, IMAGE_SERVING_MODE, CACHE_CONTROL, REDIRECT_STATUS } from '../../functions/images/content/[[path]].js';

const wikiConfig = {
  features: {
    gameAssets: {
      enabled: true,
      cdn: { provider: 'github', github: { owner: 'BenDol', repo: 'SlayerLegendCDN', basePath: 'game-assets', branch: 'main' } },
    },
  },
};

const request = (method = 'GET') => ({ request: { method }, params: { path: ['goods', 'Goods_Emerald.png'] } });

describe('redirectToCdn', () => {
  it('302s a catch-all path array to the raw GitHub URL with a day of caching', () => {
    const response = redirectToCdn(['companions', 'zeke', 'warrior_01.png'], wikiConfig);
    expect(response.status).toBe(REDIRECT_STATUS);
    expect(response.headers.get('Location')).toBe(
      'https://raw.githubusercontent.com/BenDol/SlayerLegendCDN/main/game-assets/images/companions/zeke/warrior_01.png'
    );
    expect(response.headers.get('Cache-Control')).toBe(CACHE_CONTROL);
    expect(IMAGE_SERVING_MODE).toBe('raw');
  });

  it('accepts a single string segment', () => {
    const response = redirectToCdn('logo.png', wikiConfig);
    expect(response.headers.get('Location')).toMatch(/\/images\/logo\.png$/);
  });

  it('encodes spaces in file names', () => {
    const response = redirectToCdn(['altar', 'DragonStat 1.png'], wikiConfig);
    expect(response.headers.get('Location')).toMatch(/altar\/DragonStat%201\.png$/);
  });

  it('redirects temporarily (302), so a later CDN move is not pinned in browser caches forever', () => {
    expect(REDIRECT_STATUS).toBe(302);
    expect(redirectToCdn(['a.png'], wikiConfig).status).toBe(302);
  });

  it('404s a path that tries to leave the images directory', () => {
    // encodeURIComponent('..') is '..', so without the check this would
    // redirect to any file in the CDN repository.
    for (const attempt of [['..', '..', 'README.md'], ['%2e%2e', 'x.png'], ['.', 'a.png'], ['goods', '..', '..', 'secrets']]) {
      const response = redirectToCdn(attempt, wikiConfig);
      expect(response.status, attempt.join('/')).toBe(404);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('404s an empty path or an unconfigured CDN without caching the answer', () => {
    expect(redirectToCdn([], wikiConfig).status).toBe(404);
    expect(redirectToCdn(undefined, wikiConfig).status).toBe(404);
    const disabled = redirectToCdn(['a.png'], { features: { gameAssets: { enabled: false } } });
    expect(disabled.status).toBe(404);
    expect(disabled.headers.get('Cache-Control')).toBe('no-store');
  });

  it('uses the bundled wiki config by default', () => {
    const response = redirectToCdn(['goods', 'Goods_Emerald.png']);
    expect(response.status).toBe(REDIRECT_STATUS);
    expect(response.headers.get('Location')).toMatch(/^https:\/\/raw\.githubusercontent\.com\/.+\/game-assets\/images\/goods\/Goods_Emerald\.png$/);
  });
});

describe('onRequest', () => {
  it('handles GET and HEAD', async () => {
    expect((await onRequest(request('GET'))).status).toBe(REDIRECT_STATUS);
    expect((await onRequest(request('HEAD'))).status).toBe(REDIRECT_STATUS);
  });

  it('rejects other methods', async () => {
    const response = await onRequest(request('POST'));
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('treats a missing request object as GET', async () => {
    expect((await onRequest({ params: { path: ['a.png'] } })).status).toBe(REDIRECT_STATUS);
  });
});
