# SpellCard Image Integration - Complete

## Summary

Successfully integrated image database support into SpellCard components. Now spells display beautiful icons from the image database with smart fallbacks to element type icons.

## What Was Created

### 1. Image Service (`src/services/imageService.js`)
**Purpose**: Lookup and manage spell images from the image database

**Features**:
- Searches `image-search-index.json` for spell-specific images
- Smart fallback to element type icons (Fire, Water, Wind, Earth)
- Caches image database for performance
- Preloading support for element icons

**Key Functions**:
```javascript
// Get spell image with fallback to element icon
await getSpellImage('Fire Slash', 'Fire')

// Get generic skill icon fallback
getGenericSkillIcon()

// Get all element icons for preloading
getAllElementIcons()
```

**Element Icon Mapping**:
- Fire → `/images/icons/typeicon_fire_1.png`
- Water → `/images/icons/typeicon_water_1.png`
- Wind → `/images/icons/typeicon_wind_1.png`
- Earth → `/images/icons/typeicon_earth s_1.png`
- Fallback → `/images/skills/Icon_skillCard.png`

### 2. Updated SpellCard Component
**Changes**:
- Added image loading from image database
- Displays 80x80 (mobile) / 96x96 (desktop) icon in header
- Styled with gradient background, padding, and border
- Error handling with fallback to generic skill icon
- Automatic image loading when spell data loads

**Visual Improvements**:
```
┌─────────────────────────────────────────┐
│ [ICON] Fire Slash             [Common] │
│        Wrap fire around...    [Fire]   │
├─────────────────────────────────────────┤
│ Effect: Attack all enemies...           │
│ Stats: MP Cost, Cooldown, Range...      │
└─────────────────────────────────────────┘
```

### 3. Updated SpellPicker Modal
**Changes**:
- Loads images for all spells when modal opens
- Displays 48x48 icons next to spell names in list
- Images help users identify spells visually
- Graceful handling if images aren't loaded yet

**Enhanced UX**:
- Visual scanning - quickly find spells by icon
- Confirmation - see what spell looks like before inserting
- Professional - polished appearance

## File Changes

### New Files
```
src/services/imageService.js                   # Image lookup service
SPELLCARD-IMAGE-INTEGRATION.md                 # This documentation
```

### Modified Files

**Parent Project**:
```
src/components/SpellCard.jsx                   # Added image display & loading
```

**Framework (Submodule)**:
```
wiki-framework/src/components/wiki/SpellPicker.jsx   # Added spell icon display
```

## How It Works

### Image Lookup Flow

1. **SpellCard Loads Spell Data**
   ```javascript
   const [spellData, setSpellData] = React.useState(null);
   ```

2. **Image Service Triggered**
   ```javascript
   const imagePath = await getSpellImage(spellData.name, spellData.attribute);
   ```

3. **Search Image Database**
   - Load `/data/image-search-index.json`
   - Search for spell name in `category: "skills"` with `type: "icon"`
   - Match against filename and keywords

4. **Fallback Chain**
   ```
   Spell-Specific Image
         ↓ (if not found)
   Element Type Icon
         ↓ (if error)
   Generic Skill Icon
   ```

### Example: "Fire Slash"

```javascript
// 1. Spell loads
spellData = {
  name: "Fire Slash",
  attribute: "Fire",
  ...
}

// 2. Image service searches
await getSpellImage("Fire Slash", "Fire")

// 3. Search image-search-index.json
// Look for: category="skills", keywords includes "fire" or "slash"

// 4. Not found → Fallback to element icon
return "/images/icons/typeicon_fire_1.png"

// 5. SpellCard displays with Fire element icon
```

## Image Database Structure

The image database (`image-search-index.json`) has this structure:

