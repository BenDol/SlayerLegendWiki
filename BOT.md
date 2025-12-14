# Bot Account Setup Guide

## Overview

This guide explains how to set up a GitHub bot account for your wiki's comment system. **The bot token is REQUIRED for comments to work.** Without it, the comment system will be completely disabled.

## Why Bot Token is Required

**Without a bot token:**
- **Comments are completely disabled** - users will see an error when trying to comment
- Users cannot create comment issues (requires bot account)
- This prevents users from being able to close their own comment threads

**With a bot token:**
- Comments are fully functional
- The bot account creates all comment issues
- Regular users can only comment, not close issues
- Only the bot account and repository maintainers can close issues
- Professional and secure comment management

## Solution: Bot Account

### Step 1: Create Bot GitHub Account

1. **Sign out of your personal GitHub account** (or use incognito/private browsing)

2. **Create a new GitHub account:**
   - Go to https://github.com/signup
   - Choose a username for your bot (e.g., `slayerlegend-wiki-bot`, `my-wiki-bot`)
   - Use an email you control (can be same domain, different address)
   - Complete GitHub registration

3. **Verify the bot account's email**

**Recommended naming convention:**
- Format: `{project-name}-wiki-bot`
- Examples:
  - `slayerlegend-wiki-bot`
  - `awesome-project-wiki-bot`
  - `my-wiki-bot`

### Step 2: Add Bot as Collaborator

1. **Go to your wiki repository on GitHub**
   - Navigate to: `https://github.com/{owner}/{repo}`

2. **Go to Settings → Collaborators**
   - Click "Settings" tab
   - Click "Collaborators" in the sidebar
   - You may need to confirm your password

3. **Add the bot account**
   - Click "Add people"
   - Enter the bot account username
   - Select the bot account from the dropdown
   - Click "Add {bot-username} to this repository"

4. **Set permissions to "Write"**
   - The bot needs write access to create issues
   - **Do NOT give Admin access** (unnecessary and insecure)

5. **Accept the invitation**
   - Sign in as the bot account
   - Go to https://github.com/notifications
   - Accept the repository invitation

### Step 3: Generate Bot Personal Access Token

1. **Sign in as the bot account**

2. **Go to Developer Settings:**
   - Navigate to: https://github.com/settings/tokens
   - Or: Profile icon → Settings → Developer settings → Personal access tokens → Tokens (classic)

3. **Generate new token (classic):**
   - Click "Generate new token" → "Generate new token (classic)"
   - **Note:** Use classic tokens, not fine-grained (easier setup)

4. **Configure the token:**
   - **Note:** `Wiki Bot Token - Comment Issues`
   - **Expiration:** Choose based on your needs:
     - `No expiration` (convenient, but less secure)
     - `90 days` or `1 year` (more secure, requires rotation)
   - **Scopes:** Select `repo` (full control of private repositories)
     - Check the `repo` checkbox
     - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`
     - **Note:** For now, `repo` scope is sufficient for comment issues
     - **Optional:** Add `workflow` scope if you plan to have the bot edit GitHub Actions workflows in the future (not needed currently)

5. **Generate token:**
   - Click "Generate token" at the bottom
   - **Copy the token immediately** - you won't see it again!
   - Format: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

6. **Store token securely:**
   - **DO NOT commit this token to git**
   - **DO NOT share this token publicly**
   - Store in password manager or secure notes

### Step 4: Configure Bot Token in Your Wiki

#### For Local Development (.env.local)

1. **Create or edit `.env.local` file** in your wiki root:
   ```bash
   # Copy from example if it doesn't exist
   cp .env.example .env.local
   ```

2. **Add the bot token:**
   ```env
   VITE_WIKI_BOT_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   **Note:** Use `VITE_WIKI_BOT_TOKEN` (not `VITE_GITHUB_BOT_TOKEN`) - GitHub reserves the `GITHUB_*` prefix for its own use.

3. **Verify it's gitignored:**
   - Check `.gitignore` includes `.env.local`
   - This prevents accidentally committing the token

4. **Restart your dev server:**
   ```bash
   npm run dev
   ```

5. **Verify bot is working:**
   - Check console logs when app starts
   - Should see: `[Bot] ✓ Bot Octokit initialized successfully`
   - If you see warning, the token isn't configured properly

