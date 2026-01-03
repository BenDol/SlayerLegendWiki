# Repository Permissions & Security Configuration

This document outlines the recommended permissions and security settings for the Slayer Legend Wiki repository and its CDN repository.

## Table of Contents
1. [Wiki Repository (SlayerLegendWiki)](#wiki-repository-slayerlegendwiki)
2. [CDN Repository (SlayerLegendCDN)](#cdn-repository-slayerlegendcdn)
3. [Bot Account Setup](#bot-account-setup)
4. [Environment Variables](#environment-variables)

---

## Wiki Repository (SlayerLegendWiki)

### Branch Protection Rules

#### Main Branch (`main`)

**Pull Request Requirements:**
- ✅ **Require a pull request before merging**
  - Required approvals: **1**
  - Dismiss stale pull request approvals when new commits are pushed: **Yes**
  - Require review from Code Owners: **No** (unless you have CODEOWNERS file)

**Status Checks:**
- ✅ **Require status checks to pass before merging**
  - Required checks:
    - `build` - Ensures site builds successfully
    - `test` - Runs automated tests
    - `search-index` - Verifies search index generation
  - Require branches to be up to date before merging: **No**
    - Disabled to reduce friction with concurrent edits

**Additional Rules:**
- ✅ **Require conversation resolution before merging**
  - Ensures all review comments are addressed
- ❌ **Require signed commits** - Too restrictive for community wiki
- ❌ **Require linear history** - Merge commits are acceptable
- ❌ **Require deployments to succeed** - Optional, only if using preview deployments

**Apply Rules To:**
- ✅ **Include administrators** (Recommended)
  - Ensures consistency, but admins can bypass in emergencies
- ❌ **Allow force pushes** - Never enable on main branch
- ❌ **Allow deletions** - Never enable on main branch

**Bypass Restrictions:**
- Do NOT add bot account to bypass list
- Bot should create PRs and follow normal review flow

#### Development Branch (`dev`) - Optional

If you use a development/staging branch:
- ✅ **Require a pull request before merging**
  - Required approvals: **0** (allow self-merge for testing)
  - Dismiss stale approvals: **No**
- ✅ **Require status checks**
  - `build`: **Yes** (basic sanity check)
- ❌ **Allow force pushes** - No
- ❌ **Allow deletions** - No

### GitHub Actions Permissions

**Location:** Settings → Actions → General

**Actions Permissions:**
- ✅ **Allow all actions and reusable workflows**

**Workflow Permissions:**
- ✅ **Read repository contents and packages permissions** ⭐ **CURRENT & RECOMMENDED**
  - More secure (principle of least privilege)
  - Workflows use bot tokens from secrets for write operations
  - This is the correct approach

**Alternative (NOT recommended for this project):**
- ❌ **Read and write permissions**
  - Only needed if workflows commit directly using GITHUB_TOKEN
  - Since we use bot tokens, read-only is better

**Pull Request Permissions:**
- ❌ **Allow GitHub Actions to create and approve pull requests**
  - Not needed - bot account handles PR creation

### Collaborator Access

**Repository Maintainers:**
- Role: **Write** or **Maintain**
- Can review and merge PRs
- Can manage issues and discussions

**Bot Account:**
- Role: **Write**
- Used for automated operations (anonymous edits, video uploads, etc.)
- Should NOT be added to branch protection bypass list

**Contributors:**
- External contributors fork the repository
- Submit PRs from their forks
- No direct write access needed

### Security Settings

**Location:** Settings → Security

**Code Security and Analysis:**
- ✅ **Dependabot alerts** - Enabled
- ✅ **Dependabot security updates** - Enabled
- ⚠️ **Dependabot version updates** - Optional (can be noisy)
- ✅ **Secret scanning** - Enabled (GitHub Advanced Security if available)

**Secrets:**
- Never commit secrets to repository
- Use GitHub Secrets or environment variables
- Rotate tokens regularly (every 6 months)

---

## CDN Repository (SlayerLegendCDN)

### Branch Protection Rules

#### Main Branch (`main`)

**Pull Request Requirements:**
- ✅ **Require a pull request before merging**
  - Required approvals: **1**
  - Dismiss stale pull request approvals when new commits are pushed: **Yes**

**Status Checks:**
- ⚠️ **Require status checks to pass before merging** - Optional
  - No automated checks needed for CDN repo
  - Manual review is sufficient

**Additional Rules:**
- ✅ **Require conversation resolution before merging**
- ❌ **Require signed commits** - No
- ❌ **Require linear history** - No

**Apply Rules To:**
- ✅ **Include administrators** (Recommended)
- ❌ **Allow force pushes** - Never enable
- ❌ **Allow deletions** - Never enable

### Repository Settings

**General Settings:**
- ❌ **Wikis** - Disabled (not needed)
- ❌ **Issues** - Disabled (use main wiki repo for issues)
- ⚠️ **Discussions** - Optional
- ✅ **Allow merge commits** - Enabled
- ✅ **Allow squash merging** - Enabled
- ✅ **Automatically delete head branches** - Enabled

**Access:**
- Bot account needs **Write** access
- Bot must have access for both Git LFS and regular commits
- Add wiki maintainers as collaborators

### Git LFS Configuration

**Required Setup:**
1. Initialize LFS in repository: `git lfs install`
2. Track video formats in `.gitattributes`:
   ```
   *.mp4 filter=lfs diff=lfs merge=lfs -text
   *.webm filter=lfs diff=lfs merge=lfs -text
   *.mov filter=lfs diff=lfs merge=lfs -text
   *.avi filter=lfs diff=lfs merge=lfs -text
   ```
3. Commit `.gitattributes` to main branch BEFORE any uploads

**Storage Limits:**
- Free tier: 1GB LFS storage, 1GB bandwidth/month
- Paid: $5/month for 50GB storage, 50GB bandwidth
- Monitor: Settings → Billing → Git LFS Data

---

## Bot Account Setup

### Creating the Bot Account

1. **Create a dedicated GitHub account** for automation
   - Username: Something like `slayerwiki-bot`
   - Email: Separate email address for the bot

2. **Generate Personal Access Token (PAT)**
   - Go to Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Note: "Slayer Wiki Bot Token"
   - Scopes required:
     - ✅ `repo` (Full control of private repositories)
       - Includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`
       - Needed for: Creating PRs, committing files, LFS access
     - ✅ `workflow` (Update GitHub Action workflows) - Optional
       - Only if bot needs to modify workflows
   - Expiration: **90 days** or **1 year** (set calendar reminder to rotate)
   - Copy token immediately (won't be shown again)

3. **Add bot as collaborator**
   - Wiki repo: Settings → Collaborators → Add `slayerwiki-bot` with **Write** access
   - CDN repo: Settings → Collaborators → Add `slayerwiki-bot` with **Write** access

### Token Security

**Storage:**
- ❌ Never commit tokens to repository
- ✅ Store in GitHub Secrets
- ✅ Store in deployment platform environment variables
- ✅ Store in local `.env.local` (add to `.gitignore`)

**Rotation:**
- Rotate tokens every 6-12 months
- Set expiration date when creating token
- Update in all locations when rotated

**Monitoring:**
- Regularly review bot account activity
- Check for unexpected commits or PRs
- Revoke token immediately if compromised

---

## Environment Variables

### Required Secrets

#### Wiki Repository Secrets

**Location:** Settings → Secrets and variables → Actions

| Secret Name | Purpose | Value |
|-------------|---------|-------|
| `WIKI_BOT_TOKEN` | Bot token for creating PRs, commits | GitHub PAT with `repo` scope |
| `CDN_REPO_TOKEN` | Token for CDN repository access | Same as `WIKI_BOT_TOKEN` or separate PAT |
| `SENDGRID_API_KEY` | Email verification for anonymous edits | SendGrid API key |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA verification | Google reCAPTCHA secret key |

### Deployment Platform Variables

#### Netlify

**Location:** Site Settings → Environment Variables

```
CDN_REPO_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
WIKI_BOT_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
RECAPTCHA_SECRET_KEY=6Lxxxxxxxxxxxxxxxxxx
```

#### Cloudflare Workers

**Location:** Workers & Pages → Your Project → Settings → Variables and Secrets

Add as **Secrets** (encrypted):
```bash
wrangler secret put CDN_REPO_TOKEN
wrangler secret put WIKI_BOT_TOKEN
wrangler secret put SENDGRID_API_KEY
wrangler secret put RECAPTCHA_SECRET_KEY
```

### Local Development

**File:** `.env.local` (in project root)

```bash
# GitHub Bot Token
CDN_REPO_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
WIKI_BOT_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Email Service
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx

# reCAPTCHA
RECAPTCHA_SECRET_KEY=6Lxxxxxxxxxxxxxxxxxx
RECAPTCHA_SITE_KEY=6Lxxxxxxxxxxxxxxxxxx

# Optional: GitHub OAuth (if using)
GITHUB_CLIENT_ID=xxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxx
```

**Important:** Ensure `.env.local` is in `.gitignore`

---

## Permission Architecture

### Why This Setup?

**Separation of Concerns:**
- **Workflows (GITHUB_TOKEN)**: Read-only checks (build, test)
- **Bot Token**: Write operations (create PRs, commits, LFS uploads)
- This separation is more secure and follows best practices

**Security Benefits:**
1. Workflows can't accidentally write to repository
2. Bot token can be rotated without changing workflows
3. Limited blast radius if token is compromised
4. Audit trail shows bot account for automated actions

### Permission Flow Diagram

```
User Upload → Serverless Function
                    ↓
            Uses CDN_REPO_TOKEN
                    ↓
            Creates PR in CDN Repo (as bot)
                    ↓
            Creates PR in Wiki Repo (as bot)
                    ↓
            Human reviews both PRs
                    ↓
            Merges both PRs
                    ↓
            Video live on site
```

### Anonymous Edits Flow

```
Anonymous User → Email Verification
                        ↓
                Uses WIKI_BOT_TOKEN
                        ↓
                Bot creates PR with labels
                        ↓
                Human reviews PR
                        ↓
                Merges PR
                        ↓
                Content live on site
```

---

## Troubleshooting

### Common Permission Issues

**"Resource not accessible by integration" error:**
- Workflow trying to write with read-only GITHUB_TOKEN
- Solution: Use bot token from secrets instead

**Bot can't create PRs:**
- Check bot has Write access to repository
- Verify token has `repo` scope
- Check token hasn't expired

**LFS authentication errors:**
- Bot token needs `repo` scope for LFS access
- Verify `.gitattributes` is committed to main branch
- Check LFS is initialized in repository

**Anonymous edits failing:**
- Verify `WIKI_BOT_TOKEN` is set in deployment platform
- Check bot account has Write access
- Review rate limiting settings in config

### Verifying Bot Permissions

**Test script** (`test-bot-permissions.js`):
```javascript
const { Octokit } = require('@octokit/rest');

const token = process.env.WIKI_BOT_TOKEN;
const octokit = new Octokit({ auth: token });

async function testPermissions() {
  try {
    // Test repository access
    const { data: repo } = await octokit.repos.get({
      owner: 'BenDol',
      repo: 'SlayerLegendWiki'
    });
    console.log('✅ Repository access: OK');
    console.log(`   Permissions: ${JSON.stringify(repo.permissions)}`);

    // Test branch access
    const { data: branch } = await octokit.repos.getBranch({
      owner: 'BenDol',
      repo: 'SlayerLegendWiki',
      branch: 'main'
    });
    console.log('✅ Branch access: OK');

    // Test PR creation ability (doesn't actually create)
    console.log('✅ Bot has Write access');
  } catch (error) {
    console.error('❌ Permission test failed:', error.message);
  }
}

testPermissions();
```

Run: `node test-bot-permissions.js`

---

## Checklist

### Initial Setup

**Wiki Repository:**
- [ ] Branch protection configured on `main`
- [ ] Actions permissions set to "Read repository contents"
- [ ] Bot account added as collaborator (Write access)
- [ ] Security features enabled (Dependabot, secret scanning)
- [ ] Secrets configured (`WIKI_BOT_TOKEN`, `CDN_REPO_TOKEN`, etc.)

**CDN Repository:**
- [ ] Repository created and public
- [ ] Git LFS initialized (`.gitattributes` committed)
- [ ] Branch protection configured on `main`
- [ ] Bot account added as collaborator (Write access)
- [ ] README and PR template added

**Deployment Platforms:**
- [ ] Netlify: Environment variables configured
- [ ] Cloudflare: Secrets configured
- [ ] Local: `.env.local` created and added to `.gitignore`

### Ongoing Maintenance

**Quarterly:**
- [ ] Review bot account activity for anomalies
- [ ] Check LFS storage and bandwidth usage
- [ ] Audit collaborator access list

**Semi-Annually:**
- [ ] Rotate bot token
- [ ] Review and update branch protection rules
- [ ] Update dependencies (Dependabot PRs)

**Annually:**
- [ ] Comprehensive security audit
- [ ] Review and document any permission changes
- [ ] Update this documentation

---

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Actions Permissions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token)
- [Git LFS Documentation](https://git-lfs.github.com/)
- [CDN Repository Setup Guide](.claude/plans/cdn-repo-setup.md)
