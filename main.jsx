import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './wiki-framework/src/App.jsx';
import ErrorBoundary from './wiki-framework/src/components/common/ErrorBoundary.jsx';
import './wiki-framework/src/styles/index.css';

// Initialize bot token for comment system (prevents users from closing comment issues)
import { initializeBotOctokit } from './wiki-framework/src/services/github/api.js';
initializeBotOctokit();

// Register game-specific content renderers
import { registerContentProcessor, registerCustomComponents, registerSkillPreview, registerEquipmentPreview, registerDataAutocompleteSearch } from './wiki-framework/src/utils/contentRendererRegistry.js';
import { registerDataSelector } from './wiki-framework/src/utils/dataSelectorRegistry.js';
import { registerSpiritPicker } from './wiki-framework/src/utils/pickerRegistry.js';
import { processGameSyntax, getGameComponents, renderSkillPreview, renderEquipmentPreview } from './src/utils/gameContentRenderer.jsx';
import { searchDataForAutocomplete } from './src/utils/dataAutocompleteSearch.js';
import DataSelector from './src/components/DataSelector.jsx';
import SpiritPicker from './src/components/SpiritPicker.jsx';

// Register custom markdown processors for skill/equipment cards and data injection
registerContentProcessor(processGameSyntax);
registerCustomComponents(getGameComponents());
registerSkillPreview(renderSkillPreview);
registerEquipmentPreview(renderEquipmentPreview);
registerDataSelector(DataSelector);
registerSpiritPicker(SpiritPicker);
registerDataAutocompleteSearch(searchDataForAutocomplete);

// Register data sources for data injection
import dataRegistry from './src/utils/dataRegistry.js';

// ===== CHARACTER & COMPANION DATA =====

dataRegistry.register('spirits', {
  file: '/data/spirit-characters.json',
  label: 'Spirit Characters',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['element', 'skill.type'],
    badges: ['element']
  },
  dataPath: 'spirits',
  searchFields: ['name', 'element', 'skill.name', 'skill.type', 'skill.description'],
  icon: '✨',
  description: 'Spirit characters with unique abilities and skills',
  type: 'array'
});

dataRegistry.register('spirit-upgrades', {
  file: '/data/spirit-upgrades.json',
  label: 'Spirit Upgrades',
  idField: 'level',
  display: {
    primary: 'level',
    secondary: ['upgradeCosts.enhanceCubes', 'upgradeCosts.manaCrystal'],
    badges: ['level']
  },
  dataPath: 'spirits',
  searchFields: ['level'],
  icon: '⬆️',
  description: 'Spirit upgrade costs and stat multipliers per level',
  type: 'array'
});

dataRegistry.register('companion-characters', {
  file: '/data/companion-characters.json',
  label: 'Companion Characters',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['element', 'type'],
    badges: ['element']
  },
  dataPath: null,
  searchFields: ['name', 'element', 'type', 'description'],
  icon: '🤝',
  description: 'Companion characters like Ellie, Zeke, Miho, and Luna',
  type: 'array'
});

dataRegistry.register('companions', {
  file: '/data/companions.json',
  label: 'Companion Upgrade Costs',
  idField: 'level',
  display: {
    primary: 'level',
    secondary: ['cost', 'capacity'],
    badges: ['level']
  },
  dataPath: null,
  searchFields: ['level'],
  icon: '💰',
  description: 'Companion upgrade costs and inventory capacity per level',
  type: 'array'
});

dataRegistry.register('familiars', {
  file: '/data/familiars.json',
  label: 'Familiars',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['element', 'attribute'],
    badges: ['element', 'attribute']
  },
  dataPath: null,
  searchFields: ['name', 'element', 'attribute', 'description'],
  icon: '🐉',
  description: 'Demon familiars with elemental affinities and combat styles',
  type: 'array'
});

dataRegistry.register('classes', {
  file: '/data/classes.json',
  label: 'Classes',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['unlockLevel', 'awakeningStages'],
    badges: ['name']
  },
  dataPath: 'classes',
  searchFields: ['id', 'name', 'description'],
  icon: '🎭',
  description: 'Character classes (Warrior, Mage, etc.)',
  type: 'array'
});

dataRegistry.register('promotions', {
  file: '/data/promotions.json',
  label: 'Promotion Tiers',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['recommendedLevel', 'classATK'],
    badges: ['name']
  },
  dataPath: null,
  searchFields: ['name', 'recommendedLevel', 'enemyType'],
  icon: '👑',
  description: 'Character promotion tiers (Stone, Bronze, Silver, etc.)',
  type: 'array'
});

dataRegistry.register('appearance-clothing', {
  file: '/data/appearance-clothing.json',
  label: 'Appearance & Clothing',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['bonusType', 'effect'],
    badges: ['bonusType']
  },
  dataPath: null,
  searchFields: ['name', 'bonusType', 'effect'],
  icon: '👕',
  description: 'Cosmetic clothing items with stat bonuses',
  type: 'array'
});

