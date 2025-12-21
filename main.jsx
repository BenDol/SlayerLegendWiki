import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './wiki-framework/src/App.jsx';
import AppWrapper from './src/components/AppWrapper.jsx';
import ErrorBoundary from './wiki-framework/src/components/common/ErrorBoundary.jsx';
import './wiki-framework/src/styles/index.css';
import { Ghost, Sparkles, Sword } from 'lucide-react';

// Initialize bot token for comment system (prevents users from closing comment issues)
import { initializeBotOctokit } from './wiki-framework/src/services/github/api.js';
initializeBotOctokit();

// Register game-specific rarity colors with styleRegistry
// This must be imported early to register styles before components render
import './src/config/rarityColors.js';

// Register game-specific storage migrations
import { registerMigrations } from './wiki-framework/src/utils/storageMigration.js';
import { gameMigrations } from './src/utils/gameMigrations.js';
registerMigrations(gameMigrations);

// Register game-specific content renderers
import { registerContentProcessor, registerCustomComponents, registerSkillPreview, registerEquipmentPreview, registerDataAutocompleteSearch, registerPicker } from './wiki-framework/src/utils/contentRendererRegistry.js';
import { registerDataSelector } from './wiki-framework/src/utils/dataSelectorRegistry.js';
import { processGameSyntax, getGameComponents, renderSkillPreview, renderEquipmentPreview } from './src/utils/gameContentRenderer.jsx';
import { searchDataForAutocomplete } from './src/utils/dataAutocompleteSearch.js';
import DataSelector from './src/components/DataSelector.jsx';
import SpiritPicker from './src/components/SpiritPicker.jsx';
import SkillPicker from './src/components/SkillPicker.jsx';
import EquipmentPicker from './src/components/EquipmentPicker.jsx';

// Register custom markdown processors for skill/equipment cards and data injection
registerContentProcessor(processGameSyntax);
registerCustomComponents(getGameComponents());
registerSkillPreview(renderSkillPreview);
registerEquipmentPreview(renderEquipmentPreview);
registerDataSelector(DataSelector);
registerPicker('spirit', SpiritPicker, { icon: Ghost, label: 'Insert Spirit' });
registerPicker('skill', SkillPicker, { icon: Sparkles, label: 'Insert Skill' });
registerPicker('equipment', EquipmentPicker, { icon: Sword, label: 'Insert Equipment' });
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
  file: '/data/soul-weapons.json',
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

dataRegistry.register('soul-weapon-grids', {
  file: '/data/soul-weapon-grids.json',
  label: 'Soul Weapon Grids',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['gridType', 'totalActiveSlots'],
    badges: ['gridType']
  },
  dataPath: 'weapons',
  searchFields: ['name', 'gridType'],
  icon: '🎯',
  description: 'Soul weapon engraving grid layouts with completion effects',
  type: 'array'
});

dataRegistry.register('soul-weapon-engravings', {
  file: '/data/soul-weapon-engravings.json',
  label: 'Soul Weapon Engravings',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['stat', 'gridSize'],
    badges: ['stat']
  },
  dataPath: 'shapes',
  searchFields: ['name', 'stat', 'statName', 'description'],
  icon: '💠',
  description: 'Soul weapon engraving piece shapes with stat bonuses',
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

// Register build types for build sharing system
import { registerBuildTypes } from './wiki-framework/src/utils/buildTypeRegistry.js';

registerBuildTypes({
  'skill-builds': '/skill-builder',
  'spirit-builds': '/spirit-builder',
  'battle-loadouts': '/battle-loadouts',
  'soul-weapon-engraving': '/soul-weapon-engraving',
});

// Register data files for Data Browser (Ctrl+Shift+B)
import { registerDataFiles } from './wiki-framework/src/utils/dataBrowserRegistry.js';

registerDataFiles([
  'companions.json',
  'soul-weapons.json',
  'soul-weapon-grids.json',
  'soul-weapon-engravings.json',
  'skills.json',
  'promotions.json',
  'relics.json',
  'quests.json',
  'classes.json',
  'drop-tables.json',
  'formulas.json',
  'adventures.json',
  'appearance-clothing.json',
  'campaigns.json',
  'companion-characters.json',
  'equipment-drops.json',
  'stages.json',
  'spirit-characters.json',
  'spirit-upgrades.json',
  'familiars.json',
  'image-index.json',
  'image-search-index.json',
]);

// Register game-specific custom routes with lazy loading for better startup performance
import { registerCustomRoutes } from './wiki-framework/src/utils/routeRegistry.js';

// Lazy load pages to improve initial load time - components only load when route is visited
const SkillBuildSimulatorPage = React.lazy(() => import('./src/pages/SkillBuildSimulatorPage.jsx'));
const BattleLoadoutsPage = React.lazy(() => import('./src/pages/BattleLoadoutsPage.jsx'));
const SpiritSpriteDemoPage = React.lazy(() => import('./src/pages/SpiritSpriteDemoPage.jsx'));
const SpiritBuilderPage = React.lazy(() => import('./src/pages/SpiritBuilderPage.jsx'));
const MySpiritCollectionPage = React.lazy(() => import('./src/pages/MySpiritCollectionPage.jsx'));
const MyCollectionsPage = React.lazy(() => import('./src/pages/MyCollectionsPage.jsx'));
const SoulWeaponEngravingBuilderPage = React.lazy(() => import('./src/pages/SoulWeaponEngravingBuilderPage.jsx'));
const DonatePage = React.lazy(() => import('./src/pages/DonatePage.jsx'));

registerCustomRoutes([
  {
    path: 'skill-builder',
    component: <SkillBuildSimulatorPage />,
    suspense: true
  },
  {
    path: 'spirit-builder',
    component: <SpiritBuilderPage />,
    suspense: true
  },
  {
    path: 'my-collections',
    component: <MyCollectionsPage />,
    suspense: true
  },
  {
    path: 'my-spirits',
    component: <MySpiritCollectionPage />,
    suspense: true
  },
  {
    path: 'battle-loadouts',
    component: <BattleLoadoutsPage />,
    suspense: true
  },
  {
    path: 'soul-weapon-engraving',
    component: <SoulWeaponEngravingBuilderPage />,
    suspense: true
  },
  {
    path: 'spirits/viewer',
    component: <SpiritSpriteDemoPage />,
    suspense: true
  },
  {
    path: 'donate',
    component: <DonatePage />,
    suspense: true
  }
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <ErrorBoundary>
        <AppWrapper>
          <App />
        </AppWrapper>
      </ErrorBoundary>
    </HelmetProvider>
  </React.StrictMode>,
);
