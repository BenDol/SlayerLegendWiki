/**
 * Build-time prerenderer (AdSense acceptance plan - Phase 1)
 *
 * NOTE: no shebang line - vitest's module transform fails with a bare
 * SyntaxError on a shebang followed by CRLF (Windows checkout), and the
 * script is only ever invoked as `node scripts/prerender.js`.
 *
 * Emits real, crawler-readable HTML for every route so that a plain
 * (non-JS) fetch of any URL returns the article text, a unique <title>,
 * meta description, canonical URL, Open Graph/Twitter tags and JSON-LD.
 *
 * How it works:
 *  1. Walks public/content/(asterisk)(asterisk)/(asterisk).md using the same route mapping as
 *     scripts/generate-sitemap.js (section/page.md -> /section/page,
 *     index.md -> /section, home.md -> /).
 *  2. Renders each markdown body to sanitized HTML with the same
 *     unified/remark/rehype stack the app uses (GFM tables, raw HTML,
 *     sanitize whitelist, heading ids). Custom renderer tokens
 *     ({{AD:*}}, {{home:*}}, {{data:*}}, {{emoticon:*}}, ...) are stripped.
 *  3. Uses the built dist/index.html as a template and writes flat
 *     dist/<route>.html files with per-page meta + the rendered article
 *     injected inside <div id="root">. React's createRoot().render()
 *     replaces that DOM on load, so users still get the full app -
 *     the injected article is only the pre-JS paint / crawler view.
 *  4. Also emits static/tool routes described by
 *     src/content/tool-pages/*.md (frontmatter contract: route, title,
 *     description, robots) - the same files the app renders below each
 *     tool - plus noindexed minimal stubs for pure-app utility routes
 *     (/search, /profile, ...) and for every editor/history/new route the
 *     content pages link to, so those never fall through to the SPA
 *     catch-all and get indexed as copies of the homepage.
 *  5. Content image paths (/images/content/...) are rewritten to the CDN
 *     URL the app resolves them to, so crawlers and non-JS fetches get real
 *     images instead of the catch-all's HTML.
 *  6. The homepage is patched in place: home.md's rendered article is
 *     injected into dist/index.html's root div while all existing meta,
 *     scripts and asset links are preserved.
 *
 * Cloudflare Pages serves emitted static files in preference to the
 * `/* /index.html 200` catch-all, so prerendered routes take effect
 * automatically while un-prerendered app routes keep working.
 *
 * Run automatically after builds via the npm "postbuild",
 * "postbuild:cloudflare" and "postbuild:netlify" lifecycle scripts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { buildCdnImageUrl, CONTENT_IMAGE_PREFIX } from '../functions/_shared/utils/imageCdn.js';
import { resolveEmoticon, emoticonImagePath } from '../src/data/emoticons.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SITE_URL = 'https://slayerlegend.wiki';
const SITE_TITLE = 'Slayer Legend Wiki';
const CONTENT_DIR = path.join(__dirname, '../public/content');
const DIST_DIR = path.join(__dirname, '../dist');
const TEMPLATE_FILE = path.join(DIST_DIR, 'index.html');
const ROOT_CONFIG_FILE = path.join(__dirname, '../wiki-config.json');
// Tool/static route copy. Lives under src/ so the app can import the same
// files (see src/components/ToolIntro.jsx) - one source of truth for what
// crawlers and users read about each tool.
const PRERENDER_DATA_DIR = path.join(__dirname, '../src/content/tool-pages');

const DESCRIPTION_MAX_LENGTH = 155;

// Crawler HTML points images at raw.githubusercontent.com rather than
// jsDelivr: the CDN repo exceeds jsDelivr's package size limit, so files not
// already in its cache are refused (403) - the app works around that with a
// runtime fallback (src/utils/cdnFallback.js), crawlers cannot.
const CRAWLER_IMAGE_SERVING_MODE = 'raw';

// Pure-app utility routes: always emitted as minimal noindex stubs so the
// AdSense/Google reviewers never sample a completely empty screen, and so
// these never get indexed as thin pages.
const UTILITY_STUB_ROUTES = [
  { route: '/search', title: 'Search', description: 'Search the Slayer Legend Wiki.' },
  { route: '/profile', title: 'Profile', description: 'Your Slayer Legend Wiki profile.' },
  { route: '/my-collections', title: 'My Collections', description: 'Your saved collections on the Slayer Legend Wiki.' },
  { route: '/my-spirits', title: 'My Spirits', description: 'Your saved spirit setups on the Slayer Legend Wiki.' },
  { route: '/my-familiars', title: 'My Familiars', description: 'Your saved familiar builds on the Slayer Legend Wiki.' },
  { route: '/my-edits', title: 'My Edits', description: 'Your page edits on the Slayer Legend Wiki.' },
  { route: '/build', title: 'Shared Build', description: 'A build shared by another player on the Slayer Legend Wiki.' },
  { route: '/donation-success', title: 'Donation Complete', description: 'Thank you for supporting the Slayer Legend Wiki.' },
  { route: '/admin', title: 'Admin', description: 'Slayer Legend Wiki administration.' },
  { route: '/dev-tools', title: 'Developer Tools', description: 'Slayer Legend Wiki developer tools.' },
  // Legacy alias the app redirects client-side; crawlers get the canonical target.
  { route: '/characters', title: 'Character', description: 'This address has moved to the Character section.', canonical: '/character' },
];

// Legacy section paths the app redirects client-side (old path -> current
// path). Every content page under the current section also gets a noindex
// stub at the old address, so deep links such as /characters/stats never
// fall through to the SPA catch-all (homepage HTML, canonical "/").
const LEGACY_SECTION_ALIASES = Object.freeze({ characters: 'character' });

// Tool-copy frontmatter `route` values are joined into dist/; only plain
// slash-separated slugs are acceptable there.
const SAFE_ROUTE_PATTERN = /^\/(?:[a-z0-9][a-z0-9-]*)(?:\/[a-z0-9][a-z0-9-]*)*$/i;

// Fallback publisher if the template's WebSite JSON-LD cannot be parsed.
const FALLBACK_PUBLISHER = {
  '@type': 'Organization',
  name: SITE_TITLE,
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/images/logo.png`,
    width: 512,
    height: 512,
  },
};

// ---------------------------------------------------------------------------
// Markdown -> sanitized HTML (mirrors the app's PageViewer pipeline)
// ---------------------------------------------------------------------------

// Same whitelist as wiki-framework/src/components/wiki/PageViewer.jsx so the
// prerendered article allows exactly what the app itself would render.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span || []), 'className', 'class', 'style'],
    img: ['src', 'alt', 'title', 'width', 'height', 'style', ['className', /^inline-image$/], 'class'],
    div: [...(defaultSchema.attributes?.div || []), ['align', /^(left|center|right)$/], 'style', 'className', 'class'],
    h1: [...(defaultSchema.attributes?.h1 || []), 'id', 'className', 'class'],
    h2: [...(defaultSchema.attributes?.h2 || []), 'id', 'className', 'class'],
    h3: [...(defaultSchema.attributes?.h3 || []), 'id', 'className', 'class'],
    h4: [...(defaultSchema.attributes?.h4 || []), 'id', 'className', 'class'],
    h5: [...(defaultSchema.attributes?.h5 || []), 'id', 'className', 'class'],
    h6: [...(defaultSchema.attributes?.h6 || []), 'id', 'className', 'class'],
    a: [...(defaultSchema.attributes?.a || []), 'className', 'class'],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https', '/'],
    href: ['http', 'https', 'mailto', '/', '#'],
  },
  tagNames: [...(defaultSchema.tagNames || []), 'span', 'div', 'u'],
};

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeSlug)
  .use(rehypeStringify);

/**
 * Static HTML for an {{emoticon:...}} token: the same image the app's
 * <Emoticon> component shows, so the emoticon gallery keeps its previews in
 * the crawler HTML instead of degrading to empty table cells. Unknown
 * emoticons render nothing (mirrors the component's "unknown" branch).
 *
 * @param {string} ref - id or name from the token
 * @returns {string} <img> markup or ''
 */
