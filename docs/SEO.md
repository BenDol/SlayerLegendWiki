# SEO Guide - Search Engine Optimization

This guide covers all SEO (Search Engine Optimization) features implemented in your wiki for maximum search engine discoverability.

## Table of Contents

1. [Overview](#overview)
2. [Meta Tags](#meta-tags)
3. [Structured Data](#structured-data)
4. [Sitemap](#sitemap)
5. [Robots.txt](#robotstxt)
6. [Best Practices](#best-practices)
7. [Testing & Validation](#testing--validation)
8. [Performance](#performance)
9. [Submission to Search Engines](#submission-to-search-engines)

---

## Overview

Your wiki is now fully optimized for search engines with:

✅ **Dynamic Meta Tags** - Title, description, keywords, Open Graph, Twitter Cards
✅ **Structured Data** - Schema.org JSON-LD markup for rich snippets
✅ **Sitemap** - XML sitemap auto-generated from content
✅ **Robots.txt** - Search engine crawler instructions
✅ **Semantic HTML** - Proper heading hierarchy and structure
✅ **Canonical URLs** - Prevents duplicate content issues
✅ **Performance** - Fast load times improve SEO rankings

---

## Meta Tags

### MetaTags Component

The `MetaTags` component handles all meta tags (SEO, Open Graph, Twitter Cards).

#### Basic Usage

```jsx
import MetaTags from '../components/MetaTags';

<MetaTags
  title="Page Title"
  description="Brief description of the page content"
  url="/page-url"
/>
```

#### Full Example with All Props

```jsx
<MetaTags
  // Required/Recommended
  title="Complete Beginner's Guide"
  description="Learn the basics of Slayer Legend with this comprehensive beginner's guide"
  url="/getting-started"
  image="/images/sections/getting-started.png"

  // SEO
  keywords={['beginner guide', 'getting started', 'tutorial', 'basics']}
  author="Wiki Contributors"
  robots="index, follow" // default
  language="en" // default

  // Open Graph
  type="article" // website, article, etc.

  // Article metadata (when type="article")
  datePublished="2024-01-15T00:00:00Z"
  dateModified="2024-03-20T00:00:00Z"
  section="Getting Started"

  // Twitter Cards
  twitterCard="summary_large_image" // default
/>
```

#### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | string | Site title | Page title (appended with site name) |
| `description` | string | Site description | Page description (160 chars max recommended) |
| `image` | string | Site logo | Preview image (1200x630px recommended) |
| `url` | string | Current URL | Canonical URL |
| `type` | string | `'website'` | Open Graph type (website, article, etc.) |
| `twitterCard` | string | `'summary_large_image'` | Twitter card type |
| `keywords` | string[] | `[]` | SEO keywords |
| `author` | string | - | Content author name |
| `datePublished` | string (ISO) | - | Publication date |
| `dateModified` | string (ISO) | - | Last modified date |
| `section` | string | - | Article section/category |
| `robots` | string | `'index, follow'` | Robots directive |
| `language` | string | `'en'` | Content language |

### Meta Tags Generated

The component automatically generates:

```html
<!-- Basic SEO -->
<title>Page Title | Slayer Legend Wiki</title>
<meta name="description" content="..." />
<meta name="keywords" content="..." />
<meta name="robots" content="index, follow" />
<meta name="author" content="..." />
<link rel="canonical" href="..." />

<!-- Open Graph (Facebook, Discord, LinkedIn) -->
<meta property="og:type" content="article" />
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:image" content="..." />
<meta property="og:url" content="..." />
<meta property="og:site_name" content="..." />
<meta property="og:locale" content="en_US" />

<!-- Article-specific (when type="article") -->
<meta property="article:published_time" content="..." />
<meta property="article:modified_time" content="..." />
<meta property="article:author" content="..." />
<meta property="article:section" content="..." />
<meta property="article:tag" content="..." />

<!-- Twitter Cards -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="..." />
```

---

## Structured Data

Structured data (Schema.org JSON-LD) helps search engines understand your content and show rich snippets in search results.

### StructuredData Component

Located at `src/components/StructuredData.jsx`.

### Pre-built Components

#### WebSite (Homepage)

```jsx
import { WebSiteStructuredData } from '../components/StructuredData';

<WebSiteStructuredData />
```

Generates:
- Website info
- Search action (adds search box in Google)

#### Article (Wiki Pages)

```jsx
import { ArticleStructuredData } from '../components/StructuredData';

<ArticleStructuredData
  title="Complete Beginner's Guide"
  description="Learn the basics..."
  url="/getting-started"
  datePublished="2024-01-15T00:00:00Z"
  dateModified="2024-03-20T00:00:00Z"
  author="Wiki Contributors"
  image="/images/sections/getting-started.png"
  section="Getting Started"
/>
```

#### Breadcrumb

```jsx
import { BreadcrumbStructuredData } from '../components/StructuredData';

<BreadcrumbStructuredData
  items={[
    { name: 'Home', url: '/' },
    { name: 'Characters', url: '/characters' },
    { name: 'Awakening', url: '/characters/awakening' }
  ]}
/>
```

#### Tool/Application

```jsx
import { ToolStructuredData } from '../components/StructuredData';

<ToolStructuredData
  name="Skill Builder"
  description="Create and optimize skill builds"
  url="/skill-builder"
  image="/images/tools/skill-builder.svg"
  category="Game Tool"
/>
```

#### Video Game

```jsx
import { GameStructuredData } from '../components/StructuredData';

<GameStructuredData
  name="Slayer Legend"
  description="Idle RPG game"
  url="/"
  image="/images/og-default.svg"
  genre="RPG"
  publisher="Game Publisher Name"
/>
```

### Custom Structured Data

For advanced use cases:

```jsx
import StructuredData from '../components/StructuredData';

<StructuredData
  type="FAQPage"
  data={{
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How do I start playing?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Download the game from...'
        }
      }
    ]
  }}
/>
```

### Rich Snippet Examples

With structured data, your pages can show:

- **Article**: Publication date, author, thumbnail
- **BreadcrumbList**: Navigation path in search results
- **FAQPage**: Expandable Q&A in search results
- **HowTo**: Step-by-step instructions
- **WebSite**: Sitelinks search box

---

## Sitemap

An XML sitemap tells search engines which pages exist and when they were updated.

### Location

`/public/sitemap.xml`

### Auto-Generation

The sitemap is automatically generated during build:

```bash
# Runs automatically during build
npm run build

# Generate manually
npm run build:sitemap
```

### What's Included

- ✅ All markdown pages in `/public/content/`
- ✅ Static tool pages
- ✅ Homepage and special pages
- ❌ Draft pages (frontmatter: `draft: true`)
- ❌ No-index pages (frontmatter: `noindex: true`)

### Configuration

Edit `scripts/generate-sitemap.js` to customize:

```javascript
// Priority and change frequency by section
const SECTION_CONFIG = {
  'getting-started': { priority: '1.0', changefreq: 'weekly' },
  'characters': { priority: '0.9', changefreq: 'weekly' },
  // ... add more
};

// Static routes
const STATIC_ROUTES = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/skill-builder', priority: '0.9', changefreq: 'monthly' },
  // ... add more
];
```

### Sitemap Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://slayerlegend.wiki/</loc>
    <lastmod>2024-03-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- ... more URLs -->
</urlset>
```

### Excluding Pages from Sitemap

Add to page frontmatter:

```yaml
---
title: "Private Page"
noindex: true  # Excludes from sitemap
---
```

Or mark as draft:

```yaml
---
title: "Work in Progress"
draft: true  # Excludes from sitemap
---
```

---

## Robots.txt

Controls which pages search engines can crawl.

### Location

`/public/robots.txt`

### Current Configuration

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /.netlify/
Disallow: /.github/

# Allow CSS, JS, images
Allow: /*.css
Allow: /*.js
Allow: /*.png
Allow: /*.jpg
Allow: /*.svg

# Sitemap
Sitemap: https://slayerlegend.wiki/sitemap.xml
```

### Customization

Edit `public/robots.txt`:

```
# Block specific bot
User-agent: BadBot
Disallow: /

# Block specific directory
Disallow: /private/

# Crawl delay (seconds between requests)
Crawl-delay: 1
```

---

## Best Practices

### Title Tags

✅ **DO:**
- Keep under 60 characters
- Include primary keyword
- Make it unique per page
- Use pipe separator: `Page Title | Site Name`

❌ **DON'T:**
- Stuff keywords
- Use ALL CAPS
- Duplicate across pages

### Meta Descriptions

✅ **DO:**
- Keep 150-160 characters
- Include call-to-action
- Use active voice
- Include primary keyword naturally

❌ **DON'T:**
- Copy page content
- Use same description for multiple pages
- Stuff keywords

### Keywords

✅ **DO:**
- Use 5-10 relevant keywords
- Include variations (skill build, build skills)
- Research with Google Keyword Planner
- Match user intent

❌ **DON'T:**
- Use 50+ keywords
- Repeat same keyword
- Use unrelated keywords

### Content

✅ **DO:**
- Use proper heading hierarchy (H1 → H2 → H3)
- One H1 per page
- Use descriptive alt text for images
- Write for humans first
- Update content regularly
- Internal link to related pages
- Use semantic HTML

❌ **DON'T:**
- Hide text for SEO
- Duplicate content
- Use thin content (< 300 words)
- Ignore mobile optimization

### URLs

✅ **DO:**
- Use lowercase
- Separate words with hyphens
- Keep short and descriptive
- Include keywords

❌ **DON'T:**
- Use underscores
- Use special characters
- Make too long (> 100 chars)
- Use IDs or dates

### Images

✅ **DO:**
- Use descriptive file names
- Add alt text
- Optimize file size
- Use modern formats (WebP, SVG)
- Specify dimensions

❌ **DON'T:**
- Use generic names (image1.jpg)
- Skip alt text
- Use huge files (> 500KB)

---

## Testing & Validation

### Meta Tags

**View in browser:**
```javascript
// Open DevTools Console
document.querySelectorAll('meta').forEach(meta => {
  console.log(meta.getAttribute('name') || meta.getAttribute('property'), meta.content);
});
```

**Online validators:**
- [Facebook Debugger](https://developers.facebook.com/tools/debug/) - Open Graph
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Inspector](https://www.linkedin.com/post-inspector/)
- [Open Graph Check](https://www.opengraph.xyz/)

### Structured Data

**Google Rich Results Test:**
https://search.google.com/test/rich-results

**Schema Validator:**
https://validator.schema.org/

**View in browser:**
```javascript
// Check JSON-LD scripts
document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
  console.log(JSON.parse(script.textContent));
});
```

### Sitemap

**Validate sitemap:**
- https://www.xml-sitemaps.com/validate-xml-sitemap.html

**Check in browser:**
- https://slayerlegend.wiki/sitemap.xml

**Submit to Google:**
1. Go to Google Search Console
2. Sitemaps → Add new sitemap
3. Enter: `https://slayerlegend.wiki/sitemap.xml`

### Robots.txt

**Check in browser:**
- https://slayerlegend.wiki/robots.txt

**Google Robots Testing Tool:**
- Google Search Console → Crawl → robots.txt Tester

### Overall SEO

**Audit tools:**
- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/) (built into Chrome DevTools)
- [Screaming Frog SEO Spider](https://www.screamingfrogseosoftware.com/)
- [Ahrefs Site Audit](https://ahrefs.com/site-audit)
- [SEMrush Site Audit](https://www.semrush.com/features/site-audit/)

---

## Performance

Performance directly affects SEO rankings (Core Web Vitals).

### Current Optimizations

✅ Vite build optimization
✅ Code splitting with React.lazy()
✅ SVG images (smaller than PNG)
✅ Minified CSS and JS
✅ Gzip compression (Netlify/Cloudflare)

### Measure Performance

```bash
# Lighthouse audit
npx lighthouse https://slayerlegend.wiki --view

# Check bundle size
npm run build
```

### Core Web Vitals

- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

### Improve Performance

1. **Optimize images**
   ```bash
   # Convert to WebP
   npm install sharp
   npx sharp input.png -o output.webp
   ```

2. **Lazy load images**
   ```jsx
   <img src="..." loading="lazy" />
   ```

3. **Preload critical resources**
   ```html
   <link rel="preload" href="/fonts/custom.woff2" as="font" />
   ```

4. **Use CDN** (already using Netlify/Cloudflare)

---

## Submission to Search Engines

### Google Search Console

1. **Sign up:** https://search.google.com/search-console
2. **Add property:** Add `slayerlegend.wiki`
3. **Verify ownership:** DNS or HTML file
4. **Submit sitemap:** `/sitemap.xml`

**Benefits:**
- Monitor search performance
- Fix indexing issues
- See search queries
- Request re-indexing

### Bing Webmaster Tools

1. **Sign up:** https://www.bing.com/webmasters
2. **Add site:** `slayerlegend.wiki`
3. **Verify:** DNS or HTML file
4. **Submit sitemap:** `/sitemap.xml`

### Manual Submission

**Google:**
https://www.google.com/ping?sitemap=https://slayerlegend.wiki/sitemap.xml

**Bing:**
https://www.bing.com/ping?sitemap=https://slayerlegend.wiki/sitemap.xml

### Indexing Status

Check if your pages are indexed:

```
site:slayerlegend.wiki
```

Check specific page:
```
site:slayerlegend.wiki/skill-builder
```

---

## Quick Reference

### Checklist for New Pages

- [ ] Add unique title (< 60 chars)
- [ ] Add meta description (150-160 chars)
- [ ] Add relevant keywords (5-10)
- [ ] Use proper H1 heading
- [ ] Add alt text to images
- [ ] Include structured data
- [ ] Add internal links
- [ ] Use descriptive URL
- [ ] Run sitemap generation
- [ ] Test on mobile

### Common Commands

```bash
# Generate sitemap
npm run build:sitemap

# Build with sitemap
npm run build

# Test locally
npm run dev

# Validate HTML
npm run validate:html

# Run Lighthouse
npx lighthouse http://localhost:8888 --view
```

### Important Files

```
public/
├── sitemap.xml           # Auto-generated sitemap
├── robots.txt            # Crawler instructions
└── images/               # Optimized images

src/components/
├── MetaTags.jsx          # SEO meta tags
└── StructuredData.jsx    # Schema.org markup

scripts/
└── generate-sitemap.js   # Sitemap generator

docs/
├── SEO.md               # This file
├── META_TAGS.md         # Meta tags guide
└── PREVIEW_IMAGES.md    # Social preview images
```

---

## Resources

### Official Documentation

- [Google Search Central](https://developers.google.com/search)
- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmasters-guidelines-30fba23a)
- [Schema.org](https://schema.org/)
- [Open Graph Protocol](https://ogp.me/)

### Learning Resources

- [Google SEO Starter Guide](https://developers.google.com/search/docs/beginner/seo-starter-guide)
- [Moz Beginner's Guide to SEO](https://moz.com/beginners-guide-to-seo)
- [Search Engine Journal](https://www.searchenginejournal.com/)

### Tools

- [Google Keyword Planner](https://ads.google.com/home/tools/keyword-planner/)
- [Ubersuggest](https://neilpatel.com/ubersuggest/)
- [Answer the Public](https://answerthepublic.com/)
- [Google Trends](https://trends.google.com/)

---

## Support

For SEO-related questions or issues:

1. Check this documentation
2. Run validation tools
3. Check Google Search Console
4. Review server logs
5. Ask in wiki discussions

---

**🎉 Your wiki is now fully optimized for search engines!**

Remember: SEO is an ongoing process. Keep content fresh, monitor performance, and adapt to search engine algorithm updates.
