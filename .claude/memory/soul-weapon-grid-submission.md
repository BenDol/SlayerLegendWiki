# Soul Weapon Engraving Grid Submission System

## Overview

The Soul Weapon Engraving Grid Submission System allows users to contribute grid layout data for soul weapons that don't yet have grid information in `soul-weapon-grids.json`. This crowdsources community knowledge while maintaining data quality through GitHub issue tracking.

## Architecture

### Data Flow

1. **Grid Detection**: When a weapon is selected, the system checks if it has `activeSlots` data
2. **Designer Mode**: If no grid data exists, Grid Designer mode is shown
3. **User Input**: User toggles cells to mark active slots, enters completion effects
4. **Submission**: Data is submitted via Netlify function using bot token
5. **GitHub Storage**: Submissions stored in GitHub issues with weapon-specific labels
6. **Loading**: Existing submissions are loaded and displayed to users

### Components Involved

#### Frontend (`SoulWeaponEngravingBuilder.jsx`)

**State Variables:**
- `isGridDesigner` - Tracks if in designer mode
- `designerGrid` - 2D array representing the grid cells (active/inactive)
- `gridType` - '4x4' or '5x5' grid size
- `completionAtk` - ATK% completion effect input
- `completionHp` - HP% completion effect input
- `existingSubmissions` - Array of loaded submissions from GitHub
- `selectedSubmissionIndex` - Which submission is currently displayed
- `loadingSubmissions` - Loading state for submissions
- `submitting` - Submission in progress state

**Key Functions:**
- `weaponHasGridData()` - Checks if weapon has activeSlots array
- `initializeGrid()` - Enters designer mode if no grid data exists
- `initializeDesignerGrid()` - Creates empty grid based on gridType
- `toggleDesignerCell(row, col)` - Toggles cell active/inactive state
- `loadExistingSubmissions()` - Searches GitHub for weapon submissions
- `loadSubmissionIntoDesigner(submission)` - Loads submission into designer grid
- `submitGridLayout(replace)` - Submits grid to Netlify function

#### Backend (`netlify/functions/save-data.js`)

**New Type: `grid-submission`**

Configuration:
```javascript
'grid-submission': {
  label: 'engraving-grid-submissions',
  titlePrefix: '[Engraving Grid Submissions]',
  maxItems: null, // No limit
  itemName: 'submission',
  itemsName: 'submissions',
  weaponCentric: true, // Weapon-centric vs user-centric
}
```

**Handler Function: `handleGridSubmission()`**

Parameters:
- `octokit` - Authenticated Octokit instance (bot token)
- `owner` - Repository owner
- `repo` - Repository name
- `config` - Type configuration
- `data` - Submission data
- `username` - User's GitHub username (or null for anonymous)
- `replace` - Boolean flag to prepend (replace) or append

Process:
1. Adds metadata (submittedBy, submittedAt) to submission
2. Searches for existing issue with `weapon:${weaponName}` label
3. Formats submission as comment body with JSON code block
4. If issue exists:
   - **replace=true**: Updates first comment (replaces primary layout)
   - **replace=false**: Creates new comment (adds alternative submission)
5. If no issue exists:
   - Creates new issue with description only (no submission in body)
   - Creates first comment with submission data
   - Adds labels: `engraving-grid-submissions`, `weapon:${weaponName}`

## Data Format

### Submission Object

```json
{
  "weaponId": 1,
  "weaponName": "Innocence",
  "gridType": "4x4",
  "completionEffect": {
    "atk": "2%",
    "hp": "5.6%"
  },
  "activeSlots": [
    { "row": 0, "col": 0 },
    { "row": 0, "col": 1 },
    // ... more slots
  ],
  "totalActiveSlots": 12,
  "submittedBy": "username",
  "submittedAt": "2025-12-18T10:30:00.000Z"
}
```

### GitHub Issue Format

**Title:** `[Engraving Grid Submissions] Innocence`

**Labels:**
- `engraving-grid-submissions` - Main category label
- `weapon:Innocence` - Weapon-specific label

**Body (Description Only):**
```markdown
This issue tracks community-submitted engraving grid layouts for **Innocence**.

The first comment is used as the primary layout in the builder.

Each comment represents a different submission.
```

**Comments (Submissions):**

