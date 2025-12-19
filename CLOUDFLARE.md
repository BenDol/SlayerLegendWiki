# Cloudflare Pages Deployment Guide

This wiki supports deployment to both **Netlify** and **Cloudflare Pages**. This guide explains how to deploy to Cloudflare Pages while maintaining full compatibility with Netlify.

## Architecture

The codebase uses a **dual-platform architecture** that automatically detects the hosting platform and adjusts endpoints accordingly:

```
netlify/functions/shared/     # Shared business logic (platform-agnostic)
├── utils.js                  # Common utilities and validation
├── githubBot.js              # GitHub bot operations
├── dataOperations.js         # Load, save, delete operations
└── oauth.js                  # OAuth proxy operations

netlify/functions/            # Netlify Functions (Netlify-specific adapters)
├── github-bot.js
├── save-data.js
├── load-data.js
├── delete-data.js
├── access-token.js
└── device-code.js

functions/api/                # Cloudflare Pages Functions (Cloudflare-specific adapters)
├── github-bot.js             ✅ Ready (with email handlers)
├── emailTemplates/
│   └── verificationEmail.js  ✅ Ready (imported by github-bot)
├── save-data.js
├── load-data.js
├── delete-data.js
├── access-token.js
└── device-code.js

src/utils/apiEndpoints.js     # Platform detection and endpoint routing (parent project)
wiki-framework/src/utils/apiEndpoints.js  # Platform detection (framework)
```

## Platform Detection

The system automatically detects the platform at runtime:

1. **Development**: `import.meta.env.DEV === true`
   - Uses Vite dev server proxy for OAuth
   - Direct URLs for data operations

2. **Netlify**: Default production platform
   - Functions at `/.netlify/functions/`
   - Detected by absence of Cloudflare-specific env vars

3. **Cloudflare Pages**:
   - Functions at `/api/`
   - Detected by `VITE_CF_PAGES=1` or `VITE_PLATFORM=cloudflare`

## Cloudflare Pages Setup

### 1. Create Cloudflare Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → **Create a project**
3. Connect your GitHub repository
4. Configure build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build` or `npm run build:cloudflare`
   - **Build output directory**: `dist`
   - **Root directory**: (leave empty)

### 2. Configure Environment Variables

In Cloudflare Pages project settings → **Environment variables**, add:

#### Basic Configuration

```bash
# Required - GitHub Bot
WIKI_BOT_TOKEN=<your_bot_github_token>
WIKI_REPO_OWNER=<your_github_username>
WIKI_REPO_NAME=<your_repo_name>

# Required - OAuth
VITE_GITHUB_CLIENT_ID=<your_github_oauth_client_id>
VITE_WIKI_REPO_OWNER=<your_github_username>
VITE_WIKI_REPO_NAME=<your_repo_name>

# Cloudflare-specific (REQUIRED)
VITE_PLATFORM=cloudflare
VITE_CF_PAGES=1
```

**Important**: Cloudflare Pages automatically sets `CF_PAGES=1` at build time, but you need to expose it to Vite by setting `VITE_CF_PAGES=1` in environment variables.

#### Anonymous Editing (Optional)

If you want to enable anonymous editing with email verification:

```bash
# SendGrid (Email Verification)
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# reCAPTCHA v3 (Bot Protection)
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key_here
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here

# Email Verification (JWT Secret)
EMAIL_VERIFICATION_SECRET=your_random_secret_here
```

Generate the email verification secret:
```bash
openssl rand -hex 32
```

### 3. Update GitHub OAuth App

Update your GitHub OAuth App callback URL to include Cloudflare Pages domain:

- Callback URL: `https://your-site.pages.dev/` (or your custom domain)

### 4. Deploy

Push to your repository's main branch. Cloudflare Pages will automatically:
1. Build your application
2. Deploy Cloudflare Functions from `functions/api/`
3. Serve your static assets

## Anonymous Editing Setup

If you want to enable anonymous editing with email verification, follow these additional steps:

### 1. Configure SendGrid Domain Authentication

For production email sending:

