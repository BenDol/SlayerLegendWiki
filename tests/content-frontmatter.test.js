/**
 * Contract test for the frontmatter that pages under public/content/ may carry.
 *
 * The in-browser page editor validates frontmatter against a hardcoded allowlist and
 * pushes every other key onto its BLOCKING error list ("Unknown metadata field ..."),
 * so a page carrying a field the editor does not know can be opened but never saved.
 * Nothing else in the build notices: the page renders, prerenders and indexes fine.
 * The breakage only surfaces when a contributor tries to edit - the one moment the
 * wiki can least afford it.
 *
 * The allowlist is read out of the framework source rather than copied, so widening it
 * upstream automatically relaxes this test instead of silently contradicting it.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const EDITOR_SOURCE = path.join(ROOT, 'wiki-framework/src/components/wiki/PageEditor.jsx');
const CONTENT_DIR = path.join(ROOT, 'public/content');

/**
 * Pages that are uneditable today, with the offending field. `hideHeader` is honoured by
 * the framework's own PageViewer but was never added to the editor's allowlist, so the
 * home page cannot be saved from the editor until the framework repo widens it.
 *
 * An entry here is a recorded defect, not a licence to add more: new content must use
 * fields the editor accepts. The staleness test below deletes the excuse automatically
 * once the framework catches up.
 */
const KNOWN_UNEDITABLE = {
  'home.md': ['hideHeader'],
};

/** The allowlist PageEditor validates against, parsed from the framework component. */
function editorAllowedFields() {
  const source = fs.readFileSync(EDITOR_SOURCE, 'utf8');
  const declaration = source.match(/const\s+allowedFields\s*=\s*\[([^\]]*)\]/);
  if (!declaration) {
    throw new Error(
      `Could not find "const allowedFields = [...]" in ${path.relative(ROOT, EDITOR_SOURCE)}. ` +
        'The editor validation moved or was rewritten - re-point this test at it.'
    );
  }
  return declaration[1]
    .split(',')
    .map((field) => field.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/** Every markdown page under public/content/, keyed the way KNOWN_UNEDITABLE is. */
function contentPages(dir = CONTENT_DIR) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return contentPages(full);
    if (!entry.name.endsWith('.md')) return [];
    return [{ id: path.relative(CONTENT_DIR, full).split(path.sep).join('/'), full }];
  });
}

/** Frontmatter keys on a page that the editor would reject. */
function rejectedFields(page, allowed) {
  const { data } = matter(fs.readFileSync(page.full, 'utf8'));
  return Object.keys(data).filter((field) => !allowed.includes(field));
}

const allowedFields = editorAllowedFields();
const pages = contentPages();

describe('page editor frontmatter contract', () => {
  it('still finds the editor allowlist in the framework', () => {
    // Sanity check on the parse: these are the fields every page already uses.
    expect(allowedFields).toEqual(expect.arrayContaining(['title', 'description', 'tags', 'category']));
  });

  it('walks the whole content tree', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it('leaves every page saveable from the editor', () => {
    const blocked = pages
      .map((page) => ({
        page: page.id,
        fields: rejectedFields(page, allowedFields).filter(
          (field) => !(KNOWN_UNEDITABLE[page.id] ?? []).includes(field)
        ),
      }))
      .filter(({ fields }) => fields.length > 0);

    // A failure here means a contributor opening one of these pages gets
    // "Unknown metadata field" and cannot save. Either drop the field, or widen
    // allowedFields in the framework repo first.
    expect(blocked).toEqual([]);
  });

  it('keeps no stale entries in the known-uneditable list', () => {
    const stale = Object.entries(KNOWN_UNEDITABLE).flatMap(([id, fields]) => {
      const page = pages.find((candidate) => candidate.id === id);
      if (!page) return [{ page: id, reason: 'page no longer exists' }];
      const rejected = rejectedFields(page, allowedFields);
      return fields
        .filter((field) => !rejected.includes(field))
        .map((field) => ({ page: id, reason: `"${field}" is no longer rejected` }));
    });

    // Once the framework allows the field (or the page drops it), delete the entry -
    // a stale exception hides the next real regression.
    expect(stale).toEqual([]);
  });
});
