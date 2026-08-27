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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const CUSTOM_CSS = path.join(ROOT, 'src/styles/custom.css');
const PUBLIC_DIR = path.join(ROOT, 'public');
const FRAMEWORK_LAYOUT = path.join(ROOT, 'wiki-framework/src/components/layout/Layout.jsx');

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
});
