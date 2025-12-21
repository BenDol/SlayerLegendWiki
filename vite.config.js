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
        '!**/node_modules/github-wiki-framework/**', // BUT watch the framework package
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
  },

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
        // Manual chunking for better caching and smaller chunks
        manualChunks(id) {
          // Framework chunk
          if (id.includes('node_modules/github-wiki-framework')) {
            return 'framework';
          }

          // React core libraries (changes infrequently, cache separately)
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/scheduler')) {
            return 'react-vendor';
          }

          // React Router (changes independently of React)
          if (id.includes('node_modules/react-router-dom') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/@remix-run')) {
            return 'react-router';
          }

          // Octokit (large GitHub API library)
          if (id.includes('node_modules/octokit') ||
              id.includes('node_modules/@octokit')) {
            return 'octokit';
          }

          // CodeMirror (code editor - very large)
          // Keep CodeMirror together with its dependencies to avoid initialization issues
          if (id.includes('node_modules/@codemirror') ||
              id.includes('node_modules/@uiw/react-codemirror') ||
              id.includes('node_modules/@lezer')) {
            return 'codemirror';
          }

          // Search library (fuse.js - large)
          if (id.includes('node_modules/fuse.js')) {
            return 'search';
          }

          // Markdown processing libraries (large, rarely change)
          if (id.includes('node_modules/react-markdown') ||
              id.includes('node_modules/remark-') ||
              id.includes('node_modules/rehype-') ||
              id.includes('node_modules/unified') ||
              id.includes('node_modules/micromark') ||
              id.includes('node_modules/mdast') ||
              id.includes('node_modules/hast') ||
              id.includes('node_modules/unist') ||
              id.includes('node_modules/vfile') ||
              id.includes('node_modules/estree')) {
            return 'markdown';
          }

          // Lucide icons (many icons, large bundle)
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }

          // Date utilities
          if (id.includes('node_modules/date-fns')) {
            return 'date-utils';
          }

          // Node polyfills (only loaded when needed)
          if (id.includes('node_modules/buffer') ||
              id.includes('node_modules/process') ||
              id.includes('node_modules/gray-matter')) {
            return 'node-polyfills';
          }

          // State management
          if (id.includes('node_modules/zustand') ||
              id.includes('node_modules/immer')) {
            return 'state';
          }

          // Other utilities (profanity filter, etc.)
          if (id.includes('node_modules/leo-profanity') ||
              id.includes('node_modules/clsx')) {
            return 'utils';
          }

          // Other vendor code (should be small now)
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
});
