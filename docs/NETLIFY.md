# Netlify Bot Setup Guide

## Overview

The wiki uses a bot token to create comment issues. For security, the bot token is **only stored on the server-side** (Netlify), never in client code.

## Architecture

```
Client (Browser)           Netlify Function          GitHub API
     |                            |                      |
     | POST comment              |                      |
     |-------------------------->|                      |
     |                           |                      |
     |                           | Use WIKI_BOT_TOKEN   |
     |                           |--------------------->|
     |                           |                      |
     |                           |<---------------------|
     |                           | Create issue         |
     |<--------------------------|                      |
     | Return issue data         |                      |
```

**Key Point**: The bot token (`WIKI_BOT_TOKEN`) is **only accessible to Netlify Functions**, not the client-side JavaScript.

---

## Setup Instructions

### Step 1: Get Your Bot Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Name it: `SlayerLegend Wiki Bot`
4. Set expiration: **No expiration** (or your preferred duration)
5. **Select these permissions**:
   - ✅ `public_repo` (or `repo` for private repos)
   - ✅ `read:user`
6. Click **"Generate token"**
7. **COPY THE TOKEN NOW** - you won't see it again!

**Important**: This token should be for a dedicated bot account, NOT your personal account.

---

### Step 2: Add Token to Netlify

1. Go to your **Netlify dashboard**: https://app.netlify.com
2. Select your **wiki site**
3. Navigate to: **Site settings** → **Build & Deploy** → **Environment**
4. Click **"Add a variable"**
5. Add the following:

   ```
   Key:   WIKI_BOT_TOKEN
   Value: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   **⚠️ IMPORTANT**: Use `WIKI_BOT_TOKEN` (NOT `VITE_WIKI_BOT_TOKEN`)
   - `VITE_*` variables are exposed to client code (insecure!)
   - Without the `VITE_` prefix, it's only available to Netlify Functions (secure!)

6. **Scopes**: Keep it at **"All scopes"** (or select specific deploy contexts if needed)
7. Click **"Create variable"**

---

### Step 3: Remove Client-Side Token (If Present)

**CRITICAL**: If you previously had `VITE_WIKI_BOT_TOKEN` in Netlify:

1. Go to: **Site settings** → **Build & Deploy** → **Environment**
2. **DELETE** any variable named `VITE_WIKI_BOT_TOKEN`
3. Only keep `WIKI_BOT_TOKEN` (without the VITE_ prefix)

---

### Step 4: Redeploy

After adding the environment variable:

1. Go to: **Deploys** tab in Netlify
2. Click **"Trigger deploy"** → **"Clear cache and deploy site"**
3. Wait for deployment to complete

**OR** push a new commit:

```bash
git add .
git commit -m "Configure bot token for Netlify Functions"
git push
```

---

## Testing

### 1. Test Comment Creation

1. Navigate to any wiki page
2. Sign in with GitHub
3. Try posting a comment
4. ✅ **Success**: Comment appears and issue is created by bot
5. ❌ **Error**: Check the error message and logs

### 2. Check Netlify Function Logs

1. Go to Netlify dashboard → **Functions** tab
2. Click on `create-comment-issue`
3. View the **logs** to see if the function is being called
4. Look for errors like:
   - `Bot token not configured` → Variable not set
   - `Invalid bot token` → Wrong token or expired
   - `Permission denied` → Bot doesn't have `repo` permission

---

## Troubleshooting

### Error: "Bot token not configured"

**Cause**: `WIKI_BOT_TOKEN` environment variable is not set in Netlify

**Solution**:
1. Check **Site settings** → **Environment** in Netlify
2. Ensure `WIKI_BOT_TOKEN` exists and has a value
3. Redeploy the site

---

### Error: "Permission denied"

**Cause**: Bot token doesn't have the right permissions

**Solution**:
1. Go to: https://github.com/settings/tokens
2. Click on your bot token
3. Ensure `public_repo` (or `repo`) is checked
4. If you changed permissions, update the token in Netlify
5. Redeploy

---

### Error: "Invalid bot token"

**Cause**: Token is incorrect, expired, or revoked

**Solution**:
1. Generate a new token: https://github.com/settings/tokens
2. Update `WIKI_BOT_TOKEN` in Netlify with new value
3. Redeploy

---

### Comments Work But Users Can Close Issues

**Cause**: Issues are being created by users instead of the bot

**Solution**:
1. Check that `WIKI_BOT_TOKEN` is set correctly in Netlify
2. Check Netlify Function logs for errors
3. Verify the bot account has proper permissions
4. Issues created by the bot will show the bot as the author

---

## Security Best Practices

### ✅ DO:
- Use a dedicated bot account (not your personal account)
- Use `WIKI_BOT_TOKEN` (without `VITE_` prefix) in Netlify
- Keep the token secret - never commit it to Git
- Use "No expiration" or set reminders to rotate token
- Give bot only necessary permissions (`public_repo` or `repo`)

### ❌ DON'T:
- Use `VITE_WIKI_BOT_TOKEN` in Netlify (exposes token to client!)
- Commit the token to `.env.local` and push to Git
- Share the token publicly
- Use your personal account's token
- Give bot `admin` or `delete_repo` permissions

---

## How It Works (Technical Details)

### Before (Insecure - OLD)

```javascript
// ❌ Client-side code (INSECURE!)
const botToken = import.meta.env.VITE_WIKI_BOT_TOKEN; // Bundled into JS!
const octokit = new Octokit({ auth: botToken });
await octokit.rest.issues.create({ ... });
```

**Problem**: Bot token is exposed in client JavaScript bundle → anyone can steal it!

### After (Secure - NEW)

```javascript
// ✅ Client-side code (SECURE!)
const response = await fetch('/.netlify/functions/create-comment-issue', {
  method: 'POST',
  body: JSON.stringify({ owner, repo, title, body, labels })
});

// ✅ Server-side Netlify Function (SECURE!)
const botToken = process.env.WIKI_BOT_TOKEN; // Only on server!
const octokit = new Octokit({ auth: botToken });
await octokit.rest.issues.create({ ... });
```

**Solution**: Bot token stays on server → never exposed to client!

---

## Verification

After setup, verify everything is working:

1. **Check Environment Variables**:
   - Netlify → Site settings → Environment
   - Should see: `WIKI_BOT_TOKEN` (NOT `VITE_WIKI_BOT_TOKEN`)

2. **Check Netlify Functions**:
   - Netlify → Functions tab
   - Should see: `create-comment-issue`

3. **Post a Test Comment**:
   - Navigate to any wiki page
   - Sign in and post a comment
   - Check GitHub issues - new issue should be created **by the bot account**

4. **Check Function Logs**:
   - Netlify → Functions → `create-comment-issue`
   - Should see: `[Bot Function] Created issue #X for owner/repo`

---

## Need Help?

If you encounter issues:

1. Check Netlify Function logs for detailed error messages
2. Verify bot token permissions on GitHub
3. Ensure `WIKI_BOT_TOKEN` (not `VITE_WIKI_BOT_TOKEN`) is set
4. Try regenerating the bot token
5. Open an issue on the wiki repository

---

## Summary

✅ **Secure Setup Complete When**:
- `WIKI_BOT_TOKEN` set in Netlify (without `VITE_` prefix)
- `VITE_WIKI_BOT_TOKEN` removed from Netlify (if it existed)
- Bot token never appears in client-side code
- Comments create issues as the bot account
- Users cannot close comment issues

🔒 **Security**: Bot token is only accessible to Netlify Functions, never exposed to the client.
