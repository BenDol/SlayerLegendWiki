/**
 * Content integrity - the checks from the 2026-09-14 AdSense audit that a
 * content edit can silently break: dead internal links, phantom promises,
 * under-construction wording on indexed pages, unencoded image paths, and
 * text repeated across pages.
 *
 * Route knowledge is derived from the same sources the site uses (content
 * tree, wiki-config sections, main.jsx custom routes, the framework router),
 * so a new page or route needs no test change.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'public/content');
const TOOL_COPY_DIR = path.join(ROOT, 'src/content/tool-pages');

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const contentFiles = walk(CONTENT_DIR);
const toolCopyFiles = fs.existsSync(TOOL_COPY_DIR) ? walk(TOOL_COPY_DIR) : [];
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'wiki-config.json'), 'utf8'));

/**
 * Every route the site can answer with a real page, plus how many each
 * source contributed (so a source that silently stops yielding routes - a
 * renamed file, a changed literal shape - is caught rather than absorbed).
 */
function knownRoutes() {
  const routes = new Set(['/']);
  const sources = { sections: 0, contentPages: 0, mainJsx: 0, frameworkRouter: 0, toolCopy: 0 };
  for (const section of config.sections || []) {
    routes.add(`/${section.path}`);
    routes.add(`/${section.path}/new`);
    sources.sections++;
  }
  for (const file of contentFiles) {
    const id = rel(file).replace('public/content/', '').replace(/\.md$/, '');
    if (!id.includes('/')) continue;
    const [section, page] = id.split('/');
    if (page !== 'index') {
      routes.add(`/${section}/${page}`);
      routes.add(`/${section}/${page}/edit`);
      routes.add(`/${section}/${page}/history`);
      sources.contentPages++;
    }
  }
  const mainJsx = fs.readFileSync(path.join(ROOT, 'main.jsx'), 'utf8');
  for (const m of mainJsx.matchAll(/path:\s*'([^']+)'/g)) {
    routes.add('/' + m[1].replace(/\/\*$/, ''));
    sources.mainJsx++;
  }
  const router = fs.readFileSync(path.join(ROOT, 'wiki-framework/src/router.jsx'), 'utf8');
  for (const m of router.matchAll(/path:\s*'([^':*]+)'/g)) {
    routes.add('/' + m[1]);
    sources.frameworkRouter++;
  }
  for (const file of toolCopyFiles) {
    const { data } = matter(fs.readFileSync(file, 'utf8'));
    if (data.route) {
      routes.add(String(data.route));
      sources.toolCopy++;
    }
  }
  return { routes, sources };
}

