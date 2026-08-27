# Cloudflare Pages Deployment Configuration

## Deployment Model

The site is **built in GitHub Actions and pushed to Cloudflare Pages via Direct
Upload**. Cloudflare does not build this project.

That split exists because `wiki-framework` (`BenDol/GithubWiki`) is a **private**
submodule of a **public** wiki repo. Cloudflare Pages' Git integration clones
submodules itself, before any build command of ours runs, and offers no place to
supply credentials for a private one - the clone fails with
`fatal: could not read Username for 'https://github.com/'`. GitHub Actions can
authenticate it, because `actions/checkout` copies its `token` input into each
submodule's git config.

```
push to main
  |
  v
.github/workflows/conditional-deploy.yml
  |-- actions/checkout  (submodules: recursive, token: FRAMEWORK_REPO_TOKEN)
  |-- npm ci
  |-- npm run build:cloudflare      -> prebuild + tests + vite build + prerender
  `-- wrangler pages deploy dist --project-name=slayer-legend-wiki --branch=main
```

`wrangler pages deploy` uploads `dist/` **and** the `functions/` directory it
finds in the working directory, so Pages Functions ship with the same command.

### Test Execution Rules

`npm run build:cloudflare` still routes through `scripts/cloudflare-prebuild.cjs`,
which branches on `CF_PAGES_BRANCH`. The workflow sets that to `github.ref_name`,
so the existing rules are unchanged:

- **`main`** - tests run, unless the commit message carries `[skip tests]`,
  `[skip-tests]`, `[no tests]` or `[tests skip]`.
- **Any other branch** - tests are skipped automatically.

### Deploy Skip Markers

Every push to `main` deploys, so that the prerendered crawler HTML from
`scripts/prerender.js` stays in sync with the markdown. `[skip-deploy]` or
`[no-deploy]` in the commit message is the only way out, and it leaves that
prerendered HTML stale until the next deploy.

---

## Required GitHub Secrets and Variables

Set under **Settings -> Secrets and variables -> Actions**.

### Secrets

| Name | Purpose |
|------|---------|
| `FRAMEWORK_REPO_TOKEN` | PAT with **read** access to the private `BenDol/GithubWiki` repo. Used by `actions/checkout` to clone the submodule. Falls back to `WIKI_BOT_TOKEN` if unset. |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with the **Cloudflare Pages: Edit** permission. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID. |
| `OAUTH_CLIENT_ID` | Becomes `VITE_GITHUB_CLIENT_ID` at build time. *(already present)* |
| `WIKI_BOT_USERNAME` | Becomes `VITE_WIKI_BOT_USERNAME`. *(already present)* |
| `RECAPTCHA_SITE_KEY` | Becomes `VITE_RECAPTCHA_SITE_KEY`. |
| `PAYPAL_CLIENT_ID` | Becomes `VITE_PAYPAL_CLIENT_ID`. **Optional** - see below. |

### Why `VITE_*` values must be here and not only in the Pages dashboard

Vite inlines `import.meta.env.VITE_*` into the bundle **at build time**. The Pages
dashboard variables are a *runtime* environment for the Functions, and the build
now runs in GitHub Actions, where they are not visible. A `VITE_*` value that
exists only in the dashboard compiles to `undefined` in the client bundle.

Two consumers depend on this:

- `VITE_RECAPTCHA_SITE_KEY` - read at
  `wiki-framework/src/components/anonymous/AnonymousEditForm.jsx:56`. Without it
  `loadRecaptcha()` never fires and anonymous-edit reCAPTCHA silently stops
  working. The `wiki-config.json` fallback
  (`features.anonymousEditing.reCaptcha.siteKey`) is `""`, so config cannot cover
  for it.
- `VITE_PAYPAL_CLIENT_ID` - read at `wiki-framework/src/pages/DonatePage.jsx:40`.
  Its config fallback reads `features.donation.methods.paypal.clientId`, which does
  not exist (the key lives at `features.donation.paypal.clientId`, a different
  path), so config cannot cover for it either. Without the value the donate page
  falls back to the `paypal.me` URL. **Check whether the Pages dashboard sets this
  today** - if it does, add it here; if not, the site already runs on the
  fallback and you can leave it unset.

### `BOT_SERVICE_URL` is a maintenance-script variable, not a deploy input

It is the **base URL of the deployed serverless functions**, so Node-side scripts
can call the same endpoints the browser calls:

| Platform | Value |
|---|---|
| Cloudflare Pages | `https://slayerlegend.wiki/api` |
| Netlify (legacy) | `https://slayerlegend-wiki.netlify.app/.netlify/functions` |

`scripts/backfillAchievements.js:40` shows the intended shape - it defaults to the
Netlify base and appends `/github-bot`.

It is read through `process.env`, never `import.meta.env`, so Vite does **not**
inline it into the client bundle; setting it during the build has no effect on the
app. The running site does not use it at all: `getGithubBotEndpoint()` in
`wiki-framework/src/utils/apiEndpoints.js:117` derives `/api/github-bot` from the
detected platform.

Only two standalone scripts read it, and **no workflow or npm script invokes
either** - run them by hand with the variable exported:

```bash
BOT_SERVICE_URL=https://slayerlegend.wiki/api node scripts/backfillAchievements.js
```

> Note: `scripts/calculate-top-contributor.js:206` posts to
> `${botServiceUrl}/update-top-contributor`, but the real function is
> `/github-bot` with `{ action: 'update-top-contributor' }` in the body
> (`functions/_shared/handlers/github-bot.js:322`). That script would 404 as
> written. `update-top-contributor.yml` does the work inline via
> `actions/github-script` instead, so nothing depends on it today.

### Integration tests are not part of the deploy gate

