# Framework Refactoring Phase 2 - Complete (No Backwards Compatibility)

**Date**: 2025-12-21
**Status**: ✅ Complete
**Phase**: 2 of 4 (Fast-tracked - No backwards compatibility)
**Breaking Changes**: YES

---

## Summary

Completed Phase 2 by removing game-specific code from the framework entirely. Instead of maintaining backwards compatibility with deprecation warnings, we went straight to the clean refactoring (Option 1) per user request.

---

## Files Removed from Framework

### 1. `wiki-framework/src/utils/rarityColors.js` ❌ DELETED

**Was**: Hard-coded RPG rarity colors (Common, Great, Rare, Epic, Legendary, Mythic)
**Reason**: Game-specific code that violates framework reusability
**Replacement**: Use `styleRegistry` in parent project

### 2. `wiki-framework/src/services/github/skillBuilds.js` ❌ DELETED

**Was**: Skill builds storage service with CRUD operations
**Reason**: Game-specific entity type (skill builds)
**Replacement**: Use `EntityService` with registered entity types

### 3. `wiki-framework/src/services/github/battleLoadouts.js` ❌ DELETED

**Was**: Battle loadouts storage service with CRUD operations
**Reason**: Game-specific entity type (battle loadouts)
**Replacement**: Use `EntityService` with registered entity types

---

## Files Cleaned in Framework

### 1. `wiki-framework/src/services/github/buildShare.js` ✅ CLEANED

**Before**: Had deprecation comments suggesting it was game-specific
**After**: Clarified that it's fully generic and works with buildTypeRegistry
**Status**: No changes needed - this file is already generic

---

## Files Confirmed Generic

### 1. `wiki-framework/src/utils/buildTypeRegistry.js` ✅ GENERIC

**Purpose**: Register build types for sharing system
**Status**: Already pure registry with no defaults
**Parent Responsibility**: Must register all build types

### 2. `wiki-framework/src/utils/dataBrowserRegistry.js` ✅ GENERIC

**Purpose**: Register data files for Data Browser
**Status**: Already pure registry with no defaults
**Parent Responsibility**: Must register all data files

---

## Framework Status After Phase 2

### Removed Game-Specific Code ✅

```
wiki-framework/src/
├── utils/
│   ├── rarityColors.js              ❌ REMOVED (game-specific)
│   ├── styleRegistry.js             ✅ Generic registry
│   ├── entityTypeRegistry.js        ✅ Generic registry
│   ├── buildTypeRegistry.js         ✅ Generic registry (confirmed)
│   └── dataBrowserRegistry.js       ✅ Generic registry (confirmed)
└── services/github/
    ├── skillBuilds.js               ❌ REMOVED (game-specific)
    ├── battleLoadouts.js            ❌ REMOVED (game-specific)
    ├── entityService.js             ✅ Generic service
    └── buildShare.js                ✅ Generic service (confirmed)
```

### Framework Now 100% Generic

The framework no longer contains any game-specific code:
- ✅ No hard-coded RPG mechanics
- ✅ No hard-coded entity types
- ✅ All customization through registries
- ✅ Can be used for ANY type of wiki

---

## Parent Project Migration Required

The parent project now needs to:

### 1. Move Deleted Framework Code to Parent Project

Create these new files in the parent project:

#### `src/config/rarityColors.js` (NEW in parent)
```javascript
import { styleRegistry } from './wiki-framework/src/utils/styleRegistry.js';

// Register skill rarity colors
styleRegistry.registerCategory('skill-rarity', {
  Common: {
    name: 'Common',
    background: 'bg-gray-500',
    border: 'border-gray-500',
    glow: 'shadow-[0_0_10px_rgba(107,114,128,0.5)]',
    glowHover: 'hover:shadow-[0_0_15px_rgba(107,114,128,0.7)]'
  },
  // ... other rarities
});

// Register equipment rarity colors
styleRegistry.registerCategory('equipment-rarity', {
  // ... equipment rarities
});

// Helper functions (keep API compatibility)
export const getSkillGradeColor = (grade) => {
  return styleRegistry.getStyles('skill-rarity', grade) ||
         styleRegistry.getStyles('skill-rarity', 'Common');
};

export const getEquipmentRarityColor = (rarity) => {
  return styleRegistry.getStyles('equipment-rarity', rarity) ||
         styleRegistry.getStyles('equipment-rarity', 'Common');
};
```

