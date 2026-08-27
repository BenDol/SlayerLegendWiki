# Cloudflare Pages Deployment Configuration

This guide explains how the Slayer Legend Wiki reaches Cloudflare Pages.

> **Cloudflare does not build this project.** The `wiki-framework` submodule
> (`BenDol/GithubWiki`) is private, and the Pages Git integration clones
> submodules before any build command runs with no way to authenticate. The build
> therefore happens in GitHub Actions and the artifact is shipped by Direct
> Upload. See `.claude/cloudflare-pages-deployment.md` for the authoritative
> guide - this file covers the Pages project side only.

## Build Configuration

### Project Settings

The Pages project is a **Direct Upload** project, so it has no build command or
output directory to configure. What it does need (Settings -> Runtime):

```yaml
Compatibility date: 2024-12-01
Compatibility flags: nodejs_compat
Production branch:   main
```

`nodejs_compat` is required by `functions/_shared`. The deploy ships no Wrangler
config, so these are not inherited from the repo.

### Where testing happens

`.github/workflows/conditional-deploy.yml` runs `npm run build:cloudflare`, whose
`prebuild:cloudflare` hook gates on `CF_PAGES_BRANCH`.

**Build sequence:**
1. `prebuild:cloudflare` → runs `npm run test:ci` on `main`
   (`test:framework` + `test:parent`; hermetic, no live API calls)
2. Build fails if tests fail ❌
3. If tests pass → continues to `build:cloudflare` ✅
4. Vite builds the application, then `scripts/prerender.js` runs
5. `npx wrangler pages deploy dist` uploads `dist/` and `functions/`

The live-API suite (`npm run test:integration`) is deliberately **not** part of
this gate - see `.claude/cloudflare-pages-deployment.md`.

## Environment Variables

### Required Variables

Configure these in **Cloudflare Pages → Settings → Environment Variables**:

#### GitHub OAuth (Required)
```bash
VITE_GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_ID=your_github_client_id
```

#### GitHub Bot (Required)
```bash
WIKI_BOT_TOKEN=your_github_personal_access_token
WIKI_BOT_USERNAME=your_github_bot_username
WIKI_REPO_OWNER=your_github_username
WIKI_REPO_NAME=your_repo_name
VITE_WIKI_REPO_OWNER=your_github_username
VITE_WIKI_REPO_NAME=your_repo_name
VITE_WIKI_BOT_USERNAME=your_github_bot_username
VITE_WIKI_BOT_TOKEN=your_github_bot_token
```

#### SendGrid Email (Required for email verification)
```bash
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=your_verified_sender_email
```

#### Email Verification (Required)
```bash
EMAIL_VERIFICATION_SECRET=your_secret_key_32_chars_long
```

#### reCAPTCHA (Required for anonymous PRs)
```bash
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

#### OpenAI Moderation (Optional - for profanity detection)
```bash
OPENAI_API_KEY=your_openai_api_key
```

### Variable Scopes

Cloudflare Pages supports different environment scopes:

- **Production**: Variables used in production deployments
- **Preview**: Variables used in preview deployments (PR branches)

**Recommendation**: Set the same variables for both Production and Preview environments.

## Integration Tests in CI/CD

### How It Works

The build process runs **real integration tests** that:
- ✅ Test GitHub OAuth API (device flow)
- ✅ Test SendGrid email sending
- ✅ Test OpenAI content moderation
- ✅ Verify all serverless functions work correctly

**Important**: These tests make REAL API calls and may:
- Consume API credits (SendGrid, potentially OpenAI)
- Send test emails to your verified sender address
- Create temporary GitHub OAuth device codes

### Test Results

Integration tests run sequentially and take ~5-10 seconds:
- **15 tests total** (5 GitHub + 4 SendGrid + 6 OpenAI)
- All tests must pass for deployment to proceed
- Tests verify cross-platform compatibility (Netlify/Cloudflare)

### Disabling Tests

Add a skip marker to the commit message - `[skip tests]`, `[skip-tests]`,
`[no tests]` or `[tests skip]`. `scripts/checkCommitForTests.js` picks it up and
`prebuild:cloudflare` bypasses the suite for that deploy only.

To skip the deploy entirely, use `[skip-deploy]` or `[no-deploy]`. Note this
leaves the prerendered crawler HTML stale until the next deploy.

## Local Testing Before Deploy

Test your Cloudflare deployment locally:

```bash
# Build with tests
npm run build:cloudflare

