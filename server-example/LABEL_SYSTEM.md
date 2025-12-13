# Wiki Label System

Comprehensive label system for organizing and filtering wiki-related issues and pull requests.

## Overview

The wiki uses a **multi-dimensional label system** with three categories:

1. **Type Labels** (`wiki:*`) - What kind of content
2. **Section Labels** (`section:*`) - Which wiki section
3. **Status Labels** (`status:*`) - Processing state

Plus additional context labels (`anonymous`, `documentation`, `automated`).

## Label Categories

### Type Labels

These indicate the type of wiki activity:

| Label | Description | Color | Use Case |
|-------|-------------|-------|----------|
| `wiki:anonymous-edit` | Anonymous edit request | Yellow | Serverless anonymous edits |
| `wiki:comment` | Wiki page comment | Blue | Future comments system |
| `wiki:edit` | Wiki content edit | Purple | All edits (authenticated/anonymous) |

**Filtering examples:**
```
is:issue label:wiki:anonymous-edit
is:pr label:wiki:edit
```

### Section Labels

These indicate which section of the wiki is affected:

| Label | Section | Color |
|-------|---------|-------|
| `section:getting-started` | Getting Started | Light green |
| `section:characters` | Characters | Light red |
| `section:equipment` | Equipment | Light purple |
| `section:companions` | Companions | Light yellow |
| `section:skills` | Skills | Light cyan |
| `section:content` | Content | Light blue |
| `section:progression` | Progression | Light pink |
| `section:resources` | Resources | Lime green |
| `section:guides` | Guides | Lavender |
| `section:database` | Database | Sky blue |
| `section:tools` | Tools | Peach |

**Filtering examples:**
```
is:issue label:section:equipment
is:pr label:section:guides label:wiki:edit
```

### Status Labels

These track the processing state (mainly for serverless mode):

| Label | Description | Color | Meaning |
|-------|-------------|-------|---------|
| `status:processing` | Being processed | Yellow | GitHub Actions is running |
| `status:completed` | Successfully processed | Green | PR created successfully |
| `status:failed` | Processing failed | Red | Error occurred, needs attention |

**Filtering examples:**
```
is:issue label:status:failed
is:issue label:status:processing is:open
```

### Additional Labels

| Label | Description | Color |
|-------|-------------|-------|
| `anonymous` | Anonymous contribution | Purple |
| `documentation` | Documentation updates | Blue |
| `automated` | Created by automation | Light red |

## Label Lifecycle

### Serverless Anonymous Edit

1. **Issue created** → Labels:
   - `wiki:anonymous-edit`
   - `wiki:edit`
   - `section:[section-name]`
   - `anonymous`
   - `automated`
   - `status:processing` (added immediately)

2. **Actions processing** → Status stays: `status:processing`

3. **PR created** → Issue labels updated:
   - Remove: `status:processing`
   - Add: `status:completed`
   - Issue closed

4. **PR labels**:
   - `wiki:edit`
   - `anonymous`
   - `documentation`
   - `automated`
   - `section:[section-name]`

5. **On error** → Issue labels updated:
   - Remove: `status:processing`
   - Add: `status:failed`
   - Issue closed with error comment

## Filtering & Searching

### Common Filters

**All anonymous edits (serverless):**
```
is:issue label:wiki:anonymous-edit
```

**Failed anonymous edits:**
```
is:issue label:wiki:anonymous-edit label:status:failed
```

**Currently processing:**
```
is:issue is:open label:status:processing
```

**Equipment section edits:**
```
is:issue label:section:equipment label:wiki:edit
```

**Anonymous PRs:**
```
is:pr label:anonymous label:wiki:edit
```

**All automated issues/PRs:**
```
label:automated
```

### Advanced Filters

**Failed edits in specific section:**
```
is:issue label:status:failed label:section:equipment
```

**All wiki activity (issues + PRs):**
```
label:wiki:edit OR label:wiki:comment OR label:wiki:anonymous-edit
```

**Anonymous contributions across all sections:**
```
label:anonymous (is:issue OR is:pr)
```

**Recent anonymous edits (last 7 days):**
```
is:issue label:wiki:anonymous-edit created:>7d
```

## Setting Up Labels

### Option 1: Automatic (via serverless mode)

Labels are created automatically when first anonymous edit is submitted:

```javascript
// In anonymousEdits.js
await ensureAllWikiLabels(owner, repo);
```

### Option 2: Manual Setup Script

Use the setup script to create all labels at once:

```bash
cd server-example

# Set environment variables
export GITHUB_TOKEN=your_token
export REPO_OWNER=your_username
export REPO_NAME=your_repo

# Run setup
node setup-labels.js
```

**Output:**
```
======================================================================
  Wiki Label Setup Utility
======================================================================
  Repository: YourUsername/YourRepo
  Total labels: 26
======================================================================

  Processing: wiki:anonymous-edit          ... ✅ Created
  Processing: wiki:comment                  ... ✅ Created
  Processing: wiki:edit                     ... ✅ Created
  Processing: section:getting-started       ... ✅ Created
  ...

======================================================================
  Summary
======================================================================
  ✅ Created:        26
  ✓  Already existed: 0
  ❌ Failed:         0
  📊 Total:          26
======================================================================

  🎉 Success! All labels are set up correctly.
```

