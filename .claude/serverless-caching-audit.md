# Serverless Caching Security Audit

## Date: 2025-12-30

## Issue
After migrating to Cloudflare Wrangler, discovered that module-level caching in serverless functions was causing **security vulnerabilities** where user authentication tokens and identity data were being shared across different user requests.

## Root Cause
In serverless environments (Cloudflare Workers, Netlify Functions), the JavaScript runtime is shared across multiple requests. Module-level variables persist between requests, causing caching intended for client-side performance to leak data between different users on the server-side.

---

## Critical Vulnerabilities Found & Fixed

### 1. ✅ FIXED: `octokitInstance` Cache
**File:** `wiki-framework/src/services/github/api.js`

**Problem:**
- Module-level variable caching authenticated Octokit instances
- User A's authentication token persisted and was reused for User B's requests
- **Impact:** User B could make authenticated API calls with User A's token

**Fix:**
```javascript
// Server-side: NEVER cache - create fresh instance per request
if (isServerSide) {
  return new OctokitWithRetry({
    auth: userToken,
    // ...
  });
}
```

**Result:** Server-side now creates fresh Octokit instance per request. Client-side still caches for performance.

---

### 2. ✅ FIXED: `authenticatedUserCache` Cache
**File:** `wiki-framework/src/services/github/api.js`

**Problem:**
- Module-level variable caching authenticated user data (username, ID, etc.)
- User A's identity data persisted and was returned for User B's requests
- **Impact:** User B saw User A's username and was granted User A's permissions

**Example:**
```
User BenDol (admin) accessed admin panel
User bonfyrenz (non-admin) accessed admin panel
Result: bonfyrenz saw "Signed in as BenDol" with admin privileges ❌
```

**Fix:**
```javascript
// SECURITY: On server-side, NEVER cache user data
const isServerSide = typeof window === 'undefined';

if (!isServerSide) {
  // Check cache first (client-side only)
  if (authenticatedUserCache && (now - authenticatedUserCacheTime) < AUTHENTICATED_USER_CACHE_TTL) {
    return authenticatedUserCache;
  }
}

// Fetch from GitHub API
const { data } = await octokit.rest.users.getAuthenticated();

// Cache the result (client-side only)
if (!isServerSide) {
  authenticatedUserCache = data;
  authenticatedUserCacheTime = Date.now();
}
```

**Result:** Server-side never caches user data. Each request fetches fresh user identity.

---

### 3. ✅ FIXED: `isAuthenticated()` Check
**File:** `wiki-framework/src/services/github/api.js`

**Problem:**
- Checked cached `octokitInstance` which was null on server-side after removing caching
- Always returned `false` even when user was authenticated

**Fix:**
```javascript
export const isAuthenticated = () => {
  // Server-side: Check process.env directly since we don't cache instances
  const isServerSide = typeof window === 'undefined';
  if (isServerSide && typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) {
    return true;
  }

  // Client-side: Check if we have an authenticated instance with a token
  return octokitInstance !== null &&
         octokitInstance.auth !== undefined &&
         (typeof octokitInstance.auth === 'string' || typeof octokitInstance.auth === 'function');
};
```

---

## Caches Audited - Verified Safe

### Client-Side Only (Safe)
These caches are in code that only runs in the browser:

- ✅ `checkCooldowns` (achievementChecker.js) - Client-side achievement check cooldowns
- ✅ `snapshotUpdatesInProgress` (userSnapshots.js) - Used only by client-side stores/hooks
- ✅ `achievementCheckCooldowns` (ProfilePage.jsx) - React component state

### Server-Side Shared Resources (Safe)
These caches don't contain user-specific authentication or identity:

- ✅ `botOctokitInstance` (api.js) - **Shared bot token** for all users, not user-specific
- ✅ `buildCache` (buildShare.js) - Content-addressed by checksum (immutable, no user context)
- ✅ `dataCache` (dataLoader.js) - Static data files (no user context)
- ✅ `creatorCache` (contentCreatorService.js) - Public creator data
- ✅ `userProfileCache` (githubCache.js) - Public GitHub profiles (keyed by username)
- ✅ `collaboratorsCache` (githubCache.js) - Repository collaborators (public data)
- ✅ `repositoryCache` (githubCache.js) - Repository metadata (public data)

### De-duplication Maps (Safe)
These Maps prevent concurrent duplicate requests, keyed by resource ID not user:

- ✅ `pendingRequests` (api.js)
- ✅ `pendingIndexIssueRequests` (buildShare.js)
- ✅ `pendingPageIssueRequests` (comments.js)
- ✅ `pendingAdminIssueRequests` (admin.js)
- ✅ `pendingBanIssueRequests` (admin.js)
- ✅ `pendingHighscoreIssueRequests` (contributorHighscore.js)
- ✅ `pendingIndexIssueRequests` (contentCreatorService.js)
- ✅ `snapshotUpdatesInProgress` (userSnapshots.js)

### Achievement System (Safe)
- ✅ `queue` (achievementQueue.js) - Processing queue, not user-specific cache

---

## Testing & Verification

### Before Fix
```
[Admin Actions] Status result: { isOwner: true, isAdmin: true, username: 'BenDol' }
// ❌ bonfyrenz (non-admin) seeing BenDol's (admin) identity
```

### After Fix
```
[Admin] Got user: { login: 'bonfyrenz', id: 249419067 }
[Admin Actions] Status result: { isOwner: false, isAdmin: false, username: 'bonfyrenz' }
// ✅ bonfyrenz correctly sees their own identity and permissions
```

---

## Security Guidelines for Serverless Functions

### ❌ NEVER Do This Server-Side
```javascript
// Module-level cache of user-specific data
let userCache = null;

export function getUser() {
  if (userCache) return userCache; // ❌ Leaks between users!
  // ...
}
```

### ✅ DO This Instead
```javascript
let userCache = null;

export function getUser() {
  const isServerSide = typeof window === 'undefined';

  // Server-side: Always fetch fresh
  if (isServerSide) {
    // No caching - fetch every time
    return fetchUserFromAPI();
  }

  // Client-side: Can cache safely
  if (userCache) return userCache;
  userCache = fetchUserFromAPI();
  return userCache;
}
```

### Key Principles
1. **Never cache user-specific data server-side** (tokens, identity, permissions)
2. **Never cache authenticated requests server-side** (API clients with auth tokens)
3. **Always detect environment**: `typeof window === 'undefined'` for server-side
4. **Client-side caching is safe** - Each browser has isolated state
5. **Shared resources are OK** - Bot tokens, public data, static content

---

## Related Files Modified

- `wiki-framework/src/services/github/api.js` - Fixed `getOctokit()`, `getAuthenticatedUser()`, `isAuthenticated()`

---

## Impact

**Before:** Critical security vulnerability allowing identity and permission leakage
**After:** Each user request uses fresh authentication context, no data leakage

**Performance:**
- Client-side: No change (still cached)
- Server-side: Slightly slower (creates fresh instances), but necessary for security
