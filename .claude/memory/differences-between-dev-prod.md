# Differences Between Dev (Netlify) and Production (Cloudflare)

This document catalogs all differences between the Netlify development environment and the Cloudflare production environment.

## Summary

**Status**: ✅ **ALL CRITICAL ISSUES RESOLVED** - Cloudflare now 1:1 with Netlify dev environment

### Files Compared
- ✅ **Identical Shared Utilities** (6 files)
- ✅ **Identical Function Wrappers** (6 functions) - Expected platform differences, identical business logic
- ✅ **All Validation Added** to Cloudflare github-bot.js - Security issue resolved

---

## 1. Shared Utility Files

### Status: ✅ IDENTICAL

All shared utility files are now 1:1 identical in business logic:

| File | Netlify Path | Cloudflare Path | Status |
|------|-------------|-----------------|--------|
| utils.js | `netlify/functions/shared/` | `functions/api/_lib/` | ✅ Identical |
| validation.js | `netlify/functions/shared/` | `functions/api/_lib/` | ✅ Identical |
| validationRules.js | `netlify/functions/shared/` | `functions/api/_lib/` | ✅ Identical |
| oauth.js | `netlify/functions/shared/` | `functions/api/_lib/` | ✅ Identical |
| githubBot.js | `netlify/functions/shared/` | `functions/api/_lib/` | ✅ Identical |
| jwt.js | `netlify/functions/_lib/` | `functions/api/_lib/` | ✅ Identical |
| sendgrid.js | `netlify/functions/_lib/` | `functions/api/_lib/` | ✅ Identical |

### Expected Differences (by design):

1. **WikiGitHubStorage.js**
   - Netlify: `export default WikiGitHubStorage`
   - Cloudflare: `export class WikiGitHubStorage` (named export)
   - Reason: Cloudflare ES modules require named exports

2. **createWikiStorage.js**
   - Netlify: `import WikiGitHubStorage from './WikiGitHubStorage.js'`
   - Cloudflare: `import { WikiGitHubStorage } from './WikiGitHubStorage.js'`
   - Reason: Matches export style difference above

---

## 2. Function Files

### A. device-code.js

**Status**: ✅ FIXED - Now uses shared oauth.js

#### Platform Wrapper Differences (Expected):
- **Handler signature**: `handler(event)` vs `onRequest(context)`
- **Method check**: `event.httpMethod` vs `request.method`
- **Body parsing**: `JSON.parse(event.body)` vs `await request.json()`
- **Response format**: Netlify object vs `new Response()`

#### Business Logic: ✅ IDENTICAL
- Both call `initiateDeviceFlow()` from shared oauth.js
- Same validation logic
- Same error handling

---

### B. access-token.js

**Status**: ✅ FIXED - Now uses shared oauth.js

#### Platform Wrapper Differences (Expected):
- Same wrapper differences as device-code.js

#### Business Logic: ✅ IDENTICAL
- Both call `pollAccessToken()` from shared oauth.js
- Same validation logic
- Same error handling

---

### C. delete-data.js

**Status**: ✅ FIXED - Added engraving-builds support

#### Platform Wrapper Differences (Expected):
- Handler signature and request/response handling (same as above)
- **Config loading**:
  - Netlify: Reads `wiki-config.json` from filesystem
  - Cloudflare: Uses `getStorageConfig()` with KV fallback
  - Reason: Cloudflare Pages doesn't have filesystem access
- **Environment variables**:
  - Netlify: `process.env.VAR_NAME`
  - Cloudflare: `env.VAR_NAME`

#### Business Logic: ✅ IDENTICAL
- Same validation sequence
- Same error messages
- Same data type support (including engraving-builds)
- Same storage calls

---

### D. load-data.js

**Status**: ✅ FIXED - Added engraving-builds support

#### Platform Wrapper Differences (Expected):
- Same as delete-data.js

#### Business Logic: ✅ IDENTICAL
- Same validation sequence
- Same error messages
- Same data type support (including engraving-builds)
- Same storage calls

---

### E. save-data.js

**Status**: ✅ FIXED - Added engraving-builds support and validation

#### Platform Wrapper Differences (Expected):
- Same as delete-data.js
- **Body size validation**:
  - Netlify: validates `event.body` directly
  - Cloudflare: validates `await request.text()` result

#### Business Logic: ✅ IDENTICAL
- Same validation sequence for all data types
- Same engraving-builds validation check
- Same grid-submission validation
- Same my-spirits validation
- Same error messages

---

### F. github-bot.js

**Status**: ✅ **FIXED** - All validation checks added

#### Platform Wrapper Differences (Expected):
- Same request/response wrapper differences
- Same config loading differences
- **Crypto import**:
  - Netlify: `import { webcrypto } from 'crypto'`
  - Cloudflare: Uses native Web Crypto API
  - Reason: Cloudflare Workers environment

#### Business Logic: ✅ **IDENTICAL**

**RESOLVED**: All validation imports and checks have been added to Cloudflare github-bot.js!

| Validation Function | Used in Netlify | Used in Cloudflare | Lines in Cloudflare |
|-------------------|-----------------|-------------------|---------------------|
| validateIssueBody | ✅ Yes (3x) | ✅ **ADDED** | 395, 437, 552 |
| validateIssueTitle | ✅ Yes | ✅ **ADDED** | 538 |
| validateLabels | ✅ Yes | ✅ **ADDED** | 556 |
| validateEmail | ✅ Yes (2x) | ✅ **ADDED** | 950, 1245 |
| validateDisplayName | ✅ Yes | ✅ **ADDED** | 1254 |
| validateEditReason | ✅ Yes | ✅ **ADDED** | 1263 |
| validatePageContent | ✅ Yes | ✅ **ADDED** | 1272 |
| validatePageTitle | ✅ Yes | ✅ **ADDED** | 1281 |
| validatePageId | ✅ Yes | ✅ **ADDED** | 1290 |
| validateSectionName | ✅ Yes | ✅ **ADDED** | 1299 |

