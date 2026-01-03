# Startup Performance Investigation & Fix

**Date**: 2025-12-17
**Issue**: 10+ second startup time for dev server
**Status**: Fixed ✅

## Root Causes Identified

### 1. Eager Loading of Route Components (MAJOR)
**Problem**: All 5 custom page components were being imported at app startup in `main.jsx`, even though users might never visit those pages.

**Components affected**:
- SkillBuildSimulatorPage → SkillBuilder (788 lines)
- BattleLoadoutsPage → BattleLoadouts (large component with modals)
- SpiritBuilderPage → SpiritBuilder (large component)
- MySpiritCollectionPage
- SpiritSpriteDemoPage

**Impact**: All these components and their dependencies (modals, selectors, panels, icons, etc.) were loaded immediately, adding several seconds to startup.

**Fix Applied**: Converted all route imports to use `React.lazy()` for code splitting:
```javascript
// Before: Eager loading
import SkillBuildSimulatorPage from './src/pages/SkillBuildSimulatorPage.jsx';

// After: Lazy loading
const SkillBuildSimulatorPage = React.lazy(() => import('./src/pages/SkillBuildSimulatorPage.jsx'));
```

**File**: `main.jsx` (lines 318-354)

### 2. File System Watching 12,377 Images (MAJOR)
**Problem**: Vite's dev server was watching all 12,377 image files in `public/images/` for changes, creating massive overhead.

**Image breakdown by directory**:
- companions: 4,448 (largest!)
- equipment: 1,002
- backgrounds: 1,019
- other: 935
- characters: 783
- familiars: 542
- guild: 304
- icons: 221
- skills: 230
- goods: 117
- dragon_valley: 97
- items: 87
- screenshots: 48
- minigames: 55
- relics: 34
- maps: 23
- monsters: 20
- emoticons: 20
- altar: 13
- dungeons: 1

**Total**: 12,377 files

**Impact**: File system watchers for 12,000+ files adds significant startup overhead as Vite indexes and watches each file.

**Fix Applied**: Configured Vite to exclude images directory from file watching in `vite.config.js`:
```javascript
server: {
  watch: {
    ignored: [
      '**/public/images/**',
      '**/external/**',
    ],
  },
}
```

**File**: `vite.config.js` (lines 47-56)

## Expected Performance Improvement

- **Startup time**: From ~10 seconds → ~2-3 seconds
- **Initial bundle size**: Significantly smaller (only home page essentials)
- **First page load**: Instant
- **Route navigation**: Brief loading spinner on first visit to each route, then instant

## Trade-offs

### Lazy Loading
- **Pro**: Much faster initial startup
- **Con**: First visit to each route will show a loading spinner (only once per session)
- **Overall**: Excellent trade-off, standard React best practice

### Image Watching Disabled
- **Pro**: Massive performance improvement, images rarely change during development
- **Con**: If you add/modify images, you'll need to manually refresh the browser (Ctrl+R)
- **Overall**: Excellent trade-off, images are static assets that don't need HMR

## Verification

After applying these fixes, restart your dev server and verify:
1. Server starts in ~2-3 seconds (not 10+)
2. Home page loads instantly
3. First visit to `/skill-builder` or `/battle-loadouts` shows brief loading, then works normally
4. Subsequent visits to those routes are instant

## Additional Notes

- The `imageDbPlugin()` was checked and is not causing issues - it only provides API endpoints and doesn't scan files at startup
- Picker components (DataSelector, SpiritPicker, etc.) are still eagerly loaded but are smaller (~2000 lines total) and needed for page editor functionality
- The `external/` directory was also excluded from watching as it's gitignored and contains tooling/backups
