# SkillCard Component

A beautiful, game-specific card component for displaying Slayer Legend skill information.

## Features

- ✨ Automatically loads skill data from `/data/skills.json`
- 🎨 Color-coded by element (Fire, Water, Wind, Earth)
- 📊 Displays all skill statistics (MP Cost, Cooldown, Range, etc.)
- 🌓 Full dark mode support
- 📱 Responsive design
- ⚡ Loading and error states

## Location

**File:** `src/components/SkillCard.jsx`

This is a **game-specific component** and lives in the parent project, not the framework.

## Usage

### Method 1: By Skill Name

```jsx
import SkillCard from '../components/SkillCard';

<SkillCard name="Fire Slash" />
```

### Method 2: By Skill ID

```jsx
import SkillCard from '../components/SkillCard';

<SkillCard id={1} />
```

### Method 3: With Direct Data Object

```jsx
import SkillCard from '../components/SkillCard';

const skillData = {
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

<SkillCard skill={skillData} />
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | No* | Skill name to look up in skills.json |
| `id` | number | No* | Skill ID to look up in skills.json |
| `skill` | object | No* | Direct skill data object |

\* At least one prop must be provided

## Data Structure

The component expects skill data with the following structure:

```javascript
{
  id: number,              // Unique skill ID
  name: string,            // Skill name
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

## Example: Custom Skills Page

See `src/pages/SkillsPage.jsx` for a complete example of a filterable skill gallery using SkillCard.

## Example: In a Data-Driven Page

```jsx
import DataDrivenPage from './wiki-framework/src/components/wiki/DataDrivenPage';
import SkillCard from './src/components/SkillCard';

<DataDrivenPage
  dataFile="skills.json"
  renderData={(skills) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {skills.map(skill => (
        <SkillCard key={skill.id} skill={skill} />
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
- Skill not found by name or ID
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
- Memoizes skill lookups
- Minimal re-renders

## Future Enhancements

Potential improvements:
- [ ] Skill comparison tool
- [ ] Level slider to see stats at different levels
- [ ] Skill combo suggestions
- [ ] Build integration (click to add to build)
- [ ] Favorite/bookmark skills
- [ ] Share individual skill cards

## Related Components

- `DamageCalculator.jsx` - Calculate skill damage output
- `TierList.jsx` - Rank skills by effectiveness
- `DataDrivenPage.jsx` - Load skill data from JSON

## Notes

- Data source: `/public/data/skills.json`
- This component is specific to Slayer Legend
- Keep in parent project, not in framework
- Framework remains generic and reusable
