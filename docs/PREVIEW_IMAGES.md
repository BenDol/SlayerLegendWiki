# Social Preview Images Guide

This guide explains how to create, customize, and convert social preview images for your wiki.

## Current Preview Images

All tool pages now have custom SVG preview images in `public/images/tools/`:

- ✅ `skill-builder.svg` - Skill Builder tool
- ✅ `spirit-builder.svg` - Spirit Builder tool
- ✅ `battle-loadouts.svg` - Battle Loadouts tool
- ✅ `soul-weapon-engraving.svg` - Soul Weapon Engraving tool
- ✅ `my-spirits.svg` - My Spirit Collection
- ✅ `my-collections.svg` - My Collections page
- ✅ `og-default.svg` - Default site preview (homepage)

## SVG vs PNG

**SVG (Scalable Vector Graphics)**
- ✅ Smaller file size
- ✅ Infinitely scalable
- ✅ Editable with text editor
- ⚠️ Not supported by all platforms (Discord, Twitter support it)

**PNG (Portable Network Graphics)**
- ✅ Universal compatibility
- ✅ Supported everywhere
- ⚠️ Larger file size
- ⚠️ Fixed resolution

## Testing Your Previews

### Discord
Simply paste your URL in Discord - it will automatically fetch and display the preview.

**Cache busting**: Add `?v=1` to the URL to force Discord to refetch.

### Other Platforms
- **Facebook**: https://developers.facebook.com/tools/debug/
- **Twitter**: https://cards-dev.twitter.com/validator
- **LinkedIn**: https://www.linkedin.com/post-inspector/
- **General**: https://www.opengraph.xyz/

## Converting SVG to PNG

If you need PNG versions for better compatibility:

### Method 1: Online Converters (Easiest)
1. Go to https://cloudconvert.com/svg-to-png
2. Upload your SVG file
3. Set width to 1200px
4. Download the PNG

### Method 2: ImageMagick (Command Line)
```bash
# Install ImageMagick first
# Windows: choco install imagemagick
# Mac: brew install imagemagick
# Linux: sudo apt-get install imagemagick

# Convert single file
magick convert -background none -density 300 skill-builder.svg -resize 1200x630 skill-builder.png

# Convert all SVGs in directory
for file in *.svg; do
  magick convert -background none -density 300 "$file" -resize 1200x630 "${file%.svg}.png"
done
```

### Method 3: Inkscape (GUI Application)
1. Download Inkscape: https://inkscape.org/
2. Open your SVG file
3. File → Export PNG Image
4. Set Width: 1200px
5. Export

### Method 4: Browser (Quick & Dirty)
1. Open the SVG file in your browser
2. Open DevTools (F12)
3. Right-click on the image → "Save Image As"
4. Some browsers render SVG as PNG for saving

### Method 5: Node.js Script (Automated)
Create a script to convert all SVGs:

```javascript
// convert-svgs.js
import sharp from 'sharp';
import { readdir } from 'fs/promises';
import { join } from 'path';

const toolsDir = './public/images/tools';
const files = await readdir(toolsDir);

for (const file of files) {
  if (file.endsWith('.svg')) {
    const svgPath = join(toolsDir, file);
    const pngPath = join(toolsDir, file.replace('.svg', '.png'));

    await sharp(svgPath, { density: 300 })
      .resize(1200, 630)
      .png()
      .toFile(pngPath);

    console.log(`✓ Converted ${file}`);
  }
}
```

Run with:
```bash
npm install sharp
node convert-svgs.js
```

## Customizing Preview Images

### Editing SVG Files

SVG files are just XML text - you can edit them with any text editor!

**Change colors:**
```svg
<!-- Find lines like this -->
<stop offset="0%" style="stop-color:#dc2626;stop-opacity:1" />

<!-- Change the hex color -->
<stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
```

**Change text:**
```svg
<!-- Find lines like this -->
<text x="0" y="0" ...>Skill Builder</text>

<!-- Change the text content -->
<text x="0" y="0" ...>My Custom Title</text>
```

**Change emoji icons:**
```svg
<!-- Find lines like this -->
<text x="-80" y="40" font-size="140">⚔️</text>

<!-- Change the emoji -->
<text x="-80" y="40" font-size="140">🔥</text>
```

### Using Template

Copy `preview-template.svg` and customize:

1. **Copy the template:**
   ```bash
   cp public/images/tools/preview-template.svg public/images/tools/my-new-tool.svg
   ```

