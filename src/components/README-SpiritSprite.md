# SpiritSprite Component

Animated spirit sprite component that displays Slayer Legend spirit companions with frame-by-frame animation.

## Features

- ✨ Frame-by-frame sprite sheet animation
- 🎬 4 animation types: idle, attack, side attack, movement
- 🎮 Play/Pause and Reset controls (visible on hover)
- 📊 Frame counter display
- 🎨 Customizable size and animation speed
- 🌙 Dark mode support
- ℹ️ Optional spirit information display
- 🖼️ 16 animation frames per evolution level (4 frames per animation type)
- 🎯 8 evolution levels per spirit

## Usage

### Basic Usage

```jsx
import SpiritSprite from '../components/SpiritSprite';

// Display Sala at level 0 with default settings
<SpiritSprite spiritId={1} />
```

### With Custom Options

```jsx
// Display Ark at level 3, larger size, with info, attack animation
<SpiritSprite
  spiritId={2}
  level={3}
  animationType="attack"
  size="large"
  showInfo={true}
  fps={16}
/>
```

### Static (Non-Animated)

```jsx
// Display a static sprite (no animation)
<SpiritSprite
  spiritId={3}
  level={5}
  animated={false}
/>
```

### Custom Size

```jsx
// Custom pixel size
<SpiritSprite
  spiritId={4}
  size="192px"
/>

// Or use Tailwind classes with className
<SpiritSprite
  spiritId={5}
  className="w-full max-w-md"
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `spiritId` | `number` | **Required** | Spirit ID (1-12) |
| `level` | `number` | `0` | Evolution level (0-7) |
| `animationType` | `string` | `'idle'` | Animation type: 'idle', 'attack', 'sideAttack', 'movement' |
| `animated` | `boolean` | `true` | Enable/disable animation |
| `fps` | `number` | `8` | Animation speed (frames per second) |
| `showInfo` | `boolean` | `false` | Show spirit name, level, and skill |
| `size` | `string` | `'medium'` | Size: 'small' (64px), 'medium' (128px), 'large' (256px), or custom CSS value |
| `className` | `string` | `''` | Additional CSS classes |
| `onAnimationTypesDetected` | `function` | `null` | Callback receiving object with available animation types and frame counts |

## Spirit IDs

| ID | Name | Skill Type |
|----|------|------------|
| 1 | Sala | Damage Over Time |
| 2 | Ark | Crowd Control |
| 3 | Herh | Cooldown Reduction |
| 4 | Loar | Boss Damage |
| 5 | Mum | Normal Monster Damage |
| 6 | Todd | Gold Farming |
| 7 | Zappy | Execute |
| 8 | Radon | Conditional Damage |
| 9 | Bo | HP Boost |
| 10 | Luga | EXP Farming |
| 11 | Kart | First Strike |
| 12 | Noah | Burst Damage |

## Evolution Levels

Each spirit has 8 evolution levels (0-7), with distinct sprites:
- **Level 0-2**: Early stages
- **Level 3-5**: Mid-tier evolution
- **Level 6-7**: Fully evolved forms

## Animation Types

**Standard frame layout** (high-level spirits):

| Animation Type | Typical Frames | Description |
|----------------|----------------|-------------|
| `'attack'` | 0-3 | Attack animation (Row 1) |
| `'sideAttack'` | 4-7 | Side attack animation (Row 2) |
| `'movement'` | 8-11 | Sideway movement animation (Row 3) |
| `'idle'` | 12-15 | Idle animation (Row 4) |

**Important:** Frame layouts vary significantly between spirit levels.
- **Early levels (0-3)**: May only have 2 frames total (e.g., frames 0-1 for "sideAttack")
- **Mid levels (4-6)**: May have 4-8 frames with 1-2 animation types
- **High levels (7)**: Typically have all 16 frames with 4 animation types

### Intelligent Frame Detection

The component uses a robust detection system:

1. **Detects all frames (0-15)** that exist for the spirit level
2. **Maps frames to animation types** using priority-based fallbacks:
   - Tries standard positions first (idle: 12-15, attack: 0-3, etc.)
   - Falls back to alternative positions if standard ones don't exist
   - Ensures no frame is used by multiple animation types
3. **Animates only detected frames** - no blinking or failed loads
4. **Adapts automatically** to any frame layout without configuration

Example usage:
```jsx
// Show attack animation
<SpiritSprite spiritId={1} level={3} animationType="attack" />

