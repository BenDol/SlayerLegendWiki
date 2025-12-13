# Anonymous Edit Mode - Serverless Setup

This guide explains how to set up anonymous editing using **GitHub Actions + Issues** - completely serverless, no external server needed!

## How It Works

```
User clicks "Edit Anonymously"
  ↓
Frontend creates GitHub Issue with edit data
  ↓
GitHub Actions workflow triggers automatically
  ↓
Workflow creates branch, commits changes, opens PR
  ↓
Workflow comments on issue with PR link
  ↓
Frontend polls issue for result
  ↓
User sees success message with PR link
```

**Timing:**
- Issue creation: < 1 second
- Actions startup: 10-30 seconds
- PR creation: 5-10 seconds
- **Total: ~15-40 seconds**

## Pros vs Cons

### Serverless (GitHub Actions) ✨

**Pros:**
- ✅ No external server needed
- ✅ Free (uses GitHub Actions minutes)
- ✅ No hosting costs
- ✅ Bot credentials safely stored in repo secrets
- ✅ Full audit trail via issues
- ✅ Zero maintenance
- ✅ Can add manual moderation queue

**Cons:**
- ❌ 15-40 second delay (Actions startup)
- ❌ Not real-time
- ❌ Creates temporary issues (auto-closed)
- ❌ Requires repository access (GITHUB_TOKEN)

### Server Mode (Express) 🚀

**Pros:**
- ✅ Real-time (< 2 seconds)
- ✅ Immediate feedback
- ✅ No temporary issues
- ✅ Better UX for quick edits

**Cons:**
- ❌ Requires hosting (VPS/Serverless function)
- ❌ Monthly costs
- ❌ Server maintenance
- ❌ Need to secure bot token

## Setup Guide (5 minutes)

### Step 1: Copy GitHub Actions Workflow

The workflow file is already included:
```
.github/workflows/anonymous-edit.yml
```

This workflow automatically:
1. Watches for issues with `anonymous-edit-request` label
2. Parses edit data from issue body
3. Creates branch and commits changes
4. Opens pull request
5. Comments on issue with PR link
6. Closes issue

**That's it! The workflow is ready to use.**

### Step 2: Configure Wiki

Edit `wiki-config.json`:

```json
{
  "features": {
    "editRequestCreator": {
      "mode": "auto",
      "anonymous": {
        "enabled": true,
        "mode": "serverless",
        "attributionFormat": "Contributed anonymously via wiki editor"
      },
      "permissions": {
        "requireAuth": false
      }
    }
  }
}
```

**Key settings:**
- `anonymous.enabled: true` - Enables anonymous editing
- `anonymous.mode: "serverless"` - Uses GitHub Actions (not server)
- `requireAuth: false` - Allows unauthenticated access

### Step 3: Enable Issues (if disabled)

1. Go to repository Settings
2. Scroll to "Features"
3. Check ✅ "Issues"
4. Save

### Step 4: Test It!

1. **Open wiki in incognito window** (not logged in)
2. Click "Edit" on any page
3. Choose "Edit Anonymously"
4. Make a small edit
5. Submit

**You should see:**
- Loading message: "Creating edit request..."
- Then: "Waiting for GitHub Actions to process..."
- Then: "Processing edit request..."
- Finally: Success screen with PR link

**Check GitHub:**
- Go to your repo's Issues
- You'll see a closed issue: "[Anonymous Edit] Page Title"
- Check Pull Requests → New PR created by `github-actions[bot]`

## How It Works (Technical)

### Issue Format

When a user submits anonymously, the frontend creates an issue:

**Title:**
```
[Anonymous Edit] Getting Started
```

