# GitHub Issue Backups

This directory contains monthly backups of all open GitHub issues.

## Backup Strategy

- **Daily**: Uploaded as GitHub Actions artifacts (90-day retention)
- **Monthly**: Committed to this directory (1st day of each month)

## Backup Contents

Each backup includes ALL open issues:
- User-generated data (skill-builds, battle-loadouts, spirit-builds, achievements)
- System cache issues (highscore-cache, user-snapshot, achievement-stats)
- Comment system issues (wiki-comments)
- All other open issues

Each issue includes:
- Issue metadata (number, title, body, labels, state, user, dates)
- All comments (body, user, dates)

## File Format

```json
{
  "metadata": {
    "backupDate": "2025-12-28T02:00:00Z",
    "repository": "owner/repo",
    "totalIssues": 123,
    "totalComments": 456,
    "issueState": "open",
    "version": "1.0.0"
  },
  "issues": [
    {
      "number": 123,
      "title": "Issue title",
      "body": "Issue body",
      "state": "open",
      "labels": [
        {
          "name": "label-name",
          "color": "ff0000",
          "description": "Label description"
        }
      ],
      "user": {
        "login": "username",
        "id": 123,
        "type": "User"
      },
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z",
      "html_url": "https://github.com/owner/repo/issues/123",
      "comments": [
        {
          "id": 456,
          "body": "Comment text",
          "user": {
            "login": "username",
            "id": 123
          },
          "created_at": "2025-01-01T00:00:00Z",
          "updated_at": "2025-01-01T00:00:00Z",
          "html_url": "https://github.com/owner/repo/issues/123#issuecomment-456"
        }
      ]
    }
  ]
}
```

## Restoration

To restore issues from a backup:

1. Parse the JSON file
2. For each issue, create a new issue with original metadata preserved in body
3. For each comment, create comments on the new issue
4. **Note**: Restored issues will have new numbers (original numbers preserved in body)

### Manual Restoration Process

```bash
# Example using GitHub CLI
cat issues-backup-2025-12-28.json | jq -r '.issues[] | "\(.number) \(.title)"'

# For each issue:
gh issue create --title "Restored: <original title>" --body "<original body + metadata>"
```

## Accessing Backups

- **Recent (< 90 days)**: Download from [GitHub Actions artifacts tab](../../actions/workflows/backup-issues.yml)
- **Older**: Browse this directory for monthly backups
- **Latest**: Always available in GitHub Actions artifacts

## Workflow

See [`.github/workflows/backup-issues.yml`](../../.github/workflows/backup-issues.yml) for implementation details.

**Note**: Backup JSON files are gitignored by default to keep the repository clean from daily backups. Monthly commits use `git add -f` to force-add the backup file, overriding gitignore.

## Backup Schedule

- **Time**: Daily at 2 AM UTC
- **Trigger**: Automatic via cron schedule
- **Manual**: Can be triggered manually from Actions tab

## File Naming Convention

- Daily artifacts: `issues-backup` (single artifact name)
- Monthly commits: `issues-backup-YYYY-MM-DD.json`

Example: `issues-backup-2025-12-28.json`