1. Go to [SendGrid Sender Authentication](https://app.sendgrid.com/settings/sender_auth)
2. Click **"Authenticate Your Domain"**
3. Domain: `yourdomain.com`
4. Add DNS records to your domain (in Cloudflare DNS):
   - CNAME records provided by SendGrid
   - Wait for verification (can take a few hours)
5. Once verified, update `SENDGRID_FROM_EMAIL=noreply@yourdomain.com`

### 2. Configure reCAPTCHA v3

1. Go to [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Create new site or add domain:
   - Type: **reCAPTCHA v3**
   - Domains: Add your production domain and `localhost` (for testing)
3. Copy **Site Key** → `VITE_RECAPTCHA_SITE_KEY`
4. Copy **Secret Key** → `RECAPTCHA_SECRET_KEY`
5. Add both to Cloudflare environment variables
6. Update `wiki-config.json` with site key:

```json
"reCaptcha": {
  "enabled": true,
  "siteKey": "your_recaptcha_site_key_here",
  "minimumScore": 0.5
}
```

### 3. Testing Anonymous Edit Flow

Once deployed:

1. Open incognito window: `https://your-site.com`
2. Navigate to any wiki page
3. Click **"Edit"** button
4. Choose **"Edit Anonymously"**
5. Make an edit and click **"Save"**
6. Fill in email, display name, reason
7. Check email for verification code
8. Enter code and submit
9. Verify PR is created on GitHub

## Netlify Setup (Existing)

Your existing Netlify setup continues to work unchanged:

### Environment Variables

```bash
# Required
WIKI_BOT_TOKEN=<your_bot_github_token>
WIKI_REPO_OWNER=<your_github_username>
WIKI_REPO_NAME=<your_repo_name>
VITE_GITHUB_CLIENT_ID=<your_github_oauth_client_id>

# Optional
VITE_PLATFORM=netlify
```

### netlify.toml

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Function Differences

### What's Different in Cloudflare Functions

1. **Function Location:** `functions/api/` instead of `netlify/functions/`
2. **Export Format:** `export async function onRequest(context)` instead of `export async function handler(event)`
3. **Environment Variables:** Accessed via `env` object: `env.WIKI_BOT_TOKEN`
4. **IP Detection:** Uses `CF-Connecting-IP` header (Cloudflare-specific)
5. **Crypto API:** Uses Web Crypto API (`crypto.subtle.digest`) instead of Node.js crypto

### Netlify Functions

**Signature**:
```javascript
export async function handler(event) {
  // event.httpMethod
  // event.body
  // event.queryStringParameters
  // process.env.VAR_NAME

  return {
    statusCode: 200,
    body: JSON.stringify({ data: 'value' })
  };
}
```

**Location**: `netlify/functions/`

### Cloudflare Pages Functions

**Signature**:
```javascript
export async function onRequest(context) {
  // context.request - Request object
  // context.env - Environment variables
  // await context.request.json()
  // new URL(context.request.url).searchParams

  return new Response(
    JSON.stringify({ data: 'value' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
```

**Location**: `functions/api/`

## Shared Business Logic

Both platforms use the same business logic from `netlify/functions/shared/`:

- **utils.js**: Validation, error handling, configuration
- **githubBot.js**: All GitHub bot operations
- **dataOperations.js**: Load, save, delete operations
- **oauth.js**: OAuth proxy operations

This ensures:
- **No code duplication**: Business logic written once
- **Consistency**: Same behavior on both platforms
- **Maintainability**: Update logic in one place

## API Endpoint Resolution

The client code automatically selects the correct endpoints:

```javascript
import { getSaveDataEndpoint } from '../utils/apiEndpoints.js';

// Automatically resolves to:
// - Development: '/.netlify/functions/save-data' (or Vite proxy)
// - Netlify: '/.netlify/functions/save-data'
// - Cloudflare: '/api/save-data'

fetch(getSaveDataEndpoint(), {
  method: 'POST',
  body: JSON.stringify(data)
});
```

## Testing Locally

### Option 1: Netlify Dev (Default)

```bash
npm run dev
# or
netlify dev
```

This runs both Vite and Netlify Functions locally at `http://localhost:8888`.

### Option 2: Cloudflare Wrangler

Create `.dev.vars` in project root:

```env
# GitHub Bot
WIKI_BOT_TOKEN=ghp_your_github_token_here

# SendGrid (if testing email)
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=your@email.com

# reCAPTCHA (if testing)
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key_here
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here

# Email Verification
EMAIL_VERIFICATION_SECRET=your_random_secret_here

# OAuth
VITE_GITHUB_CLIENT_ID=your_github_client_id_here
VITE_WIKI_REPO_OWNER=your_username
VITE_WIKI_REPO_NAME=your_repo
```

Then run:
```bash
npm run dev:cloudflare:serve
```

This uses `wrangler pages dev` which simulates the Cloudflare Workers environment locally.

## Monitoring & Debugging

### Cloudflare Logs

View function logs in Cloudflare Dashboard:
- **Pages** → Your Project → **Functions** → View Logs
- Shows console.log outputs from serverless functions
- Check for errors in email sending, rate limiting, etc.

### Common Issues

**1. "Server configuration error" in Functions**

**Problem**: Functions return 500 error with "Server configuration error"

**Solution**: Check environment variables are set correctly:
- `WIKI_BOT_TOKEN`
- `WIKI_REPO_OWNER`
- `WIKI_REPO_NAME`

**2. OAuth Not Working**

**Problem**: GitHub OAuth fails or redirects incorrectly

**Solution**:
1. Verify `VITE_GITHUB_CLIENT_ID` is set
2. Check GitHub OAuth App callback URL includes your domain
3. Ensure `VITE_PLATFORM` is set correctly

**3. Functions Not Found (404)**

**Problem**: Fetch calls return 404 for function endpoints

**Solution**:
- **Cloudflare**: Ensure `VITE_CF_PAGES=1` is set
- **Netlify**: Verify `netlify.toml` has correct `functions` path
- Check platform detection logs in browser console
- Verify build output includes `functions/api/` directory

**4. Email not sending**

**Problem**: Anonymous editing emails not being sent

**Solution**:
- Check `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` in Cloudflare env vars
- Verify sender domain is authenticated in SendGrid
- Check Cloudflare function logs for SendGrid errors

**5. reCAPTCHA failing**

**Problem**: reCAPTCHA verification fails

**Solution**:
- Check `RECAPTCHA_SECRET_KEY` in Cloudflare env vars
- Check `VITE_RECAPTCHA_SITE_KEY` in Cloudflare env vars
- Verify domain is added to reCAPTCHA console
- Check browser console for reCAPTCHA errors

**6. Rate limiting not working**

**Problem**: Rate limits not being enforced

**Note**: Rate limit state is stored in-memory (resets on cold starts). This is acceptable for MVP. For persistent rate limiting, consider:
- **Cloudflare KV**: Persistent key-value storage (~$5/month for 10GB)
- **Cloudflare Durable Objects**: More expensive but more powerful

**7. Wrong Endpoints in Production**

**Problem**: Production site uses development endpoints

**Solution**:
- Ensure `import.meta.env.DEV` is false in production
- Check build logs for platform detection
- Verify environment variables are set

## Performance Considerations

### Cloudflare Pages

**Advantages**:
- **Edge Functions**: Run closer to users globally
- **Faster Cold Starts**: V8 Isolates vs. containers
- **Unlimited Requests**: No function invocation limits on paid plans
- **Free Tier**: 100,000 requests/day

**Limitations**:
- **CPU Time**: 50ms/request on free tier (30s on paid)
- **Memory**: 128MB per request
- **Bundle Size**: 1MB per function

### Netlify

**Advantages**:
- **Longer Execution**: 10s on free tier (26s on paid)
- **More Memory**: 1GB per function
- **Larger Bundle**: 50MB per function

**Limitations**:
- **Request Limits**: 125,000 requests/month on free tier
- **Cold Starts**: Slightly slower than Cloudflare

## Migration Checklist

### From Netlify to Cloudflare Pages

- [x] All serverless functions ported to Cloudflare Pages format
- [x] Shared business logic layer created
- [x] API endpoint utilities implemented
- [x] Framework services updated
- [x] Parent project components updated
- [ ] All environment variables added to Cloudflare Pages
- [ ] Test all features on Cloudflare Pages staging
- [ ] Update DNS settings (if using custom domain)
- [ ] Update GitHub OAuth callback URLs
- [ ] Monitor for any platform-specific issues

### Maintaining Both Platforms

To support both Netlify and Cloudflare deployments:

1. **Keep both function directories**:
   - `netlify/functions/` for Netlify
   - `functions/api/` for Cloudflare

2. **Update shared logic first**:
   - Make changes in `netlify/functions/shared/`
   - Both platforms use the same business logic

3. **Test on both platforms**:
   - Deploy to Netlify staging/production
   - Deploy to Cloudflare Pages preview/production

4. **Use platform detection**:
   - Never hardcode platform-specific URLs
   - Always use `apiEndpoints.js` utilities

## Deployment Checklist

### Basic Deployment

- [ ] Cloudflare Pages project created
- [ ] GitHub repository connected
- [ ] Build settings configured
- [ ] Basic environment variables added (`WIKI_BOT_TOKEN`, `VITE_GITHUB_CLIENT_ID`, etc.)
- [ ] `VITE_PLATFORM=cloudflare` and `VITE_CF_PAGES=1` set
- [ ] GitHub OAuth app callback URL updated
- [ ] Code committed and pushed to GitHub
- [ ] Cloudflare Pages build succeeds
- [ ] Test basic wiki functionality

### Anonymous Editing (Optional)

- [ ] SendGrid API key obtained
- [ ] SendGrid domain authenticated
- [ ] reCAPTCHA v3 configured with production domain
- [ ] Email verification secret generated and added
- [ ] `wiki-config.json` updated with reCAPTCHA site key
- [ ] All anonymous editing environment variables added
- [ ] Test anonymous edit flow on production
- [ ] Verify email is received
- [ ] Verify PR is created on GitHub
- [ ] Check Cloudflare function logs for errors

## Support

For issues specific to:
- **Cloudflare Pages**: [Cloudflare Community](https://community.cloudflare.com)
- **Netlify**: [Netlify Support](https://answers.netlify.com)
- **Wiki Framework**: [GitHub Issues](https://github.com/BenDol/GithubWiki/issues)