**Body:**
```markdown
## Anonymous Edit Request

This is an automated issue created by the wiki editor.

**DO NOT EDIT THIS ISSUE**

### Edit Data

```json
{
  "section": "getting-started",
  "pageId": "first-steps",
  "content": "# First Steps\n\n...",
  "editSummary": "Fixed typo",
  "filePath": "content/getting-started/first-steps.md",
  "metadata": {
    "id": "first-steps",
    "title": "First Steps"
  }
}
```
```

**Labels:**
```
anonymous-edit-request
```

### Workflow Processing

The workflow (`anonymous-edit.yml`):

1. **Triggers** on `issues.opened` event
2. **Checks** if issue has `anonymous-edit-request` label
3. **Parses** JSON data from issue body
4. **Validates** data (prevents path traversal, etc.)
5. **Creates** branch: `wiki-edit/{section}/{pageId}-anonymous-{timestamp}`
6. **Commits** changes with attribution
7. **Opens** PR from branch to main
8. **Adds labels**: `wiki-edit`, `anonymous`, `documentation`
9. **Comments** on issue with PR details
10. **Closes** issue

### Frontend Polling

The frontend (`anonymousEdits.js`):

1. Creates issue
2. Waits 3 seconds (Actions startup)
3. Polls issue every 2 seconds (max 30 attempts = 60 seconds)
4. Looks for comment from `github-actions[bot]`
5. Extracts PR number and URL
6. Returns result to user

If timeout (60 seconds), user gets error but can check issue manually.

## Configuration Options

### Mode Setting

```json
"anonymous": {
  "mode": "server"       // Use Express server (real-time)
  "mode": "serverless"   // Use GitHub Actions (15-40s delay)
}
```

### Attribution Format

```json
"anonymous": {
  "attributionFormat": "Contributed anonymously via wiki editor"
}
```

This text appears in:
- PR body
- Commit message
- Issue comments

### Polling Settings

In `anonymousEdits.js`, you can adjust:

```javascript
await pollIssueForResult(
  owner,
  repo,
  issueNumber,
  30,    // maxAttempts (default: 30 x 2s = 60s)
  2000   // interval in ms (default: 2000ms = 2s)
);
```

## Troubleshooting

### "Failed to submit anonymous edit request"

**Check:**
1. Issues are enabled in repository
2. User can create issues (public repo or repo access)
3. Check browser console for errors

### "Edit request processing timeout"

**Causes:**
- GitHub Actions taking longer than 60 seconds
- Workflow failed
- Issue was manually deleted

**Solution:**
1. Check the issue manually
2. Look for comment from `github-actions[bot]`
3. Check Actions tab for workflow run
4. Increase polling timeout if needed

### No PR created

**Check Actions tab:**
1. Go to repository → Actions
2. Find "Process Anonymous Edit Request" workflow
3. Check latest run for errors

**Common causes:**
- Invalid JSON in issue body
- Path traversal attempt (security block)
- Branch already exists
- File conflicts

### Issues not auto-closing

**Check workflow:**
- Workflow has `issues: write` permission
- Issue has `anonymous-edit-request` label
- No errors in workflow run

## Security

### Built-in Security Features

1. **Label requirement** - Only processes issues with special label
2. **Path validation** - Prevents `..` and absolute paths
3. **Content validation** - Checks required fields
4. **Bot-only commits** - Uses `github-actions[bot]` account
5. **No secrets needed** - Uses built-in `GITHUB_TOKEN`

### Rate Limiting

GitHub Actions provides automatic rate limiting:
- Maximum runs per workflow
- Concurrent workflow limits
- Per-repository limits

No additional rate limiting needed.

### Abuse Prevention

**Recommended:**
1. Enable branch protection on `main`
2. Require PR reviews before merge
3. Add CODEOWNERS file
4. Monitor Issues for spam
5. Use GitHub's abuse reporting

**Optional:**
1. Require issue templates
2. Add auto-moderation (GitHub Apps)
3. Limit anonymous edits to specific sections

## Moderation Queue

You can add a moderation step:

### Option 1: Manual Review

All anonymous PRs are just regular PRs - review before merging.

