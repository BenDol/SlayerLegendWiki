# Achievement Trigger Coverage

This document tracks which achievements have targeted triggers vs periodic checks.

## Legend
- ✅ **Targeted Check**: Triggered immediately after user action with retry logic
- 📅 **Profile View Check**: Checked when user views achievements tab (2-minute cooldown)
- 🔄 **Periodic Check**: Checked by GitHub Action on snapshot updates
- ❌ **Not Implemented**: Infrastructure doesn't exist yet

---

## Contribution Achievements (20 total)

| Achievement | Trigger Type | Trigger Point | Notes |
|-------------|--------------|---------------|-------|
| first-pr | ✅ Targeted | After PR creation | `pullRequests.js:65-91` |
| first-edit | ✅ Targeted | After PR creation | Same as first-pr |
| pr-novice (10 PRs) | ✅ Targeted | After PR creation | Queued with first-pr |
| pr-expert (50 PRs) | ✅ Targeted | After PR creation | Queued with first-pr |
| pr-master (100 PRs) | ✅ Targeted | After PR creation | Queued with first-pr |
| pr-legend (500 PRs) | ✅ Targeted | After PR creation | Queued with first-pr |
| first-merge | 📅 Profile View | Viewing achievements tab | Requires snapshot/stats data |
| merge-novice (10 merges) | 📅 Profile View | Viewing achievements tab | Threshold check |
| merge-expert (50 merges) | 📅 Profile View | Viewing achievements tab | Threshold check |
| merge-master (100 merges) | 📅 Profile View | Viewing achievements tab | Threshold check |
| lines-apprentice (100 lines) | 📅 Profile View | Viewing achievements tab | Threshold check |
| lines-journeyman (1k lines) | 📅 Profile View | Viewing achievements tab | Threshold check |
| lines-master (10k lines) | 📅 Profile View | Viewing achievements tab | Threshold check |
| lines-legend (100k lines) | 📅 Profile View | Viewing achievements tab | Threshold check |
| files-novice (10 files) | 📅 Profile View | Viewing achievements tab | Threshold check |
| files-expert (100 files) | 📅 Profile View | Viewing achievements tab | Threshold check |
| files-master (1k files) | 📅 Profile View | Viewing achievements tab | Threshold check |
| anonymous-contributor | 📅 Profile View | Viewing achievements tab | Checks for anonymous-edit label |
| prolific-editor (10 pages) | 📅 Profile View | Viewing achievements tab | Counts unique files |
| first-pr-closed | 📅 Profile View | Viewing achievements tab | Requires stats data |

**Summary**: 6 targeted, 14 profile view checks

---

## Game Progress Achievements (15 total)

| Achievement | Trigger Type | Trigger Point | Notes |
|-------------|--------------|---------------|-------|
| first-build | ✅ Targeted | After build save | `skillBuilds.js:265-292` |
| build-collector (10 builds) | ✅ Targeted | After build save | Queued with first-build |
| build-master (max builds) | ✅ Targeted | After build save | Queued with first-build |
| skill-theorist (unique builds) | ✅ Targeted | After build save | Queued with first-build |
| completionist (all types) | ✅ Targeted | After build save | Queued with first-build |
| innovative (unique combo) | ✅ Targeted | After build save | Queued with first-build |
| min-maxer (full build) | ✅ Targeted | After build save | Queued with first-build |
| first-loadout | ✅ Targeted | After loadout save | `battleLoadouts.js:268-293` |
| loadout-expert (10 loadouts) | ✅ Targeted | After loadout save | Queued with first-loadout |
| spirit-collector (10 unique spirits) | ✅ Targeted | After spirit save, loadout save | `SpiritBuilder.jsx:706-728`, `battleLoadouts.js:268-293` - Counts unique spiritIds |
| strategist (advanced loadout) | ✅ Targeted | After loadout save | Queued with first-loadout |
| collector (all unique spirits) | ✅ Targeted | After spirit save, loadout save | `SpiritBuilder.jsx:706-728`, `battleLoadouts.js:268-293` - Counts unique spiritIds |
| engraving-expert (10 engravings) | ❌ Not Implemented | No engraving service | Decider exists but returns false |
| build-sharer | ❌ Not Implemented | No sharing tracking | Decider returns false |
| popular-builder (10 views) | ❌ Not Implemented | No view tracking | Decider returns false |

**Summary**: 11 targeted, 2 not implemented (infrastructure missing)

---

## Social Achievements (12 total)

