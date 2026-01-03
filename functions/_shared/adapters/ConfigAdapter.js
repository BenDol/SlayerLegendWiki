/**
 * Config Adapter
 *
 * Abstracts configuration loading between Netlify and Cloudflare
 * Netlify can read from filesystem, Cloudflare uses embedded defaults + env overrides
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Configuration Adapter
 * Abstracts config loading differences between platforms
 */
export class ConfigAdapter {
  constructor(platform) {
    this.platform = platform;
    this._configCache = null;
  }

  /**
   * Get wiki configuration
   * @returns {Object} Wiki configuration object
   */
  getWikiConfig() {
    if (this._configCache) {
      return this._configCache;
    }

    // Try loading from filesystem first (works on Netlify and Cloudflare Dev with Wrangler)
    this._configCache = this._loadFromFilesystem();

    // If filesystem load failed, use defaults (Cloudflare Workers production)
    if (!this._configCache) {
      this._configCache = this._getDefaultConfig();
    }

    return this._configCache;
  }

  /**
   * Load config from filesystem (Netlify)
   * @private
   * @returns {Object} Configuration object
   */
  _loadFromFilesystem() {
    try {
      const configPath = join(process.cwd(), 'wiki-config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      console.log('[ConfigAdapter] Successfully loaded wiki-config.json from filesystem');
      return config;
    } catch (error) {
      console.warn('[ConfigAdapter] Failed to load wiki-config.json:', error.message);
      return null; // Return null to trigger fallback
    }
  }

  /**
   * Get default configuration (fallback)
   * For Cloudflare, this builds config from environment variables
   * @private
   * @returns {Object} Default configuration object
   */
  _getDefaultConfig() {
    // For Cloudflare, build config from environment variables (if available)
    // Note: process.env may not be available in all contexts
    const env = typeof process !== 'undefined' ? process.env : {};
    const owner = env.WIKI_REPO_OWNER || env.VITE_WIKI_REPO_OWNER;
    const repo = env.WIKI_REPO_NAME || env.VITE_WIKI_REPO_NAME;

    return {
      wiki: {
        repository: {
          owner: owner || 'unknown',
          repo: repo || 'unknown'
        }
      },
      storage: {
        backend: 'github',
        version: 'v1',
        github: {
          owner: owner || null,
          repo: repo || null
        }
      }
    };
  }

  /**
   * Get storage configuration with runtime overrides
   * @param {PlatformAdapter} adapter - Platform adapter for env access
   * @returns {Object} Storage configuration
   */
  getStorageConfig(adapter) {
    const config = this.getWikiConfig();
    const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
    const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

    // For Cloudflare, check for KV namespace binding
    if (this.platform === 'cloudflare' && adapter.hasEnv('SLAYER_WIKI_DATA')) {
      return {
        backend: 'cloudflare-kv',
        version: 'v1',
        cloudflareKV: {
          namespace: adapter.getEnv('SLAYER_WIKI_DATA')
        }
      };
    }

    // Default to GitHub backend with runtime repo info
    return {
      ...config.storage,
      github: {
        ...config.storage?.github,
        owner: owner || config.storage?.github?.owner,
        repo: repo || config.storage?.github?.repo
      }
    };
  }
}
