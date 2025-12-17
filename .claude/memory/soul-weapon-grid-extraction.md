# Soul Weapon Emblem Grid Data Extraction

**Date**: 2025-12-17
**Status**: Template Created, Data Extraction Needed
**File**: `public/data/soul-weapon-grids.json`

## Summary

Created a template structure for soul weapon emblem grid layouts. The actual grid data needs to be extracted from the game or game files.

## What Are Emblem Grids?

Emblem grids are the slot layouts on soul weapons where players can place emblems (special items that provide stat bonuses). Each soul weapon has a unique grid pattern:
- Different dimensions (2x2, 3x3, 3x4, 4x4, 4x5, etc.)
- Different active slot patterns (not all slots in a grid may be usable)
- Possibly special slots (center bonuses, locked slots, etc.)

## Search Results

### Searched Locations
1. **External directory**: `/external/extracted_data/` - Empty
2. **Decompiled APK**: `/external/decompiled/` - No weapon grid files found
3. **Online resources**: No specific emblem grid layout documentation found
4. **Existing wiki content**: `equipment/soul-weapons.md` - Minimal content

### Web Sources Checked
- [Weapons | Slayer Legend Wiki | Fandom](https://slayerlegend.fandom.com/wiki/Weapons) - General info only
- [How To Get Soul Weapon & Souls](https://mturbogamer.com/2023/03/slayer-legend-how-to-get-soul-weapon-souls/) - Acquisition guide
- [Slayer Legend Soul Weapon - Wiki Gamz](https://wikigamz.com/slayer-legend-soul-weapon/) - Basic info

## Template Structure Created

```json
{
  "gridTypes": { ... },  // Define common grid dimensions
  "weapons": [
    {
      "id": 1,
      "name": "Innocence",
      "gridType": "2x2",
      "activeSlots": [...],  // Which slots are usable
      "totalActiveSlots": 4,
      "notes": "TODO: Extract actual grid layout from game"
    }
  ]
}
```

## Data Extraction Methods

### Method 1: Manual In-Game Extraction (Most Reliable)
1. **Access each weapon**: Navigate to Equipment → Soul Weapons in-game
2. **Screenshot grids**: Take clear screenshots of each weapon's emblem grid
3. **Map the layout**: For each weapon, note:
   - Grid dimensions (rows × columns)
   - Which slots are active/available
   - Any special properties (locked, bonus slots, etc.)
4. **Document patterns**: Look for patterns (e.g., early weapons = 2x2, later = 4x4)

### Method 2: Game File Extraction
Look for these potential file locations in decompiled APK:
- `SoulGem*.json` or `SoulWeapon*.json`
- Emblem configuration files
- Grid layout data in Unity assets
- Database files with weapon properties

**Game files to check**:
```
/external/decompiled/main_apk/assets/
  - Look for JSON files related to weapons/emblems
  - Check Unity asset bundles
  - Search for "grid", "emblem", "slot" in file names
```

### Method 3: Community Sources
- **Discord**: Slayer Legend community server (if exists)
- **Reddit**: r/SlayerLegend or similar subreddits
- **Game wikis**: Check fandom wiki, community-maintained guides
- **YouTube**: Video guides showing weapon grid layouts

## Data Structure Details

### Grid Type Examples
```json
"gridTypes": {
  "2x2": { "rows": 2, "columns": 2, "totalSlots": 4 },
  "3x3": { "rows": 3, "columns": 3, "totalSlots": 9 },
  "3x4": { "rows": 3, "columns": 4, "totalSlots": 12 },
  "4x4": { "rows": 4, "columns": 4, "totalSlots": 16 },
  "4x5": { "rows": 4, "columns": 5, "totalSlots": 20 }
}
```

### Active Slots Format
```json
"activeSlots": [
  {
    "row": 0,        // Row index (0-based)
    "col": 0,        // Column index (0-based)
    "active": true,  // Is this slot usable?
    "special": null  // Optional: "center", "locked", "bonus", etc.
  }
]
```

### Complete Weapon Entry Example
```json
{
  "id": 10,
  "name": "Rage",
  "gridType": "3x3",
  "activeSlots": [
    { "row": 0, "col": 1, "active": true },
    { "row": 1, "col": 0, "active": true },
    { "row": 1, "col": 1, "active": true, "special": "center" },
    { "row": 1, "col": 2, "active": true },
    { "row": 2, "col": 1, "active": true }
  ],
  "totalActiveSlots": 5,
  "gridPattern": "cross",
  "notes": "Cross pattern with center bonus slot"
}
```

## Weapons List (57 Total)

From `public/data/equipment.json`, we have 57 soul weapons:
1. Innocence → 57. Deviation

Each needs:
- Grid dimensions
- Active slot layout
- Any special properties

## Likely Progression Pattern

Based on typical game design:
- **Early weapons (1-10)**: Smaller grids (2x2, 3x3)
- **Mid weapons (11-30)**: Medium grids (3x3, 3x4, 4x4)
- **Late weapons (31-57)**: Larger grids (4x4, 4x5, 5x5)

Not all slots may be active (e.g., diamond or cross patterns).

## Next Steps

1. **Option A - Manual extraction**:
   - Open game and document each weapon's grid
   - Create spreadsheet/notes for all 57 weapons
   - Update JSON file with actual data

2. **Option B - File extraction**:
   - Decompile newer APK version if needed
   - Search Unity assets for grid data
   - Parse and convert to JSON format

3. **Option C - Community**:
   - Contact game wiki maintainers
   - Check community Discord/Reddit
   - Ask if anyone has documented this

## Related Files

- `public/data/equipment.json` - Soul weapon stats (attack, requirements)
- `public/images/equipment/soul-weapons/` - Soul weapon images (SoulGem_*.png)
- `public/content/equipment/soul-weapons.md` - Wiki page (needs content)

## File Location

**Template created at**: `public/data/soul-weapon-grids.json`

The file includes:
- ✅ Schema structure
- ✅ Example entries for first 3 weapons
- ✅ Detailed instructions in `_instructions` field
- ✅ Example complete entry
- ⚠️ Placeholder data (marked with TODO)

## Usage After Population

Once data is populated, this file can be used for:
- **Weapon comparison tool**: Compare emblem slot availability
- **Build planner**: Visualize which emblems fit on each weapon
- **Progression guide**: Show how grids expand with weapon tier
- **Interactive grid display**: Render actual grid layouts in UI

The structure supports all common grid patterns and special slot types.