**Resolution**: All validation has been added to Cloudflare github-bot.js! Both environments now reject invalid data consistently.

**Actions Fixed**:
1. ✅ `create-comment` - Body validation added
2. ✅ `update-issue` - Body validation added
3. ✅ `create-comment-issue` - Title, body, and labels validation added
4. ✅ `send-verification-email` - Email validation added
5. ✅ `create-anonymous-pr` - All 7 validations added (email, displayName, reason, content, title, pageId, section)

---

## 3. Environment Variables

### Netlify (Dev)
```javascript
process.env.WIKI_BOT_TOKEN
process.env.WIKI_REPO_OWNER || process.env.VITE_WIKI_REPO_OWNER
process.env.WIKI_REPO_NAME || process.env.VITE_WIKI_REPO_NAME
process.env.SENDGRID_API_KEY
process.env.FROM_EMAIL
process.env.ENCRYPTION_SECRET
```

### Cloudflare (Prod)
```javascript
env.WIKI_BOT_TOKEN
env.WIKI_REPO_OWNER || env.VITE_WIKI_REPO_OWNER
env.WIKI_REPO_NAME || env.VITE_WIKI_REPO_NAME
env.SENDGRID_API_KEY
env.FROM_EMAIL
env.ENCRYPTION_SECRET
env.SLAYER_WIKI_DATA // KV namespace binding (optional)
```

**Note**: All environment variable names are identical, only access method differs.

---

## 4. Configuration Loading

### Netlify
Uses Node.js filesystem access:
```javascript
import { readFileSync } from 'fs';
import { join } from 'path';

function getWikiConfig() {
  return JSON.parse(readFileSync(join(process.cwd(), 'wiki-config.json'), 'utf-8'));
}
```

### Cloudflare
Uses environment-based config:
```javascript
function getStorageConfig(env, owner, repo) {
  if (env.SLAYER_WIKI_DATA) {
    return {
      backend: 'cloudflare-kv',
      version: 'v1',
      cloudflareKV: { namespace: env.SLAYER_WIKI_DATA }
    };
  }

  return {
    backend: 'github',
    version: 'v1',
    github: { owner, repo }
  };
}
```

**Note**: This difference is by design - Cloudflare Pages doesn't have filesystem access.

---

## 5. Storage Backends

### Netlify
- Always uses GitHub Issues backend
- Config loaded from `wiki-config.json`

### Cloudflare
- Can use GitHub Issues backend (default)
- Can use Cloudflare KV if `SLAYER_WIKI_DATA` namespace is bound
- Allows switching backends without code changes

---

## 6. Response Formats

### Netlify
Uses helper functions:
```javascript
return createErrorResponse(400, 'Error message');
return createSuccessResponse({ data });
```

Returns Netlify-specific object:
```javascript
{
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
}
```

### Cloudflare
Uses Web Standard Response:
```javascript
return new Response(
  JSON.stringify({ error: 'Error message' }),
  {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  }
);
```

**Note**: Both return equivalent HTTP responses, just different wrapper APIs.

---

## 7. Action Items

### CRITICAL (All Completed ✅)

1. **✅ COMPLETED**: Add validation imports to `functions/api/github-bot.js`
2. **✅ COMPLETED**: Add all missing validation checks in github-bot action handlers:
   - ✅ `handleCreateComment` - validateIssueBody added (line 395)
   - ✅ `handleUpdateIssue` - validateIssueBody added (line 437)
   - ✅ `handleCreateCommentIssue` - validateIssueTitle, validateIssueBody, validateLabels added (lines 538-563)
   - ✅ `handleSendVerificationEmail` - validateEmail added (line 950)
   - ✅ `handleCreateAnonymousPR` - All 7 validations added (lines 1245-1304)

### Nice to Have (Refactoring Opportunities)

1. **Standardize Config Loading**: Create a shared config loading utility that works in both environments
2. **Standardize Response Helpers**: Use the same createErrorResponse/createSuccessResponse in both
3. **Reduce Code Duplication**: Consider extracting more shared logic into _lib files
4. **Type Safety**: Add JSDoc or TypeScript to ensure data structures match

---

## 8. Testing Checklist

Before deploying to Cloudflare production:

- [ ] Test all data types in save-data endpoint (especially engraving-builds)
- [ ] Test all data types in load-data endpoint
- [ ] Test all data types in delete-data endpoint
- [ ] Test OAuth flow (device-code and access-token)
- [ ] Test github-bot with invalid data (should reject)
- [ ] Test github-bot with valid data (should accept)
- [ ] Verify all error messages match between environments
- [ ] Verify all success responses match between environments

---

## 9. Maintenance Notes

When making changes to business logic:

1. **Update shared utilities FIRST** (`netlify/functions/shared/` or `_lib/`)
2. **Copy to both environments**:
   - `cp netlify/functions/shared/*.js functions/api/_lib/`
   - Except: createWikiStorage.js, WikiGitHubStorage.js (have expected differences)
3. **Update both function wrappers** if validation or error handling changes
4. **Test in dev** (Netlify) first
5. **Deploy to prod** (Cloudflare) after dev testing passes

---

## 10. Document Version

- **Created**: 2025-12-20
- **Last Updated**: 2025-12-20
- **Status**: ✅ Complete - All critical issues resolved, environments are 1:1
