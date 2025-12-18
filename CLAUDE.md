# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **parent wiki project** built using the [GitHub Wiki Framework](https://github.com/BenDol/GithubWiki) as a git submodule. The framework handles all React components, routing, and core functionality, while this repository contains only content, configuration, and customization.

## Architecture: Framework as Submodule

**Critical concept:** The `wiki-framework/` directory is a **git submodule** containing the entire React application. Never edit files inside `wiki-framework/` - all customizations belong in the parent project.

**CRITICAL RULE: The framework submodule must NEVER import from the parent project.** The framework is designed to be generic and reusable. Any game-specific logic must live in the parent project and be registered via the Content Renderer Registry (see below).

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
- `research/` - Research indexes and useful information (use this when adding content to the wiki)
- `external/` - External tooling and assets (GITIGNORED)
  - `scripts/` - Python scripts for data extraction, image processing, and automation
  - `reports/` - Generated reports and summaries from processing tasks
  - `backups/` - Automated backups from image processing operations
  - `image-backup/` - Original images backed up before quality reduction
  - `decompiled/` - Decompiled APK assets for data extraction

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

## Registry Patterns

The framework provides registry systems for parent projects to add custom functionality without modifying framework code. This ensures the framework remains generic and reusable.

### Content Renderer Registry

**How to Add Game-Specific Markdown Rendering**

### Architecture
1. **Framework** provides `contentRendererRegistry.js` with `register*()` functions
2. **Parent project** creates game-specific renderers in `src/utils/gameContentRenderer.js`
3. **Parent's main.jsx** registers the renderers on app startup

### Example: Skill Card Rendering

**Step 1:** Create custom renderer in parent project (`src/utils/gameContentRenderer.js`):
```javascript
import SkillCard from '../components/SkillCard';

export const processGameSyntax = (content) => {
  // Convert <!-- skill:NAME --> to {{SKILL:NAME}}
  return content.replace(/<!--\s*skill:\s*(.+?)\s*-->/gi, '{{SKILL:$1}}');
};

export const getGameComponents = () => ({
  p: ({ children, ...props }) => {
    const content = String(children).trim();
    const match = content.match(/^\{\{SKILL:(.+?)\}\}$/);
    if (match) {
      return <SkillCard name={match[1]} />;
    }
    return <p {...props}>{children}</p>;
  }
});
```

**Step 2:** Register in `main.jsx`:
```javascript
import { registerContentProcessor, registerCustomComponents } from './wiki-framework/src/utils/contentRendererRegistry.js';
import { processGameSyntax, getGameComponents } from './src/utils/gameContentRenderer.js';

registerContentProcessor(processGameSyntax);
registerCustomComponents(getGameComponents());
```

**Step 3:** Use in markdown:
```markdown
# Fire Skills

<!-- skill:Fire Slash -->

This skill does fire damage.
```

The framework's PageViewer and PageEditor automatically use registered renderers without knowing about SkillCard.

### Files Involved
- **Framework (generic):**
  - `wiki-framework/src/utils/contentRendererRegistry.js` - Registry
  - `wiki-framework/src/components/wiki/PageViewer.jsx` - Uses registry
  - `wiki-framework/src/components/wiki/PageEditor.jsx` - Passes to PageViewer
  - `wiki-framework/src/pages/PageEditorPage.jsx` - Passes to PageEditor
- **Parent (game-specific):**
  - `src/utils/gameContentRenderer.js` - Custom renderers
  - `src/components/SkillCard.jsx` - Game component
  - `main.jsx` - Registration

**IMPORTANT:** Never import parent components in framework files. Always use the registry pattern.

### Route Registry

**How to Add Game-Specific Routes**

The framework provides a route registry system for adding custom routes (tools, simulators, etc.) without modifying the framework router.

#### Architecture
1. **Framework** provides `routeRegistry.js` with `registerCustomRoutes()` function
2. **Parent project** creates game-specific page components in `src/pages/`
3. **Parent's main.jsx** registers the routes on app startup

#### Example: Skill Build Simulator

**Step 1:** Create page component in parent project (`src/pages/SkillBuildSimulatorPage.jsx`):
```javascript
import SkillBuildSimulator from '../components/SkillBuildSimulator';

const SkillBuildSimulatorPage = () => {
  return <SkillBuildSimulator />;
};

export default SkillBuildSimulatorPage;
```

