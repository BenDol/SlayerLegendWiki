# Wiki Template

This is a template repository for creating new wikis using the [GitHub Wiki Framework](https://github.com/BenDol/GithubWiki).

> **✨ Click "Use this template" on GitHub to create your own wiki!**

## Quick Start

### 1. Clone with Submodule

```bash
git clone --recursive https://github.com/yourusername/my-wiki.git
cd my-wiki
```

If you already cloned without `--recursive`:

```bash
git submodule init
git submodule update
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Your Wiki

Edit `wiki-config.json` to customize your wiki settings:

- Title, description, logo
- Repository information
- Sections and navigation
- Features to enable/disable

### 4. Set Up GitHub OAuth (Optional)

For editing features, create a `.env.local` file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your GitHub OAuth Client ID:

```env
VITE_GITHUB_CLIENT_ID=your_client_id_here
VITE_WIKI_REPO_OWNER=yourusername
VITE_WIKI_REPO_NAME=my-wiki
```

See [GitHub OAuth Setup](../wiki-framework/DEPLOYMENT.md#step-2-set-up-github-oauth) for details.

### 5. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` to see your wiki!

## Project Structure

```
my-wiki/
├── wiki-framework/        # Framework submodule (don't edit!)
├── public/                # YOUR static assets
│   ├── content/          # YOUR markdown content
│   │   ├── getting-started/
│   │   ├── guides/
│   │   └── reference/
│   └── logo.svg
├── wiki-config.json      # YOUR wiki configuration
├── package.json          # YOUR dependencies
├── vite.config.js       # YOUR Vite config (extends framework)
└── .env.local            # YOUR environment variables
```

## Adding Content

### Create a New Page

1. Create a markdown file in `public/content/{section}/my-page.md`
2. Add frontmatter:

```markdown
---
title: My Page
description: A brief description
tags: [tag1, tag2]
category: Documentation
date: 2025-12-13
---

# My Page

Your content here...
```

3. Rebuild search index:

```bash
npm run build:search
```

4. Your page is now accessible at `/#/{section}/my-page`

### Create a New Section

1. Edit `wiki-config.json` and add a new section:

```json
{
  "sections": [
    {
      "id": "my-section",
      "title": "My Section",
      "path": "my-section",
      "showInHeader": true,
      "allowContributions": true,
      "order": 4
    }
  ]
}
```

2. Create content directory:

```bash
mkdir -p public/content/my-section
```

3. Add an index page:

```bash
echo "---\ntitle: My Section\n---\n\n# My Section" > public/content/my-section/index.md
```

## Updating the Framework

To get the latest framework updates:

```bash
cd wiki-framework
git pull origin main
cd ..
git add wiki-framework
git commit -m "Update wiki framework"
```

## Building for Production

```bash
npm run build
```

The built site will be in the `dist/` directory.

## Deployment

See [Deployment Guide](./wiki-framework/DEPLOYMENT.md) for deploying to GitHub Pages.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run build:search # Build search index
```

## Customization

### Customize Theme

Edit `tailwind.config.js` to override framework theme settings.

### Customize Base URL

Edit `vite.config.js` and change the `base` option:

```javascript
export default createWikiConfigSync({
  base: '/my-wiki/',  // Must match your repo name for GitHub Pages
});
```

### Add Custom Plugins

Add Vite plugins in `vite.config.js`:

```javascript
import myPlugin from './my-plugin.js';

export default createWikiConfigSync({
  plugins: [myPlugin()],
});
```

## Troubleshooting

### Submodule is Empty

```bash
git submodule update --init --recursive
```

### Changes Not Showing

1. Restart dev server
2. Clear browser cache
3. Rebuild search index: `npm run build:search`

### Framework Updates Breaking Your Wiki

Pin the framework to a specific commit:

```bash
cd wiki-framework
git checkout <commit-hash>
cd ..
git add wiki-framework
git commit -m "Pin framework version"
```

## Support

- [Framework Documentation](../wiki-framework/README.md)
- [Deployment Guide](../wiki-framework/DEPLOYMENT.md)
- [Report Issues](https://github.com/yourusername/wiki-framework/issues)
