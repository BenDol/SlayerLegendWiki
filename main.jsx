import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { Navigate, useLocation } from 'react-router-dom';
import App from './wiki-framework/src/App.jsx';
import AppWrapper from './src/components/AppWrapper.jsx';
import ErrorBoundary from './wiki-framework/src/components/common/ErrorBoundary.jsx';
import './wiki-framework/src/styles/index.css';
import './src/styles/custom.css';
import { Ghost, Sparkles, Sword, Video, Swords, Book } from 'lucide-react';
import { createLogger } from './wiki-framework/src/utils/logger.js';

const logger = createLogger('Main');

// Temporary redirect component: /characters/** -> /character/**
const CharactersRedirect = () => {
  const location = useLocation();
  const newPath = location.pathname.replace('/characters/', '/character/');
  return <Navigate to={newPath} replace />;
};

// Initialize bot token for comment system (prevents users from closing comment issues)
import { initializeBotOctokit } from './wiki-framework/src/services/github/api.js';
initializeBotOctokit();

// Global <img> fallback: failed jsDelivr CDN loads retry via raw.githubusercontent.com
// (the CDN repo exceeds jsDelivr's 50 MB package limit, so uncached files 403)
import { installCdnImageFallback } from './src/utils/cdnFallback.js';
installCdnImageFallback();

// Crawler detection for SEO optimization
// Log crawler status for debugging (only in development)
if (import.meta.env.DEV) {
  import('./src/utils/crawlerDetection.js').then(({ logCrawlerStatus }) => {
    logCrawlerStatus();
  });
}

// Register game-specific rarity colors with styleRegistry
// This must be imported early to register styles before components render
import './src/config/rarityColors.js';

// Register game-specific storage migrations
import { registerMigrations } from './wiki-framework/src/utils/storageMigration.js';
import { gameMigrations } from './src/utils/gameMigrations.js';
registerMigrations(gameMigrations);

// Achievement deciders are now registered via plugin system
// See: src/services/achievements/deciders/index.js (exported as customDeciders)
// The bot service automatically loads deciders from both framework and parent project

// Register game-specific content renderers
import { registerContentProcessor, registerCustomComponents, registerSkillPreview, registerEquipmentPreview, registerDataAutocompleteSearch, registerPicker } from './wiki-framework/src/utils/contentRendererRegistry.js';
import { registerDataSelector } from './wiki-framework/src/utils/dataSelectorRegistry.js';
import { registerPageAsideComponents } from './wiki-framework/src/utils/pageAsideRegistry.js';
import { processGameSyntax, getGameComponents, renderSkillPreview, renderEquipmentPreview } from './src/utils/gameContentRenderer.jsx';
import { searchDataForAutocomplete } from './src/utils/dataAutocompleteSearch.js';
import { injectAdMarkers } from './src/utils/adInjection.js';
import SideRailAd from './src/components/ads/SideRailAd.jsx';
import DataSelector from './src/components/DataSelector.jsx';
import SpiritPicker from './src/components/SpiritPicker.jsx';
import SkillPicker from './src/components/SkillPicker.jsx';
import EquipmentPicker from './src/components/EquipmentPicker.jsx';
import BattleLoadoutPicker from './src/components/BattleLoadoutPicker.jsx';
import VideoGuidePicker from './src/components/VideoGuidePicker.jsx';
import SkillBuildPicker from './src/components/SkillBuildPicker.jsx';
import SpiritBuildPicker from './src/components/SpiritBuildPicker.jsx';
import SkillBuildCard from './src/components/SkillBuildCard.jsx';
import SpiritBuildCard from './src/components/SpiritBuildCard.jsx';
import { handleSkillSelect, handleEquipmentSelect, handleSpiritSelect, handleBattleLoadoutSelect, handleSkillBuildSelect, handleSpiritBuildSelect } from './src/utils/pickerHandlers.js';