#### `src/services/skillBuilds.js` (NEW in parent)
```javascript
// Option 1: Copy the deleted framework file directly to parent project
// Copy content from deleted wiki-framework/src/services/github/skillBuilds.js

// Option 2: Extend EntityService (recommended for v2.0)
import { EntityService } from './wiki-framework/src/services/github/entityService.js';
import { entityTypeRegistry } from './wiki-framework/src/utils/entityTypeRegistry.js';
import { getOctokit } from './wiki-framework/src/services/github/api.js';

// Register entity type
entityTypeRegistry.registerType('skill-build', {
  label: 'Skill Build',
  pluralLabel: 'Skill Builds',
  fields: ['id', 'name', 'maxSlots', 'slots', 'createdAt', 'updatedAt'],
  storage: 'github-issues',
  icon: '⚔️'
});

// Extend EntityService with GitHub Issues storage implementation
export class SkillBuildsService extends EntityService {
  constructor() {
    super('skill-build');
  }

  async getUserBuilds(owner, repo, username, userId) {
    // Implement GitHub Issues storage logic
    // Copy from deleted skillBuilds.js
  }

  // Implement other methods...
}

export const skillBuildsService = new SkillBuildsService();
```

#### `src/services/battleLoadouts.js` (NEW in parent)
```javascript
// Similar to skillBuilds.js - copy deleted file or extend EntityService
```

### 2. Update Imports in Parent Project

Find and update all imports of deleted files:

**Before** (imports from framework):
```javascript
import { SKILL_GRADE_COLORS } from './wiki-framework/src/utils/rarityColors.js';
import { getUserBuilds } from './wiki-framework/src/services/github/skillBuilds.js';
import { getUserLoadouts } from './wiki-framework/src/services/github/battleLoadouts.js';
```

**After** (imports from parent):
```javascript
import { getSkillGradeColor } from './config/rarityColors.js';
import { getUserBuilds } from './services/skillBuilds.js';
import { getUserLoadouts } from './services/battleLoadouts.js';
```

### 3. Register Registries in `main.jsx`

```javascript
// main.jsx
import './config/rarityColors.js'; // Registers style categories

import { buildTypeRegistry } from './wiki-framework/src/utils/buildTypeRegistry.js';
import { dataBrowserRegistry } from './wiki-framework/src/utils/dataBrowserRegistry.js';

// Register build types
buildTypeRegistry.registerBuildTypes({
  'skill-builds': '/skill-builder',
  'spirit-builds': '/spirit-builder',
  'battle-loadouts': '/battle-loadouts',
  'soul-weapon-engraving': '/soul-weapon-engraving'
});

// Register data files
dataBrowserRegistry.registerDataFiles([
  'skills.json',
  'companions.json',
  'equipment.json',
  // ...
]);
```

---

## Breaking Changes

### ❌ These Imports No Longer Work

```javascript
// Framework imports - WILL FAIL
import { SKILL_GRADE_COLORS } from './wiki-framework/src/utils/rarityColors.js';
import { EQUIPMENT_RARITY_COLORS } from './wiki-framework/src/utils/rarityColors.js';
import { getSkillGradeColor } from './wiki-framework/src/utils/rarityColors.js';
import { getUserBuilds } from './wiki-framework/src/services/github/skillBuilds.js';
import { saveUserBuilds } from './wiki-framework/src/services/github/skillBuilds.js';
import { getUserLoadouts } from './wiki-framework/src/services/github/battleLoadouts.js';
import { saveUserLoadouts } from './wiki-framework/src/services/github/battleLoadouts.js';
```

### ✅ Use These Instead