### Option 2: Draft PRs

Modify workflow to create draft PRs:

```yaml
- name: Create pull request
  run: |
    gh pr create \
      --title "$PR_TITLE" \
      --body "$PR_BODY" \
      --head "$BRANCH_NAME" \
      --base main \
      --draft  # Create as draft
```

Then manually mark as "Ready for review" after moderation.

### Option 3: Auto-Label for Review

Add label `needs-moderation` to all anonymous PRs, then use GitHub filters.

## Switching Between Modes

You can switch between server and serverless modes anytime:

### Switch to Serverless

```json
{
  "anonymous": {
    "enabled": true,
    "mode": "serverless"
  }
}
```

### Switch to Server

```json
{
  "anonymous": {
    "enabled": true,
    "mode": "server",
    "serverEndpoint": "http://localhost:3001/api/anonymous-edit"
  }
}
```

No code changes needed - just update config!

## GitHub Actions Limits

**Free tier (public repos):**
- ✅ Unlimited minutes
- ✅ Unlimited workflows

**Free tier (private repos):**
- 2,000 minutes/month
- About 500-1000 anonymous edits/month

**Paid plans:**
- 3,000+ minutes/month
- More than enough for most wikis

Each anonymous edit uses ~2-5 minutes of Actions time.

## Advanced: Customizing the Workflow

You can modify `.github/workflows/anonymous-edit.yml`:

### Add CAPTCHA Verification

Before creating PR, verify CAPTCHA token from issue body.

### Add Content Filters

Check for spam keywords, links, etc.

### Custom Branch Names

Change branch naming convention.

### Notifications

Add Slack/Discord notifications when PRs are created.

### Auto-Merge for Trusted Users

If user has made X successful contributions, auto-merge small edits.

## Comparison: Server vs Serverless

| Feature | Serverless | Server |
|---------|-----------|--------|
| **Response Time** | 15-40s | < 2s |
| **Setup Complexity** | Easy | Medium |
| **Monthly Cost** | $0 | $5-20 |
| **Maintenance** | None | Regular |
| **Scaling** | Automatic | Manual |
| **Audit Trail** | Issues | Server logs |
| **Moderation** | Easy (Issues) | Custom |
| **Rate Limiting** | GitHub | Custom |
| **Best For** | Most wikis | High-traffic wikis |

## Recommendation

**Use Serverless if:**
- You don't want to manage a server
- 15-40 second delay is acceptable
- You want zero hosting costs
- You value simplicity

**Use Server if:**
- You need real-time responses
- You already have hosting
- You expect high traffic (> 1000 edits/month)
- You want custom rate limiting/CAPTCHA

## FAQ

**Q: Can I use both modes?**
A: No, choose one mode at a time. But you can switch anytime by changing config.

**Q: Do anonymous edits count against Actions minutes?**
A: Yes for private repos (2-5 min per edit). Public repos have unlimited Actions minutes.

**Q: Can users see the temporary issues?**
A: Yes, but they're auto-closed immediately. They appear in Issues → Closed.

**Q: Can I delete old anonymous edit issues?**
A: Yes, they're safe to delete after PRs are created.

**Q: What if someone abuses issue creation?**
A: GitHub has built-in rate limiting. You can also use branch protection and PR reviews.

**Q: Can I disable anonymous mode temporarily?**
A: Yes, set `anonymous.enabled: false` in config.

**Q: Does this work with private repositories?**
A: Yes! Uses the same GITHUB_TOKEN as other Actions.

## Need Help?

- Check [README.md](./README.md) for server mode setup
- Check [QUICKSTART.md](./QUICKSTART.md) for 10-minute setup
- Review `.github/workflows/anonymous-edit.yml` for workflow details
- Check GitHub Actions logs for debugging

---

**Ready to enable serverless anonymous edits?** Just update your wiki-config.json and you're done! 🎉