// Render preview functions for build pickers
const renderSkillBuildPreview = ({ build, mode }) => {
  // Create identifier in the format userId:buildId for loading
  const identifier = build.userId ? `${build.userId}:${build.id}` : build.id;
  // Use key with mode to force re-render when mode changes
  return <SkillBuildCard key={`${identifier}-${mode}`} identifier={identifier} mode={mode} showActions={false} />;
};

const renderSpiritBuildPreview = ({ build, mode }) => {
  // Create identifier in the format userId:buildId for loading
  const identifier = build.userId ? `${build.userId}:${build.id}` : build.id;
  // Use key with mode to force re-render when mode changes
  return <SpiritBuildCard key={`${identifier}-${mode}`} identifier={identifier} mode={mode} showActions={false} />;
};

// Register custom markdown processors for skill/equipment cards and data injection
// Ad markers are injected last so game syntax processing never sees or rewrites them.
// injectAdMarkers is a no-op when ads are disabled or the route is excluded (e.g. the editor preview).
registerContentProcessor((content) => injectAdMarkers(processGameSyntax(content)));
registerCustomComponents(getGameComponents());
registerSkillPreview(renderSkillPreview);
registerEquipmentPreview(renderEquipmentPreview);
registerDataSelector(DataSelector);
registerPicker('spirit', SpiritPicker, { icon: Ghost, label: 'Spirit', handler: handleSpiritSelect });
registerPicker('skill', SkillPicker, { icon: Sparkles, label: 'Skill', handler: handleSkillSelect, renderPreview: renderSkillPreview });
registerPicker('equipment', EquipmentPicker, { icon: Sword, label: 'Equipment', handler: handleEquipmentSelect, renderPreview: renderEquipmentPreview });
registerPicker('battle-loadout', BattleLoadoutPicker, { icon: Swords, label: 'Battle Loadout', handler: handleBattleLoadoutSelect });
registerPicker('skill-build', SkillBuildPicker, { icon: Book, label: 'Skill Build', handler: handleSkillBuildSelect, renderPreview: renderSkillBuildPreview });
registerPicker('spirit-build', SpiritBuildPicker, { icon: Ghost, label: 'Spirit Build', handler: handleSpiritBuildSelect, renderPreview: renderSpiritBuildPreview });
registerPicker('video-guide', VideoGuidePicker, { icon: Video, label: 'Video Guide' });

registerDataAutocompleteSearch(searchDataForAutocomplete);

// Sticky side-rail ad in the content page aside (below the table of contents).
// AdSlot inside it self-gates on ads-enabled, route exclusions, and the sideRail
// slot ID being configured - with no slot ID it renders nothing at all.
registerPageAsideComponents([SideRailAd]);

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

dataRegistry.register('familiars', {
  file: '/data/familiars.json',
  label: 'Familiars',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['element', 'attribute'],
    badges: ['element']
  },
  searchFields: ['name', 'element', 'attribute'],
  icon: '👹',
  description: 'Demon familiar characters',
  type: 'array'
});

