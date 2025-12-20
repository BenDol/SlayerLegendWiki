# GitHub Cleanup Workflows

This directory contains GitHub Actions workflows for permanently deleting closed issues and pull requests.

## ⚠️ Important Warnings

- **These deletions are PERMANENT and cannot be undone**
- **Always run with `dry_run: true` first to preview what will be deleted**
- **These workflows can ONLY be executed by the repository owner**
- **These workflows require admin/write permissions on the repository**
- **Deleted items cannot be recovered from GitHub**

## Available Workflows

### 1. Delete Closed Issues (Permanent)
**File**: `delete-closed-issues-graphql.yml`

Permanently deletes closed issues using GitHub's GraphQL API.

**Features**:
- Exclude issues by label (default: `wiki-comments`)
- Filter by closed date (only delete old issues)
- Dry run mode
- Rate limit handling

### 2. Delete Closed Pull Requests (Permanent)
**File**: `delete-closed-pull-requests.yml`

Permanently deletes closed pull requests.

**Features**:
- Filter by state (closed only, merged only, or all)
- Exclude PRs by author (e.g., `dependabot`, `renovate`)
- Filter by closed date (default: 30 days)
- Dry run mode
- Rate limit handling

### 3. Delete All Closed Items (Issues + PRs)
**File**: `delete-closed-all.yml`

Combined workflow to delete both issues and pull requests in one operation.

**Features**:
- Toggle deletion of issues/PRs independently
- All filtering options from both workflows
- Single comprehensive report
- Dry run mode

## How to Use

### Step 1: Navigate to Actions

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Select the workflow you want to run from the left sidebar

### Step 2: Configure Options

Click **Run workflow** and configure:

#### Common Options (All Workflows)

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `confirm` | Confirmation text (must type exactly) | - | `PERMANENTLY DELETE` or `PERMANENTLY DELETE ALL` |
| `dry_run` | Preview mode (no actual deletion) | `true` | `true` (always start with this!) |
| `older_than_days` | Only delete items closed X days ago | `30` | `90` (3 months) |

#### Issue-Specific Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `exclude_labels` | Labels to protect | `wiki-comments` | `wiki-comments,keep,important` |

#### PR-Specific Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `state_filter` | Which PRs to delete | `all` | `closed` (not merged) or `merged` |
| `exclude_authors` | Authors to exclude | - | `dependabot,renovate` |

#### Combined Workflow Options

| Option | Description | Default |
|--------|-------------|---------|
| `delete_issues` | Delete issues | `true` |
| `delete_pull_requests` | Delete PRs | `true` |

### Step 3: Run Dry Run First

1. Set `dry_run: true`
2. Click **Run workflow**
3. Wait for completion
4. Review the output carefully
5. Check the job summary for statistics

### Step 4: Execute Deletion

**Only after reviewing the dry run output:**

1. Set `dry_run: false`
2. Type the confirmation text exactly (case-sensitive!)
3. Click **Run workflow**
4. Monitor the execution

## Example Workflows

### Example 1: Clean Up Old Closed PRs (Not Merged)

Use: `delete-closed-pull-requests.yml`

```yaml
confirm: "PERMANENTLY DELETE"
dry_run: true  # Start with dry run!
state_filter: closed  # Only unmerged PRs
older_than_days: 90  # Only PRs closed >90 days ago
exclude_authors: ""  # No exclusions
```

### Example 2: Clean Up Issues (Except Wiki Comments)

Use: `delete-closed-issues-graphql.yml`

```yaml
confirm: "PERMANENTLY DELETE"
dry_run: true  # Start with dry run!
exclude_labels: "wiki-comments,keep,wontfix"
older_than_days: 30  # Only issues closed >30 days ago
```

### Example 3: Full Cleanup (Issues + PRs)

Use: `delete-closed-all.yml`