Comment #1 (Primary Layout):
```markdown
Submitted by **username** on 2025-12-18T10:30:00.000Z

```json
{
  "weaponId": 1,
  "weaponName": "Innocence",
  "gridType": "4x4",
  "completionEffect": { "atk": "2%", "hp": "5.6%" },
  "activeSlots": [{"row": 0, "col": 0}, ...],
  "totalActiveSlots": 12,
  "submittedBy": "username",
  "submittedAt": "2025-12-18T10:30:00.000Z"
}
```
```

Comment #2 (Alternative Submission):
```markdown
Submitted by **anotheruser** on 2025-12-18T11:00:00.000Z

```json
{
  // ... alternative submission data
}
```
```

## Features

### 1. Anonymous Submissions

Users don't need to be authenticated to submit grids:
- Authenticated users: Username is attached to submission
- Anonymous users: "Anonymous" is used as submitter name
- Bot token handles all GitHub operations server-side

### 2. Multiple Submissions Per Weapon

- Each weapon can have multiple submissions from different users
- All submissions stored in the same issue (one issue per weapon)
- **Each submission is a separate comment** (not in issue body)
- Avoids issue body character limit (60k+ chars)

### 3. Primary Layout System

- **First comment** on the issue is the primary layout
- Primary layout is displayed when weapon is selected
- Other submissions are available but not shown by default
- Issue body contains only a description, no submission data

### 4. Submit and Replace

- "Submit and Replace" button **updates the first comment**
- Makes new submission the primary layout
- Old primary is completely replaced (not moved to second position)
- Useful for correcting errors or updating with better data
- Regular submit creates a new comment (alternative submission)

### 5. Existing Submission Indication

- Warning shown when submissions already exist for weapon
- Shows count of existing submissions
- Loads and displays primary submission in designer

### 6. Issue Deletion/Cleanup

- **Closed issues are treated as deleted**
- Only open issues are loaded and displayed
- If an issue is closed (manually or by maintainer), it will be ignored
- Next submission will create a brand new issue
- Useful for removing spam or incorrect submissions

## UI Components

### Grid Designer Mode

Located in `SoulWeaponEngravingBuilder.jsx` around lines 2771-2920.

**Header:**
- Title: "Grid Designer Mode"
- Explanation text
- Warning if submissions already exist

**Grid Size Selector:**
- Two buttons: "4x4" and "5x5"
- Changes grid dimensions and reinitializes grid

**Interactive Grid:**
- Click cells to toggle active/inactive
- Active cells: Blue background with checkmark
- Inactive cells: Gray background
- Shows active slot counter below grid

**Completion Effects:**
- Two text inputs: ATK% and HP%
- Placeholder examples: "e.g., 2% or 2.5%"

**Submit Buttons:**
1. **Submit Grid Layout** (Green)
   - Appends submission to end
   - Always visible
2. **Submit and Replace** (Orange)
   - Prepends submission to make it primary
   - Only visible when existing submissions exist

**Status Messages:**
- Anonymous submission notice (if not authenticated)
- Loading indicator while fetching submissions
- Success/error alerts after submission

## API Endpoints

### Submit Grid Layout

**Endpoint:** `POST /.netlify/functions/save-data`

**Request Body:**
```json
{
  "type": "grid-submission",
  "username": "githubuser",
  "userId": 12345,
  "data": {
    "weaponId": 1,
    "weaponName": "Innocence",
    "gridType": "4x4",
    "completionEffect": { "atk": "2%", "hp": "5.6%" },
    "activeSlots": [{"row": 0, "col": 0}],
    "totalActiveSlots": 12
  },
  "replace": false
}
```

**Response (Success):**
```json
{
  "success": true,
  "action": "created" | "added" | "replaced",
  "issueNumber": 123,
  "issueUrl": "https://github.com/owner/repo/issues/123"
}
```

**Response (Error):**
```json
{
  "error": "Error message",
  "details": { /* GitHub API error details */ }
}
```

## Loading Existing Submissions

### Search Process

1. Search GitHub **OPEN** issues with labels: `engraving-grid-submissions` and `weapon:${weaponName}`
   - **Closed issues are considered deleted** and ignored
   - If an issue is closed, a new one will be created on next submission
