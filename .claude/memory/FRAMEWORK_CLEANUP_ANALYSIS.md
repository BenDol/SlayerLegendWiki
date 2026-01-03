# Framework Code Cleanup Analysis

**Date**: 2025-12-21
**Status**: 🔍 Analysis Complete - Refactoring Required

---

## Summary

Found game-specific code in the framework that should be abstracted into registries or moved to the parent project. The framework should provide GENERIC abstractions, while the parent project REGISTERS game-specific implementations.

---

## Files Found with Game-Specific References

### Critical Issues (Hard-coded game logic)

1. **src/utils/rarityColors.js**
   - Defines: Common, Great, Rare, Epic, Legendary, Mythic
   - Purpose: Skill/equipment rarity color schemes
   - **Issue**: RPG-specific rarity system hard-coded
   - **Solution**: Create abstract rarity registry

2. **src/services/github/skillBuilds.js**
   - Purpose: Skill build management service
   - **Issue**: Game-specific "skill" concept
   - **Solution**: Generic "build" service with type registry

3. **src/services/github/battleLoadouts.js**
   - Purpose: Battle loadout management
   - **Issue**: Game-specific "battle loadout" concept
   - **Solution**: Generic composition/loadout service

4. **src/services/github/buildShare.js**
   - Purpose: Build sharing functionality
   - **Issue**: References specific build types
   - **Solution**: Generic share service with build type registry

5. **src/utils/buildTypeRegistry.js**
   - Registers: skill-builds, spirit-builds, battle-loadouts, etc.
   - **Issue**: Hard-coded game build types
   - **Solution**: Already a registry! Parent should configure it

6. **src/utils/dataBrowserRegistry.js**
   - Purpose: Data browser configuration
   - **Issue**: May have game-specific data types
   - **Solution**: Already a registry! Parent should configure it

7. **src/components/wiki/BuildEncoder.jsx**
   - Purpose: Encode/decode builds for sharing
   - **Issue**: May reference specific build structures
   - **Solution**: Generic encoder with type-specific codecs

8. **src/pages/BuildViewerPage.jsx**
   - Purpose: View shared builds
   - **Issue**: May have game-specific rendering
   - **Solution**: Use content renderer registry

9. **src/api/imageDatabase.js**
   - Purpose: Equipment/sprite image management
   - **Issue**: References equipment, sprites, weapons
   - **Solution**: Generic asset database

### Minor Issues (Examples in docs)

10. **README.md** - Line 461
    - Reference: `C:\Projects\slayerlegend\wiki\logs\debug.log`
    - **Issue**: Absolute path in documentation
    - **Solution**: Use relative path or example path

11. **CONFIG.md** - Lines 55, 59
    - Reference: `BenDol/SlayerLegendWiki`, "Slayer Legend Wiki"
    - **Issue**: Used as examples in documentation
    - **Solution**: Keep as examples, but mark clearly

### Not Issues (Generated/Config files)

12. **coverage/coverage-final.json** - Auto-generated
13. **.claude/settings.local.json** - Local settings
14. **wiki-config.json** - Already fixed (test config)

---

## Architecture Analysis

### Current State

```
wiki-framework/
├── src/
│   ├── utils/
│   │   ├── rarityColors.js          ❌ Game-specific
│   │   ├── buildTypeRegistry.js     ⚠️  Registry exists but has defaults
│   │   └── dataBrowserRegistry.js   ⚠️  Registry exists but has defaults
│   ├── services/github/
│   │   ├── skillBuilds.js           ❌ Game-specific
│   │   ├── battleLoadouts.js        ❌ Game-specific
│   │   └── buildShare.js            ❌ References game types
│   ├── components/
│   │   └── wiki/BuildEncoder.jsx    ⚠️  May be game-specific
│   ├── pages/
│   │   └── BuildViewerPage.jsx      ⚠️  May be game-specific
│   └── api/
│       └── imageDatabase.js         ❌ Game-specific (equipment/weapons)
```

### Target State

