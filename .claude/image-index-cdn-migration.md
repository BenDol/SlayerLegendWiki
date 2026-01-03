# Image Index CDN Migration

This document describes the migration of image-index.json and image-search-index.json to the CDN repository with automated GitHub Actions workflow.

## Key Improvements

### 1. ✅ Automatic Index Rebuilds on Commit
- **Before:** Manual rebuild or triggered by wiki deployment
- **After:** GitHub Action automatically runs when images committed to `game-assets/images/**`
- **Benefit:** Zero maintenance - indexes always up to date without manual intervention

### 2. ✅ Dynamic CDN URL Configuration
- **Before:** Hard-coded CDN URL in `imageService.js`
- **After:** Dynamically reads from `wiki-config.json` → `features.gameAssets.cdn`
- **Benefit:** Centralized configuration, easy to change CDN provider or repository

### 3. ✅ Script Moved to CDN Repository
- **Before:** Build script in wiki repository (`scripts/build-image-index.js`)
- **After:** Build script in CDN repository (`../cdn/scripts/generate-game-asset-index.js`)
- **Benefit:** Script lives with the assets it manages, cleaner separation of concerns

## Overview

The image database JSON files are now:
1. **Stored in the CDN repository** at `game-assets/images/`
2. **Automatically rebuilt** by GitHub Actions when images change
3. **Fetched from CDN** by the wiki with localStorage caching and fallback
4. **Configured via wiki-config.json** (no hard-coded URLs)

## Architecture

### Storage Location

**CDN Repository:** `BenDol/SlayerLegendCDN`
```
cdn/
├── scripts/
│   ├── generate-game-asset-index.js  # Build script
│   └── generate-image-index.js    # User content script
├── .github/workflows/
│   └── generate-game-asset-index.yml # Auto-rebuild workflow
├── package.json                    # Dependencies (sharp, glob)
└── game-assets/
    └── images/
        ├── image-index.json         # Main index (array format)
        ├── image-search-index.json  # Search index (object format)
        ├── icons/
        ├── spirits/
        ├── equipment/
        └── ... (12,513 game images)
```

### URL Mappings

| Environment | Request Path | Served From |
|-------------|--------------|-------------|
| **Local Dev** | `/data/image-index.json` | `../cdn/game-assets/images/image-index.json` (file system) |
| **Local Dev** | `/data/image-search-index.json` | `../cdn/game-assets/images/image-search-index.json` (file system) |
| **Local Dev** | `/images/content/*` | `../cdn/game-assets/images/*` (file system) |
| **Production** | `/data/image-index.json` | jsDelivr CDN (via wiki config) |
| **Production** | `/data/image-search-index.json` | jsDelivr CDN (via wiki config) |
| **Production** | `/images/content/*` | jsDelivr CDN (via wiki config) |

### CDN URLs (Production)

- **image-index.json:** `https://cdn.jsdelivr.net/gh/BenDol/SlayerLegendCDN@main/game-assets/images/image-index.json`
- **image-search-index.json:** `https://cdn.jsdelivr.net/gh/BenDol/SlayerLegendCDN@main/game-assets/images/image-search-index.json`

## Components

### 1. Image Scanning Script

**Location:** `../cdn/scripts/generate-game-asset-index.js` (in CDN repository)

**Purpose:** Scans the CDN directory and builds both JSON indexes

**Features:**
- ✅ Recursively scans all images in `game-assets/images/`
- ✅ Extracts dimensions using `sharp` library (accurate for all raster formats)
- ✅ **Fixed category bug** - properly extracts category from `/images/content/X/` paths
- ✅ Generates keywords from filename, path segments, and numbers
- ✅ Handles SVG files (skips dimension reading)
- ✅ Creates unique IDs for search index
- ✅ Outputs both main index (array) and search index (object)

**Category Extraction Logic:**
```javascript
// For /images/content/spirits/... -> category: 'spirits'
// For /images/content/equipment/weapons/... -> category: 'equipment'
// For /images/icons/... (legacy) -> category: 'icons'
```

**Usage:**
```bash
# From CDN repository
cd ../cdn
npm run build:index

# From wiki repository (deprecated, use CDN location)
# npm run build:image-index

# Custom paths (from CDN repository)
node scripts/generate-game-asset-index.js \
  --cdn-dir /path/to/game-assets/images \
  --output-dir /path/to/output
```

### 2. GitHub Actions Workflows