// ===== COMBAT & SKILLS =====

dataRegistry.register('skills', {
  file: '/data/skills.json',
  label: 'Skills',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['attribute', 'grade'],
    badges: ['attribute', 'grade']
  },
  dataPath: null,
  searchFields: ['name', 'attribute', 'grade', 'basicDescription'],
  icon: '⚔️',
  description: 'Combat skills and abilities (Fire, Water, Wind, Earth)',
  type: 'array'
});

// ===== EQUIPMENT & ITEMS =====

dataRegistry.register('equipment', {
  file: '/data/equipment.json',
  label: 'Soul Weapons',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['attack', 'requirements'],
    badges: ['name']
  },
  dataPath: null,
  searchFields: ['name', 'attack', 'requirements', 'stageRequirement'],
  icon: '⚡',
  description: 'Soul weapons with attack stats and requirements',
  type: 'array'
});

dataRegistry.register('relics', {
  file: '/data/relics.json',
  label: 'Relics',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['buff', 'maxLevel'],
    badges: ['buff']
  },
  dataPath: null,
  searchFields: ['name', 'buff'],
  icon: '💎',
  description: 'Relics with passive buffs (Strength Gloves, Hunter\'s Eye, etc.)',
  type: 'array'
});

dataRegistry.register('equipment-drops', {
  file: '/data/equipment-drops.json',
  label: 'Equipment Drops',
  idField: null,
  display: {
    primary: 'type',
    secondary: ['rarity', 'probability'],
    badges: ['rarity']
  },
  dataPath: 'equipmentDrops',
  searchFields: ['type', 'rarity', 'probability'],
  icon: '📦',
  description: 'Equipment drop rates by type and rarity',
  type: 'array'
});

// ===== CONTENT & PROGRESSION =====

dataRegistry.register('adventures', {
  file: '/data/adventures.json',
  label: 'Adventures',
  idField: 'id',
  display: {
    primary: 'adventure',
    secondary: ['region', 'quest'],
    badges: ['region']
  },
  dataPath: null,
  searchFields: ['adventure', 'region', 'quest'],
  icon: '🗺️',
  description: 'Adventure quests with boss stats and rewards',
  type: 'array'
});

dataRegistry.register('campaigns', {
  file: '/data/campaigns.json',
  label: 'Campaigns',
  idField: 'id',
  display: {
    primary: 'campaign_title',
    secondary: ['difficulty', 'scenario_index'],
    badges: ['difficulty']
  },
  dataPath: null,
  searchFields: ['campaign_title', 'difficulty', 'enemy'],
  icon: '📖',
  description: 'Campaign scenarios with difficulty levels',
  type: 'array'
});

dataRegistry.register('quests', {
  file: '/data/quests.json',
  label: 'Quests',
  idField: 'id',
  display: {
    primary: 'description',
    secondary: ['need', 'reward'],
    badges: ['type']
  },
  dataPath: null,
  searchFields: ['description', 'type'],
  icon: '📜',
  description: 'Daily and progression quests with rewards',
  type: 'array'
});

// ===== GAME SYSTEMS =====

dataRegistry.register('formulas', {
  file: '/data/formulas.json',
  label: 'Game Formulas',
  idField: null,
  display: {
    primary: 'category',
    secondary: ['formula'],
    badges: []
  },
  dataPath: null,
  searchFields: [],
  icon: '🧮',
  description: 'Game calculation formulas (damage, enhancement, fusion)',
  type: 'object'
});

dataRegistry.register('drop-tables', {
  file: '/data/drop-tables.json',
  label: 'Drop Tables',
  idField: null,
  display: {
    primary: 'location',
    secondary: ['drops'],
    badges: []
  },
  dataPath: null,
  searchFields: [],
  icon: '🎁',
  description: 'Loot drop tables for stages and dungeons',
  type: 'object'
});

// Register game-specific custom routes
import { registerCustomRoutes } from './wiki-framework/src/utils/routeRegistry.js';
import SkillBuildSimulatorPage from './src/pages/SkillBuildSimulatorPage.jsx';
import BattleLoadoutsPage from './src/pages/BattleLoadoutsPage.jsx';
import SpiritSpriteDemoPage from './src/pages/SpiritSpriteDemoPage.jsx';

registerCustomRoutes([
  {
    path: 'skill-builder',
    component: <SkillBuildSimulatorPage />,
    suspense: true
  },
  {
    path: 'battle-loadouts',
    component: <BattleLoadoutsPage />,
    suspense: true
  },
  {
    path: 'spirits/viewer',
    component: <SpiritSpriteDemoPage />,
    suspense: true
  }
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
