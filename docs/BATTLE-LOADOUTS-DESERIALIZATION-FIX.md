# Battle Loadouts Deserialization Fix

## Issue

After implementing soul weapon serialization optimization, the Battle Loadouts page crashed with:

```
TypeError: Cannot read properties of undefined (reading 'pattern')
    at EngravingPiece (EngravingPiece.jsx:109:49)
```

This occurred when loading battle loadouts that contained soul weapon builds.

## Root Cause

The Battle Loadouts component had **multiple deserialization gaps** where soul weapon builds were not being deserialized after loading from various sources:

1. **`resolveLoadoutBuilds()` function** (line 580) - Passed through `soulWeaponBuild` without deserializing
2. **Shared build loading** (lines 136-141) - Deserialized skills and spirits but not soul weapon
3. **Saved loadout loading** (lines 183-188) - Deserialized skills and spirits but not soul weapon
4. **Encoded loadout loading** (lines 219-224) - Deserialized skills and spirits but not soul weapon
5. **Draft loading with embedded builds** (lines 252-256) - Deserialized skills and spirits but not soul weapon

All these paths were loading serialized soul weapon builds where `piece.shapeId` exists but `piece.shape` is undefined, causing `EngravingPiece` to crash when trying to access `piece.shape.pattern`.

## Files Modified

### `src/components/BattleLoadouts.jsx`

**Changes:**

#### 1. Added import (line 21)
```javascript
// Before
import { serializeLoadoutForStorage, serializeLoadoutForSharing } from '../utils/battleLoadoutSerializer';

// After
import { serializeLoadoutForStorage, serializeLoadoutForSharing, deserializeSoulWeaponBuild } from '../utils/battleLoadoutSerializer';
```

#### 2. Added shapes state (line 48)
```javascript
const [shapes, setShapes] = useState([]); // Soul weapon engraving shapes
```

#### 3. Added loadShapes function (lines 306-316)
```javascript
const loadShapes = async () => {
  try {
    const response = await fetch('/data/soul-weapon-engravings.json');
    const data = await response.json();
    setShapes(Array.isArray(data) ? data : []);
    logger.debug('Loaded soul weapon engraving shapes', { count: Array.isArray(data) ? data.length : 0 });
  } catch (error) {
    logger.error('Failed to load shapes', { error });
    setShapes([]);
  }
};
```

#### 4. Updated data loading useEffect (line 86)
```javascript
// Before
await Promise.all([loadSkills(), loadSpirits(), loadWeapons(), loadStoneData()]);

// After
await Promise.all([loadSkills(), loadSpirits(), loadWeapons(), loadShapes(), loadStoneData()]);
```

#### 5. Updated URL loading useEffect condition (line 107)
```javascript
// Before
if (skills.length === 0 || spirits.length === 0) return;

// After
if (skills.length === 0 || spirits.length === 0 || shapes.length === 0) return;
```

#### 6. Fixed shared build loading (lines 136-141)
```javascript
// Before
const deserializedLoadout = {
  ...buildData.data,
  skillBuild: buildData.data.skillBuild ? deserializeSkillBuild(buildData.data.skillBuild, skills) : null,
  spiritBuild: buildData.data.spiritBuild ? deserializeSpiritBuild(buildData.data.spiritBuild, spirits, mySpirits) : null
};

// After
const deserializedLoadout = {
  ...buildData.data,
  skillBuild: buildData.data.skillBuild ? deserializeSkillBuild(buildData.data.skillBuild, skills) : null,
  spiritBuild: buildData.data.spiritBuild ? deserializeSpiritBuild(buildData.data.spiritBuild, spirits, mySpirits) : null,
  soulWeaponBuild: buildData.data.soulWeaponBuild ? deserializeSoulWeaponBuild(buildData.data.soulWeaponBuild, shapes) : null
};
```

#### 7. Fixed saved loadout loading (lines 183-188)
```javascript
// Before
const deserializedLoadout = {
  ...savedLoadout,
  skillBuild: savedLoadout.skillBuild ? deserializeSkillBuild(savedLoadout.skillBuild, skills) : null,
  spiritBuild: savedLoadout.spiritBuild ? deserializeSpiritBuild(savedLoadout.spiritBuild, spirits, mySpirits) : null
};

// After
const deserializedLoadout = {
  ...savedLoadout,
  skillBuild: savedLoadout.skillBuild ? deserializeSkillBuild(savedLoadout.skillBuild, skills) : null,
  spiritBuild: savedLoadout.spiritBuild ? deserializeSpiritBuild(savedLoadout.spiritBuild, spirits, mySpirits) : null,
  soulWeaponBuild: savedLoadout.soulWeaponBuild ? deserializeSoulWeaponBuild(savedLoadout.soulWeaponBuild, shapes) : null
};
```

