# Conditional Deployment Setup Guide

This guide walks you through setting up conditional Cloudflare deployments with backward compatibility.

## Overview

The conditional deployment system:
- ✅ Skips builds for content-only changes when dynamic page loading is enabled
- ✅ Always builds when dynamic page loading is disabled (backward compatible)
- ✅ Supports commit message overrides for manual control
- ✅ Conserves Cloudflare Pages build quota

### What Counts as "Content-Only"?

**Content-only (skips deploy when dynamic loading enabled):**
- ✅ Markdown files in `public/content/` directory only
- ✅ Example: `public/content/characters/warrior.md`
- ✅ Example: `public/content/guides/beginner-guide.md`

**NOT content-only (triggers deploy):**
- ❌ Any code changes (`src/`, `main.jsx`, etc.)
- ❌ Configuration changes (`wiki-config.json`, `package.json`, etc.)
- ❌ Submodule updates (`wiki-framework/`)
- ❌ Asset changes (`public/images/`, `public/data/`, etc.)
- ❌ Workflow changes (`.github/workflows/`)
- ❌ Build scripts (`scripts/`)

**Why?** Only markdown content benefits from dynamic loading. Everything else requires a rebuild.

## Prerequisites

- GitHub repository with Cloudflare Pages connected
- Admin access to both GitHub and Cloudflare Pages
- `dynamicPageLoading.enabled: true` in `wiki-config.json` (or can be false for testing)

## Step-by-Step Setup

### 1. Create Cloudflare Deploy Hook

