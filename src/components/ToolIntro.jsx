/**
 * ToolIntro - the explanatory article under each interactive tool.
 *
 * The prerenderer emits src/content/tool-pages/<route>.md as the crawler
 * HTML for a tool route; React then replaces that DOM with the tool itself.
 * Rendering the same markdown here keeps the page's publisher content in
 * the hydrated view too (what reviewers and Google's renderer see), from a
 * single source file per tool.
 *
 * Rendering goes through the framework's PageViewer so links, tables and
 * the game syntax ({{skill:...}} etc.) behave exactly as on wiki pages. Ad
 * markers are deliberately not injected: tool pages carry one banner
 * (ToolPageAd) and nothing else.
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import matter from 'gray-matter';
import PageViewer from '../../wiki-framework/src/components/wiki/PageViewer.jsx';
import { processGameSyntax, getGameComponents } from '../utils/gameContentRenderer.jsx';

/** Every tool copy file, keyed by "../content/tool-pages/<route>.md". */
const TOOL_COPY = import.meta.glob('../content/tool-pages/*.md', { query: '?raw', import: 'default', eager: true });

const TOOL_COPY_DIR = '../content/tool-pages/';

/**
 * Raw markdown for a tool route, or null when the route has no copy file.
 * @param {string} route - file stem, e.g. "skill-builder"
 */
export function getToolCopy(route) {
  if (!route) return null;
  return TOOL_COPY[`${TOOL_COPY_DIR}${route}.md`] ?? null;
}

const stripTags = (text) => text.replace(/<[^>]+>/g, '').trim();

/**
 * Drop a leading H1 that repeats the page title (the tool renders its own
 * heading) and demote every remaining heading one level, so the intro nests
 * under the tool's H1 instead of competing with it. Code fences are left
 * untouched.
 * @param {string} content
 * @param {string} title
 */
export function prepareIntroMarkdown(content, title) {
  if (!content) return '';
  let inFence = false;
  let titleStripped = false;
  const normalizedTitle = String(title || '').trim().toLowerCase();

  const lines = content.split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (!heading) return line;

    const [, hashes, text] = heading;
    if (!titleStripped && hashes.length === 1 && normalizedTitle && stripTags(text).toLowerCase() === normalizedTitle) {
      titleStripped = true;
      return null;
    }
    return `${hashes.length < 6 ? '#' : ''}${hashes} ${text}`;
  });

  return lines.filter((line) => line !== null).join('\n').replace(/^\n+/, '');
}

const ToolIntro = ({ route, source = null, heading = null }) => {
  const intro = useMemo(() => {
    const raw = source ?? getToolCopy(route);
    if (!raw) return null;
    const { data, content } = matter(raw);
    const title = data?.title || route;
    const body = prepareIntroMarkdown(content, title);
    return body.trim() ? { title, body } : null;
  }, [route, source]);

  if (!intro) return null;

  const headingId = `tool-intro-${route}`;

  return (
    <section aria-labelledby={headingId} className="max-w-4xl mx-auto mt-10 sm:mt-12 px-3 sm:px-0">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm px-5 py-6 sm:px-8 sm:py-8">
        <h2 id={headingId} className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {heading || `About the ${intro.title}`}
        </h2>
        <PageViewer
          content={intro.body}
          metadata={{ title: intro.title, hideHeader: true }}
          contentProcessor={processGameSyntax}
          customComponents={getGameComponents()}
          embedded
          className="max-w-none"
        />
      </div>
    </section>
  );
};

ToolIntro.propTypes = {
  /** File stem under src/content/tool-pages, and the id used for the heading. */
  route: PropTypes.string.isRequired,
  /** Raw markdown to render instead of the tool-pages file (e.g. a wiki page). */
  source: PropTypes.string,
  /** Override for the "About the <title>" heading. */
  heading: PropTypes.string,
};

export default ToolIntro;
