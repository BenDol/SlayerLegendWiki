# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **parent wiki project** built using the [GitHub Wiki Framework](https://github.com/BenDol/GithubWiki) as a git submodule. The framework handles all React components, routing, and core functionality, while this repository contains only content, configuration, and customization.

## Architecture: Framework as Submodule

**Critical concept:** The `wiki-framework/` directory is a **git submodule** containing the entire React application. Never edit files inside `wiki-framework/` - all customizations belong in the parent project.

```
Parent Project (this repo)       Framework Submodule
├── public/content/              wiki-framework/
├── wiki-config.json            ├── src/           # React app
├── vite.config.js              ├── scripts/       # Build tools
├── main.jsx                    └── vite.config.base.js
└── package.json
```

### What Lives Where

**Parent project (edit these):**
- `public/content/` - All markdown content (11 sections, 100+ pages)
- `public/` - Static assets (images, logos, favicons, etc.)
- `public/data/` - JSON data files for data-driven pages
- `src/components/calculators/` - **Game-specific calculator components**
- `wiki-config.json` - **SOURCE OF TRUTH** for config (auto-copied to public/)
- `vite.config.js` - Base URL, content path, custom plugins, Node.js polyfills
- `main.jsx` - Entry point that imports framework App
- `scripts/` - Build scripts (copyConfig.js, buildSearchIndex.js)
- `.env.local` - GitHub OAuth credentials
- `tailwind.config.js` - Theme customization

**Auto-generated files (DO NOT EDIT):**
- `public/wiki-config.json` - Auto-copied from root (gitignored)
- `public/search-index.json` - Auto-generated search index (gitignored)

**Framework submodule (GENERIC components only):**
- `wiki-framework/src/components/` - React components
  - `wiki/DataDrivenPage.jsx` - Data-driven page system (loads JSON)
  - `wiki/BuildEncoder.jsx` - Generic data sharing via URL
  - `wiki/TierList.jsx` + `TierCard.jsx` - S/A/B/C/D tier ranking
  - `wiki/SortableTable.jsx` - Sortable/filterable tables
  - `wiki/ProgressTracker.jsx` - Checkbox progress tracking
  - `wiki/PageViewer.jsx` - Markdown page renderer
  - `common/` - Generic UI components (Button, Modal, etc.)
- `wiki-framework/src/pages/` - Page components
- `wiki-framework/src/store/` - State management
- `wiki-framework/src/hooks/` - React hooks
- `wiki-framework/scripts/` - Build scripts
- `wiki-framework/vite.config.base.js` - Base Vite configuration

## Common Development Commands

```bash
# Development
npm run dev              # Start dev server + config watcher (http://localhost:5173)
npm run dev:server       # Start ONLY dev server (no config watching)
npm run dev:watch        # Start ONLY config watcher (no dev server)
npm run build            # Build for production (auto-copies config + builds search)
npm run preview          # Preview production build
npm run build:search     # Build search index after content changes

# Manual operations
node scripts/copyConfig.js      # Manually copy wiki-config.json to public/
node scripts/buildSearchIndex.js # Manually rebuild search index

# Framework updates
cd wiki-framework
git pull origin main
cd ..
git add wiki-framework
git commit -m "Update wiki framework"
```

## Development Workflow

**Standard workflow (recommended):**
```bash
npm run dev
```
This automatically runs BOTH:
- Config watcher (auto-copies wiki-config.json changes to public/)
- Vite dev server

Now you can edit `wiki-config.json` and just refresh your browser (Ctrl+Shift+R)!

## Static Assets (Images, Logos, etc.)

All static assets should be placed in the `public/` directory at the root of your parent wiki project.

### Directory Structure
```
public/
├── logo.svg           # Wiki logo
├── favicon.ico        # Browser favicon
├── images/            # Content images
│   ├── screenshot1.png
│   └── diagram.svg
└── assets/            # Other static files
```

### Using Static Assets

**In wiki-config.json:**
```json
{
  "wiki": {
    "logo": "/logo.svg"    // Served from public/logo.svg
  }
}
```

**In markdown content:**
```markdown
![Alt text](/images/screenshot1.png)
![Diagram](/images/diagram.svg)
```

**In HTML (index.html):**
```html
<link rel="icon" type="image/svg+xml" href="/favicon.ico" />
```

### Important Notes
- Files in `public/` are served at the root path (`/`)
- Images are copied as-is to the build output (no processing)
- Use absolute paths starting with `/` to reference public assets
- For GitHub Pages, assets work the same way (base URL is handled by Vite)

