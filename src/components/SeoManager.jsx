import React, { useEffect, useState } from 'react';
import MetaTags from './MetaTags';
import {
  ArticleStructuredData,
  BreadcrumbStructuredData,
} from '../../wiki-framework/src/components/common/StructuredData';
import { useWikiConfig } from '../../wiki-framework/src/hooks/useWikiConfig';
import { createLogger } from '../utils/logger';

const logger = createLogger('SeoManager');

/** Mirrors the pathname-polling backstop AppWrapper already uses for page tracking. */
const PATHNAME_POLL_INTERVAL_MS = 500;

/** Google truncates description snippets around this length. */
const DESCRIPTION_EXCERPT_LENGTH = 155;

/**
 * Current pathname, reactive to SPA navigation. SeoManager mounts outside the
 * router (AppWrapper wraps the RouterProvider), so useLocation is unavailable;
 * popstate plus a light poll covers pushState navigations instead.
 */
function usePathname() {
  const [pathname, setPathname] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', update);
    const poll = setInterval(update, PATHNAME_POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener('popstate', update);
      clearInterval(poll);
    };
  }, []);

  return pathname;
}

/** Decode and strip the trailing slash so paths match search-index URLs. */
function normalizePath(pathname) {
  let path = pathname || '/';
  try {
    path = decodeURIComponent(path);
  } catch {
    // Malformed escape sequence - match against the raw path instead
  }
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

/** Meta-description fallback built from indexed page content. */
function excerpt(text) {
  const clean = (text || '')
    .replace(/\{\{[^}]*\}\}/g, ' ') // strip game-syntax markers
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= DESCRIPTION_EXCERPT_LENGTH) return clean;
  return `${clean.slice(0, DESCRIPTION_EXCERPT_LENGTH).replace(/\s+\S*$/, '')}...`;
}

/**
 * SeoManager
 *
 * Emits per-page titles, meta descriptions, canonical URLs, and JSON-LD for the
 * routes that don't manage their own meta tags:
 * - the homepage
 * - markdown content pages (looked up in /search-index.json)
 * - section index pages
 *
 * Tool pages (skill builder, spirit builder, ...) render their own <MetaTags>
 * and are deliberately left alone here so canonicals are never emitted twice.
 */
const SeoManager = () => {
  const { config } = useWikiConfig();
  const pathname = usePathname();
  const [pageIndex, setPageIndex] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/search-index.json')
      .then(res => (res.ok ? res.json() : null))
      .then(entries => {
        if (cancelled || !Array.isArray(entries)) return;
        setPageIndex(new Map(entries.map(entry => [entry.url, entry])));
        logger.debug('Loaded page index for SEO meta', { pages: entries.length });
      })
      .catch(err => {
        logger.debug('Search index unavailable for SEO meta', { error: err?.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!config) return null;

  const path = normalizePath(pathname);
  const siteUrl = config.wiki?.url || '';

  if (path === '/') {
    return <MetaTags url="/" twitterCard="summary" />;
  }

  const page = pageIndex?.get(path);
  if (page) {
    const description = page.description || excerpt(page.content);
    return (
      <>
        <MetaTags
          title={page.title}
          description={description}
          url={page.url}
          type="article"
          twitterCard="summary"
          keywords={page.tags || []}
          section={page.sectionTitle}
          datePublished={page.date || undefined}
        />
        <ArticleStructuredData
          title={page.title}
          description={description}
          url={`${siteUrl}${page.url}`}
          datePublished={page.date || undefined}
          section={page.sectionTitle}
        />
        <BreadcrumbStructuredData
          items={[
            { name: 'Home', url: `${siteUrl}/` },
            { name: page.sectionTitle, url: `${siteUrl}/${page.section}` },
            { name: page.title, url: `${siteUrl}${page.url}` },
          ]}
        />
      </>
    );
  }

  const section = config.sections?.find(s => `/${s.path}` === path);
  if (section) {
    return (
      <MetaTags
        title={section.title}
        description={`Browse ${section.title} guides and pages on ${config.wiki?.title || 'the wiki'}.`}
        url={path}
        twitterCard="summary"
      />
    );
  }

  return null;
};

export default SeoManager;
