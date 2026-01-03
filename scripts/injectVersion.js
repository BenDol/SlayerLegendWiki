#!/usr/bin/env node
/**
 * Inject Git Version Script
 * Extracts the current git commit SHA and injects it into public/wiki-config.json
 * Should run during the build process
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_SOURCE = path.join(__dirname, '..', 'wiki-config.json');
const CONFIG_DEST = path.join(__dirname, '..', 'public', 'wiki-config.json');

/**
 * Get current git commit SHA
 * @returns {string} Commit SHA or 'unknown'
 */
function getGitCommitSHA() {
  try {
    // Get short SHA (7 characters)
    const sha = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
    }).trim();

    console.log(`[InjectVersion] Git commit SHA: ${sha}`);
    return sha;
  } catch (error) {
    console.warn('[InjectVersion] Failed to get git commit SHA, using "unknown"');
    return 'unknown';
  }
}

/**
 * Get git branch name
 * @returns {string} Branch name or 'unknown'
 */
function getGitBranch() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    console.log(`[InjectVersion] Git branch: ${branch}`);
    return branch;
  } catch (error) {
    console.warn('[InjectVersion] Failed to get git branch, using "unknown"');
    return 'unknown';
  }
}

/**
 * Get build timestamp
 * @returns {string} ISO timestamp
 */
function getBuildTimestamp() {
  return new Date().toISOString();
}

/**
 * Inject version into config
 */
function injectVersion() {
  try {
    console.log('[InjectVersion] Starting version injection...');

    // Check if source config exists
    if (!fs.existsSync(CONFIG_SOURCE)) {
      console.error(`[InjectVersion] Source config not found: ${CONFIG_SOURCE}`);
      process.exit(1);
    }

    // Read source config
    const configContent = fs.readFileSync(CONFIG_SOURCE, 'utf8');
    const config = JSON.parse(configContent);

    // Get version info
    const commitSHA = getGitCommitSHA();
    const branch = getGitBranch();
    const buildTime = getBuildTimestamp();

    // Inject version object
    config.version = {
      commit: commitSHA,
      branch: branch,
      buildTime: buildTime,
    };

    // Ensure public directory exists
    const publicDir = path.dirname(CONFIG_DEST);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Write to destination
    fs.writeFileSync(CONFIG_DEST, JSON.stringify(config, null, 2), 'utf8');

    console.log('[InjectVersion] ✓ Version injected successfully!');
    console.log(`  Commit: ${commitSHA}`);
    console.log(`  Branch: ${branch}`);
    console.log(`  Build Time: ${buildTime}`);
    console.log(`  Output: ${CONFIG_DEST}`);
  } catch (error) {
    console.error('[InjectVersion] Failed to inject version:', error.message);
    process.exit(1);
  }
}

// Always run when this script is executed
injectVersion();

export { injectVersion, getGitCommitSHA, getGitBranch, getBuildTimestamp };
