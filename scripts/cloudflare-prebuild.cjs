#!/usr/bin/env node

/**
 * Cloudflare Pages Prebuild Script
 *
 * Automatically skips tests for preview deploys while running them for production.
 *
 * Behavior:
 * - Preview deploys (branch !== "main"): Skip tests automatically
 * - Production deploys (branch === "main"): Check commit message, then run tests
 * - Commit message markers still work: [skip tests], [skip-tests], [no tests], [tests skip]
 */

const { execSync } = require('child_process');

const branch = process.env.CF_PAGES_BRANCH;
const isProduction = branch === 'main' || !branch; // Treat unknown as production (safe default)

console.log(`\n📦 Cloudflare Prebuild - Branch: ${branch || 'unknown'}\n`);

// ALWAYS run prebuild steps (config copy, cache check, version injection, search index, sitemap)
console.log('🔧 Running prebuild steps...\n');
try {
  execSync('node scripts/copyConfig.js', { stdio: 'inherit' });
  execSync('node scripts/checkCommitForCachePurge.js', { stdio: 'inherit' });
  execSync('node scripts/injectVersion.js', { stdio: 'inherit' });
  execSync('node scripts/buildSearchIndex.js', { stdio: 'inherit' });
  execSync('node scripts/generate-sitemap.js', { stdio: 'inherit' });
  console.log('\n✅ Prebuild steps complete!\n');
} catch (error) {
  console.error('\n❌ Prebuild steps failed!\n');
  process.exit(error.status || 1);
}

if (!isProduction) {
  console.log(`✅ Preview deploy detected (branch: ${branch})`);
  console.log(`⏭️  Skipping tests automatically\n`);
  process.exit(0);
}

console.log(`🚀 Production deploy detected`);
console.log(`🔍 Checking commit message for skip markers...\n`);

try {
  // Check commit message for skip markers
  execSync('node scripts/checkCommitForTests.js', { stdio: 'inherit' });

  // If checkCommitForTests exits 0, commit message does NOT contain skip marker
  console.log(`\n🧪 Running tests...\n`);
  execSync('npm run test:ci', { stdio: 'inherit' });

  console.log(`\n✅ All tests passed!\n`);
} catch (error) {
  if (error.status === 1) {
    // checkCommitForTests exited with 1 (skip marker found)
    console.log(`\n⏭️  Tests skipped via commit message marker\n`);
  } else {
    // Test failure or other error
    console.error(`\n❌ Tests failed!\n`);
    process.exit(error.status || 1);
  }
}
