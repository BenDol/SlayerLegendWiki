# SEO Quick Reference Card

## 🚀 Quick Start

### Add SEO to a Page

```jsx
import MetaTags from '../components/MetaTags';
import { ArticleStructuredData } from '../components/StructuredData';

<>
  <MetaTags
    title="Your Page Title"
    description="Brief description (150-160 chars)"
    url="/page-url"
    keywords={['keyword1', 'keyword2', 'keyword3']}
  />

  <ArticleStructuredData
    title="Your Page Title"
    description="Brief description"
    url="https://slayerlegend.wiki/page-url"
  />

  {/* Your content */}
</>
```

---

## 📋 MetaTags Props Cheatsheet

| Prop | Example | Required |
|------|---------|----------|
| `title` | `"Skill Builder"` | ✅ |
| `description` | `"Create skill builds"` | ✅ |
| `url` | `"/skill-builder"` | ✅ |
| `image` | `"/images/tools/skill-builder.svg"` | ⭐ |
| `keywords` | `['skills', 'builds']` | ⭐ |
| `type` | `"article"` or `"website"` | - |
| `author` | `"Wiki Team"` | - |
| `datePublished` | `"2024-01-15T00:00:00Z"` | - |
| `robots` | `"index, follow"` | - |

⭐ = Highly recommended

---

## 🎯 SEO Best Practices

### Title
- ✅ < 60 characters
- ✅ Include primary keyword
- ✅ Unique per page
- ❌ Don't stuff keywords

### Description
- ✅ 150-160 characters
- ✅ Include call-to-action
- ✅ Include keyword naturally
- ❌ Don't copy page content

### Keywords
- ✅ 5-10 relevant keywords
- ✅ Include variations
- ✅ Research with tools
- ❌ Don't repeat same keyword

### Images
- ✅ 1200x630px for social previews
- ✅ Descriptive file names
- ✅ Add alt text
- ✅ Optimize size (< 500KB)

---

## 🛠️ Common Commands

```bash
# Generate sitemap
npm run build:sitemap

# Build with SEO
npm run build

# Run locally
npm run dev

# Test SEO
npx lighthouse http://localhost:8888 --view
```

---

## 📁 Important Files

```
public/
├── sitemap.xml          # Auto-generated
├── robots.txt           # Crawler rules
└── images/              # Optimized images

src/components/
├── MetaTags.jsx         # SEO meta tags
└── StructuredData.jsx   # Schema.org

scripts/
└── generate-sitemap.js  # Sitemap generator
```

---

## 🔍 Testing Tools

### Meta Tags
- [Facebook Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [Open Graph Check](https://www.opengraph.xyz/)

### Structured Data
- [Rich Results Test](https://search.google.com/test/rich-results)
- [Schema Validator](https://validator.schema.org/)

### Overall SEO
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/)

### Sitemap
- [XML Sitemap Validator](https://www.xml-sitemaps.com/validate-xml-sitemap.html)

---

## 📊 Structured Data Types

### WebSite (Homepage)
```jsx
import { WebSiteStructuredData } from '../components/StructuredData';
<WebSiteStructuredData />
```

### Article (Wiki Pages)
```jsx
import { ArticleStructuredData } from '../components/StructuredData';
<ArticleStructuredData
  title="Page Title"
  description="Description"
  url="https://slayerlegend.wiki/page"
  datePublished="2024-01-15T00:00:00Z"
/>
```

### Breadcrumb
```jsx
import { BreadcrumbStructuredData } from '../components/StructuredData';
<BreadcrumbStructuredData
  items={[
    { name: 'Home', url: '/' },
    { name: 'Section', url: '/section' }
  ]}
/>
```

### Tool
```jsx
import { ToolStructuredData } from '../components/StructuredData';
<ToolStructuredData
  name="Tool Name"
  description="Tool description"
  url="https://slayerlegend.wiki/tool"
/>
```

---

## 🚫 Exclude from Search

### In Frontmatter
```yaml
---
title: "Private Page"
noindex: true  # Excludes from sitemap
draft: true    # Also excludes from sitemap
---
```

### In Component
```jsx
<MetaTags
  title="Admin Page"
  robots="noindex, nofollow"
/>
```

---

## 📈 Submission Checklist

- [ ] Verify in Google Search Console
- [ ] Submit sitemap to Google
- [ ] Submit sitemap to Bing
- [ ] Test meta tags with validators
- [ ] Run Lighthouse audit
- [ ] Check mobile responsiveness
- [ ] Verify structured data
- [ ] Test page load speed

---

## 🔗 Quick Links

- **Full Documentation**: `/docs/SEO.md`
- **Meta Tags Guide**: `/docs/META_TAGS.md`
- **Examples**: `/docs/examples/seo-page-example.jsx`
- **Google Search Console**: https://search.google.com/search-console
- **Bing Webmaster**: https://www.bing.com/webmasters

---

## 💡 Pro Tips

1. **Update sitemap after content changes**
   ```bash
   npm run build:sitemap
   ```

2. **Use article type for wiki pages**
   ```jsx
   <MetaTags type="article" />
   ```

3. **Include dates for articles**
   ```jsx
   datePublished="2024-01-15T00:00:00Z"
   dateModified="2024-03-20T00:00:00Z"
   ```

4. **Test on real devices**
   - Mobile phones
   - Tablets
   - Desktop

5. **Monitor Search Console regularly**
   - Check indexing status
   - Fix crawl errors
   - Track search queries

6. **Update content regularly**
   - Fresh content ranks better
   - Update old articles
   - Add new sections

7. **Internal linking**
   - Link to related pages
   - Use descriptive anchor text
   - Build topic clusters

8. **Alt text for images**
   ```jsx
   <img src="..." alt="Descriptive text" />
   ```

9. **Semantic HTML**
   ```jsx
   <article>
     <header><h1>Title</h1></header>
     <section>Content</section>
     <footer>Footer</footer>
   </article>
   ```

10. **Mobile-first approach**
    - Google uses mobile-first indexing
    - Test on mobile devices
    - Optimize for touch

---

## 📞 Get Help

- Read full docs: `/docs/SEO.md`
- Check examples: `/docs/examples/`
- Test your pages with validators
- Monitor Search Console