dataRegistry.register('prime-familiars', {
  file: '/data/prime-familiars.json',
  label: 'Prime Familiars',
  idField: 'id',
  display: {
    primary: 'name',
    secondary: ['skill.type'],
    badges: ['skill.type']
  },
  dataPath: 'primeFamiliars',
  searchFields: ['name', 'skill.name'],
  icon: '⭐',
  description: 'Combined Prime Familiars',
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

dataRegistry.register('stages', {
  file: '/data/stages.json',
  label: 'Stages',
  idField: 'stageNo',
  display: {
    primary: 'stageNo',
    secondary: ['region', 'area', 'zone'],
    badges: ['region']
  },
  dataPath: null,
  searchFields: ['stageNo', 'region', 'area', 'zone', 'equipmentRarity'],
  icon: '🗺️',
  description: 'Per-stage enemy, boss and reward data for the main stage road',
  type: 'array'
});

dataRegistry.register('stage-chapters', {
  file: '/data/stage-chapters.json',
  label: 'Stage Chapters',
  idField: 'chapter',
  display: {
    // `label` rather than `name`: unreleased chapters carry an empty name by design.
    primary: 'label',
    secondary: ['firstStage', 'lastStage'],
    badges: ['chapter']
  },
  dataPath: 'chapters',
  searchFields: ['label', 'name', 'nameKo', 'chapter'],
  icon: '📍',
  description: 'The 20-stage chapters (regions) of the main stage road',
  type: 'array'
});

// Register build types for build sharing system
import { registerBuildTypes } from './wiki-framework/src/utils/buildTypeRegistry.js';

registerBuildTypes({
  'skill-builds': '/skill-builder',
  'spirit-builds': '/spirit-builder',
  'familiar-builds': '/familiar-builder',
  'battle-loadouts': '/battle-loadouts',
  'soul-weapon-engraving': '/soul-weapon-engraving',
  'skill-stone-builds': '/skill-stone-builder',
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
  'stage-chapters.json',
  'spirit-characters.json',
  'spirit-upgrades.json',
  'familiars.json',
  'image-index.json',
]);

// Register game-specific custom routes with lazy loading for better startup performance
import { registerCustomRoutes } from './wiki-framework/src/utils/routeRegistry.js';

// Lazy load pages to improve initial load time - components only load when route is visited
const SkillBuildSimulatorPage = React.lazy(() => import('./src/pages/SkillBuildSimulatorPage.jsx'));
const BattleLoadoutsPage = React.lazy(() => import('./src/pages/BattleLoadoutsPage.jsx'));
const SpiritSpriteDemoPage = React.lazy(() => import('./src/pages/SpiritSpriteDemoPage.jsx'));
const SpiritBuilderPage = React.lazy(() => import('./src/pages/SpiritBuilderPage.jsx'));
const MySpiritCollectionPage = React.lazy(() => import('./src/pages/MySpiritCollectionPage.jsx'));
const FamiliarBuilderPage = React.lazy(() => import('./src/pages/FamiliarBuilderPage.jsx'));
const MyFamiliarCollectionPage = React.lazy(() => import('./src/pages/MyFamiliarCollectionPage.jsx'));
const MyCollectionsPage = React.lazy(() => import('./src/pages/MyCollectionsPage.jsx'));
const SoulWeaponEngravingBuilderPage = React.lazy(() => import('./src/pages/SoulWeaponEngravingBuilderPage.jsx'));
const ContentCreatorsPage = React.lazy(() => import('./wiki-framework/src/pages/ContentCreatorsPage.jsx'));
const SkillStonesPage = React.lazy(() => import('./src/pages/SkillStonesPage.jsx'));
const ChangelogPage = React.lazy(() => import('./wiki-framework/src/pages/ChangelogPage.jsx'));

// Base routes that are always registered
const baseRoutes = [
  // Temporary redirect: /characters -> /character
  {
    path: 'characters',
    component: <Navigate to="/character" replace />,
    suspense: false
  },
  // Temporary redirect: /characters/* -> /character/*
  {
    path: 'characters/*',
    component: <CharactersRedirect />,
    suspense: false
  },
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
    path: 'familiar-builder',
    component: <FamiliarBuilderPage />,
    suspense: true
  },
  {
    path: 'my-familiars',
    component: <MyFamiliarCollectionPage />,
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
    path: 'creators',
    component: <ContentCreatorsPage />,
    suspense: true
  },
  {
    path: 'skill-stone-builder',
    component: <SkillStonesPage />,
    suspense: true
  },
  {
    path: 'changelog',
    component: <ChangelogPage />,
    suspense: true
  }
];

registerCustomRoutes(baseRoutes);

// Preload image config for synchronous image resolution
import { preloadImageConfig } from './wiki-framework/src/utils/imageResolver.js';

// Preload config before rendering app for synchronous image resolution
preloadImageConfig().then(() => {
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
}).catch(err => {
  // Config failed to load - render anyway with local paths as fallback
  logger.error('Failed to preload image config, using local paths', { error: err });
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
});
