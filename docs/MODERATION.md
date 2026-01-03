# Content Moderation

## Overview

The wiki includes AI-powered content moderation to detect and prevent inappropriate content in anonymous wiki edits.

## Features

### What Gets Checked

For **anonymous edits**, the following are automatically checked:
1. **Display Name** - The name shown in the PR
2. **Edit Summary** - The reason/description for the edit
3. **Page Content** - The actual markdown content (first 5000 characters)

For **authenticated edits**, moderation is **optional** (disabled by default):
- Can be enabled via configuration
- Uses the same checks as anonymous edits

### Moderation Engine

**Primary**: OpenAI Moderation API (when configured)
- AI-powered context-aware detection
- Detects: hate speech, harassment, violence, sexual content, self-harm
- FREE unlimited requests (moderation endpoint has no cost)
- Requires payment method on file for rate limits: 10,000/min (vs 3/min free)

**Fallback**: leo-profanity package
- Simple word-list based filtering
- Used when OpenAI API key not configured or API fails
- Less sophisticated but no external dependencies

## Configuration

### 1. OpenAI API Key (Recommended)

Add to `.env` (Netlify) or `.dev.vars` (Cloudflare):

```env
OPENAI_API_KEY=sk-your-key-here
```

**Setup Steps:**
1. Go to https://platform.openai.com/signup
2. Add payment method (required for higher rate limits)
3. Go to https://platform.openai.com/api-keys
4. Create new secret key
5. Add to environment variables

### 2. Moderation Settings

Configure in `wiki-config.json`:

```json
{
  "features": {
    "editRequestCreator": {
      "contentModeration": {
        "enabled": true,
        "checkAnonymousEdits": true,
        "checkAuthenticatedEdits": false,
        "checkDisplayName": true,
        "checkEditSummary": true,
        "checkPageContent": true,
        "maxContentLength": 5000
      }
    }
  }
}
```

**Options:**
- `enabled` - Master switch for all moderation
- `checkAnonymousEdits` - Always check anonymous edits (recommended: `true`)
- `checkAuthenticatedEdits` - Check authenticated user edits (default: `false`)
- `checkDisplayName` - Check display names (anonymous only)
- `checkEditSummary` - Check edit summary/reason
- `checkPageContent` - Check page content
- `maxContentLength` - Max chars to check (default: 5000)

## Implementation Details

### Anonymous Edit Flow

1. User fills out anonymous edit form
2. Client-side: Basic profanity check (leo-profanity) on display name
3. User submits form
4. Server-side checks (in order):
   - Display name → OpenAI (or leo-profanity fallback)
   - Edit summary → OpenAI (or leo-profanity fallback)
   - Page content → OpenAI (or leo-profanity fallback) - first 5000 chars only
5. If any check fails, edit is rejected with specific error message
6. If all pass, PR is created

### Error Messages

- **Display name**: "Display name contains inappropriate language. Please choose a respectful name."
- **Edit summary**: "Edit reason contains inappropriate language. Please provide a respectful explanation."
- **Page content**: "Page content contains inappropriate language. Please remove offensive content and try again."

### Authenticated Edit Moderation

**Status**: Configuration available, implementation pending

When `checkAuthenticatedEdits: true`:
- Authenticated users would have their edits checked server-side
- Same checks as anonymous edits (summary + content)
- Requires framework changes to call moderation endpoint before PR creation

**Note**: Currently only anonymous edits are moderated. Authenticated edit moderation requires additional framework integration.

## Rate Limits & Costs

### OpenAI Moderation API

- **Cost**: FREE (no charges)
- **Rate Limits**:
  - With payment method: 10,000 requests/min
  - Without payment method: 3 requests/min
- **Request Size**: Up to 32,768 tokens (~24,000 words)

### Recommendations

- **Development**: 3/min free tier works for testing
- **Production**: Add payment method for 10,000/min limit
- **Cost**: $0 (moderation endpoint is always free)

## Testing

### Test Moderation Locally

1. Start dev server: `npm run dev`
2. Go to any wiki page
3. Try anonymous edit with:
   - Clean content: Should pass
   - Profanity: Should be rejected (if using leo-profanity)
   - Contextual toxicity: Should be rejected (if using OpenAI)

### Test Phrases

**Caught by leo-profanity**:
- Basic profanity words
- Common insults

**Caught by OpenAI only**:
- "I hope you suffer"
- "You are trash"
- "Kill yourself"
- "Die loser"

### Logs

Watch server console for:
```
[Profanity] Checking with OpenAI Moderation API for text: ...
[Profanity] OpenAI Moderation result: { flagged: true/false, ... }
[github-bot] Display name rejected due to profanity (method: openai-moderation)
```

Or fallback:
```
[Profanity] OPENAI_API_KEY not configured, using leo-profanity fallback
[Profanity] leo-profanity result: true
[github-bot] Display name rejected due to profanity (method: leo-profanity)
```

## Troubleshooting

### OpenAI 429 Error (Too Many Requests)

**Symptom**: Logs show `OpenAI API request failed: 429`

**Cause**: Rate limit exceeded (3/min free tier)

**Solution**: Add payment method to OpenAI account for 10,000/min limit

### Moderation Not Working

1. Check `OPENAI_API_KEY` is set in `.env` / `.dev.vars`
2. Restart dev server after adding key
3. Check logs for profanity check messages
4. Verify `contentModeration.enabled: true` in wiki-config.json

### False Positives

If legitimate content is being flagged:
- OpenAI provides scores/categories in logs
- Can adjust thresholds (requires code change)
- Can add exceptions for specific terms (requires code change)

## Files

### Configuration
- `wiki-config.json` - Moderation settings
- `.env.example` - OpenAI key documentation
- `.dev.vars.example` - Cloudflare dev environment

### Implementation
- `netlify/functions/github-bot.js` - Netlify moderation handler
- `functions/api/github-bot.js` - Cloudflare moderation handler
- Both include `checkProfanity()` function

### Framework
- `wiki-framework/src/components/anonymous/AnonymousEditForm.jsx` - Client-side validation
- `wiki-framework/src/services/github/anonymousEditService.js` - API calls

## Future Enhancements

1. **Authenticated User Moderation**
   - Implement server-side moderation endpoint
   - Integrate with PageEditorPage
   - Optional based on config

2. **Custom Word Lists**
   - Allow project-specific blocked terms
   - Whitelist for game-specific terms (e.g., "kill" in gaming context)

3. **Severity Levels**
   - Different actions based on severity
   - Warning vs rejection
   - Admin review queue for borderline cases

4. **Rate Limiting**
   - Per-IP rate limits for moderation checks
   - Prevent API abuse

5. **Analytics**
   - Track moderation statistics
   - Most common violations
   - False positive reports