#### CDN Repository Workflow (Primary)

**Location:** `../cdn/.github/workflows/generate-game-asset-index.yml`

**Triggers:**
- `push` to main branch - Automatically when images change in `game-assets/images/**`
- `workflow_dispatch` - Manual trigger

**Watched Paths:**
```yaml
paths:
  - 'game-assets/images/**/*.jpg'
  - 'game-assets/images/**/*.jpeg'
  - 'game-assets/images/**/*.png'
  - 'game-assets/images/**/*.webp'
  - 'game-assets/images/**/*.gif'
  - 'game-assets/images/**/*.svg'
```

**Workflow Steps:**
1. Checkout CDN repository
2. Setup Node.js and install dependencies
3. Run `generate-game-asset-index.js` script
4. Check for changes in the generated JSON files
5. Commit and push changes (with `[skip ci]` to prevent loops)
6. Retry logic with exponential backoff for concurrent pushes
7. Generate summary with image count and file sizes

**Features:**
- ✅ Automatic index rebuild on image commits
- ✅ Prevents infinite loops with `[skip ci]` flag
- ✅ Handles concurrent workflow runs with retry logic
- ✅ Detailed commit messages with statistics

#### Wiki Repository Workflow (Secondary)

**Location:** `.github/workflows/update-image-index.yml`

**Triggers:**
- `workflow_dispatch` - Manual trigger with optional repository/branch inputs
- `schedule` - Daily at 2 AM UTC (catches missed updates)
- `repository_dispatch` - Triggered by external events

**Purpose:** Backup workflow for cross-repo rebuilds or scheduled maintenance

**Workflow Steps:**
1. Checkout wiki repository (for workflow definition)
2. Checkout CDN repository (for the images, script, and output)
3. Setup Node.js and install dependencies in CDN repo
4. Run `generate-game-asset-index.js` script from CDN repo
5. Check for changes in the generated JSON files
6. Commit and push changes to CDN repository
7. Generate summary with image count and timestamp

**Example Manual Trigger:**
```bash
# Trigger via GitHub CLI
gh workflow run update-image-index.yml

# Trigger with custom CDN repo/branch
gh workflow run update-image-index.yml \
  -f cdn_repo="YourOrg/YourCDN" \
  -f cdn_branch="dev"
```

### 3. Wiki Fetching (CDN with Fallback)

**Location:** `src/services/imageService.js`

**Features:**
- ✅ **Dynamically reads CDN URL from wiki-config.json** (no hard-coded values)
- ✅ Fetches from CDN first (jsDelivr or raw GitHub)
- ✅ Falls back to static `/data/` files if CDN fails
- ✅ localStorage caching (1 hour TTL)
- ✅ Automatic cache invalidation on age
- ✅ Debug logging for cache hits/misses
- ✅ Supports disabling CDN via config

**Cache Strategy:**
```javascript
// 1. Load wiki-config.json to get CDN settings
// 2. Check localStorage (1 hour TTL)
// 3. Try CDN URL (constructed from config)
// 4. Fallback to static file (/data/image-index.json)
// 5. Cache result in localStorage
```

**CDN URL Construction:**
```javascript
// From wiki-config.json:
const { owner, repo, basePath, servingMode, branch } = config.features.gameAssets.cdn.github;

// If servingMode === 'jsdelivr':
const url = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${basePath}`;
// Example: https://cdn.jsdelivr.net/gh/BenDol/SlayerLegendCDN@main/game-assets/images

// If servingMode !== 'jsdelivr' (raw GitHub):
const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${basePath}`;
```

**Cache Keys:**
- `image-index` - Main index data
- `image-index_timestamp` - Cache timestamp
- `image-search-index` - Search index data
- `image-search-index_timestamp` - Cache timestamp

### 4. Local CDN Plugin (Development)

**Location:** `vite-plugin-local-cdn.js`

**Purpose:** Serves CDN files from local git repository during development

**Intercepted Requests:**
```javascript
// Image index files
GET /data/image-index.json → ../cdn/game-assets/images/image-index.json
GET /data/image-search-index.json → ../cdn/game-assets/images/image-search-index.json

// Game asset images
GET /images/content/* → ../cdn/game-assets/images/*
```

**Features:**
- ✅ Automatic detection of `../cdn` repository
- ✅ No network requests during development
- ✅ Console logging for debugging
- ✅ Sets `X-Served-From: local-cdn` header
- ✅ Falls back to `public/` if file not found in CDN

