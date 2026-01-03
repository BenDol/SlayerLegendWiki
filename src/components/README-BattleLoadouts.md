# Battle Loadouts System

A comprehensive loadout management system matching the game's Battle Settings interface, allowing players to configure and save named battle configurations.

## Overview

The Battle Loadouts system provides a complete interface for managing battle configurations with:
- **Named Loadout Saves** - Custom names like "PvP Build", "Boss Fight", etc.
- **Skills Section** - 10 skill slots with Skill Builder integration
- **Save/Load System** - Store up to 10 loadouts per user (GitHub-backed)
- **Placeholder Sections** for future builders:
  - Accompanying Spirit
  - Skill Stone
  - Slayer Promotion Additional Ability
  - Familiar Skill

## Components

### 1. BattleLoadouts.jsx
Main component that manages the loadout system.

**Features:**
- Named loadout saves (similar to Skill Builder)
- Loadout name input field
- Skill build integration via modal
- Share/Export/Import/Clear functionality
- URL-based sharing with encoded data
- JSON import/export
- Saved Loadouts Panel with load/delete

**State:**
```javascript
{
  loadoutName: 'My Loadout',     // Current loadout name
  currentLoadout: {              // Currently editing loadout
    name: 'My Loadout',
    skillBuild: {...},           // Skill build object from Skill Builder
    spirit: null,                // Placeholder for future Spirit Builder
    skillStone: null,            // Placeholder for future Skill Stone Builder
    promotionAbility: null,      // Placeholder for future Promotion Builder
    familiar: null               // Placeholder for future Familiar Builder
  }
}
```

### 2. SkillBuilderModal.jsx
Modal wrapper for the Skill Builder that opens as a popup.

**Props:**
```javascript
{
  isOpen: boolean,        // Modal visibility
  onClose: function,      // Close callback
  initialBuild: object,   // Initial build data to edit
  onSave: function        // Callback when build is saved
}
```

**Features:**
- Full-screen modal overlay
- Renders existing Skill Builder component
- "Save" button in footer (modal mode)
- Close button (X) in top-right with title
- Passes build data back to parent on save

### 3. SavedLoadoutsPanel.jsx
Panel for managing saved battle loadouts (similar to SavedBuildsPanel).

**Props:**
```javascript
{
  currentLoadout: object,      // Current loadout being edited
  onLoadLoadout: function      // Callback when loading a saved loadout
}
```

**Features:**
- Display list of saved loadouts
- Save current loadout button
- Load saved loadouts (with confirmation)
- Delete loadouts
- Shows timestamp and limit (10 loadouts max)
- Sign-in prompt for unauthenticated users

### 4. SkillBuilder.jsx (Modified)
Enhanced to support both standalone page and modal modes.

**New Props:**
```javascript
{
  isModal: boolean,           // If true, renders in modal mode
  initialBuild: object,       // Initial build data (for modal)
  onSave: function,           // Save callback (for modal)
  allowSavingBuilds: boolean  // If true, shows build name and save UI
}
```

**Modal Mode Behavior:**
- Skips URL parameter loading
- Loads from `initialBuild` prop instead
- Hides Share/Export/Import/Clear buttons
- Hides build name field when `allowSavingBuilds={false}`
- Shows Saved Builds panel (load only) when `allowSavingBuilds={false}`
- Calls `onSave` callback when saved via footer button

### 5. battleLoadoutEncoder.js
Utility functions for encoding/decoding battle loadouts.

**Functions:**
```javascript
encodeLoadout(loadout)        // Encode single loadout to base64
decodeLoadout(encodedString)  // Decode loadout from base64
generateLoadoutURL(loadout)   // Generate shareable URL
```

**Data Format:**
```javascript
{
  name: 'My Loadout',
  skillBuild: {...},
  spirit: null,
  skillStone: null,
  promotionAbility: null,
  familiar: null,
  exportedAt: '2025-12-15T...'  // Only in JSON exports
}
```

## Usage

### Accessing the Page
Navigate to: `/#/battle-loadouts`

### Creating a Loadout

1. **Enter a loadout name** in the name field
2. **Configure Skills:**
   - Click "Create Build" to open Skill Builder modal
   - Build your skill configuration
   - Click "Save" to apply to loadout
   - Or click "Edit Build" to modify existing build
3. **Future Sections** (placeholders for now):
   - Spirit, Skill Stone, Promotion Ability, Familiar builders coming soon

### Saving Loadouts

**Save Loadout Button:**
- Saves current loadout to GitHub with custom name
- Requires user to be signed in
- Stores up to 10 loadouts per user
- Shows in Saved Loadouts Panel

### Sharing Loadouts

**Share Button:**
- Encodes current loadout into URL
- Copies shareable link to clipboard
- Includes loadout name and all configuration

