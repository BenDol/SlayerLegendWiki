# Release Date Filtering

This document explains the centralized release date filtering system that filters out all commits and activity before a configured release date.

## Overview

The release date filtering system provides a **single source of truth** for filtering historical data, ensuring that only activity after the wiki's "official release date" is counted in statistics, highscores, and other date-based features.

## Configuration

### Local Development
Add to your `.env` file:
```env
VITE_RELEASE_DATE=2025-01-01T00:00:00Z
```

### GitHub Actions (Production)
Set as a repository variable:
1. Go to your repository Settings → Secrets and variables → Actions → Variables
2. Click "New repository variable"
3. Name: `VITE_RELEASE_DATE`
4. Value: `2025-01-01T00:00:00Z`

**Format:** ISO 8601 date string (e.g., `2025-01-01T00:00:00Z`)

**Leave empty to include all history.**

## How It Works

### Centralized Utility

All date filtering goes through the centralized utility at:
```
wiki-framework/src/utils/releaseDate.js
```

**Key Functions:**
- `getReleaseDate(config)` - Get the configured release date
- `isAfterRelease(date, config)` - Check if a date is after release
- `filterByReleaseDate(items, dateField, config)` - Filter arrays by date

### Automatic Filtering

The utility is **automatically used** in:

1. **GitHub Actions Workflow** (`update-highscore-cache.yml`)
   - Filters all commits before calculating contributor stats
   - Works for all time periods (All Time, This Month, This Week)

2. **Client-side Code**
   - Any code that processes commits or dates can import the utility
   - Consistent filtering across all features

## Usage Examples

### Client-side (React Components)

```javascript
import { isAfterRelease, filterByReleaseDate } from '../utils/releaseDate';

function MyComponent() {
  // Check if a single date is valid
  const commits = allCommits.filter(commit =>
    isAfterRelease(commit.date)
  );

  // Or filter an array automatically
  const validCommits = filterByReleaseDate(allCommits, 'created_at');

  return <div>...</div>;
}
```

### GitHub Actions (Node.js)

The workflow automatically reads `VITE_RELEASE_DATE` from environment variables and filters all commits:

```javascript
// This is already implemented in the workflow
function filterByReleaseDate(commits) {
  if (!releaseDate) return commits;

  return commits.filter(commit => {
    const commitDate = new Date(commit.commit.author.date);
    return commitDate >= releaseDate;
  });
}
```

## What Gets Filtered

### Contributor Highscore Cache
- **All-time stats:** Only commits after release date
- **This Month stats:** Only commits after release date (within the month)
- **This Week stats:** Only commits after release date (within the week)

### Future Features
Any feature that processes dates should use the `releaseDate` utility to ensure consistency.

## Benefits

1. **No Code Duplication** - Single utility function used everywhere
2. **No Manual Updates** - Change the date once, affects all features
3. **Automatic** - Developers don't need to remember to check the date
4. **Consistent** - Same filtering logic across client and server
5. **Optional** - Leave empty to include all history

## Logging

The utility logs when filtering is active:

**Client-side:**
```
[ReleaseDate] Using release date from VITE_RELEASE_DATE: 2025-01-01T00:00:00Z
[ReleaseDate] Filtered out 150 item(s) before release date
```

**GitHub Actions:**
```
📅 Release date configured: 2025-01-01T00:00:00Z
   Only activity after this date will be counted
   📅 Filtered out 42 commit(s) before release date
```

## Testing

To test the filtering:

1. Set a recent date as the release date
2. Run the highscore workflow
3. Check the logs for filtered commit counts
4. Verify contributors before the date are excluded

## Maintenance

**To change the release date:**
1. Update `VITE_RELEASE_DATE` in your local `.env` file
2. Update `VITE_RELEASE_DATE` in your repository variables (Settings → Actions → Variables)
3. Clear the highscore cache (click Refresh on highscore page)
4. The GitHub Actions workflow will use the new date on next run

**No code changes required!**