**How It Works:**
```javascript
// Vite dev server middleware intercepts requests
if (req.url === '/data/image-index.json') {
  // Serve from ../cdn/game-assets/images/image-index.json
  return serveFromLocalCdn();
}
// If not found, continue to next middleware (public/ directory)
```

### 5. Framework Updates

**Location:** `wiki-framework/src/api/imageDatabase.js`

**Changes:**
1. **Updated save paths** to CDN location (`../cdn/game-assets/images/`)
2. **Fixed category bug** in 3 functions:
   - `addMissingEntries` (line ~677-686)
   - `applyResolvedOrphans` (lines ~515-521, ~533-539)

**Category Bug Fix:**

**Before (WRONG):**
```javascript
// For /images/content/spirits/... extracted 'content' ❌
if (pathParts.length > 2 && pathParts[0] === 'images') {
  category = pathParts[1]; // Gets 'content', should be 'spirits'
}
```

**After (CORRECT):**
```javascript
// For /images/content/spirits/... extracts 'spirits' ✅
if (pathParts.length >= 3 && pathParts[0] === 'images' && pathParts[1] === 'content') {
  category = pathParts[2]; // e.g., /images/content/spirits/... -> 'spirits'
} else if (pathParts.length >= 2 && pathParts[0] === 'images') {
  category = pathParts[1]; // Legacy: /images/skills/... -> 'skills'
}
```

## JSON File Formats

### image-index.json (Main Index)

```json
{
  "version": "1.0",
  "totalImages": 12519,
  "generatedAt": "2026-01-01T12:00:00.000Z",
  "images": [
    {
      "path": "/images/content/spirits/Spirit_001_3_6.png",
      "filename": "Spirit_001_3_6.png",
      "category": "spirits",
      "filesize": 45678,
      "keywords": ["Spirit_001_3_6", "spirits", "001", "3", "6", "Spirit"],
      "lastModified": "2025-12-31T10:00:00.000Z",
      "dimensions": {
        "width": 128,
        "height": 128
      }
    }
  ]
}
```

### image-search-index.json (Search Index)

```json
{
  "version": "1.0",
  "totalImages": 12519,
  "generatedAt": "2026-01-01T12:00:00.000Z",
  "images": {
    "img-1735732800000-abc123xyz": {
      "path": "/images/content/spirits/Spirit_001_3_6.png",
      "filename": "Spirit_001_3_6.png",
      "category": "spirits",
      "filesize": 45678,
      "keywords": ["Spirit_001_3_6", "spirits", "001"],
      "lastModified": "2025-12-31T10:00:00.000Z",
      "dimensions": {
        "width": 128,
        "height": 128
      }
    }
  }
}
```

## Workflows

### Local Development Workflow

When working on images locally:

1. **First time setup:**
   ```bash
   cd ../cdn
   npm install              # Install sharp and glob
   npm run build:index      # Generate initial indexes
   ```

2. **Edit images** in `../cdn/game-assets/images/`

3. **Rebuild indexes:**
   ```bash
   cd ../cdn
   npm run build:index
   ```

4. **Start wiki dev server:**
   ```bash
   cd ../wiki
   npm run dev
   ```
   - Dev server automatically serves indexes from `../cdn/game-assets/images/`
   - No network requests to jsDelivr
   - Console will log: `[local-cdn] Serving image-index.json from local CDN repository`

5. **Commit to CDN repo:**
   ```bash
   cd ../cdn
   git add game-assets/images
   git commit -m "Update images and indexes"
   git push
   ```

6. **GitHub Action automatically rebuilds** indexes in CDN repository

### Production Workflow

When images are pushed to CDN repository:

1. **Push images** to CDN repository main branch
2. **GitHub Action automatically triggers** (watches `game-assets/images/**` paths)
3. **Action rebuilds** image-index.json and image-search-index.json
4. **Action commits** updated indexes to CDN repository with `[skip ci]` flag
5. **jsDelivr syncs** within 1-2 minutes
6. **Wiki fetches** updated indexes from CDN (cached for 1 hour)

**Automatic Detection:**
- Workflow runs ONLY when image files change in `game-assets/images/`
- Changes to other directories (like `avatars/`, `user-content/`) don't trigger the workflow
- Commit message includes `[skip ci]` to prevent workflow from re-triggering itself

## Cache Invalidation

### Client-Side Cache (localStorage)

