import { describe, it, expect } from 'vitest';
import path from 'path';
import {
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
} from '../scripts/prerender.js';

describe('pathToRoute', () => {
  it('maps section pages to /section/page', () => {
    expect(pathToRoute('progression/leveling.md')).toBe('/progression/leveling');
  });

  it('maps section index.md to the section root', () => {
    expect(pathToRoute('skills/index.md')).toBe('/skills');
  });

  it('maps root home.md to /', () => {
    expect(pathToRoute('home.md')).toBe('/');
  });

  it('normalizes Windows path separators', () => {
    expect(pathToRoute('meta\\about.md')).toBe('/meta/about');
  });

  it('matches the sitemap mapping for nested index pages', () => {
    expect(pathToRoute('getting-started/index.md')).toBe('/getting-started');
    expect(pathToRoute('skills/skills.md')).toBe('/skills/skills');
  });
});

describe('routeToOutputFile', () => {
  it('emits flat <route>.html, not <route>/index.html', () => {
    // Cloudflare Pages serves /foo directly from foo.html (200) but
    // 308-redirects /foo -> /foo/ when content lives at foo/index.html,
    // which would put a redirect in front of every canonical URL.
    const out = routeToOutputFile('/progression/leveling');
    expect(out.endsWith(`progression${path.sep}leveling.html`)).toBe(true);
    expect(out.includes(`leveling${path.sep}index.html`)).toBe(false);
  });
});

describe('stripRendererTokens', () => {
  it('removes {{...}} renderer tokens', () => {
    expect(stripRendererTokens('a {{AD:contentTop}} b {{home:hero}} c')).toBe('a  b  c');
  });

  it('leaves normal braces and text intact', () => {
    expect(stripRendererTokens('code { x: 1 } text')).toBe('code { x: 1 } text');
  });

  it('preserves tokens inside fenced code blocks (documentation examples)', () => {
    const md = 'Use tokens:\n```markdown\n{{data:spirits:1}}\n```\n{{AD:contentTop}} after';
    expect(stripRendererTokens(md)).toBe('Use tokens:\n```markdown\n{{data:spirits:1}}\n```\n after');
  });

  it('preserves tokens inside inline code spans', () => {
    expect(stripRendererTokens('Type `{{skill:Fire Slash}}` but not {{AD:inArticle}}'))
      .toBe('Type `{{skill:Fire Slash}}` but not ');
  });

  it('preserves tokens inside double-backtick code spans', () => {
    expect(stripRendererTokens('Quote ``{{data:spirits:1}}`` but not {{AD:inArticle}}'))
      .toBe('Quote ``{{data:spirits:1}}`` but not ');
  });
});

describe('buildArticleShell', () => {
  it('adds an <h1> when a title is given and the body has none', () => {
    const shell = buildArticleShell({ title: 'Slayer Legend Wiki', description: null, bodyHtml: '<p>intro</p>' });
    expect(shell).toContain('<h1>Slayer Legend Wiki</h1>');
    expect(shell).toContain('<p>intro</p>');
  });

  it('does not duplicate the h1 when the body already opens with it', () => {
    const shell = buildArticleShell({
      title: 'Leveling Guide',
      description: null,
      bodyHtml: '<h1 id="x"><span>Leveling Guide</span></h1><p>body</p>',
    });
    expect(shell.match(/<h1/g)).toHaveLength(1);
  });
});

describe('extractPlainText / truncateDescription', () => {
  it('flattens markdown to plain text', () => {
    const text = extractPlainText('# Head\n\nSome **bold** and [a link](/x).\n\n- item');
    expect(text).toContain('Some bold and a link');
    expect(text).not.toContain('#');
    expect(text).not.toContain('](');
  });

  it('truncates on a word boundary with ellipsis', () => {
    const long = 'word '.repeat(60).trim();
    const out = truncateDescription(long, 100);
    expect(out.length).toBeLessThanOrEqual(103);
    expect(out.endsWith('...')).toBe(true);
  });
});

describe('HTML injection helpers are $-pattern safe', () => {
  // String.replace expands $&, $', $1... in string replacements; titles and
  // descriptions from frontmatter can legitimately contain them.
  const TEMPLATE = [
    '<html><head>',
    '<title>Old Title</title>',
    '<meta name="description" content="old description" />',
    '<meta property="og:title" content="old og" />',
    '</head><body><div id="root"></div></body></html>',
  ].join('\n');

  it('setTitle inserts $-sequences literally', () => {
    const out = setTitle(TEMPLATE, "Save $2.99 & more $& deals");
    // $& in a string replacement would re-insert the matched <title> tag.
    expect(out).toContain('<title>Save $2.99 &amp; more $&amp; deals</title>');
    expect(out).not.toContain('Old Title');
    expect(out.match(/<title>/g)).toHaveLength(1);
  });

  it('setMetaContent inserts $-sequences literally', () => {
    const out = setMetaContent(TEMPLATE, 'name', 'description', "Costs $1 - $2 $' worth");
    expect(out).toContain('content="Costs $1 - $2');
    expect(out).not.toContain('old description');
  });

  it('insertBeforeHeadClose keeps $-sequences literal and closes head once', () => {
    const out = insertBeforeHeadClose(TEMPLATE, '<meta name="x" content="$& $1" />');
    expect(out).toContain('content="$& $1"');
    expect(out.match(/<\/head>/g)).toHaveLength(1);
  });

  it('escapeHtml escapes quotes and angle brackets', () => {
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
  });
});