function renderEmoticonToken(ref) {
  const emoticon = resolveEmoticon(ref);
  if (!emoticon) return '';
  const src = `${CONTENT_IMAGE_PREFIX}${emoticonImagePath(emoticon.id)}`;
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(emoticon.name)} emoticon" class="inline-image" width="32" height="32" style="display:inline-block;vertical-align:middle" />`;
}

/**
 * Strip custom renderer tokens like {{AD:contentTop}}, {{home:hero}},
 * {{data:spirits:6}} - these only mean something to the client-side renderer
 * registry and must not leak into crawler HTML. {{emoticon:...}} tokens are
 * the exception: they become the same <img> the app renders.
 */
function stripRendererTokens(markdown) {
  // Preserve tokens inside fenced code blocks and inline code spans: pages
  // like meta/guidelines.md document the {{...}} syntax as code examples,
  // and stripping there would gut the documentation in the crawler view.
  // Handles ``` / ~~~ fences plus ``...`` and `...` inline spans; split()
  // with a capture group returns the code segments at odd indices.
  const parts = markdown.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|``(?:(?!``)[^\n])*``|`[^`\n]*`)/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        // Same shape the app's content processor accepts: optional whitespace
        // and an optional ":size" suffix ({{emoticon:Cheer:medium}}); only the
        // id/name reaches the resolver.
        .replace(/\{\{\s*emoticon:\s*([^:}]+?)\s*(?::\s*[^}]*?)?\s*\}\}/gi, (_m, ref) => renderEmoticonToken(ref))
        .replace(/\{\{[^{}]*\}\}/g, '');
    })
    .join('');
}

async function renderMarkdown(markdown) {
  const cleaned = stripRendererTokens(markdown);
  const file = await markdownProcessor.process(cleaned);
  return String(file);
}

/**
 * Rewrite `<img src="/images/content/...">` to the CDN URL the running app
 * resolves the same path to. Without the app there is nothing at
 * /images/content/* except the SPA catch-all, so every image in the crawler
 * HTML would be an HTML document.
 *
 * @param {string} html - Rendered article HTML
 * @param {Object|null} gameAssets - `features.gameAssets` from wiki-config.json
 * @param {string} [servingMode] - 'raw' (default) or 'jsdelivr'
 */
function rewriteContentImageUrls(html, gameAssets, servingMode = CRAWLER_IMAGE_SERVING_MODE) {
  if (!html || !gameAssets?.enabled) return html;
  return html.replace(/(<img\b[^>]*?\bsrc=)(["'])([^"']*)\2/gi, (match, prefix, quote, src) => {
    if (!src.startsWith(CONTENT_IMAGE_PREFIX)) return match;
    const cdnUrl = buildCdnImageUrl(src, gameAssets, servingMode);
    return cdnUrl ? `${prefix}${quote}${cdnUrl}${quote}` : match;
  });
}

/**
 * Read the root wiki-config.json (the source of truth; public/ is a copy).
 *
 * Fatal when missing or unparseable: without it no image is rewritten to the
 * CDN and no editor/history stub is emitted, which is a broken crawler build
 * that must not ship with a green exit code.
 *
 * @param {string} [file=ROOT_CONFIG_FILE] - Injectable for tests
 */
function loadWikiConfig(file = ROOT_CONFIG_FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${path.relative(path.join(__dirname, '..'), file)} (${error.message}) - the prerender cannot rewrite images to the CDN or emit editor/history stubs without it.`);
  }
}

