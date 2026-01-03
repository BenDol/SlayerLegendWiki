# Cache Update Workflows

This document explains how to manually trigger the automated cache update workflows for the wiki.

## Overview

The wiki uses two GitHub Actions workflows to maintain cached data:

1. **Highscore Cache** - Updates contributor statistics and rankings
2. **Prestige Cache** - Updates prestige tiers for all contributors

Both workflows run automatically daily (2 AM and 3 AM UTC respectively), but can also be triggered manually.

---

## Method 1: GitHub UI (Recommended)

The easiest way to manually trigger workflows is through the GitHub web interface.

### Steps:

1. **Go to Actions tab**
   - Navigate to: `https://github.com/BenDol/SlayerLegendWiki/actions`

2. **Select the workflow**
   - Click on either:
     - "Update Contributor Highscore Cache"
     - "Update Contributor Prestige Cache"

3. **Trigger the workflow**
   - Click the **"Run workflow"** dropdown button (top right)
   - Select branch: **main** (should be selected by default)
   - Click **"Run workflow"** button

4. **Monitor progress**
   - The workflow will appear in the list and show its status
   - Click on it to see detailed logs
   - Takes about 30-60 seconds to complete

### Screenshot Locations:
```
GitHub Repo → Actions Tab → Workflow Name → "Run workflow" button
```

---

## Method 2: CLI Script (For Developers)

A Node.js script is provided to trigger workflows programmatically.

### Prerequisites:

1. **GitHub Personal Access Token** with `repo` scope
   - Create at: https://github.com/settings/tokens
   - Required scopes: `repo` (Full control of private repositories)

2. **Set environment variable:**
   ```bash
   export GITHUB_TOKEN=your_token_here
   ```

### Usage:

```bash
# Trigger both workflows
node scripts/triggerCacheUpdates.js both

# Trigger only highscore
node scripts/triggerCacheUpdates.js highscore

# Trigger only prestige
node scripts/triggerCacheUpdates.js prestige
```

### Example Output:

```
🚀 Manual Cache Update Trigger

Repository: BenDol/SlayerLegendWiki
Target: both

Triggering workflows...

⏳ Triggering Highscore Cache...
✅ Highscore Cache workflow triggered successfully!
⏳ Triggering Prestige Cache...
✅ Prestige Cache workflow triggered successfully!

✨ Done!

Check workflow status at:
https://github.com/BenDol/SlayerLegendWiki/actions
```

---

## Method 3: GitHub API (Advanced)

Trigger workflows directly via API using `curl` or similar tools.

### Highscore Cache:

```bash
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/BenDol/SlayerLegendWiki/actions/workflows/update-highscore-cache.yml/dispatches \
  -d '{"ref":"main"}'
```

### Prestige Cache:

```bash
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/BenDol/SlayerLegendWiki/actions/workflows/update-prestige-cache.yml/dispatches \
  -d '{"ref":"main"}'
```

### Response:

- **Success:** HTTP 204 (No Content)
- **Error:** HTTP 4xx/5xx with error message

---

## Method 4: GitHub CLI (gh)

If you have [GitHub CLI](https://cli.github.com/) installed:

```bash
# Trigger highscore cache update
gh workflow run update-highscore-cache.yml

# Trigger prestige cache update
gh workflow run update-prestige-cache.yml

# Trigger both
gh workflow run update-highscore-cache.yml && gh workflow run update-prestige-cache.yml
```

---

## When to Manually Trigger

You should manually trigger these workflows when:

### Immediate Update Needed:
- **New contributors joined** and you want prestige badges to appear immediately
- **Major contributions made** and highscore rankings should update
- **After deployment** to populate initial cache data

### Testing:
- **Verifying workflows work** after configuration changes
- **Testing cache issues** creation and updates
- **Debugging permission errors** or cache problems

### Cache Issues:
- **Cache corruption** detected (invalid JSON in cache issue)
- **Stale data** beyond the normal 24-hour window
- **Cache issue deleted** accidentally and needs recreation

---

## Workflow Schedules

Both workflows run automatically daily:

| Workflow | Schedule | Time (UTC) |
|----------|----------|------------|
| Highscore Cache | Daily | 2:00 AM |
| Prestige Cache | Daily | 3:00 AM |

**Note:** Times are offset to avoid concurrent API usage and potential conflicts.

---

## Verifying Updates

After triggering a workflow, verify it worked:

### 1. Check Workflow Status
- Go to Actions tab on GitHub
- Look for the workflow run (should show as completed/success)
- Check logs for any errors

### 2. Check Cache Issues
- Go to Issues tab on GitHub
- Filter by labels: `highscore-cache` or `prestige-cache`
- Verify the issue body has updated timestamp
- Check that JSON data looks correct

### 3. Check Wiki
- **Highscore:** Visit `/highscore` page and verify data updated
- **Prestige:** Check avatar badges show correct prestige tiers
- **Cache:** Check browser console for cache hit logs

---

## Troubleshooting

### Workflow Not Triggering

**Problem:** "Run workflow" button is disabled or missing

**Solution:**
- Ensure you have **write access** to the repository
- Verify you're on the correct branch (main)
- Check that `workflow_dispatch` is present in the workflow YAML

### Workflow Fails

**Problem:** Workflow runs but fails with errors

**Common causes:**
1. **Permission issues:** GITHUB_TOKEN lacks required permissions
   - Solution: Ensure `issues: write` permission is set
2. **API rate limit:** Too many requests
   - Solution: Wait and retry, or use authenticated requests
3. **Invalid JSON:** Cache issue has corrupted data
   - Solution: Manually fix or delete the cache issue

### Cache Not Updating in Wiki

**Problem:** Workflow succeeds but wiki shows old data

**Solution:**
1. **Clear browser cache:** localStorage may have old data
   - Open DevTools → Application → Local Storage → Clear
2. **Hard refresh:** Ctrl+Shift+R (or Cmd+Shift+R on Mac)
3. **Wait:** Cache has 24-hour TTL, may take a moment to refresh

---

## Permissions Required

To manually trigger workflows, you need:

### Via GitHub UI:
- **Write access** to the repository
- **Actions enabled** in repository settings

### Via API/CLI:
- **Personal Access Token** with `repo` scope
- **Workflow permission** (usually included in repo scope)

### For Workflows to Run:
- **GITHUB_TOKEN** with `issues: write` permission (automatic in GitHub Actions)
- **Repository access** to read contributor data

---

## Cache Storage

Both workflows store cached data in GitHub Issues:

### Highscore Cache Issue:
- **Title:** "Contributor Highscore Cache [DO NOT DELETE]"
- **Labels:** `highscore-cache`, `automation`
- **Body:** JSON with contributor rankings and statistics

### Prestige Cache Issue:
- **Title:** "Contributor Prestige Cache [DO NOT DELETE]"
- **Labels:** `prestige-cache`, `automation`
- **Body:** JSON with contributor prestige tiers

**⚠️ Warning:** Do not manually edit or delete these issues unless you know what you're doing. They are automatically managed by the workflows.

---

## Additional Resources

- **GitHub Actions Documentation:** https://docs.github.com/en/actions
- **Workflow Dispatch Events:** https://docs.github.com/en/actions/reference/events-that-trigger-workflows#workflow_dispatch
- **GitHub API - Actions:** https://docs.github.com/en/rest/actions/workflows