#### For GitHub Pages Deployment (GitHub Secrets)

1. **Go to your repository on GitHub**

2. **Navigate to Settings → Secrets and variables → Actions**

3. **Add repository secret:**
   - Click "New repository secret"
   - Name: `WIKI_BOT_TOKEN`
   - Value: Paste your bot token
   - Click "Add secret"

   **Note:** Use `WIKI_BOT_TOKEN` (not `GITHUB_BOT_TOKEN`) - GitHub reserves the `GITHUB_*` prefix and won't allow it.

4. **Update GitHub Actions workflow** (`.github/workflows/deploy.yml`):
   ```yaml
   - name: Build
     env:
       VITE_GITHUB_CLIENT_ID: ${{ secrets.GITHUB_CLIENT_ID }}
       VITE_WIKI_BOT_TOKEN: ${{ secrets.WIKI_BOT_TOKEN }}  # Add this line
     run: npm run build
   ```

5. **Commit and push:**
   - The next deployment will use the bot token
   - Comment issues will be created by the bot

### Step 5: Test the Bot

1. **Navigate to a wiki page without comments**

2. **Sign in as a regular user (not the bot)**

3. **Post a comment**

4. **Check the console logs:**
   ```
   [Comments] Creating page issue with bot token (users cannot close)
   [Comments] Created page issue #42 for {Page Title} in branch: main (bot)
   ```

5. **Verify on GitHub:**
   - Go to the Issues tab
   - Find the new comment issue
   - **Issue creator should be the bot account** ✅
   - Try to close the issue as a regular user → **Should fail** ✅

## Verification Checklist

After setup, verify everything works:

- [ ] Bot account created
- [ ] Bot added as repository collaborator (Write access)
- [ ] Bot accepted the invitation
- [ ] Personal access token generated for bot
- [ ] Token has `repo` scope
- [ ] Token added to `.env.local` (local dev)
- [ ] Token added to GitHub Secrets (deployment)
- [ ] Console shows bot initialized successfully
- [ ] New comment issues created by bot account
- [ ] Regular users cannot close bot-created issues

## Troubleshooting

### Bot Token Not Working

**Symptoms:**
- Console shows: `[Bot] Bot token not configured`
- Issues still created by regular users
- Warning about bot token in console

**Solutions:**
1. Check `.env.local` file exists and has `VITE_WIKI_BOT_TOKEN`
2. Restart dev server after adding token
3. Verify token format starts with `ghp_`
4. Ensure token has `repo` scope
5. Check bot is a repository collaborator with Write access

### Issues Still Created by Users

**Symptoms:**
- Issues created by user accounts, not bot
- Console shows bot warnings

**Cause:**
Bot token not configured properly.

**Solution:**
1. Check console for bot initialization message
2. Verify token in `.env.local`
3. Restart dev server
4. Clear browser cache and hard refresh

### Bot Account Doesn't Have Permission

**Symptoms:**
- Error: `Resource not accessible by integration`
- Error: `Not Found`
- Issues fail to create

**Solutions:**
1. Verify bot accepted the collaborator invitation
2. Check bot has Write (not just Read) access
3. Verify token has `repo` scope
4. Regenerate token if it expired

### Token Expired

**Symptoms:**
- Worked before, stopped working
- Error: `Bad credentials`

**Solution:**
1. Check token expiration date
2. Generate new token
3. Update `.env.local` and GitHub Secrets
4. Restart services

## Security Best Practices

### Token Security

1. **Never commit tokens to git**
   - Always use `.env.local` (gitignored)
   - Use GitHub Secrets for deployment

2. **Use minimal permissions**
   - Only `repo` scope needed
   - Don't give bot Admin access to repository

3. **Rotate tokens periodically**
   - Set expiration (90 days recommended)
   - Update token before expiration

4. **Monitor bot activity**
   - Check bot account activity regularly
   - Review issues created by bot

### Repository Security

1. **Bot should only be Collaborator (Write access)**
   - NOT Owner
   - NOT Admin
   - Just Write is sufficient

2. **Keep token in secrets management**
   - Password manager
   - GitHub Secrets
   - Environment variables only

3. **Audit bot permissions**
   - Regularly review what bot can access
   - Remove access if no longer needed

