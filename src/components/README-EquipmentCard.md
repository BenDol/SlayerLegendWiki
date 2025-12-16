# EquipmentCard Component

A reusable card component for displaying detailed equipment (weapon) information in the Slayer Legend wiki. Supports loading data by name, ID, or direct data object.

## Features

- **Multiple Loading Methods:** Load by name, ID, or provide data directly
- **Markdown Integration:** Use simple HTML comments in markdown files
- **Automatic Image Loading:** Fetches equipment images from the image database
- **Rarity System:** Visual indicators based on equipment cost (Common → Legendary)
- **Comprehensive Stats:** Attack, Cost, Disassembly value, Stage requirement
- **Calculated Metrics:** Efficiency (ATK/100k gold) and return rate percentage
- **Responsive Design:** Looks great on all screen sizes
- **Dark Mode Support:** Fully styled for both light and dark themes
- **Error Handling:** Graceful fallback with friendly error messages
- **Loading States:** Smooth skeleton loader while fetching data

## Data Source

Equipment data is loaded from `/public/data/equipment.json`:

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

Equipment images are automatically resolved from `/public/data/image-index.json` by matching equipment names with images in the `equipment/weapons` category.

## Usage

### 1. In JSX/React Components

```jsx
import EquipmentCard from '../components/EquipmentCard';

// By Name
<EquipmentCard name="Innocence" />

// By ID
<EquipmentCard id={1} />

// With Direct Data
<EquipmentCard equipment={{
  id: 1,
  name: "Innocence",
  requirements: 2000,
  attack: 6300,
  disassemblyReward: 1000,
  stageRequirement: "Black Forest"
}} />
```

### 2. In Markdown Files

Use HTML comments with the `equipment:` prefix:

```markdown
## Best Early Game Weapon

Check out the first weapon you can buy:

<!-- equipment:Innocence -->

Or by ID:

<!-- equipment:1 -->
```

**Syntax:**
- `<!-- equipment:NAME -->` - Load equipment by name (e.g., "Innocence")
- `<!-- equipment:ID -->` - Load equipment by ID (e.g., 1)

**Note:** The markdown syntax is case-insensitive for names and automatically trims whitespace.

### 3. With DataDrivenPage

```jsx
import DataDrivenPage from './wiki-framework/src/components/wiki/DataDrivenPage';
import EquipmentCard from '../components/EquipmentCard';

<DataDrivenPage
  dataFile="equipment.json"
  renderData={(equipmentList) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {equipmentList
        .filter(eq => eq.id <= 10) // First 10 weapons
        .map(equipment => (
          <EquipmentCard key={equipment.id} equipment={equipment} />
        ))}
    </div>
  )}
/>
```

### 4. Gallery View Example

```jsx
import { useState, useEffect } from 'react';
import EquipmentCard from '../components/EquipmentCard';

const EquipmentGallery = () => {
  const [equipment, setEquipment] = useState([]);

  useEffect(() => {
    fetch('/data/equipment.json')
      .then(res => res.json())
      .then(data => setEquipment(data));
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
      {equipment.map(eq => (
        <EquipmentCard key={eq.id} equipment={eq} />
      ))}
    </div>
  );
};
```

## Component Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Conditional* | Equipment name (e.g., "Innocence") |
| `id` | number | Conditional* | Equipment ID (e.g., 1) |
| `equipment` | object | Conditional* | Full equipment data object |

*At least one of `name`, `id`, or `equipment` must be provided.

### Equipment Data Object Structure

```typescript
{
  id: number;              // Unique identifier
  name: string;            // Display name
  requirements: number;    // Gold cost to purchase
  attack: number;          // Attack power
  disassemblyReward: number; // Gold received when disassembled
  stageRequirement: string | null; // Stage where equipment is available
}
```

## Rarity Tiers

Equipment rarity is automatically determined by cost:

| Tier | Cost Range | Color Gradient | Badge Color |
|------|------------|----------------|-------------|
| **Common** | < 100k | Gray | Gray |
| **Great** | 100k - 10M | Green | Green |
| **Rare** | 10M - 1B | Blue | Blue |
| **Epic** | 1B - 100B | Purple | Purple |
| **Legendary** | 100B+ | Orange/Yellow | Orange |

## Displayed Statistics

### Main Stats (Large Display)
- **⚔️ Attack:** Equipment's attack power
- **💰 Cost:** Gold required to purchase

### Secondary Stats
- **♻️ Disassembly:** Gold received when disassembling
- **📍 Stage:** Stage requirement (or "Any" if none)

### Calculated Metrics
- **Efficiency:** Attack per 100k gold spent
- **Return Rate:** Percentage of gold recovered from disassembly

### Additional Info
- **Progression Milestone:** Shows weapon position (X of 57) in progression tree

## Visual Components

### Header Section
- Gradient background based on rarity tier
- Equipment image (if available) displayed prominently
- Equipment name in large, bold text
- Rarity badge and weapon number

