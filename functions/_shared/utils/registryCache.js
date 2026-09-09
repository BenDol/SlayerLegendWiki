/**
 * Small in-process TTL cache for issue-backed registries.
 *
 * The display-name and profile-picture registries are stored as one GitHub
 * issue plus one comment per user, so every read costs N+1 bot API calls. An
 * anonymous caller could exhaust the bot's hourly quota with a few hundred
 * GETs. Caching the parsed registry per warm runtime collapses that to one
 * load per TTL window; writers invalidate after they commit so their own
 * subsequent reads are fresh.
 *
 * Scope: per isolate/process (not shared across instances) - it is an
 * amplification limiter, not a source of truth. Write paths should always
 * load fresh.
 */

/**
 * @param {number} ttlMs - How long an entry stays valid.
 * @returns {{ get(key: string): any, set(key: string, value: any): any, invalidate(key: string): void, clear(): void }}
 */
/** Shared TTL for the issue-backed registry read caches (display names, avatars). */
export const REGISTRY_CACHE_TTL_MS = 30 * 1000;

/** Cache key for an owner/repo registry. */
export const registryKey = (owner, repo) => `${owner}/${repo}`;

export function createTtlCache(ttlMs) {
  const store = new Map();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    },
    invalidate(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}
