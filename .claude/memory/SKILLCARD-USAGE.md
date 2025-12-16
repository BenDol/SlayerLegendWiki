# SkillCard Component - Quick Start Guide

## What I Created

✅ **SkillCard Component** (`src/components/SkillCard.jsx`)
   - Beautiful card UI for displaying skill information
   - Loads data from `/data/skills.json`
   - Color-coded by element and grade
   - Shows all skill stats with calculated max level damage

✅ **Example Skills Gallery Page** (`src/pages/SkillsPage.jsx`)
   - Complete working example with filters
   - Shows all skills in a grid layout
   - Filter by element and grade
   - (Not yet added to router - see below)

✅ **Documentation**
   - `src/components/README-SkillCard.md` - Detailed component docs
   - `public/content/database/skills.md` - User-facing documentation
   - Updated main `CLAUDE.md` with SkillCard info

## How to Use SkillCard

### Option 1: In a Custom React Page

```jsx
import SkillCard from '../components/SkillCard';

function MyPage() {
  return (
    <div>
      <h1>Fire Skills</h1>
      <SkillCard name="Fire Slash" />
      <SkillCard name="Fire Sword" />
    </div>
  );
}
```

### Option 2: With DataDrivenPage

```jsx
import DataDrivenPage from './wiki-framework/src/components/wiki/DataDrivenPage';
import SkillCard from './src/components/SkillCard';

<DataDrivenPage
  dataFile="skills.json"
  renderData={(skills) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {skills
        .filter(s => s.attribute === 'Fire')
        .map(skill => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
    </div>
  )}
/>
```

### Option 3: Multiple SkillCards by ID

```jsx
import SkillCard from '../components/SkillCard';

function FireSkillsGuide() {
  const fireSkillIds = [1, 5, 13]; // Fire Slash, Fire Sword, Fire Storm

  return (
    <div className="space-y-6">
      {fireSkillIds.map(id => (
        <SkillCard key={id} id={id} />
      ))}
    </div>
  );
}
```

## Quick Test

To see SkillCard in action immediately:

1. Open your browser dev console
2. Navigate to any page
3. Run this in console (temporary test):
```javascript
import('../src/components/SkillCard.jsx').then(module => {
  const SkillCard = module.default;
  // Component loaded successfully
});
```

Or create a simple test markdown file:
```markdown
---
title: Skill Test
---

# Testing SkillCard

See the skill database documentation at `/database/skills` for usage examples.
```

## Adding SkillsPage to Router (Optional)

If you want the full skills gallery page accessible via URL:

1. Edit `wiki-framework/src/router.jsx`
2. Add lazy import:
   ```javascript
   const SkillsPage = lazy(() => import('../../src/pages/SkillsPage'));
   ```
3. Add route:
   ```javascript
   {
     path: 'skills',
     element: <SuspenseWrapper><SkillsPage /></SuspenseWrapper>,
   }
   ```
4. Access at `/#/skills`

**Note:** This requires framework modification, so I left it optional.

## Current Skill Data

Your `/data/skills.json` contains:
- Fire skills (IDs: 1, 5, 13, ...)
- Water skills (IDs: 2, 6, ...)
- Wind skills (IDs: 3, 7, ...)
- Earth skills (IDs: 4, ...)

All with complete stats:
- Name, attribute, grade
- MP cost, cooldown, range
- Base value, upgrade value, max level
- Descriptions

## Examples

### Show a specific skill in your guide
```jsx
<SkillCard name="Lightning Stroke" />
```

### Show top 5 skills
```jsx
const topSkills = [1, 7, 13, 20, 25];
return (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {topSkills.map(id => <SkillCard key={id} id={id} />)}
  </div>
);
```

### Filter by element in a data-driven page
```jsx
<DataDrivenPage
  dataFile="skills.json"
  renderData={(skills) => {
    const fireSkills = skills.filter(s => s.attribute === 'Fire');
    return fireSkills.map(s => <SkillCard key={s.id} skill={s} />);
  }}
/>
```

## Next Steps

1. ✅ Test SkillCard by creating a simple page that uses it
2. ✅ Add SkillCard to your skill guides
3. ✅ Consider adding SkillsPage route for full gallery
4. ✅ Update your skills section content to showcase skills

## Files Created

```
src/components/
├── SkillCard.jsx           ← Main component
└── README-SkillCard.md     ← Component documentation

src/pages/
└── SkillsPage.jsx          ← Example gallery (optional)

public/content/database/
└── skills.md               ← User documentation

CLAUDE.md                   ← Updated with SkillCard info
SPELLCARD-USAGE.md         ← This guide
```

## Need Help?

- Component docs: `src/components/README-SkillCard.md`
- Example implementation: `src/pages/SkillsPage.jsx`
- Data structure: `/data/skills.json`
- Main docs: `CLAUDE.md` (search for "SkillCard")

Enjoy your beautiful skill cards! 🎴✨
