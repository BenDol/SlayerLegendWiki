# Soul Weapon Image Mapping

## Overview
Soul weapon data in `public/data/soul-weapons.json` is now mapped to their respective images.

## Image Pattern
- **Location**: `public/images/equipment/weapons/`
- **Pattern**: `sword_20{id}.png` where `{id}` is the weapon ID (1-padded to match 201, 202, etc.)

## Mapping Formula
- **ID 1-9**: `sword_20{id}.png` → `sword_201.png`, `sword_202.png`, ..., `sword_209.png`
- **ID 10-99**: `sword_2{id}.png` → `sword_210.png`, `sword_211.png`, ..., `sword_257.png`

## Examples

| Weapon ID | Weapon Name | Image Path |
|-----------|-------------|------------|
| 1 | Innocence | `/images/equipment/weapons/sword_201.png` |
| 2 | Coolness | `/images/equipment/weapons/sword_202.png` |
| 10 | Rage | `/images/equipment/weapons/sword_210.png` |
| 25 | Hope | `/images/equipment/weapons/sword_225.png` |
| 47 | FightingWill | `/images/equipment/weapons/sword_247.png` |
| 57 | Deviation | `/images/equipment/weapons/sword_257.png` |

## JSON Structure

Each weapon entry now includes an `image` field:

```json
{
  "id": 1,
  "name": "Innocence",
  "requirements": 2000,
  "attack": 6300,
  "disassemblyReward": 1000,
  "stageRequirement": "Black Forest",
  "image": "/images/equipment/weapons/sword_201.png"
}
```

## Usage in Wiki

You can now reference weapon images in the wiki by:

1. **Direct path**: `/images/equipment/weapons/sword_201.png`
2. **Via JSON data**: Load weapon data and use the `image` field
3. **In markdown**:
   ```markdown
   ![Innocence](/images/equipment/weapons/sword_201.png)
   ```

## Image Variants

Some weapons have variant images with `_1` suffix:
- `sword_201.png` (base)
- `sword_201_1.png` (variant)

These variants are not included in the JSON mapping but are available if needed.

## Complete Mapping (57 weapons)

All 57 soul weapons (ID 1-57) have been mapped to their images:
- ✓ All base images exist: `sword_201.png` through `sword_257.png`
- ✓ JSON updated with `image` field for all weapons
- ✓ Paths are absolute from web root (`/images/...`)

## Script Used

The mapping was automated using `external/scripts/add-weapon-images.py`:

```python
for weapon in weapons:
    weapon_id = weapon['id']
    if weapon_id < 10:
        image_path = f"/images/equipment/weapons/sword_20{weapon_id}.png"
    else:
        image_path = f"/images/equipment/weapons/sword_2{weapon_id}.png"
    weapon['image'] = image_path
```