#### 8. Fixed encoded loadout loading (lines 219-224)
```javascript
// Before
const deserializedLoadout = {
  ...decodedLoadout,
  skillBuild: decodedLoadout.skillBuild ? deserializeSkillBuild(decodedLoadout.skillBuild, skills) : null,
  spiritBuild: decodedLoadout.spiritBuild ? deserializeSpiritBuild(decodedLoadout.spiritBuild, spirits, mySpirits) : null
};

// After
const deserializedLoadout = {
  ...decodedLoadout,
  skillBuild: decodedLoadout.skillBuild ? deserializeSkillBuild(decodedLoadout.skillBuild, skills) : null,
  spiritBuild: decodedLoadout.spiritBuild ? deserializeSpiritBuild(decodedLoadout.spiritBuild, spirits, mySpirits) : null,
  soulWeaponBuild: decodedLoadout.soulWeaponBuild ? deserializeSoulWeaponBuild(decodedLoadout.soulWeaponBuild, shapes) : null
};
```

#### 9. Fixed draft loading with embedded builds (lines 252-256)
```javascript
// Before
const deserializedLoadout = {
  ...draft.currentLoadout,
  skillBuild: draft.currentLoadout.skillBuild ? deserializeSkillBuild(draft.currentLoadout.skillBuild, skills) : null,
  spiritBuild: draft.currentLoadout.spiritBuild ? deserializeSpiritBuild(draft.currentLoadout.spiritBuild, spirits, mySpirits) : null
};

// After
const deserializedLoadout = {
  ...draft.currentLoadout,
  skillBuild: draft.currentLoadout.skillBuild ? deserializeSkillBuild(draft.currentLoadout.skillBuild, skills) : null,
  spiritBuild: draft.currentLoadout.spiritBuild ? deserializeSpiritBuild(draft.currentLoadout.spiritBuild, spirits, mySpirits) : null,
  soulWeaponBuild: draft.currentLoadout.soulWeaponBuild ? deserializeSoulWeaponBuild(draft.currentLoadout.soulWeaponBuild, shapes) : null
};
```

#### 10. Fixed resolveLoadoutBuilds function (lines 576-592)
```javascript
// Before
return {
  ...loadout,
  skillBuild,
  spiritBuild,
  soulWeaponBuild: loadout.soulWeaponBuild || null
};

// After
// Deserialize soul weapon build (reconstruct shape objects from shapeIds)
let soulWeaponBuild = null;
if (loadout.soulWeaponBuild && shapes.length > 0) {
  soulWeaponBuild = deserializeSoulWeaponBuild(loadout.soulWeaponBuild, shapes);
  logger.debug('Deserialized soul weapon build in resolveLoadoutBuilds');
} else if (loadout.soulWeaponBuild) {
  // Shapes not loaded yet, pass through as-is (will be deserialized later)
  soulWeaponBuild = loadout.soulWeaponBuild;
  logger.warn('Soul weapon build present but shapes not loaded yet');
}

return {
  ...loadout,
  skillBuild,
  spiritBuild,
  soulWeaponBuild
};
```

#### 11. Updated useEffect dependencies (line 263)
```javascript
// Before
}, [skills, spirits, mySpirits, allSkillBuilds, allSpiritBuilds, userBuildsLoaded, isAuthenticated, user?.id, loadDraft]);

// After
}, [skills, spirits, mySpirits, shapes, allSkillBuilds, allSpiritBuilds, userBuildsLoaded, isAuthenticated, user?.id, loadDraft]);
```

#### 12. Added re-deserialization useEffect (lines 265-285)
```javascript
// Re-deserialize soul weapon build when shapes become available
useEffect(() => {
  if (shapes.length > 0 && currentLoadout.soulWeaponBuild) {
    // Check if soul weapon build needs deserialization (has shapeId but no shape in pieces)
    const gridState = currentLoadout.soulWeaponBuild.gridState;
    if (gridState && Array.isArray(gridState)) {
      const needsDeserialization = gridState.some(row =>
        row.some(cell => cell.piece && cell.piece.shapeId && !cell.piece.shape)
      );

      if (needsDeserialization) {
        logger.debug('Re-deserializing soul weapon build after shapes loaded');
        const deserializedSoulWeaponBuild = deserializeSoulWeaponBuild(currentLoadout.soulWeaponBuild, shapes);
        setCurrentLoadout(prev => ({
          ...prev,
          soulWeaponBuild: deserializedSoulWeaponBuild
        }));
      }
    }
  }
}, [shapes, currentLoadout.soulWeaponBuild]);
```

**Why needed:** If `resolveLoadoutBuilds()` is called before shapes finish loading, it passes through the serialized soul weapon build with a warning. This useEffect detects that case and re-deserializes the build once shapes become available.