**Navigate to Cloudflare Pages:**
1. Go to [Cloudflare Pages Dashboard](https://dash.cloudflare.com/)
2. Select your wiki project
3. Go to **Settings** → **Builds & deployments**
4. Scroll to **Deploy hooks** section
5. Click **Create deploy hook**

**Configure Hook:**
- **Hook name**: `Manual Deploy` (or any name you prefer)
- **Branch**: `main`
- Click **Save**

**Copy the URL:**
You'll get a URL like:
```
https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/abc123def456...
```

Copy the **last part** after `/deploy_hooks/`:
```
abc123def456...
```

### 2. Disable Automatic Deployments

**In the same Cloudflare Pages settings:**
1. Find **Automatic deployments** section
2. Find the **Production branch** setting
3. Click **Disable** or toggle off automatic deployments for `main` branch

**⚠️ Important:** This prevents automatic builds on every push. GitHub Actions will now control when deploys happen.

### 3. Add GitHub Secret

**Navigate to GitHub:**
1. Go to your repository on GitHub
2. Click **Settings** (repository settings, not account)
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**

**Create Secret:**
- **Name**: `CLOUDFLARE_DEPLOY_HOOK`
- **Secret**: Paste the hook ID from step 1 (just the `abc123def456...` part)
- Click **Add secret**

### 4. Verify Workflow File

The workflow file should already exist at `.github/workflows/conditional-deploy.yml`. Verify it's committed:

```bash
git status
git add .github/workflows/conditional-deploy.yml
git commit -m "Add conditional deployment workflow"
git push
```

### 5. Test the Setup

**Test 1: Content-Only Change (Should Skip Deploy)**
```bash
echo "# Test" > public/content/guides/test-page.md
git add public/content/guides/test-page.md
git commit -m "Add test page"
git push
```

**Expected result:**
- GitHub Actions runs
- Workflow shows "⏭️ Only content files changed - skipping deploy"
- No Cloudflare build triggered
- Page loads dynamically from GitHub

**Test 2: Code Change (Should Deploy)**
```bash
# Make any non-content change
echo "/* test */" >> src/main.jsx
git add src/main.jsx
git commit -m "Test code change"
git push
```

**Expected result:**
- GitHub Actions runs
- Workflow shows "✅ Non-content files changed - deploy needed"
- Cloudflare build triggered via webhook
- Full deployment happens

**Test 2b: Submodule Update (Should Deploy)**
```bash
# Update the framework submodule
cd wiki-framework && git pull origin main && cd ..
git add wiki-framework
git commit -m "Update framework"
git push
```

**Expected result:**
- GitHub Actions runs
- Workflow shows "📦 Submodule change detected (wiki-framework)"
- Cloudflare build triggered via webhook
- Full deployment happens (framework updates need deployment)

**Test 3: Force Deploy with Keyword**
```bash
echo "More content" >> public/content/guides/test-page.md
git add public/content/guides/test-page.md
git commit -m "Update test page [deploy-required]"
git push
```

**Expected result:**
- GitHub Actions runs
- Workflow shows "✅ [deploy-required] keyword found - forcing deploy"
- Cloudflare build triggered
- Full deployment happens

### 6. Toggle Dynamic Page Loading

**To disable dynamic loading and revert to normal deploys:**
1. Edit `wiki-config.json`:
   ```json
   {
     "features": {
       "dynamicPageLoading": {
         "enabled": false  // Changed from true
       }
     }
   }
   ```
2. Commit and push:
   ```bash
   git add wiki-config.json
   git commit -m "Disable dynamic page loading [deploy-required]"
   git push
   ```

**Now all commits will trigger deploys**, even content-only changes (backward compatible behavior).

## Commit Message Keywords

### Force Deploy
Use when you need to deploy despite only content changing:
- `[deploy-required]`
- `[force-deploy]`

**Example:**
```bash
git commit -m "Important content update [deploy-required]"
```

### Skip Deploy
Use when you want to skip deploy despite code changing:
- `[skip-deploy]`
- `[no-deploy]`

**Example:**
```bash
git commit -m "Refactor code (no functional change) [skip-deploy]"
```

## Troubleshooting

### Workflow Not Running
**Problem:** GitHub Actions workflow doesn't run on push.

**Solution:**
- Check workflow file exists: `.github/workflows/conditional-deploy.yml`
- Check GitHub Actions is enabled: Settings → Actions → General
- Check workflow syntax: Go to Actions tab, look for errors

### Deploy Not Triggering
**Problem:** Workflow runs but Cloudflare deploy doesn't start.

**Solution:**
- Verify `CLOUDFLARE_DEPLOY_HOOK` secret is set correctly
- Check deploy hook is active in Cloudflare Pages settings
- Look for "Deploy trigger failed" in workflow logs

### Deploy Hook Returns Error
**Problem:** Workflow shows `❌ Deploy trigger failed`.

**Solution:**
- Verify the deploy hook ID in GitHub secret
- Check deploy hook wasn't deleted in Cloudflare Pages
- Recreate deploy hook and update secret

### Dynamic Loading Not Working
**Problem:** Pages still load from static bundle.

**Solution:**
- Check `dynamicPageLoading.enabled: true` in `wiki-config.json`
- Hard refresh browser (Ctrl+Shift+R)
- Check browser console for `[DynamicPageLoader]` logs
- Verify config was deployed (check `public/wiki-config.json` in build)

## Monitoring

### View Workflow Runs
- Go to repository → **Actions** tab
- Click on **Conditional Cloudflare Deploy** workflow
- View individual run logs

### View Cloudflare Deployments
- Go to Cloudflare Pages dashboard
- Click on your project
- View **Deployments** tab
- Should see fewer deploys after setup

### Check Build Quota
- Cloudflare Pages dashboard
- Select project → **Settings**
- View **Build usage** statistics

## Cost Impact

### Before Conditional Deployments
- Every commit = 1 build
- 20 content edits/day = ~600 builds/month
- Exceeds free tier (500 builds/month)
- Need paid tier ($20/month)

### After Conditional Deployments
- Only code/config changes = builds
- 20 content edits/day + 2 code changes/day = ~60 builds/month
- Well within free tier
- Cost: $0/month

## Rollback Plan

If issues arise, you can quickly revert:

1. **Re-enable automatic Cloudflare deploys:**
   - Cloudflare Pages → Settings → Builds & deployments
   - Enable automatic deployments for production branch

2. **Disable GitHub Actions workflow:**
   - Rename workflow file: `conditional-deploy.yml.disabled`
   - Commit and push

3. **Or delete the workflow:**
   ```bash
   git rm .github/workflows/conditional-deploy.yml
   git commit -m "Revert to automatic Cloudflare deploys"
   git push
   ```

Cloudflare will immediately resume automatic deployments on every push.

## Summary

✅ **Setup complete!**
- Content-only commits skip builds (when dynamic loading enabled)
- Code commits trigger full deploys
- Commit message keywords provide manual control
- Backward compatible (works with dynamic loading on or off)
- Conserves build quota and stays within free tier

For questions or issues, check the [GitHub Actions workflow logs](../../actions) or Cloudflare Pages deployment history.
