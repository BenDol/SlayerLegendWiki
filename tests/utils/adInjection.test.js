/**
 * Tests for automatic in-content ad marker injection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub the provider so this test doesn't pull React/router into a node environment
vi.mock('../../src/components/ads/AdsProvider', () => ({
  areAdsRuntimeEnabled: () => true,
}));

const { injectAdMarkers } = await import('../../src/utils/adInjection.js');

const CONFIGURED_ADS = {
  features: {
    ads: {
      enabled: true,
      adsense: {
        client: 'ca-pub-0000000000000000',
        slots: {
          contentTop: '1111111111',
          inArticle: '2222222222',
          contentBottom: '3333333333',
          toolTop: '4444444444',
        },
      },
    },
  },
};

/** Build a markdown paragraph with an exact word count. */
const paragraph = words => Array.from({ length: words }, (_, i) => `word${i}`).join(' ');

/** Article with `sections` H2 sections, each carrying `wordsPerSection` words of prose. */
const article = (sections, wordsPerSection) => {
  const parts = [`# Title`, '', paragraph(wordsPerSection), ''];
  for (let i = 0; i < sections; i++) {
    parts.push(`## Section ${i + 1}`, '', paragraph(wordsPerSection), '');
  }
  return parts.join('\n');
};

const countMarkers = (content, placement) =>
  content.split(`{{AD:${placement}}}`).length - 1;

const countAllMarkers = content => (content.match(/\{\{AD:\w+\}\}/g) || []).length;

describe('injectAdMarkers', () => {
  beforeEach(() => {
    global.window = { __WIKI_CONFIG__: CONFIGURED_ADS, location: { pathname: '/guides/leveling' } };
  });

  it('leaves short pages untouched', () => {
    const content = article(1, 40);
    expect(injectAdMarkers(content)).toBe(content);
  });

  it('injects body ads plus a trailing multiplex on a long article', () => {
    const result = injectAdMarkers(article(5, 200));

    expect(countMarkers(result, 'contentTop')).toBe(1);
    expect(countMarkers(result, 'inArticle')).toBe(1);
    expect(countMarkers(result, 'contentBottom')).toBe(1);
    expect(countAllMarkers(result)).toBe(3);
  });

  it('respects the maxInArticleAds cap on very long articles', () => {
    const result = injectAdMarkers(article(30, 200));
    const bodyAds = countMarkers(result, 'contentTop') + countMarkers(result, 'inArticle');

    expect(bodyAds).toBe(2);
  });

  it('places the trailing ad last and never before the first section of content', () => {
    const result = injectAdMarkers(article(5, 200));
    const lines = result.split('\n').filter(line => line.trim());

    expect(lines[lines.length - 1]).toBe('{{AD:contentBottom}}');
    expect(lines[0]).toBe('# Title');
    // Reader gets real prose before the first unit
    expect(lines.indexOf('{{AD:contentTop}}')).toBeGreaterThan(1);
  });

  it('never injects inside fenced code blocks', () => {
    const content = [
      '# Title',
      '',
      paragraph(300),
      '',
      '```js',
      '## not a heading',
      '',
      '## also not a heading',
      '```',
      '',
      paragraph(300),
      '',
      '## Real Section',
      '',
      paragraph(300),
    ].join('\n');

    const result = injectAdMarkers(content);
    const fenceStart = result.indexOf('```js');
    const fenceEnd = result.indexOf('```', fenceStart + 5);
    const insideFence = result.slice(fenceStart, fenceEnd);

    expect(insideFence).not.toContain('{{AD:');
    expect(countAllMarkers(result)).toBeGreaterThan(0);
  });

  it('skips front matter when measuring content', () => {
    const content = ['---', 'title: Test', 'tags: [a, b]', '---', '', article(5, 200)].join('\n');
    const result = injectAdMarkers(content);

    expect(result.startsWith('---\ntitle: Test')).toBe(true);
    expect(countAllMarkers(result)).toBe(3);
  });

  it('does nothing on excluded routes such as the editor', () => {
    global.window.location.pathname = '/guides/leveling/edit';
    const content = article(5, 200);

    expect(injectAdMarkers(content)).toBe(content);
  });

  it('does nothing when no slots are configured', () => {
    global.window.__WIKI_CONFIG__ = {
      features: { ads: { enabled: true, adsense: { client: 'ca-pub-0', slots: {} } } },
    };
    const content = article(5, 200);

    expect(injectAdMarkers(content)).toBe(content);
  });

  it('leaves pages with hand-placed ad markers untouched', () => {
    const content = ['# Title', '', paragraph(200), '', '{{AD:contentTop}}', '', article(5, 200)].join('\n');
    const result = injectAdMarkers(content);

    expect(result).toBe(content);
    expect(countAllMarkers(result)).toBe(1);
  });

  it('handles articles with no headings', () => {
    const content = [paragraph(300), '', paragraph(300), '', paragraph(300)].join('\n');
    const result = injectAdMarkers(content);

    expect(countAllMarkers(result)).toBeGreaterThan(0);
  });
});
