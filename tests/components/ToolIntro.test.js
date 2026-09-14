/**
 * ToolIntro - the markdown preparation that lets one copy file serve both
 * the prerendered crawler HTML (full document) and the intro under a tool
 * (nested under the tool's own H1).
 */

import { describe, it, expect, vi } from 'vitest';

// Keep the markdown pipeline and the game renderers out of a pure-function test.
vi.mock('../../wiki-framework/src/components/wiki/PageViewer.jsx', () => ({ default: () => null }));
vi.mock('../../src/utils/gameContentRenderer.jsx', () => ({ processGameSyntax: (x) => x, getGameComponents: () => ({}) }));

const { prepareIntroMarkdown, getToolCopy } = await import('../../src/components/ToolIntro.jsx');

describe('prepareIntroMarkdown', () => {
  it('drops a leading H1 that repeats the page title', () => {
    expect(prepareIntroMarkdown('# Skill Builder\n\nIntro text.', 'Skill Builder')).toBe('Intro text.');
  });

  it('matches the title case-insensitively and through inline HTML', () => {
    expect(prepareIntroMarkdown('# <span class="x">skill builder</span>\n\nBody.', 'Skill Builder')).toBe('Body.');
  });

  it('keeps an H1 that is not the title, demoted like every other heading', () => {
    expect(prepareIntroMarkdown('# Something else\n\n## Sub', 'Skill Builder')).toBe('## Something else\n\n### Sub');
  });

  it('demotes every heading one level so the intro nests under the tool H1', () => {
    const out = prepareIntroMarkdown('## How it works\n\ntext\n\n### Details\n\n#### Deeper', 'T');
    expect(out).toBe('### How it works\n\ntext\n\n#### Details\n\n##### Deeper');
  });

  it('clamps at H6 rather than producing a seven-hash non-heading', () => {
    expect(prepareIntroMarkdown('###### Six', 'T')).toBe('###### Six');
  });

  it('leaves fenced code blocks untouched, including lines that look like headings', () => {
    const md = '## Usage\n\n```md\n# not a heading\n## still not\n```\n\n~~~\n# also code\n~~~\n\n## After';
    const out = prepareIntroMarkdown(md, 'T');
    expect(out).toContain('### Usage');
    expect(out).toContain('```md\n# not a heading\n## still not\n```');
    expect(out).toContain('~~~\n# also code\n~~~');
    expect(out).toContain('### After');
  });

  it('only strips the first matching H1', () => {
    const out = prepareIntroMarkdown('# Tool\n\ntext\n\n# Tool', 'Tool');
    expect(out).toBe('text\n\n## Tool');
  });

  it('returns an empty string for empty input and trims leading blank lines', () => {
    expect(prepareIntroMarkdown('', 'T')).toBe('');
    expect(prepareIntroMarkdown(null, 'T')).toBe('');
    expect(prepareIntroMarkdown('# T\n\n\n\nBody', 'T')).toBe('Body');
  });
});

describe('getToolCopy', () => {
  it('returns the raw markdown for a tool route and null for an unknown one', () => {
    const copy = getToolCopy('skill-builder');
    expect(typeof copy).toBe('string');
    expect(copy).toMatch(/^---\s*\nroute: \/skill-builder/);
    expect(getToolCopy('no-such-tool')).toBeNull();
    expect(getToolCopy('')).toBeNull();
    expect(getToolCopy(undefined)).toBeNull();
  });
});
