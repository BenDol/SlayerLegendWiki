# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Links

### Core Documentation
- **[Repository Permissions](.claude/repository-permissions.md)** - Branch protection, bot setup, security configuration
- **[Cloudflare Pages Deployment](.claude/cloudflare-pages-deployment.md)** - Build configuration, test execution, environment variables
- **[Deployment Platforms](.claude/deployment-platforms.md)** - Netlify vs Cloudflare comparison, video upload limits
- **[Security Audit Report](.claude/security-audit-report.md)** - HTML injection protections, XSS prevention, security layers

### Additional Resources
- **[Google AdSense Setup & Targeting](.claude/google-ads-setup.md)** - Ad placements, config, Auto ads dashboard settings, what drives which ads show
- **[PayPal Webhook Setup](.claude/paypal-webhook-setup.md)** - PayPal integration for donations
- **[Serverless Caching Audit](.claude/serverless-caching-audit.md)** - Caching strategies and implementation
- **[HTML Security Validation](.claude/memory/HTML-SECURITY-VALIDATION-WORKFLOW.md)** - Automated security testing workflow

## Project Overview

This is a **parent wiki project** built using the [GitHub Wiki Framework](https://github.com/BenDol/GithubWiki) as a git submodule. The framework handles all React components, routing, and core functionality, while this repository contains only content, configuration, and customization.

### Critical Concepts

**🚨 FRAMEWORK RULE:** The `wiki-framework/` directory is a **git submodule**. Never edit files inside `wiki-framework/` - all customizations belong in the parent project. The framework must NEVER import from the parent project.

**🎯 REGISTRY PATTERN:** All game-specific functionality is added via registries in `main.jsx`:
- Content renderers for custom markdown syntax
- Custom routes for tools/builders
- Data files for Data Browser
- Pickers for page editor
- Page aside components (e.g. the side-rail ad below the table of contents)

## Logging System

The project has TWO logging systems that should be monitored during development:

### 1. Client-Side Logs (Browser/Frontend)
**Location:** `wiki-framework/logs/debug.log`

- These are remote logs written by the client-side JavaScript
- **Requirement:** Check `public/wiki-config.json` to confirm `enableRemoteLoggingInDev: true`
- **When to check:** For frontend issues (React components, UI interactions, client-side logic)

**How to monitor client logs:**

1. **Stream logs in background** (Recommended for debugging):
   ```bash
   tail -f wiki-framework/logs/debug.log    # Run with run_in_background: true
   ```
   - Use `run_in_background: true` to keep monitoring while working
   - Check output periodically with TaskOutput tool
   - Kill the background task with KillShell when done
   - **Auto-cancellation:** If no activity for 3+ minutes, stop monitoring (user is AFK)

2. **Read recent logs directly**:
   ```bash
   tail -50 wiki-framework/logs/debug.log   # Last 50 lines
   tail -100 wiki-framework/logs/debug.log  # Last 100 lines
   ```

3. **Search for specific errors**:
   ```bash
   grep -i "error\|failed" wiki-framework/logs/debug.log | tail -20
   ```

### 2. Server-Side Logs (Wrangler/Cloudflare Functions)
**Location:** `.wrangler/server.log`

- All Wrangler output (stdout/stderr) is captured to this file in real-time
- These logs include:
  - `[WRANGLER]` - Cloudflare Worker/Function logs
  - `[VITE]` - Vite dev server logs (from the WRANGLER process output)
  - `[ERROR]` - Critical errors in serverless functions
  - `[WARNING]` - Non-critical warnings
  - `[INFO]` - Informational messages
  - Stack traces with file paths and line numbers
- **When to check:** For backend/API issues (serverless functions, database operations, authentication)

**How to monitor server logs:**

1. **Stream logs in background** (Recommended for debugging):
   ```bash
   tail -f .wrangler/server.log    # Run with run_in_background: true
   ```
   - Use `run_in_background: true` to keep monitoring while working
   - Check output periodically with TaskOutput tool
   - Kill the background task with KillShell when done

2. **Read recent logs directly**:
   ```bash
   tail -50 .wrangler/server.log   # Last 50 lines
   tail -100 .wrangler/server.log  # Last 100 lines
   ```

3. **Search for specific errors**:
   ```bash
   grep -i "error\|warning\|failed" .wrangler/server.log | tail -20
   ```

**Example Wrangler error format:**
```
[WRANGLER] ✘ [ERROR] [HandlerName] Error message {
[WRANGLER]     error: 'Detailed error description',
[WRANGLER]     stack: 'TypeError: ...\n' +
[WRANGLER]       '    at functionName (file:///path/to/file.js:123:45)\n' +
[WRANGLER]       ...
[WRANGLER]   }
[WRANGLER] [wrangler:info] POST /api/endpoint 500 Internal Server Error (7ms)
```

### Best Practice Workflow

**For backend/API debugging:**
1. ✅ Read `.wrangler/server.log` directly using `tail -50 .wrangler/server.log`
2. ✅ Look for `[ERROR]`, `[WARNING]`, or `[DEBUG]` messages
3. ✅ Read error messages and stack traces
4. ✅ Identify the file and line number from stack trace
5. ✅ Fix the issue
6. ✅ Monitor logs in real-time with `tail -f .wrangler/server.log` (run in background with `run_in_background: true`)
7. ✅ Ask user to test and verify fix

**For frontend debugging:**
1. ✅ Read `wiki-framework/logs/debug.log` for client-side errors
2. ✅ Use `tail -f` to monitor in real-time
3. ✅ Look for logger.error() and logger.warn() messages

**CRITICAL:** Always check server logs when API endpoints return 500, 403, 401, or other error status codes!

## Quick Start

```bash
# Development (Cloudflare Pages Functions - DEFAULT)
npm run dev              # Start Wrangler + Vite + config watcher (http://localhost:8788)

# Alternative: Netlify Functions (fallback)
npm run dev:netlify      # Start Netlify dev + config watcher (http://localhost:8888)

# Direct Vite (no serverless functions)
npm run dev:vite         # Start Vite only + config watcher (http://localhost:5173)

# Production build
npm run build:cloudflare # Build for Cloudflare Pages (use this in CF dashboard)
npm run build            # Build for Cloudflare Pages (shorthand)
npm run build:netlify    # Build for Netlify (fallback)
npm run build:search     # Rebuild search index after content changes

# Framework updates
cd wiki-framework && git pull origin main && cd ..
git add wiki-framework && git commit -m "Update framework"

# Tests & Deployment
# The site is built in GitHub Actions and pushed to Cloudflare Pages via
# Direct Upload (Cloudflare does NOT build this project - it cannot clone the
# private wiki-framework submodule). See conditional-deploy.yml.
# Tests run automatically on main-branch deploys
# Tests are skipped on other branches for speed
# To skip tests on main branch, use commit message markers:
# [skip tests], [skip-tests], [no tests], [tests skip]
git commit -m "Fix typo [skip tests]"

# See .claude/cloudflare-pages-deployment.md for full deployment guide
```

## Dynamic Page Loading & Conditional Deployments

The wiki supports **dynamic page loading** which fetches markdown content from GitHub instead of bundled static files. This eliminates the need for full rebuilds when only content changes.

### Configuration

Enable in `wiki-config.json`:
```json
{
  "features": {
    "dynamicPageLoading": {
      "enabled": true,          // Master toggle
      "cacheTTL": 300000,       // 5 minutes (in milliseconds)
      "fallbackToStatic": true, // Fall back to bundled files if GitHub unavailable
      "allowStaleOnRateLimit": true  // Use expired cache when rate limited
    }
  }
}
```

### SEO Optimization with Crawler Detection

**Important:** Dynamic page loading is automatically disabled for search engine crawlers to ensure optimal SEO. This is called "dynamic rendering" and is [recommended by Google](https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering).

**How it works:**
- **Crawlers (Googlebot, Bingbot, etc.):** Receive static bundled content (fast, pre-rendered)
- **Regular users:** Receive dynamic content from GitHub (always up-to-date)

**Implementation:**
1. `src/utils/crawlerDetection.js` - Detects crawlers by User-Agent
2. `src/services/dynamicPageLoaderWrapper.js` - Wraps framework module with detection
3. `vite.config.js` - Aliases framework imports to use wrapper

**Supported crawlers:**
- Google (Googlebot, Google-InspectionTool, AdsBot, etc.)
- Bing (bingbot, msnbot, BingPreview)
- Social media (Facebook, Twitter, Discord, LinkedIn, Slack)
- Other search engines (DuckDuckGo, Yahoo, Baidu, Yandex)

This ensures the best of both worlds: fresh content for users + SEO-friendly static pages for crawlers.

### Deployments (GitHub Actions -> Cloudflare Direct Upload)

`.github/workflows/conditional-deploy.yml` **builds and deploys** the site. Cloudflare does not build this project: `wiki-framework` (`BenDol/GithubWiki`) is a private submodule of this public repo, and Cloudflare Pages' Git integration clones submodules before any build command runs, with no way to authenticate a private one. GitHub Actions can, because `actions/checkout` copies its `token` input into the submodule git config. The finished `dist/` (plus `functions/`) is pushed with `wrangler pages deploy`.

**Since the build prerenders crawler-visible HTML for every route (`scripts/prerender.js`), all pushes to main trigger a deploy** - a skipped build would leave crawlers seeing stale prerendered content while users get fresh content from GitHub (cloaking drift). The only way to skip is the explicit commit-message override.

**Behavior:**
- ✅ **Content-only commits** (`public/content/*.md` only) → Full deploy (keeps prerendered crawler HTML in sync)
- ✅ **Code/config commits** → Full deploy triggered
- ✅ **Submodule updates** (`wiki-framework` changes) → Full deploy triggered
- ✅ **`[skip-deploy]` / `[no-deploy]` in commit message** → No deploy (prerendered HTML stays stale until the next deploy)

**Commit Message Overrides:**
```bash
# Force deploy even if only content changed
git commit -m "Update content [deploy-required]"

# Skip deploy even if code changed (manual override)
git commit -m "Refactor [skip-deploy]"
```

**Keywords:**
- `[skip-deploy]` or `[no-deploy]` - Skip deploy
- `[deploy-required]` / `[force-deploy]` - accepted but now a no-op; every push to main deploys anyway

**Required secrets** (Settings → Secrets and variables → Actions):
1. `FRAMEWORK_REPO_TOKEN` - PAT with read access to the private `BenDol/GithubWiki` (falls back to `WIKI_BOT_TOKEN`)
2. `CLOUDFLARE_API_TOKEN` - token with **Cloudflare Pages: Edit**
3. `CLOUDFLARE_ACCOUNT_ID`
4. `RECAPTCHA_SITE_KEY` (and `PAYPAL_CLIENT_ID` if your Pages dashboard sets it) - Vite inlines `VITE_*` at build time, so dashboard-only values compile to `undefined`. See [Cloudflare Pages Deployment](.claude/cloudflare-pages-deployment.md)

**`wrangler.toml` is local-dev only and the deploy step moves it aside.** `wrangler pages dev` rejects `--config`, so the file must keep that name at the repo root; but a root config present at deploy time becomes the source of truth and supersedes the Pages dashboard's runtime variables and secrets, breaking every Function. The deploy therefore runs `mv wrangler.toml wrangler.local.toml` first. Because no config ships, the Pages project itself must carry compatibility date `2024-12-01` and the `nodejs_compat` flag.

### How It Works

**With Dynamic Loading Enabled:**
1. User edits markdown page via wiki editor
2. Commit pushed to GitHub (the deploy workflow runs - the build re-prerenders crawler HTML)
3. Users see fresh content immediately via the GitHub API (no need to wait for the build)
4. Content cached locally for 5 minutes
5. Cache invalidated automatically on next edit

**Build quota:** every push to main triggers a build (needed to keep `scripts/prerender.js` output in sync with content - see Deployments above). Builds now consume **GitHub Actions** minutes rather than the Cloudflare Pages free tier's 500 builds/month. Use `[skip-deploy]` to batch several content commits into one build if quota pressure returns.

### Cache Behavior

- **Fresh cache**: Content served from localStorage (< 5 minutes old)
- **Cache miss**: Fetches from GitHub, caches locally
- **Rate limited**: Uses stale cache (< 24 hours old), shows warning banner
- **GitHub down**: Falls back to bundled static files, shows warning banner
- **After edit**: Cache purged immediately, fresh fetch on next load

## Video Upload System

### Hybrid Upload Strategy (Client-side LFS for Large Files)

The video upload system uses a **hybrid approach** to support files up to 500MB on both Netlify and Cloudflare:

| File Size | Upload Method | Local Dev | Netlify Prod | Cloudflare Prod |
|-----------|---------------|-----------|--------------|-----------------|
| **< 6MB** | Server-side | ✅ Works | ✅ Works | ✅ Works |
| **6-100MB** | Client-side LFS (local) / Server-side (prod) | ✅ Auto LFS | ✅ Server | ✅ Server |
| **100-500MB** | Client-side LFS | ✅ Auto LFS | ✅ Auto LFS | ✅ Auto LFS |

**How it works:**

1. **Small files (< threshold):** Upload through serverless function on form submit
2. **Large files (≥ threshold):** Immediate upload to GitHub LFS while user fills form, then instant submit
   - **Local dev threshold:** 6MB (bypasses Netlify CLI limit)
   - **Production threshold:** 100MB (bypasses Cloudflare Worker limit)

**Benefits:**

- ✅ **Works seamlessly in local dev** - files > 6MB automatically use LFS
- ✅ **Supports 500MB on both Netlify and Cloudflare**
- ✅ **Better UX** - large files upload while user fills form
- ✅ **Minimizes orphaned uploads** - small files use simpler server-side flow

**Implementation:**

- **Small files:** FormData upload to `/api/video-upload`
- **Large files:** Client → `/api/request-lfs-upload` → Direct to GitHub LFS → `/api/finalize-lfs-upload`

**Orphaned Uploads:**

If a user uploads a large file but abandons the form, the file sits in GitHub LFS unreferenced for ~7 days before automatic garbage collection. This is acceptable because most users complete submissions.

## Project Structure

```
Parent Project (this repo)       Framework Submodule
├── public/content/              wiki-framework/
│   ├── getting-started/         ├── src/           # React app
│   ├── characters/              ├── scripts/       # Build tools
│   └── ...                      └── vite.config.base.js
├── public/data/
│   └── wiki-config.json         # Auto-copied (DON'T EDIT!)
├── src/components/              # Game-specific only
├── wiki-config.json             # ⭐ SOURCE OF TRUTH - EDIT THIS!
├── main.jsx                     # App entry + registrations
└── vite.config.js
```

**Parent project:** Content, config, game-specific components
**Framework submodule:** Generic React app, routing, UI components

**IMPORTANT:** Always edit the **root** `wiki-config.json`, never `public/wiki-config.json`

## Common Tasks

### Adding New Content
1. Create markdown file in `public/content/{section}/`
2. Add frontmatter (title, description, tags)
3. Rebuild search: `npm run build:search`

### Adding Game-Specific Component
1. Create component in `src/components/`
2. Register in `main.jsx` if needed for markdown rendering
3. Use Content Renderer Registry pattern (see `main.jsx` for examples)

### Updating the Stage Pages

**The stage block pages under `public/content/stages/stages-*.md` are GENERATED. Do not hand-edit them** - each carries `generated: true` in its frontmatter and the next regeneration overwrites any manual change. Their prose lives in `scripts/stage-pages.config.json`.

```bash
npm run extract:stage-atlas   # refresh region/area/zone names from an unpacked client
npm run build:stage-pages     # regenerate the 8 block pages
npm run build:search          # always follow a content change
```

- `extract:stage-atlas` reads the game client's own localization table out of an unpacked APK under `external/` (gitignored, so this is an offline maintenance step) and rewrites `public/data/stage-chapters.json` plus the name fields of `public/data/stages.json`. It exits cleanly with a notice when the assets are absent. Pass `--assets=<dir>` to point at a client outside this checkout, and `--dry-run` to preview.
- `build:stage-pages` refuses to write anything unless the configured blocks tile the whole named road, and preserves each page's existing `date:` when the regenerated content is identical - the sitemap's `lastmod` comes from that field.
- The per-stage numbers themselves come from a community datamined spreadsheet whose figures stop being genuine past `lastVerifiedStage` (recorded in `stage-chapters.json`); rows beyond it are flagged `statsVerified: false` and are not tabulated.

### Modifying Framework
**DO NOT** edit `wiki-framework/` directly. Instead:
1. Check if registries can solve your need
2. If framework change needed, update framework repo separately
3. Pull framework updates: `cd wiki-framework && git pull`

### Configuring Features
Many framework features can be toggled in `wiki-config.json` under `features`:

```json
{
  "features": {
    "editor": {
      "previewHighlight": {
        "enabled": true  // Highlights word/element at cursor in live preview
      }
    },
    "dynamicPageLoading": {
      "enabled": true,  // Load pages from GitHub instead of bundled files
      "cacheTTL": 120000
    }
  }
}
```

**Available feature flags:**
- `editor.previewHighlight` - Real-time preview highlighting while editing ([docs](wiki-framework/docs/editor-cursor-highlight.md))
- `dynamicPageLoading` - Load pages from GitHub instead of bundled files
- `sidebarTreeLines` - Visual tree lines in sidebar navigation
- See `wiki-config.json` for full list

## Important Constraints

1. **Never modify `wiki-framework/` files** - Framework is generic, reusable
2. **Game-specific components belong in `src/components/`** - Keep framework clean
3. **Always edit root `wiki-config.json`** - NEVER edit `public/wiki-config.json` (it's auto-generated/copied from root)
4. **Always rebuild search index** after content changes: `npm run build:search`
5. **Restart dev server** after configuration changes (config watcher should pick up changes automatically)
6. **Use frontmatter** on all markdown files for proper indexing
7. **Never bypass HTML sanitization** - Don't use `dangerouslySetInnerHTML`

## Security

The wiki has **comprehensive, multi-layer protection** against HTML injection and XSS attacks:

### Client-Side Protection
- ✅ **`rehype-sanitize`** - Strips dangerous HTML on every render
- ✅ **Whitelist-based** - Only explicitly allowed elements/attributes
- ✅ **Protocol filtering** - Blocks `javascript:`, `data:`, `blob:` URLs
- **Location**: `wiki-framework/src/components/wiki/PageViewer.jsx:74-107`

### Server-Side Validation
- ✅ **Automated PR checks** - Scans for 14 dangerous patterns
- ✅ **Blocks merges** - Critical issues prevent PR approval
- ✅ **Security labels** - Adds `security:warning` label
- **Workflow**: `.github/workflows/html-security-validation.yml`

### What's Blocked
- `<script>` tags, event handlers (`onclick`, etc.)
- `javascript:` URLs, data URIs with HTML
- `<iframe>`, `<object>`, `<embed>`, `<form>` tags
- Inline styles with JavaScript
- Suspicious class names (non-Tailwind)

### What's Allowed
- `<span class="text-*">` for Tailwind text colors
- `<img src="...">` with safe protocols only
- `<div align="...">` for text alignment
- Headings with `id` for anchor links
- Standard markdown elements

**See**: [Security Audit Report](.claude/security-audit-report.md) for complete analysis.

**Documentation**: `wiki-framework/SECURITY.md`

## Coding Standards

### Logging Standards

**CRITICAL: Use centralized logger instead of console for all logging.**

The project uses a centralized logging utility (`src/utils/logger.js`) that provides environment-aware filtering and structured prefixes.

#### Basic Usage

```javascript
import { createLogger } from '../utils/logger';
const logger = createLogger('ComponentName');

// Critical user actions
logger.info('User saved build', { buildName, userId });

// Development debugging
logger.debug('Cache hit', { key, value });

// Verbose lifecycle
logger.trace('Effect running', { deps });

// Errors and warnings
logger.error('Failed to load data', { error });
logger.warn('Using fallback value', { key });
```

#### Log Levels

| Level | Production | Development | Use Cases |
|-------|-----------|-------------|-----------|
| **ERROR** | ✅ Visible | ✅ Visible | API failures, exceptions, data corruption |
| **WARN** | ✅ Visible | ✅ Visible | Fallbacks, deprecations, missing optional data |
| **INFO** | ⚠️ Critical Only | ✅ All | User actions + lifecycle events |
| **DEBUG** | ❌ Hidden | ✅ Visible | Cache ops, validations, internal state |
| **TRACE** | ❌ Hidden | ✅ Visible | Lifecycle, polling, verbose tracking |

#### Critical Actions (INFO Logged in Production)

These keywords in INFO messages trigger production logging:
- **Authentication**: `login`, `logout`, `authenticate`
- **Data operations**: `save`, `delete`, `create`, `update`
- **Sharing**: `share`, `export`, `import`, `copy`
- **Monetization**: `donate`, `payment`

#### Child Loggers

Use child loggers for nested contexts:

```javascript
const logger = createLogger('SoulWeapon');
const cacheLogger = logger.child('Cache');
const bestWeaponLogger = logger.child('BestWeapon');

cacheLogger.debug('Cached 5 submissions'); // Outputs: [SoulWeapon:Cache] Cached 5 submissions
```

#### Best Practices

1. **Never use `console.log/warn/error` directly** - Always use logger
2. **Choose appropriate log levels** - Don't use INFO for internal debugging
3. **Include context data** - Pass objects as second parameter
4. **Use consistent prefixes** - Typically component or module name
5. **Keep messages concise** - Logs should be scannable
6. **Production = clean** - Only errors, warnings, and critical actions visible

#### Migration Pattern

**Before:**
```javascript
console.log('[Component] Doing something:', value);
console.error('[Component] Failed:', error);
```

**After:**
```javascript
const logger = createLogger('Component');
logger.debug('Doing something', { value });
logger.error('Failed', { error });
```

### Use Constants for Configuration Values

**CRITICAL: Extract repetitive magic numbers and strings into named constants.**

```javascript
// ❌ BAD - Magic numbers everywhere
const [gridScale, setGridScale] = useState(1.5);
<input min="0.5" max="2.4" step="0.1" />
const newInventory = Array(8).fill(null);

// ✅ GOOD - Named constants
const GRID_SCALE_DEFAULT = 1.5;
const GRID_SCALE_MIN = 0.5;
const GRID_SCALE_MAX = 2.4;
const INVENTORY_SIZE = 8;

const [gridScale, setGridScale] = useState(GRID_SCALE_DEFAULT);
<input min={GRID_SCALE_MIN} max={GRID_SCALE_MAX} />
const newInventory = Array(INVENTORY_SIZE).fill(null);
```

See example in `src/components/SoulWeaponEngravingBuilder.jsx` (lines 25-46).

### Component Rendering Order

**ALWAYS check loading states FIRST** to prevent flickering:

```javascript
// ✅ CORRECT
if (loading) return <LoadingSpinner />;
if (!isAuthenticated) return <AuthRequired />;
if (error) return <ErrorMessage />;
return <Content />;

// ❌ WRONG - Auth check before loading causes flicker
if (!isAuthenticated) return <AuthRequired />;
if (loading) return <LoadingSpinner />;
```

## Git Workflow

**IMPORTANT: Claude should NEVER handle git commits or pushes.**

**🚨 PROHIBITED GIT COMMANDS:**
- **NEVER** use `git add` - User stages changes manually
- **NEVER** use `git commit` - User creates commits manually
- **NEVER** use `git push` - User pushes changes manually

**Allowed behavior:**
- Claude makes code changes only (using Read, Edit, Write tools)
- User handles ALL git operations manually
- User reviews and commits with their own messages

**Framework submodule:**
- Often in detached HEAD state (normal)
- **DO NOT** use ANY git commands in `wiki-framework/` directory
- User handles all submodule operations

## Repository Permissions & Security

**IMPORTANT: GitHub Actions workflow permissions are READ-ONLY.**

- **Workflow Permissions:** "Read repository contents and packages permissions"
- This is the **correct and secure** configuration
- Workflows use **bot tokens from secrets** for write operations
- DO NOT suggest changing to "Read and write permissions"

**Bot Token Architecture:**
- `WIKI_BOT_TOKEN` - Used by serverless functions for creating PRs, commits
- `CDN_REPO_TOKEN` - Used for CDN repository video uploads (same as WIKI_BOT_TOKEN or separate)
- Stored in GitHub Secrets and deployment platform environment variables
- Never stored in workflow GITHUB_TOKEN

**Branch Protection (main branch):**
- Require 1 PR approval before merging
- Require status checks: build, test, search-index
- Require conversation resolution
- Include administrators
- No force pushes, no deletions

See **[Repository Permissions](.claude/repository-permissions.md)** for complete details.

## Documentation

For detailed information on specific topics, see the **Quick Links** section at the top of this file.

## Getting Help

- `/help` - Get help with Claude Code
- [GitHub Issues](https://github.com/anthropics/claude-code/issues) - Report issues with Claude Code
- [Framework Docs](https://github.com/BenDol/GithubWiki) - Wiki framework documentation