## Content Management

### Creating New Pages

1. Create markdown file: `public/content/{section}/page-name.md`
2. Add frontmatter:
```markdown
---
title: Page Title
description: Brief description
tags: [tag1, tag2]
category: Documentation
date: 2025-12-12
---

# Page Content
```
3. Rebuild search index: `npm run build:search`
4. Page accessible at `/#/{section}/page-name`

### Adding New Sections

1. Edit `wiki-config.json` to add section:
```json
{
  "sections": [
    {
      "id": "tutorials",
      "title": "Tutorials",
      "path": "tutorials",
      "icon": "📚",
      "showInHeader": true,
      "allowContributions": true,
      "order": 4
    }
  ]
}
```
2. Create directory: `mkdir public/content/tutorials`
3. Add index page: `public/content/tutorials/index.md`

## Configuration Files

### wiki-config.json (ROOT - Source of Truth)
**IMPORTANT:** The root `wiki-config.json` is the single source of truth. It's automatically copied to `public/` when running `npm run dev` or `npm run build`.

**Never edit `public/wiki-config.json` directly** - it's auto-generated and gitignored.

Must update when deploying:
- `wiki.title` - Wiki name
- `wiki.description` - Wiki description
- `wiki.logo` - Path to logo (e.g., "/logo.svg")
- `wiki.repository.owner` - GitHub username
- `wiki.repository.repo` - Repository name
- `sections[]` - Navigation sections

After editing, restart dev server or run `node scripts/copyConfig.js`

### vite.config.js
Must update `base` to match repository name:
```javascript
export default createWikiConfigSync({
  base: '/your-repo-name/',  // Must match GitHub repo for GitHub Pages
  contentPath: './public/content',
});
```

### .env.local
Required for GitHub OAuth features:
```env
VITE_GITHUB_CLIENT_ID=your_client_id_here
VITE_WIKI_REPO_OWNER=yourusername
VITE_WIKI_REPO_NAME=repo-name
```

## GitHub Pages Deployment

1. **Configure repository settings:**
   - Update `base` in `vite.config.js` to match repo name
   - Update repository info in `wiki-config.json`

2. **Set up GitHub OAuth (optional):**
   - Create OAuth App at github.com/settings/developers
   - Add `GITHUB_CLIENT_ID` to repository secrets
   - Add credentials to `.env.local` for local dev

3. **Enable GitHub Pages:**
   - Repository Settings → Pages
   - Source: "GitHub Actions"

4. **Deploy:**
   - Push to `main` branch triggers automatic deployment via GitHub Actions

The wiki will be live at: `https://username.github.io/repo-name/`

## Framework Updates

To update the framework version:

```bash
cd wiki-framework
git pull origin main          # Get latest framework
cd ..
git add wiki-framework
git commit -m "Update wiki framework to latest"
git push
```

**Pinning to specific version (recommended for production):**
```bash
cd wiki-framework
git checkout v1.0.0           # Or specific commit hash
cd ..
git add wiki-framework
git commit -m "Pin framework to v1.0.0"
```

## Debugging

### Developer Tools Panel
Press `Ctrl+Shift+D` to open the Developer Tools panel for:
- Live error tracking
- Console logs capture
- Filter by log type (Error, Warning, Info)
- Export logs

### Log Files
All logs are written to: `logs/debug.log`

**When debugging issues:**
1. Check `logs/debug.log` for detailed error traces
2. Use Dev Panel (`Ctrl+Shift+D`) for real-time monitoring
3. Clear browser cache if changes not appearing
4. Rebuild search index after content changes

### Keyboard Shortcuts
- `Ctrl+K` - Open search modal
- `Ctrl+Shift+D` - Toggle Developer Tools panel

## Submodule Management

### Initial Clone
Always use `--recursive` to include framework:
```bash
git clone --recursive <repo-url>
```

### If Submodule Missing
```bash
git submodule update --init --recursive
```

### Viewing Submodule Status
```bash
git submodule status
```

## New Framework Features

### Data-Driven Pages
Load content from JSON files for easy updates:
```javascript
import DataDrivenPage from './wiki-framework/src/components/wiki/DataDrivenPage';

<DataDrivenPage
  dataFile="equipment.json"
  renderData={(data) => <EquipmentList items={data.weapons} />}
/>
```

Data files location: `public/data/`
- `equipment.json` - Weapons and accessories
- `skills.json` - All skills by element
- `companions.json` - Companion data
- `classes.json` - Class information
- `relics.json` - Relic data
- `drop-tables.json` - Drop rates
- `formulas.json` - Game formulas
- `promotions.json` - Promotion tiers

