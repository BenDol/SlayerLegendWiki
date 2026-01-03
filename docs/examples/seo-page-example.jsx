/**
 * Complete SEO Example Page
 *
 * This example shows how to use all SEO components together
 * for maximum search engine optimization.
 */

import React from 'react';
import MetaTags from '../../src/components/MetaTags';
import {
  WebSiteStructuredData,
  ArticleStructuredData,
  BreadcrumbStructuredData,
  ToolStructuredData
} from '../../src/components/StructuredData';

/**
 * Example 1: Homepage with WebSite structured data
 */
export function HomePageWithSEO() {
  return (
    <>
      <MetaTags
        title="" // Empty string shows just site title
        description="Complete guide for Slayer Legend: Idle RPG. Learn strategies, builds, and tips."
        image="/images/og-default.svg"
        url="/"
        type="website"
        keywords={[
          'Slayer Legend',
          'Slayer Legend Wiki',
          'Idle RPG',
          'game guide',
          'tips',
          'strategies'
        ]}
      />

      <WebSiteStructuredData />

      <div>
        <h1>Welcome to Slayer Legend Wiki</h1>
        {/* Homepage content */}
      </div>
    </>
  );
}

/**
 * Example 2: Wiki article page with full SEO
 */
export function WikiArticleWithSEO() {
  const pageData = {
    title: 'Character Awakening Guide',
    description: 'Learn everything about character awakening in Slayer Legend. Detailed guide on awakening stages, requirements, and benefits.',
    url: '/characters/awakening',
    image: '/images/sections/characters.png',
    section: 'Characters',
    datePublished: '2024-01-15T00:00:00Z',
    dateModified: '2024-03-20T00:00:00Z',
    author: 'Wiki Contributors'
  };

  const breadcrumbs = [
    { name: 'Home', url: 'https://slayerlegend.wiki/' },
    { name: 'Characters', url: 'https://slayerlegend.wiki/characters' },
    { name: 'Awakening', url: 'https://slayerlegend.wiki/characters/awakening' }
  ];

  return (
    <>
      <MetaTags
        title={pageData.title}
        description={pageData.description}
        image={pageData.image}
        url={pageData.url}
        type="article"
        keywords={[
          'character awakening',
          'awakening guide',
          'character progression',
          'awakening stages',
          'slayer legend awakening'
        ]}
        author={pageData.author}
        datePublished={pageData.datePublished}
        dateModified={pageData.dateModified}
        section={pageData.section}
      />

      <ArticleStructuredData
        title={pageData.title}
        description={pageData.description}
        url={`https://slayerlegend.wiki${pageData.url}`}
        image={`https://slayerlegend.wiki${pageData.image}`}
        datePublished={pageData.datePublished}
        dateModified={pageData.dateModified}
        author={pageData.author}
        section={pageData.section}
      />

      <BreadcrumbStructuredData items={breadcrumbs} />

      <article>
        <h1>Character Awakening Guide</h1>
        {/* Article content */}
      </article>
    </>
  );
}

/**
 * Example 3: Tool page with application structured data
 */
export function ToolPageWithSEO() {
  return (
    <>
      <MetaTags
        title="Skill Builder"
        description="Create and optimize skill builds for Slayer Legend. Plan your skill combinations, test different elements, and share builds with the community."
        image="/images/tools/skill-builder.svg"
        url="/skill-builder"
        type="website"
        keywords={[
          'skill builder',
          'skills',
          'builds',
          'planner',
          'simulator',
          'skill combinations'
        ]}
      />

      <ToolStructuredData
        name="Skill Builder"
        description="Create and optimize skill builds for Slayer Legend"
        url="https://slayerlegend.wiki/skill-builder"
        image="https://slayerlegend.wiki/images/tools/skill-builder.svg"
        category="Game Tool"
      />

      <div>
        <h1>Skill Builder</h1>
        {/* Tool content */}
      </div>
    </>
  );
}

/**
 * Example 4: Private/No-index page
 */
export function PrivatePageNoSEO() {
  return (
    <>
      <MetaTags
        title="Admin Dashboard"
        description="Admin only area"
        robots="noindex, nofollow" // Prevents search engine indexing
      />

      <div>
        <h1>Admin Dashboard</h1>
        {/* Admin content */}
      </div>
    </>
  );
}

/**
 * Example 5: Dynamic content page (from API/database)
 */