**Step 2:** Register in `main.jsx`:
```javascript
import { registerCustomRoutes } from './wiki-framework/src/utils/routeRegistry.js';
import SkillBuildSimulatorPage from './src/pages/SkillBuildSimulatorPage.jsx';

registerCustomRoutes([
  {
    path: 'skill-builder',
    component: <SkillBuildSimulatorPage />,
    suspense: true  // Optional, defaults to true
  }
]);
```

**Step 3:** Access at: `/#/skill-builder`

The framework router automatically includes all registered custom routes at runtime.

#### Files Involved
- **Framework (generic):**
  - `wiki-framework/src/utils/routeRegistry.js` - Registry system
  - `wiki-framework/src/router.jsx` - Uses `getCustomRoutes()`
- **Parent (game-specific):**
  - `src/pages/SkillBuildSimulatorPage.jsx` - Custom page
  - `src/components/SkillBuildSimulator.jsx` - Custom component
  - `main.jsx` - Registration

**IMPORTANT:** Never import parent routes/pages in framework router. Always use the route registry pattern.

## Framework React Hooks

The framework provides reusable React hooks that are generic and can be used by any wiki project. These hooks live in `wiki-framework/src/hooks/` and should be imported from there.

### useDraftStorage Hook

**Location:** `wiki-framework/src/hooks/useDraftStorage.js`

A generic hook for localStorage-based draft auto-save functionality. Perfect for builders, forms, or any component that needs to preserve user input across sessions.

**Features:**
- Debounced auto-save (configurable delay, default 1 second)
- User-specific storage keys (supports anonymous users)
- Modal mode (disable auto-save/load when in modal)
- Auto-load on mount
- Manual clear functionality

**Usage Example:**
```javascript
import { useDraftStorage } from '../../wiki-framework/src/hooks/useDraftStorage';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';

const MyBuilder = ({ isModal = false }) => {
  const { user } = useAuthStore();
  const [buildName, setBuildName] = useState('');
  const [buildData, setBuildData] = useState({});

  // Initialize draft storage
  const { loadDraft, clearDraft, isDraftAvailable } = useDraftStorage(
    'myBuilder',           // Storage key prefix
    user,                  // User object (or null for anonymous)
    isModal,              // Disable in modal mode
    { buildName, buildData }, // Data to auto-save
    1000                  // Debounce delay (ms)
  );

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setBuildName(draft.buildName || '');
      setBuildData(draft.buildData || {});
    }
  }, []);

  // Clear draft after successful save
  const handleSave = async () => {
    await saveToBackend();
    clearDraft(); // Remove draft from localStorage
  };

  // Clear draft on reset
  const handleClear = () => {
    setBuildName('');
    setBuildData({});
    clearDraft();
  };
};
```

**Parameters:**
- `storageKey` (string) - Base key for localStorage (e.g., 'skillBuilder', 'spiritBuilder')
- `user` (object|null) - User object with `id` property, or null for anonymous
- `isModal` (boolean) - If true, disables auto-save/load (for modal mode)
- `draftData` (object) - Data to save to localStorage (auto-saved on change)
- `debounceMs` (number) - Debounce delay in milliseconds (default: 1000)

**Returns:**
- `loadDraft()` - Function to load draft from localStorage
- `clearDraft()` - Function to clear draft from localStorage
- `isDraftAvailable()` - Function to check if draft exists

**Storage Key Format:**
`{storageKey}_draft_{userId}` (e.g., `skillBuilder_draft_123456` or `skillBuilder_draft_anonymous`)

**When to Use:**
- Form builders (skill, spirit, loadout builders)
- Multi-step wizards
- Content editors
- Any component where losing user input would be frustrating

**Important Notes:**
- This hook was moved from parent project to framework to avoid code duplication
- Used by SkillBuilder, SpiritBuilder, and BattleLoadouts in the parent project
- Modal mode disables auto-save to prevent conflicts with parent page state
- Always clear draft after successful backend save to avoid stale data

## Common Development Commands