### Stats Grid
- 2-column layout for main stats
- 2-column layout for secondary stats
- Color-coded icons for easy identification

### Info Panel
- Efficiency and return rate calculations
- Progression milestone indicator
- Professional dark theme styling

## Image Resolution

The component automatically attempts to load equipment images:

1. Fetches `/data/image-index.json`
2. Searches for images in `equipment/weapons` category
3. Fuzzy matches equipment name against image filenames/keywords
4. Displays image if found, gracefully hides if not

**Supported Image Formats:**
- PNG, JPG, JPEG, WEBP

**Image Fallback:**
- If no image is found, component displays without image
- No broken image icons or error messages shown

## Styling

The component uses:
- **Tailwind CSS** for utility classes
- **Dark mode support** via `dark:` variants
- **Gradient backgrounds** for rarity tiers
- **Responsive grid layout** for stat display
- **Hover effects** on card (`hover:shadow-2xl`)
- **Drop shadows** for depth and polish
- **Rounded corners** and smooth transitions

## Error Handling

### Equipment Not Found
```jsx
// Shows error card with friendly message
<div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
  <h3>Equipment Not Found</h3>
  <p>Error: Equipment not found: InvalidName</p>
</div>
```

### Loading State
```jsx
// Shows animated skeleton loader
<div className="bg-gray-800 rounded-lg p-6 animate-pulse">
  // Skeleton elements...
</div>
```

### Image Load Failure
- Image element automatically hidden via `onError` handler
- No broken image icon displayed
- Component continues to render normally

## Example Markdown Page

Create a page at `public/content/equipment/weapons.md`:

```markdown
---
title: Weapon Progression
description: Complete guide to all weapons in Slayer Legend
tags: [equipment, weapons, progression]
category: Equipment
date: 2025-12-13
---

# Weapon Progression

## Early Game (Levels 1-30)

The first weapon you should aim for:

<!-- equipment:Innocence -->

## Mid Game (Levels 31-60)

A significant power spike:

<!-- equipment:Effort -->

## Late Game (Levels 61-90)

For serious adventurers:

<!-- equipment:Pride -->

## End Game (Levels 91+)

The ultimate weapon:

<!-- equipment:Willingness -->
```

## Performance Optimization

The component includes several optimizations:

1. **Conditional Loading:** Only fetches data if not provided directly
2. **Image Lazy Loading:** Uses browser native `loading="lazy"`
3. **Single Data Fetch:** Equipment list fetched once per component instance
4. **Error Boundaries:** Prevents component crashes from breaking the page
5. **Memoization Ready:** Props designed for easy React.memo wrapping if needed

## Accessibility

- **Alt text** on images includes equipment name
- **Semantic HTML** structure (article, figure, etc.)
- **Color contrast** meets WCAG AA standards
- **Focus states** on interactive elements
- **Screen reader friendly** stat labels

## Browser Support

Compatible with all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Equipment Not Displaying

1. **Check equipment.json:** Verify the equipment exists in `/public/data/equipment.json`
2. **Check ID/Name:** Ensure ID is a number or name matches exactly (case-insensitive)
3. **Check Console:** Look for error messages in browser developer tools
4. **Check Syntax:** Markdown syntax should be `<!-- equipment:X -->` with no extra spaces

### Image Not Loading

1. **Check Image Index:** Verify equipment image exists in image database
2. **Check Category:** Image should be in `equipment/weapons` category
3. **Check File Path:** Ensure image path starts with `/images/`
4. **Check File Name:** Image filename should loosely match equipment name

### Styling Issues

1. **Tailwind CSS:** Ensure Tailwind is properly configured
2. **Dark Mode:** Check dark mode toggle if colors look wrong
3. **Browser Cache:** Hard refresh (Ctrl+Shift+R) to clear cached styles
4. **Responsive Design:** Test on different screen sizes

## Related Components

- **SkillCard** - Similar component for displaying skill information
- **DataDrivenPage** - For loading and displaying equipment lists
- **SortableTable** - For equipment comparison tables
- **TierList** - For ranking equipment by effectiveness

## Future Enhancements

Potential improvements for future versions:

- [ ] Equipment comparison mode (side-by-side)
- [ ] Filtering by rarity tier
- [ ] Sorting by different stats
- [ ] Equipment set bonuses display
- [ ] Upgrade/enhancement calculator integration
- [ ] Drop location maps
- [ ] User favorites/bookmarking
- [ ] Export to build calculator

## Contributing

When adding new equipment:

1. Add data to `/public/data/equipment.json`
2. Add equipment image to `/public/images/equipment/weapons/`
3. Rebuild image index: `npm run build:search`
4. Test with `<EquipmentCard name="NewWeapon" />`

## Version History

- **v1.0.0** (2025-12-13) - Initial release
  - Load by name, ID, or data object
  - Automatic image resolution
  - Rarity-based styling
  - Comprehensive stat display
  - Markdown integration support

## License

Part of the Slayer Legend Wiki project. See main project LICENSE for details.
