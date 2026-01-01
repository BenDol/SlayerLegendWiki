import { createWikiConfigSync } from './wiki-framework/vite.config.base.js';
import { loggerPlugin } from './wiki-framework/vite-plugin-logger.js';
import { githubProxyPlugin } from './wiki-framework/vite-plugin-github-proxy.js';
import { imageDbPlugin } from './wiki-framework/vite-plugin-image-db.js';
import { localCdnPlugin } from './vite-plugin-local-cdn.js';
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

  // Define environment variables for client
  define: {
    'import.meta.env.VITE_DEV_PLATFORM': JSON.stringify(process.env.VITE_DEV_PLATFORM || 'cloudflare'),
    'import.meta.env.VITE_PLATFORM': JSON.stringify(process.env.VITE_PLATFORM || 'cloudflare'),
    'import.meta.env.VITE_CF_PAGES': JSON.stringify(process.env.VITE_CF_PAGES || '0'),
  },

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
    localCdnPlugin(),
  ],

  // You can override any Vite settings here
  server: {
    port: 5173,
    // Allow Vite to serve files from wiki-framework submodule
    fs: {
      allow: ['..'],
    },
    // Proxy API calls to Wrangler
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
      '/.netlify/functions': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/.netlify\/functions/, '/api'),
      },
    },
    // SPA fallback: Always serve index.html for client-side routing
    historyApiFallback: true,
    watch: {
      // Exclude images and other static files from file watching
      // With 12,000+ images, watching them adds significant overhead
      ignored: [
        '**/public/images/**',
        '**/external/**',
        '**/node_modules/**',
        '!**/wiki-framework/**', // WATCH the framework submodule
        '**/dist/**',
        '**/.git/**',
        '**/.wrangler/**',
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
      // Exclude framework from pre-bundling to enable HMR
      'github-wiki-framework',
    ],
    include: [
      // Pre-bundle common dependencies
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
    ],
    // Force re-optimization on framework changes
    force: false,
  },

  // Clear cache on framework changes
  cacheDir: 'node_modules/.vite',

  // Build optimizations
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Suppress eval warnings from third-party libraries
      onwarn(warning, warn) {
        // Suppress gray-matter eval warning (safe in this context)
        if (warning.code === 'EVAL' && warning.id?.includes('gray-matter')) {
          return;
        }
        // Suppress dynamic/static import mixing warnings (framework internal)
        if (warning.code === 'MIXED_EXPORTS' ||
            (warning.message && warning.message.includes('dynamically imported'))) {
          return;
        }
        // Show all other warnings
        warn(warning);
      },
      output: {
        // Simplified chunking - let Vite handle most dependencies automatically
        // Manual chunking was causing module initialization order issues with React hooks
        // and CodeMirror's circular dependencies
        manualChunks(id) {
          // Keep framework separate for independent updates
          if (id.includes('node_modules/github-wiki-framework')) {
            return 'framework';
          }
          // Let Vite automatically handle all other vendor code splitting
          // This respects dependency order and prevents initialization errors
        },
      },
    },
  },
});