| Achievement | Trigger Type | Trigger Point | Notes |
|-------------|--------------|---------------|-------|
| first-comment | ❌ Not Implemented | No comment tracking | Decider returns false |
| helpful (10 comments) | ❌ Not Implemented | No comment tracking | Decider returns false |
| very-helpful (50 comments) | ❌ Not Implemented | No comment tracking | Decider returns false |
| reviewer (10 reviews) | ❌ Not Implemented | No review tracking | Decider returns false |
| popular (10 reactions) | ❌ Not Implemented | No reaction tracking | Decider returns false |
| famous (100 reactions) | ❌ Not Implemented | No reaction tracking | Decider returns false |
| discussion-starter | ❌ Not Implemented | No discussion tracking | Decider returns false |
| community-builder | ❌ Not Implemented | No help tracking | Decider returns false |
| mentor (50 reviews) | ❌ Not Implemented | No review tracking | Decider returns false |
| ambassador | ❌ Not Implemented | No discussion tracking | Decider returns false |

**Summary**: 0 targeted, 10 not implemented (require new infrastructure)

---

## Milestone Achievements (8 total)

| Achievement | Trigger Type | Trigger Point | Notes |
|-------------|--------------|---------------|-------|
| first-login | 📅 Profile View | Viewing achievements tab | Checks user data exists |
| veteran (1 year account) | 📅 Profile View | Viewing achievements tab | Checks account age |
| early-adopter | 📅 Profile View | Viewing achievements tab | Checks first login date |
| one-week-streak (7 days) | ❌ Not Implemented | No login tracking | Decider returns false |
| one-month-streak (30 days) | ❌ Not Implemented | No login tracking | Decider returns false |
| persistent (100 days) | ❌ Not Implemented | No login tracking | Decider returns false |
| dedicated (365 days) | ❌ Not Implemented | No login tracking | Decider returns false |
| weekend-warrior | ❌ Not Implemented | No login tracking | Decider returns false |
| night-owl | ❌ Not Implemented | No login tracking | Decider returns false |
| consistent (7 day streak) | ❌ Not Implemented | No login tracking | Decider returns false |

**Summary**: 0 targeted, 3 profile view, 5 not implemented (need login tracking)

---

## Overall Summary

**Total Achievements**: 55

**By Trigger Type**:
- ✅ **Targeted Checks**: 17 (31%)
  - 6 contribution (first-pr, first-edit, pr-novice, pr-expert, pr-master, pr-legend)
  - 11 game progress (all build/loadout achievements)
- 📅 **Profile View Checks**: 17 (31%)
  - 14 contribution (merge milestones, lines, files, anonymous, prolific, first-pr-closed)
  - 3 milestone (first-login, veteran, early-adopter)
- ❌ **Not Implemented**: 21 (38%)
  - 2 game (engraving-expert, build-sharer, popular-builder)
  - 10 social (comments/reactions/discussions)
  - 7 milestone (login streaks)
  - 2 other (night-owl, weekend-warrior)

**Coverage Status**:
- ✅ **Fully Covered**: 34 achievements (62%) - Have working deciders and triggers
- ⏳ **Partially Covered**: 0 achievements
- ❌ **Missing Infrastructure**: 21 achievements (38%) - Deciders return false, need new features

---

## Adding New Triggers

When adding a new user action that should trigger achievement checks:

1. **Check if achievements are enabled**:
   ```javascript
   const config = useConfigStore.getState().config;
   if (config?.features?.achievements?.enabled === false) return;
   ```

2. **Import and call queueAchievementCheck**:
   ```javascript
   import { queueAchievementCheck } from '../achievements/achievementQueue.js';

   queueAchievementCheck('achievement-id', {
     owner,
     repo,
     userId,
     username,
     delay: 2000,      // Wait for GitHub to sync
     retryDelay: 5000, // Retry delay
     maxRetries: 3,    // Max retries
   }).catch(error => {
     logger.error('Failed to queue achievement check', { error: error.message });
   });
   ```

3. **Choose appropriate delay**:
   - **GitHub API (PRs)**: 5000ms (5 seconds)
   - **GitHub Issues (builds/loadouts/spirits)**: 2000ms (2 seconds)
   - **Instant (local data)**: 0ms

---

## Configuration

Achievements can be disabled in `public/wiki-config.json`:

```json
{
  "features": {
    "achievements": {
      "enabled": false
    }
  }
}
```

When disabled:
- ✅ `queueAchievementCheck()` returns early
- ✅ `checkUserAchievements()` returns early
- ✅ Profile view check skips
- ✅ AchievementsSection component doesn't render
- ✅ No API calls to bot service

All entry points check the `enabled` flag before doing any work.