```json
{
  "version": "1.0",
  "totalImages": 12320,
  "images": {
    "img_1234": {
      "filename": "Icon_FireSkill.png",
      "path": "/images/skills/Icon_FireSkill.png",
      "category": "skills",
      "type": "icon",
      "keywords": ["fire", "skill", "icon"],
      "dimensions": { "width": 128, "height": 128 }
    }
  }
}
```

## Testing

### Local Development
```bash
npm run dev
```

### Test Steps

1. **Test SpellCard Display**
   - Navigate to any page
   - Add test content: `<!-- spell:Fire Slash -->`
   - Preview should show Fire Slash with Fire icon

2. **Test SpellPicker**
   - Open page editor
   - Click "🎴 Insert Spell" button
   - Modal should show all spells with icons
   - Icons should be element type icons (Fire/Water/Wind/Earth)

3. **Test Fallbacks**
   - Check browser console for any image load errors
   - Verify fallback to element icons works
   - Verify error fallback to generic skill icon

### Expected Results

✅ SpellCard displays with large icon in header
✅ Element-appropriate icon colors (red for Fire, blue for Water, etc.)
✅ SpellPicker shows small icons next to spell names
✅ No broken image icons
✅ Fast loading (images cached after first load)

## Future Enhancements

### Spell-Specific Icons

To add actual spell icons instead of element fallbacks:

1. **Update skills.json** with image references:
   ```json
   {
     "id": 1,
     "name": "Fire Slash",
     "imageId": "img_5678",  // ← Add this
     "attribute": "Fire",
     ...
   }
   ```

2. **Update imageService.js**:
   ```javascript
   export async function getSpellImage(spellName, attribute, imageId) {
     // Check if imageId provided
     if (imageId) {
       const image = await loadImageById(imageId);
       if (image) return image.path;
     }
     // ... existing fallback logic
   }
   ```

3. **Update SpellCard.jsx**:
   ```javascript
   const imagePath = await getSpellImage(
     spellData.name,
     spellData.attribute,
     spellData.imageId  // ← Pass imageId if available
   );
   ```

### Image Categories

Could organize spell images by:
- **Element**: Fire skills, Water skills, etc.
- **Grade**: Common, Great, Rare icons
- **Type**: Attack, Buff, Healing icons
- **Season**: Special event spell icons

### Animated Icons

For premium polish:
- Use sprite sheets for animated spell icons
- Show animation on hover in SpellPicker
- Subtle glow effect in SpellCard

## Troubleshooting

### Images Not Showing

**Problem**: SpellCard shows generic icon instead of element icon
**Solution**:
1. Check image files exist in `public/images/icons/`
2. Verify paths in `imageService.js` match actual files
3. Check browser console for 404 errors

### Image Service Not Loading

**Problem**: Console shows "Image service not found"
**Solution**:
1. Ensure `src/services/imageService.js` exists in parent project
2. Check relative path in SpellPicker: `require('../../../../../src/services/imageService')`
3. Restart dev server after creating new files

### Images Load Slowly

**Problem**: Icons appear after delay
**Solution**:
1. Use `preloadImages()` function on app start
2. Cache images in browser
3. Optimize image sizes (element icons are already small)

## Deployment Checklist

Before deploying:

- [ ] Test all element icons display correctly
- [ ] Verify image paths work in production build
- [ ] Check image database is included in build (`public/data/`)
- [ ] Test on mobile (icons should be appropriately sized)
- [ ] Commit framework changes:
  ```bash
  cd wiki-framework
  git add .
  git commit -m "Add image support to SpellCard and SpellPicker"
  git push origin main
  ```
- [ ] Update parent reference:
  ```bash
  cd ..
  git add wiki-framework src/services/imageService.js src/components/SpellCard.jsx
  git commit -m "Add image database integration for SpellCard"
  git push origin main
  ```

## Credits

- **Image Database**: Generated from game asset packs
- **Element Icons**: Slayer Legend official assets
- **Fallback Icons**: Generic skill card icon from game

---

**Status**: ✅ Complete and Ready for Testing
**Last Updated**: 2025-12-13
