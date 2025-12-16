---
title: Skill Builder
description: Interactive skill build creator and manager with shareable URLs
tags: [tools, skills, build, simulator, planning]
category: Tools
---

# Skill Builder

<div class="not-prose mb-6">
  <a href="/#/skill-builder" class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
    ⚔️ Open Skill Builder
  </a>
</div>

Create, manage, and share your skill builds with our interactive simulator that mimics the game's authentic UI design.

## Features

### 🎮 Game-Accurate UI
- Authentic skill slot backgrounds and frames
- Rarity-based glow effects (Common, Great, Rare, Epic, Legendary)
- Element-colored badges (Fire, Water, Wind, Earth)
- Visual feedback matching the game

### ⚡ Powerful Build Tools
- **Configurable Slots**: Set 1-10 skill slots based on your progression
- **Level Management**: Adjust skill enhancement levels (1-maxLevel)
- **Quick Selection**: Search and filter skills by element and rarity
- **Visual Management**: Click to add/remove skills, drag slots

### 🔗 Share & Save
- **Shareable URLs**: Generate unique URLs for your builds
- **Export/Import**: Download builds as JSON files
- **Load from URL**: Access shared builds instantly
- **Build Statistics**: Track element distribution and equipped skills

### 📊 Build Analytics
- Element distribution visualization
- Total skills equipped counter
- Level tracking for each skill
- Build name customization

## How to Use

### Creating a Build

1. **Click the + icon** on an empty slot to open the skill selector
2. **Search or filter** skills by element (Fire/Water/Wind/Earth) or rarity
3. **Click a skill** to equip it to the slot
4. **Click the level badge** to adjust the skill's enhancement level
5. **Click an equipped skill** to remove it

### Sharing Builds

1. Configure your desired skill loadout
2. Click the **"Share"** button in the header
3. URL is automatically copied to your clipboard
4. Share the link with friends or community

### Saving Builds

**Export:**
- Click **"Export"** to download your build as a JSON file
- File includes build name, slots configuration, and timestamp

**Import:**
- Click **"Import"** and select a JSON file
- Build is instantly loaded with all skills and levels

## Skill Data

All skills are loaded from the wiki's comprehensive skills database, including:
- 130+ unique skills across all elements
- Accurate MP costs and cooldowns
- Damage values and ranges
- Rarity classifications
- Skill icons and visual effects

## Tips & Tricks

### Element Synergy
- Track element distribution to build balanced teams
- Fire excels at AoE damage
- Water provides healing and support
- Wind offers mobility and multi-target
- Earth specializes in single-target power

### Build Planning
- Start with your core DPS skills
- Add utility/support skills for survivability
- Consider MP cost management
- Plan for both clearing and bossing

### Max Slots Progression
In the actual game, skill slots unlock as you progress:
- **Early Game**: 3-4 slots
- **Mid Game**: 5-7 slots
- **Late Game**: 8-10 slots

Configure the simulator's max slots to match your current progression!

## Build Examples

### Fire AoE Farmer
Perfect for clearing waves of enemies quickly:
- Fire Slash (max level)
- Hellfire Pillar (max level)
- Flame Burst (max level)
- Fire Sword (buff)

### Water Sustain
Balanced approach with healing:
- Ice Stone (sustained damage)
- Mana's Blessing (mana recovery)
- Water Shield (defense)
- Healing Wave (sustainability)

### Hybrid Boss Killer
Specialized for single-target burst:
- Stone Strike (massive damage)
- Lightning Stroke (burst)
- Fire Sword (ATK buff)
- Wind Step (mobility)

## Technical Details

The Skill Builder is built with:
- React components with game-accurate styling
- URL-based build encoding for sharing
- JSON import/export for build management
- Real-time build statistics
- Responsive design (mobile, tablet, desktop)

<div class="not-prose mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
  <p class="text-sm text-blue-900 dark:text-blue-100 mb-2">
    <strong>Ready to build?</strong>
  </p>
  <a href="/#/skill-builder" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition-colors">
    Launch Skill Builder →
  </a>
</div>