```bash
# Development
npm run dev              # Start Netlify dev + config watcher (http://localhost:8888)
                         # Includes Netlify functions support for skill builds, etc.
npm run dev:vite         # Start Vite-only dev + config watcher (http://localhost:5173)
                         # Faster startup, no Netlify functions
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

## Git Workflow

**IMPORTANT: Claude should NEVER handle git commits or pushes.**

- User will handle all git commits and pushes manually
- Claude should make code changes and edits as requested
- Claude should NOT use `git add`, `git commit`, or `git push` commands
- User prefers to review changes and commit them manually with their own messages

**CRITICAL: Do NOT perform git operations in the wiki-framework/ submodule:**
- The submodule is often in detached HEAD state - this is normal
- Do NOT use `git checkout`, `git add`, `git commit` in the submodule directory
- Do NOT attempt to fix detached HEAD state
- wiki-framework submodule project should NEVER reference code from the parent project
- User will handle all submodule git operations manually

## Dev Server Management

**IMPORTANT: Claude should NEVER start the dev server.**

- User will start and stop the dev server manually
- Claude should make code changes and edits as requested
- Claude should NOT use `npm run dev`, `npm run dev:server`, or `npm run dev:vite` commands
- User prefers to control when the server runs
- After making changes, inform the user they may need to restart the server if it's running

## Development Workflow

**Standard workflow (recommended):**
```bash
npm run dev
```
This automatically runs BOTH:
- Config watcher (auto-copies wiki-config.json changes to public/)
- Netlify dev server (includes Netlify functions for skill builds, etc.)

The server runs at `http://localhost:8888` with full Netlify functions support.

Now you can edit `wiki-config.json` and just refresh your browser (Ctrl+Shift+R)!

**Alternative workflow (Vite-only, faster startup):**
```bash
npm run dev:vite
```
Runs at `http://localhost:5173` without Netlify functions. Useful when you don't need serverless functions.

## Static Assets (Images, Logos, etc.)

All static assets should be placed in the `public/` directory at the root of your parent wiki project.

### Directory Structure
```
public/
├── site.webmanifest           # Web app manifest
├── icon/                      # App icons and favicons
│   ├── favicon.ico            # Browser favicon (16x16, 32x32, 48x48)
│   ├── favicon-16x16.png      # 16x16 PNG favicon
│   ├── favicon-32x32.png      # 32x32 PNG favicon
│   ├── apple-touch-icon.png   # Apple touch icon (180x180)
│   ├── android-chrome-192x192.png  # Android icon (192x192)
│   └── android-chrome-512x512.png  # Android icon (512x512)
├── images/                    # Content images and wiki logo
│   ├── logo.png               # Wiki logo
│   ├── screenshot1.png
│   └── diagram.svg
└── assets/                    # Other static files
```

### Using Static Assets

**In wiki-config.json:**
```json
{
  "wiki": {
    "logo": "/images/logo.png",       // Served from public/images/logo.png
    "favicon": "/icon/favicon.ico",   // Served from public/icon/favicon.ico
    "manifest": "/site.webmanifest",  // Served from public/site.webmanifest
    "themeColor": "#3b82f6"           // Browser theme color (mobile)
  }
}
```

**In markdown content:**
```markdown
![Alt text](/images/screenshot1.png)
![Diagram](/images/diagram.svg)
```

**Note:** The favicon is automatically loaded from wiki-config.json. No need to edit index.html!

### Important Notes
- Files in `public/` are served at the root path (`/`)
- Images are copied as-is to the build output (no processing)
- Use absolute paths starting with `/` to reference public assets
- For GitHub Pages, assets work the same way (base URL is handled by Vite)

## Progressive Web App (PWA) Support

The wiki supports Progressive Web App features through the web app manifest file.

### Web App Manifest Configuration

**1. Create manifest file:** Place `site.webmanifest` in `public/` directory

