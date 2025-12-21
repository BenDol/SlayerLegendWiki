import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SITE_URL = 'https://slayerlegend.wiki';
const CONTENT_DIR = path.join(__dirname, '../public/content');
const OUTPUT_FILE = path.join(__dirname, '../public/sitemap.xml');

// Priority and change frequency by section type
const SECTION_CONFIG = {
  'getting-started': { priority: '1.0', changefreq: 'weekly' },
  'characters': { priority: '0.9', changefreq: 'weekly' },
  'equipment': { priority: '0.9', changefreq: 'weekly' },
  'skills': { priority: '0.9', changefreq: 'weekly' },
  'companions': { priority: '0.8', changefreq: 'weekly' },
  'spirits': { priority: '0.8', changefreq: 'weekly' },
  'stages': { priority: '0.8', changefreq: 'weekly' },
  'progression': { priority: '0.8', changefreq: 'weekly' },
  'resources': { priority: '0.7', changefreq: 'monthly' },
  'guides': { priority: '0.9', changefreq: 'monthly' },
  'database': { priority: '0.6', changefreq: 'monthly' },
  'meta': { priority: '0.5', changefreq: 'monthly' },
  'default': { priority: '0.7', changefreq: 'monthly' }
};

// Static routes (tools, pages)
const STATIC_ROUTES = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/skill-builder', priority: '0.9', changefreq: 'monthly' },
  { url: '/spirit-builder', priority: '0.9', changefreq: 'monthly' },
  { url: '/battle-loadouts', priority: '0.9', changefreq: 'monthly' },
  { url: '/soul-weapon-engraving', priority: '0.9', changefreq: 'monthly' },
  { url: '/my-collections', priority: '0.7', changefreq: 'monthly' },
  { url: '/my-spirits', priority: '0.7', changefreq: 'monthly' },
  { url: '/highscore', priority: '0.8', changefreq: 'daily' },
  { url: '/donate', priority: '0.8', changefreq: 'monthly' },
];

/**
 * Recursively get all markdown files in a directory
 */
function getMdFiles(dir, fileList = [], baseDir = dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getMdFiles(filePath, fileList, baseDir);
    } else if (file.endsWith('.md')) {
      // Get relative path from content directory
      const relativePath = path.relative(baseDir, filePath);
      fileList.push({
        path: relativePath,
        fullPath: filePath,
        modified: stat.mtime
      });
    }
  });

  return fileList;
}

/**
 * Convert file path to URL
 */
function pathToUrl(filePath) {
  // Remove .md extension and convert to URL format
  let url = filePath.replace(/\.md$/, '').replace(/\\/g, '/');

  // Handle index files (home.md, index.md)
  if (url.endsWith('/home') || url.endsWith('/index')) {
    url = url.replace(/\/(home|index)$/, '');
  }

  return `/${url}`;
}

/**
 * Get section from file path
 */
function getSectionFromPath(filePath) {
  const parts = filePath.split(path.sep);
  return parts[0] || 'default';
}

/**
 * Get priority and changefreq for a section
 */
function getSectionConfig(section) {
  return SECTION_CONFIG[section] || SECTION_CONFIG.default;
}

/**
 * Parse frontmatter to check if page should be indexed
 */
function shouldIndexPage(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(content);

    // Skip if explicitly marked as noindex
    if (data.noindex === true || data.robots === 'noindex') {
      return false;
    }

    // Skip draft pages in production
    if (data.draft === true) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`Warning: Could not parse ${filePath}:`, error.message);
    return true; // Default to indexing if we can't parse
  }
}

/**
 * Generate sitemap XML
 */
function generateSitemap() {
  console.log('🗺️  Generating sitemap...\n');

  const urls = [];

  // Add static routes
  console.log('📄 Adding static routes...');
  STATIC_ROUTES.forEach(route => {
    urls.push({
      loc: `${SITE_URL}${route.url}`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: route.changefreq,
      priority: route.priority
    });
    console.log(`   ✓ ${route.url}`);
  });

  // Get all markdown files
  console.log('\n📝 Scanning content directory...');
  const mdFiles = getMdFiles(CONTENT_DIR);
  console.log(`   Found ${mdFiles.length} markdown files\n`);

  // Process each markdown file
  console.log('🔍 Processing markdown files...');
  let indexed = 0;
  let skipped = 0;

  mdFiles.forEach(file => {
    if (!shouldIndexPage(file.fullPath)) {
      console.log(`   ⏭️  Skipped: ${file.path} (noindex/draft)`);
      skipped++;
      return;
    }

    const url = pathToUrl(file.path);
    const section = getSectionFromPath(file.path);
    const config = getSectionConfig(section);

    urls.push({
      loc: `${SITE_URL}${url}`,
      lastmod: file.modified.toISOString().split('T')[0],
      changefreq: config.changefreq,
      priority: config.priority
    });

    console.log(`   ✓ ${url} (${section})`);
    indexed++;
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Total URLs: ${urls.length}`);
  console.log(`   Static routes: ${STATIC_ROUTES.length}`);
  console.log(`   Content pages: ${indexed}`);
  console.log(`   Skipped: ${skipped}`);

  // Generate XML
  console.log('\n📝 Generating XML...');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  // Write sitemap
  fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');
  console.log(`\n✅ Sitemap generated: ${OUTPUT_FILE}`);
  console.log(`   File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
  console.log(`\n🌐 Submit your sitemap to search engines:`);
  console.log(`   Google: https://search.google.com/search-console`);
  console.log(`   Bing: https://www.bing.com/webmasters`);
  console.log(`   Sitemap URL: ${SITE_URL}/sitemap.xml`);
}

// Run the generator
try {
  generateSitemap();
} catch (error) {
  console.error('❌ Error generating sitemap:', error);
  process.exit(1);
}
