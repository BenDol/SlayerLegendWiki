# Label Management System

This document describes the centralized label management system for the wiki repository.

## Overview

The wiki uses GitHub labels extensively for organizing:
- Issue comments on wiki pages
- Pull requests for content edits
- Anonymous edit requests
- Section categorization
- Status tracking for automated processes

**Problem:** Regular users without write access cannot create labels, which causes failures when they try to comment on a page for the first time or perform other actions that require labels.

**Solution:** A centralized label configuration file (`wiki-framework/.github/labels.json`) combined with a GitHub Action that automatically ensures all required labels exist in the repository.

## Architecture

```
wiki-framework/.github/
└── labels.json                   # Single source of truth for all labels (in framework)

.github/workflows/
└── sync-labels.yml              # GitHub Action to sync labels (in parent project)

scripts/
└── syncLabels.js                # Script to read labels.json and sync to GitHub (in parent project)

wiki-framework/src/services/github/
└── issueLabels.js               # Framework label constants and helpers
```

## Label Configuration File

**Location:** `wiki-framework/.github/labels.json`

This JSON file defines all labels used by the wiki with:
- `name` - Label name (e.g., "wiki-comments")
- `description` - Human-readable description
- `color` - Hex color code (without #)

### Label Categories

1. **Type Labels** - What kind of issue/PR
   - `wiki:anonymous-edit` - Anonymous edit requests
   - `wiki:comment` - Comment discussions
   - `wiki:edit` - Content contributions
   - `wiki-comments` - Comment collection issues
   - `wiki-edit` - Content edit pull requests

2. **Section Labels** - Which wiki section
   - `section:getting-started`
   - `section:characters`
   - `section:equipment`
   - `section:companions`
   - `section:skills`
   - `section:content`
   - `section:progression`
   - `section:resources`
   - `section:guides`
   - `section:database`
   - `section:tools`
   - `section:meta`

3. **Status Labels** - Processing state
   - `status:processing` - Being processed by automation
   - `status:completed` - Successfully completed
   - `status:failed` - Failed and needs attention

4. **Additional Labels**
   - `anonymous` - Anonymous contribution
   - `documentation` - Documentation updates
   - `automated` - Created by automation

5. **Branch Labels** - Namespace isolation
   - `branch:main` - Main branch items
   - `branch:dev` - Development branch items
   - `branch:staging` - Staging branch items
   - Dynamic branches supported via pattern in config

## GitHub Action Workflow

**Location:** `.github/workflows/sync-labels.yml`

### Trigger Conditions

The label sync runs automatically when:
1. **Push to main** - When the workflow file or wiki-framework submodule changes
2. **Weekly schedule** - Every Sunday at 00:00 UTC
3. **Manual dispatch** - Via GitHub Actions UI

### Permissions

The workflow requires:
- `issues: write` - To create and update labels
- `contents: read` - To read the labels.json file from submodule

### What It Does

1. Checks out the repository (with submodules)
2. Installs Node.js and dependencies (@octokit/rest)
3. Runs `scripts/syncLabels.js` which:
   - Reads `wiki-framework/.github/labels.json`
   - Fetches existing labels from GitHub
   - Creates missing labels
   - Updates existing labels if color/description changed
   - Reports statistics

## Adding New Labels

When you need to add a new label to the system:

### Step 1: Update labels.json

Edit `wiki-framework/.github/labels.json` and add your new label:

```json
{
  "labels": [
    ...existing labels...,
    {
      "name": "your-new-label",
      "description": "Description of what this label means",
      "color": "0075ca"
    }
  ]
}
```

### Step 2: Update Framework Constants (if needed)

If your label is used by the framework code, add it to `wiki-framework/src/services/github/issueLabels.js`:

```javascript
export const WIKI_LABELS = {
  types: [
    ...existing labels...,
    {
      name: 'your-new-label',
      description: 'Description of what this label means',
      color: '0075ca',
    },
  ],
};
```

### Step 3: Commit and Push

```bash
cd wiki-framework
git add .github/labels.json
git commit -m "Add new label: your-new-label"
cd ..
git add wiki-framework
git commit -m "Update framework with new label"
git push
```

The GitHub Action will automatically run when the submodule is updated and create the label in your repository!

### Step 4: Verify

1. Go to your repository on GitHub
2. Navigate to Issues → Labels
3. Confirm your new label appears with the correct color and description

## Manual Label Sync

You can manually trigger the label sync without pushing code:

1. Go to **Actions** tab in your GitHub repository
2. Select **Sync Repository Labels** workflow
3. Click **Run workflow** button
4. Select branch (usually `main`)
5. Click **Run workflow**

## Testing Locally

You can test the label sync script locally before pushing:

```bash
# Set environment variables
export GITHUB_TOKEN=your_github_token
export REPOSITORY=owner/repo

# Run the sync script
node scripts/syncLabels.js
```

This will show you exactly what labels would be created/updated without requiring a push to GitHub.

## Label Usage in Code

### Creating Comment Issues

When creating a comment issue (in `comments.js`):

```javascript
await octokit.rest.issues.create({
  title: `Comments: ${pageTitle}`,
  labels: ['wiki-comments', `branch:${branch}`],
  ...
});
```

### Creating Pull Requests

When creating a PR for wiki edits (in `pullRequests.js`):

```javascript
await addPRLabels(owner, repo, pr.number, ['wiki-edit', 'documentation']);
```

### Using Helper Functions

The `issueLabels.js` file provides helper functions:

```javascript
import { getAnonymousEditLabels, getWikiCommentLabels } from './issueLabels.js';

// Get labels for anonymous edit
const editLabels = getAnonymousEditLabels('characters', 'main');
// Returns: ['wiki:anonymous-edit', 'wiki:edit', 'section:characters',
//           'anonymous', 'automated', 'status:processing', 'branch:main']

// Get labels for comment
const commentLabels = getWikiCommentLabels('skills', 'main');
// Returns: ['wiki:comment', 'wiki-comments', 'section:skills',
//           'automated', 'branch:main']
```

## Troubleshooting

### Labels Not Created

If labels aren't being created automatically:

1. **Check workflow runs:**
   - Go to Actions tab → Sync Repository Labels
   - Check recent workflow runs for errors

2. **Verify permissions:**
   - Workflow needs `issues: write` permission
   - Check repository settings → Actions → General → Workflow permissions

3. **Check wiki-framework/.github/labels.json syntax:**
   - Must be valid JSON
   - All labels need `name`, `description`, and `color` fields
   - Colors should be hex codes without `#`

4. **Manual trigger:**
   - Try manually running the workflow from Actions tab

### User Still Can't Comment

If users still get errors when commenting:

1. **Verify labels exist:**
   - Go to Issues → Labels
   - Check that `wiki-comments` and `branch:main` exist

2. **Check branch labels:**
   - If using custom branches, ensure they're in wiki-framework/.github/labels.json
   - Branch labels follow pattern: `branch:your-branch-name`

3. **Re-run sync:**
   - Manually trigger the workflow from Actions tab
   - Check the logs for any failures

### Label Sync Fails

If the sync script fails:

1. **Check GitHub token:**
   - Ensure `GITHUB_TOKEN` has correct permissions
   - For manual runs, ensure your PAT has `repo` scope

2. **Check API rate limits:**
   - GitHub API has rate limits
   - Sync runs weekly to stay within limits

3. **Check logs:**
   - Workflow logs show detailed error messages
   - Look for 403 (permissions) or 422 (validation) errors

## Best Practices

1. **Always update wiki-framework/.github/labels.json first** - This is the single source of truth

2. **Use consistent naming** - Follow existing patterns:
   - Type labels: `wiki:type` or `wiki-type`
   - Section labels: `section:section-name`
   - Status labels: `status:state`
   - Branch labels: `branch:branch-name`

3. **Choose meaningful colors** - Use colors that make sense:
   - Green for success/completion
   - Red for errors/failures
   - Yellow for warnings/processing
   - Blue for information
   - Purple for special types

4. **Write clear descriptions** - Descriptions help users understand what labels mean

5. **Test before committing** - Run the sync script locally to catch errors early

6. **Don't manually create labels** - Always use wiki-framework/.github/labels.json to ensure consistency

## Integration with Wiki Features

### Comments System

When a user comments on a wiki page for the first time:
1. System checks if comment issue exists for that page
2. If not, creates new issue with labels: `['wiki-comments', 'branch:main']`
3. Labels must exist or creation fails
4. GitHub Action ensures labels exist ahead of time

### Edit Requests

When a user edits wiki content:
1. Creates PR with labels: `['wiki-edit', 'documentation']`
2. Labels help filter and organize edit PRs
3. Can filter by section using `section:*` labels

### Anonymous Edits

For anonymous edit requests:
1. Creates issue with comprehensive labels
2. Includes type, section, status, and branch labels
3. Automation uses labels to track processing state

## Future Improvements

Potential enhancements to the label system:

1. **Label validation** - Pre-commit hook to validate labels.json syntax
2. **Automated section detection** - Automatically create section labels from wiki-config.json
3. **Label cleanup** - Remove labels that are no longer in wiki-framework/.github/labels.json (currently only adds/updates)
4. **Custom label sets** - Allow wikis to define custom label categories
5. **Label analytics** - Track label usage statistics

## Related Files

- `wiki-framework/.github/labels.json` - Label configuration (in framework)
- `.github/workflows/sync-labels.yml` - Sync workflow (in parent project)
- `scripts/syncLabels.js` - Sync script (in parent project)
- `wiki-framework/src/services/github/issueLabels.js` - Framework constants
- `wiki-framework/src/services/github/comments.js` - Comment system
- `wiki-framework/src/services/github/pullRequests.js` - PR creation
