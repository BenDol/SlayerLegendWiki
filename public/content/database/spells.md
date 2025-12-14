---
title: Spell Database
description: Complete database of all spells and skills in Slayer Legend
category: Database
tags: [spells, skills, database]
date: 2025-12-13
---

# Spell Database

This page contains the complete database of all spells and skills available in Slayer Legend.

## How to Use SpellCard

The `SpellCard` component displays detailed spell information in a beautiful card format.

### Usage Methods

**Method 1: By Spell Name**
```jsx
<SpellCard name="Fire Slash" />
```

**Method 2: By Spell ID**
```jsx
<SpellCard id={1} />
```

**Method 3: With Direct Data**
```jsx
<SpellCard spell={{
  name: "Fire Slash",
  attribute: "Fire",
  grade: "Common",
  ...
}} />
```

## All Spells

For now, SpellCard must be used in custom React pages or components. See the example implementation in `src/components/SpellCard.jsx`.

### Fire Spells

- **Fire Slash** (ID: 1) - Wrap fire around the sword and set enemies on fire
- **Fire Sword** (ID: 5) - Instantly raise ATK with the power of fire
- **Fire Storm** (ID: 13) - Summon a storm of fire

### Water Spells

- **Ice Stone** (ID: 2) - Summons ice rocks and strike the enemy
- **Mana's Blessing** (ID: 6) - Recovers mana with the energy of water

### Wind Spells

- **Lightning Slash** (ID: 3) - Wields a lightning sword to inflict damage on enemies
- **Lightning Stroke** (ID: 7) - Summons lightning to strike enemies

### Earth Spells

- **Stone Strike** (ID: 4) - Slams the ground to explode the sword's energy

## Spell Properties

Each spell has the following properties:

- **Name**: The spell's name
- **Attribute**: Element type (Fire, Water, Wind, Earth)
- **Grade**: Rarity (Common, Great, Rare, Epic, Legendary)
- **Enter Level**: Level required to unlock the spell
- **MP Cost**: Mana cost to cast
- **Cooldown**: Seconds between casts
- **Range**: Attack range
- **Base Value**: Initial power percentage
- **Upgrade Value**: Power increase per level
- **Max Level**: Maximum level the spell can reach

## Developer Note

To use SpellCard in a custom page:

```jsx
import SpellCard from '../../src/components/SpellCard';

// In your component
<SpellCard name="Fire Slash" />
```

The component automatically loads data from `/data/skills.json`.
