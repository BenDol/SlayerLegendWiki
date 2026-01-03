# Cloudflare Pages Deployment Configuration

## Build Command Setup

To ensure tests run before production deployments, configure Cloudflare Pages with the following build command:

```
npm run build:cloudflare
```

**DO NOT use:** `npm run build` (this skips the `prebuild:cloudflare` hook)

---

## How It Works

### Build Chain
```
npm run build:cloudflare
  ↓
prebuild:cloudflare (hook runs automatically)
  ↓
scripts/cloudflare-prebuild.cjs
  ↓
Checks branch and commit message
  ↓
Runs tests (if production and no skip marker)
  ↓
vite build
```

### Test Execution Rules

#### Production Deploys (main branch)
- ✅ **Tests run by default**
- ⏭️ **Tests can be skipped** with commit message markers:
  - `[skip tests]`
  - `[skip-tests]`
  - `[no tests]`
  - `[tests skip]`

Example:
```bash
git commit -m "Fix typo [skip tests]"
```

#### Preview Deploys (other branches)
- ⏭️ **Tests automatically skipped** (faster preview builds)
- No commit message marker needed

---

## Cloudflare Pages Configuration

### Via Dashboard

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Select your **slayer-legend-wiki** project
3. Go to **Settings** → **Builds & deployments**
4. Update **Build command:**
   ```
   npm run build:cloudflare
   ```
5. **Build output directory:** `dist`
6. **Root directory:** (leave blank or `/`)
7. **Save**

### Via wrangler.toml (Local Development Only)

The `wrangler.toml` file is for local development with Wrangler CLI. It does **NOT** affect Cloudflare Pages production builds.

Production builds are configured via the Cloudflare Pages dashboard.

---

## Environment Variables

Ensure these are set in **Cloudflare Pages Dashboard** → **Settings** → **Environment variables**:

### Production & Preview
- `VITE_GITHUB_CLIENT_ID`
- `VITE_WIKI_REPO_OWNER`
- `VITE_WIKI_REPO_NAME`
- `VITE_WIKI_BOT_USERNAME`
- `WIKI_BOT_TOKEN` (secret)
- `WIKI_REPO_OWNER`
- `WIKI_REPO_NAME`
- `SENDGRID_API_KEY` (secret)
- `SENDGRID_FROM_EMAIL`
- `RECAPTCHA_SECRET_KEY` (secret)
- `VITE_RECAPTCHA_SITE_KEY`
- `EMAIL_VERIFICATION_SECRET` (secret)
- `OPENAI_API_KEY` (secret)
- `CDN_REPO_TOKEN` (secret)

**Note:** Variables prefixed with `VITE_` are exposed to the browser. Others are server-side only.

---

## Verifying Test Execution

### In Cloudflare Pages Build Logs

Look for these indicators in the build output:

#### Tests Running (Production)
```
📦 Cloudflare Prebuild - Branch: main

🚀 Production deploy detected
🔍 Checking commit message for skip markers...

✅ No skip marker found - tests will run

🧪 Running tests...

> test:ci
> npm run test:framework && npm run test:integration

PASS wiki-framework/tests/...
PASS tests/integration/...

✅ All tests passed!
```

#### Tests Skipped (Commit Marker)
```
📦 Cloudflare Prebuild - Branch: main

🚀 Production deploy detected
🔍 Checking commit message for skip markers...

Commit message: Fix typo [skip tests]
⚠️  Skip marker found: [skip tests]

⏭️  Tests skipped via commit message marker
```

#### Tests Skipped (Preview)
```
📦 Cloudflare Prebuild - Branch: feature-branch

✅ Preview deploy detected (branch: feature-branch)
⏭️  Skipping tests automatically
```

---

## Troubleshooting

### Tests Not Running on Production Deploys

**Symptom:** Build logs don't show test execution

**Cause:** Build command is set to `npm run build` instead of `npm run build:cloudflare`

**Solution:**
1. Check Cloudflare Pages Dashboard → Settings → Builds & deployments
2. Verify **Build command** is: `npm run build:cloudflare`
3. Trigger a new deployment

---

### Tests Failing on Production Deploy

**Symptom:** Build fails with test errors

**Options:**

1. **Fix the tests** (recommended)
   ```bash
   npm run test:ci
   # Fix failing tests
   git commit -m "Fix tests"
   git push
   ```

2. **Skip tests for this specific commit** (emergency only)
   ```bash
   git commit -m "Emergency fix [skip tests]"
   git push
   ```

---

### Preview Builds Taking Too Long

**Current Behavior:** Preview builds automatically skip tests for faster feedback

**If you want tests on previews:**
Remove the branch check in `scripts/cloudflare-prebuild.cjs` (not recommended - slows down iteration)

---

## Test Commands Reference

### Run All Tests Locally
```bash
npm test                  # Framework + parent tests
npm run test:ci          # Framework + integration (CI-equivalent)
npm run test:framework   # Framework tests only
npm run test:parent      # Parent project tests only
npm run test:integration # Integration tests only
```

### Watch Mode (Development)
```bash
npm run test:watch       # Auto-run tests on file changes
```

### Coverage
```bash
npm run test:coverage    # Generate coverage report
```

---

## Files

- **`package.json`**:
  - `prebuild:cloudflare` → Runs before `build:cloudflare`
  - `build:cloudflare` → Production build command

- **`scripts/cloudflare-prebuild.cjs`**:
  - Tests execution logic
  - Branch detection
  - Commit message parsing

- **`scripts/checkCommitForTests.js`**:
  - Commit message skip marker detection

---

## Best Practices

1. ✅ **Always run tests locally** before pushing to main
   ```bash
   npm run test:ci
   ```

2. ✅ **Use skip markers sparingly** - Only for emergencies or trivial changes

3. ✅ **Check build logs** after deployment to verify tests ran

4. ❌ **Don't disable tests permanently** - They catch bugs before production

5. ✅ **Fast iteration on branches** - Preview builds skip tests automatically