```
wiki-framework/
├── src/
│   ├── utils/
│   │   ├── styleRegistry.js         ✅ Generic style/color registry
│   │   ├── entityTypeRegistry.js    ✅ Generic entity type registry
│   │   └── dataBrowserRegistry.js   ✅ Already a registry
│   ├── services/github/
│   │   ├── entityService.js         ✅ Generic entity CRUD
│   │   ├── compositionService.js    ✅ Generic composition service
│   │   └── shareService.js          ✅ Generic sharing
│   ├── components/
│   │   └── wiki/EntityEncoder.jsx   ✅ Generic encoder
│   └── api/
│       └── assetDatabase.js         ✅ Generic asset management

parent-project/
├── src/
│   ├── config/
│   │   ├── rarityConfig.js          ✅ Register rarity colors
│   │   ├── buildTypes.js            ✅ Register build types
│   │   └── dataBrowser.js           ✅ Register data types
│   └── services/
│       ├── skillBuildService.js     ✅ Use generic entity service
│       └── loadoutService.js        ✅ Use generic composition service
```

---

## Registry Pattern Analysis

### Registries Already in Framework

1. **contentRendererRegistry** - ✅ Works correctly
   - Framework provides registry
   - Parent registers game-specific renderers

2. **routeRegistry** - ✅ Works correctly
   - Framework provides registry
   - Parent registers custom routes

3. **buildTypeRegistry** - ⚠️ Has hard-coded defaults
   - Framework should provide EMPTY registry
   - Parent should register all types

4. **dataBrowserRegistry** - ⚠️ Has hard-coded defaults
   - Framework should provide EMPTY registry
   - Parent should register all data types

### Missing Registries

5. **styleRegistry** / **colorRegistry** - ❌ Doesn't exist
   - Needed for rarityColors abstraction
   - Framework: Generic color/style system
   - Parent: Register game-specific colors

6. **entityTypeRegistry** - ❌ Doesn't exist
   - Needed for skillBuilds/battleLoadouts abstraction
   - Framework: Generic entity CRUD
   - Parent: Register entity types (skill, loadout, etc.)

---

## Refactoring Strategy

### Phase 1: Create Missing Registries (Framework)

1. **Create styleRegistry.js**
   ```javascript
   // Framework provides
   export const styleRegistry = {
     categories: {},
     registerCategory(name, styles) { /* ... */ },
     getStyles(category, key) { /* ... */ }
   };
   ```

2. **Create entityTypeRegistry.js**
   ```javascript
   // Framework provides
   export const entityTypeRegistry = {
     types: {},
     registerType(name, config) { /* ... */ },
     getType(name) { /* ... */ }
   };
   ```

### Phase 2: Abstract Framework Services

1. **rarityColors.js** → **styleRegistry.js**
   - Remove hard-coded rarities
   - Provide generic style registration

2. **skillBuilds.js** → **entityService.js**
   - Make generic CRUD for any entity type
   - Accept entity type from registry

3. **battleLoadouts.js** → **compositionService.js**
   - Make generic composition of entities
   - Accept composition rules from registry

4. **buildShare.js** → **shareService.js**
   - Make generic sharing for any entity
   - Use entity type registry for validation

### Phase 3: Move to Parent Project

1. **Create src/config/rarityConfig.js** (parent)
   ```javascript
   import { styleRegistry } from 'github-wiki-framework';

   styleRegistry.registerCategory('skill-rarity', {
     Common: { background: 'bg-gray-500', /* ... */ },
     Legendary: { background: 'bg-red-500', /* ... */ }
   });
   ```

2. **Create src/config/buildTypes.js** (parent)
   ```javascript
   import { entityTypeRegistry } from 'github-wiki-framework';

   entityTypeRegistry.registerType('skill-build', {
     name: 'Skill Build',
     fields: [...],
     validation: {...}
   });
   ```

### Phase 4: Clean Framework Config

1. **buildTypeRegistry.js** - Remove defaults
2. **dataBrowserRegistry.js** - Remove defaults
3. **Add migration guide** - Document breaking changes

---

## Breaking Changes

This refactoring introduces breaking changes:

### ❌ No Longer Works (Without Parent Config)

```javascript
// OLD: Framework had defaults
import { SKILL_GRADE_COLORS } from 'framework/utils/rarityColors';
// NEW: Must be registered by parent
import { styleRegistry } from 'framework';
const colors = styleRegistry.getStyles('rarity', 'Legendary');
```

