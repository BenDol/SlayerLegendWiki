# Cloudflare Pages Functions

This directory contains Cloudflare Pages Functions for the wiki. These functions provide the same functionality as the Netlify Functions but use Cloudflare's function signature.

## Architecture

The codebase uses a **shared business logic pattern** to support both Netlify and Cloudflare Pages:

```
functions/_shared/            # ← Shared business logic (platform-agnostic)
├── handlers/                 # Request handlers
├── utils.js                  # Common utilities and validation
├── validation.js             # Request validation
├── WikiGitHubStorage.js      # Storage implementation
├── createWikiStorage.js      # Storage factory
├── githubBot.js              # GitHub bot operations
├── oauth.js                  # OAuth operations
└── jwt.js                    # JWT utilities

netlify/functions/            # ← Netlify-specific adapters
└── *.js                      # Thin wrappers that call shared handlers

functions/api/                # ← Cloudflare-specific adapters (THIS DIRECTORY)
└── *.js                      # Thin wrappers that call shared handlers
```

## Functions

All functions in `api/` directory:

| Function | Method | Purpose | Environment Variables |
|----------|--------|---------|----------------------|
| `github-bot.js` | POST | Bot-authenticated GitHub operations | `WIKI_BOT_TOKEN`, `WIKI_REPO_OWNER`, `WIKI_REPO_NAME` |
| `save-data.js` | POST | Save user data (builds, loadouts, spirits, grids) | `WIKI_BOT_TOKEN`, `WIKI_REPO_OWNER`, `WIKI_REPO_NAME` |
| `load-data.js` | GET | Load user data | `WIKI_BOT_TOKEN`, `WIKI_REPO_OWNER`, `WIKI_REPO_NAME` |
| `delete-data.js` | POST | Delete user data | `WIKI_BOT_TOKEN`, `WIKI_REPO_OWNER`, `WIKI_REPO_NAME` |
| `access-token.js` | POST | OAuth access token proxy (CORS bypass) | None |
| `device-code.js` | POST | OAuth device code proxy (CORS bypass) | None |

## Function Signature

Cloudflare Pages Functions use a different signature than Netlify:

```javascript
export async function onRequest(context) {
  // context.request - Request object (standard Web API)
  // context.env - Environment variables
  // context.params - Route parameters
  // context.waitUntil() - Background tasks
  // context.passThroughOnException() - Pass to next handler

  return new Response(body, { status, headers });
}
```

## Shared Business Logic

Each function is a thin adapter that:
1. Creates platform-specific adapters (CloudflareAdapter, ConfigAdapter)
2. Calls shared handlers from `../_shared/handlers/`
3. Returns platform-specific response format

Example:

```javascript
import { CloudflareAdapter } from 'github-wiki-framework/serverless/shared/adapters/PlatformAdapter.js';
import { ConfigAdapter } from 'github-wiki-framework/serverless/shared/adapters/ConfigAdapter.js';
import { handleSaveData } from '../_shared/handlers/save-data.js';

export async function onRequest(context) {
  const adapter = new CloudflareAdapter(context);
  const configAdapter = new ConfigAdapter('cloudflare');
  return await handleSaveData(adapter, configAdapter);
}

  // Return Cloudflare response
  return new Response(
    JSON.stringify(result.body),
    {
      status: result.statusCode,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
```

## Local Development

### With Wrangler

```bash
# Install Wrangler globally
npm install -g wrangler

# Copy environment variables
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your actual values

# Build the project
npm run build:cloudflare

# Run Cloudflare Pages locally
npm run preview:cloudflare
```

### With Vite Dev Server

For faster development without Cloudflare Functions:

```bash
npm run dev:vite
```

This uses Vite's proxy for OAuth and direct URLs for data operations.

## Deployment

Cloudflare Pages automatically deploys functions from this directory when you push to your repository.

### Environment Variables

Set these in Cloudflare Pages dashboard:

```bash
WIKI_BOT_TOKEN=<your_bot_token>
WIKI_REPO_OWNER=<your_github_username>
WIKI_REPO_NAME=<your_repo_name>
VITE_GITHUB_CLIENT_ID=<your_github_client_id>
VITE_PLATFORM=cloudflare
VITE_CF_PAGES=1
```

## Adding New Functions

When adding a new function:

1. **Add shared logic**: Create handler in `functions/_shared/handlers/`
2. **Add Netlify adapter**: Create thin wrapper in `netlify/functions/`
3. **Add Cloudflare adapter**: Create thin wrapper in `functions/api/`
4. **Update API endpoints**: Add to `src/utils/apiEndpoints.js`
5. **Test both platforms**: Verify on both Netlify and Cloudflare

## Differences from Netlify

| Feature | Netlify | Cloudflare Pages |
|---------|---------|------------------|
| **Location** | `netlify/functions/` | `functions/api/` |
| **Signature** | `handler(event)` | `onRequest(context)` |
| **Request** | `event.body`, `event.queryStringParameters` | `context.request.json()`, `new URL(request.url).searchParams` |
| **Env Vars** | `process.env.VAR` | `context.env.VAR` |
| **Response** | `{ statusCode, body }` | `new Response(body, { status })` |
| **Execution** | Node.js container | V8 Isolate (Edge) |
| **Cold Start** | ~500ms | ~10ms |
| **Max Time** | 10s (free), 26s (paid) | 50ms (free), 30s (paid) |

## Troubleshooting

### Function Returns 500 Error

Check environment variables are set:
- `WIKI_BOT_TOKEN`
- `WIKI_REPO_OWNER`
- `WIKI_REPO_NAME`

### Import Errors

Cloudflare Workers have some limitations on Node.js APIs. The shared logic is designed to be platform-agnostic and only uses standard Web APIs.

### CORS Issues

OAuth functions (`access-token.js`, `device-code.js`) include CORS headers. If you see CORS errors, check that the function is being called correctly through the API endpoint utility.

## Learn More

- [Cloudflare Pages Functions Docs](https://developers.cloudflare.com/pages/platform/functions/)
- [Full Deployment Guide](../CLOUDFLARE-DEPLOYMENT.md)
- [Shared Logic Documentation](../netlify/functions/README.md)
