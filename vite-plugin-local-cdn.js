import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_CDN_PATH = path.resolve(__dirname, '../cdn');

/**
 * Vite plugin to serve game assets from local CDN during development
 *
 * In dev mode, intercepts requests and serves them from ../cdn if available:
 * - /images/content/* -> ../cdn/game-assets/images/*
 * - /data/image-index.json -> ../cdn/game-assets/images/image-index.json
 *
 * This allows developers to test CDN integration without network requests.
 */
export function localCdnPlugin() {
  return {
    name: 'local-cdn-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let localPath = null;

        // Intercept /data/image-index.json
        if (req.url === '/data/image-index.json') {
          localPath = path.join(LOCAL_CDN_PATH, 'game-assets', 'images', 'image-index.json');

          if (fs.existsSync(localPath)) {
            console.log('[local-cdn] Serving image-index.json from local CDN repository');
            res.setHeader('X-Served-From', 'local-cdn');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-cache'); // Disable caching for dev

            const fileContent = fs.readFileSync(localPath, 'utf-8');
            return res.end(fileContent);
          }
        }

        // Intercept /images/content/* requests
        if (req.url.startsWith('/images/content/')) {
          const relativePath = req.url.replace('/images/content/', '');
          // Decode URL to handle spaces and special characters in filenames
          const decodedPath = decodeURIComponent(relativePath);
          localPath = path.join(LOCAL_CDN_PATH, 'game-assets', 'images', decodedPath);

          // Check if file exists in local CDN
          if (fs.existsSync(localPath)) {
            // Serve from local CDN
            res.setHeader('X-Served-From', 'local-cdn');
            res.setHeader('Content-Type', getContentType(localPath));
            res.setHeader('Cache-Control', 'no-cache'); // Disable caching for dev

            const fileContent = fs.readFileSync(localPath);
            return res.end(fileContent);
          }

          // File not found in local CDN, continue to next middleware
          // (will either serve from public/ or return 404)
        }

        next();
      });
    }
  };
}

/**
 * Get MIME content type based on file extension
 * @param {string} filePath - Path to the file
 * @returns {string} MIME type
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp'
  };
  return types[ext] || 'application/octet-stream';
}
