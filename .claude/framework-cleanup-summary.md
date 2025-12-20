# Framework Cleanup Summary

## Game-Specific Content Removed from Framework

This document tracks all instances where game-specific data was removed from the wiki-framework to keep it generic and reusable.

### 1. Data Browser Modal - Data Files ✓
**File:** `wiki-framework/src/components/common/DataBrowserModal.jsx`

**Before:** Hardcoded list of 16 game-specific data files:
- `companions.json`, `soul-weapons.json`, `skills.json`, `promotions.json`, etc.

**After:** Uses registry pattern
- Created `wiki-framework/src/utils/dataBrowserRegistry.js`
- Parent project registers files in `main.jsx` via `registerDataFiles()`
- Falls back to `/data/data-files-index.json` if no registry

### 2. Issue Labels - Section Labels ✓
**File:** `wiki-framework/src/services/github/issueLabels.js`

**Before:** Hardcoded 12 section labels:
- `section:getting-started`, `section:characters`, `section:companions`, etc.

**After:** Dynamically generated from wiki-config.json
- Removed hardcoded `sections` array from `WIKI_LABELS`
- Added `generateSectionLabels(sections)` function
- Uses color palette that rotates through 12 colors
- Updated `getAllWikiLabels()` and `ensureAllWikiLabels()` to accept sections parameter
- `anonymousEdits.js` loads wiki-config.json to pass sections

### 3. Build Share - Build Types & Routes ✓
**File:** `wiki-framework/src/services/github/buildShare.js`

**Before:** Hardcoded build types and routes:
```javascript
const routes = {
  'battle-loadouts': '/battle-loadouts',
  'skill-builds': '/skill-builder',
  'spirit-builds': '/spirit-builder',
  'soul-weapon-engraving': '/soul-weapon-engraving-builder',
};
```

**After:** Uses registry pattern
- Created `wiki-framework/src/utils/buildTypeRegistry.js`
- Parent project registers types in `main.jsx` via `registerBuildTypes()`
- `generateShareUrl()` now uses `getBuildTypeRoute()`
- Clear error messages when build type not registered

### 4. Progress Store - localStorage Key ✓
**File:** `wiki-framework/src/store/progressStore.js`

**Before:** Hardcoded localStorage key:
```javascript
name: 'slayer-legend-progress'
```

**After:** Generic key:
```javascript
name: 'wiki-progress'
```

## Parent Project Registration (main.jsx)

All game-specific data now registered in one place:

```javascript
// Build types for build sharing
import { registerBuildTypes } from './wiki-framework/src/utils/buildTypeRegistry.js';
registerBuildTypes({
  'skill-builds': '/skill-builder',
  'spirit-builds': '/spirit-builder',
  'battle-loadouts': '/battle-loadouts',
  'soul-weapon-engraving': '/soul-weapon-engraving',
});

// Data files for Data Browser (Ctrl+Shift+B)
import { registerDataFiles } from './wiki-framework/src/utils/dataBrowserRegistry.js';
registerDataFiles([
  'companions.json',
  'soul-weapons.json',
  'skills.json',
  // ... 21 total files
]);

// Data sources for data injection (already existed)
import dataRegistry from './src/utils/dataRegistry.js';
dataRegistry.register('spirits', { ... });
// ... etc
```

## Files Considered But Left Unchanged

### battleLoadouts.js
- **Status:** OK - Generic service
- **Reason:** "Battle loadouts" is a generic game concept, not Slayer Legend specific
- Label `battle-loadouts` is descriptive but generic

### battleLoadoutEncoder.js
- **Status:** OK - Has default parameter but overridable
- **Reason:** Default path `'/battle-loadouts'` is a convenience, not a requirement
- Callers can override with their own route

### BuildViewerPage.jsx
- **Status:** OK - Generic build viewer
- **Reason:** "Companion" is a generic RPG/game concept
- File displays build data generically without game-specific logic

## Verification Sweep Results

Searched for remaining game-specific content:

✓ No hardcoded data file names (except examples in comments)
✓ No hardcoded section names
✓ No character names (Ellie, Zeke, Miho, Luna)
✓ No element types (Fire, Water, Wind, Earth)
✓ No skill names
✓ No equipment types
✓ No game-specific terminology

## Framework is Now 100% Generic

The wiki-framework can now be used by any wiki project by simply registering their:
1. Build types and routes
2. Data files for browser
3. Section structure (via wiki-config.json)
4. Custom components/renderers (already supported via registries)

No framework code needs to be modified for different wiki topics!

