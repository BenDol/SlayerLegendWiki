import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Copy wiki-config.json from root to multiple locations
 * This ensures the source of truth stays in root but the runtime version is accessible
 *
 * Destinations:
 * - public/wiki-config.json: Client-side access
 * - functions/_shared/wiki-config.json: Cloudflare Workers access (can't read from filesystem)
 */

const sourceConfig = path.join(__dirname, '..', 'wiki-config.json');
const destinations = [
  path.join(__dirname, '..', 'public', 'wiki-config.json'),
  path.join(__dirname, '..', 'functions', '_shared', 'wiki-config.json')
];

try {
  console.log('Copying wiki-config.json to multiple destinations...');

  if (!fs.existsSync(sourceConfig)) {
    console.error('❌ Source config not found:', sourceConfig);
    process.exit(1);
  }

  let successCount = 0;
  for (const dest of destinations) {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(sourceConfig, dest);
      console.log(`✓ Copied to: ${path.relative(path.join(__dirname, '..'), dest)}`);
      successCount++;
    } catch (err) {
      console.error(`❌ Failed to copy to ${dest}:`, err.message);
    }
  }

  if (successCount === destinations.length) {
    console.log(`✓ Wiki config copied successfully to ${successCount} locations!`);
  } else {
    console.error(`⚠️  Only ${successCount}/${destinations.length} copies succeeded`);
    process.exit(1);
  }
} catch (err) {
  console.error('Failed to copy wiki config:', err);
  process.exit(1);
}