// Show idle animation (default)
<SpiritSprite spiritId={1} level={3} animationType="idle" />

// Show movement animation
<SpiritSprite spiritId={1} level={3} animationType="movement" />
```

### Detecting Available Animation Types

Use the `onAnimationTypesDetected` callback to get information about which animation types are available:

```jsx
const [availableAnimations, setAvailableAnimations] = useState({});

<SpiritSprite
  spiritId={1}
  level={1}
  onAnimationTypesDetected={(types) => {
    setAvailableAnimations(types);
    // Example for low-level spirit with only 2 frames:
    // types = {
    //   idle: { available: false, frameCount: 0, frames: [] },
    //   attack: { available: false, frameCount: 0, frames: [] },
    //   sideAttack: { available: true, frameCount: 2, frames: [0, 1] },
    //   movement: { available: false, frameCount: 0, frames: [] }
    // }
    //
    // Example for high-level spirit with 16 frames:
    // types = {
    //   idle: { available: true, frameCount: 4, frames: [12, 13, 14, 15] },
    //   attack: { available: true, frameCount: 4, frames: [0, 1, 2, 3] },
    //   sideAttack: { available: true, frameCount: 4, frames: [4, 5, 6, 7] },
    //   movement: { available: true, frameCount: 4, frames: [8, 9, 10, 11] }
    // }
  }}
/>

// Disable UI elements for unavailable animations
<button disabled={!availableAnimations.sideAttack?.available}>
  Side Attack ({availableAnimations.sideAttack?.frameCount || 0} frames)
</button>
```

## Examples

### Spirit Gallery

```jsx
<div className="grid grid-cols-4 gap-4">
  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(id => (
    <SpiritSprite
      key={id}
      spiritId={id}
      level={0}
      showInfo={true}
      size="small"
    />
  ))}
</div>
```

### Evolution Showcase

```jsx
<div className="flex gap-4">
  {[0, 1, 2, 3, 4, 5, 6, 7].map(level => (
    <SpiritSprite
      key={level}
      spiritId={1}
      level={level}
      size="small"
    />
  ))}
</div>
```

### Comparison View

```jsx
<div className="flex justify-center gap-8">
  <div>
    <h3>Before Evolution</h3>
    <SpiritSprite spiritId={1} level={0} showInfo={true} />
  </div>
  <div>
    <h3>After Evolution</h3>
    <SpiritSprite spiritId={1} level={7} showInfo={true} />
  </div>
</div>
```

### In Markdown Content

Use the custom renderer pattern (see `CLAUDE.md`) to embed spirits in markdown:

```markdown
<!-- spirit:1:3 -->
```

Would render as: `<SpiritSprite spiritId={1} level={3} />`

## Animation Controls

Controls appear on hover:
- **Play/Pause button**: Toggle animation
- **Reset button**: Return to first frame
- **Frame counter**: Shows current frame / total frames

## Performance Notes

- Each sprite level has up to 16 individual frame images (4 rows of up to 4 frames each)
- **All animation types detected on mount** - Component checks all 4 types once when spirit/level changes
- Frames are preloaded when animation type changes to detect valid frames
- Only valid frames are included in the animation cycle (prevents blinking from missing frames)
- Animation cycles through detected valid frames for smooth playback
- Animation uses `setInterval` for precise frame timing
- Loading spinner displayed during frame detection
- Preloaded images are cached in memory for the current animation type
- Parent components can use detection callback to optimize UI (disable buttons for unavailable animations)

## Future Enhancements

Planned features:
- ✅ ~~Preload all frames for smoother animation~~ (Implemented with dynamic frame detection)
- Export as actual GIF
- Sprite comparison slider
- Skill effect visualization
- Stat overlay display
- Click to view full spirit details
- Background music toggle
- Sound effects for animations

## Data Source

Sprite data loaded from:
- **JSON:** `public/data/spirit-characters.json`
- **Images:** `public/images/spirits/Spirit_{id:03d}_{level}_{frame}.png`

Each spirit has:
- 8 evolution levels
- 16 animation frames per level (4 animation types × 4 frames each)
- 128 total sprites per spirit
- 1,536 total sprites across all 12 spirits

Frame organization:
- Frames 0-3: Attack animation
- Frames 4-7: Side attack animation
- Frames 8-11: Movement animation
- Frames 12-15: Idle animation