# Preview locally with Wrangler
npm run preview:cloudflare
```

## Troubleshooting

### Tests Failing in CI/CD

If integration tests fail during Cloudflare Pages build:

1. **Check environment variables**: Ensure all required variables are set in Cloudflare Pages settings
2. **Verify API keys**: Make sure API keys are valid and not expired
3. **Check logs**: View build logs in Cloudflare Pages dashboard
4. **Test locally**: Run `npm run test:integration` locally with your `.env.test` file

### Common Issues

#### "Missing required environment variable"
- **Cause**: Environment variable not set in Cloudflare Pages
- **Fix**: Add the variable in Settings → Environment Variables

#### "Incorrect API key provided"
- **Cause**: API key is invalid or expired
- **Fix**: Update the API key in Cloudflare Pages settings

#### "unauthorized" or "invalid_grant"
- **Cause**: GitHub OAuth client_id is incorrect
- **Fix**: Verify `GITHUB_CLIENT_ID` matches your GitHub OAuth app

#### Tests timeout or are slow
- **Cause**: API rate limiting or slow network
- **Fix**: Tests have 60s timeout, should not normally fail unless APIs are down

### Build Logs

Cloudflare Pages shows detailed build logs including:
- Test execution output
- API responses (errors logged with details)
- Build success/failure status

Example successful test output:
```
✅ Email sent successfully
✅ Clean content passed moderation
✅ Authorization pending error returned as expected
📝 Device Flow initiated successfully

Test Files  3 passed (3)
Tests  15 passed (15)
```

## Deployment Workflow

### Automatic Deployments

Cloudflare Pages automatically deploys:
- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

Each deployment (in GitHub Actions, not on Cloudflare):
1. Checks out the repo **and the private framework submodule** with a PAT
2. Installs dependencies (`npm ci`)
3. Runs the hermetic test suite (`npm run test:ci`)
4. Builds the app (`npm run build:cloudflare`) and prerenders every route
5. Uploads `dist/` + `functions/` with `npx wrangler pages deploy`

### Manual Deployments

Deploy manually via:
```bash
# Build locally
npm run build:cloudflare

# Deploy with Wrangler
npx wrangler pages deploy dist --project-name=slayer-legend-wiki
```

## Security Best Practices

1. **Never commit secrets**: All API keys should only be in Cloudflare Pages environment variables
2. **Use different keys for preview**: Consider using separate API keys for preview deployments
3. **Rotate keys regularly**: Update API keys periodically for security
4. **Monitor usage**: Check SendGrid/OpenAI dashboards for unexpected usage

## Cost Considerations

Running integration tests on every deployment will:
- **SendGrid**: Send 1 test email per deployment (~free tier allows 100/day)
- **OpenAI Moderation**: Make ~6 API calls per deployment (completely FREE, no limits)
- **GitHub OAuth**: Make ~5 API calls per deployment (free, rate limit 5000/hour)

**Estimated cost**: Nearly zero (OpenAI Moderation is free, SendGrid free tier sufficient)

## Next Steps

After deploying to Cloudflare Pages:
1. Verify the deployment at your `*.pages.dev` URL
2. Check that serverless functions work (try OAuth login, data saving)
3. Set up custom domain (optional)
4. Configure Cloudflare caching rules (optional)
5. Enable Cloudflare Analytics (optional)

## Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Environment Variables Guide](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
