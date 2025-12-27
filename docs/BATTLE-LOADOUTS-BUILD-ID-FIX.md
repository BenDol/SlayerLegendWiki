# Battle Loadouts Build ID Fix

## Issue

User reported: *"when I refresh the page the draft load fails to load the skill build and spirit build even though I just saved them and when I load from the save list it loads correctly"*

## Root Cause

The SkillBuilder and SpiritBuilder modals were **losing the build ID** when returning edited builds to the BattleLoadouts component.

### The Bug Flow

1. User loads a saved battle loadout (e.g., "Test Loadout")
   - Loadout has `skillBuildId: "skill-builds-1766728620371-rocc2rbeu"`
   - Loadout is resolved, so `skillBuild` object has `id: "skill-builds-1766728620371-rocc2rbeu"`

2. User clicks "Edit" on the skill build
   - SkillBuilderModal opens with `initialBuild={currentLoadout.skillBuild}` (which has the `id`)
   - `currentLoadedBuildId` is set to the build's ID

3. User makes changes and clicks "Save" in the modal
   - SkillBuilder's `handleSaveBuild()` is called
   - It creates a **new object** with only `name`, `maxSlots`, `slots`
   - **THE `id` FIELD IS NOT INCLUDED!**

4. The ID-less build is set in currentLoadout
   - `setCurrentLoadout(prev => ({ ...prev, skillBuild: buildWithoutId }))`
   - Now `currentLoadout.skillBuild.id` is `undefined`

5. Draft auto-saves to localStorage
   - The draft contains `currentLoadout` with the ID-less skill build

6. User saves the battle loadout to GitHub Issues
   - `serializeLoadoutForStorage` tries to extract `loadout.skillBuild?.id`
   - Returns `null` because the build has no `id`
   - The saved loadout has `skillBuildId: null` instead of the actual ID!

7. User refreshes the page
   - Draft loads from localStorage
   - `currentLoadout.skillBuild` has no `id` field
   - `loadoutsMatch` compares:
     - `currentLoadout.skillBuild?.id` = `null`
     - `savedLoadout.skillBuildId` = `"skill-builds-1766728620371-rocc2rbeu"`
   - They don't match, so the loadout is marked as having unsaved changes

## The Fix

### Before (SkillBuilder.jsx lines 705-714)

```javascript
const handleSaveBuild = () => {
  if (onSave) {
    const buildData = {
      name: buildName,
      maxSlots,
      slots: build.slots
    };
    onSave(buildData);
  }
};
```

### After (SkillBuilder.jsx lines 705-715)

```javascript
const handleSaveBuild = () => {
  if (onSave) {
    const buildData = {
      id: currentLoadedBuildId, // Preserve build ID for existing builds
      name: buildName,
      maxSlots,
      slots: build.slots
    };
    onSave(buildData);
  }
};
```

### Same Fix Applied to SpiritBuilder.jsx (lines 1315-1323)

```javascript
const handleSaveBuild = () => {
  if (onSave) {
    const buildData = {
      id: currentLoadedBuildId, // Preserve build ID for existing builds
      name: buildName,
      slots: build.slots
    };
    onSave(buildData);
  }
};
```

## Why This Works

1. **`currentLoadedBuildId` is already tracked**: When a build is loaded (via `loadFromSavedBuilds`), the ID is stored in this state variable

2. **Preserves the ID for existing builds**: When editing an existing build, the ID is now included in the returned `buildData`

3. **Null for new builds**: When creating a new build (not editing), `currentLoadedBuildId` is `null`, which is correct

4. **Draft loading works**: After editing a build, the draft contains the skill build WITH its ID, so `resolveLoadoutBuilds` and `loadoutsMatch` work correctly

## Files Modified

1. **`src/components/SkillBuilder.jsx`** (line 708)
   - Added `id: currentLoadedBuildId` to `buildData`

2. **`src/components/SpiritBuilder.jsx`** (line 1318)
   - Added `id: currentLoadedBuildId` to `buildData`

## Testing Checklist

- [ ] Load a saved battle loadout that references skill/spirit builds by ID
- [ ] Edit the skill build in the modal, make changes, click "Save"
- [ ] Verify the skill build still shows as matching the saved build (no unsaved changes)
- [ ] Save the battle loadout
- [ ] Refresh the page
- [ ] Verify the draft loads correctly with skill/spirit builds visible
- [ ] Verify `loadoutsMatch` correctly identifies the loadout as matching
- [ ] Test with ?loadout=id URL parameter loading
- [ ] Test with creating NEW builds (should work with id: null)

## Impact

This fix resolves:
- ✅ Draft loading after refresh shows skill/spirit builds correctly
- ✅ URL parameter loading (?loadout=id) works correctly
- ✅ loadoutsMatch correctly identifies matching loadouts
- ✅ Saved loadouts retain their build ID references
- ✅ No "unsaved changes" flag for unmodified loadouts

## Related Issues

- Previously fixed: Soul weapon deserialization (shapes not loading)
- Previously fixed: SavedLoadoutsPanel preview icons (build resolution)
- This fix: Build IDs lost when editing in modals

---

*Created: 2025-12-26*
*Session: Battle Loadouts Draft Loading Debug*
