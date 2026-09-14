/**
 * AdSense readiness audit
 *
 * Checks a deployed (or locally served) build against the gates in
 * .claude/adsense-approval-plan-2026-09-14.md - the things Google's review
 * pipeline actually samples: the crawler HTML, the JavaScript-rendered DOM,
 * the mobile first paint, image URLs, junk routes, robots.txt and the www
 * host. Exits non-zero when any gate fails.
 *
 *   node scripts/audit-adsense.mjs                         # production
 *   node scripts/audit-adsense.mjs --base=http://localhost:8790   # npm run preview:audit
 *   node scripts/audit-adsense.mjs --title-runs=3 --out=audit-report.json
 *
 * Options:
 *   --base=<url>        Site root (default https://slayerlegend.wiki)
 *   --sitemap=<url>     Sitemap to enumerate (default <base>/sitemap.xml)
 *   --out=<file>        Write the JSON report here (default audit-report.json)
 *   --chrome=<path>     Chrome/Chromium binary (default: CHROME_PATH env or common locations)
 *   --title-runs=<n>    Rendered-title stability runs per URL (default 1; gate G2 wants 3)
 *   --concurrency=<n>   Parallel headless renders (default 3)
 *   --limit=<n>         Only audit the first n sitemap URLs (smoke runs)
 *   --skip-render       Skip headless Chrome checks (crawler HTML only)
 *   --skip-www          Skip the www host check (local runs)
 *
 * Requires Node 18+ (global fetch) and a Chrome binary for the render gates.
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_BASE = 'https://slayerlegend.wiki';
const MIN_RENDERED_WORDS = 250;
const MIN_CRAWLER_WORDS = 250;
const RENDER_TIMEOUT_MS = 45000;
const VIRTUAL_TIME_BUDGET_MS = 15000;
const DESKTOP_WINDOW = '1366,900';
const MOBILE_WINDOW = '390,844';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const CRAWLER_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const IMAGE_UA = 'Googlebot-Image/1.0';
const JUNK_SAMPLE_PAGES = 3;
const JUNK_SAMPLE_SECTIONS = 2;

/** Rendered text that means a screen is a shell, not content. */
const FORBIDDEN_RENDERED_PHRASES = [
  'No pages yet',
  'Create markdown files',
  'No video guides yet',
  'No streamers yet',
  'Page Not Found',
  'Choose Edit Mode',
];

/** robots.txt groups that would override the "*" rules for Google and friends. */
const FORBIDDEN_ROBOTS_AGENTS = ['googlebot', 'mediapartners-google', 'adsbot-google', 'adsbot-google-mobile', 'bingbot'];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { base: DEFAULT_BASE, out: 'audit-report.json', titleRuns: 1, concurrency: 3, limit: 0, skipRender: false, skipWww: false };
  for (const arg of argv) {
    const [key, value] = arg.includes('=') ? arg.split(/=(.*)/s) : [arg, true];
    switch (key) {
      case '--base': args.base = String(value).replace(/\/+$/, ''); break;
      case '--sitemap': args.sitemap = String(value); break;
      case '--out': args.out = String(value); break;
      case '--chrome': args.chrome = String(value); break;
      case '--title-runs': args.titleRuns = Math.max(1, Number(value) || 1); break;
      case '--concurrency': args.concurrency = Math.max(1, Number(value) || 1); break;
      case '--limit': args.limit = Number(value) || 0; break;
      case '--skip-render': args.skipRender = true; break;
      case '--skip-www': args.skipWww = true; break;
      default: if (key.startsWith('--')) console.warn(`Unknown option ${key}`);
    }
  }
  args.sitemap = args.sitemap || `${args.base}/sitemap.xml`;
  return args;
}

function findChrome(explicit) {
  const candidates = explicit ? [explicit, ...CHROME_CANDIDATES] : CHROME_CANDIDATES;
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

// ---------------------------------------------------------------------------
// HTML helpers (regex based on purpose: no DOM dependency, works on any HTML)
// ---------------------------------------------------------------------------

const decodeEntities = (text) => text
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function textOf(html) {
  return decodeEntities(
    html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

const wordCount = (text) => (text ? text.split(' ').filter(Boolean).length : 0);

function titleOf(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).trim() : null;
}

function metaRobots(html) {
  const m = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i) || html.match(/<meta\s+content="([^"]*)"\s+name="robots"/i);
  return m ? m[1] : null;
}

