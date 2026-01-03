# Prestige Badge System

The prestige system rewards wiki contributors with badges and titles based on their contributions.

## Architecture

The system is designed to eventually support showing prestige badges for any user, with a central cache for prestige data. Currently, badges only appear for the authenticated user.

### Components

1. **`PrestigeAvatar`** (`src/components/common/PrestigeAvatar.jsx`)
   - Wraps user avatars with optional prestige badges
   - Supports three usage modes:
     - Pass `stats` directly for immediate display
     - Pass `username` to auto-load prestige data
     - No params to show badge for current user
   - Currently only shows badges for authenticated users

2. **`useUserPrestige` hook** (`src/hooks/usePrestige.js`)
   - Loads and caches prestige data for users
   - 5-minute in-memory cache (TTL)
   - Currently only loads data for authenticated user
   - Future: Will support loading any user's prestige via API

3. **Prestige utilities** (`src/utils/prestige.js`)
   - `getPrestigeTier()` - Calculates tier from contribution stats
   - `getProgressToNextTier()` - Calculates progress to next tier
   - `formatPrestigeTitle()` - Formats tier title with badge emoji

### Where Badges Appear

- **My Edits page** - Large prestige card + all PR avatars
- **User dropdown menu** - Header avatar with prestige title
- **Page History** - Commit author avatars (shows for authenticated user only)
- **Any avatar in the app** - When using `PrestigeAvatar` component

## Current vs Future Behavior

### Current (Implemented)
- Badges show only for the authenticated user
- Prestige calculated from user's GitHub PR activity
- 5-minute in-memory cache
- Badge appears on authenticated user's avatars throughout the app

### Future (Architecture Ready)
- Central prestige cache/store for all users
- API endpoint or backend service to fetch prestige for any user
- Persistent cache (localStorage, database, or Redis)
- Show badges for all contributors, not just authenticated user
- Real-time prestige updates via webhooks

## Implementation Notes

To enable prestige for all users in the future:

1. **Update `useUserPrestige` hook**:
   - Remove the authentication check
   - Add API endpoint to fetch prestige for any username
   - Implement persistent cache storage

2. **Add backend/API**:
   - Create endpoint: `GET /api/prestige/:username`
   - Calculate and cache prestige data server-side
   - Return tier and stats for any user

3. **Update cache strategy**:
   - Replace in-memory Map with localStorage or backend cache
   - Add cache invalidation webhooks for new PRs
   - Consider Redis for high-traffic wikis

The prestige system rewards wiki contributors with badges and titles based on their contributions.

## Disabling the Prestige System

To disable the prestige system, edit `wiki-config.json`:

```json
{
  "prestige": {
    "enabled": false
  }
}
```

When disabled, no prestige badges will appear on any avatars throughout the wiki.

## Customizing Prestige Tiers

Edit the `prestige.tiers` array in `wiki-config.json`:

```json
{
  "prestige": {
    "enabled": true,
    "tiers": [
      {
        "id": "newcomer",
        "title": "Newcomer",
        "minContributions": 0,
        "badge": "🌱",
        "color": "#9ca3af"
      },
      {
        "id": "contributor",
        "title": "Contributor",
        "minContributions": 1,
        "badge": "✍️",
        "color": "#3b82f6"
      }
      // ... add more tiers
    ]
  }
}
```

### Tier Properties

- **id**: Unique identifier for the tier
- **title**: Display name (e.g., "Wiki Expert")
- **minContributions**: Minimum contribution score required
- **badge**: Emoji displayed on avatar
- **color**: Hex color code for the badge background

### Contribution Scoring

Contributions are weighted based on their value:
- **Merged PRs**: 3 points each (most valuable)
- **Open PRs**: 1 point each
- **Closed PRs**: 0.5 points each (partial credit)

Example: A user with 5 merged PRs and 2 open PRs has a score of (5 × 3) + (2 × 1) = 17 points.

## Where Badges Appear

When enabled, prestige badges appear on:
- User dropdown menu (header)
- My Edits page (prestige card and all PR cards)
- Any profile avatar where user stats are available

## Debugging

If badges aren't appearing:
1. Check browser console for "PrestigeAvatar Debug" logs
2. Verify `prestige.enabled` is `true` in `wiki-config.json`
3. Ensure `prestige.tiers` array has at least one tier
4. Confirm user has contribution stats (only visible for authenticated users on their own profile)
5. Check that stats are being passed to the avatar component