#### 13. Added deserialization guard in SoulWeaponSection (lines 1948-1976, 1993-1996)
```javascript
const SoulWeaponSection = ({ soulWeaponBuild, onEdit, onClear, allWeapons }) => {
  // Check if soul weapon build is properly deserialized
  const isDeserialized = soulWeaponBuild?.gridState ?
    !soulWeaponBuild.gridState.some(row =>
      row.some(cell => cell.piece && cell.piece.shapeId && !cell.piece.shape)
    ) : true;

  // ... rest of component

  return (
    // ...
    {soulWeaponBuild ? (
      !isDeserialized ? (
        <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-300 dark:border-gray-700 p-4 w-full">
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm">Loading soul weapon data...</p>
        </div>
      ) : (
        // Render the grid
      )
    ) : (
      // No build
    )}
  );
};
```

**Why needed:** Prevents rendering the soul weapon grid before deserialization completes. Shows a loading state instead of crashing when pieces have `shapeId` but no `shape` object. The re-deserialization useEffect will trigger a re-render once deserialization completes.

## Data Flow After Fix

### Normal Case (Shapes loaded first)
```
User loads battle loadout from any source
    ↓
1. Component loads shapes data (/data/soul-weapon-engravings.json)
    ↓
2. Load loadout from source (GitHub / URL / localStorage)
    ↓
3. Deserialize soul weapon build using deserializeSoulWeaponBuild()
   → Reconstruct piece.shape from piece.shapeId
    ↓
4. Display in UI
   → EngravingPiece can access piece.shape.pattern ✅
```

### Race Condition Case (Loadout loads before shapes)
```
User loads battle loadout from source
    ↓
1. Load loadout (shapes still loading)
    ↓
2. resolveLoadoutBuilds() detects shapes not ready
   → Passes through serialized build with warning
    ↓
3. Component renders with serialized build
    ↓
4. SoulWeaponSection checks isDeserialized
   → Detects pieces have shapeId but no shape
   → Shows "Loading soul weapon data..." ✅ (prevents crash)
    ↓
5. Shapes finish loading
    ↓
6. Re-deserialization useEffect triggers
   → Deserializes soul weapon build
   → Updates currentLoadout state
    ↓
7. Component re-renders with deserialized build
    ↓
8. SoulWeaponSection checks isDeserialized
   → All pieces have shape objects now
   → Renders grid successfully ✅
    ↓
9. Display in UI
   → EngravingPiece can access piece.shape.pattern ✅
```

## Loading Paths Fixed

All five loading paths now deserialize soul weapon builds:

| Loading Path | Source | Fixed |
|--------------|--------|-------|
| **Shared build** | GitHub Issues (checksum) | ✅ Lines 136-141 |
| **Saved loadout** | GitHub Issues (loadout ID) | ✅ Lines 183-188 |
| **Encoded loadout** | URL parameter (base64) | ✅ Lines 219-224 |
| **Draft (embedded)** | LocalStorage (old format) | ✅ Lines 252-256 |
| **Draft (build IDs)** | LocalStorage (new format) | ✅ Lines 576-592 (resolveLoadoutBuilds) |

## Verification

### Runtime Verification
- ✅ Battle loadouts load correctly from saved loadouts panel
- ✅ Battle loadouts load correctly from share URLs
- ✅ Battle loadouts load correctly from encoded URLs
- ✅ Battle loadouts load correctly from localStorage drafts
- ✅ Soul weapon engravings display correctly in all loading paths
- ✅ EngravingPiece component renders without errors
- ✅ Shape patterns, stats, and descriptions available

## Pattern Summary

This fix completes the deserialization pattern across all components:

| Component | Deserialization | Status |
|-----------|----------------|--------|
| **SoulWeaponEngravingBuilder** | URL loading | ✅ Fixed in previous session |
| **SavedLoadoutsPanel** | Cache & GitHub loading | ✅ Fixed in previous session |
| **BattleLoadouts (getUserLoadouts service)** | GitHub loading | ✅ Fixed in previous session |
| **BattleLoadouts (component)** | All 5 loading paths | ✅ Fixed in this session |

All serialization/deserialization gaps have been closed. Soul weapon builds are now consistently:
- **Serialized on save** (shapeId only, ~46% size reduction)
- **Deserialized on load** (shape objects reconstructed)
- **Working across all components and loading paths**

## Related Documentation

- [Serialization Fix](./SERIALIZATION-FIX.md) - Initial soul weapon deserialization fix
- [My Spirits Cache Fix](./MY-SPIRITS-CACHE-FIX.md) - Cache consistency fix for spirit collection
- [Serialization Reference](./SERIALIZATION-REFERENCE.md) - Complete reference for all data formats