Example `public/site.webmanifest`:
```json
{
  "name": "My Wiki",
  "short_name": "Wiki",
  "description": "My awesome wiki",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#3b82f6",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon/apple-touch-icon.png",
      "sizes": "180x180",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

**2. Configure in wiki-config.json:**
```json
{
  "wiki": {
    "manifest": "/site.webmanifest",
    "themeColor": "#3b82f6"
  }
}
```

**3. Create app icons:** Place PNG icons in `public/icon/`
- `android-chrome-192x192.png` - 192x192px icon for Android
- `android-chrome-512x512.png` - 512x512px icon for Android
- `apple-touch-icon.png` - 180x180px icon for iOS
- `favicon.ico` - Multi-size ICO file for browsers

### PWA Benefits
- **Install to Home Screen**: Users can install your wiki as a standalone app on mobile/desktop
- **Offline Support**: With service workers, content can be cached for offline access
- **Native App Feel**: Runs in standalone window without browser UI
- **Custom Theme**: Control the browser theme color on mobile devices

### Theme Color
The `themeColor` in wiki-config.json sets the mobile browser's address bar color to match your wiki's branding.

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

#### Navigation Structure

The wiki uses a hierarchical navigation system:

**Categories** → **Sections** → **Pages**

- **Categories**: Top-level groups in the header with dropdown menus (e.g., "Gameplay", "Content")
- **Sections**: Content areas within categories (e.g., "Characters", "Equipment")
- **Pages**: Individual markdown pages within sections (e.g., "promotions.md")

**Sidebar Configuration:**
The sidebar is separate from the category/section hierarchy and shows important meta pages:
- Home link
- Contributing guide
- Editing guidelines

Example structure:
```json
{
  "categories": [
    {
      "id": "gameplay",
      "title": "Gameplay",
      "icon": "⚔️",
      "order": 1,
      "sections": ["getting-started", "characters", "equipment"]
    }
  ],
  "sections": [
    {
      "id": "characters",
      "title": "Characters",
      "path": "characters",
      "icon": "⚔️",
      "allowContributions": true,
      "order": 2
    }
  ],
  "sidebar": {
    "pages": [
      { "title": "Home", "path": "/", "icon": "🏠" },
      { "title": "Contributing", "path": "/meta/contributing", "icon": "✍️" }
    ]
  }
}
```

Must update when deploying:
- `wiki.title` - Wiki name
- `wiki.description` - Wiki description
- `wiki.url` - Production URL (e.g., "https://slayerlegend.wiki") - Used in comment issue links
- `wiki.logo` - Path to logo (e.g., "/logo.svg")
- `wiki.favicon` - Path to favicon (e.g., "/favicon.ico", "/favicon.png", "/favicon.svg")
- `wiki.manifest` - Path to web app manifest (e.g., "/site.webmanifest")
- `wiki.themeColor` - Browser theme color for mobile (e.g., "#3b82f6")
- `wiki.repository.owner` - GitHub username
- `wiki.repository.repo` - Repository name
- `sections[]` - Navigation sections
- `features.autoFormatPageTitles` - Auto-format page titles (see below)

After editing, restart dev server or run `node scripts/copyConfig.js`

**Auto-Format Page Titles Feature:**
When `features.autoFormatPageTitles` is enabled, page filenames are automatically formatted for display:
- Replaces hyphens with spaces: `getting-started` → `Getting Started`
- Capitalizes first letter of each word: `early-game-roadmap` → `Early Game Roadmap`
- Only applies when no explicit `title` is set in frontmatter
- Affects breadcrumbs and section page listings

Example:
```json
{
  "features": {
    "autoFormatPageTitles": true
  }
}
```

**Custom Home Page Feature:**
When `features.customHomePage.enabled` is true, the home page displays a custom markdown file instead of the default sections grid:
- Set `enabled: true` to activate custom home page
- Set `path` to the markdown file location relative to `public/content/` (default: "home.md")
- Create the markdown file at `public/content/[path]` with frontmatter
- Falls back to error page if file not found
- Disabled by default (shows default home page with sections grid)

Example:
```json
{
  "features": {
    "customHomePage": {
      "enabled": true,
      "path": "home.md"
    }
  }
}
```

Then create `public/content/home.md`:
```markdown
---
title: Welcome to Our Wiki
description: Custom home page content
---

# Welcome!

