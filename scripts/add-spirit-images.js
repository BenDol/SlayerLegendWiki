const fs = require('fs');
const path = require('path');

// Read the JSON file
const filePath = path.join(__dirname, 'public', 'data', 'spirit-characters.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// Add image field to all sprites that don't have it
let addedCount = 0;
for (const spirit of data.spirits) {
  const spiritId = spirit.id;
  for (const spriteLevel of spirit.sprites) {
    const level = spriteLevel.level;
    // Only add if image field doesn't exist
    if (!spriteLevel.image) {
      spriteLevel.image = `/images/spirits/Spirit_${String(spiritId).padStart(3, '0')}_${level}_6.png`;
      addedCount++;
    }
  }
}

// Write back with proper formatting
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

console.log(`✅ Added ${addedCount} image fields to spirits!`);