```yaml
confirm: "PERMANENTLY DELETE ALL"
dry_run: true  # Start with dry run!
delete_issues: true
delete_pull_requests: true
exclude_issue_labels: "wiki-comments"
exclude_pr_authors: "dependabot,renovate"
older_than_days: 60
pr_state_filter: all
```

## Understanding the Output

### Console Output

The workflow logs will show:
- `🔍 Would delete #123: Title` - Dry run (item would be deleted)
- `✅ Deleted #123: Title` - Item was deleted
- `⏭️ Skipping #123: Reason` - Item was skipped and why
- `❌ Failed to delete #123: Error` - Deletion failed

### Job Summary

After completion, check the **Summary** tab for:
- Total items found
- Total items deleted
- Total items skipped (with breakdown by reason)

## Rate Limiting

The workflows handle GitHub's rate limits:
- 200ms delay between individual deletions
- 2 second delay between pages
- Automatic retry on rate limit errors (10 second wait)

If you encounter rate limits:
- Run the workflow during off-peak hours
- Delete in smaller batches (use `older_than_days` to limit scope)
- Wait 10-15 minutes between runs

## Troubleshooting

### Error: "Access denied. Only the repository owner can execute this workflow"

**Cause**: You are not the repository owner

**Fix**: Only the repository owner can run these workflows. If you need to delete items:
- Ask the repository owner to run the workflow
- Or: Have the owner transfer ownership to you temporarily

### Error: "Resource not accessible by integration"

**Cause**: Token lacks required permissions

**Fix**: Ensure the workflow has `issues: write` and/or `pull-requests: write` permissions (these are set in the workflow files)

### Error: "Deletion not confirmed"

**Cause**: Confirmation text doesn't match exactly

**Fix**: Type the exact text shown (case-sensitive):
- Issues: `PERMANENTLY DELETE`
- PRs: `PERMANENTLY DELETE`
- Combined: `PERMANENTLY DELETE ALL`

### Error: "Secondary rate limit triggered"

**Cause**: Too many deletions too quickly

**Fix**: The workflow will automatically retry after 10 seconds. If it continues failing, stop the workflow and run it again later.

## Best Practices

1. **Always dry run first** - Never skip this step
2. **Review carefully** - Check what will be deleted before confirming
3. **Start small** - Use `older_than_days` to delete old items first
4. **Protect important items** - Use labels/author exclusions liberally
5. **Keep logs** - Download workflow logs for records
6. **Schedule off-peak** - Run during low-traffic periods to avoid rate limits

## Permissions Required

These workflows need:
- **Repository owner status** (enforced at workflow level)
- Repository admin or write access
- `issues: write` permission for issue deletion
- `pull-requests: write` permission for PR deletion

### Security: Owner-Only Execution

**All deletion workflows are restricted to the repository owner only.**

This means:
- Only the user who owns the repository can trigger these workflows
- Organization members (even with admin access) cannot run them
- Collaborators cannot run them, regardless of their permission level

If someone other than the owner attempts to run the workflow, it will fail immediately with:
```
❌ Access denied. Only the repository owner can execute this workflow.
   Actor: username
   Owner: repository_owner
```

**Why this restriction?**
- Permanent deletion is irreversible and requires maximum authorization
- Prevents accidental or malicious deletion by collaborators
- Ensures only the person with ultimate responsibility can execute destructive operations

## Recovery

**There is no recovery.** Once deleted via GraphQL API, items are permanently removed from GitHub. The only "backup" is:
- Your local git history (code changes)
- External archives/backups
- GitHub's audit log (shows what was deleted, but cannot restore)

## Alternative: Archiving Instead of Deleting

If you're unsure about permanent deletion, consider:
1. **Label approach**: Add a `archived` label instead of deleting
2. **Close as "not planned"**: Mark issues with this reason
3. **Lock conversations**: Prevent further activity without deletion
4. **Export first**: Use GitHub's archive feature to export data

## Support

If you need help:
- Check the workflow logs for detailed error messages
- Review GitHub's documentation on Issues/PR APIs
- Ensure you have the required permissions
