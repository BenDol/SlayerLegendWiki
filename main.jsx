import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './wiki-framework/src/App.jsx';
import ErrorBoundary from './wiki-framework/src/components/common/ErrorBoundary.jsx';
import './wiki-framework/src/styles/index.css';

// Initialize bot token for comment system (prevents users from closing comment issues)
import { initializeBotOctokit } from './wiki-framework/src/services/github/api.js';
initializeBotOctokit();

// Register game-specific content renderers
import { registerContentProcessor, registerCustomComponents, registerSkillPreview, registerEquipmentPreview } from './wiki-framework/src/utils/contentRendererRegistry.js';
import { processGameSyntax, getGameComponents, renderSkillPreview, renderEquipmentPreview } from './src/utils/gameContentRenderer.jsx';

// Register custom markdown processors for skill/equipment cards
registerContentProcessor(processGameSyntax);
registerCustomComponents(getGameComponents());
registerSkillPreview(renderSkillPreview);
registerEquipmentPreview(renderEquipmentPreview);

// Register game-specific custom routes
import { registerCustomRoutes } from './wiki-framework/src/utils/routeRegistry.js';
import SkillBuildSimulatorPage from './src/pages/SkillBuildSimulatorPage.jsx';

registerCustomRoutes([
  {
    path: 'skill-builder',
    component: <SkillBuildSimulatorPage />,
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
