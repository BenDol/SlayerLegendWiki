/**
 * Prerender - crawler-facing additions from the AdSense rejection #3 audit:
 * CDN image URLs in crawler HTML, noindex stubs for editor/history/new
 * routes, and the tool copy living under src/content.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  rewriteContentImageUrls,
  collectUtilityRouteStubs,
  collectUtilityStubs,
  renderEmoticonToken,
  stripRendererTokens,
  buildRouteHtml,
  routeToOutputFile,
  loadWikiConfig,
  CRAWLER_IMAGE_SERVING_MODE,
  PRERENDER_DATA_DIR,
  LEGACY_SECTION_ALIASES,
  SAFE_ROUTE_PATTERN,
} from '../scripts/prerender.js';
import { STATIC_ROUTES } from '../scripts/generate-sitemap.js';

describe('emoticon tokens in crawler HTML', () => {
  it('renders {{emoticon:<id>}} and {{emoticon:<name>}} as the app image', () => {
    expect(renderEmoticonToken('1')).toBe('<img src="/images/content/emoticons/Emoticon_1.png" alt="Hello emoticon" class="inline-image" width="32" height="32" style="display:inline-block;vertical-align:middle" />');
    expect(renderEmoticonToken('happy')).toContain('Emoticon_1008.png');
    expect(renderEmoticonToken(' Love ')).toContain('alt="Love emoticon"');
  });

  it('renders nothing for an unknown emoticon', () => {
    expect(renderEmoticonToken('nope')).toBe('');
    expect(renderEmoticonToken('')).toBe('');
  });

  it('replaces emoticon tokens in prose but leaves them inside code spans', () => {
    const out = stripRendererTokens('| 1 | Hello | {{emoticon:1}} | `{{emoticon:1}}` |');
    expect(out).toContain('<img src="/images/content/emoticons/Emoticon_1.png"');
    expect(out).toContain('`{{emoticon:1}}`');
    expect(out).not.toContain('| {{emoticon:1}} |');
  });

  it('still strips every other renderer token', () => {
    expect(stripRendererTokens('a {{AD:contentTop}} b {{data:spirits:6}} c {{emoticon:2}}')).toBe(
      'a  b  c ' + renderEmoticonToken('2')
    );
  });

  it('accepts the same token shape as the app: whitespace and a :size suffix', () => {
    // {{emoticon:Cheer:medium}} is what content actually uses; the crawler
    // HTML must carry the same image the app renders for it.
    expect(stripRendererTokens('{{emoticon:Cheer:medium}}')).toBe(renderEmoticonToken('Cheer'));
    expect(stripRendererTokens('{{ emoticon: 5 : large }}')).toBe(renderEmoticonToken('5'));
    expect(stripRendererTokens('{{emoticon:5:small}} x {{emoticon:Hello}}')).toBe(
      `${renderEmoticonToken('5')} x ${renderEmoticonToken('Hello')}`
    );
  });

  it('ends up on the CDN after the image rewrite', () => {
    const html = rewriteContentImageUrls(renderEmoticonToken('3'), gameAssets);
    expect(html).toContain('https://raw.githubusercontent.com/BenDol/SlayerLegendCDN/main/game-assets/images/emoticons/Emoticon_3.png');
  });
});

describe('collectUtilityStubs', () => {
  const stubs = collectUtilityStubs();
  const byRoute = Object.fromEntries(stubs.map((s) => [s.route, s]));

  it('covers every app-only route the router registers', () => {
    for (const route of ['/search', '/profile', '/my-collections', '/my-spirits', '/my-familiars', '/my-edits', '/build', '/donation-success', '/admin', '/dev-tools', '/characters']) {
      expect(byRoute[route], route).toBeDefined();
      expect(byRoute[route].noindex).toBe(true);
    }
  });

  it('points the legacy /characters alias at its canonical section', () => {
    expect(byRoute['/characters'].canonical).toBe('/character');
    expect(byRoute['/search'].canonical).toBeNull();
    expect(LEGACY_SECTION_ALIASES).toEqual({ characters: 'character' });
  });
});

describe('loadWikiConfig', () => {
  it('reads the root wiki-config.json', () => {
    const config = loadWikiConfig();
    expect(Array.isArray(config.sections)).toBe(true);
    expect(config.features?.gameAssets).toBeDefined();
  });

  it('is fatal when the file is missing or unparseable (a build without it ships broken crawler HTML)', () => {
    expect(() => loadWikiConfig(path.join(__dirname, 'no-such-wiki-config.json'))).toThrow(/Could not read .*no-such-wiki-config\.json/);
    expect(() => loadWikiConfig(path.join(__dirname, 'prerender-crawler.test.js'))).toThrow(/Could not read/);
  });
});

describe('tool copy route validation', () => {
  it('accepts plain slug routes and rejects anything that could escape dist/', () => {
    for (const ok of ['/skill-builder', '/creators', '/a/b', '/Stage-1']) expect(SAFE_ROUTE_PATTERN.test(ok), ok).toBe(true);
    for (const bad of ['../../x', '/../x', '/a/../b', 'skill-builder', '/a b', '/a/', '/', '/-a', '/a//b', '/a\\b']) {
      expect(SAFE_ROUTE_PATTERN.test(bad), bad).toBe(false);
    }
  });
});

const gameAssets = {
  enabled: true,
  cdn: {
    provider: 'github',
    github: { owner: 'BenDol', repo: 'SlayerLegendCDN', basePath: 'game-assets', servingMode: 'jsdelivr', branch: 'main' },
  },
};

describe('rewriteContentImageUrls', () => {
  it('points content images at raw GitHub by default (jsDelivr refuses uncached files)', () => {
    expect(CRAWLER_IMAGE_SERVING_MODE).toBe('raw');
    const html = '<p><img src="/images/content/goods/Goods_Emerald.png" alt="" class="inline-image"> Emeralds</p>';
    expect(rewriteContentImageUrls(html, gameAssets)).toBe(
      '<p><img src="https://raw.githubusercontent.com/BenDol/SlayerLegendCDN/main/game-assets/images/goods/Goods_Emerald.png" alt="" class="inline-image"> Emeralds</p>'
    );
  });

  it('can emit jsDelivr URLs when asked', () => {
    const html = '<img src="/images/content/a.png">';
    expect(rewriteContentImageUrls(html, gameAssets, 'jsdelivr')).toContain('https://cdn.jsdelivr.net/gh/BenDol/SlayerLegendCDN@main/game-assets/images/a.png');
  });

  it('encodes spaces so the crawler gets a fetchable URL', () => {
    const html = '<img src="/images/content/altar/DragonStat 1.png">';
    expect(rewriteContentImageUrls(html, gameAssets)).toContain('altar/DragonStat%201.png');
  });

  it('leaves absolute, relative-without-prefix and non-image URLs alone', () => {
    const html = '<img src="https://example.com/x.png"><img src="/images/logo.png"><a href="/images/content/a.png">a</a>';
    expect(rewriteContentImageUrls(html, gameAssets)).toBe(html);
  });

  it('handles single quotes and attributes before src', () => {
    const html = "<img alt='x' src='/images/content/a.png' width='10'>";
    expect(rewriteContentImageUrls(html, gameAssets)).toBe(
      "<img alt='x' src='https://raw.githubusercontent.com/BenDol/SlayerLegendCDN/main/game-assets/images/a.png' width='10'>"
    );
  });

  it('is a no-op without a CDN configuration', () => {
    const html = '<img src="/images/content/a.png">';
    expect(rewriteContentImageUrls(html, null)).toBe(html);
    expect(rewriteContentImageUrls(html, { enabled: false })).toBe(html);
    expect(rewriteContentImageUrls('', gameAssets)).toBe('');
  });
});

describe('collectUtilityRouteStubs', () => {
  const contentPages = [
    { route: '/', title: 'Home' },
    { route: '/getting-started', title: 'Getting Started' },
    { route: '/getting-started/first-steps', title: 'Your First Steps' },
    { route: '/skills/skills', title: 'Skill List' },
    { route: '/character/stats', title: 'Stats' },
  ];
  const sections = [
    { path: 'getting-started', title: 'Getting Started' },
    { path: 'skills', title: 'Skills' },
    { path: '' },
  ];

  it('emits noindex edit and history stubs for every /<section>/<page> route only', () => {
    const stubs = collectUtilityRouteStubs(contentPages, sections);
    const routes = stubs.map((s) => s.route);
    expect(routes).toContain('/getting-started/first-steps/edit');
    expect(routes).toContain('/getting-started/first-steps/history');
    expect(routes).toContain('/skills/skills/edit');
    expect(routes).not.toContain('/edit');
    expect(routes).not.toContain('/getting-started/edit');
    for (const stub of stubs) {
      expect(stub.noindex).toBe(true);
      expect(stub.kind).toBe('stub');
      expect(stub.bodyHtml).toContain('requires JavaScript');
    }
  });

  it('emits a new-page stub per configured section, skipping malformed entries', () => {
    const routes = collectUtilityRouteStubs(contentPages, sections).map((s) => s.route);
    expect(routes).toContain('/getting-started/new');
    expect(routes).toContain('/skills/new');
    expect(routes.filter((r) => r.endsWith('/new'))).toHaveLength(2);
  });

  it('points editor and history canonicals at the content page, and new-page at the section', () => {
    const stubs = collectUtilityRouteStubs(contentPages, sections);
    const byRoute = Object.fromEntries(stubs.map((s) => [s.route, s]));
    expect(byRoute['/getting-started/first-steps/edit'].canonical).toBe('/getting-started/first-steps');
    expect(byRoute['/getting-started/first-steps/history'].canonical).toBe('/getting-started/first-steps');
    expect(byRoute['/skills/new'].canonical).toBe('/skills');
  });

  it('gives every stub a title that names the page, so titles stay unique', () => {
    const stubs = collectUtilityRouteStubs(contentPages, sections);
    expect(stubs.find((s) => s.route === '/skills/skills/edit').title).toBe('Edit: Skill List');
    expect(stubs.find((s) => s.route === '/skills/skills/history').title).toBe('History: Skill List');
    expect(stubs.find((s) => s.route === '/skills/new').title).toBe('New page in Skills');
  });

  it('escapes titles inside the stub body', () => {
    const stubs = collectUtilityRouteStubs([{ route: '/a/b', title: 'Rock & <Roll>' }], []);
    expect(stubs[0].bodyHtml).toContain('&quot;Rock &amp; &lt;Roll&gt;&quot;');
  });

  it('copes with no sections at all', () => {
    expect(collectUtilityRouteStubs(contentPages, undefined).map((s) => s.route)).toEqual([
      '/getting-started/first-steps/edit',
      '/getting-started/first-steps/history',
      '/skills/skills/edit',
      '/skills/skills/history',
      '/character/stats/edit',
      '/character/stats/history',
      '/characters/stats',
    ]);
  });

  it('stubs every legacy /characters/<page> deep link, pointing at the current page', () => {
    const stubs = collectUtilityRouteStubs(contentPages, sections);
    const legacy = stubs.find((s) => s.route === '/characters/stats');
    expect(legacy).toBeDefined();
    expect(legacy.noindex).toBe(true);
    expect(legacy.canonical).toBe('/character/stats');
    expect(legacy.title).toBe('Stats');
    // Only pages of the aliased section get one.
    expect(stubs.find((s) => s.route === '/characters/skills')).toBeUndefined();
    expect(stubs.find((s) => s.route === '/characterss/stats')).toBeUndefined();
  });

  it('lands in a flat html file the host serves at the exact route', () => {
    expect(routeToOutputFile('/getting-started/first-steps/edit')).toMatch(/getting-started[\\/]first-steps[\\/]edit\.html$/);
  });
});

describe('buildRouteHtml canonical override', () => {
  const template = [
    '<!doctype html><html><head><title>Slayer Legend Wiki</title>',
    '<meta name="description" content="x" />',
    '<meta property="og:title" content="x" /><meta property="og:description" content="x" /><meta property="og:url" content="x" />',
    '<meta name="twitter:title" content="x" /><meta name="twitter:description" content="x" />',
    '</head><body><div id="root"></div></body></html>',
  ].join('');
  const publisher = { '@type': 'Organization', name: 'Test' };

  it('uses the page route as canonical by default', () => {
    const html = buildRouteHtml(template, publisher, { route: '/skills/skills', title: 'Skill List', description: 'd', bodyHtml: '<p>b</p>', noindex: false, keywords: null });
    expect(html).toContain('<link rel="canonical" href="https://slayerlegend.wiki/skills/skills" />');
    expect(html).toContain('<meta property="og:url" content="https://slayerlegend.wiki/skills/skills" />');
    expect(html).not.toContain('name="robots"');
  });

  it('emits noindex without any canonical on stubs (the two are contradictory signals)', () => {
    const html = buildRouteHtml(template, publisher, { route: '/skills/skills/edit', canonical: '/skills/skills', title: 'Edit: Skill List', description: 'd', bodyHtml: '<p>b</p>', noindex: true, keywords: null });
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain('<meta name="robots" content="noindex" />');
    // og:url names the stub's own address, never the page it belongs to.
    expect(html).toContain('<meta property="og:url" content="https://slayerlegend.wiki/skills/skills/edit" />');
    expect(html).toContain('<title>Edit: Skill List | Slayer Legend Wiki</title>');
  });

  it('honours a canonical override on an indexable page', () => {
    const html = buildRouteHtml(template, publisher, { route: '/old', canonical: '/new', title: 'T', description: 'd', bodyHtml: '<p>b</p>', noindex: false, keywords: null });
    expect(html).toContain('<link rel="canonical" href="https://slayerlegend.wiki/new" />');
    expect(html).toContain('<meta property="og:url" content="https://slayerlegend.wiki/old" />');
  });
});

describe('tool copy location', () => {
  it('reads the tool copy from src/content/tool-pages (shared with the app)', () => {
    expect(PRERENDER_DATA_DIR.split(path.sep).slice(-3).join('/')).toBe('src/content/tool-pages');
    expect(fs.existsSync(PRERENDER_DATA_DIR)).toBe(true);
  });

  it('has copy for every interactive tool route the sitemap advertises', () => {
    const expected = ['skill-builder', 'spirit-builder', 'familiar-builder', 'battle-loadouts', 'soul-weapon-engraving', 'skill-stone-builder'];
    for (const route of expected) {
      expect(fs.existsSync(path.join(PRERENDER_DATA_DIR, `${route}.md`))).toBe(true);
    }
  });

  it('keeps /creators noindex and out of the sitemap until it lists approved creators', () => {
    const raw = fs.readFileSync(path.join(PRERENDER_DATA_DIR, 'creators.md'), 'utf8');
    expect(raw).toMatch(/^robots:\s*noindex$/m);
    expect(STATIC_ROUTES.map((r) => r.url)).not.toContain('/creators');
  });
});