/**
 * Reduce a markdown body to plain text (for meta-description fallbacks).
 */
function extractPlainText(markdown) {
  let text = stripRendererTokens(markdown);
  text = text.replace(/```[\s\S]*?```/g, ' ');           // fenced code blocks
  text = text.replace(/`[^`]*`/g, ' ');                   // inline code
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');      // images
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');    // links -> label
  text = text.replace(/<[^>]+>/g, ' ');                   // raw HTML tags
  text = text.replace(/^#{1,6}\s+/gm, '');                // heading markers
  text = text.replace(/^\s*[-*+]\s+/gm, '');              // list markers
  text = text.replace(/^\s*\d+\.\s+/gm, '');              // ordered list markers
  text = text.replace(/^\s*>\s?/gm, '');                  // blockquotes
  text = text.replace(/^\s*\|.*\|\s*$/gm, ' ');           // table rows
  text = text.replace(/[*_~]+/g, '');                     // emphasis markers
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function truncateDescription(text, maxLength = DESCRIPTION_MAX_LENGTH) {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : maxLength).trimEnd()}...`;
}

// ---------------------------------------------------------------------------
// Route enumeration (mirrors scripts/generate-sitemap.js)
// ---------------------------------------------------------------------------

function getMdFiles(dir, fileList = [], baseDir = dir) {
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getMdFiles(filePath, fileList, baseDir);
    } else if (file.endsWith('.md')) {
      fileList.push({ path: path.relative(baseDir, filePath), fullPath: filePath });
    }
  }
  return fileList;
}

