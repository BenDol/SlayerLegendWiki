# Soul Weapon Deserialization Fix

## Issue

After implementing the serialization optimization for soul weapon builds, a runtime error occurred:

```
TypeError: Cannot read properties of undefined (reading 'pattern')
    at EngravingPiece (EngravingPiece.jsx:109:49)
```

## Root Cause

The soul weapon serialization optimization stores only `shapeId` (not full shape objects) to achieve ~46% size reduction. However, when loading battle loadouts from GitHub Issues, the system was **not deserializing** the data - it was returning loadouts with serialized soul weapon builds where `piece.shapeId` exists but `piece.shape` is undefined.

This caused the `EngravingPiece` component to crash when trying to access `piece.shape.pattern`.

## The Serialization Flow

**Before Save:**
```javascript
// Full object
soulWeaponBuild: {
  gridState: [[{
    active: true,
    piece: {
      shape: { id: 'shape-1', pattern: [[1,0],[1,1]], ... }, // 200+ lines
      shapeId: 'shape-1',
      rarity: 'Legendary',
      ...
    }
  }]]
}

// ↓ serializeLoadoutForStorage() ↓

// Serialized (46% smaller)
soulWeaponBuild: {
  gridState: [[{
    active: true,
    piece: {
      shapeId: 'shape-1', // Only ID!
      rarity: 'Legendary',
      ...
    }
  }]]
}
```

**After Load (Missing Step):**
```javascript
// Serialized data loaded from GitHub
// ❌ piece.shape is undefined!

// ↓ NEED TO DESERIALIZE ↓

// Deserialized (shape reconstructed)
// ✅ piece.shape is full object again
```

## Files Modified

### 1. `src/services/battleLoadouts.js`

**Added:**
- Import `deserializeSoulWeaponBuild` from `battleLoadoutSerializer.js`
- Shape data loading in `getUserLoadouts()`
- Deserialization of soul weapon builds after loading from GitHub

**Changes:**
```javascript
// Before
const loadouts = JSON.parse(loadoutsIssue.body || '[]');
return Array.isArray(loadouts) ? loadouts : [];

// After
const loadouts = JSON.parse(loadoutsIssue.body || '[]');

// Load shapes data
const shapesResponse = await fetch('/data/soul-weapon-engravings.json');
const shapes = await shapesResponse.json();

// Deserialize each loadout's soul weapon build
const deserializedLoadouts = loadouts.map(loadout => {
  if (loadout.soulWeaponBuild) {
    return {
      ...loadout,
      soulWeaponBuild: deserializeSoulWeaponBuild(loadout.soulWeaponBuild, shapes)
    };
  }
  return loadout;
});

return deserializedLoadouts;
```

### 2. `src/components/SavedLoadoutsPanel.jsx`

**Added:**
- Import `deserializeSoulWeaponBuild` from `battleLoadoutSerializer.js`
- `shapes` state
- `loadShapes()` function to fetch shape data
- Deserialization of cached soul weapon builds

**Changes:**
```javascript
// Load shapes data
const loadShapes = async () => {
  const response = await fetch('/data/soul-weapon-engravings.json');
  const data = await response.json();
  setShapes(Array.isArray(data) ? data : []);
};

// Deserialize cached loadouts
let cachedLoadouts = getCache('battle_loadouts', user.id);

if (cachedLoadouts && shapes.length > 0) {
  cachedLoadouts = cachedLoadouts.map(loadout => {
    if (loadout.soulWeaponBuild) {
      return {
        ...loadout,
        soulWeaponBuild: deserializeSoulWeaponBuild(loadout.soulWeaponBuild, shapes)
      };
    }
    return loadout;
  });
}
```

### 3. Import Path Fixes

Updated imports to use `.js` extensions for Node.js ESM compatibility:

**Files:**
- `src/utils/spiritSerialization.js`
- `src/utils/battleLoadoutSerializer.js`

**Changes:**
```javascript
// Before
import { createLogger } from './logger';
import { serializeBuild } from './spiritSerialization';

// After
import { createLogger } from './logger.js';
import { serializeBuild } from './spiritSerialization.js';
```

## Data Flow After Fix

```
User loads battle loadouts
    ↓
1. Load from cache (if exists)
   → Deserialize cached soul weapon builds
    ↓
2. Load from GitHub Issues
   → getUserLoadouts() fetches serialized data
   → Loads shape data (/data/soul-weapon-engravings.json)
   → Deserializes soul weapon builds
    ↓
3. Merge cache + GitHub data
   → Both sources now have full shape objects
    ↓
4. Display in UI
   → EngravingPiece can access piece.shape.pattern ✅
```

## Verification

### Tests Status
- ✅ All 98 comprehensive serialization tests passing
- ✅ All 16 initial serialization tests passing

### Runtime Verification
- ✅ Soul weapon builds load correctly from GitHub
- ✅ Soul weapon builds load correctly from cache
- ✅ EngravingPiece component renders without errors
- ✅ Shape patterns, stats, and descriptions available

## Performance Impact

**No negative impact:**
- Shapes data (~50KB) loaded once on component mount
- Deserialization happens async during data load
- No UI blocking
- Size reduction maintained: ~46% smaller storage

## Lessons Learned

1. **Serialization requires matching deserialization**: Every serialization optimization must have corresponding deserialization logic at load time.

2. **Cache needs same treatment as remote data**: Cached data is also serialized, so it needs deserialization too.

3. **Test coverage doesn't catch all integration issues**: Unit tests for serialization passed, but the integration point (loading in components) was missed.

4. **Add deserialization early**: When implementing serialization, immediately implement deserialization in all load paths.

## Related Documentation

- [Serialization Reference](./SERIALIZATION-REFERENCE.md) - Complete reference for all data formats
- [Serialization Tests](../tests/utils/serialization-comprehensive.test.js) - 98 field-level tests
