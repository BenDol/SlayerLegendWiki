# Cloudflare Pages Deployment - Anonymous Editing Setup

## ✅ Cloudflare Functions Status

All Cloudflare-specific code is ready and properly configured!

### What's Different from Netlify

1. **Function Location:** `functions/api/` instead of `netlify/functions/`
2. **Export Format:** `export async function onRequest(context)` instead of `export async function handler(event)`
3. **Environment Variables:** Accessed via `env` object: `env.WIKI_BOT_TOKEN`
4. **IP Detection:** Uses `CF-Connecting-IP` header (Cloudflare-specific)
5. **Crypto API:** Uses Web Crypto API (`crypto.subtle.digest`) instead of Node.js crypto

### ✅ Files Ready for Cloudflare

```
functions/api/
├── github-bot.js                    ✅ Ready (with email handlers)
├── emailTemplates/
│   └── verificationEmail.js         ✅ Ready (imported by github-bot)
├── access-token.js                  ✅ Ready
├── device-code.js                   ✅ Ready
├── save-data.js                     ✅ Ready
├── load-data.js                     ✅ Ready
└── delete-data.js                   ✅ Ready
```

## 🔧 Environment Variables (Production)

Add these in **Cloudflare Pages Dashboard** → Your Project → Settings → Environment Variables:

### Required for Anonymous Editing

```env
# GitHub Bot
WIKI_BOT_TOKEN=ghp_your_github_token_here

# SendGrid (Email Verification)
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@slayerlegend.wiki

# reCAPTCHA v3 (Bot Protection)
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key_here

# Email Verification (JWT Secret)
EMAIL_VERIFICATION_SECRET=your_random_secret_here

# Build Variables
VITE_PLATFORM=cloudflare
VITE_CF_PAGES=1
```

### Required for OAuth

```env
VITE_GITHUB_CLIENT_ID=your_github_client_id_here
VITE_WIKI_REPO_OWNER=BenDol
VITE_WIKI_REPO_NAME=SlayerLegendWiki
```

## 🏠 Local Development (Cloudflare)

### Option 1: Wrangler (Cloudflare Local Testing)

Create `.dev.vars` in project root (already exists):

```env
# GitHub Bot
WIKI_BOT_TOKEN=ghp_your_github_token_here

# SendGrid
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=dolb90@gmail.com

# reCAPTCHA
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key_here
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here

# Email Verification
EMAIL_VERIFICATION_SECRET=your_random_secret_here

# OAuth
VITE_GITHUB_CLIENT_ID=your_github_client_id_here
VITE_WIKI_REPO_OWNER=BenDol
VITE_WIKI_REPO_NAME=SlayerLegendWiki
```

Then run:
```bash
npm run dev:cloudflare:serve
```

This uses `wrangler pages dev` which simulates the Cloudflare Workers environment locally.

### Option 2: Netlify Dev (Easier for Testing)

Use `.env.local` with same variables:

```bash
npm run dev
```

The code will work the same way - environment variables are accessed differently in production (Cloudflare uses `env` object) but the logic is identical.

## 🚀 Deployment Steps

### 1. Configure Cloudflare Pages Project

If not already set up:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select **Pages** → Create/Select your project
3. Connect to GitHub repository: `BenDol/SlayerLegendWiki`
4. Build settings:
   - **Build command:** `npm run build:cloudflare`
   - **Build output directory:** `dist`
   - **Root directory:** (leave empty)

### 2. Add Environment Variables

In Cloudflare Pages Dashboard → Your Project → Settings → Environment Variables:

**Add each variable listed above** (both Production and Preview environments)

**Important:** Set `VITE_PLATFORM=cloudflare` and `VITE_CF_PAGES=1` so the client knows to use `/api/` endpoints.

### 3. Configure SendGrid Domain

Since you're deploying to production, you should use domain authentication:

