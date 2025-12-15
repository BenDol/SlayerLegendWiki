# Netlify Functions

This directory is for **custom, project-specific** serverless functions only. Core wiki functions are provided by the framework.

## Framework Functions

Core functions (OAuth, admin actions, comments) are now in the wiki-framework:
```
wiki-framework/serverless/netlify/functions/
```

## Setup

To use framework functions, configure Netlify to use the framework directory.

### Current Setup (Recommended)

Update `netlify.toml` in project root:
```toml
[build]
  # Point to framework functions directory
  functions = "wiki-framework/serverless/netlify/functions"
```

Netlify will deploy all functions from the framework directory.

### Alternative: Custom + Framework Functions

If you need both framework and custom functions:

1. Keep this directory for custom functions
2. Copy framework functions here before deployment:
   ```bash
   npm run setup:functions
   ```

Add to `package.json`:
```json
{
  "scripts": {
    "setup:functions": "cp wiki-framework/serverless/netlify/functions/*.js netlify/functions/"
  }
}
```

## Framework Functions Reference

Functions provided by the framework:

| Function | Purpose | Environment Variables |
|----------|---------|----------------------|
| `access-token.js` | GitHub OAuth token proxy (CORS) | - |
| `device-code.js` | GitHub Device Flow proxy (CORS) | - |
| `create-comment-issue.js` | Create comment issues with bot | `WIKI_BOT_TOKEN` |
| `create-admin-issue.js` | Create admin/ban issues (secured) | `WIKI_BOT_TOKEN` |
| `update-admin-issue.js` | Update admin/ban issues (secured) | `WIKI_BOT_TOKEN` |

### Security Features

Admin functions (`create-admin-issue`, `update-admin-issue`) include:
- Server-side permission validation
- Owner and admin list verification
- User token authentication
- Bot token never exposed to client

## Environment Variables

Required in Netlify Dashboard → Site Settings → Environment Variables:

- `WIKI_BOT_TOKEN` - GitHub Personal Access Token with `repo` scope

## Custom Functions

To add project-specific functions, create them in this directory:

```
netlify/functions/
├── README.md              # This file
└── my-custom-function.js  # Your custom function
```

If using the framework directory in `netlify.toml`, you'll need to copy framework functions here or switch to this directory.

## Local Testing

Test functions locally with Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

This runs both Vite dev server and Netlify Functions locally.

## Updating Framework Functions

Framework functions update when you update the git submodule:

```bash
cd wiki-framework
git pull origin main
cd ..
git add wiki-framework
git commit -m "Update wiki framework"
```

If you copied functions to this directory, run:
```bash
npm run setup:functions
```

## Migration from Old Setup

If you had functions directly in this directory:

1. ✅ Functions moved to `wiki-framework/serverless/netlify/functions/`
2. ✅ Update `netlify.toml` to point to framework directory
3. ✅ Keep any custom functions here (Netlify will merge if needed)
4. ✅ Remove duplicate files that are now in framework

See `wiki-framework/serverless/README.md` for more details.
