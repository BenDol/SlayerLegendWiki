# Game-Specific Components Moved Out of Framework

## Overview
To keep the wiki framework generic and reusable for any wiki project, all Slayer Legend-specific components have been moved from the framework to the parent project.

## Components Moved

### Calculators (Game-Specific)
All calculator components with hardcoded game mechanics have been moved to the parent project:

**Location:** `src/components/calculators/`

1. **DamageCalculator.jsx** - Calculates damage with Attack, Crit Damage, Crit Chance, Elemental Bonus
2. **EnhancementCalculator.jsx** - Calculates enhancement costs (gold requirements)
3. **FusionCalculator.jsx** - Calculates fusion ratios (5:1 equipment fusion)
4. **StatCalculator.jsx** - Calculates stats after promotion tiers

**Import path updated from:**
```javascript
import { DamageCalculator } from './wiki-framework/src/components/calculators';
```

**To:**
```javascript
import { DamageCalculator } from './src/components/calculators';
```

## Components Kept in Framework (Generic)

These components remain in the framework because they're abstract enough to work for ANY wiki:

### 1. BuildEncoder (`wiki-framework/src/components/wiki/BuildEncoder.jsx`)
**Why it's generic:** Encodes ANY JSON object to a shareable URL
- Could be used for: character builds, search filters, map configurations, recipe combinations, etc.
- No game-specific logic
- Pure encode/decode utility

### 2. TierList & TierCard (`wiki-framework/src/components/wiki/`)
**Why they're generic:** Displays items in S/A/B/C/D ranking tiers
- Could be used for: game characters, weapons, restaurants, movies, strategies, etc.
- Takes generic `items` array with `tier` property
- Configurable categories and filtering

### 3. DataDrivenPage (`wiki-framework/src/components/wiki/DataDrivenPage.jsx`)
**Why it's generic:** Loads data from JSON files
- Works with any JSON structure
- Customizable render function
- No assumptions about data content

### 4. ProgressTracker (`wiki-framework/src/components/wiki/ProgressTracker.jsx`)
**Why it's generic:** Checkbox progress tracking with localStorage
- Could be used for: quest completion, collection tracking, tutorial steps, etc.
- Takes generic array of items (strings)
- Exportable/importable progress

### 5. SortableTable (`wiki-framework/src/components/wiki/SortableTable.jsx`)
**Why it's generic:** Sortable/filterable data table
- Works with any data structure
- Configurable columns
- Built-in pagination and search

## Benefits of This Separation

### For the Framework
✅ **Truly reusable** - Can power wikis for games, recipes, travel guides, software docs, etc.
✅ **Easier to maintain** - No game-specific code to update
✅ **Smaller bundle** - Only generic utilities included
✅ **Clear boundaries** - Framework = infrastructure, Parent = content

### For Your Project
✅ **Full control** - Modify game calculators without touching framework
✅ **Easy customization** - Add new Slayer Legend features freely
✅ **Clear organization** - Game logic stays with game content
✅ **Independent updates** - Update framework without breaking your calculators

## File Structure After Move

```
wiki-project/
├── src/
│   └── components/
│       └── calculators/              # ✨ NEW: Game-specific calculators
│           ├── DamageCalculator.jsx
│           ├── EnhancementCalculator.jsx
│           ├── FusionCalculator.jsx
│           ├── StatCalculator.jsx
│           └── index.js
├── wiki-framework/                   # Framework (generic only)
│   └── src/
│       └── components/
│           ├── wiki/
│           │   ├── BuildEncoder.jsx     # ✅ Generic (stays)
│           │   ├── TierList.jsx         # ✅ Generic (stays)
│           │   ├── TierCard.jsx         # ✅ Generic (stays)
│           │   ├── DataDrivenPage.jsx   # ✅ Generic (stays)
│           │   ├── ProgressTracker.jsx  # ✅ Generic (stays)
│           │   └── SortableTable.jsx    # ✅ Generic (stays)
│           └── common/
│               └── Button.jsx           # ✅ Generic UI component
└── content/
    └── tools/
        ├── damage-calculator.md      # Uses src/components/calculators/
        ├── enhancement-calculator.md
        ├── fusion-calculator.md
        └── stat-calculator.md
```

## Using Calculators in Content

In your markdown files, import from the parent project:

```markdown
---
title: Damage Calculator
---

# Damage Calculator

Calculate your character's damage output.

<DamageCalculator />
```

The markdown processor will resolve the component from `src/components/calculators/` automatically.

## Migration Checklist

- [x] Created `src/components/calculators/` directory
- [x] Moved all calculator files to parent project
- [x] Updated imports to point to framework's common components
- [x] Removed calculators from framework
- [x] Verified no framework code references calculators
- [x] Updated documentation

## Next Steps

If you add new game-specific components in the future, follow these guidelines:

### Add to Parent Project If:
- Contains hardcoded game mechanics or formulas
- Specific to Slayer Legend lore/gameplay
- Uses game-specific data structures
- Would only work for this particular game

### Keep in Framework If:
- Works with any data structure (configurable)
- Solves a common wiki problem (search, navigation, etc.)
- Could be used in wikis for other topics
- Has no assumptions about content domain