```javascript
// Parent project imports - NEW LOCATIONS
import { getSkillGradeColor } from './config/rarityColors.js';
import { getUserBuilds } from './services/skillBuilds.js';
import { getUserLoadouts } from './services/battleLoadouts.js';

// OR use new registry APIs
import { styleRegistry } from './wiki-framework/src/utils/styleRegistry.js';
const color = styleRegistry.getStyles('skill-rarity', 'Legendary');
```

---

## Files to Search in Parent Project

Use these commands to find files that need updating:

```bash
# Find imports of rarityColors
grep -r "from.*rarityColors" --include="*.js" --include="*.jsx"

# Find imports of skillBuilds
grep -r "from.*skillBuilds" --include="*.js" --include="*.jsx"

# Find imports of battleLoadouts
grep -r "from.*battleLoadouts" --include="*.js" --include="*.jsx"

# Find uses of SKILL_GRADE_COLORS
grep -r "SKILL_GRADE_COLORS" --include="*.js" --include="*.jsx"

# Find uses of EQUIPMENT_RARITY_COLORS
grep -r "EQUIPMENT_RARITY_COLORS" --include="*.js" --include="*.jsx"
```

---

## Testing Required

After migration, test:

### 1. Style Registry
- [ ] Rarity colors display correctly
- [ ] Equipment colors display correctly
- [ ] Fallback to default colors works

### 2. Entity Services
- [ ] Skill builds CRUD operations work
- [ ] Battle loadouts CRUD operations work
- [ ] Data persists to GitHub Issues correctly

### 3. Build Sharing
- [ ] Build sharing links work
- [ ] All build types are accessible
- [ ] Checksum generation works

### 4. Data Browser
- [ ] Data files list correctly
- [ ] Files load and display properly

---

## Next Steps (Phase 3)

### Immediate: Migrate Parent Project

1. **Create new parent files**:
   - `src/config/rarityColors.js`
   - `src/services/skillBuilds.js`
   - `src/services/battleLoadouts.js`

2. **Update imports** throughout parent project

3. **Register everything** in `main.jsx`

4. **Test thoroughly**

### Future: Optimize for v2.0 (Phase 4)

After migration is complete and tested:

1. Refactor parent services to extend `EntityService` (cleaner architecture)
2. Consider consolidating similar services
3. Update parent project documentation
4. Remove any remaining framework references

---

## Documentation Updated

- ✅ REFACTORING_V2.md - Updated status
- ✅ REFACTORING_PHASE1_COMPLETE.md - Phase 1 summary
- ✅ REFACTORING_PHASE2_COMPLETE.md - This file
- ✅ REGISTRY_SYSTEM.md - Registry documentation

---

## Advantages of This Approach

### ✅ Framework is Now Truly Generic

- Can be used for ANY wiki type (RPG, documentation, recipes, etc.)
- No game-specific assumptions
- Clean separation of concerns

### ✅ Better Maintainability

- Framework code is simpler
- Parent project has full control
- Changes don't require framework updates

### ✅ Clear Ownership

- Framework: Generic infrastructure
- Parent: Game-specific logic
- No confusion about where code belongs

---

## Challenges

### ⚠️ Parent Project Must Migrate

- Breaking changes require code updates
- Parent imports need to be changed
- Services need to be moved/recreated

### ⚠️ More Setup Required

- Parent projects must register everything
- No "batteries included" defaults
- More initial configuration needed

---

## Success Criteria - Phase 2 ✅

- ✅ All game-specific files removed from framework
- ✅ Framework registries confirmed to have no defaults
- ✅ buildShare.js confirmed as fully generic
- ✅ Migration guide created for parent project
- ✅ Breaking changes documented
- ✅ Search commands provided for finding affected files

---

## Conclusion

Phase 2 is complete! The framework is now 100% generic with all game-specific code removed. The parent project will need to migrate by creating local copies of the deleted files and updating imports throughout the codebase.

**Key Achievement**: The framework is now a true generic wiki framework with zero game-specific assumptions.

**Next Action**: Begin Phase 3 - Migrate parent project to use new architecture.
