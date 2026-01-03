# Soul Weapon Engraving Data Extraction

**Date:** 2025-12-17
**Status:** Structure Complete - Awaiting Stat Values

## Objective

Extract and document soul weapon engraving piece (Soul Gem) data including:
- Shape patterns (7 tetris-style pieces)
- Rarity tiers (Common, Great, Rare, Epic, Legendary, Mythic)
- Stat bonuses per rarity and level
- Level scaling formulas

## Research Findings

### Confirmed Information

✅ **System Mechanics:**
- Unlocks at Stage 320 (Pride soul weapon)
- Uses Chaos Soul consumable to randomize pieces
- 8 total slots per weapon grid
- Pieces can be rotated to fit
- Grid completion bonus applies when all slots filled without gaps

✅ **7 Shape Types:**
1. L-Shape (3x1) - ATK
2. Reverse L-Shape (3x1) - HP
3. T-Shape (3x1) - HP Recovery
4. Square (2x2) - Critical Damage
5. Line (4x1) - Extra Gold
6. Squiggle (3x2) - Accuracy
7. Reverse Squiggle (3x2) - Dodge

✅ **6 Rarity Tiers:**
- Common (ID: 0, Gray)
- Great (ID: 1, Green)
- Rare (ID: 2, Blue)
- Epic (ID: 3, Purple)
- Legendary (ID: 4, Orange)
- Mythic (ID: 5, Red)

✅ **Image Assets:**
All SoulGem_{rarity}_{shape}.png files exist in `public/images/equipment/soul-weapons/`

### Missing Information

❌ **Stat Percentages:**
- No numerical values found for stat bonuses per rarity
- Unknown: Common ATK%, Great ATK%, Rare ATK%, etc.
- All 7 shapes × 6 rarities = 42 base values needed

❌ **Level Scaling:**
- Engraving pieces have levels that increase stat %
- Level scaling formula unknown
- Max level per rarity unknown

❌ **Drop Rates:**
- Drop rate increase by soul weapon level unknown
- Exact probability per rarity tier unknown

## Sources Checked

✅ **Online Resources:**
- [NamuWiki - Soul Weapon Guide](https://en.namu.wiki/w/슬레이어%20키우기/소울웨폰)
- [Slayer Legends Data & Formulas](https://sites.google.com/view/slayerlegends/data-formulas)
- [Master Game Document](https://docs.google.com/spreadsheets/d/1ZbNMPd40pPKwX5MmXzhWNfZzvrUm1bjrEKQ20IsHSGY/)

✅ **Local Files:**
- research/comprehensive-main-soulsweapons.json (weapon data only, no engravings)
- research/documents.md (links to master sheets)
- external/decompiled/ (no engraving data found in searched files)

## Output Created

**File:** `public/data/soul-weapon-engravings.json`

Complete data structure with:
- All 7 shape definitions with grid patterns
- All 6 rarity tier definitions with colors
- System mechanics documentation
- Strategy recommendations
- Placeholder "TBD" values for stats

## Next Steps Required

To complete the data file, one of these methods is needed:

### Option A: In-Game Screenshots
Take screenshots showing engraving pieces at different rarities with visible stat percentages:
- Example: "Common L-Shape: ATK +2.5%"
- Need at least one piece per shape/rarity combination
- Best: Screenshot of engraving inventory or upgrade screen

### Option B: In-Game Observation
Manually record stat values from game:
- Check engraving inventory
- Note stat % for each rarity level
- Record level 1 and max level values if possible
- Document level scaling pattern

### Option C: Data Mining
Search for CSV/JSON files in decompiled APK that contain:
- "SoulGem" or "Engraving" data tables
- Stat percentage arrays
- Level scaling coefficients

## Data Structure Design

```json
{
  "shapes": [
    {
      "id": 1,
      "stat": "ATK",
      "pattern": [[1,0],[1,0],[1,1]],
      "baseStats": {
        "common": { "level1": "TBD", "maxLevel": "TBD" },
        "great": { "level1": "TBD", "maxLevel": "TBD" },
        // ... etc
      }
    }
  ]
}
```

## Recommendations

Priority for data collection:
1. **ATK piece (L-Shape)** - Most commonly used
2. **CRIT_DMG piece (Square)** - Second priority
3. **HP piece (Reverse L)** - Third priority
4. Other pieces as available

Focus on Common → Mythic progression for primary stats first, then fill in secondary stats.