## Token Scope Management

### Current Scope: `repo` (Recommended)

**Sufficient for:**
- ✅ Creating comment issues
- ✅ Managing labels
- ✅ Creating content edit PRs
- ✅ All current bot functionality

### When to Add `workflow` Scope

**Add `workflow` scope if you want the bot to:**
- Edit GitHub Actions workflow files (`.github/workflows/*.yml`)
- Create PRs that modify workflows
- Dynamically generate workflows based on wiki config
- Implement self-updating automation

**Examples of future use cases:**
```javascript
// Bot creates custom workflows
bot.createWorkflow('deploy-preview.yml', config);

// Bot updates workflows when config changes
bot.updateWorkflow('deploy.yml', newConfig);
```

### How to Upgrade Scope

1. **Generate new token** with both `repo` + `workflow` scopes
2. **Update `.env.local`** with new token
3. **Update GitHub Secrets** with new token
4. **Test locally**
5. **Delete old token**

**Note:** You can add `workflow` scope during your next token rotation (90 days recommended).

## Token Rotation

When it's time to rotate the bot token:

1. **Generate new token** (follow Step 3 above)
   - Use same scopes as before (or upgrade if needed)
2. **Update `.env.local`** with new token
3. **Update GitHub Secrets** with new token
4. **Test locally** to verify it works
5. **Deploy** to update production
6. **Delete old token** on GitHub:
   - Go to https://github.com/settings/tokens
   - Find the old token
   - Click "Delete"

## Alternative: GitHub App (Advanced)

For larger wikis or multiple repositories, consider creating a GitHub App instead:

**Pros:**
- More official and professional
- Fine-grained permissions
- Can be installed on multiple repos
- Better audit trail

**Cons:**
- More complex setup
- Requires hosting app logic
- Need to handle webhooks

**When to use:**
- Multiple wikis using same bot
- Need advanced features
- Want fine-grained permissions
- Enterprise deployment

**Setup:**
Not covered in this guide. See [GitHub Apps Documentation](https://docs.github.com/en/apps).

## FAQ

### Q: Do I need a bot token?

**A:** Yes, it's **REQUIRED**:
- **Without bot token:** Comments are completely disabled - users will get an error
- **With bot token:** Comments work properly, and only maintainers can close issues
- The bot account is the only way to create comment issues

### Q: Can I use my personal token instead of creating a bot?

**A:** No, personal tokens won't work:
- The system requires a bot token specifically configured via `VITE_WIKI_BOT_TOKEN`
- Personal tokens would create issues under your name (users could close them)
- Bot accounts provide proper separation and permission control
- This is a security and user experience requirement

### Q: What happens to existing issues created by users?

**A:** They remain unchanged:
- Old issues still owned by users who created them
- Only new issues will be created by bot
- Consider manually transferring old issues if needed

### Q: How much does a bot account cost?

**A:** It's free:
- GitHub accounts are free
- Bot accounts don't need paid features
- No cost for issue creation

### Q: Can the bot account have any username?

**A:** Yes, but follow conventions:
- Use descriptive name with "bot" in it
- Make it clear it's automated
- Examples: `project-wiki-bot`, `project-bot`

### Q: What if my bot token leaks?

**Immediate actions:**
1. **Delete the token immediately** on GitHub
2. Generate a new token
3. Update all instances (local + secrets)
4. Review bot's recent activity
5. Check if unauthorized issues were created
6. Consider rotating bot's permissions

## Support

If you encounter issues:
1. Check console logs for bot messages
2. Verify all steps in checklist
3. Test with a simple comment
4. Check GitHub's status page
5. Regenerate token if problems persist

## Summary

**Setup Steps:**
1. ✅ Create bot GitHub account
2. ✅ Add bot as collaborator (Write access)
3. ✅ Generate bot Personal Access Token (`repo` scope)
4. ✅ Add token to `.env.local` and GitHub Secrets
5. ✅ Test by posting a comment
6. ✅ Verify issue created by bot account

**Result:**
- Comment issues created by bot account
- Regular users cannot close issues
- Only maintainers control issue lifecycle
- More professional comment management

**Maintenance:**
- Rotate tokens before expiration
- Monitor bot activity
- Update token in all environments
- Keep bot account secure