### ✅ Migration Path

Parent projects must:
1. Register all entity types
2. Register all style categories
3. Configure data browser types
4. Configure build types

---

## Impact Assessment

### Files to Modify in Framework

- ❌ **DELETE**: src/utils/rarityColors.js
- ✅ **CREATE**: src/utils/styleRegistry.js
- ✅ **CREATE**: src/utils/entityTypeRegistry.js
- ⚠️ **REFACTOR**: src/services/github/skillBuilds.js → entityService.js
- ⚠️ **REFACTOR**: src/services/github/battleLoadouts.js → compositionService.js
- ⚠️ **REFACTOR**: src/services/github/buildShare.js → shareService.js
- ⚠️ **CLEAN**: src/utils/buildTypeRegistry.js (remove defaults)
- ⚠️ **CLEAN**: src/utils/dataBrowserRegistry.js (remove defaults)

### Files to Create in Parent

- ✅ **CREATE**: src/config/rarityConfig.js
- ✅ **CREATE**: src/config/buildTypes.js
- ✅ **CREATE**: src/config/entityTypes.js
- ✅ **CREATE**: src/services/skillBuildService.js (wrapper)
- ✅ **CREATE**: src/services/loadoutService.js (wrapper)

### Estimated Effort

- **Framework Refactoring**: 4-6 hours
- **Parent Project Migration**: 2-3 hours
- **Testing & Validation**: 2 hours
- **Documentation**: 1 hour
- **Total**: 9-12 hours

---

## Recommendation

### Option 1: Full Refactoring (Recommended for v2.0)

**Pros**:
- ✅ Framework truly generic
- ✅ Reusable for any wiki type
- ✅ Clean separation of concerns
- ✅ Better maintainability

**Cons**:
- ❌ Breaking changes
- ❌ Requires parent project updates
- ❌ 9-12 hours of work
- ❌ Extensive testing needed

### Option 2: Minimal Cleanup (Quick Fix)

**Pros**:
- ✅ Fast (1-2 hours)
- ✅ No breaking changes
- ✅ Immediate improvement

**Cons**:
- ⚠️ Framework still has game-specific code
- ⚠️ Not fully generic
- ⚠️ Technical debt remains

**What to do**:
1. Add `.gitignore` for coverage/
2. Fix absolute path in README.md
3. Add comments marking game-specific code
4. Document refactoring plan for v2.0

### Option 3: Gradual Migration (Balanced)

**Pros**:
- ✅ No breaking changes
- ✅ Can be done incrementally
- ✅ Maintains backwards compatibility

**Cons**:
- ⚠️ Takes longer overall
- ⚠️ Dual systems during transition

**What to do**:
1. Create NEW generic services alongside existing
2. Deprecate old services
3. Migrate parent project gradually
4. Remove deprecated code in v2.0

---

## Decision Required

**Question**: Which approach should we take?

1. **Full Refactoring** - Break compatibility, go fully generic (9-12 hours)
2. **Minimal Cleanup** - Quick fixes only, document tech debt (1-2 hours)
3. **Gradual Migration** - New APIs alongside old, deprecate gradually (4-6 hours)

**My Recommendation**: **Option 2 (Minimal Cleanup)** for now, plan **Option 1** for framework v2.0.

**Reasoning**:
- Current focus is testing & CI (✅ Done)
- Full refactoring is substantial work
- Parent project is working fine
- Can plan proper v2.0 with breaking changes

---

## Immediate Actions (Minimal Cleanup)

If proceeding with Option 2:

1. ✅ Add coverage/ to .gitignore
2. ✅ Fix absolute path in README.md (line 461)
3. ✅ Add comments to game-specific files:
   ```javascript
   /**
    * @deprecated This is game-specific code that will be abstracted in v2.0
    * @see https://github.com/YOUR_REPO/issues/XXX
    */
   ```
4. ✅ Create REFACTORING_PLAN.md for v2.0
5. ✅ Update framework README with limitations section

Would you like me to proceed with the minimal cleanup (Option 2), or should I do the full refactoring (Option 1)?
