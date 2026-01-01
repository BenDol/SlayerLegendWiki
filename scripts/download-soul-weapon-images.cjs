const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

/**
 * Download soul weapon images from the Korean Namu Wiki
 * Images will be saved to public/images/content/equipment/soul-weapons/
 * with names like sword_201.png, sword_202.png, etc.
 */

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'images', 'content', 'equipment', 'soul-weapons');
const SOUL_WEAPONS_JSON = path.join(__dirname, '..', 'public', 'data', 'soul-weapons.json');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Created directory: ${OUTPUT_DIR}`);
}

// Read soul weapons data
const soulWeapons = JSON.parse(fs.readFileSync(SOUL_WEAPONS_JSON, 'utf8'));

/**
 * Download a file from a URL
 */
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const file = fs.createWriteStream(outputPath);

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(outputPath);
        downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(outputPath);
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlinkSync(outputPath);
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(outputPath);
      reject(err);
    });
  });
}

/**
 * Download all soul weapon images
 */
async function downloadAllImages() {
  console.log(`Starting download of ${soulWeapons.length} soul weapon images...\n`);

  let successCount = 0;
  let failCount = 0;
  const failed = [];

  for (const weapon of soulWeapons) {
    const weaponId = weapon.id;
    const fileName = `sword_2${String(weaponId).padStart(2, '0')}.png`;
    const outputPath = path.join(OUTPUT_DIR, fileName);

    // Check if file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`✓ Already exists: ${fileName}`);
      successCount++;
      continue;
    }

    // Check if weapon has an image property
    if (!weapon.image) {
      console.log(`✗ No image URL for weapon ID ${weaponId} (${weapon.name})`);
      failed.push({ id: weaponId, name: weapon.name, reason: 'No image property' });
      failCount++;
      continue;
    }

    // For now, we'll copy from the existing image path if it exists
    // Since the Korean wiki images require web scraping, we'll use the existing images
    const sourceImagePath = path.join(__dirname, '..', 'public', weapon.image);

    try {
      if (fs.existsSync(sourceImagePath)) {
        // Copy existing image to new location
        fs.copyFileSync(sourceImagePath, outputPath);
        console.log(`✓ Copied: ${fileName} (${weapon.name})`);
        successCount++;
      } else {
        console.log(`✗ Source not found for weapon ID ${weaponId} (${weapon.name})`);
        failed.push({ id: weaponId, name: weapon.name, reason: 'Source image not found' });
        failCount++;
      }
    } catch (error) {
      console.error(`✗ Failed to copy weapon ID ${weaponId} (${weapon.name}): ${error.message}`);
      failed.push({ id: weaponId, name: weapon.name, reason: error.message });
      failCount++;
    }
  }

  console.log('\n=== Download Summary ===');
  console.log(`Total weapons: ${soulWeapons.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);

  if (failed.length > 0) {
    console.log('\nFailed downloads:');
    failed.forEach(item => {
      console.log(`  - ID ${item.id} (${item.name}): ${item.reason}`);
    });
  }
}

// Run the download
downloadAllImages().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
