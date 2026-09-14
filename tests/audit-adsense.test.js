/**
 * AdSense readiness harness - the pure helpers behind every gate.
 *
 * The harness is the definition of "AdSense-ready" for this site, so a
 * silent regression in its parsing (a title it cannot find, an article it
 * cannot locate) would turn a red gate green. These pin the helpers; the
 * network and Chrome parts are exercised by running the harness itself.
 */

import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  textOf,
  wordCount,
  titleOf,
  metaRobots,
  canonicalOf,
  crawlerArticleHtml,
  renderedMainHtml,
  imageSources,
  absoluteUrl,
  mapWithConcurrency,
  FORBIDDEN_RENDERED_PHRASES,
  FORBIDDEN_ROBOTS_AGENTS,
  MIN_RENDERED_WORDS,
  MIN_CRAWLER_WORDS,
} from '../scripts/audit-adsense.mjs';

describe('parseArgs', () => {
  it('defaults to production and derives the sitemap from the base', () => {
    const args = parseArgs([]);
    expect(args.base).toBe('https://slayerlegend.wiki');
    expect(args.sitemap).toBe('https://slayerlegend.wiki/sitemap.xml');
    expect(args.titleRuns).toBe(1);
    expect(args.skipRender).toBe(false);
    expect(args.skipWww).toBe(false);
  });

  it('parses the local preview invocation used by npm run audit:adsense:local', () => {
    const args = parseArgs(['--base=http://localhost:8790/', '--skip-www', '--title-runs=3', '--limit=5', '--out=x.json']);
    expect(args.base).toBe('http://localhost:8790');
    expect(args.sitemap).toBe('http://localhost:8790/sitemap.xml');
    expect(args.skipWww).toBe(true);
    expect(args.titleRuns).toBe(3);
    expect(args.limit).toBe(5);
    expect(args.out).toBe('x.json');
  });

  it('never lets title runs or concurrency drop below one', () => {
    expect(parseArgs(['--title-runs=0']).titleRuns).toBe(1);
    expect(parseArgs(['--concurrency=abc']).concurrency).toBe(1);
  });
});

describe('HTML helpers', () => {
  const page = [
    '<!doctype html><html><head><title>Skill List | Slayer Legend Wiki</title>',
    '<meta name="robots" content="noindex" />',
    '<link rel="canonical" href="https://slayerlegend.wiki/skills/skills" />',
    '<style>.x{}</style><script>var a = "<p>not text</p>";</script></head>',
    '<body><div id="root"><main class="sl-prerender"><h1>Skill &amp; List</h1><p>Body&nbsp;text here.</p>',
    '<img src="/images/content/goods/a.png" alt="" /><img alt="no src" /><img src="https://cdn.example/b.png"></main></div></body></html>',
  ].join('');

  it('extracts title, robots and canonical', () => {
    expect(titleOf(page)).toBe('Skill List | Slayer Legend Wiki');
    expect(metaRobots(page)).toBe('noindex');
    expect(canonicalOf(page)).toBe('https://slayerlegend.wiki/skills/skills');
    expect(titleOf('<html></html>')).toBeNull();
    expect(metaRobots('<html></html>')).toBeNull();
    expect(canonicalOf('<html></html>')).toBeNull();
  });

  it('reads the robots meta with attributes in either order', () => {
    expect(metaRobots('<meta content="index, follow" name="robots">')).toBe('index, follow');
  });

  it('finds the prerendered article and its images', () => {
    const article = crawlerArticleHtml(page);
    expect(article).toContain('<h1>Skill &amp; List</h1>');
    expect(imageSources(article)).toEqual(['/images/content/goods/a.png', 'https://cdn.example/b.png']);
    expect(crawlerArticleHtml('<main>not prerendered</main>')).toBe('');
  });

  it('turns HTML into counted words, ignoring scripts and styles', () => {
    const text = textOf(crawlerArticleHtml(page));
    expect(text).toBe('Skill & List Body text here.');
    expect(wordCount(text)).toBe(6); // "&" counts as a token, as in the harness's gate
    expect(wordCount('')).toBe(0);
    expect(textOf(page)).not.toContain('not text');
  });

  it('prefers <main> in a rendered DOM and falls back to the body', () => {
    expect(renderedMainHtml('<html><head><title>t</title></head><body><nav>n</nav><main id="m"><p>x</p></main></body></html>')).toBe('<main id="m"><p>x</p></main>');
    expect(renderedMainHtml('<html><body><p>only body</p></body></html>')).toBe('<body><p>only body</p></body></html>');
  });

  it('resolves image sources against the audited base', () => {
    expect(absoluteUrl('http://localhost:8790', '/images/x.png')).toBe('http://localhost:8790/images/x.png');
    expect(absoluteUrl('http://localhost:8790', 'images/x.png')).toBe('http://localhost:8790/images/x.png');
    expect(absoluteUrl('http://localhost:8790', 'https://raw.githubusercontent.com/x.png')).toBe('https://raw.githubusercontent.com/x.png');
  });
});

describe('mapWithConcurrency', () => {
  it('preserves order and never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });

  it('copes with an empty list', async () => {
    expect(await mapWithConcurrency([], 3, async () => 1)).toEqual([]);
  });
});

describe('gate constants', () => {
  it('match the plan: 250 rendered and crawler words, the phrases the audit flagged, the crawler groups robots.txt must not name', () => {
    expect(MIN_RENDERED_WORDS).toBe(250);
    expect(MIN_CRAWLER_WORDS).toBe(250);
    expect(FORBIDDEN_RENDERED_PHRASES).toContain('Create markdown files');
    expect(FORBIDDEN_ROBOTS_AGENTS).toEqual(expect.arrayContaining(['googlebot', 'mediapartners-google', 'adsbot-google']));
  });
});
