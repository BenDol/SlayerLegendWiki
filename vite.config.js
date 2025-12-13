import { createWikiConfigSync } from './wiki-framework/vite.config.base.js';
import { loggerPlugin } from './wiki-framework/vite-plugin-logger.js';
import { githubProxyPlugin } from './wiki-framework/vite-plugin-github-proxy.js';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

/**
 * Parent wiki configuration
 * Extends the base wiki framework configuration
 */
export default createWikiConfigSync({
  // Your wiki's base URL (must match GitHub Pages repo name)
  base: '/my-wiki/',

  // Content location (for build-time @content alias - points to served content)
  contentPath: './public/content',

  // Explicitly use parent project's public directory
  publicDir: './public',

  // Additional plugins specific to your wiki
  plugins: [
    nodePolyfills({
      // Enable polyfills for Buffer and other Node.js globals
      // This is needed for gray-matter which is used in:
      // - PageViewerPage.jsx
      // - PageEditorPage.jsx
      // - SectionPage.jsx (removed but may be added back)
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Include protocol polyfills for buffer, process, etc.
      protocolImports: true,
    }),
    loggerPlugin(),
    githubProxyPlugin(),
  ],

  // You can override any Vite settings here
  server: {
    port: 5173,
  },
});
