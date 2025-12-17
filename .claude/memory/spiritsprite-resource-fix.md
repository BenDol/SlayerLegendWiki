# SpiritSprite Resource Exhaustion Fix

**Date**: 2025-12-17
**Issue**: `ERR_INSUFFICIENT_RESOURCES` when loading spirit sprites
**Error**: "No frames found for this animation"
**Status**: Fixed ✅

## Root Cause

The `SpiritSprite` component was trying to load all 16 sprite frames **simultaneously** for every spirit to detect which animations are available. When multiple spirits were displayed at once (e.g., in the SpiritSelector grid), this created:

- **Concurrent requests**: 16 frames × N spirits = hundreds of simultaneous image loads
- **Browser resource limits**: Browsers have limits on concurrent connections (typically 6-10 per domain)
- **Memory exhaustion**: Loading many large images at once exhausts browser memory
- **No caching**: Same spirit+level combinations were re-detected on every component mount

### Example Scenario
- SpiritSelector grid shows 20 spirits
- Each sprite tries to load 16 frames immediately
- **Total**: 320 concurrent image requests
- **Result**: Browser hits `ERR_INSUFFICIENT_RESOURCES` and fails

## Fixes Applied

### 1. Batched Frame Loading
**Problem**: Loading all 16 frames at once with `Promise.all()`

**Fix**: Load frames in batches of 4 with small delays between batches

```javascript
// Before: Load all 16 frames simultaneously
const allFrameResults = await Promise.all(allFramesPromises);

// After: Load in batches of 4 with 50ms delay between batches
const BATCH_SIZE = 4;
for (let i = 0; i < 16; i += BATCH_SIZE) {
  const batchPromises = [];
  for (let j = i; j < Math.min(i + BATCH_SIZE, 16); j++) {
    batchPromises.push(loadFrame(j));
  }
  const batchResults = await Promise.all(batchPromises);
  existingFrames.push(...batchResults.filter(r => r !== null));

  // Small delay between batches
  if (i + BATCH_SIZE < 16) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
```

**Benefits**:
- Reduces concurrent requests from 16 to 4 per sprite
- 50ms delay between batches prevents overwhelming the browser
- Still fast enough (16 frames in ~200ms per sprite)

### 2. Module-Level Caching
**Problem**: Re-detecting frames for same spirit+level on every component mount

**Fix**: Added module-level cache using `Map`

```javascript
// Module-level cache (outside component)
const animationDetectionCache = new Map();

// Check cache before detection
const cacheKey = `${spiritId}_${level}`;
const cachedResults = animationDetectionCache.get(cacheKey);

if (cachedResults) {
  // Use cached results immediately
  setAvailableAnimationTypes(cachedResults);
  return;
}

// After detection, cache the results
animationDetectionCache.set(cacheKey, results);
```

**Benefits**:
- No re-detection when same spirit appears multiple times
- Instant loading for previously seen spirit+level combinations
- Cache persists across component unmount/remount
- Significantly reduces total image loads

## Performance Impact

### Before
- **Concurrent requests**: 16 per sprite (unlimited)
- **Cache**: None
- **20 spirits on screen**: 320 concurrent requests → `ERR_INSUFFICIENT_RESOURCES`
- **Revisiting same spirits**: Full re-detection every time

### After
- **Concurrent requests**: 4 per sprite (batched)
- **Cache**: Results cached per spirit+level
- **20 spirits on screen**: 80 concurrent requests (manageable)
- **Revisiting same spirits**: Instant (cached)

## Testing

Test scenarios to verify the fix:
1. ✅ Open SpiritSelector with many spirits - should load without errors
2. ✅ Rapid level changes on same spirit - should use cache after first load
3. ✅ Navigate away and back - should use cached detection
4. ✅ Multiple instances of same spirit - should only detect once

## Related Files

- `src/components/SpiritSprite.jsx` - Main component with batching and caching
- `src/components/SpiritSelector.jsx` - Grid view that shows many sprites
- `src/components/SpiritPicker.jsx` - Another component that shows many sprites
- `public/images/companions/` - 4,448 spirit sprite images

## Additional Notes

- The batching approach is a common pattern for preventing resource exhaustion
- Module-level cache is appropriate here since sprite frame layouts don't change at runtime
- Cache has no size limit but could be added if memory becomes a concern (unlikely)
- Console logs added for debugging: "Using cached animation types" and "Cached animation types"
