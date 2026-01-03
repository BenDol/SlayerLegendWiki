# Commit-Based Cache Purge

## Overview

The wiki supports forcing client cache purges via commit message keywords. This allows you to clear user caches for specific deployments without permanently enabling `purgeClientCacheOnUpdate`.

## How It Works

1. **Pre-Build Script**: `scripts/checkCommitForCachePurge.js` runs before every build
2. **Commit Check**: Reads the latest git commit message
3. **Keyword Detection**: Checks for cache purge keywords
4. **Environment Variable**: Sets `VITE_PURGE_CLIENT_CACHE=true` if keyword found
5. **Version Manager**: Detects the env var and forces cache purge on client side

## Trigger Keywords

Any of these keywords in your commit message will trigger a cache purge:

- `[purge-cache]`
- `[purge cache]`
- `PURGE_CACHE`
- `purge cache` (case insensitive)

## Usage Examples

### Example 1: Simple commit with cache purge
```bash
git commit -m "Update pricing calculator [purge-cache]"
git push
```

### Example 2: Detailed commit message
```bash
git commit -m "Fix critical bug in data loader

This fixes a bug where stale data could be cached incorrectly.
Users need fresh data, so purging cache.

[purge-cache]"
git push
```

### Example 3: Using uppercase keyword
```bash
git commit -m "PURGE_CACHE: Major data structure changes"
git push
```

## What Gets Purged?

The purge behavior respects the `preserveDraftsOnUpdate` config:

- **preserveDraftsOnUpdate: true** (default)
  - Purges all `cache:*` keys EXCEPT those containing `:draft:`
  - User draft work is preserved (skill builds, loadouts, etc.)
  - Draft format: `cache:userId:draft:name`

- **preserveDraftsOnUpdate: false**
  - Purges ALL `cache:*` keys including drafts
  - Complete cache wipe

## Config Options

```json
{
  "features": {
    "purgeClientCacheOnUpdate": false,  // Normal purge on version change
    "preserveDraftsOnUpdate": true,     // Keep drafts during purge
    "forceRelogOnUpdate": false         // Force users to re-login on version change
  }
}
```

### forceRelogOnUpdate

When set to `true`, users will be automatically logged out when the version changes. This forces them to re-authenticate with GitHub, which can be useful for:

- Ensuring users have fresh authentication tokens
- Forcing OAuth scope updates
- Clearing authentication state after security updates
- Testing authentication flows in production

**Note:** This clears the `config:wiki_auth` storage key, which triggers the authentication flow on next page load.

## Priority Order

Cache purging occurs when ANY of these is true:
1. `VITE_PURGE_CLIENT_CACHE=true` (commit keyword) ← **Highest priority**
2. `purgeClientCacheOnUpdate: true` (config setting)

The commit keyword **overrides** the config setting.

## When to Use

Use commit-based cache purging when:
- Deploying critical data structure changes
- Fixing bugs that require fresh cached data
- Updating API response formats
- Changing localStorage schema
- One-time cache clear needed without permanent config change

## Cloudflare Pages Setup

For Cloudflare Pages deployments, the script runs automatically via the `prebuild` hook:

```json
{
  "scripts": {
    "prebuild": "node scripts/checkCommitForCachePurge.js && node scripts/injectVersion.js && node scripts/buildSearchIndex.js",
    "build": "vite build"
  }
}
```

No additional Cloudflare configuration needed - the script writes to `.env.production.local` which Vite picks up during build.

## How Users Experience It

When a cache purge is triggered:

1. User visits the site with new deployment
2. Version manager detects version change
3. Sees `VITE_PURGE_CLIENT_CACHE=true` in build
4. Purges caches automatically
5. **Dev mode only**: Shows toast notification "Caches cleared - Updated to version {sha}"

The purge is **silent in production** - users just get fresh data automatically.

## Debugging

To verify the script is working:

1. Check build logs for:
   ```
   [CachePurgeCheck] Checking commit message for cache purge keyword...
   [CachePurgeCheck] 🔥 Cache purge keyword detected!
   [CachePurgeCheck] ✓ Set VITE_PURGE_CLIENT_CACHE=true
   ```

2. Check browser console after deployment:
   ```
   [VersionManager] Force purging caches (triggered by commit message)...
   [VersionManager] Purged 15 cache entries (drafts preserved)
   ```

## Files Involved

- `scripts/checkCommitForCachePurge.js` - Pre-build script
- `wiki-framework/src/utils/versionManager.js` - Checks env var
- `wiki-framework/src/utils/storageManager.js` - Cache clearing logic
- `package.json` - Prebuild hook configuration
- `.env.production.local` - Auto-generated (gitignored)
