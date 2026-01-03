import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, '../public/images/content');
const TARGET_DIR = path.resolve(__dirname, '../../cdn/game-assets/images');

/**
 * Migration script: Copy game assets from public/images/content to CDN repository
 *
 * This script copies all images from the wiki repo to the local CDN repository
 * so they can be pushed to the CDN and served via jsDelivr.
 */
async function migrateImages() {
  console.log('🚀 Migrating game assets to CDN...\n');

  // 1. Check if source directory exists
  try {
    await fs.access(SOURCE_DIR);
  } catch {
    console.error('❌ Source directory not found:', SOURCE_DIR);
    console.error('   Expected images at: public/images/content/');
    process.exit(1);
  }

  // 2. Check if CDN repo exists
  try {
    await fs.access(TARGET_DIR);
    console.log('✓ Found local CDN at:', TARGET_DIR);
  } catch {
    console.error('❌ CDN repository not found at:', TARGET_DIR);
    console.error('   Please clone the CDN repository first:');
    console.error('   git clone <cdn-repo-url> ../cdn');
    console.error('');
    console.error('   Or create the directory manually:');
    console.error('   mkdir -p ../cdn/game-assets/images');
    process.exit(1);
  }

  // 3. Copy all files recursively
  console.log('📦 Copying files...');
  await copyRecursive(SOURCE_DIR, TARGET_DIR);

  // 4. Count files
  const fileCount = await countFiles(TARGET_DIR);

  console.log('');
  console.log(`✅ Successfully migrated ${fileCount} files to CDN!`);
  console.log('');
  console.log('📋 Next steps:');
  console.log('');
  console.log('  1. Review the migrated files:');
  console.log('     cd ../cdn && git status');
  console.log('');
  console.log('  2. Add files to git:');
  console.log('     git add game-assets/images');
  console.log('');
  console.log('  3. Commit the changes:');
  console.log('     git commit -m "Add game assets (12,353 images)"');
  console.log('');
  console.log('  4. Push to GitHub:');
  console.log('     git push');
  console.log('');
  console.log('  5. Wait 1-2 minutes for jsDelivr cache to update');
  console.log('');
  console.log('  6. Test CDN serving:');
  console.log('     curl -I https://cdn.jsdelivr.net/gh/BenDol/SlayerLegendCDN@main/game-assets/images/icons/typeicon_fire_1.png');
  console.log('');
  console.log('  7. After verifying CDN works, remove images from wiki repo:');
  console.log('     git rm -r public/images/content');
  console.log('     git commit -m "Remove game assets (now on CDN)"');
  console.log('');
}

/**
 * Recursively copy directory contents
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
async function copyRecursive(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await fs.mkdir(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
      process.stdout.write('.');
    }
  }
}

/**
 * Recursively count files in directory
 * @param {string} dir - Directory path
 * @returns {Promise<number>} Number of files
 */
async function countFiles(dir) {
  let count = 0;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        count += await countFiles(path.join(dir, entry.name));
      } else {
        count++;
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
    return 0;
  }

  return count;
}

// Run migration
migrateImages().catch(error => {
  console.error('');
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
});
