# Battle Loadouts Draft Loading - Debug Session

## Issue Report

User reported: "when I refresh the page the draft load fails to load the skill build and spirit build even though I just saved them and when I load from the save list it loads correctly"

Also noted: "note could also be the ?loadout param load too"

## Initial Observations

From logs at `2025-12-26T06:55:00.297Z`:

```json
{
  "currentSkillBuildId": null,
  "savedSkillBuildId": "skill-builds-1766728620371-rocc2rbeu"
}
```

This shows that after loading a saved loadout, the `currentLoadout.skillBuild.id` is null, but the saved loadout has a skill build ID. This causes the `loadoutsMatch` function to fail, marking the loadout as having unsaved changes even though it matches a saved loadout.

## Hypothesis

The issue might be:
1. **Timing**: User builds (`allSkillBuilds`, `allSpiritBuilds`) not loaded before `resolveLoadoutBuilds` is called
2. **Deserialization**: The `deserializeSkillBuild` function is not preserving the `id` field
3. **Data mismatch**: The build found in `allSkillBuilds` doesn't have an `id` field

## Changes Made

### 1. Added Comprehensive Logging to `BattleLoadouts.jsx`

**Location**: `src/components/BattleLoadouts.jsx` lines 562-608

Added debug logging to track:
- What skill build ID is being searched for
- What IDs are available in `allSkillBuilds`
- Whether the build is found
- What the found build looks like before deserialization
- What the build looks like after deserialization

### 2. Added Logging to `deserializeSkillBuild`

**Location**: `src/utils/battleLoadoutSerializer.js` lines 48-91

Added logging to track:
- Input to deserializeSkillBuild (build ID, name, slots)
- Output from deserializeSkillBuild (deserialized ID, name, maxSlots, slots)

## Expected Log Output

When the page reloads with the new code, we should see logs like:

```
[DEBUG] [BattleLoadouts] Resolving skill build {
  "skillBuildId": "skill-builds-1766728620371-rocc2rbeu",
  "allSkillBuildsCount": 1,
  "allSkillBuildIds": ["skill-builds-1766728620371-rocc2rbeu"]
}

[DEBUG] [BattleLoadouts] Skill build found before deserialization {
  "foundId": "skill-builds-1766728620371-rocc2rbeu",
  "foundName": "Test",
  "hasSlots": true
}

[DEBUG] [BattleLoadoutSerializer] deserializeSkillBuild input {
  "buildId": "skill-builds-1766728620371-rocc2rbeu",
  "buildName": "Test",
  "hasSlots": true,
  "slotsCount": 10
}

[DEBUG] [BattleLoadoutSerializer] deserializeSkillBuild output {
  "deserializedId": "skill-builds-1766728620371-rocc2rbeu",
  "deserializedName": "Test",
  "deserializedMaxSlots": 10,
  "deserializedSlotsCount": 10
}

[DEBUG] [BattleLoadouts] Skill build after deserialization {
  "hasSkillBuild": true,
  "skillBuildId": "skill-builds-1766728620371-rocc2rbeu",
  "skillBuildName": "Test",
  "skillBuildMaxSlots": 10,
  "slotsCount": 10
}
```

## Possible Outcomes

### Scenario 1: ID is Preserved

If the logs show that `deserializedId` is correct, but later `currentSkillBuildId` is still null, then the issue is likely:
- The resolved loadout isn't being set correctly
- Or something is clearing the skillBuild.id after resolution

### Scenario 2: ID is Not Found

If the logs show `allSkillBuildsCount: 0` or the build is not found, then the issue is likely:
- User builds aren't loaded yet when resolveLoadoutBuilds is called
- Or there's a timing issue with the useEffect dependencies

### Scenario 3: ID is Lost During Deserialization

If the logs show that `foundId` is correct but `deserializedId` is null, then the issue is:
- The spread operator `...build` is not working as expected
- Or the input build doesn't have an id field

## Next Steps

1. **Wait for page reload** - User needs to refresh the Battle Loadouts page to trigger new logs
2. **Analyze logs** - Look for the new debug messages and trace the ID through the pipeline
3. **Fix root cause** - Based on which scenario matches, implement the appropriate fix

## Resolution

**Root cause identified without needing the logs!**

Through code analysis, I discovered that the issue was not in `resolveLoadoutBuilds` or deserialization - it was in the **SkillBuilder and SpiritBuilder modals** losing the build ID when returning edited builds.

See **[BATTLE-LOADOUTS-BUILD-ID-FIX.md](./BATTLE-LOADOUTS-BUILD-ID-FIX.md)** for complete details.

### The Fix

Modified `SkillBuilder.jsx` and `SpiritBuilder.jsx` to preserve the `id` field when returning builds from modals:

```javascript
const buildData = {
  id: currentLoadedBuildId, // ← Added this line
  name: buildName,
  maxSlots, // or just slots for spirit builder
  slots: build.slots
};
```

## Status

- ✅ Logging added to `BattleLoadouts.jsx` (lines 564-608)
- ✅ Logging added to `battleLoadoutSerializer.js` (lines 51-90)
- ✅ Root cause identified - Build ID lost in modal save
- ✅ Fix implemented in SkillBuilder.jsx (line 708)
- ✅ Fix implemented in SpiritBuilder.jsx (line 1318)
- ✅ Documentation created

## Related Files

- `src/components/BattleLoadouts.jsx` - Main component, URL/draft loading, resolveLoadoutBuilds
- `src/utils/battleLoadoutSerializer.js` - Serialization/deserialization utilities
- `wiki-framework/logs/debug.log` - Remote debug logs

---

*Created: 2025-12-26*
*Last Updated: 2025-12-26*
