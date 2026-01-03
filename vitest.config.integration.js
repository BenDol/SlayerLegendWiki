import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.js'],
    setupFiles: ['./tests/setup.js'],
    testTimeout: 60000, // Longer timeout for real API calls
    hookTimeout: 60000,
    // Don't run integration tests in parallel to avoid rate limiting
    maxConcurrency: 1,
    // Vitest 4: poolOptions.threads.singleThread moved to top level
    pool: 'threads',
    singleThread: true
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './functions/_shared'),
      '@tests': path.resolve(__dirname, './tests')
    }
  }
});
