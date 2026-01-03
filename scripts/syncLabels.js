/**
 * GitHub Label Synchronization Script
 *
 * Ensures all required labels exist in the repository by:
 * 1. Reading labels from .github/labels.json
 * 2. Checking which labels exist in the repository
 * 3. Creating missing labels
 * 4. Updating existing labels if their color/description has changed
 *
 * This prevents issues where regular users cannot create labels
 * when performing actions like commenting for the first time.
 */

import { Octokit } from '@octokit/rest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Octokit with GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Parse repository from environment (format: "owner/repo")
const [owner, repo] = process.env.REPOSITORY.split('/');

/**
 * Read labels configuration from JSON file
 * Labels are now stored in the wiki-framework submodule
 */
function readLabelsConfig() {
  const configPath = join(__dirname, '..', 'wiki-framework', '.github', 'labels.json');
  const configContent = readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent);
}

/**
 * Get all existing labels in the repository
 * Uses pagination to fetch ALL labels, not just the first 100
 */
async function getExistingLabels() {
  console.log('📋 Fetching existing labels...');

  try {
    // Use pagination to fetch all labels
    const allLabels = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data } = await octokit.rest.issues.listLabelsForRepo({
        owner,
        repo,
        per_page: 100,
        page
      });

      allLabels.push(...data);

      // If we got less than 100 labels, we've reached the end
      hasMore = data.length === 100;
      page++;
    }

    console.log(`   Found ${allLabels.length} existing labels`);

    // Convert to map for easy lookup (case-insensitive)
    const labelMap = new Map();
    allLabels.forEach(label => {
      // Store with lowercase key for case-insensitive lookup
      labelMap.set(label.name.toLowerCase(), {
        originalName: label.name,
        color: label.color,
        description: label.description || ''
      });
    });

    return labelMap;
  } catch (error) {
    console.error('❌ Failed to fetch existing labels:', error.message);
    throw error;
  }
}

/**
 * Create a new label
 */
async function createLabel(label) {
  try {
    await octokit.rest.issues.createLabel({
      owner,
      repo,
      name: label.name,
      description: label.description,
      color: label.color
    });

    console.log(`   ✅ Created: ${label.name}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to create "${label.name}":`, error.message);
    return false;
  }
}

/**
 * Update an existing label
 */
async function updateLabel(label) {
  try {
    await octokit.rest.issues.updateLabel({
      owner,
      repo,
      name: label.name,
      description: label.description,
      color: label.color
    });

    console.log(`   🔄 Updated: ${label.name}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to update "${label.name}":`, error.message);
    return false;
  }
}

/**
 * Check if label needs updating
 */
function needsUpdate(configLabel, existingLabel) {
  return (
    configLabel.color !== existingLabel.color ||
    configLabel.description !== existingLabel.description
  );
}

/**
 * Main synchronization function
 */
async function syncLabels() {
  console.log('\n' + '='.repeat(60));
  console.log('🏷️  GitHub Label Synchronization');
  console.log('='.repeat(60) + '\n');

  console.log(`📦 Repository: ${owner}/${repo}\n`);

  // Read configuration
  const config = readLabelsConfig();
  const labelsToSync = config.labels;

  console.log(`📝 Labels in config: ${labelsToSync.length}\n`);

  // Get existing labels
  const existingLabels = await getExistingLabels();

  // Track statistics
  const stats = {
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0
  };

  // Process each label
  console.log('\n🔄 Processing labels...\n');

  for (const label of labelsToSync) {
    // Use lowercase for case-insensitive lookup
    const existing = existingLabels.get(label.name.toLowerCase());

    if (!existing) {
      // Label doesn't exist - create it
      const success = await createLabel(label);
      if (success) {
        stats.created++;
      } else {
        stats.failed++;
      }
    } else if (needsUpdate(label, existing)) {
      // Label exists but needs updating
      const success = await updateLabel(label);
      if (success) {
        stats.updated++;
      } else {
        stats.failed++;
      }
    } else {
      // Label is up to date
      stats.unchanged++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`✅ Created:   ${stats.created}`);
  console.log(`🔄 Updated:   ${stats.updated}`);
  console.log(`⚪ Unchanged: ${stats.unchanged}`);
  console.log(`❌ Failed:    ${stats.failed}`);
  console.log(`📝 Total:     ${labelsToSync.length}`);
  console.log('='.repeat(60) + '\n');

  // Exit with error code if any failed
  if (stats.failed > 0) {
    console.error('⚠️  Some labels failed to sync. Please check the errors above.');
    process.exit(1);
  }

  console.log('✅ Label synchronization completed successfully!\n');
}

// Run the sync
syncLabels().catch(error => {
  console.error('\n❌ Fatal error during label sync:', error);
  process.exit(1);
});