export function DynamicContentWithSEO({ characterData }) {
  // Data might come from props, API, or database
  const seoData = {
    title: characterData.name,
    description: `Learn about ${characterData.name}, a ${characterData.element} character in Slayer Legend. Stats, abilities, and build recommendations.`,
    url: `/characters/${characterData.slug}`,
    image: characterData.image || '/images/sections/characters.png',
    keywords: [
      characterData.name,
      characterData.element,
      'character guide',
      `${characterData.element} character`,
      'slayer legend characters'
    ]
  };

  return (
    <>
      <MetaTags {...seoData} type="article" />

      <ArticleStructuredData
        title={seoData.title}
        description={seoData.description}
        url={`https://slayerlegend.wiki${seoData.url}`}
        image={`https://slayerlegend.wiki${seoData.image}`}
        section="Characters"
      />

      <div>
        <h1>{characterData.name}</h1>
        <p>{characterData.description}</p>
        {/* Character content */}
      </div>
    </>
  );
}

/**
 * Example 6: Multi-language page
 */
export function MultiLanguagePageWithSEO({ language = 'en' }) {
  const translations = {
    en: {
      title: 'Beginner\'s Guide',
      description: 'Learn the basics of Slayer Legend',
      keywords: ['beginner guide', 'tutorial', 'getting started']
    },
    ko: {
      title: '초보자 가이드',
      description: '슬레이어 레전드의 기본을 배우세요',
      keywords: ['초보자 가이드', '튜토리얼', '시작하기']
    }
  };

  const content = translations[language];

  return (
    <>
      <MetaTags
        title={content.title}
        description={content.description}
        keywords={content.keywords}
        language={language}
        url={`/${language}/getting-started`}
      />

      <div>
        <h1>{content.title}</h1>
        {/* Translated content */}
      </div>
    </>
  );
}

/**
 * Example 7: Using all components together (comprehensive)
 */
export function ComprehensiveSEOPage() {
  return (
    <>
      {/* Meta Tags - Basic SEO + Social Media */}
      <MetaTags
        title="Complete Equipment Guide"
        description="Master equipment in Slayer Legend. Learn about soul weapons, accessories, relics, enhancement, and fusion systems."
        image="/images/sections/equipment.png"
        url="/equipment"
        type="article"
        keywords={[
          'equipment guide',
          'soul weapons',
          'accessories',
          'relics',
          'equipment enhancement',
          'equipment fusion'
        ]}
        author="Wiki Team"
        datePublished="2024-01-01T00:00:00Z"
        dateModified={new Date().toISOString()}
        section="Equipment"
        language="en"
        robots="index, follow"
      />

      {/* Structured Data - Article */}
      <ArticleStructuredData
        title="Complete Equipment Guide"
        description="Master equipment in Slayer Legend"
        url="https://slayerlegend.wiki/equipment"
        image="https://slayerlegend.wiki/images/sections/equipment.png"
        datePublished="2024-01-01T00:00:00Z"
        dateModified={new Date().toISOString()}
        author="Wiki Team"
        section="Equipment"
      />

      {/* Structured Data - Breadcrumbs */}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: 'https://slayerlegend.wiki/' },
          { name: 'Equipment', url: 'https://slayerlegend.wiki/equipment' }
        ]}
      />

      {/* Page Content */}
      <article>
        <header>
          <h1>Complete Equipment Guide</h1>
          <p className="lead">
            Master equipment in Slayer Legend. Learn about soul weapons, accessories, relics, enhancement, and fusion systems.
          </p>
        </header>

        <nav aria-label="Table of contents">
          <h2>Table of Contents</h2>
          <ul>
            <li><a href="#soul-weapons">Soul Weapons</a></li>
            <li><a href="#accessories">Accessories</a></li>
            <li><a href="#relics">Relics</a></li>
            <li><a href="#enhancement">Enhancement</a></li>
            <li><a href="#fusion">Fusion</a></li>
          </ul>
        </nav>

        <section id="soul-weapons">
          <h2>Soul Weapons</h2>
          <p>Soul weapons are the primary weapons in Slayer Legend...</p>
        </section>

        {/* More sections */}
      </article>
    </>
  );
}

/**
 * Notes:
 *
 * 1. Always include MetaTags on every page
 * 2. Use ArticleStructuredData for wiki content pages
 * 3. Use ToolStructuredData for tool/calculator pages
 * 4. Use WebSiteStructuredData only on homepage
 * 5. Add BreadcrumbStructuredData for better navigation
 * 6. Use absolute URLs in structured data
 * 7. Keep descriptions concise (150-160 chars)
 * 8. Use 5-10 relevant keywords
 * 9. Update dateModified when content changes
 * 10. Use robots="noindex, nofollow" for private pages
 */
