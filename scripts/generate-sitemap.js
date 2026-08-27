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
  'character': { priority: '0.9', changefreq: 'weekly' },
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
// Using browser routing for proper SEO
//
// Deliberately excluded: /highscore, /changelog, /donate. These are
// utility/dynamic screens with little publisher content (AdSense
// "screens without publisher-content" candidates); they are prerendered
// with a noindex meta tag and should not be advertised to crawlers.
const STATIC_ROUTES = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/skill-builder', priority: '0.9', changefreq: 'monthly' },
  { url: '/spirit-builder', priority: '0.9', changefreq: 'monthly' },
  { url: '/familiar-builder', priority: '0.9', changefreq: 'monthly' },
  { url: '/battle-loadouts', priority: '0.9', changefreq: 'monthly' },
  { url: '/soul-weapon-engraving', priority: '0.9', changefreq: 'monthly' },
  { url: '/skill-stone-builder', priority: '0.9', changefreq: 'monthly' },
  { url: '/creators', priority: '0.7', changefreq: 'weekly' },
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
 * Convert file path to URL for browser routing
 */
function pathToUrl(filePath) {
  // Remove .md extension and convert to URL format
  let url = filePath.replace(/\.md$/, '').replace(/\\/g, '/');

  // Handle index files (home.md, index.md)
  if (url.endsWith('/home') || url.endsWith('/index')) {
    url = url.replace(/\/(home|index)$/, '');
  }

  // Use clean URLs for browser routing
  return url === '' ? '/' : `/${url}`;
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
 * Normalize a frontmatter `date` value to sitemap lastmod format (YYYY-MM-DD).
 * Handles the formats present in content frontmatter: YAML dates parsed to
 * Date objects (`2026-08-16`, `2025-12-21T00:00:00.000Z`) and quoted strings
 * (`'2026-08-26'`). Returns null for missing/invalid values - the <lastmod>
 * tag is simply omitted then (it is optional per the sitemap protocol).
 */
function normalizeLastmod(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

/**
 * Parse frontmatter once per page: whether to index it, and its lastmod.
 *
 * lastmod comes from the frontmatter `date`, NOT the file mtime: mtimes are
 * checkout/clone times on CI and in fresh worktrees, which used to stamp
 * every page "modified today" on every deploy. Google only uses lastmod
 * when it's "consistently and verifiably accurate" and ignores it wholesale
 * otherwise (no penalty - just a lost crawl-scheduling signal, which is the
 * primary change signal since the sitemap ping endpoint was retired).
 * Frontmatter dates are accurate and deterministic (same output in every
 * environment), so the generated sitemap.xml also stops churning in git
 * after unrelated builds.
 */
function getPageMeta(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(content);

    const index =
      data.noindex !== true &&
      data.robots !== 'noindex' &&
      data.draft !== true;

    return { index, lastmod: normalizeLastmod(data.date) };
  } catch (error) {
    console.warn(`Warning: Could not parse ${filePath}:`, error.message);
    return { index: true, lastmod: null }; // Default to indexing if we can't parse
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
      // No lastmod for app routes: a build-date stamp isn't a real content
      // change and would erode Google's trust in the site's lastmod values;
      // the element is optional, so omit it.
      lastmod: null,
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
    // Root-level files (e.g. home.md, the custom homepage) are not section
    // pages - the homepage URL is already covered by STATIC_ROUTES.
    if (!file.path.includes(path.sep)) {
      console.log(`   ⏭️  Skipped: ${file.path} (root-level, no section route)`);
      skipped++;
      return;
    }

    const meta = getPageMeta(file.fullPath);
    if (!meta.index) {
      console.log(`   ⏭️  Skipped: ${file.path} (noindex/draft)`);
      skipped++;
      return;
    }

    const url = pathToUrl(file.path);
    const section = getSectionFromPath(file.path);
    const config = getSectionConfig(section);

    urls.push({
      loc: `${SITE_URL}${url}`,
      lastmod: meta.lastmod,
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
${url.lastmod ? `    <lastmod>${url.lastmod}</lastmod>\n` : ''}    <changefreq>${url.changefreq}</changefreq>
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

// Run only when executed directly (node scripts/generate-sitemap.js);
// importing the module (e.g. from tests) must not regenerate the sitemap.
const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectExecution) {
  try {
    generateSitemap();
  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    process.exit(1);
  }
}

// Pure helpers exported for unit tests.
export { normalizeLastmod, pathToUrl };