### Build Sharing System
Share character builds via URL:
```javascript
import BuildEncoder, { encodeBuild, generateBuildURL } from './components/wiki/BuildEncoder';

const build = {
  name: "Fire DPS Build",
  skills: [...],
  stats: {...},
  equipment: {...}
};

const url = generateBuildURL(build); // Returns shareable URL
```

Builds are encoded in URL hash: `/#/build?data=encodedString`

### Game-Specific Calculators
Four calculator components for Slayer Legend mechanics (located in `src/components/calculators/`):
1. **DamageCalculator** - Calculate damage output with Attack, Crit, Elemental stats
2. **EnhancementCalculator** - Calculate gold costs for equipment enhancement
3. **FusionCalculator** - Plan equipment fusion with 5:1 ratio
4. **StatCalculator** - Calculate stat changes after promotion

**Note:** These are game-specific and live in the parent project, NOT the framework.

Usage in markdown pages:
```markdown
---
title: Damage Calculator
---

# Damage Calculator

<DamageCalculator />
```

The markdown processor automatically resolves components from `src/components/calculators/`.

### Tier Lists
Visual tier list component:
```javascript
import TierList from './components/wiki/TierList';

const items = [
  { name: "Fireball", tier: "S", category: "Fire Skills", image: "/images/skills/fireball.png" },
  { name: "Water Shield", tier: "A", category: "Water Skills" }
];

<TierList items={items} onItemClick={(item) => console.log(item)} />
```

Tiers: S, A, B, C, D with color coding

### Sortable Tables
Data tables with sort, filter, pagination:
```javascript
import SortableTable from './components/wiki/SortableTable';

const data = [
  { name: "Common Sword", attack: 50, grade: "Common" },
  { name: "Rare Sword", attack: 400, grade: "Rare" }
];

const columns = [
  { key: "name", label: "Name" },
  { key: "attack", label: "Attack" },
  { key: "grade", label: "Grade" }
];

<SortableTable data={data} columns={columns} pageSize={20} />
```

### Progress Tracker
Track player progression with localStorage persistence:
```javascript
import ProgressTracker from './components/wiki/ProgressTracker';

const items = [
  "Clear Stage 100",
  "Unlock all companions",
  "Reach Bronze promotion"
];

<ProgressTracker category="Early Game" items={items} />
```

Features:
- Checkbox progress tracking
- Progress percentage
- Export/import progress
- Persistent across sessions

## Wiki Content Structure

### Sections (11 total)
1. **Getting Started** (🎮) - New player guides
2. **Characters** (⚔️) - Stats, promotions, enhancement
3. **Equipment** (🛡️) - Weapons, accessories, soul weapons
4. **Companions** (🤝) - Ellie, Zeke, Miho, Luna
5. **Skills** (✨) - Fire/Water/Earth/Wind skills
6. **Content** (🗺️) - Stages, dungeons, events
7. **Progression** (📈) - Memory Tree, classes, familiars
8. **Resources** (💎) - Gold, diamonds, materials
9. **Guides** (📚) - Strategy guides, tier lists
10. **Database** (📖) - Data tables (hidden from header)
11. **Tools** (🛠️) - Calculators and planners

### Page Count
- Getting Started: 5 pages
- Characters: 7 pages
- Equipment: 8 pages
- Companions: 7 pages
- Skills: 10 pages
- Content: 10 pages
- Progression: 8 pages
- Resources: 12 pages
- Guides: 11 pages
- Database: 7 pages
- Tools: 6 pages

**Total: 91 content pages**

## Important Constraints

1. **Never modify `wiki-framework/` files** - The framework is a submodule containing generic wiki functionality only
2. **Game-specific components belong in `src/components/`** - Keep the framework generic and reusable
3. **Always rebuild search index** after adding/editing content: `npm run build:search`
4. **Base URL must match repo name** for GitHub Pages deployment
5. **Restart dev server** after configuration changes
6. **Use frontmatter** on all markdown files for proper indexing
7. **Data files must be valid JSON** in `public/data/` directory

## Adding New Components

### When to add to parent project (`src/components/`):
- Game-specific mechanics or formulas
- Slayer Legend-specific data structures
- Components that won't work for other wikis

### When to add to framework (requires submodule update):
- Generic wiki utilities
- Reusable across ANY wiki topic
- No assumptions about content domain

**See `COMPONENTS-MOVED.md` for detailed guidelines.**