- **TTL:** 1 hour (3600000ms)
- **Clear cache:** Open browser console and run:
  ```javascript
  localStorage.removeItem('image-index');
  localStorage.removeItem('image-index_timestamp');
  localStorage.removeItem('image-search-index');
  localStorage.removeItem('image-search-index_timestamp');
  ```

### CDN Cache (jsDelivr)

- **Auto-purge:** 1-2 minutes after push to main branch
- **Manual purge:** Use jsDelivr purge API
  ```bash
  curl https://purge.jsdelivr.net/gh/BenDol/SlayerLegendCDN@main/game-assets/images/image-index.json
  ```

## Benefits

### Before Migration
- ❌ JSON files stored in wiki repository (`public/data/`)
- ❌ Required full wiki rebuild/deploy for image updates
- ❌ Category bug caused incorrect categorization
- ❌ Manual index updates required

### After Migration
- ✅ JSON files stored in CDN repository
- ✅ Automatic rebuilds via GitHub Actions
- ✅ No wiki deployment needed for image updates
- ✅ Accurate category extraction from paths
- ✅ Automatic dimension reading for all images
- ✅ localStorage caching for fast loads
- ✅ CDN fallback for reliability
- ✅ **Local dev serves from ../cdn (no network)**
- ✅ **Dynamic CDN URL from wiki-config**
- ✅ **Zero-maintenance index updates**

## Troubleshooting

### Issue: Indexes not updating

**Check:**
1. Verify GitHub Action ran successfully in CDN repository
2. Ensure commit modified files in `game-assets/images/**` (triggers workflow)
3. Check CDN repository for updated index files
4. Wait 1-2 minutes for jsDelivr to sync
5. Clear localStorage cache in browser

**Debug:**
```bash
# Check if action ran (in CDN repository)
cd ../cdn
gh run list --workflow=generate-game-asset-index.yml

# View action logs
gh run view <run-id> --log

# Check if workflow was triggered
gh run list --limit 5

# Check CDN file (should show recent timestamp)
curl https://cdn.jsdelivr.net/gh/BenDol/SlayerLegendCDN@main/game-assets/images/image-index.json | jq '.generatedAt'

# Manually trigger workflow if needed
gh workflow run generate-game-asset-index.yml
```

**Common Causes:**
- Workflow didn't trigger (commit didn't modify image files)
- Workflow permissions issue (check repository settings)
- Action failed due to missing dependencies (check action logs)
- Commit message contained `[skip ci]` (prevents execution)

### Issue: Categories showing as "content"

**Cause:** Category bug in old code

**Fix:** Already fixed in `imageDatabase.js` (lines ~677-686, ~515-521, ~533-539)

**Rebuild indexes:**
```bash
npm run build:image-index
```

### Issue: Missing dimensions

**Cause:** SVG files or failed sharp processing

**Check:**
```bash
# Run script with debug output
node scripts/build-image-index.js
```

SVG files will show `dimensions: null` (expected behavior)

### Issue: CDN fetch fails

**Fallback:** Wiki automatically falls back to `/data/image-index.json`

**Fix CDN:**
1. Check CDN repository exists
2. Verify jsDelivr is accessible
3. Check for typos in CDN URL

### Issue: Local dev not serving from CDN

**Check:**
```bash
# 1. Verify CDN repository exists
ls ../cdn/game-assets/images/*.json

# 2. If missing, build indexes
cd ../cdn
npm install
npm run build:index

# 3. Restart dev server
cd ../wiki
npm run dev

# 4. Check browser console for logs
# Should see: "[local-cdn] Serving image-index.json from local CDN repository"

# 5. Check response headers in DevTools Network tab
# Should see: X-Served-From: local-cdn
```

**Common causes:**
- CDN repository not cloned at `../cdn`
- Index files not generated (`npm run build:index`)
- Dev server not restarted after plugin changes
- Wrong relative path (must be `../cdn` from wiki root)

## Migration Checklist

### CDN Repository Setup
- [x] Create `generate-game-asset-index.js` script in CDN repo
- [x] Create `package.json` with dependencies (sharp, glob)
- [x] Create `generate-game-asset-index.yml` GitHub Action in CDN repo
- [x] Configure workflow to watch `game-assets/images/**` paths
- [x] Add automatic index rebuild on image commits
- [x] Test workflow with push to CDN repository

