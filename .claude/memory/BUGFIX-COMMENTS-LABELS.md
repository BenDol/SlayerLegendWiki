# Bug Fix: Comment System Label Permission Error

## Issue

Users were getting the following error when trying to post a comment:

```
Failed to submit comment: You do not have permission to create labels on this repository.:
{"resource":"Repository","field":"label","code":"unauthorized"}
```

## Root Cause

The `Comments.jsx` component was calling the comment service functions **without passing the required `branch` parameter**:

```javascript
// BEFORE (BROKEN):
const pageIssue = await findPageIssue(owner, repo, pageTitle); // Missing branch!
pageIssue = await getOrCreatePageIssue(owner, repo, pageTitle, pageUrl); // Missing branch!
```

When the `branch` parameter is `undefined`, the code tried to create an issue with label `branch:undefined`, which doesn't exist in the repository. GitHub's API attempts to auto-create missing labels, but regular users don't have permission to create labels, causing the "unauthorized" error.

## Why Labels Exist But Still Failed

The GitHub Action **did successfully create all labels** including `branch:main`. However:

1. The Comments component wasn't detecting the current branch
2. Without the branch parameter, `branch` became `undefined`
3. Code tried to use label `branch:undefined` (doesn't exist)
4. GitHub tried to auto-create the label
5. User lacks permission → Error!

## The Fix

Updated `wiki-framework/src/components/wiki/Comments.jsx` to:

1. **Import branch detection utility:**
   ```javascript
   import { detectCurrentBranch } from '../../services/github/branchNamespace';
   ```

2. **Detect branch in `loadComments()` function:**
   ```javascript
   // Detect current branch for namespace isolation
   const branch = await detectCurrentBranch(config);

   // Pass branch to findPageIssue
   const pageIssue = await findPageIssue(owner, repo, pageTitle, branch);
   ```

3. **Detect branch in `handleSubmitComment()` function:**
   ```javascript
   // Detect current branch for namespace isolation
   const branch = await detectCurrentBranch(config);

   // Pass branch to getOrCreatePageIssue
   pageIssue = await getOrCreatePageIssue(owner, repo, pageTitle, pageUrl, branch);
   ```

## How It Works Now

1. User visits a wiki page
2. Comments component detects current branch: `"main"` (from `runtime-branch.json`)
3. Component looks for existing comment issue with label `branch:main`
4. When user posts comment, creates issue with labels `['wiki-comments', 'branch:main']`
5. **Both labels exist** (created by GitHub Action) → Success! ✅

## Branch Detection Strategy

The `detectCurrentBranch()` function uses this fallback chain:

1. **Development mode**: Try dev server API endpoint `/api/git-branch`
2. **Production mode**: Read from `/runtime-branch.json` (build-time embedded)
3. **Fallback**: Use `config.wiki.repository.branch` or `defaultBranch` from config

For this wiki:
- `runtime-branch.json` contains `{"branch": "main"}`
- Config has `branch: "main"` and `defaultBranch: "main"`
- Result: Always returns `"main"` ✅

## Files Modified

- `wiki-framework/src/components/wiki/Comments.jsx` - Added branch detection and parameter passing

## Testing

To verify the fix works:

1. Navigate to any wiki page
2. Scroll to comments section
3. Sign in with GitHub
4. Try posting a comment
5. Should succeed without permission errors! ✅

## Related Systems

The label management system ensures all required labels exist:

- **Labels config**: `.github/labels.json`
- **Sync workflow**: `.github/workflows/sync-labels.yml`
- **Labels created**:
  - `wiki-comments` - Comment collection issues
  - `branch:main` - Main branch namespace
  - All section labels (`section:*`)
  - All status labels (`status:*`)

See `LABELS.md` for complete documentation.

## Prevention

This type of bug is now prevented by:

1. **Centralized label management** - All labels pre-created via GitHub Action
2. **Automatic sync** - Labels stay in sync (weekly + on push)
3. **Branch detection** - Framework properly detects and passes branch parameter
4. **Function signatures** - TypeScript would catch missing parameters (future improvement)

## Rollout

1. ✅ Labels created via GitHub Action
2. ✅ Comments component fixed to pass branch parameter
3. 🔄 Commit and push changes to `main` branch
4. 🔄 Users can now comment without permission errors!
