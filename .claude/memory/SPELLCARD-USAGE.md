# SpellCard Component - Quick Start Guide

## What I Created

✅ **SpellCard Component** (`src/components/SpellCard.jsx`)
   - Beautiful card UI for displaying spell information
   - Loads data from `/data/skills.json`
   - Color-coded by element and grade
   - Shows all spell stats with calculated max level damage

✅ **Example Spells Gallery Page** (`src/pages/SpellsPage.jsx`)
   - Complete working example with filters
   - Shows all spells in a grid layout
   - Filter by element and grade
   - (Not yet added to router - see below)

✅ **Documentation**
   - `src/components/README-SpellCard.md` - Detailed component docs
   - `public/content/database/spells.md` - User-facing documentation
   - Updated main `CLAUDE.md` with SpellCard info

## How to Use SpellCard

### Option 1: In a Custom React Page

```jsx
import SpellCard from '../components/SpellCard';

function MyPage() {
  return (
    <div>
      <h1>Fire Spells</h1>
      <SpellCard name="Fire Slash" />
      <SpellCard name="Fire Sword" />
    </div>
  );
}
```

### Option 2: With DataDrivenPage

```jsx
import DataDrivenPage from './wiki-framework/src/components/wiki/DataDrivenPage';
import SpellCard from './src/components/SpellCard';

<DataDrivenPage
  dataFile="skills.json"
  renderData={(spells) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {spells
        .filter(s => s.attribute === 'Fire')
        .map(spell => (
          <SpellCard key={spell.id} spell={spell} />
        ))}
    </div>
  )}
/>
```

### Option 3: Multiple SpellCards by ID

```jsx
import SpellCard from '../components/SpellCard';

function FireSpellsGuide() {
  const fireSpellIds = [1, 5, 13]; // Fire Slash, Fire Sword, Fire Storm

  return (
    <div className="space-y-6">
      {fireSpellIds.map(id => (
        <SpellCard key={id} id={id} />
      ))}
    </div>
  );
}
```

## Quick Test

To see SpellCard in action immediately:

1. Open your browser dev console
2. Navigate to any page
3. Run this in console (temporary test):
```javascript
import('../src/components/SpellCard.jsx').then(module => {
  const SpellCard = module.default;
  // Component loaded successfully
});
```

Or create a simple test markdown file:
```markdown
---
title: Spell Test
---

# Testing SpellCard

See the spell database documentation at `/database/spells` for usage examples.
```

## Adding SpellsPage to Router (Optional)

If you want the full spells gallery page accessible via URL:

1. Edit `wiki-framework/src/router.jsx`
2. Add lazy import:
   ```javascript
   const SpellsPage = lazy(() => import('../../src/pages/SpellsPage'));
   ```
3. Add route:
   ```javascript
   {
     path: 'spells',
     element: <SuspenseWrapper><SpellsPage /></SuspenseWrapper>,
   }
   ```
4. Access at `/#/spells`

**Note:** This requires framework modification, so I left it optional.

## Current Spell Data

Your `/data/skills.json` contains:
- Fire spells (IDs: 1, 5, 13, ...)
- Water spells (IDs: 2, 6, ...)
- Wind spells (IDs: 3, 7, ...)
- Earth spells (IDs: 4, ...)

All with complete stats:
- Name, attribute, grade
- MP cost, cooldown, range
- Base value, upgrade value, max level
- Descriptions

## Examples

### Show a specific spell in your guide
```jsx
<SpellCard name="Lightning Stroke" />
```

### Show top 5 spells
```jsx
const topSpells = [1, 7, 13, 20, 25];
return (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {topSpells.map(id => <SpellCard key={id} id={id} />)}
  </div>
);
```

### Filter by element in a data-driven page
```jsx
<DataDrivenPage
  dataFile="skills.json"
  renderData={(spells) => {
    const fireSpells = spells.filter(s => s.attribute === 'Fire');
    return fireSpells.map(s => <SpellCard key={s.id} spell={s} />);
  }}
/>
```

## Next Steps

1. ✅ Test SpellCard by creating a simple page that uses it
2. ✅ Add SpellCard to your skill guides
3. ✅ Consider adding SpellsPage route for full gallery
4. ✅ Update your skills section content to showcase spells

## Files Created

```
src/components/
├── SpellCard.jsx           ← Main component
└── README-SpellCard.md     ← Component documentation

src/pages/
└── SpellsPage.jsx          ← Example gallery (optional)

public/content/database/
└── spells.md               ← User documentation

CLAUDE.md                   ← Updated with SpellCard info
SPELLCARD-USAGE.md         ← This guide
```

## Need Help?

- Component docs: `src/components/README-SpellCard.md`
- Example implementation: `src/pages/SpellsPage.jsx`
- Data structure: `/data/skills.json`
- Main docs: `CLAUDE.md` (search for "SpellCard")

Enjoy your beautiful spell cards! 🎴✨
