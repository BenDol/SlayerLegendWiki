/**
 * Sitemap static routes - only screens with publisher content are advertised.
 */

import { describe, it, expect } from 'vitest';
import { STATIC_ROUTES } from '../scripts/generate-sitemap.js';

describe('sitemap STATIC_ROUTES', () => {
  const urls = STATIC_ROUTES.map((r) => r.url);

  it('advertises the homepage and the interactive tools', () => {
    expect(urls).toEqual(
      expect.arrayContaining(['/', '/skill-builder', '/spirit-builder', '/familiar-builder', '/battle-loadouts', '/soul-weapon-engraving', '/skill-stone-builder'])
    );
  });

  it('does not advertise utility screens or the empty creators page', () => {
    for (const excluded of ['/creators', '/highscore', '/changelog', '/donate', '/search', '/profile']) {
      expect(urls).not.toContain(excluded);
    }
  });

  it('has no duplicates', () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});