Your custom home page content here...
```

**Direct Commit Feature:**
When `features.editRequestCreator.permissions.allowDirectCommit` is enabled, users with write access to the repository can commit directly to the main branch, bypassing the pull request workflow:

- **Default: `false`** - All edits create pull requests (safer, allows review)
- **When `true`** - Contributors with write access commit directly to main branch
- Only affects authenticated users with write/admin permissions
- Users without write access still use the fork/PR workflow
- Works for creating/editing pages

**Delete operations** have a separate control (`allowDirectCommitDelete`):
- **Default: `false`** - Deletes always create PRs, even when `allowDirectCommit` is true
- **When `true`** - Contributors can delete pages directly from main branch
- Requires **both** `allowDirectCommit` AND `allowDirectCommitDelete` to be true
- Recommended to keep `false` for safety (deletes are permanent)

**When to enable:**
- Small teams with trusted contributors
- Internal wikis where review is not needed
- Faster workflow for experienced contributors

**When to keep disabled (recommended):**
- Public wikis with many contributors
- When you want to review all changes
- To maintain audit trail through PRs
- To prevent accidental changes
- **Always for deletes** - extra safety for destructive operations

Example:
```json
{
  "features": {
    "editRequestCreator": {
      "permissions": {
        "requireAuth": true,
        "fallbackToFork": true,
        "allowDirectCommit": false,
        "allowDirectCommitDelete": false
      }
    }
  }
}
```

**Behavior:**
- **allowDirectCommit: false** → All operations create PRs
- **allowDirectCommit: true, allowDirectCommitDelete: false** (recommended) → Edits commit directly, deletes create PRs
- **allowDirectCommit: true, allowDirectCommitDelete: true** → Both edits and deletes commit directly
- Confirmation dialogs update to indicate immediate vs. PR-based changes

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

# REQUIRED for Comments: Bot token
# Bot account creates all comment issues (prevents users from closing them)
# Without this token, comments will be disabled entirely
VITE_WIKI_BOT_TOKEN=your_bot_token_here
```

**Bot Token Setup (REQUIRED for Comments):**
The bot token is required for the comment system to work. The bot account creates all comment issues, preventing regular users from closing them. Without this token, comments will be completely disabled.

1. Create a bot GitHub account (e.g., `slayerlegend-wiki-bot`)
2. Add bot as repository collaborator (Write access)
3. Generate Personal Access Token for bot (`repo` scope)
4. Add token to `.env.local` as `VITE_WIKI_BOT_TOKEN`
5. Add token to GitHub Secrets as `WIKI_BOT_TOKEN`

**Note:** Use `WIKI_BOT_TOKEN` (not `GITHUB_BOT_TOKEN`) - GitHub reserves the `GITHUB_*` prefix.

**See `BOT-SETUP.md` for complete setup instructions.**

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

## Label Management

The wiki uses a centralized label management system to ensure all required labels exist before users need them.

**Problem:** Regular users without write access cannot create labels, causing failures when they try to comment on pages or perform other actions requiring labels.

**Solution:** All labels are defined in `wiki-framework/.github/labels.json` and automatically synced to the repository via GitHub Actions.

### Label Configuration

**Location:** `wiki-framework/.github/labels.json`

This file is the single source of truth for all repository labels used by:
- Comment system (`wiki-comments`, `wiki:comment`)
- Pull requests (`wiki-edit`, `documentation`)
- Section organization (`section:*`)
- Status tracking (`status:*`)
- Branch namespacing (`branch:*`)

### Automatic Synchronization

**Workflow:** `.github/workflows/sync-labels.yml`

Labels are automatically synced when:
1. `wiki-framework/.github/labels.json` is modified and the framework submodule is updated
2. Weekly (every Sunday at 00:00 UTC)
3. Manually triggered via Actions tab

The workflow:
- Reads label definitions from `wiki-framework/.github/labels.json`
- Creates missing labels in the repository
- Updates existing labels if colors/descriptions changed
- Reports statistics on changes made

### Adding New Labels

When you need to add a new label:

1. **Update `wiki-framework/.github/labels.json`:**
   ```json
   {
     "name": "your-new-label",
     "description": "What this label means",
     "color": "0075ca"
   }
   ```

2. **If used by framework code**, update `wiki-framework/src/services/github/issueLabels.js`:
   ```javascript
   export const WIKI_LABELS = {
     types: [
       {
         name: 'your-new-label',
         description: 'What this label means',
         color: '0075ca',
       },
     ],
   };
   ```

