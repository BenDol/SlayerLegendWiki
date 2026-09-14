// @vitest-environment jsdom
/**
 * SeoManager - section routes take their meta from the section's index page.
 *
 * The prerendered HTML for /skills carries the index page's title; if the
 * hydrated app emitted a generic "Skills" first and swapped later, crawlers
 * comparing the two saw an unstable title. The section branch must also come
 * before the article lookup: the search index stores the index page under
 * the section root, and that entry is not an article.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';

const mockConfig = vi.fn();
const mockPathname = vi.fn();

vi.mock('../../wiki-framework/src/hooks/useWikiConfig', () => ({
  useWikiConfig: () => ({ config: mockConfig(), loading: false, error: null }),
}));

vi.mock('../../src/hooks/usePathname', () => ({
  usePathname: () => mockPathname(),
}));

const SeoManager = (await import('../../src/components/SeoManager.jsx')).default;

const config = {
  wiki: { title: 'Test Wiki', description: 'A test wiki', url: 'https://example.com' },
  sections: [{ id: 'skills', path: 'skills', title: 'Skills' }],
};

const indexEntries = [
  { url: '/skills', section: 'skills', pageId: 'index', title: 'Skills Overview', description: 'All about skills', tags: ['skills'], content: 'x' },
  { url: '/skills/skills', section: 'skills', pageId: 'skills', title: 'Skill List', description: 'Every skill', content: 'y' },
];

let resolveIndex;
const pendingIndex = () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
    resolveIndex = (entries) => resolve({ ok: true, json: async () => entries });
  })));
};

const renderManager = () =>
  render(
    <HelmetProvider>
      <SeoManager />
    </HelmetProvider>
  );

describe('SeoManager', () => {
  beforeEach(() => {
    mockConfig.mockReset().mockReturnValue(config);
    mockPathname.mockReset().mockReturnValue('/skills');
    document.head.innerHTML = '';
    document.title = 'Skills Overview | Test Wiki'; // what the prerendered HTML carries
    pendingIndex();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('leaves the prerendered title alone until the page index has loaded', async () => {
    renderManager();
    // Give any (wrong) Helmet update a chance to land.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.title).toBe('Skills Overview | Test Wiki');
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
  });

  it('uses the section index page for a section route once the index is available', async () => {
    renderManager();
    resolveIndex(indexEntries);
    await waitFor(() => expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('All about skills'));
    expect(document.title).toBe('Skills Overview | Test Wiki');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/skills');
    // Section index pages are not articles: no article JSON-LD.
    const jsonLd = [...document.head.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent).join('');
    expect(jsonLd).not.toContain('"Article"');
  });

  it('still honours an older search index that keys the section page under /<section>/index', async () => {
    renderManager();
    resolveIndex([{ ...indexEntries[0], url: '/skills/index' }, indexEntries[1]]);
    await waitFor(() => expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('All about skills'));
    expect(document.title).toBe('Skills Overview | Test Wiki');
  });

  it('falls back to the section title when the section has no index entry', async () => {
    document.title = 'Test Wiki';
    renderManager();
    resolveIndex([indexEntries[1]]);
    await waitFor(() => expect(document.title).toBe('Skills | Test Wiki'));
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Browse Skills guides and pages on Test Wiki.');
  });

  it('emits article meta for a content page', async () => {
    mockPathname.mockReturnValue('/skills/skills');
    document.title = 'Skill List | Test Wiki';
    renderManager();
    resolveIndex(indexEntries);
    await waitFor(() => expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Every skill'));
    expect(document.title).toBe('Skill List | Test Wiki');
  });
});
