# Meta Tags & Social Preview Configuration

This guide explains how to add rich link previews (Open Graph & Twitter Cards) to your wiki pages and custom routes.

## Overview

When sharing links on platforms like Discord, Slack, Twitter, or Facebook, the site displays rich previews with:
- **Title** - Page or site title
- **Description** - Brief summary
- **Image** - Preview image/thumbnail
- **URL** - Canonical link

## Quick Start

### Use MetaTags Component

Import and use the `MetaTags` component in any page or component:

```jsx
import MetaTags from '../components/MetaTags';

function MyPage() {
  return (
    <>
      <MetaTags
        title="Skill Builder"
        description="Create and share your skill builds for Slayer Legend"
        image="/images/skill-builder-preview.png"
        url="/skill-builder"
      />

      {/* Your page content */}
    </>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | No | Page title (appended with site name) |
| `description` | string | No | Page description |
| `image` | string | No | Absolute or relative URL to preview image |
| `url` | string | No | Canonical URL (can be relative) |
| `type` | string | No | Open Graph type (default: `'website'`) |
| `twitterCard` | string | No | Twitter card type (default: `'summary_large_image'`) |
| `keywords` | string[] | No | SEO keywords |

All props are optional - they fall back to values from `wiki-config.json`.

## Examples

### Example 1: Custom Tool Page

```jsx
import MetaTags from '../components/MetaTags';

function SkillBuilderPage() {
  return (
    <div>
      <MetaTags
        title="Skill Builder"
        description="Plan your skill combinations and share builds with the community"
        image="/images/tools/skill-builder.png"
        url="/skill-builder"
        keywords={['skill builder', 'skills', 'builds', 'planner']}
      />

      <h1>Skill Builder</h1>
      {/* Tool content */}
    </div>
  );
}
```

### Example 2: Dynamic Wiki Page

For framework pages that render markdown content:

```jsx
import MetaTags from '../components/MetaTags';

function PageViewerPage({ metadata, pageId }) {
  return (
    <>
      <MetaTags
        title={metadata?.title}
        description={metadata?.description}
        image={metadata?.image || `/images/sections/${sectionId}.png`}
        url={`/${sectionId}/${pageId}`}
        keywords={metadata?.tags || []}
      />

      {/* Page content */}
    </>
  );
}
```

### Example 3: Shared Build Preview

Generate dynamic previews for user-generated content:

```jsx
import MetaTags from '../components/MetaTags';

function SharedBuildPage({ build }) {
  return (
    <>
      <MetaTags
        title={`${build.name} - Skill Build`}
        description={`Check out this ${build.element} skill build by ${build.author}`}
        image={build.thumbnail || '/images/default-build.png'}
        url={`/builds/${build.id}`}
        type="article"
      />

      {/* Build display */}
    </>
  );
}
```

## Creating Preview Images

### Recommended Sizes

- **Open Graph**: 1200x630px (1.91:1 ratio)
- **Twitter Card**: 1200x600px (2:1 ratio)
- **Safe zone**: Keep important content within 1200x600px center

### Tips

1. **Use high contrast** - Ensure text is readable on all platforms
2. **Keep it simple** - Avoid cluttered designs
3. **Brand consistency** - Include logo or game artwork
4. **Text size** - Use large, bold fonts (minimum 60px for headings)
5. **File size** - Keep under 5MB (ideally under 1MB)
6. **Format** - PNG or JPG (PNG for graphics with text)

### Example Preview Image Structure

```
┌─────────────────────────────────────┐
│  [Logo]                             │
│                                     │
│  Page Title                         │
│  Brief description or tagline       │
│                                     │
│              [Icon/Art]             │
└─────────────────────────────────────┘
```

## Updating wiki-config.json

Add social media configuration to `public/wiki-config.json`:

```json
{
  "wiki": {
    "title": "Slayer Legend Wiki",
    "description": "Complete guide for Slayer Legend: Idle RPG",
    "url": "https://slayerlegend.wiki",
    "logo": "/images/logo.png",
    "socialPreview": {
      "defaultImage": "/images/og-default.png",
      "twitter": "@SlayerLegendWiki"
    }
  }
}
```

## Testing

### Test Your Meta Tags

1. **Facebook Debugger**: https://developers.facebook.com/tools/debug/
2. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
3. **LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/
4. **Open Graph Check**: https://www.opengraph.xyz/

### Local Testing

Use browser dev tools to inspect the `<head>` section:

```javascript
// Check current meta tags
document.querySelectorAll('meta[property^="og:"]').forEach(tag => {
  console.log(tag.getAttribute('property'), tag.getAttribute('content'));
});
```

## Special Open Graph Types

For different content types, use appropriate `type` prop:

- `website` - Default for most pages
- `article` - Blog posts, guides, wiki pages
- `profile` - User profiles
- `video.other` - Video content
- `book` - For documentation/guides

Example:
```jsx
<MetaTags
  type="article"
  title="Complete Beginner's Guide"
  // ... other props
/>
```

## Fallback Behavior

If you don't specify meta tags for a page:
1. Uses defaults from `index.html`
2. Falls back to `wiki-config.json` values
3. Title becomes: "Slayer Legend Wiki"
4. Image becomes: "/images/logo.png"

## Framework Integration (Advanced)

To add meta tags automatically to all framework pages, you would need to modify the framework's `PageViewerPage.jsx`:

**Note**: Since this is in the framework submodule, coordinate with the framework maintainer.

```jsx
// In wiki-framework/src/pages/PageViewerPage.jsx
import MetaTags from '../../../../src/components/MetaTags'; // Adjust path

function PageViewerPage() {
  // ... existing code ...

  return (
    <>
      <MetaTags
        title={metadata?.title}
        description={metadata?.description}
        image={metadata?.image}
        url={`/${sectionId}/${pageId}`}
      />
      {/* ... rest of page */}
    </>
  );
}
```

## Best Practices

1. **Always provide title and description** - These are the most important
2. **Use absolute URLs in production** - Relative paths work but absolute is safer
3. **Create custom images** - Generic logo is okay, but custom images get more engagement
4. **Keep descriptions under 160 characters** - They may be truncated
5. **Test on multiple platforms** - Discord, Twitter, and Facebook render differently
6. **Update cache** - After changing meta tags, you may need to clear cache on social platforms

## Common Issues

### Meta tags not updating

- Clear browser cache
- Use the social platform debuggers to refresh their cache
- Ensure HelmetProvider is wrapping your app
- Check that MetaTags component is actually rendering

### Images not showing

- Verify image path is correct (absolute URLs preferred)
- Check image file size (< 5MB)
- Ensure image is publicly accessible (not behind auth)
- Verify image format (PNG/JPG supported)

### Wrong data showing

- Social platforms cache meta tags for hours/days
- Use their debugging tools to force a refresh
- For Discord: Add `?v=1` to URL to bust cache

## Additional Resources

- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Discord Link Preview Guide](https://discord.com/developers/docs/resources/channel#embed-object)
