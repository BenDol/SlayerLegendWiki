import { describe, it, expect } from 'vitest';
import { normalizeLastmod, pathToUrl } from '../scripts/generate-sitemap.js';

describe('normalizeLastmod', () => {
  it('formats YAML-parsed Date objects (unquoted frontmatter dates)', () => {
    expect(normalizeLastmod(new Date('2026-08-16T00:00:00.000Z'))).toBe('2026-08-16');
  });

  it('parses quoted date strings', () => {
    expect(normalizeLastmod('2026-08-26')).toBe('2026-08-26');
  });

  it('parses full ISO timestamp strings', () => {
    expect(normalizeLastmod('2025-12-21T00:00:00.000Z')).toBe('2025-12-21');
  });

  it('returns null for missing dates (lastmod omitted, not faked)', () => {
    expect(normalizeLastmod(undefined)).toBeNull();
    expect(normalizeLastmod(null)).toBeNull();
    expect(normalizeLastmod('')).toBeNull();
  });

  it('returns null for unparseable dates', () => {
    expect(normalizeLastmod('soon(tm)')).toBeNull();
  });
});

describe('pathToUrl', () => {
  it('matches the prerender route mapping', () => {
    expect(pathToUrl('progression/leveling.md')).toBe('/progression/leveling');
    expect(pathToUrl('skills/index.md')).toBe('/skills');
    expect(pathToUrl('meta\\about.md')).toBe('/meta/about');
  });
});
