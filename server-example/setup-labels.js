#!/usr/bin/env node

/**
 * Label Setup Utility
 * Creates all wiki-related labels in your repository
 *
 * Usage:
 *   node setup-labels.js
 *
 * Prerequisites:
 *   - Set GITHUB_TOKEN environment variable
 *   - Set REPO_OWNER and REPO_NAME environment variables
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.BOT_GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
  console.error('❌ Error: Missing required environment variables');
  console.error('   Required: GITHUB_TOKEN, REPO_OWNER, REPO_NAME');
  console.error('   Set them in .env file or environment');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// All wiki labels
const WIKI_LABELS = [
  // Type labels
  {
    name: 'wiki:anonymous-edit',
    description: 'Anonymous wiki edit request - processed automatically',
    color: 'fbca04',
  },
  {
    name: 'wiki:comment',
    description: 'Wiki page comment or discussion',
    color: '0075ca',
  },
  {
    name: 'wiki:edit',
    description: 'Wiki edit or content contribution',
    color: '7057ff',
  },

  // Section labels
  {
    name: 'section:getting-started',
    description: 'Getting Started section',
    color: 'c2e0c6',
  },
  {
    name: 'section:characters',
    description: 'Characters section',
    color: 'f9d0c4',
  },
  {
    name: 'section:equipment',
    description: 'Equipment section',
    color: 'd4c5f9',
  },
  {
    name: 'section:companions',
    description: 'Companions section',
    color: 'fef2c0',
  },
  {
    name: 'section:skills',
    description: 'Skills section',
    color: 'bfdadc',
  },
  {
    name: 'section:content',
    description: 'Content section',
    color: 'c5def5',
  },
  {
    name: 'section:progression',
    description: 'Progression section',
    color: 'f9c5d1',
  },
  {
    name: 'section:resources',
    description: 'Resources section',
    color: 'd1f5c5',
  },
  {
    name: 'section:guides',
    description: 'Guides section',
    color: 'e6c5f5',
  },
  {
    name: 'section:database',
    description: 'Database section',
    color: 'c5e5f5',
  },
  {
    name: 'section:tools',
    description: 'Tools section',
    color: 'f5d9c5',
  },

  // Status labels
  {
    name: 'status:processing',
    description: 'Currently being processed by automation',
    color: 'fbca04',
  },
  {
    name: 'status:completed',
    description: 'Successfully processed and completed',
    color: '0e8a16',
  },
  {
    name: 'status:failed',
    description: 'Processing failed - needs attention',
    color: 'd73a4a',
  },

  // Additional labels
  {
    name: 'anonymous',
    description: 'Anonymous contribution (no user attribution)',
    color: '6f42c1',
  },
  {
    name: 'documentation',
    description: 'Documentation updates or improvements',
    color: '0075ca',
  },
  {
    name: 'automated',
    description: 'Created and managed by automation',
    color: 'e99695',
  },
];

async function labelExists(name) {
  try {
    await octokit.rest.issues.getLabel({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      name: name,
    });
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}

async function createLabel(label) {
  try {
    await octokit.rest.issues.createLabel({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      name: label.name,
      description: label.description,
      color: label.color,
    });
    return { success: true, action: 'created' };
  } catch (error) {
    if (error.status === 422) {
      // Label already exists
      return { success: true, action: 'exists' };
    }
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  Wiki Label Setup Utility');
  console.log('='.repeat(70));
  console.log(`  Repository: ${REPO_OWNER}/${REPO_NAME}`);
  console.log(`  Total labels: ${WIKI_LABELS.length}`);
  console.log('='.repeat(70) + '\n');

  let created = 0;
  let existing = 0;
  let failed = 0;

  for (const label of WIKI_LABELS) {
    process.stdout.write(`  Processing: ${label.name.padEnd(30)} ... `);

    try {
      const result = await createLabel(label);

      if (result.success) {
        if (result.action === 'created') {
          console.log('✅ Created');
          created++;
        } else {
          console.log('✓ Exists');
          existing++;
        }
      } else {
        console.log(`❌ Failed: ${result.error}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(70));
  console.log('  Summary');
  console.log('='.repeat(70));
  console.log(`  ✅ Created:        ${created}`);
  console.log(`  ✓  Already existed: ${existing}`);
  console.log(`  ❌ Failed:         ${failed}`);
  console.log(`  📊 Total:          ${WIKI_LABELS.length}`);
  console.log('='.repeat(70));

  if (failed === 0) {
    console.log('\n  🎉 Success! All labels are set up correctly.');
    console.log('\n  You can now use:');
    console.log('    - Issue filters: is:issue label:wiki:anonymous-edit');
    console.log('    - Section filters: is:issue label:section:equipment');
    console.log('    - Status filters: is:issue label:status:processing');
  } else {
    console.log('\n  ⚠️  Some labels failed to create. Check the errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
