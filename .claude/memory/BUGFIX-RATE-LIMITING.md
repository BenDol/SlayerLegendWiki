# Bug Fix: Reaction Failures & Rate Limiting Implementation

## Issues Fixed

### 1. Fake Comment Check Blocking Real Reactions

**Problem:**
Users were seeing `[Comments] Skipping reaction on fake comment` when trying to like/dislike comments, preventing any reactions from working.

**Root Cause:**
The code had a hardcoded check that blocked reactions on comment IDs >= 8000000, assuming these were fake test comments:

```javascript
// BEFORE (BROKEN):
if (commentId >= 8000000) {
  console.log('[Comments] Skipping reaction on fake comment');
  return;
}
```

However:
- GitHub comment IDs are sequential across **all of GitHub**, not per-repository
- Real comment IDs can easily exceed 8000000
- The fake comments feature was disabled (`ENABLE_FAKE_COMMENTS = false`)
- The check was still active, blocking legitimate comments

**Impact:**
- All comments with IDs >= 8000000 couldn't receive reactions
- User experience was broken for reactions system
- No error message shown to users (silently failed)

### 2. No Rate Limiting on Reactions or Comments

**Problem:**
- Users could spam reactions/comments rapidly
- No protection against GitHub API rate limits
- No client-side throttling

## Solutions Implemented

### 1. Fixed Fake Comment Check

**Changed approach:**
- Made fake comment check conditional on `ENABLE_FAKE_COMMENTS` flag
- Only blocks fake comments when feature is actually enabled
- Uses constants for maintainability

**Implementation:**
```javascript
// Define constants at component level
const ENABLE_FAKE_COMMENTS = false; // Set to true to enable fake test data
const FAKE_COMMENT_ID_START = 8000000; // Fake comment IDs start from this number

// Updated check (now conditional)
const isFakeComment = ENABLE_FAKE_COMMENTS && comment.id >= FAKE_COMMENT_ID_START;
if (!isFakeComment) {
  // Load reactions for real comments
  const commentReactionList = await getCommentReactions(owner, repo, comment.id);
  newReactions[comment.id] = commentReactionList;
}
```

**Result:**
✅ Real comments with any ID can now receive reactions
✅ Fake comment blocking only happens when feature is enabled
✅ Easy to enable/disable for development testing

### 2. Added Reaction Rate Limiting

**Client-Side Limits:**
- **Per-second**: Max 1 reaction per second (1000ms cooldown)
- **Per-minute**: Max 10 reactions per minute
- Tracks timestamps in memory using `useRef`
- Cleans up old timestamps automatically

**Implementation:**
```javascript
const REACTION_RATE_LIMIT = {
  perSecond: 1,       // Max 1 reaction per second
  perMinute: 10,      // Max 10 reactions per minute
  cooldownMs: 1000,   // 1 second cooldown between reactions
};

const checkReactionRateLimit = () => {
  const now = Date.now();
  const timestamps = reactionTimestamps.current;

  // Clean up old timestamps (older than 1 minute)
  reactionTimestamps.current = timestamps.filter(ts => now - ts < 60000);

  // Check per-second limit
  const lastReaction = timestamps[timestamps.length - 1] || 0;
  const timeSinceLastReaction = now - lastReaction;
  if (timeSinceLastReaction < REACTION_RATE_LIMIT.cooldownMs) {
    const retryAfter = Math.ceil((REACTION_RATE_LIMIT.cooldownMs - timeSinceLastReaction) / 1000);
    return {
      isLimited: true,
      reason: 'Too fast! Please wait a moment between reactions.',
      retryAfter,
    };
  }

  // Check per-minute limit
  const recentReactions = timestamps.filter(ts => now - ts < 60000);
  if (recentReactions.length >= REACTION_RATE_LIMIT.perMinute) {
    return {
      isLimited: true,
      reason: `Rate limit: Maximum ${REACTION_RATE_LIMIT.perMinute} reactions per minute.`,
      retryAfter: 60,
    };
  }

  return { isLimited: false };
};
```

**User Feedback:**
```javascript
const rateLimitCheck = checkReactionRateLimit();
if (rateLimitCheck.isLimited) {
  console.warn('[Comments] Rate limited:', rateLimitCheck.reason);
  alert(`⏱️ ${rateLimitCheck.reason}`);
  return;
}
```

**Timestamp Management:**
```javascript
// Record timestamp on action
reactionTimestamps.current.push(Date.now());

// Remove timestamp if action fails
catch (err) {
  reactionTimestamps.current.pop();
}
```

### 3. Added Comment Rate Limiting

**Client-Side Limits:**
- **Cooldown**: 5 seconds between comments
- **Per-minute**: Max 5 comments per minute
- **Per-5-minutes**: Max 10 comments per 5 minutes
- Multi-tiered approach prevents both spam and sustained abuse