### Option 3: GitHub UI

Manual creation via GitHub interface:

1. Go to repository → Issues → Labels
2. Click "New label"
3. Enter:
   - **Name**: `wiki:anonymous-edit`
   - **Description**: `Anonymous wiki edit request - processed automatically`
   - **Color**: `#fbca04` (yellow)
4. Click "Create label"
5. Repeat for all labels

## Label Management

### Updating Label Colors

```bash
# Using GitHub CLI
gh label edit "wiki:anonymous-edit" \
  --color "fbca04" \
  --description "Anonymous wiki edit request - processed automatically"
```

### Deleting Old Labels

If you have old labels from previous systems:

```bash
# Delete old label
gh label delete "anonymous-edit-request" --yes
```

### Bulk Operations

```bash
# List all labels
gh label list

# Export labels to JSON
gh label list --json name,description,color > labels.json

# Delete all wiki labels
gh label list --json name | jq -r '.[].name' | grep 'wiki:' | xargs -I {} gh label delete {} --yes
```

## Issue Templates

Create `.github/ISSUE_TEMPLATE/` files to pre-populate labels:

**Anonymous edit template** (used by automation):
```yaml
name: Anonymous Edit Request
about: Automated issue for processing anonymous edits
labels: ['wiki:anonymous-edit', 'wiki:edit', 'anonymous', 'automated']
```

## Dashboard Views

Create custom label combinations for dashboards:

### Moderation Queue
```
is:open label:wiki:anonymous-edit label:status:processing
```
Shows all anonymous edits currently being processed.

### Failed Edits
```
is:closed label:status:failed
```
Shows all failed edits that need investigation.

### Section Activity
```
label:section:equipment created:>30d
```
Shows all equipment section activity in last 30 days.

### Anonymous Contributions
```
label:anonymous is:merged sort:updated-desc
```
Shows all merged anonymous contributions.

## API Usage

### Get Issues by Label

```javascript
const { data } = await octokit.rest.issues.listForRepo({
  owner: 'username',
  repo: 'repo',
  labels: 'wiki:anonymous-edit,status:failed',
  state: 'all'
});
```

### Add Labels to Issue

```javascript
await octokit.rest.issues.addLabels({
  owner: 'username',
  repo: 'repo',
  issue_number: 123,
  labels: ['wiki:edit', 'section:equipment']
});
```

### Update Status Label

```javascript
// Remove old status
const currentLabels = issue.labels.map(l => l.name);
const statusLabels = ['status:processing', 'status:completed', 'status:failed'];
const labelsToKeep = currentLabels.filter(l => !statusLabels.includes(l));

// Add new status
await octokit.rest.issues.setLabels({
  owner: 'username',
  repo: 'repo',
  issue_number: 123,
  labels: [...labelsToKeep, 'status:completed']
});
```

## Color Scheme

Labels use a consistent color scheme for easy visual identification:

- **Type labels**: Primary colors (yellow, blue, purple)
- **Section labels**: Pastel shades (light versions of various colors)
- **Status labels**: Traffic light colors (yellow, green, red)
- **Context labels**: Supporting colors (purple, blue, light red)

## Best Practices

### For Maintainers

1. **Set up labels early**: Run `setup-labels.js` when setting up the wiki
2. **Use filters**: Create bookmarks for common filter combinations
3. **Monitor failed edits**: Check `label:status:failed` regularly
4. **Clean up**: Archive/delete old issues after PRs are merged

### For Contributors

1. **Don't remove automation labels**: Labels like `automated`, `anonymous` are added automatically
2. **Section labels are auto-applied**: Based on the page being edited
3. **Status labels change automatically**: Managed by GitHub Actions workflow

### For Developers

1. **Always use label constants**: Use `issueLabels.js` functions, not hardcoded strings
2. **Check label existence**: Use `ensureAllWikiLabels()` before creating issues
3. **Update status atomically**: Remove old status, add new status in same call
4. **Copy section label to PRs**: Transfer section label from issue to PR

## Troubleshooting

### Labels not appearing on issues

**Check:**
1. Label exists in repository: `gh label list | grep wiki:`
2. Label name is exact match (case-sensitive)
3. User has permission to add labels

**Fix:**
```bash
node setup-labels.js  # Recreate all labels
```

### Wrong section label

**Cause:** Section ID doesn't match label
**Fix:** Update `issueLabels.js` with correct section mapping

### Status label not updating

**Cause:** Workflow failure or permission issue
**Check:** Actions logs for errors

## Future Enhancements

Potential additions to label system:

- **Priority labels**: `priority:high`, `priority:low`
- **Size labels**: `size:small`, `size:large` (based on line changes)
- **Language labels**: `lang:en`, `lang:es` (for multi-language wikis)
- **Quality labels**: `quality:needs-review`, `quality:verified`

## Related Files

- `wiki-framework/src/services/github/issueLabels.js` - Label definitions & utilities
- `wiki-framework/src/services/github/anonymousEdits.js` - Uses labels for issues
- `.github/workflows/anonymous-edit.yml` - Updates status labels
- `server-example/setup-labels.js` - Label setup utility

---

**Need help with labels?**

- Check existing labels: `gh label list`
- Run setup script: `node server-example/setup-labels.js`
- See examples above for filtering
