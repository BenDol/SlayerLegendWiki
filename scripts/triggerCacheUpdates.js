#!/usr/bin/env node

/**
 * Manual Cache Update Trigger Script
 *
 * This script manually triggers the GitHub Actions workflows to update
 * the highscore and prestige caches without waiting for the scheduled runs.
 *
 * Usage:
 *   node scripts/triggerCacheUpdates.js [highscore|prestige|both]
 *
 * Examples:
 *   node scripts/triggerCacheUpdates.js both      # Trigger both workflows
 *   node scripts/triggerCacheUpdates.js highscore # Trigger only highscore
 *   node scripts/triggerCacheUpdates.js prestige  # Trigger only prestige
 *
 * Requirements:
 *   - GITHUB_TOKEN environment variable with repo scope
 *   - Or run from GitHub Actions (uses GITHUB_TOKEN automatically)
 */

const https = require('https');

// Configuration
const owner = process.env.VITE_WIKI_REPO_OWNER || 'BenDol';
const repo = process.env.VITE_WIKI_REPO_NAME || 'SlayerLegendWiki';
const token = process.env.GITHUB_TOKEN;

// Workflow file names
const WORKFLOWS = {
  highscore: 'update-highscore-cache.yml',
  prestige: 'update-prestige-cache.yml',
};

/**
 * Trigger a GitHub Actions workflow via workflow_dispatch
 */
async function triggerWorkflow(workflowFile) {
  return new Promise((resolve, reject) => {
    if (!token) {
      reject(new Error('GITHUB_TOKEN environment variable not set'));
      return;
    }

    const data = JSON.stringify({
      ref: 'main', // Branch to run the workflow on
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      method: 'POST',
      headers: {
        'User-Agent': 'Wiki-Cache-Trigger-Script',
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 204) {
          resolve({ success: true, workflow: workflowFile });
        } else {
          reject(new Error(`Failed to trigger ${workflowFile}: ${res.statusCode} ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const target = args[0] || 'both';

  console.log('🚀 Manual Cache Update Trigger\n');
  console.log(`Repository: ${owner}/${repo}`);
  console.log(`Target: ${target}\n`);

  if (!token) {
    console.error('❌ Error: GITHUB_TOKEN environment variable not set');
    console.error('\nTo use this script, you need a GitHub Personal Access Token with repo scope.');
    console.error('Set it as an environment variable:');
    console.error('  export GITHUB_TOKEN=your_token_here');
    console.error('\nOr trigger workflows manually via GitHub UI:');
    console.error('  https://github.com/' + owner + '/' + repo + '/actions');
    process.exit(1);
  }

  const workflows = [];

  if (target === 'both' || target === 'highscore') {
    workflows.push({ name: 'Highscore Cache', file: WORKFLOWS.highscore });
  }

  if (target === 'both' || target === 'prestige') {
    workflows.push({ name: 'Prestige Cache', file: WORKFLOWS.prestige });
  }

  if (workflows.length === 0) {
    console.error('❌ Error: Invalid target. Use "highscore", "prestige", or "both"');
    process.exit(1);
  }

  console.log('Triggering workflows...\n');

  for (const workflow of workflows) {
    try {
      console.log(`⏳ Triggering ${workflow.name}...`);
      await triggerWorkflow(workflow.file);
      console.log(`✅ ${workflow.name} workflow triggered successfully!`);
    } catch (error) {
      console.error(`❌ Failed to trigger ${workflow.name}:`, error.message);
    }
  }

  console.log('\n✨ Done!');
  console.log('\nCheck workflow status at:');
  console.log(`https://github.com/${owner}/${repo}/actions`);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { triggerWorkflow };
