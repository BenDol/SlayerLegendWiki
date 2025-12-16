# Skill Build Simulator

A game-accurate skill build simulator for creating, sharing, and managing skill builds.

## Components

### 1. SkillSlot.jsx
Individual skill slot component that displays:
- Skill icon with rarity-based border colors and glow effects
- Enhancement level badge (clickable to adjust level)
- Skill name and element badge
- Empty state with add button
- Locked state for unavailable slots
- Remove functionality on click

**Props:**
```jsx
<SkillSlot
  skill={skillObject}           // Skill data or null if empty
  level={1}                      // Enhancement level (1-maxLevel)
  isLocked={false}               // Whether slot is locked
  slotNumber={1}                 // Slot index (1-10)
  onSelectSkill={() => {}}       // Callback when add button clicked
  onRemoveSkill={() => {}}       // Callback when skill removed
  onLevelChange={(level) => {}}  // Callback when level changed
/>
```

### 2. SkillSelector.jsx
Modal component for selecting skills from the database with:
- Search by skill name
- Filter by element (Fire/Water/Wind/Earth)
- Filter by rarity (Common/Great/Rare/Epic/Legendary)
- Grid display with skill icons and info
- Rarity-based visual effects

**Props:**
```jsx
<SkillSelector
  isOpen={true}                  // Modal visibility
  onClose={() => {}}             // Close callback
  onSelectSkill={(skill) => {}}  // Skill selection callback
  skills={skillsArray}           // Array of all skills
  currentBuild={buildObject}     // Current build state
/>
```

### 3. SkillBuildSimulator.jsx
Main simulator component featuring:
- Configurable skill slots (1-10)
- Build name editor
- Shareable URLs with encoded build data
- Export builds as JSON files
- Import builds from JSON files
- Build statistics (element distribution, equipped count)
- Clear build functionality

## Features

### Shareable Builds
Builds are encoded in the URL using base64 encoding:
```
/#/skill-builder?data=eyJuYW1lIjoiTXkgQnVpbGQi...
```

The encoded data includes:
- Build name
- Max slots configured
- All equipped skills with levels

### Import/Export
- **Export**: Downloads build as JSON file
- **Import**: Loads build from JSON file
- JSON includes metadata (exportedAt timestamp)

### Visual Design
Mimics the game's UI with:
- Game-accurate skill slot backgrounds (`/images/skills/skill_baseSlot_Wide.png`)
- Rarity-based glow effects
- Element-colored badges
- Gradient backgrounds matching game aesthetic
- Locked slot indicators

## UI Assets Used

From `public/images/skills/`:
- `skill_baseSlot_Wide.png` - Skill slot background
- `skill_plusIcon.png` - Add button icon
- `skill_LockedIcon.png` - Locked slot indicator
- `Icon_skillCard.png` - Skill card frame
- `skill_deam.png` - Fallback for missing icons

From `public/images/spells/`:
- Individual skill icons loaded from skills.json

## Data Source

Skills loaded from `/data/skills.json`:
```json
{
  "id": 1,
  "name": "Fire Slash",
  "attribute": "Fire",
  "grade": "Common",
  "maxLevel": 130,
  "icon": "/images/spells/01_BlazeSlash.png",
  ...
}
```

## Usage

### Accessing the Simulator
Navigate to: `/#/skill-builder`

### Creating a Build
1. Click "+" on empty slots to add skills
2. Click level badge to adjust skill levels
3. Click equipped skills to remove them
4. Adjust max slots (1-10) as needed

### Sharing a Build
1. Click "Share" button
2. URL with encoded build copied to clipboard
3. Share URL with others

### Saving/Loading Builds
- **Export**: Click "Export" to download JSON file
- **Import**: Click "Import" and select JSON file

## Integration

The simulator follows the framework's architecture pattern where game-specific routes are registered via the Route Registry (similar to Content Renderer Registry).

**Architecture:**
- **Framework** provides generic route registry system (`wiki-framework/src/utils/routeRegistry.js`)
- **Parent project** registers game-specific routes in `main.jsx`
- **Framework router** dynamically includes registered routes at runtime

**Registration in `main.jsx`:**
```javascript
import { registerCustomRoutes } from './wiki-framework/src/utils/routeRegistry.js';
import SkillBuildSimulatorPage from './src/pages/SkillBuildSimulatorPage.jsx';

registerCustomRoutes([
  {
    path: 'skill-builder',
    component: <SkillBuildSimulatorPage />,
    suspense: true
  }
]);
```

**Key Points:**
- Framework NEVER imports from parent project ✅
- Parent project registers custom routes before React renders
- Route registry allows multiple custom routes to be added
- Suspense wrapper is optional per route

## Future Enhancements

Potential additions:
- Save builds to user account (requires auth)
- Build library/gallery
- Skill recommendations based on synergies
- Build comparisons
- Damage calculations
- Community builds (most popular/rated)
- Build tags/categories
- Screenshot export
- Skill unlock progression (locked skills based on level requirements)

## Development Notes

**File Locations:**
- **Parent Project (game-specific):**
  - `src/components/SkillSlot.jsx` - Skill slot component
  - `src/components/SkillSelector.jsx` - Skill selector modal
  - `src/components/SkillBuildSimulator.jsx` - Main simulator
  - `src/pages/SkillBuildSimulatorPage.jsx` - Page wrapper
  - `main.jsx` - Route registration

- **Framework (generic):**
  - `wiki-framework/src/utils/routeRegistry.js` - Route registry system
  - `wiki-framework/src/router.jsx` - Router that uses registry
  - `wiki-framework/src/utils/rarityColors.js` - Rarity color utilities
  - `wiki-framework/src/components/wiki/BuildEncoder.jsx` - URL encoding

**Dependencies:**
- `wiki-framework/src/utils/rarityColors.js` - Rarity color utilities
- `wiki-framework/src/components/wiki/BuildEncoder.jsx` - URL encoding utilities
- `/data/skills.json` - Skills database

**Architecture Pattern:**
This follows the same pattern as Content Renderer Registry:
1. Framework provides generic registry system
2. Parent project registers game-specific implementations
3. Framework uses registered implementations at runtime
4. **Zero coupling**: Framework never imports from parent project

**Styling:**
- Uses Tailwind CSS
- Game-accurate gradient backgrounds
- Rarity-based visual effects from rarityColors utility