function internalLinks(markdown) {
  const links = [];
  for (const m of markdown.matchAll(/\]\((\/[^)\s#?]*)[^)]*\)/g)) links.push(m[1]);
  for (const m of markdown.matchAll(/href="(\/[^"#?]*)[^"]*"/g)) links.push(m[1]);
  return links.filter((href) => !/\.(png|jpe?g|gif|webp|svg|json|md|pdf|mp4)$/i.test(href));
}

const body = (raw) => matter(raw).content;

describe('internal links', () => {
  const { routes, sources } = knownRoutes();

  it('derived routes from every source the site uses', () => {
    for (const [source, count] of Object.entries(sources)) {
      expect(count, `${source} contributed no routes`).toBeGreaterThan(0);
    }
    expect(sources.sections).toBe((config.sections || []).length);
    expect(routes.has('/getting-started/first-steps')).toBe(true); // content page
    expect(routes.has('/getting-started/first-steps/edit')).toBe(true); // derived app screen
    expect(routes.has('/skill-builder')).toBe(true); // main.jsx custom route
    expect(routes.has('/search')).toBe(true); // framework router
    expect(routes.has('/creators')).toBe(true); // tool copy frontmatter route
  });

  it('resolve to real routes from every content and tool page', () => {
    const dead = [];
    for (const file of [...contentFiles, ...toolCopyFiles]) {
      const raw = fs.readFileSync(file, 'utf8');
      for (const href of internalLinks(body(raw))) {
        const clean = href.length > 1 && href.endsWith('/') ? href.slice(0, -1) : href;
        if (!routes.has(clean)) dead.push(`${rel(file)} -> ${href}`);
      }
    }
    expect(dead).toEqual([]);
  });

  it('resolve from the config-driven navigation', () => {
    const navLinks = [
      ...(config.sidebar?.pages || []).map((p) => p.path),
      ...(config.wiki?.footerLinks || []).map((p) => p.path),
      ...(config.wiki?.tools || []).map((p) => p.path),
      ...(config.sections || []).flatMap((s) => (s.pages || []).map((p) => (typeof p === 'string' ? p : p.path))),
    ];
    const dead = navLinks.filter((href) => href && href.startsWith('/') && !routes.has(href));
    expect(dead).toEqual([]);
  });
});

describe('indexed pages do not read as under construction', () => {
  // Wording the Publisher Policies call out ("screens that are under
  // construction") and the audits found on indexed pages - including the
  // softer forms that describe a page or list as not finished yet.
  const FORBIDDEN = [
    /work in progress/i,
    /still being (?:built|written|added|migrated|populated|filled)/i,
    /coming soon/i,
    /under construction/i,
    /\bearly days\b/i,
    /starts? (?:out )?empty/i,
    /\bTODO\b/,
    /lorem ipsum/i,
    /contribution-banner:auto-generated/,
  ];

  // Tool copy is rendered on indexed tool routes (crawler HTML and the
  // hydrated view), so it is held to the same standard as content pages.
  it.each([...contentFiles, ...toolCopyFiles].map((file) => [rel(file), file]))('%s', (_id, file) => {
    const raw = fs.readFileSync(file, 'utf8');
    const { data, content } = matter(raw);
    if (data.noindex === true || data.robots === 'noindex' || data.draft === true) return;
    const hits = FORBIDDEN.filter((re) => re.test(content)).map(String);
    expect(hits).toEqual([]);
  });

  it('scans tool copy as well as content', () => {
    expect(toolCopyFiles.length).toBeGreaterThan(0);
  });
});

describe('image references', () => {
  it('never contain a literal space (crawlers do not auto-encode)', () => {
    const offenders = [];
    for (const file of [...contentFiles, ...toolCopyFiles]) {
      const raw = fs.readFileSync(file, 'utf8');
      for (const m of raw.matchAll(/<img[^>]*src="([^"]*)"/g)) if (m[1].includes(' ')) offenders.push(`${rel(file)}: ${m[1]}`);
      for (const m of raw.matchAll(/!\[[^\]]*\]\(([^)]*)\)/g)) if (m[1].includes(' ')) offenders.push(`${rel(file)}: ${m[1]}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('no paragraph is repeated across pages', () => {
  it('finds no ≥25-word paragraph on two or more pages', () => {
    const seen = new Map();
    for (const file of contentFiles) {
      const text = body(fs.readFileSync(file, 'utf8'));
      for (const para of text.split(/\n\s*\n/)) {
        const clean = para.replace(/<[^>]+>/g, ' ').replace(/\{\{[^}]*\}\}/g, ' ').replace(/\s+/g, ' ').trim();
        if (clean.startsWith('|') || clean.split(' ').length < 25) continue;
        const key = clean.toLowerCase();
        if (!seen.has(key)) seen.set(key, new Set());
        seen.get(key).add(rel(file));
      }
    }
    const repeated = [...seen.entries()].filter(([, files]) => files.size > 1).map(([k, files]) => `${[...files].join(', ')}: "${k.slice(0, 80)}..."`);
    expect(repeated).toEqual([]);
  });
});

describe('every configured section has an index page', () => {
  // A section root without index.md is not prerendered (crawlers get the SPA
  // catch-all's homepage HTML) and renders as a bare card list in the app.
  it.each((config.sections || []).map((s) => [s.path]))('/%s has public/content/%s/index.md', (sectionPath) => {
    expect(fs.existsSync(path.join(CONTENT_DIR, sectionPath, 'index.md'))).toBe(true);
  });

  it('section index pages carry at least 250 words of prose', () => {
    const thin = [];
    for (const s of config.sections || []) {
      const file = path.join(CONTENT_DIR, s.path, 'index.md');
      if (!fs.existsSync(file)) continue;
      const text = body(fs.readFileSync(file, 'utf8')).replace(/<[^>]+>/g, ' ');
      const words = text.split('\n').filter((l) => !/^\s*\|/.test(l)).join(' ').split(/\s+/).filter(Boolean).length;
      if (words < 250) thin.push(`${s.path}: ${words} words`);
    }
    expect(thin).toEqual([]);
  });
});

describe('tool routes have publisher copy', () => {
  // A tool page is any page under src/pages that renders the tool banner
  // (ToolPageAd): that is the set of interactive routes that carry ads and
  // therefore must carry publisher content. Derived, so a seventh tool page
  // cannot slip in without copy.
  const pagesDir = path.join(ROOT, 'src/pages');
  const toolPages = fs
    .readdirSync(pagesDir)
    .filter((f) => f.endsWith('.jsx'))
    .filter((f) => /<ToolPageAd\b/.test(fs.readFileSync(path.join(pagesDir, f), 'utf8')));

  it('found the tool pages by their ad banner', () => {
    expect(toolPages.length).toBeGreaterThanOrEqual(6);
    expect(toolPages).toContain('SkillBuildSimulatorPage.jsx');
  });

  it('every interactive tool page renders a ToolIntro from src/content/tool-pages', () => {
    const missing = [];
    for (const page of toolPages) {
      const source = fs.readFileSync(path.join(pagesDir, page), 'utf8');
      const m = source.match(/<ToolIntro\s+route="([^"]+)"/);
      if (!m) {
        missing.push(`${page}: no <ToolIntro>`);
        continue;
      }
      if (!fs.existsSync(path.join(TOOL_COPY_DIR, `${m[1]}.md`))) missing.push(`${page}: src/content/tool-pages/${m[1]}.md missing`);
    }
    expect(missing).toEqual([]);
  });

  it('tool copy carries at least 150 words of prose', () => {
    const thin = [];
    for (const file of toolCopyFiles) {
      const { data, content } = matter(fs.readFileSync(file, 'utf8'));
      if (data.robots === 'noindex') continue;
      const words = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
      if (words < 150) thin.push(`${rel(file)}: ${words} words`);
    }
    expect(thin).toEqual([]);
  });
});