2. **Edit the new file:**
   - Change the title text
   - Update description
   - Modify colors in gradient
   - Change icons/emojis
   - Update feature badges

3. **Update MetaTags component:**
   ```jsx
   <MetaTags
     title="My New Tool"
     image="/images/tools/my-new-tool.svg"
     // ... other props
   />
   ```

## Color Schemes

Here are the current color schemes used:

```javascript
const colorSchemes = {
  skillBuilder: {
    start: '#dc2626', // Red
    end: '#f59e0b'    // Orange
  },
  spiritBuilder: {
    start: '#7c3aed', // Purple
    end: '#ec4899'    // Pink
  },
  battleLoadouts: {
    start: '#1e40af', // Blue
    end: '#0891b2'    // Cyan
  },
  soulWeapon: {
    start: '#059669', // Green
    end: '#0891b2'    // Cyan
  },
  mySpirits: {
    start: '#6366f1', // Indigo
    end: '#a855f7'    // Purple
  },
  myCollections: {
    start: '#1e40af', // Blue
    end: '#7c3aed'    // Purple
  },
  default: {
    start: '#dc2626', // Red
    end: '#7c3aed'    // Purple
  }
};
```

## Best Practices

### 1. Keep It Simple
- Don't overcrowd the image
- Use large, readable fonts
- High contrast for text
- Maximum 3-4 feature badges

### 2. Consistent Branding
- Keep logo/brand in same position
- Use consistent fonts
- Maintain similar layouts
- Use your theme colors

### 3. Performance
- SVG files are tiny (3-10KB each)
- PNG should be under 500KB
- Optimize PNGs with tools like TinyPNG
- Consider WebP format for even better compression

### 4. Accessibility
- Ensure text has sufficient contrast
- Don't rely on color alone
- Keep critical info in "safe zone" (center)

## Fallback Strategy

The MetaTags component has built-in fallbacks:

```jsx
// 1. Uses your specified image
<MetaTags image="/images/tools/skill-builder.svg" />

// 2. Falls back to wiki config logo
// wiki-config.json: "logo": "/images/logo.png"

// 3. Falls back to index.html default
// index.html: og:image = "/images/og-default.svg"
```

## Section-Specific Previews

To add previews for wiki sections (characters, equipment, etc.):

1. **Create section images:**
   ```bash
   public/images/sections/
   ├── characters.svg
   ├── equipment.svg
   ├── skills.svg
   └── spirits.svg
   ```

2. **Use in PageViewerPage (framework modification needed):**
   ```jsx
   <MetaTags
     title={metadata?.title}
     description={metadata?.description}
     image={metadata?.image || `/images/sections/${sectionId}.svg`}
   />
   ```

## Dynamic Preview Images

For user-generated content (shared builds), you can:

### Option 1: Static Template Per Type
```jsx
<MetaTags
  title={`${build.name} - Skill Build`}
  image="/images/builds/skill-build-template.svg"
/>
```

### Option 2: Server-Side Generation (Advanced)
Generate images on-the-fly using a serverless function:

```javascript
// netlify/functions/og-image.js
export async function handler(event) {
  const { title, type } = event.queryStringParameters;

  // Generate image using sharp, canvas, or puppeteer
  const image = await generateOGImage({ title, type });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/png' },
    body: image.toString('base64'),
    isBase64Encoded: true
  };
}
```

Use it:
```jsx
<MetaTags
  image={`/api/og-image?title=${encodeURIComponent(build.name)}&type=skill`}
/>
```

## Troubleshooting

### Preview not updating
- Clear cache in social platform debugger tools
- Add version query param: `image.svg?v=2`
- Wait a few hours for cache to expire

### Image not showing
- Check file path (use absolute URLs in production)
- Verify file exists and is publicly accessible
- Check file size (< 5MB for most platforms)
- Try PNG version instead of SVG

### Text looks wrong
- SVG fonts may render differently
- Use web-safe fonts (Arial, sans-serif)
- Convert text to paths for exact rendering
- Consider using PNG for text-heavy images

### Colors look different
- Different platforms render colors slightly differently
- Test on actual platforms (Discord, Twitter, etc.)
- Use high contrast to ensure readability
- Avoid very light colors on white backgrounds

## Resources

- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards)
- [Discord Embeds](https://discord.com/developers/docs/resources/channel#embed-object)
- [SVG Tutorial](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial)
- [ImageMagick Documentation](https://imagemagick.org/script/command-line-processing.php)