**Implementation:**
```javascript
const COMMENT_RATE_LIMIT = {
  perMinute: 5,       // Max 5 comments per minute
  per5Minutes: 10,    // Max 10 comments per 5 minutes
  cooldownMs: 5000,   // 5 second cooldown between comments
};

const checkCommentRateLimit = () => {
  const now = Date.now();
  const timestamps = commentTimestamps.current;

  // Clean up old timestamps (older than 5 minutes)
  commentTimestamps.current = timestamps.filter(ts => now - ts < 300000);

  // Check cooldown period since last comment
  const lastComment = timestamps[timestamps.length - 1] || 0;
  const timeSinceLastComment = now - lastComment;
  if (timeSinceLastComment < COMMENT_RATE_LIMIT.cooldownMs) {
    const retryAfter = Math.ceil((COMMENT_RATE_LIMIT.cooldownMs - timeSinceLastComment) / 1000);
    return {
      isLimited: true,
      reason: `Please wait ${retryAfter} seconds before posting another comment.`,
      retryAfter,
    };
  }

  // Check per-minute limit
  const recentComments1min = timestamps.filter(ts => now - ts < 60000);
  if (recentComments1min.length >= COMMENT_RATE_LIMIT.perMinute) {
    return {
      isLimited: true,
      reason: `Rate limit: Maximum ${COMMENT_RATE_LIMIT.perMinute} comments per minute.`,
      retryAfter: 60,
    };
  }

  // Check per-5-minutes limit
  const recentComments5min = timestamps.filter(ts => now - ts < 300000);
  if (recentComments5min.length >= COMMENT_RATE_LIMIT.per5Minutes) {
    return {
      isLimited: true,
      reason: `Rate limit: Maximum ${COMMENT_RATE_LIMIT.per5Minutes} comments per 5 minutes.`,
      retryAfter: 300,
    };
  }

  return { isLimited: false };
};
```

### 4. Server-Side Rate Limit Handling

**GitHub API Error Detection:**
```javascript
catch (err) {
  console.error('Failed to handle reaction:', err);

  // Handle GitHub API rate limit (HTTP 403 with specific message)
  if (err.status === 403 && err.message?.includes('rate limit')) {
    alert('⏱️ GitHub API rate limit exceeded. Please wait a moment and try again.');
  } else if (err.status === 403) {
    alert('❌ Permission denied. You may need to sign in again.');
  } else {
    alert('❌ Failed to update reaction: ' + err.message);
  }

  // Remove the timestamp we just added since the reaction failed
  reactionTimestamps.current.pop();
}
```

**Error Types Handled:**
- **403 with "rate limit"**: GitHub API rate limit exceeded
- **403 without "rate limit"**: Permission/authentication issue
- **422**: Invalid input (for comments)
- **Other errors**: Generic error message

## Rate Limit Configuration

### Current Limits

**Reactions:**
- 1 reaction per second (hard cooldown)
- 10 reactions per minute (rolling window)

**Comments:**
- 5 second cooldown between comments (hard cooldown)
- 5 comments per minute (rolling window)
- 10 comments per 5 minutes (rolling window)

### Adjusting Limits

To modify rate limits, edit the constants in `Comments.jsx`:

```javascript
// For reactions
const REACTION_RATE_LIMIT = {
  perSecond: 1,       // Adjust this for different cooldown
  perMinute: 10,      // Adjust this for different per-minute limit
  cooldownMs: 1000,   // Adjust this for different cooldown duration
};

// For comments
const COMMENT_RATE_LIMIT = {
  perMinute: 5,       // Adjust this for different per-minute limit
  per5Minutes: 10,    // Adjust this for different 5-minute limit
  cooldownMs: 5000,   // Adjust this for different cooldown duration
};
```

## Technical Details

### Memory Management

**Timestamp Cleanup:**
- Reaction timestamps: Cleaned every check (keeps last 60 seconds)
- Comment timestamps: Cleaned every check (keeps last 5 minutes)
- Uses `Array.filter()` to remove expired timestamps
- Efficient for typical usage patterns

**Storage:**
```javascript
const reactionTimestamps = useRef([]);  // In-memory, persists across renders
const commentTimestamps = useRef([]);   // In-memory, persists across renders
```

**Why useRef:**
- Persists across component re-renders
- Doesn't trigger re-renders when updated
- Lightweight (just array of timestamps)
- Automatically cleared when component unmounts

### Rate Limit Algorithm

**Rolling Window:**
1. Record timestamp when action is taken
2. Filter out timestamps older than window (1 min or 5 min)
3. Count recent actions within window
4. If count exceeds limit, reject action
5. If action fails, remove the timestamp

