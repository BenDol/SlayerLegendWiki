import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceConfig = path.join(__dirname, '..', 'wiki-config.json');

console.log('👀 Watching wiki-config.json for changes...\n');

// Helper function to run copyConfig.js
function copyConfig() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/copyConfig.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`copyConfig.js exited with code ${code}`));
      }
    });
  });
}

// Initial copy and start watching
(async () => {
  try {
    await copyConfig();
    console.log('✓ Initial config copied to all locations\n');
  } catch (err) {
    console.error('Failed to copy config:', err);
    process.exit(1);
  }

  // Watch for changes
  fs.watch(sourceConfig, async (eventType) => {
    if (eventType === 'change') {
      try {
        await copyConfig();
        const timestamp = new Date().toLocaleTimeString();
        console.log(`✓ [${timestamp}] Config updated - refresh your browser`);
      } catch (err) {
        console.error('Failed to copy config:', err);
      }
    }
  });
})();