### Wiki Repository Updates
- [x] Update `imageService.js` to fetch from CDN dynamically (wiki-config)
- [x] Create `vite-plugin-local-cdn.js` for local dev serving
- [x] Update `vite.config.js` to register localCdnPlugin
- [x] Remove hard-coded CDN URLs (use wiki-config)
- [x] Update `imageDatabase.js` to save to CDN location
- [x] Fix category bug in framework (3 locations)
- [x] Remove deprecated `build:image-index` npm script
- [x] Create secondary workflow (`update-image-index.yml`) for manual/scheduled rebuilds

### Testing
- [x] Test local dev serving from `../cdn`
- [x] Verify console logs show `[local-cdn]` prefix
- [x] Verify response headers show `X-Served-From: local-cdn`
- [x] Test GitHub Action workflow execution
- [x] Verify CDN fetching works in production
- [x] Verify fallback to `/data/` works if CDN unavailable
- [x] Test automatic rebuild on image commit

### Documentation
- [x] Document complete architecture
- [x] Add local development workflow
- [x] Add troubleshooting guide
- [x] Document URL mappings (dev vs production)
- [x] Add migration benefits comparison

## Related Files

### Scripts (CDN Repository)
- `../cdn/scripts/generate-game-asset-index.js` - Game asset image scanning script
- `../cdn/package.json` - CDN dependencies (sharp, glob)

### Scripts (Wiki Repository)
- `scripts/migrate-images-to-cdn.js` - Migration helper (if needed)

### Workflows (CDN Repository)
- `../cdn/.github/workflows/generate-game-asset-index.yml` - **PRIMARY** - Auto-rebuild on image commits

### Workflows (Wiki Repository)
- `.github/workflows/update-image-index.yml` - **SECONDARY** - Manual/scheduled rebuilds

### Source Code (Wiki Repository)
- `src/services/imageService.js` - CDN fetching with cache (uses wiki-config)
- `vite-plugin-local-cdn.js` - **NEW** - Serves indexes from local CDN during dev
- `vite.config.js` - Registers localCdnPlugin
- `wiki-framework/src/api/imageDatabase.js` - Save to CDN, category fixes
- `wiki-framework/src/components/dev/ImageDatabaseManager.jsx` - Dev UI (uses imageDatabase.js)

### Configuration (Wiki Repository)
- `wiki-config.json` - CDN configuration (features.gameAssets.cdn)
- `package.json` - (deprecated: `build:image-index` script, use CDN location)

## Future Enhancements

### Possible Improvements
1. **Incremental updates** - Only scan changed files
2. **Parallel processing** - Process images concurrently
3. **Image optimization** - Automatic compression during scan
4. **CDN webhook** - Trigger wiki cache clear on CDN update
5. **Multi-CDN support** - Fallback to alternative CDNs

### Monitoring
1. **Action alerts** - Notify on build failures
2. **Cache hit rate** - Track localStorage effectiveness
3. **CDN performance** - Monitor fetch latency

## Summary

This migration moves image database JSON files to the CDN with **fully automated regeneration** via GitHub Actions. The wiki fetches from CDN with smart caching and fallback. All category bugs have been fixed, and dimensions are accurate for all images.

**Key Achievements:**

1. ✅ **Automatic Index Rebuilds** - Commits to `game-assets/images/**` trigger automatic index regeneration
2. ✅ **No Hard-coded URLs** - CDN configuration dynamically read from `wiki-config.json`
3. ✅ **Script in CDN Repository** - Build script lives with the assets it manages
4. ✅ **Local Dev Integration** - Vite plugin serves indexes from `../cdn` during development (no network)
5. ✅ **No Wiki Redeployment** - Image updates fully independent from wiki builds
6. ✅ **Category Bug Fixed** - Correct extraction from `/images/content/X/` paths
7. ✅ **Accurate Dimensions** - All raster images have correct width/height metadata

**Workflow Comparison:**

| Aspect | Before | After |
|--------|--------|-------|
| Index location | `public/data/` (wiki) | `game-assets/images/` (CDN) |
| Rebuild trigger | Manual or wiki deploy | **Automatic on image commit** |
| CDN URL | Hard-coded | **Dynamic from config** |
| Build script | Wiki repository | **CDN repository** |
| Local dev serving | Network (jsDelivr/fallback) | **File system (../cdn)** |
| Dev console output | Silent | **Logs "[local-cdn] Serving..."** |
| Category extraction | Buggy (got 'content') | **Fixed (gets actual category)** |
| Wiki deployment | Required for images | **Not required** |
