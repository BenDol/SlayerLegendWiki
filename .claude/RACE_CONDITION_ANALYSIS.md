# Race Condition Analysis: Duplicate Issue Creation

## Executive Summary

**Status**: 🔴 **2 CONFIRMED race conditions causing duplicate issues**

**Root Cause**: Concurrent calls to "get or create" singleton issue functions have no synchronization mechanism.

**Affected Systems**:
1. ✅ **Admin Panel** - ALREADY FIXED (using in-flight tracking)
2. ❌ **Build Share Index** - NEEDS FIX (client-side)
3. ❌ **Contributor Highscore** - NEEDS FIX (client-side + workflow)

**Other Systems Verified Safe**:
- User Snapshots (one per user)
- Prestige Cache (read-only)
- Comments (one per page)

---

## Problem

Multiple systems can create duplicate "singleton" issues when called concurrently. This happens because:

1. **System A** checks if issue exists → finds none
2. **System B** checks if issue exists → finds none (A hasn't created yet)
3. **System A** creates issue
4. **System B** creates issue (duplicate!)

This affects both **client-side services** and **GitHub Actions workflows**.

---

## Why This Happened

### Multiple Users Simultaneously
When multiple users access the same feature at the exact same time:
- User A loads build share page → triggers `getOrCreateIndexIssue()`
- User B loads build share page → triggers `getOrCreateIndexIssue()`
- Both see no existing issue
- Both create a new issue
- Result: 2 `[Build Share Index]` issues

### Workflow Multiple Runs
GitHub Actions can run multiple times if:
- Manually triggered twice in quick succession
- Scheduled + manual trigger overlap
- Workflow re-runs due to failures
- Result: 2 `[Cache] Contributor Highscore` issues

### Why Admin Panel Didn't Have This
The admin panel was built AFTER experiencing these issues and implemented the fix from the start.

---

## Solution Pattern (From Admin Panel)

The Admin Panel **CORRECTLY** solves this using **in-flight request tracking**:

### Code Pattern
```javascript
// Module-level map to track in-flight requests
const pendingRequests = new Map();

export const getOrCreateIssue = async (owner, repo, config) => {
  const cacheKey = `${owner}/${repo}`;

  // 1. Check cache first
  const cached = getCacheValue(cacheName('issue', cacheKey));
  if (cached) return cached;

  // 2. Check if there's already a request in-flight
  if (pendingRequests.has(cacheKey)) {
    console.log('[Service] Waiting for in-flight request...');
    return pendingRequests.get(cacheKey);  // Return same promise!
  }

  // 3. Start new request and track it
  const requestPromise = (async () => {
    try {
      // Search for existing issue
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        labels: 'my-label',
        state: 'open',
        per_page: 100,  // Get more to detect duplicates
      });

      const existing = issues.find(i => i.title === '[My Issue]');
      if (existing) {
        setCacheValue(cacheName('issue', cacheKey), existing, 60000);
        return existing;
      }

      // Create new issue
      const newIssue = await createIssueWithBot(owner, repo, ...);
      setCacheValue(cacheName('issue', cacheKey), newIssue, 60000);
      return newIssue;
    } finally {
      // 4. Always remove from in-flight map
      pendingRequests.delete(cacheKey);
    }
  })();

  // 5. Store promise in map
  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
};
```

### How It Works
1. **First call**: Creates promise, stores it in map, executes
2. **Concurrent calls**: See in-flight request, return same promise
3. **All callers**: Get the same result (no duplicates!)
4. **Cleanup**: Request removed from map after completion

---

## Affected Systems

### ✅ ALREADY FIXED
- **Admin Panel** (`admin.js`) - Uses in-flight tracking
  - `getOrCreateAdminsIssue()` - line 38
  - `getOrCreateBannedUsersIssue()` - line 132

### ❌ NEEDS FIX - Client-Side Services

#### 1. **Build Share Index**
- **File**: `wiki-framework/src/services/github/buildShare.js`
- **Function**: `getOrCreateIndexIssue()` - line 142
- **Issue Title**: `[Build Share Index]`
- **Label**: `build-share-index`
- **Impact**: HIGH - Duplicate index issues break build sharing

#### 2. **Contributor Highscore (Client)**
- **File**: `wiki-framework/src/services/github/contributorHighscore.js`
- **Function**: `getHighscoreCacheIssue()` - line 37
- **Issue Title**: `[Cache] Contributor Highscore`
- **Label**: `highscore-cache`
- **Impact**: MEDIUM - Users can create duplicates if they access before workflow runs

#### 3. **User Snapshots** ✅ NO ISSUE
- **File**: `wiki-framework/src/services/github/userSnapshots.js`
- **Pattern**: One issue PER USER (not singleton)
- **No race condition**: Each user has unique issue

#### 4. **Prestige Cache** ✅ NO ISSUE (Client)
- **File**: `wiki-framework/src/services/github/prestige.js`
- **Pattern**: Read-only (doesn't create issues)
- **No race condition**: Workflow creates it (see workflow section)

#### 5. **Comments System** ✅ NO ISSUE
- **File**: `wiki-framework/src/services/github/comments.js`
- **Pattern**: One issue PER PAGE (not singleton)
- **No race condition**: Each page has unique issue

### ❌ NEEDS FIX - GitHub Actions

#### 6. **Contributor Highscore Workflow**
- **File**: `.github/workflows/update-highscore-cache.yml`
- **Lines**: 587-621
- **Issue Title**: `[Cache] Contributor Highscore`
- **Label**: `highscore-cache`
- **Impact**: HIGH - Workflow runs can create duplicates

**Problem**: Workflows can't use in-flight tracking (different execution contexts).

**Solution Options**:
1. **Check for duplicates after creation** - Detect race, close newer issue
2. **Use issue number as lock** - Create with unique content hash, detect collision
3. **GitHub CLI with retry logic** - Use `gh issue list` with verification
4. **Add delay + retry** - Random delay before creation, verify after

**Recommended**: Option 1 (verify after creation, close duplicates)

---

## Implementation Plan

### Phase 1: Fix Client-Side Services
Apply admin.js pattern to:
1. `buildShare.js` - Add in-flight tracking map
2. `contributorHighscore.js` - Add in-flight tracking map
3. Verify and fix `userSnapshots.js` if needed
4. Verify and fix `prestige.js` if needed

### Phase 2: Fix GitHub Actions
Update `update-highscore-cache.yml`:
1. After creating issue, immediately check for duplicates
2. If multiple found, keep oldest, close others
3. Log warning for investigation

### Phase 3: Add Duplicate Detection
Add warning system to detect existing duplicates:
1. Search for all issues with label
2. If multiple found, log warning with issue numbers
3. Admin can manually close duplicates

---

## Testing Strategy

### Test Race Conditions
```javascript
// Simulate concurrent calls
async function testRaceCondition() {
  const promises = Array(10).fill(null).map(() =>
    getOrCreateIndexIssue(owner, repo)
  );

  const results = await Promise.all(promises);

  // Should all return same issue number
  const uniqueNumbers = new Set(results.map(r => r.number));
  console.assert(uniqueNumbers.size === 1, 'Race condition detected!');
}
```

### Test Workflow Idempotency
1. Trigger workflow multiple times in quick succession
2. Verify only one issue exists after completion
3. Check logs for duplicate detection/cleanup

---

## Prevention for Future

### Code Review Checklist
When adding new "singleton" issue creation:
- [ ] Uses in-flight request tracking (client-side)
- [ ] Has proper caching with TTL
- [ ] Searches with `per_page: 100` to detect duplicates
- [ ] Has duplicate detection after creation (workflows)
- [ ] Includes logging for debugging
- [ ] Handles race conditions gracefully

### Naming Convention
All singleton issues should:
- Use consistent label naming: `{feature}-cache` or `{feature}-index`
- Include `automated` label
- Lock issue to prevent comments
- Have clear title format: `[Cache] {Feature}` or `[{Feature} Index]`
