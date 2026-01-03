# SpiritSprite Component Implementation

**Created:** 2025-12-16
**Purpose:** Animated spirit sprite component for displaying Slayer Legend spirit companions

## Files Created

### 1. Component (`src/components/SpiritSprite.jsx`)
- Displays animated spirit sprites with frame-by-frame animation
- 16 animation frames per evolution level
- Play/Pause and Reset controls (visible on hover)
- Customizable size, FPS, and display options
- Dark mode support
- Loading states and error handling

### 2. Demo Page (`src/pages/SpiritSpriteDemoPage.jsx`)
- Interactive demo with all controls
- Spirit gallery (all 12 spirits)
- Evolution progression viewer
- Live usage code example
- Accessible at: `/#/spirit-sprite-demo`

### 3. Documentation (`src/components/README-SpiritSprite.md`)
- Complete API documentation
- Usage examples
- Props reference
- Spirit ID list
- Future enhancement ideas

## Component Props

```jsx
<SpiritSprite
  spiritId={1-12}              // Required: Spirit ID
  level={0-7}                  // Evolution level (default: 0)
  animationType="idle"         // Animation type: 'idle'|'attack'|'sideAttack'|'movement' (default: 'idle')
  animated={true}              // Enable animation (default: true)
  fps={8}                      // Animation speed (default: 8)
  showInfo={false}             // Show name/level/skill (default: false)
  size="medium"                // 'small'|'medium'|'large'|custom (default: 'medium')
  className=""                 // Additional CSS classes
/>
```

## Data Structure

**Source:** `public/data/spirit-characters.json`

Each spirit now includes:
```json
{
  "id": 1,
  "name": "Sala",
  "skill": { ... },
  "sprites": [
    {
      "level": 0,
      "baseSprite": "/images/spirits/Spirit_001_0.png",
      "spriteSheet": "/images/spirits/Spirit_001_0_{frame}.png",
      "animationFrames": 16,
      "framePattern": "/images/spirits/Spirit_001_0_[0-15].png"
    },
    // ... levels 1-7
  ]
}
```

## Usage Examples

### Basic
```jsx
<SpiritSprite spiritId={1} />
```

### With Info
```jsx
<SpiritSprite spiritId={2} level={3} showInfo={true} size="large" />
```

### Gallery
```jsx
<div className="grid grid-cols-4 gap-4">
  {[1, 2, 3, 4].map(id => (
    <SpiritSprite key={id} spiritId={id} showInfo={true} />
  ))}
</div>
```

## Route Registration

Added to `main.jsx`:
```jsx
{
  path: 'spirit-sprite-demo',
  component: <SpiritSpriteDemoPage />,
  suspense: true
}
```

Access at: `http://localhost:8888/#/spirit-sprite-demo`

## Technical Details

- **Total Spirits:** 12
- **Evolution Levels per Spirit:** 8 (0-7)
- **Frames per Level:** 16 (0-15)
- **Total Sprites per Spirit:** 128 frames
- **Total Sprites (All Spirits):** 1,536 frames
- **Animation Method:** setInterval with configurable FPS
- **Image Path Pattern:** `Spirit_{id:03d}_{level}_{frame}.png`

### Animation Frame Layout

Each sprite level has up to 16 frames organized in 4 rows:
- **Row 1 (Frames 0-3)**: Attack animation
- **Row 2 (Frames 4-7)**: Side attack animation
- **Row 3 (Frames 8-11)**: Sideway movement animation
- **Row 4 (Frames 12-15)**: Idle animation

The `animationType` prop controls which frame sequence plays:
- `'attack'` → frames 0-3
- `'sideAttack'` → frames 4-7
- `'movement'` → frames 8-11
- `'idle'` → frames 12-15 (default)

**Dynamic Frame Detection:**
Not all animation types have exactly 4 frames for every spirit level. The component automatically:
- Preloads all possible frames for the current animation type
- Detects which frames actually exist
- Only animates through valid frames
- Prevents blinking effects from missing frames
- Shows correct frame count in the UI

**Animation Type Detection:**
The component uses intelligent frame detection on mount/change:
1. **Scans all frames (0-15)** to find which ones exist
2. **Maps frames to animation types** using priority-based fallback ranges:
   - Standard positions tried first (idle: 12-15, attack: 0-3, sideAttack: 4-7, movement: 8-11)
   - Falls back to alternative positions if standard ones missing
   - Prevents frame reuse across animation types
3. **Reports via callback** with structure: `{ idle: {available, frameCount, frames: [12,13,14,15]}, ... }`
4. **Adapts to any layout**:
   - Low levels: May only have 2 frames (e.g., sideAttack using frames 0-1)
   - Mid levels: May have 4-8 frames with 1-2 animation types
   - High levels: Typically all 16 frames with 4 animation types
5. **Parent components** can disable UI for unavailable animations

## Future Enhancements

Planned features:
- [x] Preload all frames for smoother animation (Implemented with dynamic frame detection)
- [ ] Export as actual GIF file
- [ ] Sprite comparison slider
- [ ] Skill effect visualization overlays
- [ ] Stat information tooltips
- [ ] Click to view full spirit details modal
- [ ] Integration with spirit data pages
- [ ] Markdown shortcode support (e.g., `<!-- spirit:1:3 -->`)
- [ ] Background music toggle
- [ ] Sound effects for animations

## Animation Controls

Hover over sprite to reveal:
- **Play/Pause Button** - Toggle animation
- **Reset Button** - Return to first frame
- **Frame Counter** - Current frame / Total frames

## Related Files

- **Component:** `src/components/SpiritSprite.jsx`
- **Demo Page:** `src/pages/SpiritSpriteDemoPage.jsx`
- **Documentation:** `src/components/README-SpiritSprite.md`
- **Data:** `public/data/spirit-characters.json`
- **Images:** `public/images/spirits/Spirit_*.png`
- **Route Registry:** `main.jsx`

## Testing

To test the component:
1. Start dev server: `npm run dev`
2. Navigate to: `http://localhost:8888/#/spirit-sprite-demo`
3. Use interactive controls to test all features
4. Check browser console for any errors
5. Test on different screen sizes (responsive)
6. Test dark mode toggle

## Integration Ideas

- Add to spirit wiki pages
- Create spirit comparison tool
- Build spirit collection tracker
- Evolution guide with visual progression
- Spirit recommendation based on playstyle
- Interactive spirit skill calculator