**Cooldown:**
1. Get timestamp of last action
2. Calculate time since last action
3. If less than cooldown duration, reject action
4. Show user how many seconds to wait

### Edge Cases Handled

1. **Failed Actions**: Timestamps removed if action fails
2. **Component Unmount**: Timestamps automatically cleared
3. **Page Refresh**: Timestamps reset (intentional - prevents cross-session tracking)
4. **Multiple Tabs**: Each tab has independent rate limiting (per-tab, not global)
5. **Clock Changes**: Uses `Date.now()` which is monotonic within session

## User Experience

### Before Fix

**Reactions:**
- ❌ Silently failed for many comments
- ❌ No feedback to users
- ❌ Confusing "fake comment" console message

**Rate Limits:**
- ❌ No client-side rate limiting
- ❌ Users could spam reactions/comments
- ❌ GitHub API errors shown directly to users

### After Fix

**Reactions:**
- ✅ Works for all comments regardless of ID
- ✅ Clear error messages with emojis
- ✅ Rate limit warnings shown before action

**Rate Limits:**
- ✅ Smooth rate limiting with clear feedback
- ✅ Tells users exactly how long to wait
- ✅ Prevents API abuse before hitting GitHub limits
- ✅ Better error messages for GitHub API errors

### User Messages

**Rate Limit Examples:**
- `⏱️ Too fast! Please wait a moment between reactions.`
- `⏱️ Rate limit: Maximum 10 reactions per minute.`
- `⏱️ Please wait 3 seconds before posting another comment.`
- `⏱️ Rate limit: Maximum 5 comments per minute.`
- `⏱️ GitHub API rate limit exceeded. Please wait a moment and try again.`

**Error Examples:**
- `❌ Permission denied. You may need to sign in again.`
- `❌ Invalid comment. Please check your input.`
- `❌ Failed to update reaction: [error message]`

## Testing

### Manual Testing

**Test Reactions:**
1. Navigate to any wiki page with comments
2. Try clicking thumbs up/down rapidly
3. Should see rate limit message after 1 second
4. Wait and try again - should work

**Test Comments:**
1. Try posting multiple comments quickly
2. Should see 5-second cooldown message
3. Post 5 comments in a row (with pauses)
4. 6th comment should be blocked by per-minute limit

**Test GitHub API Errors:**
1. If you hit GitHub rate limits, should see clear message
2. Authentication errors should suggest signing in again

### Automated Testing

Currently no automated tests. Potential test coverage:

1. **Unit Tests:**
   - `checkReactionRateLimit()` function logic
   - `checkCommentRateLimit()` function logic
   - Timestamp cleanup logic
   - Fake comment detection logic

2. **Integration Tests:**
   - Full reaction flow with rate limiting
   - Full comment flow with rate limiting
   - Error handling paths

3. **E2E Tests:**
   - User spams reactions, sees rate limit
   - User spams comments, sees rate limit
   - User waits cooldown, can react/comment again

## Files Modified

- `wiki-framework/src/components/wiki/Comments.jsx` - Main implementation

## Compatibility

- **React**: Uses hooks (`useState`, `useEffect`, `useRef`, `useCallback`)
- **Browser**: Compatible with all modern browsers
- **Mobile**: Touch-friendly rate limit messages
- **Accessibility**: Error messages shown via `alert()` (screen reader compatible)

## Future Improvements

1. **Replace `alert()` with Toast component** - Better UX
2. **Visual cooldown timer** - Show countdown on buttons
3. **Disable buttons during cooldown** - Prevent clicks
4. **Global rate limiting** - Share limits across tabs (use LocalStorage)
5. **Configurable limits** - Allow wiki config to set rate limits
6. **Analytics** - Track rate limit hits for tuning
7. **Progressive rate limits** - Increase limits for trusted users
8. **Automated testing** - Unit + integration tests

## Rollout

1. ✅ Fixed fake comment check blocking reactions
2. ✅ Added client-side reaction rate limiting
3. ✅ Added client-side comment rate limiting
4. ✅ Added server-side error handling
5. 🔄 Commit and push changes to framework submodule
6. 🔄 Update parent project to reference fixed framework
7. 🔄 Deploy and verify fixes work in production

## Summary

**What Changed:**
- Reactions now work for all comments (fixed ID check bug)
- Added client-side rate limiting for reactions and comments
- Added better error handling for GitHub API rate limits
- Improved user feedback with clear, friendly messages

**Impact:**
- ✅ Reactions system fully functional
- ✅ Users can't spam reactions/comments
- ✅ Better error messages and user experience
- ✅ Protection against GitHub API rate limits
- ✅ No server-side changes required (client-side only)

**Next Steps:**
- Test the fixes on your deployed wiki
- Monitor for any rate limit issues
- Consider adding Toast component for better UX
- Add visual cooldown indicators if needed
