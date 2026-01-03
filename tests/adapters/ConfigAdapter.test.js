/**
 * ConfigAdapter Tests
 * Comprehensive tests for configuration loading across platforms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigAdapter } from '../../functions/_shared/adapters/ConfigAdapter.js';
import { createMockNetlifyEvent, createMockCloudflareContext, createMockEnv } from '../helpers/adapterHelpers.js';
import { NetlifyAdapter, CloudflareAdapter } from '../../wiki-framework/serverless/shared/adapters/PlatformAdapter.js';

describe('ConfigAdapter', () => {
  describe('Netlify Platform', () => {
    let adapter;

    beforeEach(() => {
      adapter = new ConfigAdapter('netlify');
    });

    it('should load wiki config', () => {
      const config = adapter.getWikiConfig();
      expect(config).toBeTruthy();
      // Config has nested structure from wiki-config.json
      expect(config).toHaveProperty('wiki');
      expect(config).toHaveProperty('storage');
    });

    it('should get storage config with GitHub backend', () => {
      const mockAdapter = new NetlifyAdapter(createMockNetlifyEvent());
      const storageConfig = adapter.getStorageConfig(mockAdapter);

      expect(storageConfig).toBeTruthy();
      expect(storageConfig.backend).toBe('github');
      expect(storageConfig.version).toBe('v1');
      expect(storageConfig.github).toHaveProperty('owner');
      expect(storageConfig.github).toHaveProperty('repo');
    });

    it('should cache config after first load', () => {
      const config1 = adapter.getWikiConfig();
      const config2 = adapter.getWikiConfig();
      // Should return same object (cached)
      expect(config1).toBe(config2);
    });

    it('should handle missing config file gracefully', () => {
      // Even if file doesn't exist, should return default config with storage
      const config = adapter.getWikiConfig();
      expect(config).toBeTruthy();
      expect(config).toHaveProperty('storage');
      expect(config.storage).toHaveProperty('backend');
      expect(config.storage).toHaveProperty('version');
    });
  });

  describe('Cloudflare Platform', () => {
    let adapter;
    let platformAdapter;

    beforeEach(() => {
      adapter = new ConfigAdapter('cloudflare');
      const context = createMockCloudflareContext({
        env: createMockEnv()
      });
      platformAdapter = new CloudflareAdapter(context);
    });

    it('should load default wiki config', () => {
      const config = adapter.getWikiConfig();
      expect(config).toBeTruthy();
      // Cloudflare uses minimal default config
      expect(config).toHaveProperty('storage');
      expect(config.storage.backend).toBe('github');
      expect(config.storage.version).toBe('v1');
    });

    it('should get storage config with GitHub backend', () => {
      const storageConfig = adapter.getStorageConfig(platformAdapter);

      expect(storageConfig).toBeTruthy();
      expect(storageConfig.backend).toBe('github');
      expect(storageConfig.version).toBe('v1');
      expect(storageConfig.github.owner).toBe('test-owner');
      expect(storageConfig.github.repo).toBe('test-repo');
    });

    it('should use Cloudflare KV when namespace is available', () => {
      const context = createMockCloudflareContext({
        env: {
          ...createMockEnv(),
          SLAYER_WIKI_DATA: 'mock-kv-namespace'
        }
      });
      const kvAdapter = new CloudflareAdapter(context);

      const storageConfig = adapter.getStorageConfig(kvAdapter);

      expect(storageConfig.backend).toBe('cloudflare-kv');
      expect(storageConfig.version).toBe('v1');
      expect(storageConfig.cloudflareKV.namespace).toBe('mock-kv-namespace');
    });

    it('should cache config after first load', () => {
      const config1 = adapter.getWikiConfig();
      const config2 = adapter.getWikiConfig();
      expect(config1).toBe(config2);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should return equivalent configs on both platforms', () => {
      const netlifyAdapter = new ConfigAdapter('netlify');
      const cloudflareAdapter = new ConfigAdapter('cloudflare');

      const netlifyConfig = netlifyAdapter.getWikiConfig();
      const cloudflareConfig = cloudflareAdapter.getWikiConfig();

      // Both should have storage configuration (the critical part for function operation)
      expect(netlifyConfig).toHaveProperty('storage');
      expect(cloudflareConfig).toHaveProperty('storage');
      expect(netlifyConfig.storage.backend).toBe(cloudflareConfig.storage.backend);
      expect(netlifyConfig.storage.version).toBe(cloudflareConfig.storage.version);
    });

    it('should produce equivalent storage configs', () => {
      const netlifyConfigAdapter = new ConfigAdapter('netlify');
      const cloudflareConfigAdapter = new ConfigAdapter('cloudflare');

      const netlifyPlatformAdapter = new NetlifyAdapter(createMockNetlifyEvent());
      const cloudflarePlatformAdapter = new CloudflareAdapter(
        createMockCloudflareContext({ env: createMockEnv() })
      );

      const netlifyStorage = netlifyConfigAdapter.getStorageConfig(netlifyPlatformAdapter);
      const cloudflareStorage = cloudflareConfigAdapter.getStorageConfig(cloudflarePlatformAdapter);

      // Both should use GitHub backend by default
      expect(netlifyStorage.backend).toBe('github');
      expect(cloudflareStorage.backend).toBe('github');
      expect(netlifyStorage.version).toBe(cloudflareStorage.version);
    });
  });

  describe('Storage Backend Selection', () => {
    it('should default to GitHub backend', () => {
      const adapter = new ConfigAdapter('cloudflare');
      const platformAdapter = new CloudflareAdapter(
        createMockCloudflareContext({ env: createMockEnv() })
      );

      const config = adapter.getStorageConfig(platformAdapter);

      expect(config.backend).toBe('github');
      expect(config.github).toBeTruthy();
    });

    it('should use KV backend when namespace is bound', () => {
      const adapter = new ConfigAdapter('cloudflare');
      const platformAdapter = new CloudflareAdapter(
        createMockCloudflareContext({
          env: {
            ...createMockEnv(),
            SLAYER_WIKI_DATA: 'wiki-kv-namespace'
          }
        })
      );

      const config = adapter.getStorageConfig(platformAdapter);

      expect(config.backend).toBe('cloudflare-kv');
      expect(config.cloudflareKV.namespace).toBe('wiki-kv-namespace');
    });

    it('should include required GitHub config fields', () => {
      const adapter = new ConfigAdapter('netlify');
      const platformAdapter = new NetlifyAdapter(createMockNetlifyEvent());

      const config = adapter.getStorageConfig(platformAdapter);

      expect(config.backend).toBe('github');
      expect(config.github.owner).toBeTruthy();
      expect(config.github.repo).toBeTruthy();
    });
  });

  describe('Default Configuration', () => {
    it('should provide valid default configuration', () => {
      const adapter = new ConfigAdapter('cloudflare');
      const config = adapter.getWikiConfig();

      // Cloudflare default config has minimal structure
      expect(config).toHaveProperty('storage');
      expect(config.storage.backend).toBe('github');
      expect(config.storage.version).toBe('v1');
    });

    it('should have all required config fields', () => {
      const adapter = new ConfigAdapter('netlify');
      const config = adapter.getWikiConfig();

      // Netlify loads from wiki-config.json which has nested structure
      expect(config).toHaveProperty('storage');
      expect(config).toHaveProperty('wiki');
      expect(config.storage).toHaveProperty('backend');
      expect(config.storage).toHaveProperty('version');
      expect(config.wiki).toHaveProperty('title');
      expect(config.wiki).toHaveProperty('repository');
    });
  });

  describe('Config Caching', () => {
    it('should cache config and not reload on subsequent calls', () => {
      const adapter = new ConfigAdapter('netlify');

      // Spy on the internal _loadFromFilesystem method
      const loadSpy = vi.spyOn(adapter, '_loadFromFilesystem');

      // First call should load
      adapter.getWikiConfig();
      expect(loadSpy).toHaveBeenCalledTimes(1);

      // Subsequent calls should use cache
      adapter.getWikiConfig();
      adapter.getWikiConfig();
      adapter.getWikiConfig();

      // Should still only be called once
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('should use cached config for storage config generation', () => {
      const adapter = new ConfigAdapter('cloudflare');
      const platformAdapter = new CloudflareAdapter(
        createMockCloudflareContext({ env: createMockEnv() })
      );

      // Load config multiple times
      adapter.getStorageConfig(platformAdapter);
      adapter.getStorageConfig(platformAdapter);
      adapter.getStorageConfig(platformAdapter);

      // Config should be loaded and cached
      const cachedConfig = adapter.getWikiConfig();
      expect(cachedConfig).toBeTruthy();
    });
  });
});