**Export Button:**
- Downloads JSON file with current loadout
- Filename based on loadout name
- Includes timestamp
- Full data preservation

**Import Button:**
- Upload JSON file to restore loadout
- Validates format before loading
- Replaces current loadout

### Loading Saved Loadouts

**Saved Loadouts Panel:**
- Shows list of all saved loadouts
- Click any saved loadout to load it
- Confirmation dialog prevents accidental overwrites
- Delete button to remove saved loadouts

## Architecture

### Modal Pattern

The system uses a **decoupled modal pattern** where the Skill Builder can function both as:
1. **Standalone Page** (`/#/skill-builder`)
2. **Modal Popup** (within Battle Loadouts)

This pattern will be reused for all future builders:
- Spirit Builder
- Skill Stone Builder
- Promotion Ability Builder
- Familiar Builder

**Benefits:**
- No page navigation required
- Consistent UX across all builders
- Easy to integrate new builders
- Reusable components

### Data Flow

```
BattleLoadouts (Parent)
├── Manages loadout state
├── Opens SkillBuilderModal
└── Receives build via onSave callback

SkillBuilderModal (Wrapper)
├── Renders modal overlay
├── Passes props to SkillBuilder
└── Handles save and close

SkillBuilder (Core Logic)
├── isModal prop determines behavior
├── Renders in modal mode
└── Calls onSave with build data
```

### Serialization

Skills are stored using **ID-based serialization**:
- Full skill objects → Skill IDs only for storage
- Skill IDs → Full skill objects when loading
- Resilient to skill data changes
- Smaller encoded URLs

## File Structure

**Parent Project (game-specific):**
- `src/components/BattleLoadouts.jsx` - Main component
- `src/components/SkillBuilderModal.jsx` - Modal wrapper
- `src/components/SkillBuilder.jsx` - Enhanced for modal support
- `src/pages/BattleLoadoutsPage.jsx` - Page wrapper
- `main.jsx` - Route registration

**Framework (generic):**
- `wiki-framework/src/utils/battleLoadoutEncoder.js` - Encoding utilities

## Future Enhancements

When adding new builder systems:

1. **Create the builder component** (e.g., `SpiritBuilder.jsx`)
2. **Add modal support** similar to Skill Builder:
   - Accept `isModal`, `initialBuild`, `onSave` props
   - Render Save button in modal mode
3. **Create modal wrapper** (e.g., `SpiritBuilderModal.jsx`)
4. **Update BattleLoadouts.jsx**:
   - Replace placeholder section with actual component
   - Add modal state and handlers
   - Update serialization/deserialization logic
5. **Update battleLoadoutEncoder.js** if needed

### Planned Builders

- [ ] **Spirit Builder** - Configure accompanying spirits
- [ ] **Skill Stone Builder** - Manage skill stones
- [ ] **Promotion Ability Builder** - Select slayer promotion abilities
- [ ] **Familiar Builder** - Configure familiar skills

## Integration Notes

### Route Registration
```javascript
// main.jsx
registerCustomRoutes([
  {
    path: 'battle-loadouts',
    component: <BattleLoadoutsPage />,
    suspense: true
  }
]);
```

### Dependencies
- `wiki-framework/src/utils/battleLoadoutEncoder.js` - Encoding utilities
- `wiki-framework/src/components/wiki/BuildEncoder.jsx` - Build encoding (used internally by Skill Builder)
- `/data/skills.json` - Skills database

## Testing

**Test scenarios:**
1. Enter a custom loadout name
2. Create skill build in modal
3. Save and verify it appears in current loadout
4. Click "Save Loadout" in footer to save
5. Verify saved loadout appears in Saved Loadouts panel
6. Load a different saved loadout
7. Share loadout via URL
8. Export loadout to JSON
9. Import loadout from JSON
10. Clear skill build
11. Clear entire loadout

**Expected behavior:**
- Modal never navigates away from page
- "Save" button in modal footer applies build to current loadout
- Loadout name updates in real-time
- Sticky footer appears only when authenticated
- Saved loadouts panel refreshes after saving
- URL sharing preserves single loadout data
- JSON import/export works correctly
- Skill Builder works identically in both page and modal modes
- Loading a saved loadout shows confirmation dialog

## Known Limitations

- Placeholder sections are not yet functional
- No validation on loadout completeness
- Cannot rename individual loadouts (uses default names I-V)
- No "duplicate loadout" functionality yet

## Future Improvements

Potential additions:
- Loadout name editing
- Duplicate/copy loadout functionality
- Loadout comparison view
- Quick-switch hotkeys
- Loadout validation warnings
- Auto-save to localStorage
- Loadout templates/presets
- Community loadout sharing