1. Go to [SendGrid Sender Authentication](https://app.sendgrid.com/settings/sender_auth)
2. Click **"Authenticate Your Domain"**
3. Domain: `slayerlegend.wiki`
4. Add DNS records to your domain (in Cloudflare DNS):
   - CNAME records provided by SendGrid
   - Wait for verification (can take a few hours)
5. Once verified, update `SENDGRID_FROM_EMAIL=noreply@slayerlegend.wiki`

### 4. Configure reCAPTCHA

1. Go to [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Create new site or add domain:
   - Type: **reCAPTCHA v3**
   - Domains: `slayerlegend.wiki`, `localhost` (for testing)
3. Copy **Site Key** → `VITE_RECAPTCHA_SITE_KEY`
4. Copy **Secret Key** → `RECAPTCHA_SECRET_KEY`
5. Add both to Cloudflare environment variables
6. Update `wiki-config.json` line 262 with site key

### 5. Generate Email Verification Secret

```bash
openssl rand -hex 32
```

Add the output to `EMAIL_VERIFICATION_SECRET` in Cloudflare environment variables.

### 6. Update wiki-config.json

Make sure line 262 has your reCAPTCHA site key:

```json
"reCaptcha": {
  "enabled": true,
  "siteKey": "your_recaptcha_site_key_here",
  "minimumScore": 0.5
}
```

### 7. Deploy

```bash
git add .
git commit -m "Add anonymous editing with email verification"
git push origin main
```

Cloudflare Pages will automatically build and deploy!

## 🧪 Testing on Production

Once deployed:

1. Open incognito window: `https://slayerlegend.wiki`
2. Navigate to any wiki page
3. Click **"Edit"** button
4. Choose **"Edit Anonymously"**
5. Make an edit and click **"Save"**
6. Fill in email, display name, reason
7. Check email for verification code
8. Enter code and submit
9. Verify PR is created on GitHub

## 🔍 Monitoring & Debugging

### Cloudflare Logs

View function logs in Cloudflare Dashboard:
- **Pages** → Your Project → **Functions** → View Logs
- Shows console.log outputs from serverless functions
- Check for errors in email sending, rate limiting, etc.

### Common Issues

**1. 404 on /api/github-bot**
- Check environment variables are set in Cloudflare
- Verify `VITE_PLATFORM=cloudflare` is set
- Check build output includes `functions/api/` directory

**2. Email not sending**
- Check `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` in Cloudflare env vars
- Verify sender domain is authenticated in SendGrid
- Check Cloudflare function logs for SendGrid errors

**3. reCAPTCHA failing**
- Check `RECAPTCHA_SECRET_KEY` in Cloudflare env vars
- Check `VITE_RECAPTCHA_SITE_KEY` in Cloudflare env vars
- Verify domain is added to reCAPTCHA console

**4. Rate limiting not working**
- Rate limit state is stored in-memory (resets on cold starts)
- For persistent rate limiting, need to use Cloudflare KV or Durable Objects
- Current implementation is MVP - works but resets occasionally

### Rate Limit Persistence (Optional Enhancement)

Current implementation uses in-memory Map (ephemeral). For production, consider:

**Option 1: Cloudflare KV (Recommended)**
- Persistent key-value storage
- ~$5/month for 10GB
- Survives cold starts

**Option 2: Cloudflare Durable Objects**
- More expensive but more powerful
- Coordinate state across requests

For now, in-memory is fine - rate limits reset on cold starts but that's acceptable for MVP.

## ✅ Deployment Checklist

- [ ] All environment variables added to Cloudflare Pages
- [ ] SendGrid domain authenticated for `slayerlegend.wiki`
- [ ] reCAPTCHA v3 configured with production domain
- [ ] Email verification secret generated and added
- [ ] `wiki-config.json` updated with reCAPTCHA site key
- [ ] Code committed and pushed to GitHub
- [ ] Cloudflare Pages build succeeds
- [ ] Test anonymous edit flow on production
- [ ] Verify email is received
- [ ] Verify PR is created on GitHub
- [ ] Check Cloudflare function logs for errors

## 🎯 Summary

**Cloudflare deployment is 100% ready!** All functions use the correct Cloudflare APIs:

- ✅ `onRequest(context)` export format
- ✅ `env` object for environment variables
- ✅ `CF-Connecting-IP` for client IP
- ✅ Web Crypto API for hashing
- ✅ Email templates properly imported
- ✅ All handlers implemented (send/verify email, rate limit, PR creation)

Just add the environment variables to Cloudflare Pages Dashboard and deploy! 🚀
