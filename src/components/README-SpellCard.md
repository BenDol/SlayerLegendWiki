# SpellCard Component

A beautiful, game-specific card component for displaying Slayer Legend spell/skill information.

## Features

- ✨ Automatically loads spell data from `/data/skills.json`
- 🎨 Color-coded by element (Fire, Water, Wind, Earth)
- 📊 Displays all spell statistics (MP Cost, Cooldown, Range, etc.)
- 🌓 Full dark mode support
- 📱 Responsive design
- ⚡ Loading and error states

## Location

**File:** `src/components/SpellCard.jsx`

This is a **game-specific component** and lives in the parent project, not the framework.

## Usage

### Method 1: By Spell Name

```jsx
import SpellCard from '../components/SpellCard';

<SpellCard name="Fire Slash" />
```

### Method 2: By Spell ID

```jsx
import SpellCard from '../components/SpellCard';

<SpellCard id={1} />
```

### Method 3: With Direct Data Object

```jsx
import SpellCard from '../components/SpellCard';

const spellData = {
  id: 1,
  name: "Fire Slash",
  attribute: "Fire",
  enterLevel: 3,
  basicDescription: "Wrap fire around the sword and set enemies on fire",
  specificDescription: "Attack all enemies within range 3 once with X% of their ATK",
  grade: "Common",
  maxLevel: 130,
  mpCost: 25,
  baseValue: 400,
  upgradeValue: 40,
  cooldown: 12,
  range: 3
};

<SpellCard spell={spellData} />
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | No* | Spell name to look up in skills.json |
| `id` | number | No* | Spell ID to look up in skills.json |
| `spell` | object | No* | Direct spell data object |

\* At least one prop must be provided

## Data Structure

The component expects spell data with the following structure:

```javascript
{
  id: number,              // Unique spell ID
  name: string,            // Spell name
  attribute: string,       // Element: "Fire", "Water", "Wind", "Earth"
  enterLevel: number,      // Level required to unlock
  basicDescription: string,    // Short description
  specificDescription: string, // Detailed effect description
  grade: string,           // Rarity: "Common", "Great", "Rare", "Epic", "Legendary"
  maxLevel: number,        // Maximum upgrade level
  mpCost: number,          // Mana cost to cast
  baseValue: number,       // Base power percentage
  upgradeValue: number,    // Power increase per level
  cooldown: number,        // Cooldown in seconds
  range: number            // Attack range (0 = self)
}
```

## Styling

### Attribute Colors

- **Fire**: Red to Orange gradient
- **Water**: Blue to Cyan gradient
- **Wind**: Green to Emerald gradient
- **Earth**: Yellow to Amber gradient

### Grade Colors

- **Common**: Gray
- **Great**: Blue
- **Rare**: Purple
- **Epic**: Yellow
- **Legendary**: Orange

## Example: Custom Spells Page

See `src/pages/SpellsPage.jsx` for a complete example of a filterable spell gallery using SpellCard.

## Example: In a Data-Driven Page

```jsx
import DataDrivenPage from './wiki-framework/src/components/wiki/DataDrivenPage';
import SpellCard from './src/components/SpellCard';

<DataDrivenPage
  dataFile="skills.json"
  renderData={(spells) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {spells.map(spell => (
        <SpellCard key={spell.id} spell={spell} />
      ))}
    </div>
  )}
/>
```

## States

### Loading State
Shows an animated skeleton loader while fetching data.

### Error State
Displays a friendly error message if:
- Data file fails to load
- Spell not found by name or ID
- Invalid data structure

## Calculated Stats

The component automatically calculates:
- **Max Level Power**: `baseValue + (upgradeValue × (maxLevel - 1))`

## Accessibility

- Semantic HTML structure
- High contrast colors
- Keyboard navigation support
- Screen reader friendly

## Performance

- Lazy loads data only when needed
- Memoizes spell lookups
- Minimal re-renders

## Future Enhancements

Potential improvements:
- [ ] Spell comparison tool
- [ ] Level slider to see stats at different levels
- [ ] Spell combo suggestions
- [ ] Build integration (click to add to build)
- [ ] Favorite/bookmark spells
- [ ] Share individual spell cards

## Related Components

- `DamageCalculator.jsx` - Calculate spell damage output
- `TierList.jsx` - Rank spells by effectiveness
- `DataDrivenPage.jsx` - Load spell data from JSON

## Notes

- Data source: `/public/data/skills.json`
- This component is specific to Slayer Legend
- Keep in parent project, not in framework
- Framework remains generic and reusable
