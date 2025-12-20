import { createWikiConfigSync } from './wiki-framework/vite.config.base.js';
import { loggerPlugin } from './wiki-framework/vite-plugin-logger.js';
import { githubProxyPlugin } from './wiki-framework/vite-plugin-github-proxy.js';
import { imageDbPlugin } from './wiki-framework/vite-plugin-image-db.js';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

/**
 * Parent wiki configuration
 * Extends the base wiki framework configuration
 */
export default createWikiConfigSync({
  // Your wiki's base URL (use '/' for custom domain or user site)
  base: '/',

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
    imageDbPlugin(),
  ],

  // You can override any Vite settings here
  server: {
    port: 5173,
    // SPA fallback: Always serve index.html for client-side routing
    historyApiFallback: true,
    watch: {
      // Exclude images and other static files from file watching
      // With 12,000+ images, watching them adds significant overhead
      ignored: [
        '**/public/images/**',
        '**/external/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
      ],
    },
    // Improve HMR performance
    hmr: {
      overlay: true,
    },
  },

  // Optimize dependency pre-bundling
  optimizeDeps: {
    exclude: [
      // Exclude framework from pre-bundling to avoid conflicts
      'wiki-framework',
    ],
    include: [
      // Pre-bundle common dependencies
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
    ],
  },

  // Build optimizations
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manual chunking for better caching
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('wiki-framework')) {
            return 'framework';
          }
        },
      },
    },
  },
});
