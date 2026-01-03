import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build search index from markdown files
 * Creates a JSON file with all page content for client-side search
 */

// Use parent project's public directory
const contentDir = path.join(__dirname, '..', 'public', 'content');
const outputFile = path.join(__dirname, '..', 'public', 'search-index.json');

// Recursively find all markdown files
function findMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Extract text content from markdown (remove code blocks and other noise)
function extractTextContent(markdown) {
  return markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`[^`]+`/g, '')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
    // Remove headings markers but keep text
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    // Remove multiple spaces and newlines
    .replace(/\s+/g, ' ')
    .trim();
}

// Build the search index
function buildSearchIndex() {
  console.log('Building search index...');

  if (!fs.existsSync(contentDir)) {
    console.error(`Content directory not found: ${contentDir}`);
    console.log('Skipping search index generation.');
    return;
  }

  const markdownFiles = findMarkdownFiles(contentDir);
  console.log(`Found ${markdownFiles.length} markdown files`);

  const searchIndex = [];

  markdownFiles.forEach((filePath) => {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data: frontmatter, content } = matter(fileContent);

      // Get relative path from content directory
      const relativePath = path.relative(contentDir, filePath);
      const pathParts = relativePath.split(path.sep);

      // Extract section and page ID
      const section = pathParts[0];
      const fileName = pathParts[pathParts.length - 1];
      const pageId = fileName.replace('.md', '');

      // Generate URL
      const url = `/${section}/${pageId}`;

      // Extract searchable text
      const textContent = extractTextContent(content);

      // Create search entry
      const entry = {
        id: `${section}/${pageId}`,
        title: frontmatter.title || pageId,
        description: frontmatter.description || '',
        content: textContent.substring(0, 500), // Limit content length
        section,
        sectionTitle: section.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        pageId,
        url,
        tags: frontmatter.tags || [],
        category: frontmatter.category || '',
        date: frontmatter.date || '',
        order: frontmatter.order ?? 0,
      };

      searchIndex.push(entry);
    } catch (err) {
      console.error(`Error processing ${filePath}:`, err.message);
    }
  });

  // Write search index to file
  fs.writeFileSync(outputFile, JSON.stringify(searchIndex, null, 2));

  console.log(`✓ Search index built successfully!`);
  console.log(`  - ${searchIndex.length} pages indexed`);
  console.log(`  - Output: ${outputFile}`);
}

// Run the build
try {
  buildSearchIndex();
} catch (err) {
  console.error('Failed to build search index:', err);
  process.exit(1);
}
