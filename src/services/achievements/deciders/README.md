# Custom Achievement Deciders

This directory contains **game-specific achievement deciders** for Slayer Legend Wiki.

## What are Deciders?

**Deciders** are functions that determine whether a user has unlocked an achievement. They run **server-side** during achievement checks and return `true` if the achievement should be unlocked.

## Plugin Architecture

The achievement system uses a **plugin-based architecture**:

- **Framework** provides default deciders (in `wiki-framework/src/services/achievements/deciders/`)
- **Parent project** (this directory) adds custom deciders
- **Bot service** combines both registries and uses them for checks

## How to Add a Custom Achievement

### 1. Create a Decider Function

Create a file in this directory (e.g., `myAchievements.js`):

```javascript
/**
 * Example: Check if user has saved 50+ builds
 */
export async function buildMaster(userData, context) {
  const { octokit, owner, repo, userId } = context;

  // Query GitHub Issues for user's data
  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: `skill-builds,user-id:${userId}`,
    state: 'open',
    per_page: 100,
  });

  let totalCount = 0;
  for (const issue of issues) {
    try {
      const data = JSON.parse(issue.body);
      totalCount += (data['skill-builds'] || []).length;
    } catch (error) {
      console.error('Failed to parse issue:', error);
    }
  }

  return totalCount >= 50;
}
```

### 2. Export from Index

Add your decider to `index.js`:

```javascript
import * as myAchievements from './myAchievements.js';

export const customDeciders = {
  // ... existing deciders
  'build-master': myAchievements.buildMaster,
};
```

### 3. Add Achievement Definition

Add the achievement to `public/achievements.json`:

```json
{
  "id": "build-master",
  "title": "Build Master",
  "description": "Save 50 skill builds",
  "icon": "🎯",
  "category": "game",
  "rarity": "epic",
  "points": 50
}
```

**That's it!** The bot service automatically loads and uses your custom decider.

## Decider Function Signature

```javascript
/**
 * @param {Object} userData - User data from snapshot
 * @param {Object} userData.user - GitHub user object
 * @param {Object} userData.stats - User stats { totalPRs, mergedPRs, totalAdditions, ... }
 * @param {Array} userData.pullRequests - User's pull requests
 * @param {number} userData.userId - User ID
 * @param {string} userData.username - Username
 *
 * @param {Object} context - Server context
 * @param {Octokit} context.octokit - Authenticated Octokit instance (bot token)
 * @param {string} context.owner - Repository owner
 * @param {string} context.repo - Repository name
 * @param {number} context.userId - User ID (same as userData.userId)
 * @param {string} context.username - Username (same as userData.username)
 *
 * @returns {Promise<boolean>} - True if achievement should be unlocked
 */
async function myDecider(userData, context) {
  // Your logic here
  return true; // or false
}
```

## Available Data

### userData.user (GitHub User)
- `login` - Username
- `id` - User ID
- `avatar_url` - Profile picture
- `created_at` - Account creation date
- ... (all GitHub user fields)

### userData.stats
- `totalPRs` - Total pull requests created
- `mergedPRs` - Total pull requests merged
- `openPRs` - Currently open pull requests
- `closedPRs` - Closed pull requests (not merged)
- `totalAdditions` - Total lines of code added
- `totalDeletions` - Total lines of code deleted
- `totalFiles` - Total files changed

### userData.pullRequests
Array of pull request objects with full PR data.

### context.octokit
Authenticated Octokit instance for querying GitHub API (uses bot token, no rate limits).

### context.releaseDate
Official wiki release date from `VITE_RELEASE_DATE` environment variable. Used to filter out pre-launch data.

**Type:** `Date | null`

**Source:** Set via `VITE_RELEASE_DATE` environment variable (see `.env.example` or `.claude/release-date-filtering.md`)

**Important:** PRs and stats in `userData` are already filtered by this date server-side, so you don't need to filter again in most cases. However, if you're fetching additional data (builds, loadouts, etc.), you may want to respect this date.

**Example:**
```javascript
export async function postLaunchBuilder(userData, context) {
  const { releaseDate } = context;

  // Build must be created after launch
  if (releaseDate) {
    const buildDate = new Date(build.createdAt);
    if (buildDate < releaseDate) return false;
  }

  return true;
}
```

## Best Practices

1. **Keep deciders pure and deterministic** - Same input should always produce same output
2. **Handle errors gracefully** - Return `false` on errors, don't throw
3. **Use bot context for API calls** - `context.octokit` has higher rate limits
4. **Cache expensive operations** - Consider caching if querying multiple issues
5. **Log important decisions** - Use `console.log` or `console.error` for debugging
6. **Test thoroughly** - Achievement unlocks should be reliable

## Example: Time-Based Achievement

```javascript
export async function earlyBird(userData, context) {
  if (!userData.user?.created_at) return false;

  const accountAge = Date.now() - new Date(userData.user.created_at).getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  return accountAge >= thirtyDays;
}
```

## Example: Complex Achievement

```javascript
export async function completionist(userData, context) {
  const { octokit, owner, repo, userId } = context;

  // Must have PRs
  if (userData.stats.totalPRs < 5) return false;

  // Must have builds
  const { data: buildIssues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: `skill-builds,user-id:${userId}`,
    state: 'open',
  });
  if (buildIssues.length === 0) return false;

  // Must have loadouts
  const { data: loadoutIssues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: `battle-loadouts,user-id:${userId}`,
    state: 'open',
  });
  if (loadoutIssues.length === 0) return false;

  return true;
}
```

## Framework Default Deciders

The framework provides these default deciders (no need to implement):

- `first-login` - User logged in
- `first-pr` - Created first pull request
- `pr-novice` - 10+ pull requests
- `pr-expert` - 50+ pull requests
- `pr-master` - 100+ pull requests
- `first-merge` - First PR merged
- `lines-apprentice` - 100+ lines added
- `lines-journeyman` - 1,000+ lines added
- `lines-master` - 10,000+ lines added
- `veteran` - GitHub account 1+ year old

You can override these by defining a custom decider with the same achievement ID.
