/**
 * Wiki Storage Factory
 *
 * Creates storage adapters for the wiki with wiki-specific configurations.
 * This wraps the framework's generic StorageFactory with wiki-specific customizations.
 */

import StorageFactory from 'github-wiki-framework/src/services/storage/StorageFactory.js';
import WikiGitHubStorage from './WikiGitHubStorage.js';

/**
 * Create a wiki-specific storage adapter
 *
 * @param {Object} storageConfig - Storage configuration
 * @param {Object} environment - Environment variables/bindings
 * @returns {StorageAdapter} Configured storage adapter with wiki customizations
 */
export function createWikiStorage(storageConfig, environment) {
  const backend = storageConfig.backend || 'github';

  // For GitHub backend, use our custom WikiGitHubStorage
  if (backend === 'github') {
    const botToken = environment.WIKI_BOT_TOKEN;

    if (!botToken) {
      throw new Error('GitHub storage requires WIKI_BOT_TOKEN environment variable');
    }

    if (!storageConfig.github) {
      throw new Error('GitHub storage requires github configuration');
    }

    const { owner, repo } = storageConfig.github;

    if (!owner || !repo) {
      throw new Error('GitHub storage requires owner and repo in configuration');
    }

    return new WikiGitHubStorage({
      botToken,
      owner,
      repo,
      version: storageConfig.version || 'v1',
    });
  }

  // For other backends, use the generic factory
  return StorageFactory.create(storageConfig, environment);
}
