# My Spirits Collection Cache Fix

## Issue

After adding spirits to "My Spirits Collection" (either from MySpiritCollection or SpiritBuilder), the spirits don't appear in the UI even though they're saved to GitHub. The issue occurs when:

1. User adds a spirit via "Add Spirit" button (MySpiritCollection)
2. User adds a spirit via "Add to Collection" button (SpiritBuilder)
3. Cache becomes stale
4. UI shows old cached data instead of new spirits

## Root Cause

**SpiritBuilder component** wasn't using cache properly:

### Problems Found:

1. **`loadMySpirits()` didn't check cache** - Always fetched from API (line 327-372)
2. **`handleSaveToCollection()` didn't update cache** - After saving, it called `loadMySpirits()` but cache wasn't updated first (line 742)
3. **Stale cache issue**: When MySpiritCollection component loaded later, it saw stale cache from before the save

### Flow of the Bug:

```
1. User adds spirit from SpiritBuilder
   ↓
2. SpiritBuilder saves to API → API returns updated spirits list
   ↓
3. SpiritBuilder calls loadMySpirits()
   ↓
4. loadMySpirits() fetches from API (ignores cache)
   ↓
5. BUT cache never gets updated!
   ↓
6. User navigates to MySpiritCollection
   ↓
7. MySpiritCollection checks cache → finds STALE data from before save
   ↓
8. Returns early with stale data → New spirit missing! ❌
```

## Files Fixed

### 1. `src/components/SpiritBuilder.jsx`

**Changes:**

#### A. Added cache import (line 11):
```javascript
// Before
import { setCache } from '../utils/buildCache';

// After
import { setCache, getCache } from '../utils/buildCache';
```

#### B. Updated `loadMySpirits()` to check cache first (lines 319-385):
```javascript
// Before
const loadMySpirits = async () => {
  // Always fetch from API (no cache check)
  const response = await fetch(endpoint);
  const spiritsArray = data.spirits || data || [];
  setMySpirits(spiritsArray);
  // ❌ Never updates cache
};

// After
const loadMySpirits = async () => {
  // Check cache first
  const cached = getCache('my_spirits', user.id);
  if (cached && Array.isArray(cached)) {
    logger.debug('Loaded my-spirits from cache', { count: cached.length });
    setMySpirits(cached);
    setMySpiritsLoaded(true);
    return; // ✅ Return early with cached data
  }

  // Fetch from API only if no cache
  const response = await fetch(endpoint);
  const spiritsArray = data.spirits || data || [];
  setMySpirits(spiritsArray);

  // Update cache with fetched data
  setCache('my_spirits', user.id, spiritsArray); // ✅ Cache API response
};
```

#### C. Updated `handleSaveToCollection()` to update cache after save (lines 699-703):
```javascript
// Before
const responseData = await response.json();
const savedSpirits = responseData.spirits || [];
const savedSpirit = savedSpirits.find(...);
await loadMySpirits(); // ❌ Cache not updated before reload

// After
const responseData = await response.json();
const savedSpirits = responseData.spirits || [];

// Update cache with the response data
if (savedSpirits && savedSpirits.length > 0) {
  setCache('my_spirits', user.id, savedSpirits); // ✅ Update cache!
  logger.debug('Updated my-spirits cache after save', { count: savedSpirits.length });
}

const savedSpirit = savedSpirits.find(...);
await loadMySpirits(); // Now loads from fresh cache
```

## Fixed Flow

```
1. User adds spirit from SpiritBuilder
   ↓
2. SpiritBuilder saves to API → API returns updated spirits list
   ↓
3. SpiritBuilder updates cache with API response ✅
   ↓
4. SpiritBuilder calls loadMySpirits()
   ↓
5. loadMySpirits() checks cache → finds FRESH data ✅
   ↓
6. Returns early with updated data → New spirit visible! ✅
   ↓
7. User navigates to MySpiritCollection
   ↓
8. MySpiritCollection checks cache → finds same fresh data ✅
   ↓
9. Returns early → New spirit still visible! ✅
```

## Cache Consistency

Both components now use cache consistently:

| Component | Load | Save | Cache Update |
|-----------|------|------|--------------|
| **MySpiritCollection** | ✅ Checks cache first | ✅ Updates cache | ✅ After API response |
| **SpiritBuilder** | ✅ Checks cache first | ✅ Updates cache | ✅ After API response |

## Testing

### Manual Test Steps:

1. **Clear cache** - Open DevTools → Application → Local Storage → Clear
2. **Login** - Authenticate with GitHub
3. **Go to SpiritBuilder** - Navigate to spirit builder page
4. **Add spirit to collection** - Click "Add to Collection" button
5. **Verify immediately** - Spirit should appear in collection panel immediately
6. **Go to MySpiritCollection** - Navigate to My Spirits page
7. **Verify persistence** - Same spirit should appear there too

### Expected Results:

✅ Spirit appears immediately after adding (no refresh needed)
✅ Spirit persists when navigating to MySpiritCollection
✅ Cache shows correct data in DevTools → Application → Local Storage
✅ No duplicate API calls (cache prevents unnecessary fetches)

### Cache Key Format:

```
Key: my_spirits:123456
Value: [
  { id: "...", spiritId: 101, level: 50, ... },
  { id: "...", spiritId: 102, level: 60, ... }
]
```

## Related Files

- `src/components/MySpiritCollection.jsx` - Already uses cache correctly (no changes needed)
- `src/utils/buildCache.js` - Cache utilities (`getCache`, `setCache`)
- `src/utils/spiritSerialization.js` - Serialization utilities for spirits

## Summary

✅ **SpiritBuilder now checks cache** before fetching from API
✅ **SpiritBuilder now updates cache** after saving
✅ **Cache consistency** across all components
✅ **Immediate UI updates** after adding spirits
✅ **Reduced API calls** (cache prevents unnecessary fetches)

The My Spirits Collection should now load correctly and show newly added spirits immediately!
