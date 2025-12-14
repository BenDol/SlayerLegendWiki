# EquipmentCard Quick Start Guide

## What is EquipmentCard?

EquipmentCard is a component that displays beautiful, detailed equipment (weapon) cards in the Slayer Legend wiki. It automatically loads weapon stats, images, and calculates useful metrics like efficiency and return rate.

## Basic Usage in Markdown

The easiest way to use EquipmentCard is in markdown files:

```markdown
<!-- equipment:Innocence -->
```

This will display a card showing:
- Equipment image (automatically loaded)
- Attack power
- Gold cost
- Disassembly reward
- Stage requirement
- Efficiency metrics
- Rarity tier

## Two Ways to Reference Equipment

### 1. By Name
```markdown
<!-- equipment:Innocence -->
<!-- equipment:Pride -->
<!-- equipment:Willingness -->
```

### 2. By ID
```markdown
<!-- equipment:1 -->
<!-- equipment:13 -->
<!-- equipment:23 -->
```

## Example Page

Create a markdown file at `public/content/guides/weapon-guide.md`:

```markdown
---
title: Weapon Progression Guide
description: Best weapons for each stage of the game
tags: [weapons, equipment, progression, guide]
category: Guides
date: 2025-12-13
---

# Weapon Progression Guide

## Early Game Strategy

Start with this weapon as soon as you can afford it:

<!-- equipment:Innocence -->

## When to Upgrade

You should upgrade to the next weapon when you reach these stages:

### Black Forest → Red Mountain
<!-- equipment:Coolness -->

### Red Mountain → Land of Desire
<!-- equipment:Desire -->

## Mid Game Weapons

Once you reach stage 30+, prioritize these weapons:

<!-- equipment:Effort -->

## Efficiency Analysis

Some weapons offer better gold-to-attack ratios:

<!-- equipment:Patience -->

Check the "Efficiency" stat to compare value!

## End Game Targets

Ultimate weapons for veteran players:

<!-- equipment:Pride -->
<!-- equipment:Bravery -->
<!-- equipment:Willingness -->
```

## Advanced Usage (JSX)

If you're building custom pages with JSX:

```jsx
import EquipmentCard from '../components/EquipmentCard';

// In your component
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <EquipmentCard name="Innocence" />
  <EquipmentCard id={13} />
  <EquipmentCard equipment={{
    id: 23,
    name: "Willingness",
    requirements: 243000000,
    attack: 1000000,
    disassemblyReward: 121500000,
    stageRequirement: "Delusion Forest"
  }} />
</div>
```

## Understanding Rarity

Equipment rarity is automatically determined by cost:

| Tier | Cost Range | Color |
|------|------------|-------|
| **Common** | < 100k | Gray |
| **Great** | 100k - 10M | Green |
| **Rare** | 10M - 1B | Blue |
| **Epic** | 1B - 100B | Purple |
| **Legendary** | 100B+ | Orange |

## Tips & Tricks

### 1. Equipment Comparison
Create a comparison page by listing multiple equipment cards:

```markdown
## Weapon Comparison

<!-- equipment:Pride -->
<!-- equipment:Bravery -->
<!-- equipment:Runaway -->

Compare the **Efficiency** stat to see which offers the best value!
```

### 2. Progressive Disclosure
Use equipment cards in tutorials to gradually introduce new gear:

```markdown
## Level 10: Your First Weapon
<!-- equipment:Innocence -->

## Level 30: Power Spike
<!-- equipment:Effort -->

## Level 50: Elite Equipment
<!-- equipment:Pride -->
```

### 3. Stage-Based Guides
Group equipment by stage requirements:

```markdown
## Black Forest Equipment
<!-- equipment:1 -->

## Red Mountain Equipment
<!-- equipment:2 -->

## Land of Desire Equipment
<!-- equipment:3 -->
```

### 4. Budget Guides
Help players plan their gold spending:

```markdown
## Budget Build (< 100k)
<!-- equipment:Innocence -->
<!-- equipment:Coolness -->

## Mid-Range Build (100k - 1M)
<!-- equipment:Desire -->
<!-- equipment:Effort -->
```

## Common Issues

### Equipment Not Found
- **Problem:** `Equipment not found: XYZ`
- **Solution:** Check the equipment name matches exactly (case-insensitive is OK)
- **Check:** Look in `/public/data/equipment.json` for the correct name

### No Image Displayed
- **Problem:** Card shows but no weapon image
- **Solution:** This is normal if no matching image in the database
- **Note:** Component will still display all stats correctly

### Markdown Not Rendering
- **Problem:** Seeing `<!-- equipment:X -->` as plain text
- **Solution:**
  1. Check the syntax (no extra spaces)
  2. Ensure PageViewer component is used to render the page
  3. Rebuild project: `npm run build`

## Equipment Data Structure

All equipment data is stored in `/public/data/equipment.json`:

```json
{
  "id": 1,
  "name": "Innocence",
  "requirements": 2000,
  "attack": 6300,
  "disassemblyReward": 1000,
  "stageRequirement": "Black Forest"
}
```

**Total Equipment:** 57 weapons (IDs 1-57)

## Performance Notes

- **Fast Loading:** Equipment data cached after first load
- **Lazy Images:** Images load only when scrolled into view
- **No Lag:** Cards render smoothly even with many on one page
- **Mobile Friendly:** Responsive design works on all devices

## Testing Your Cards

1. **Create a test page:**
   ```bash
   touch public/content/test-equipment.md
   ```

2. **Add test content:**
   ```markdown
   ---
   title: Equipment Card Test
   ---

   # Equipment Card Test

   <!-- equipment:Innocence -->
   <!-- equipment:Pride -->
   <!-- equipment:Willingness -->
   ```

3. **View in browser:**
   - Start dev server: `npm run dev`
   - Navigate to `/#/test-equipment`
   - Check that all cards display correctly

## Next Steps

- **Read full docs:** `src/components/README-EquipmentCard.md`
- **See examples:** `public/content/equipment/weapons.md`
- **Browse all equipment:** Check `/public/data/equipment.json`
- **View images:** Look in `/public/images/equipment/weapons/`

## Need Help?

- Check browser console for error messages
- Verify equipment.json has the correct data
- Ensure image index is up to date: `npm run build:search`
- Test with a known equipment ID like `<!-- equipment:1 -->`

## Related Guides

- **SpellCard:** Similar component for spells (`SPELLCARD-USAGE.md`)
- **Image Database:** Understanding image resolution (`IMAGE-INDEX-USAGE.md`)
- **Data-Driven Pages:** Loading equipment lists dynamically

---

**Version:** 1.0.0
**Last Updated:** 2025-12-13
**Component Location:** `src/components/EquipmentCard.jsx`
