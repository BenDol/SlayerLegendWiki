#!/usr/bin/env node

/**
 * Check git commit message to determine if tests should be skipped
 *
 * Looks for skip markers in the latest commit message:
 * - [skip tests]
 * - [skip-tests]
 * - [no tests]
 * - [tests skip]
 *
 * Usage:
 *   node scripts/checkCommitForTests.js && npm run test:ci
 *
 * Exit codes:
 *   0 - Run tests (no skip marker found)
 *   1 - Skip tests (skip marker found)
 */

import { execSync } from 'child_process';

try {
  // Get the latest commit message
  const commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim();

  console.log('Checking commit message for test skip markers...');
  console.log(`Commit message: ${commitMessage.split('\n')[0]}`);

  // Check for skip markers (case-insensitive)
  const skipMarkers = [
    /\[skip tests\]/i,
    /\[skip-tests\]/i,
    /\[no tests\]/i,
    /\[tests skip\]/i,
  ];

  const shouldSkip = skipMarkers.some(pattern => pattern.test(commitMessage));

  if (shouldSkip) {
    console.log('✅ Skip marker found - tests will be skipped');
    process.exit(1); // Exit with code 1 to skip tests
  } else {
    console.log('✅ No skip marker found - tests will run');
    process.exit(0); // Exit with code 0 to run tests
  }
} catch (error) {
  console.error('Error checking commit message:', error.message);
  console.log('⚠️  Could not read commit message - tests will run as a safety measure');
  process.exit(0); // Run tests on error as a safety measure
}
