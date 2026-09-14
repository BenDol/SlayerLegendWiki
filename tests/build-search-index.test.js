import { describe, it, expect } from 'vitest';
import { pageUrl } from '../scripts/buildSearchIndex.js';
import { pathToRoute } from '../scripts/prerender.js';
import { pathToUrl } from '../scripts/generate-sitemap.js';

describe('search index URLs', () => {
  it('maps a section index.md to the section route, like the sitemap and prerenderer', () => {
    expect(pageUrl('skills', 'index')).toBe('/skills');
    expect(pathToRoute('skills/index.md')).toBe('/skills');
    expect(pathToUrl('skills/index.md')).toBe('/skills');
  });

  it('maps ordinary pages to /section/page', () => {
    expect(pageUrl('skills', 'skill-mastery')).toBe('/skills/skill-mastery');
    expect(pathToRoute('skills/skill-mastery.md')).toBe('/skills/skill-mastery');
  });
});