/**
 * Convert a content-relative file path to a route.
 * section/page.md -> /section/page ; section/index.md -> /section ; home.md -> /
 */
function pathToRoute(filePath) {
  let url = filePath.replace(/\.md$/, '').replace(/\\/g, '/');
  url = url.replace(/^(home|index)$/, '');          // root home.md / index.md -> /
  url = url.replace(/\/(home|index)$/, '');         // section index pages
  return url === '' ? '/' : `/${url}`;
}

function routeToOutputFile(route) {
  // Flat <route>.html, NOT <route>/index.html: Cloudflare Pages serves
  // /foo directly from foo.html (200), but 308-redirects /foo -> /foo/ when
  // the content lives at foo/index.html - which would put a redirect in
  // front of every canonical/sitemap URL (all slash-less). Verified against
  // wrangler pages dev: flat files serve 200 and /foo/ collapses to /foo.
  const relative = route.replace(/^\//, '').replace(/\//g, path.sep);
  return path.join(DIST_DIR, `${relative}.html`);
}

// ---------------------------------------------------------------------------
// HTML template manipulation
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// All replacements below use function form: with a string replacement,
// user-derived text containing $&, $', $1... would expand as special
// replace patterns and silently corrupt the page (escapeHtml keeps $).
function setTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`);
}

/** Replace the content="" of a <meta> matched by name= or property=. */
function setMetaContent(html, attr, key, value) {
  const escaped = escapeHtml(value);
  // key attribute before content (the template's ordering)
  const before = new RegExp(`(<meta[^>]*\\b${attr}="${key}"[^>]*\\bcontent=")[^"]*(")`);
  if (before.test(html)) return html.replace(before, (_m, p1, p2) => `${p1}${escaped}${p2}`);
  // content before key attribute (defensive - not the template's ordering)
  const after = new RegExp(`(<meta[^>]*\\bcontent=")[^"]*("[^>]*\\b${attr}="${key}")`);
  if (after.test(html)) return html.replace(after, (_m, p1, p2) => `${p1}${escaped}${p2}`);
  return html;
}

function insertBeforeHeadClose(html, snippet) {
  return html.replace('</head>', () => `${snippet}\n  </head>`);
}

function extractPublisher(templateHtml) {
  const blocks = templateHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  for (const block of blocks) {
    try {
      const json = JSON.parse(block.replace(/<\/?script[^>]*>/g, ''));
      if (json && json.publisher) return json.publisher;
    } catch {
      // ignore unparseable blocks
    }
  }
  return FALLBACK_PUBLISHER;
}

function buildArticleJsonLd({ title, description, canonicalUrl, publisher }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url: canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    publisher,
  };
  // <-escape so "</script>" can never appear inside the JSON payload
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n    </script>`;
}

/**
 * Minimal, self-contained typography for the pre-hydration article paint.
 * Scoped to .sl-prerender, which React removes when it renders the app, so
 * none of this leaks into the hydrated UI. Light/dark follow the OS scheme
 * using the app's palette (blue #3b82f6 accents, slate dark background).
 */
const PRERENDER_STYLE = `<style id="sl-prerender-style">
      .sl-prerender{min-height:100vh;background:#f9fafb;color:#1f2937;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
      .sl-prerender article{max-width:48rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}
      .sl-prerender h1,.sl-prerender h2,.sl-prerender h3,.sl-prerender h4{line-height:1.3;font-weight:700;margin:2rem 0 .75rem}
      .sl-prerender h1{font-size:1.875rem;margin-top:0}
      .sl-prerender h2{font-size:1.5rem}
      .sl-prerender h3{font-size:1.25rem}
      .sl-prerender p,.sl-prerender ul,.sl-prerender ol{margin:0 0 1rem}
      .sl-prerender ul,.sl-prerender ol{padding-left:1.5rem}
      .sl-prerender li{margin:.25rem 0}
      .sl-prerender a{color:#2563eb;text-decoration:none}
      .sl-prerender a:hover{text-decoration:underline}
      .sl-prerender .sl-lead{color:#4b5563;font-size:1.0625rem;margin-bottom:1.5rem}
      .sl-prerender table{border-collapse:collapse;width:100%;margin:0 0 1.25rem;display:block;overflow-x:auto}
      .sl-prerender th,.sl-prerender td{border:1px solid #e5e7eb;padding:.5rem .75rem;text-align:left}
      .sl-prerender th{background:#f3f4f6;font-weight:600}
      .sl-prerender img{max-width:100%;height:auto}
      .sl-prerender code{background:#f3f4f6;border-radius:4px;padding:.125rem .375rem;font-size:.9em}
      .sl-prerender pre{background:#1e293b;color:#e2e8f0;border-radius:8px;padding:1rem;overflow-x:auto;margin:0 0 1.25rem}
      .sl-prerender pre code{background:transparent;padding:0}
      .sl-prerender blockquote{border-left:4px solid #3b82f6;margin:0 0 1rem;padding:.25rem 0 .25rem 1rem;color:#4b5563}
      .sl-prerender hr{border:none;border-top:1px solid #e5e7eb;margin:2rem 0}
      @media (prefers-color-scheme:dark){
        .sl-prerender{background:#0f172a;color:#e2e8f0}
        .sl-prerender span[class*="text-"],.sl-prerender h1 span,.sl-prerender h2 span,.sl-prerender h3 span{color:inherit}
        .sl-prerender a{color:#60a5fa}
        .sl-prerender .sl-lead{color:#94a3b8}
        .sl-prerender th,.sl-prerender td{border-color:#334155}
        .sl-prerender th{background:#1e293b}
        .sl-prerender code{background:#1e293b}
        .sl-prerender blockquote{color:#94a3b8}
        .sl-prerender hr{border-top-color:#334155}
      }
    </style>`;

/**
 * Build the article shell injected into <div id="root">.
 * Adds an <h1> for the page title unless the body already opens with an
 * identical heading (same de-duplication the app's PageViewer performs).
 */
function buildArticleShell({ title, description, bodyHtml }) {
  const normalizedTitle = String(title || '').trim().toLowerCase();
  const firstHeading = bodyHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const firstHeadingText = firstHeading
    ? firstHeading[1].replace(/<[^>]+>/g, '').trim().toLowerCase()
    : null;
  const includeTitleHeading = normalizedTitle && firstHeadingText !== normalizedTitle;

  const parts = ['<main class="sl-prerender"><article>'];
  if (includeTitleHeading) parts.push(`<h1>${escapeHtml(title)}</h1>`);
  if (description) parts.push(`<p class="sl-lead">${escapeHtml(description)}</p>`);
  parts.push(bodyHtml);
  parts.push('</article></main>');
  return parts.join('\n');
}

function injectIntoRoot(html, articleShell) {
  const rootPattern = /(<div id="root">)([\s\S]*?)(<\/div>)/;
  if (!rootPattern.test(html)) {
    throw new Error('Template does not contain <div id="root"> - cannot inject prerendered content');
  }
  return html.replace(rootPattern, (_m, open, _existing, close) => `${open}${articleShell}${close}`);
}

/**
 * Produce a full prerendered document for one route from the pristine template.
 */
function buildRouteHtml(template, publisher, page) {
  const { route, title, description, bodyHtml, noindex, keywords, canonical } = page;
  const toUrl = (r) => (r === '/' ? `${SITE_URL}/` : `${SITE_URL}${r}`);
  // og:url names the route's own address. The canonical link is only emitted
  // on indexable documents: a noindex stub with a canonical elsewhere (its
  // content page, the section it belongs to) sends two contradictory
  // signals, so the stub's `canonical` field documents the relationship for
  // the build report and nothing else.
  const pageUrl = toUrl(route);
  const canonicalUrl = toUrl(canonical || route);
  const fullTitle = title ? `${title} | ${SITE_TITLE}` : SITE_TITLE;

  let html = template;
  html = setTitle(html, fullTitle);
  html = setMetaContent(html, 'name', 'description', description);
  html = setMetaContent(html, 'property', 'og:title', fullTitle);
  html = setMetaContent(html, 'property', 'og:description', description);
  html = setMetaContent(html, 'property', 'og:url', pageUrl);
  html = setMetaContent(html, 'name', 'twitter:title', fullTitle);
  html = setMetaContent(html, 'name', 'twitter:description', description);
  if (keywords && keywords.length > 0) {
    html = setMetaContent(html, 'name', 'keywords', keywords.join(', '));
  }

  const headParts = [];
  if (noindex) {
    headParts.push('    <meta name="robots" content="noindex" />');
  } else {
    headParts.push(`    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
  }
  headParts.push(`    ${buildArticleJsonLd({ title: fullTitle, description, canonicalUrl: noindex ? pageUrl : canonicalUrl, publisher })}`);
  headParts.push(`    ${PRERENDER_STYLE}`);
  html = insertBeforeHeadClose(html, headParts.join('\n'));

  const articleShell = buildArticleShell({ title, description, bodyHtml });
  html = injectIntoRoot(html, articleShell);
  return html;
}

// ---------------------------------------------------------------------------
// Page collection
// ---------------------------------------------------------------------------

async function collectContentPages(gameAssets = null) {
  const pages = [];
  const mdFiles = getMdFiles(CONTENT_DIR);
  for (const file of mdFiles) {
    const raw = fs.readFileSync(file.fullPath, 'utf8');
    const { data, content } = matter(raw);
    const route = pathToRoute(file.path);
    const title = data.title || path.basename(file.path, '.md');
    const description = data.description
      ? truncateDescription(String(data.description).trim(), 300)
      : truncateDescription(extractPlainText(content));
    const noindex = data.noindex === true || data.robots === 'noindex' || data.draft === true;
    const keywords = Array.isArray(data.tags) ? data.tags.map(String) : null;
    const bodyHtml = rewriteContentImageUrls(await renderMarkdown(content), gameAssets);
    pages.push({ route, title, description, bodyHtml, noindex, keywords, kind: 'content' });
  }
  return pages;
}

/**
 * Noindex stubs for the app screens every content page links to - its
 * editor and its history - and for each section's "new page" route. Without
 * a file at these routes the SPA catch-all answers them with the homepage
 * HTML (200, canonical "/"), and crawlers that follow the links index them
 * as copies of the homepage.
 *
 * @param {Array} contentPages - from collectContentPages()
 * @param {Array<{path: string, title?: string}>} sections - wiki-config sections
 */
function collectUtilityRouteStubs(contentPages, sections) {
  const stubs = [];
  const stub = (route, title, description, canonical) => ({
    route,
    title,
    description,
    bodyHtml: `<p>${escapeHtml(description)} This screen is interactive and requires JavaScript to use.</p>`,
    noindex: true,
    keywords: null,
    kind: 'stub',
    canonical,
  });

  for (const page of contentPages) {
    // Only /<section>/<page> routes have editor and history screens.
    const segments = page.route.split('/').filter(Boolean);
    if (segments.length !== 2) continue;
    stubs.push(stub(`${page.route}/edit`, `Edit: ${page.title}`, `Edit the "${page.title}" page in the wiki editor.`, page.route));
    stubs.push(stub(`${page.route}/history`, `History: ${page.title}`, `Revision history of the "${page.title}" page.`, page.route));

    // Old deep links (/characters/stats) get a stub pointing at the current page.
    for (const [legacyPath, currentPath] of Object.entries(LEGACY_SECTION_ALIASES)) {
      if (segments[0] !== currentPath) continue;
      stubs.push(stub(`/${legacyPath}/${segments[1]}`, page.title, `This address has moved to "${page.title}".`, page.route));
    }
  }

  for (const section of sections || []) {
    if (!section?.path) continue;
    const sectionTitle = section.title || section.path;
    stubs.push(stub(`/${section.path}/new`, `New page in ${sectionTitle}`, `Create a new page in the ${sectionTitle} section.`, `/${section.path}`));
  }

  return stubs;
}

async function collectPrerenderDataPages(gameAssets = null) {
  if (!fs.existsSync(PRERENDER_DATA_DIR)) {
    console.warn(`⚠️  ${path.relative(path.join(__dirname, '..'), PRERENDER_DATA_DIR)} not found - skipping static/tool route prerendering (utility stubs are still emitted).`);
    return [];
  }
  const pages = [];
  const files = fs.readdirSync(PRERENDER_DATA_DIR).filter((f) => f.endsWith('.md')).sort();
  for (const file of files) {
    const fullPath = path.join(PRERENDER_DATA_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(raw);
    if (!data.route || !data.title) {
      console.warn(`⚠️  ${file}: missing required frontmatter (route, title) - skipped`);
      continue;
    }
    if (!SAFE_ROUTE_PATTERN.test(String(data.route))) {
      console.warn(`⚠️  ${file}: route "${data.route}" is not a plain /slug[/slug] path - skipped`);
      continue;
    }
    const description = data.description
      ? truncateDescription(String(data.description).trim(), 300)
      : truncateDescription(extractPlainText(content));
    const bodyHtml = rewriteContentImageUrls(await renderMarkdown(content), gameAssets);
    pages.push({
      route: String(data.route),
      title: String(data.title),
      description,
      bodyHtml,
      noindex: data.robots === 'noindex',
      keywords: Array.isArray(data.tags) ? data.tags.map(String) : null,
      kind: 'static',
    });
  }
  return pages;
}

function collectUtilityStubs() {
  return UTILITY_STUB_ROUTES.map(({ route, title, description, canonical }) => ({
    route,
    title,
    description,
    bodyHtml: `<p>${escapeHtml(description)} This page is interactive and requires JavaScript to use.</p>`,
    noindex: true,
    keywords: null,
    kind: 'stub',
    canonical: canonical || null,
  }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function prerender() {
  console.log('🖨️  Prerendering routes into dist/...\n');

  if (!fs.existsSync(TEMPLATE_FILE)) {
    console.error(`❌ ${TEMPLATE_FILE} not found - run the Vite build first.`);
    process.exit(1);
  }
  const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  if (!/<div id="root">/.test(template)) {
    console.error('❌ dist/index.html does not contain <div id="root"> - aborting.');
    process.exit(1);
  }
  if (template.includes('sl-prerender-style')) {
    console.error('❌ dist/index.html is already prerendered (sl-prerender-style found). Re-running would duplicate injected meta - run a fresh build first (npm run build).');
    process.exit(1);
  }
  const publisher = extractPublisher(template);
  const wikiConfig = loadWikiConfig();
  const gameAssets = wikiConfig?.features?.gameAssets || null;

  const contentPages = await collectContentPages(gameAssets);
  const staticPages = await collectPrerenderDataPages(gameAssets);
  const stubPages = [
    ...collectUtilityStubs(),
    ...collectUtilityRouteStubs(contentPages, wikiConfig?.sections || []),
  ];

  const emitted = [];
  const seenRoutes = new Set();
  let contentEmitted = 0;
  let homepagePatched = false;

  // Priority: content pages, then curated static/tool pages, then stubs.
  for (const page of [...contentPages, ...staticPages, ...stubPages]) {
    if (seenRoutes.has(page.route)) {
      console.warn(`⚠️  Duplicate route ${page.route} (${page.kind}) - keeping the first emission`);
      continue;
    }
    seenRoutes.add(page.route);

    if (page.route === '/') {
      // Homepage: patch dist/index.html in place - inject the article and
      // canonical/style, but keep the template's own meta, scripts and
      // asset links untouched.
      let html = template;
      const headParts = [
        `    <link rel="canonical" href="${SITE_URL}/" />`,
        `    ${PRERENDER_STYLE}`,
      ];
      html = insertBeforeHeadClose(html, headParts.join('\n'));
      html = injectIntoRoot(html, buildArticleShell({
        // Crawlers need an <h1> on the homepage; home.md's body has none
        // (the app's hero carries the visual title, and React replaces
        // this prerendered shell on load anyway). Deliberate divergence:
        // home.md sets `hideHeader: true` to stop PageViewer stacking a
        // second title above that hero, but the prerenderer ignores the
        // flag - the crawler view has no hero component, so dropping the
        // h1 here would leave the homepage headingless for Googlebot.
        title: SITE_TITLE,
        description: null,
        bodyHtml: page.bodyHtml,
      }));
      fs.writeFileSync(TEMPLATE_FILE, html, 'utf8');
      emitted.push({ route: '/', bytes: Buffer.byteLength(html), kind: page.kind });
      if (page.kind === 'content') contentEmitted++;
      homepagePatched = true;
      continue;
    }

    const html = buildRouteHtml(template, publisher, page);
    const outputFile = routeToOutputFile(page.route);
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, html, 'utf8');
    emitted.push({ route: page.route, bytes: Buffer.byteLength(html), kind: page.kind });
    if (page.kind === 'content') contentEmitted++;
  }

  // Summary
  console.log('Route'.padEnd(42) + 'Kind'.padEnd(10) + 'Bytes');
  console.log('-'.repeat(62));
  for (const e of emitted.sort((a, b) => a.route.localeCompare(b.route))) {
    console.log(e.route.padEnd(42) + e.kind.padEnd(10) + e.bytes.toLocaleString());
  }
  const totalBytes = emitted.reduce((sum, e) => sum + e.bytes, 0);
  console.log('-'.repeat(62));
  console.log(`Total: ${emitted.length} routes (${contentEmitted} content, ${staticPages.length} static, ${stubPages.length} stubs), ${(totalBytes / 1024).toFixed(1)} KB`);
  if (!homepagePatched) {
    console.warn('⚠️  No home.md found - dist/index.html was left untouched.');
  }

  if (contentEmitted === 0) {
    console.error('\n❌ Zero content routes were prerendered - failing the build.');
    process.exit(1);
  }
  console.log('\n✅ Prerender complete.');
}

// Run only when executed directly (node scripts/prerender.js); importing the
// module (e.g. from tests) must not trigger a prerender.
const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectExecution) {
  prerender().catch((error) => {
    console.error('❌ Prerender failed:', error);
    process.exit(1);
  });
}

// Pure helpers exported for unit tests.
export {
  loadWikiConfig,
  LEGACY_SECTION_ALIASES,
  SAFE_ROUTE_PATTERN,
  pathToRoute,
  routeToOutputFile,
  stripRendererTokens,
  extractPlainText,
  truncateDescription,
  escapeHtml,
  setTitle,
  setMetaContent,
  insertBeforeHeadClose,
  buildArticleShell,
  buildRouteHtml,
  rewriteContentImageUrls,
  collectUtilityRouteStubs,
  collectUtilityStubs,
  renderEmoticonToken,
  CRAWLER_IMAGE_SERVING_MODE,
  PRERENDER_DATA_DIR,
};