`tests/integration/**` calls the live SendGrid, OpenAI and GitHub APIs - including
real `POST https://api.sendgrid.com/v3/mail/send` - and throws in `beforeAll()`
without credentials. It is excluded from `vitest.config.js` and from `test:ci`, so
a deploy never sends mail, never spends OpenAI credits, and is never blocked by a
third-party outage.

`test:ci` is now `test:framework && test:parent`: 256 framework tests plus 494
parent unit tests, fully hermetic. (It previously ran `test:framework &&
test:integration`, which skipped the parent unit tests entirely.)

Run the live suite deliberately when you need it:

```bash
npm run test:integration   # requires .env.test with the real API keys
```

If you want it on a schedule, add a separate workflow with
`OPENAI_API_KEY`, `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` as secrets - keep
it off the deploy path.

### Variables

| Name | Purpose |
|------|---------|
| `VITE_RELEASE_DATE` | Release date shown in the UI. *(already present)* |

`BOT_SERVICE_URL` / `VITE_BOT_SERVICE_URL` is **not** a build or deploy input - see
below.

`CLOUDFLARE_DEPLOY_HOOK` is no longer used and can be deleted once the new
pipeline is verified.

> **Never** add `VITE_WIKI_BOT_TOKEN` here. It is a client-side dev-only
> fallback; in production the bot token is held server-side by the Pages
> Functions, via the dashboard secret below.

---

## Cloudflare Pages Project Configuration

The project must be a **Direct Upload** project. A Git-integrated project cannot
be switched to Direct Upload - per Cloudflare's docs, *"If you deploy using the
Git integration, you cannot switch to Direct Upload later."*

```bash
npx wrangler pages project create slayer-legend-wiki --production-branch=main
```

Then set the project's runtime settings (Settings -> Runtime): compatibility date
**2024-12-01** and the **`nodejs_compat`** flag. The deploy ships no Wrangler
config, so these are not inherited from the repo.

Build settings do not apply to Direct Upload projects; there is no build command
or output directory to configure in the dashboard.

### Runtime Environment Variables

These are read by the Pages **Functions** at request time and live in
**Workers & Pages -> the project -> Settings -> Variables and Secrets**. They are
*not* build inputs and must not be committed - this repo is public.

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

### `wrangler.toml` is local-dev only, and the deploy moves it aside

`wrangler.toml` at the repo root configures **local development only**
(`npm run dev`, `npm run preview:cloudflare`).

The name cannot change: `wrangler pages dev` rejects `--config` outright with
*"Pages does not support custom paths for the Wrangler configuration file"*, so
Pages reads the root `wrangler.toml` or nothing.

It must not reach a deploy. Cloudflare's documentation warns that a Wrangler
config file *"becomes the source of truth when used, meaning that you cannot edit
the same fields in the dashboard"*, and specifically that deploying with
`pages_build_output_dir` present means *"Pages will use whatever configuration was
defined for local use, which is very likely to be non-production."* That would
supersede the dashboard variables and secrets listed above and break every
Function.

The deploy step in `.github/workflows/conditional-deploy.yml` therefore renames the
file out of the way immediately before uploading:

```bash
mv wrangler.toml wrangler.local.toml
npx wrangler pages deploy dist --project-name="$CF_PAGES_PROJECT" ...
```

The checkout is ephemeral, so nothing needs restoring.

> **Because the deploy ships no Wrangler config, the runtime settings that
> `wrangler.toml` provides locally must be set on the Pages project itself**
> (Settings -> Runtime): compatibility date **2024-12-01** and the
> **`nodejs_compat`** compatibility flag. `functions/_shared` depends on
> `nodejs_compat`; without it the Functions fail at runtime.

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

### `wiki-framework is empty` - deploy fails at the verify step

**Symptom:** `wiki-framework is empty - the checkout token cannot read BenDol/GithubWiki.`

**Cause:** `FRAMEWORK_REPO_TOKEN` (or its `WIKI_BOT_TOKEN` fallback) is missing,
expired, or lacks read access to the private framework repo.

**Solution:** Reissue a PAT with read access to `BenDol/GithubWiki` and update the
`FRAMEWORK_REPO_TOKEN` secret. Fine-grained PATs need *Contents: Read* on that
repo; classic PATs need the `repo` scope.

---

### Tests Not Running on Production Deploys

**Symptom:** Workflow logs don't show test execution

**Cause:** `CF_PAGES_BRANCH` did not resolve to `main`, or the commit carries a
`[skip tests]` marker.

**Solution:** Check the `Build site` step's env block in
`.github/workflows/conditional-deploy.yml` - it must set
`CF_PAGES_BRANCH: ${{ github.ref_name }}` - and re-read the commit message.

---

### Functions break after a deploy (500s, missing env)

**Symptom:** API routes fail immediately after a deploy that otherwise succeeded.

**Cause:** Either the deploy step's `mv wrangler.toml wrangler.local.toml` was
removed - so the deploy carried config and superseded the dashboard's variables and
secrets - or the Pages project is missing the `nodejs_compat` compatibility flag.

**Solution:** See *`wrangler.toml` is local-dev only, and the deploy moves it
aside* above.

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

### No preview deployments for branches

**Current Behavior:** Only pushes to `main` deploy. Direct Upload projects have no
automatic per-branch previews - the old Git integration would have built them, but
automatic Cloudflare builds were already disabled here.

**If you want previews:** add a `pull_request` trigger to
`.github/workflows/conditional-deploy.yml` and deploy with
`--branch=${{ github.head_ref }}`. Guard it against fork PRs, which receive no
secrets and therefore cannot clone the private framework submodule. Note this
also runs a full build per PR, which matters given the volume of anonymous-edit
PRs this repo receives.

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
