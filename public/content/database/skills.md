---
title: Skill Database
description: Complete database of all skills in Slayer Legend
category: Database
tags: [skills, database]
date: 2025-12-13
---

# Skill Database

This page contains the complete database of all skills available in Slayer Legend.

## How to Use SkillCard

The `SkillCard` component displays detailed skill information in a beautiful card format.

### Usage Methods

**Method 1: By Skill Name**
```jsx
<SkillCard name="Fire Slash" />
```

**Method 2: By Skill ID**
```jsx
<SkillCard id={1} />
```

**Method 3: With Direct Data**
```jsx
<SkillCard skill={{
  name: "Fire Slash",
  attribute: "Fire",
  grade: "Common",
  ...
}} />
```

## All Skills

For now, SkillCard must be used in custom React pages or components. See the example implementation in `src/components/SkillCard.jsx`.

### Fire Skills

- **Fire Slash** (ID: 1) - Wrap fire around the sword and set enemies on fire
- **Fire Sword** (ID: 5) - Instantly raise ATK with the power of fire
- **Fire Storm** (ID: 13) - Summon a storm of fire

### Water Skills

- **Ice Stone** (ID: 2) - Summons ice rocks and strike the enemy
- **Mana's Blessing** (ID: 6) - Recovers mana with the energy of water

### Wind Skills

- **Lightning Slash** (ID: 3) - Wields a lightning sword to inflict damage on enemies
- **Lightning Stroke** (ID: 7) - Summons lightning to strike enemies

### Earth Skills

- **Stone Strike** (ID: 4) - Slams the ground to explode the sword's energy

## Skill Properties

Each skill has the following properties:

- **Name**: The skill's name
- **Attribute**: Element type (Fire, Water, Wind, Earth)
- **Grade**: Rarity (Common, Great, Rare, Epic, Legendary)
- **Enter Level**: Level required to unlock the skill
- **MP Cost**: Mana cost to cast
- **Cooldown**: Seconds between casts
- **Range**: Attack range
- **Base Value**: Initial power percentage
- **Upgrade Value**: Power increase per level
- **Max Level**: Maximum level the skill can reach

## Developer Note

To use SkillCard in a custom page:

```jsx
import SkillCard from '../../src/components/SkillCard';

// In your component
<SkillCard name="Fire Slash" />
```

The component automatically loads data from `/data/skills.json`.