3. **Commit and push** - The GitHub Action will automatically create the label

**See `LABELS.md` for complete documentation on the label management system.**

## Admin System

The wiki includes a comprehensive admin system for managing users and moderators.

### Features

- **User Banning**: Repository owner and admins can ban users from commenting
- **Admin Management**: Repository owner can designate trusted administrators
- **GitHub Issue Storage**: Admin/banned user lists stored securely in GitHub issues
- **Bot-Managed**: Uses bot account to prevent tampering
- **Full Audit Trail**: All actions tracked in issue history

### Access

**Admin Panel:** `/#/admin`

**Who can access:**
- Repository owner (always has access)
- Designated administrators

**Access from:** User menu → "Admin Panel" (only visible to admins/owner)

### User Roles

**Repository Owner:**
- Full admin access (cannot be removed)
- Can add/remove administrators
- Can ban/unban anyone (including admins)

**Administrators:**
- Can ban/unban regular users
- Cannot manage other admins
- Cannot ban other admins or owner
- Can be removed by owner

**Banned Users:**
- Cannot post comments
- Can still view wiki content
- Can be unbanned by owner/admins

### Quick Start

1. **Configure bot token** (required - see `BOT-SETUP.md`)
2. **Sign in** as repository owner
3. **Navigate to** `/#/admin` (or click "Admin Panel" in user menu)
4. **Manage users:**
   - **Banned Users tab**: Ban/unban users from commenting
   - **Administrators tab**: Add/remove admins (owner only)

### Technical Details

**Storage:**
- Admins list: GitHub issue with label `wiki-admin:admins`
- Banned users list: GitHub issue with label `wiki-admin:banned-users`
- Both issues are locked to prevent tampering
- Bot account manages both issues

**Integration:**
- Comments component checks ban status before allowing comments
- User menu shows admin link for admins/owner only
- Admin panel validates permissions before allowing actions

**See `ADMIN-SYSTEM.md` for complete documentation.**

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
All logs are written to: `wiki-framework/logs/debug.log`

**IMPORTANT: The log file updates in real-time as the application runs.**
- Claude can read the logs directly using: `cat wiki-framework/logs/debug.log | tail -50`
- Logs include console.log, console.error, console.warn from the browser
- Use `tail -50` to see recent logs, or search for specific patterns

**When debugging issues:**
1. **Check `wiki-framework/logs/debug.log` for detailed error traces** (updates live!)
2. Use Dev Panel (`Ctrl+Shift+D`) for real-time monitoring in the browser
3. Clear browser cache if changes not appearing
4. Rebuild search index after content changes
5. For component debugging, add `console.log()` and check the debug.log file

### Prestige System
The prestige badge system is fully documented in `PRESTIGE.md`. Key points:
- Enable/disable via `public/wiki-config.json`: `prestige.enabled`
- Badges appear on all user avatars throughout the app
- Currently only shows for authenticated user
- Architecture ready for multi-user support
- Debug logs available in browser console (search for "PrestigeAvatar")

### Contributor Highscore
The contributor highscore feature displays a ranked leaderboard of wiki contributors based on their pull request activity.

**Configuration** (`features.contributorHighscore` in wiki-config.json):
```json
{
  "features": {
    "contributorHighscore": {
      "enabled": true,
      "cacheMinutes": 30,
      "displayLimit": 100,
      "ignoreRepositoryOwner": false,
      "ignoreMainContributors": false
    }
  }
}
```

**Configuration Options:**
- `enabled` - Enable/disable the highscore feature (default: false)
- `cacheMinutes` - Cache duration in minutes before data refreshes (default: 30)
- `displayLimit` - Number of contributors to show initially before "Show All" button (default: 100)
- `ignoreRepositoryOwner` - Exclude the repository owner from the highscore list (default: false)
- `ignoreMainContributors` - Exclude repository collaborators (users with contributor role) from the highscore list (default: false)
  - Useful for highlighting community contributions by removing core team members
  - Only excludes users who have been explicitly added as collaborators to the repository

