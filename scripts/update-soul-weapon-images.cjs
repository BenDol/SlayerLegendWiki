const fs = require('fs');
const path = require('path');

/**
 * Update soul-weapons.json to point to the new soul weapon images
 */

const SOUL_WEAPONS_JSON = path.join(__dirname, '..', 'public', 'data', 'soul-weapons.json');
const IMAGE_DIR = path.join(__dirname, '..', 'public', 'images', 'content', 'equipment', 'soul-weapons');

console.log('Reading soul-weapons.json...');
const soulWeapons = JSON.parse(fs.readFileSync(SOUL_WEAPONS_JSON, 'utf8'));

console.log(`Found ${soulWeapons.length} soul weapons\n`);

// Check which images exist and their extensions
const imageExtensions = {};
for (const weapon of soulWeapons) {
  const weaponId = weapon.id;
  const paddedId = String(weaponId).padStart(2, '0');

  // Check for .webp first
  const webpPath = path.join(IMAGE_DIR, `sword_2${paddedId}.webp`);
  const pngPath = path.join(IMAGE_DIR, `sword_2${paddedId}.png`);

  if (fs.existsSync(webpPath)) {
    imageExtensions[weaponId] = 'webp';
  } else if (fs.existsSync(pngPath)) {
    imageExtensions[weaponId] = 'png';
  } else {
    console.warn(`⚠ Warning: No image found for weapon ID ${weaponId}`);
    imageExtensions[weaponId] = 'webp'; // Default to webp
  }
}

// Update image paths
let updatedCount = 0;
for (const weapon of soulWeapons) {
  const weaponId = weapon.id;
  const paddedId = String(weaponId).padStart(2, '0');
  const ext = imageExtensions[weaponId];

  const oldPath = weapon.image;
  const newPath = `/images/content/equipment/soul-weapons/sword_2${paddedId}.${ext}`;

  if (oldPath !== newPath) {
    weapon.image = newPath;
    console.log(`✓ Updated ID ${weaponId} (${weapon.name}): ${ext.toUpperCase()}`);
    updatedCount++;
  }
}

// Write updated JSON
fs.writeFileSync(SOUL_WEAPONS_JSON, JSON.stringify(soulWeapons, null, 2), 'utf8');

console.log(`\n=== Update Summary ===`);
console.log(`Total weapons: ${soulWeapons.length}`);
console.log(`Updated: ${updatedCount}`);
console.log(`\nImage extensions:`);
const extCounts = {};
for (const ext of Object.values(imageExtensions)) {
  extCounts[ext] = (extCounts[ext] || 0) + 1;
}
console.log(`  .webp: ${extCounts.webp || 0}`);
console.log(`  .png: ${extCounts.png || 0}`);
