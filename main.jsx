import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './wiki-framework/src/App.jsx';
import ErrorBoundary from './wiki-framework/src/components/common/ErrorBoundary.jsx';
import './wiki-framework/src/styles/index.css';

// Register game-specific content renderers
import { registerContentProcessor, registerCustomComponents, registerSpellPreview, registerEquipmentPreview } from './wiki-framework/src/utils/contentRendererRegistry.js';
import { processGameSyntax, getGameComponents, renderSpellPreview, renderEquipmentPreview } from './src/utils/gameContentRenderer.jsx';

// Register custom markdown processors for spell/equipment cards
registerContentProcessor(processGameSyntax);
registerCustomComponents(getGameComponents());
registerSpellPreview(renderSpellPreview);
registerEquipmentPreview(renderEquipmentPreview);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
