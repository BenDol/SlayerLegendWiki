/**
 * Contract tests for src/styles/custom.css
 *
 * custom.css overrides framework markup from the parent project rather than
 * editing the wiki-framework submodule. That keeps the architectural boundary
 * intact, but it means the overrides are only coupled to the framework by
 * selector text and asset URLs - nothing fails to build when either side
 * drifts. These tests turn both couplings into build failures.
 */

import { describe, it, expect } from 'vitest';
import resolveConfig from 'tailwindcss/resolveConfig.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const CUSTOM_CSS = path.join(ROOT, 'src/styles/custom.css');
const PUBLIC_DIR = path.join(ROOT, 'public');
const FRAMEWORK_LAYOUT = path.join(ROOT, 'wiki-framework/src/components/layout/Layout.jsx');
const FRAMEWORK_HEADER = path.join(ROOT, 'wiki-framework/src/components/layout/Header.jsx');

const css = fs.readFileSync(CUSTOM_CSS, 'utf8');

describe('custom.css asset references', () => {
  /**
   * Guards the CLS background override: the rule swaps a 3.94 MB decorative
   * background for a small one by URL alone. If the replacement asset is never
   * committed, or is later renamed, body::before 404s and every page silently
   * loses its background. Nothing else in the build catches that.
   */
  it('every root-absolute url() in custom.css resolves to a file in public/', () => {
    const urls = [...css.matchAll(/url\(\s*['"]?(\/[^'")]+)['"]?\s*\)/g)].map(m => m[1]);

    // Sanity check: the background override means there is at least one to find.
    expect(urls.length).toBeGreaterThan(0);

    const missing = urls.filter(url => {
      const relative = decodeURIComponent(url.replace(/^\//, '').split('?')[0]);
      return !fs.existsSync(path.join(PUBLIC_DIR, relative));
    });

    expect(missing).toEqual([]);
  });
});

describe('custom.css framework selector contract', () => {
  /**
   * The mobile CLS fix (`main > div.container.py-8 { min-height: 100vh }`)
   * keeps the footer below the fold so late-arriving content cannot shove it.
   * It matches the content wrapper the framework's normal Layout renders. If a
   * framework bump renames those utilities the selector stops matching, the
   * footer returns to the viewport edge, and mobile CLS regresses from ~0.002
   * back to ~0.354 with no error anywhere.
   */
  it('framework Layout still renders the content wrapper the CLS rule targets', () => {
    const layout = fs.readFileSync(FRAMEWORK_LAYOUT, 'utf8');

    // The wrapper is a <main> child carrying both literal utilities the
    // selector depends on. Interpolated classes sit between them, so assert on
    // the literal fragments rather than an exact className string.
    expect(layout).toMatch(/className=\{`flex-1 container [^`]*\bpy-8\b/);

    expect(css).toContain('main > div.container.py-8');
  });

  /**
   * The tutorial rule relies on FirstTimeTutorial hiding its unpositioned popup
   * with an inline `opacity: 0`. If that component switches to a different
   * hiding mechanism the rule becomes dead and the popup's jump to its measured
   * anchor starts scoring CLS again.
   */
  it('FirstTimeTutorial still signals "not yet positioned" via inline opacity', () => {
    const tutorial = fs.readFileSync(
      path.join(ROOT, 'wiki-framework/src/components/common/FirstTimeTutorial.jsx'),
      'utf8'
    );

    expect(tutorial).toMatch(/opacity:\s*hasPosition\s*\?\s*1\s*:\s*0/);
    expect(css).toContain("[style*='opacity: 0']");
  });

  /**
   * The full-bleed header rule (`header.sticky > div.container.mx-auto`) removes
   * the breakpoint max-width so the logo/nav group and the account group sit at
   * the edges of the sticky bar. It depends on three things staying literal in
   * the framework markup: the <header> keeping `sticky`, its direct child
   * keeping `container mx-auto`, and the row inside keeping `justify-between`
   * (without which removing the cap would just stretch a left-packed row).
   * If a framework bump changes any of them the header silently snaps back to
   * centred with dead space on both sides.
   */
  it('framework Header still renders the sticky container the full-bleed rule targets', () => {
    const header = fs.readFileSync(FRAMEWORK_HEADER, 'utf8');

    expect(header).toContain('<header className="sticky top-0 z-50 w-full');
    expect(header).toContain('<div className="container mx-auto px-2 sm:px-4"');
    expect(header).toContain('flex h-16 items-center justify-between');

    // Pin the declaration, not just the selector: leaving the rule in place but
    // giving it a finite max-width would quietly restore the centred header.
    expect(css).toMatch(
      /header\.sticky > div\.container\.mx-auto\s*\{[^}]*max-width:\s*none/
    );
  });

  /**
   * The safe-area guard deliberately does NOT restate the framework's
   * `px-2 sm:px-4`; it pads the <header> so the two stack. The framework half
   * of that coupling is already pinned by the test above, so this one only has
   * to prove our side still ships both declarations - if either is dropped the
   * bar loses its inset the moment anyone opts into an edge-to-edge viewport.
   */
  it('custom.css still ships both safe-area declarations on the header', () => {
    expect(css).toContain('padding-left: env(safe-area-inset-left');
    expect(css).toContain('padding-right: env(safe-area-inset-right');
  });
});

describe('full-bleed header responsive assumptions', () => {
  /**
   * The full-bleed rule is documented as a no-op on phones in portrait, which
   * is only true because Tailwind's `container` has no max-width below its
   * first breakpoint. Two config changes would break that silently: defining a
   * `theme.container` (which can add `padding`/`center` behaviour and, with a
   * `screens` key, sub-640px caps), or introducing a breakpoint below 640px -
   * either would start capping the header on phones, where the rule then
   * really does change the layout rather than leaving it alone.
   */
  it('project Tailwind config caps the container no earlier than 640px', async () => {
    const { default: config } = await import('../tailwind.config.js');

    // resolveConfig applies Tailwind's own default-merging, so this asserts on
    // the breakpoints the build will actually compile rather than on a copy of
    // the defaults kept here - a copy would keep passing if Tailwind's own
    // defaults moved underneath us.
    const { theme } = resolveConfig(config);

    // An empty object is the resolved form of "no container customisation".
    expect(Object.keys(theme.container ?? {})).toEqual([]);

    const minWidths = Object.values(theme.screens)
      .map(v => (typeof v === 'string' ? v : v?.min))
      .filter(v => typeof v === 'string' && v.endsWith('px'))
      .map(v => parseInt(v, 10));

    expect(minWidths.length).toBeGreaterThan(0);
    expect(Math.min(...minWidths)).toBeGreaterThanOrEqual(640);
  });
});

describe('mobile overflow contract', () => {
  /**
   * The single most consequential rule in custom.css: the footer's link row is
   * 507px of non-wrapping flex on a 393px phone, and that one overflow makes
   * Chrome shrink-to-fit the *entire document* to 87%, shortens every `vh`-sized
   * box and leaves the `w-full` header ending before the right edge of the page.
   * Nothing in the build notices a 57px overflow, so pin both halves: that the
   * framework still renders the row these rules target, and that our side still
   * both wraps it and cancels the `space-x-6` margins (wrapping alone leaves an
   * orphan 24px indent at the start of every new line).
   */
  it('framework Footer still renders the link row the wrap rule targets', () => {
    const footer = fs.readFileSync(
      path.join(ROOT, 'wiki-framework/src/components/layout/Footer.jsx'),
      'utf8'
    );

    expect(footer).toContain('<div className="flex items-center space-x-6">');

    expect(css).toMatch(
      /footer div\.flex\.items-center\.space-x-6\s*\{[^}]*flex-wrap:\s*wrap/
    );
    expect(css).toMatch(
      /footer div\.flex\.items-center\.space-x-6 > :not\(\[hidden\]\) ~ :not\(\[hidden\]\)\s*\{[^}]*margin-left:\s*0/
    );
  });

  /**
   * Between `md` and `lg` the header carries the desktop nav *and* the mobile
   * hamburger, which overflows a 768px viewport by 172px - the same shrink-to-fit
   * failure as above, on tablets and on every phone held in landscape. The two
   * rules that recover the space depend on the framework still rendering the
   * duplicated `sidebar.pages` links as `nav > a`, and on the labels/shortcut
   * hints still being the `md:inline` class rather than something else.
   */
  it('framework Header still renders the nav links and md:inline labels the rules target', () => {
    const header = fs.readFileSync(FRAMEWORK_HEADER, 'utf8');
    const searchBar = fs.readFileSync(
      path.join(ROOT, 'wiki-framework/src/components/search/SearchBar.jsx'),
      'utf8'
    );

    // The links hidden below `lg` are <Link> children of the header <nav>.
    expect(header).toContain('<nav className="hidden md:flex items-center space-x-1">');
    expect(header).toMatch(/config\.sidebar\?\.pages[\s\S]{0,200}<Link/);

    // ...and they are only safe to hide because Sidebar renders the same
    // entries below `lg`. If that `lg:hidden` duplication ever goes away, the
    // header rule starts removing the only route to those pages.
    const sidebar = fs.readFileSync(
      path.join(ROOT, 'wiki-framework/src/components/layout/Sidebar.jsx'),
      'utf8'
    );
    expect(sidebar).toContain("page.showInHeader === false ? '' : 'lg:hidden'");

    // The labels and the Ctrl+K hint carry the class the rule selects on.
    expect(header).toContain('<span className="hidden md:inline text-sm">Data</span>');
    expect(searchBar).toContain('<span className="hidden md:inline text-sm">Search</span>');
    expect(searchBar).toMatch(/<kbd className="hidden md:inline/);

    expect(css).toMatch(/header\.sticky nav > a\s*\{[^}]*display:\s*none/);
    // The Tailwind class contains a colon, which has to reach the stylesheet
    // backslash-escaped - so the literal being matched here is `.md\:inline`.
    expect(css).toMatch(/header\.sticky \.md\\:inline\s*\{[^}]*display:\s*none/);
  });

  /**
   * The Tools dropdown is deliberately NOT hidden with the rest of the header
   * nav, because FirstTimeTutorial anchors its popup to that button by ref for
   * any viewport >= 768px and a `display: none` anchor measures as a zero rect.
   * If the framework ever moves that anchor (or its 768px mobile cutoff) the
   * reasoning in custom.css goes stale and the Tools button could be hidden too.
   */
  it('FirstTimeTutorial still anchors to the Tools button above 768px', () => {
    const header = fs.readFileSync(FRAMEWORK_HEADER, 'utf8');

    expect(header).toContain('setIsMobile(window.innerWidth < 768)');
    expect(header).toContain('targetRef={isMobile ? hamburgerButtonRef : toolsButtonRef}');

    // The rule set must keep selecting `nav > a` rather than the whole <nav>.
    expect(css).not.toMatch(/header\.sticky nav\s*\{[^}]*display:\s*none/);
  });
});

describe('mobile navigation drawer contract', () => {
  /**
   * Every drawer rule keys off `aside.fixed` and off framework class names that
   * only exist as literals in Sidebar.jsx. The height override in particular
   * *replaces* `h-[calc(100vh-4rem)]`; if the framework switches to `dvh` or to
   * `inset-y` on its own, our `bottom: 0` still wins and could fight it, so this
   * test is as much a "come back and re-read the comment" trigger as a guard.
   */
  it('framework Sidebar still renders the positioned aside the drawer rules target', () => {
    const sidebar = fs.readFileSync(
      path.join(ROOT, 'wiki-framework/src/components/layout/Sidebar.jsx'),
      'utf8'
    );

    // Positioning + the vh height our rules replace.
    expect(sidebar).toMatch(/fixed lg:sticky top-16 left-0 z-40 h-\[calc\(100vh-4rem\)\]/);

    // Width arrives as an inline style, which is why width is the one
    // declaration in the block that needs !important.
    expect(sidebar).toMatch(/style=\{\{\s*width:/);
    expect(css).toMatch(/width:\s*min\(86vw,\s*22rem\)\s*!important/);

    // Row selectors: leaf links, section toggles, and the add button that
    // `:not(.absolute)` exists to exclude.
    expect(sidebar).toContain('<nav className="p-4 space-y-1">');
    expect(sidebar).toMatch(/flex items-center gap-2 py-2 px-3 text-sm rounded-lg/);
    expect(sidebar).toMatch(/w-full flex items-center gap-2 py-2 px-3 text-sm[^"]*pr-10/);
    expect(sidebar).toMatch(/className="absolute right-2 top-1\/2 -translate-y-1\/2 z-10 p-1\.5/);

    // The emoji icon span the rules scale up.
    expect(sidebar).toContain('<span className="text-base flex-shrink-0">{icon}</span>');

    // The pointer-only drag strip the rules hide.
    expect(sidebar).toMatch(/className="absolute top-0 w-2 h-full cursor-col-resize/);
  });

  /**
   * Both mobile blocks are written as `max-width: 1023.98px`, which is only the
   * complement of Tailwind's `lg` while `lg` is 1024px - and `lg` is the
   * breakpoint the framework itself flips the sidebar's behaviour on. Move the
   * breakpoint and the drawer styling either bleeds into the desktop sticky
   * column or stops applying to a band of the drawer's own range, silently.
   */
  it('project Tailwind config still puts lg at 1024px', async () => {
    const { default: config } = await import('../tailwind.config.js');
    const { theme } = resolveConfig(config);

    expect(theme.screens.lg).toBe('1024px');
    expect(css).toContain('@media (max-width: 1023.98px)');
  });
});