function canonicalOf(html) {
  const m = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
  return m ? m[1] : null;
}

function crawlerArticleHtml(html) {
  const m = html.match(/<main class="sl-prerender">([\s\S]*?)<\/main>/);
  return m ? m[1] : '';
}

function renderedMainHtml(html) {
  const bodyStart = html.indexOf('<body');
  const body = bodyStart >= 0 ? html.slice(bodyStart) : html;
  const m = body.match(/<main[\s\S]*?<\/main>/i);
  return m ? m[0] : body;
}

function imageSources(html) {
  return [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => decodeEntities(m[1]));
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchText(url, userAgent) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent }, redirect: 'manual' });
  const text = response.status >= 300 && response.status < 400 ? '' : await response.text();
  return { status: response.status, location: response.headers.get('location'), contentType: response.headers.get('content-type') || '', text };
}

const imageCache = new Map();
async function checkImage(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  const promise = (async () => {
    try {
      let response = await fetch(url, { method: 'GET', headers: { 'User-Agent': IMAGE_UA }, redirect: 'follow' });
      const type = response.headers.get('content-type') || '';
      return { ok: response.ok && type.startsWith('image/'), status: response.status, type };
    } catch (error) {
      return { ok: false, status: 0, type: '', error: error.message };
    }
  })();
  imageCache.set(url, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Headless Chrome
// ---------------------------------------------------------------------------

let profileCounter = 0;
const RENDER_ATTEMPTS = 2;
/** A dump shorter than this is a crashed/blank Chrome run, not a page. */
const MIN_DOM_BYTES = 2000;

async function renderDomOnce(chrome, url, { mobile = false, tmpDir }) {
  const profile = path.join(tmpDir, `profile-${process.pid}-${profileCounter++}`);
  const args = [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--disable-extensions',
    `--window-size=${mobile ? MOBILE_WINDOW : DESKTOP_WINDOW}`,
    `--virtual-time-budget=${VIRTUAL_TIME_BUDGET_MS}`,
    `--timeout=${RENDER_TIMEOUT_MS}`,
    `--user-data-dir=${profile}`,
    '--dump-dom',
    url,
  ];
  if (mobile) args.splice(1, 0, `--user-agent=${MOBILE_UA}`, '--force-device-scale-factor=1');
  try {
    const { stdout } = await execFileAsync(chrome, args, { maxBuffer: 64 * 1024 * 1024, timeout: RENDER_TIMEOUT_MS + 10000, windowsHide: true });
    return stdout;
  } finally {
    removeDirQuietly(profile);
  }
}

/**
 * Best-effort recursive delete. A Chrome killed by the execFile timeout can
 * still hold its profile open on Windows (EBUSY/EPERM); that must never
 * replace the real render error, so the failure is reported and swallowed.
 */
function removeDirQuietly(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch (error) {
    console.warn(`⚠️  could not remove ${dir}: ${error.message}`);
  }
}

/** Resolve an image src from a page to the absolute URL a crawler would fetch. */
function absoluteUrl(base, src) {
  return src.startsWith('http') ? src : `${base}${src.startsWith('/') ? '' : '/'}${src}`;
}

/**
 * Headless render with one retry: under load a Chrome instance occasionally
 * exits with an empty or truncated DOM, which must not be scored as a page
 * that lacks its sidebar or its content.
 */
async function renderDom(chrome, url, options) {
  let lastError = null;
  for (let attempt = 1; attempt <= RENDER_ATTEMPTS; attempt++) {
    try {
      const html = await renderDomOnce(chrome, url, options);
      if (html && html.length >= MIN_DOM_BYTES && /<body/i.test(html)) return html;
      lastError = new Error(`empty or truncated DOM (${html ? html.length : 0} bytes)`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('render failed');
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

async function auditCrawlerHtml(base, route) {
  const url = `${base}${route}`;
  const { status, text, location } = await fetchText(url, CRAWLER_UA);
  const article = crawlerArticleHtml(text);
  const words = wordCount(textOf(article));
  const images = imageSources(article);
  // All of a page's images in flight at once; checkImage dedupes across pages.
  const imageResults = await Promise.all(images.map(async (src) => {
    const absolute = absoluteUrl(base, src);
    const result = await checkImage(absolute);
    return result.ok ? null : { src: absolute, ...result };
  }));
  const brokenImages = imageResults.filter(Boolean);
  const problems = [];
  if (status !== 200) problems.push(`crawler fetch returned ${status}${location ? ` -> ${location}` : ''}`);
  if (!article) problems.push('no prerendered article (<main class="sl-prerender"> missing)');
  const title = titleOf(text);
  const canonical = canonicalOf(text);
  const robots = metaRobots(text);
  if (!title) problems.push('no <title>');
  if (!canonical) problems.push('no canonical');
  if (canonical && canonical !== `${base}${route === '/' ? '/' : route}` && !canonical.endsWith(route === '/' ? '/' : route)) problems.push(`canonical points elsewhere: ${canonical}`);
  if (robots && /noindex/i.test(robots)) problems.push(`sitemap URL is noindex (${robots})`);
  if (words < MIN_CRAWLER_WORDS) problems.push(`crawler article has ${words} words (< ${MIN_CRAWLER_WORDS})`);
  for (const broken of brokenImages) problems.push(`image not served as image: ${broken.src} (${broken.status} ${broken.type || broken.error || ''})`);
  return { status, title, canonical, robots, words, images: images.length, brokenImages: brokenImages.length, problems };
}

async function auditRendered(chrome, base, route, { titleRuns, tmpDir, expectedTitle }) {
  const url = `${base}${route}`;
  const titles = [];
  let words = 0;
  let forbidden = [];
  let robots = null;
  for (let run = 0; run < titleRuns; run++) {
    const html = await renderDom(chrome, url, { tmpDir });
    titles.push(titleOf(html));
    if (run === 0) {
      const main = renderedMainHtml(html);
      const text = textOf(main);
      words = wordCount(text);
      forbidden = FORBIDDEN_RENDERED_PHRASES.filter((phrase) => text.includes(phrase));
      robots = metaRobots(html);
    }
  }
  const problems = [];
  if (words < MIN_RENDERED_WORDS) problems.push(`rendered main content has ${words} words (< ${MIN_RENDERED_WORDS})`);
  for (const phrase of forbidden) problems.push(`rendered content contains "${phrase}"`);
  if (robots && /noindex/i.test(robots)) problems.push(`rendered DOM is noindex (${robots})`);
  const distinctTitles = [...new Set(titles)];
  if (distinctTitles.length > 1) problems.push(`rendered <title> unstable across ${titleRuns} runs: ${distinctTitles.join(' | ')}`);
  if (expectedTitle && distinctTitles.some((t) => t !== expectedTitle)) problems.push(`rendered <title> "${distinctTitles.join(' | ')}" differs from prerendered "${expectedTitle}"`);
  return { titles, words, forbidden, robots, problems };
}

async function auditMobile(chrome, base, route, { tmpDir }) {
  const html = await renderDom(chrome, `${base}${route}`, { mobile: true, tmpDir });
  const aside = html.match(/<aside\b[^>]*class="([^"]*)"/i);
  const problems = [];
  if (!aside) problems.push('no <aside> sidebar found in mobile render');
  else if (!/-translate-x-full/.test(aside[1])) problems.push('sidebar drawer is open on mobile first paint');
  if (/class="[^"]*fixed inset-0[^"]*bg-opacity-50[^"]*"/i.test(html)) problems.push('dimming overlay present on mobile first paint');
  return { drawerClosed: Boolean(aside && /-translate-x-full/.test(aside[1])), problems };
}

async function auditJunkRoutes(base, routes, sections) {
  const contentRoutes = routes.filter((r) => r.split('/').filter(Boolean).length === 2).slice(0, JUNK_SAMPLE_PAGES);
  const targets = [
    ...contentRoutes.flatMap((r) => [`${r}/edit`, `${r}/history`]),
    ...sections.slice(0, JUNK_SAMPLE_SECTIONS).map((s) => `/${s}/new`),
  ];
  const results = [];
  for (const route of targets) {
    const { status, text } = await fetchText(`${base}${route}`, CRAWLER_UA);
    const robots = metaRobots(text);
    const problems = [];
    if (status !== 200) problems.push(`returned ${status}`);
    if (!robots || !/noindex/i.test(robots)) problems.push(`not noindex (robots=${robots})`);
    results.push({ route, status, robots, problems });
  }
  return results;
}

async function auditRobotsTxt(base) {
  const { status, text } = await fetchText(`${base}/robots.txt`, CRAWLER_UA);
  const agents = [...text.matchAll(/^user-agent:\s*(.+)$/gim)].map((m) => m[1].trim().toLowerCase());
  const problems = [];
  if (status !== 200) problems.push(`robots.txt returned ${status}`);
  for (const agent of agents) if (FORBIDDEN_ROBOTS_AGENTS.includes(agent)) problems.push(`dedicated "User-agent: ${agent}" group overrides the * rules for that crawler`);
  if (!/^sitemap:/im.test(text)) problems.push('no Sitemap: line');
  return { status, agents, problems };
}

async function auditWww(base) {
  const host = new URL(base).host;
  if (host.startsWith('www.') || host.includes('localhost') || /^\d/.test(host)) return { skipped: true, problems: [] };
  const wwwUrl = `${base.replace('://', '://www.')}/`;
  try {
    const { status, location } = await fetchText(wwwUrl, CRAWLER_UA);
    const problems = [];
    const redirectsToApex = status >= 300 && status < 400 && location && location.startsWith(`${base}/`);
    if (!(status === 200 || redirectsToApex)) problems.push(`${wwwUrl} returned ${status}${location ? ` -> ${location}` : ''} (expected 301 to ${base}/)`);
    return { status, location, problems };
  } catch (error) {
    return { status: 0, problems: [`${wwwUrl} unreachable: ${error.message}`] };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function loadSitemapRoutes(sitemapUrl, base) {
  const { status, text } = await fetchText(sitemapUrl, CRAWLER_UA);
  if (status !== 200) throw new Error(`Sitemap ${sitemapUrl} returned ${status}`);
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return locs.map((loc) => {
    const url = new URL(loc);
    const route = url.pathname.replace(/\/+$/, '') || '/';
    return route;
  }).filter((route, index, all) => all.indexOf(route) === index);
}

/**
 * Run the audit. Resolves with the failure count (0 = every gate passed);
 * rejects on a harness error. Never calls process.exit itself so the temp
 * directory is always removed.
 */
async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const chrome = args.skipRender ? null : findChrome(args.chrome);
  if (!args.skipRender && !chrome) {
    throw new Error('No Chrome binary found. Pass --chrome=<path>, set CHROME_PATH, or use --skip-render.');
  }
  const tmpDir = fs.mkdtempSync(path.join(process.env.TMPDIR || process.env.TEMP || '/tmp', 'adsense-audit-'));
  try {
    return await runAudit(args, chrome, tmpDir);
  } finally {
    removeDirQuietly(tmpDir);
  }
}

async function runAudit(args, chrome, tmpDir) {
  const started = Date.now();

  console.log(`🔎 AdSense readiness audit against ${args.base}`);
  let routes = await loadSitemapRoutes(args.sitemap, args.base);
  if (args.limit > 0) routes = routes.slice(0, args.limit);
  const sections = [...new Set(routes.filter((r) => r.split('/').filter(Boolean).length === 2).map((r) => r.split('/')[1]))];
  console.log(`   ${routes.length} sitemap routes, ${sections.length} sections${chrome ? `, Chrome: ${chrome}` : ', render checks skipped'}\n`);

  const report = { base: args.base, generatedAt: new Date().toISOString(), routes: {}, junk: [], robots: null, www: null, summary: {} };
  let failures = 0;

  // Gate G1/G4 (crawler side)
  console.log('- Crawler HTML + images -');
  const crawler = await mapWithConcurrency(routes, 6, (route) => auditCrawlerHtml(args.base, route));
  routes.forEach((route, i) => { report.routes[route] = { crawler: crawler[i] }; });

  // Gates G1/G2/G3 (rendered side)
  if (chrome) {
    console.log('- Rendered DOM (desktop) -');
    const rendered = await mapWithConcurrency(routes, args.concurrency, (route, i) =>
      auditRendered(chrome, args.base, route, { titleRuns: args.titleRuns, tmpDir, expectedTitle: crawler[i].title })
        .catch((error) => ({ titles: [], words: 0, forbidden: [], robots: null, problems: [`render failed: ${error.message}`] })));
    console.log('- Mobile first paint -');
    const mobile = await mapWithConcurrency(routes, args.concurrency, (route) =>
      auditMobile(chrome, args.base, route, { tmpDir })
        .catch((error) => ({ drawerClosed: false, problems: [`mobile render failed: ${error.message}`] })));
    routes.forEach((route, i) => { report.routes[route].rendered = rendered[i]; report.routes[route].mobile = mobile[i]; });
  }

  // Gate G5
  console.log('- Junk routes + robots.txt -');
  report.junk = await auditJunkRoutes(args.base, routes, sections);
  report.robots = await auditRobotsTxt(args.base);

  // Gate G6
  report.www = args.skipWww ? { skipped: true, problems: [] } : await auditWww(args.base);

  // Summary
  console.log('\nRoute'.padEnd(44) + 'crawl'.padStart(6) + 'rend'.padStart(6) + 'mob'.padStart(5) + '  problems');
  console.log('-'.repeat(100));
  for (const route of routes) {
    const r = report.routes[route];
    const problems = [...r.crawler.problems, ...(r.rendered?.problems || []), ...(r.mobile?.problems || [])];
    if (problems.length) failures += problems.length;
    const mark = problems.length ? '✗' : '✓';
    console.log(`${mark} ${route}`.padEnd(44) + String(r.crawler.words).padStart(6) + String(r.rendered?.words ?? '-').padStart(6) + (r.mobile ? (r.mobile.drawerClosed ? 'ok' : 'OPEN') : '-').padStart(5) + (problems.length ? `  ${problems.join('; ')}` : ''));
  }
  for (const junk of report.junk) {
    failures += junk.problems.length;
    console.log(`${junk.problems.length ? '✗' : '✓'} ${junk.route}`.padEnd(44) + `  stub ${junk.status} robots=${junk.robots}${junk.problems.length ? `  ${junk.problems.join('; ')}` : ''}`);
  }
  failures += report.robots.problems.length + report.www.problems.length;
  console.log(`${report.robots.problems.length ? '✗' : '✓'} robots.txt  agents=[${report.robots.agents.join(', ')}]${report.robots.problems.length ? `  ${report.robots.problems.join('; ')}` : ''}`);
  console.log(`${report.www.problems.length ? '✗' : '✓'} www host  ${report.www.skipped ? 'skipped' : `${report.www.status}${report.www.location ? ` -> ${report.www.location}` : ''}`}${report.www.problems.length ? `  ${report.www.problems.join('; ')}` : ''}`);

  report.summary = { routes: routes.length, failures, durationMs: Date.now() - started };
  fs.writeFileSync(args.out, JSON.stringify(report, null, 2));

  console.log(`\n${failures === 0 ? '✅' : '❌'} ${failures} problem(s) across ${routes.length} routes in ${Math.round((Date.now() - started) / 1000)}s - report: ${args.out}`);
  return failures;
}

// Run only when executed directly (node scripts/audit-adsense.mjs); importing
// the module (from tests) must not start an audit.
const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  main()
    .then((failures) => process.exit(failures === 0 ? 0 : 1))
    .catch((error) => {
      console.error('❌ Audit failed:', error);
      process.exit(2);
    });
}

// Pure helpers exported for unit tests.
export {
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
};
