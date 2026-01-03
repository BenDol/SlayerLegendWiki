import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'functions/_shared/**/*.js'
      ],
      exclude: [
        'functions/_shared/**/*.test.js',
        'functions/_shared/**/*.spec.js',
        'node_modules/**',
        'dist/**'
      ],
      all: true,
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100
    },
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000,
    hookTimeout: 30000
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './functions/_shared'),
      '@tests': path.resolve(__dirname, './tests')
    }
  }
});