2. Find the issue for the current weapon (should be only one open issue)
3. Fetch all comments on that issue via GitHub API
4. Parse JSON code blocks from each comment
5. First comment is the primary submission
6. Load primary submission into designer

### Submission Parsing

Regular expression: `/```json\n([\s\S]*?)\n```/`

- Extracts JSON code block from each comment body
- Parses each block as submission object
- First comment (index 0) is the primary/active layout
- Additional comments are alternative submissions

## Environment Variables

Required in Netlify:
- `WIKI_BOT_TOKEN` - GitHub Personal Access Token (bot account)
- `WIKI_REPO_OWNER` - Repository owner (e.g., "BenDol")
- `WIKI_REPO_NAME` - Repository name (e.g., "SlayerLegendWiki")

## Error Handling

### Validation Errors

- Missing completion effects → Alert: "Please enter both ATK and HP completion effects"
- No active slots → Alert: "Please select at least one active cell"
- Missing configuration → Alert: "Cannot submit grid layout: missing configuration"

### Network Errors

- GitHub API failures logged to console
- User-friendly error alert shown
- Submission button re-enabled after error

### Loading Errors

- Failed submission loads logged to console
- Empty submissions array fallback
- Loading indicator cleared on error

## Integration with Weapon Data

### Data Sources

1. **soul-weapons.json** - All 57 weapons (source of truth for weapon list)
2. **soul-weapon-grids.json** - 42 weapons with grid data

### Weapon Detection Logic

```javascript
const weaponHasGridData = () => {
  if (!selectedWeapon) return false;
  return selectedWeapon.activeSlots && Array.isArray(selectedWeapon.activeSlots);
};
```

- Weapons with `activeSlots` array have grid data → Normal mode
- Weapons without `activeSlots` → Designer mode
- All 57 weapons shown in dropdown regardless of grid data

### Weapon Selector Display

Weapons with grid data:
```
Innocence (4x4) - ATK +2%, HP +5.6%
```

Weapons without grid data:
```
Innocence (No Grid Data - Designer Mode)
```

## Future Enhancements

### Potential Improvements

1. **Submission Voting**: Allow users to upvote/downvote submissions
2. **Submission Comparison**: Side-by-side view of multiple submissions
3. **Submission History**: Show all submissions for a weapon with selection UI
4. **Grid Validation**: Server-side validation of grid patterns
5. **Data Migration**: Approved submissions → Automated PR to soul-weapon-grids.json
6. **Submission Comments**: Allow discussion on submissions via issue comments
7. **Admin Approval**: Require maintainer approval before showing submissions

### Technical Debt

1. Consider adding submission ID for tracking
2. Add rate limiting to prevent spam submissions
3. Implement submission editing (currently must replace)
4. Add unit tests for grid validation logic
5. Consider caching submission lists (currently loads every time)

## Testing

### Manual Testing Steps

1. **Designer Mode Activation:**
   - Select weapon without grid data
   - Verify designer UI appears
   - Check grid size selector works

2. **Grid Toggling:**
   - Click cells to toggle active/inactive
   - Verify visual feedback (blue/gray)
   - Check active slot counter updates

3. **Anonymous Submission:**
   - Sign out if authenticated
   - Fill in completion effects
   - Toggle some cells
   - Submit grid layout
   - Verify success message

4. **Authenticated Submission:**
   - Sign in with GitHub
   - Submit grid layout
   - Verify username attached in GitHub issue

5. **Submit and Replace:**
   - Find weapon with existing submission
   - Create new submission
   - Click "Submit and Replace"
   - Verify new submission is first in issue

6. **Load Existing Submissions:**
   - Select weapon with submissions
   - Verify primary submission loads into grid
   - Check completion effects filled in
   - Verify warning message shown

## Related Files

- `src/components/SoulWeaponEngravingBuilder.jsx` - Main component
- `netlify/functions/save-data.js` - Submission handler
- `netlify/functions/README.md` - Function documentation
- `public/data/soul-weapons.json` - All weapons
- `public/data/soul-weapon-grids.json` - Weapons with grid data
- `wiki-framework/src/services/github/api.js` - GitHub API wrapper

## GitHub Labels

Required labels (auto-created by sync-labels workflow):
- `engraving-grid-submissions` - Main category
- `weapon:*` - Per-weapon labels (created dynamically)

Label configuration in `wiki-framework/.github/labels.json`.
