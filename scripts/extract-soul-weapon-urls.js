/**
 * Browser Console Script to Extract Soul Weapon Image URLs
 *
 * HOW TO USE:
 * 1. Open https://en.namu.wiki/w/%EC%8A%AC%EB%A0%88%EC%9D%B4%EC%96%B4%20%ED%82%A4%EC%9A%B0%EA%B8%B0/%EC%86%8C%EC%9A%B8%EC%9B%A8%ED%8F%B0
 * 2. Open browser DevTools (F12)
 * 3. Go to Console tab
 * 4. Copy and paste this entire script
 * 5. Press Enter
 * 6. Copy the output and save it to soul-weapon-image-urls.json
 */

// Extract all soul weapon images from the table
const images = [];
const rows = document.querySelectorAll('.wiki-table tr');

rows.forEach((row, index) => {
  // Skip header row
  if (index === 0) return;

  // Get the first cell which should contain the weapon image
  const firstCell = row.querySelector('td:first-child');
  if (!firstCell) return;

  // Find the image in the first cell
  const img = firstCell.querySelector('img');
  if (!img) return;

  const src = img.getAttribute('src');
  if (src && src.includes('i.namu.wiki')) {
    // Convert protocol-relative URL to https
    const fullUrl = src.startsWith('//') ? 'https:' + src : src;
    images.push(fullUrl);
  }
});

// Output as JSON
console.log(JSON.stringify(images, null, 2));
console.log(`\nFound ${images.length} soul weapon images`);
