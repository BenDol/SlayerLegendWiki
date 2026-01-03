# Public Assets Directory

This directory contains static assets that are served directly at the root URL of your wiki.

## What Goes Here

- **logo.svg** - Your wiki logo (referenced in wiki-config.json)
- **favicon.ico** - Browser favicon
- **images/** - Images used in your markdown content
- **assets/** - Other static files (PDFs, downloads, etc.)

## How to Use

### Wiki Logo
Add your logo and reference it in `wiki-config.json`:
```json
{
  "wiki": {
    "logo": "/logo.svg"
  }
}
```

### Images in Markdown
Place images in `public/images/` and reference them in your content:
```markdown
![Screenshot](/images/content/my-screenshot.png)
```

### Favicon
Replace the default favicon in your `index.html`:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.ico" />
```

## File Organization

```
public/
├── README.md              # This file
├── logo.svg               # Wiki logo
├── favicon.ico            # Browser tab icon
├── images/                # Content images
│   ├── screenshots/
│   ├── diagrams/
│   └── icons/
└── assets/                # Other static files
    ├── downloads/
    └── documents/
```

## Important Notes

- All files here are served at the root path (`/filename`)
- Files are copied as-is during build (no processing)
- Keep file sizes reasonable for faster loading
- Use web-optimized formats (SVG, WebP, optimized PNG/JPG)