**Features:**
- **Podium Display**: Top 3 contributors shown on visual podium with special styling
- **Ranked List**: All other contributors displayed in ordered list
- **Show More/Less**: Configurable toggle button appears when total contributors exceeds `displayLimit`
- **Caching**: Results cached to reduce GitHub API calls
- **Force Refresh**: Repository owners can manually refresh cached data
- **Scoring**: Based on GitHub commit contributions (uses GitHub API's contributor statistics)
- **Filtering**: Option to exclude repository owner and/or main contributors from leaderboard

**Access:** Available at `/#/contributor-highscore` route

### Keyboard Shortcuts
- `Ctrl+K` - Open search modal
- `Ctrl+Shift+D` - Toggle Developer Tools panel

### Error Handling
The framework includes two types of error boundaries for better error recovery:

**1. RouteErrorBoundary** (`wiki-framework/src/components/common/RouteErrorBoundary.jsx`)
- Catches errors in route components using React Router's `errorElement`
- Handles 404, 403, 500, and generic errors
- Provides user-friendly error UI with navigation options
- Automatically logs errors to debug system

**2. ErrorBoundary** (`wiki-framework/src/components/common/ErrorBoundary.jsx`)
- Class-based boundary for component-level errors
- Catches rendering errors in component tree
- Shows error details in development mode
- Logs errors to debug system

**Error Recovery Options:**
- **Go Back** - Return to previous page
- **Go Home** - Navigate to homepage
- **Reload Page** - Refresh the application
- **Developer Tools** - Open debug panel (Ctrl+Shift+D)

All errors are automatically logged to `logs/debug.log` for analysis.

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

### Game-Specific Components

These components are specific to Slayer Legend and live in the parent project (`src/components/`), NOT the framework.

#### Calculators
Four calculator components for Slayer Legend mechanics (located in `src/components/calculators/`):
1. **DamageCalculator** - Calculate damage output with Attack, Crit, Elemental stats
2. **EnhancementCalculator** - Calculate gold costs for equipment enhancement
3. **FusionCalculator** - Plan equipment fusion with 5:1 ratio
4. **StatCalculator** - Calculate stat changes after promotion

#### SkillCard Component
Beautiful card component for displaying skill information (located in `src/components/SkillCard.jsx`):

Features:
- Automatically loads skill data from `/data/skills.json`
- Color-coded by element (Fire, Water, Wind, Earth)
- Displays all skill stats (MP Cost, Cooldown, Range, Power, etc.)
- Full dark mode support
- Calculates max level damage automatically

Usage:
```jsx
import SkillCard from '../components/SkillCard';

// By skill name
<SkillCard name="Fire Slash" />

// By skill ID
<SkillCard id={1} />

// With direct data
<SkillCard skill={{...skillData}} />
```

See `src/components/README-SkillCard.md` for complete documentation.

Example implementation: `src/pages/SkillsPage.jsx` (filterable skill gallery)

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

## Security

### HTML Injection Protection

The wiki uses `rehype-sanitize` to protect against XSS and HTML injection attacks while allowing safe HTML for wiki features.

**Protected Against:**
- Script injection (`<script>` tags)
- Event handlers (`onclick`, `onerror`, etc.)
- JavaScript URLs (`javascript:`)
- Iframe/object/embed injection
- Form injection
- Malicious CSS with JavaScript

**Allowed HTML:**
- `<span class="text-*">` - Text colors (Tailwind classes only)
- `<img src="...">` - Images (safe protocols: http, https, relative paths)
- `<div align="left|center|right">` - Text alignment
- Standard markdown elements (headings, links, lists, etc.)

**Configuration:** `wiki-framework/src/components/wiki/PageViewer.jsx` - `sanitizeSchema`

**Documentation:** See `wiki-framework/SECURITY.md` for complete details, testing examples, and security best practices.

**Important:** When adding new allowed HTML elements, always assess security risks and test with malicious payloads.

## Important Constraints

1. **Never modify `wiki-framework/` files** - The framework is a submodule containing generic wiki functionality only
2. **Game-specific components belong in `src/components/`** - Keep the framework generic and reusable
3. **Always rebuild search index** after adding/editing content: `npm run build:search`
4. **Base URL must match repo name** for GitHub Pages deployment
5. **Restart dev server** after configuration changes
6. **Use frontmatter** on all markdown files for proper indexing
7. **Data files must be valid JSON** in `public/data/` directory
8. **Never bypass HTML sanitization** - Don't use `dangerouslySetInnerHTML` or disable `rehype-sanitize`

## Coding Standards

### Use Constants for Configuration Values

**CRITICAL: Extract repetitive magic numbers and strings into named constants.** This makes code maintainable and prevents errors when values need to change.

**When to use constants:**
- Values used in multiple places (3+ occurrences)
- Configuration values that may need adjustment (sizes, limits, scales)
- Values that have semantic meaning (padding, gaps, thresholds)
- Magic numbers that aren't immediately obvious (why 8? why 240?)

**Where to define constants:**
- At the top of the component/file, clearly grouped and commented
- Use UPPER_SNAKE_CASE for true constants (never change at runtime)
- Use descriptive names that explain the purpose, not just the value

**Example - BAD (repetitive magic numbers):**
```javascript
const [gridScale, setGridScale] = useState(1.5);

<input min="0.5" max="2.4" step="0.1" />
<div style={{ marginBottom: `${(gridScale - 1) * 300}px` }} />

const newInventory = Array(8).fill(null).map(() => {
  const randomLevel = Math.floor(Math.random() * 50) + 1;
  const randomRarity = Math.floor(Math.random() * 6);
});
```

**Example - GOOD (extracted constants):**
```javascript
// ===== CONSTANTS =====
// Grid scaling
const GRID_SCALE_DEFAULT = 1.5;
const GRID_SCALE_MIN = 0.5;
const GRID_SCALE_MAX = 2.4;
const GRID_SCALE_STEP = 0.1;
const GRID_SCALE_MARGIN_MULTIPLIER = 300;

// Inventory
const INVENTORY_SIZE = 8;

// Piece configuration
const MIN_PIECE_LEVEL = 1;
const MAX_PIECE_LEVEL = 50;
const RARITY_COUNT = 6; // Common, Great, Rare, Epic, Legendary, Mythic (0-5)

// Grid configuration
const GAP_SIZE = 4;
const GRID_PADDING = 8;
const LINE_THICKNESS = 8;

// Usage
const [gridScale, setGridScale] = useState(GRID_SCALE_DEFAULT);

<input
  min={GRID_SCALE_MIN}
  max={GRID_SCALE_MAX}
  step={GRID_SCALE_STEP}
/>
<div style={{
  marginBottom: `${(gridScale - 1) * GRID_SCALE_MARGIN_MULTIPLIER}px`
}} />

const newInventory = Array(INVENTORY_SIZE).fill(null).map(() => {
  const randomLevel = Math.floor(Math.random() * MAX_PIECE_LEVEL) + MIN_PIECE_LEVEL;
  const randomRarity = Math.floor(Math.random() * RARITY_COUNT);
});
```

**Benefits:**
- Single source of truth - change once, updates everywhere
- Self-documenting code - names explain purpose
- Type safety - easier to catch errors
- Easier refactoring - find all uses with "Find References"
- Prevents typos - `GRID_PADDING` vs random `8` scattered everywhere

**Real example from codebase:**
See `src/components/SoulWeaponEngravingBuilder.jsx` (lines 25-46) for a comprehensive example of properly organized constants.

## Component Rendering Order (CRITICAL)

**ALWAYS check loading states BEFORE any other conditional renders** to prevent flickering.

### Correct Pattern:
```javascript
// ✅ CORRECT - Loading check FIRST
if (loading) {
  return <LoadingSpinner />;
}

if (!isAuthenticated) {
  return <AuthRequired />;
}

if (error) {
  return <ErrorMessage />;
}

return <Content />;
```

### Incorrect Pattern:
```javascript
// ❌ WRONG - Auth check before loading causes flicker
if (!isAuthenticated) {
  return <AuthRequired />;  // Flickers briefly!
}

if (loading) {
  return <LoadingSpinner />;
}
```

### Why This Matters:
- When a component mounts, initial state often has `loading = true` and `data = null/[]`
- Checking data/auth before loading will briefly show error states
- Users see a flash of "Not Authenticated" or "No Data" before the spinner appears
- Always render loading spinner FIRST, then check other conditions after data loads

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
- When creating very specific markdown files to document a very specific thing that isnt a major feature for the wiki make sure this goes into `.claude/memory` directory.