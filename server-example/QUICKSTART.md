# Anonymous Edit Mode - Quick Start Guide

This guide will help you set up anonymous editing for your wiki in under 10 minutes.

## What is Anonymous Mode?

Anonymous mode allows users to edit your wiki without signing in. Their edits are submitted as pull requests created by a bot account.

**Use cases:**
- Community wikis with many casual contributors
- Lowering the barrier to entry for new contributors
- Quick fixes and typo corrections

**Trade-offs:**
- Contributors don't earn prestige
- No automatic attribution to real users
- Requires backend server to protect bot credentials
- Moderation recommended for anonymous contributions

## Prerequisites

- Node.js 16+ installed
- A GitHub account for your bot (e.g., `yourwiki-bot`)
- 10 minutes of setup time

## Step 1: Create Bot Account (3 minutes)

1. **Create new GitHub account**
   - Sign out of GitHub
   - Go to https://github.com/signup
   - Create account: `yourwiki-bot` (or similar name)
   - Verify email

2. **Generate Personal Access Token**
   - Go to https://github.com/settings/tokens
   - Click "Generate new token" → "Fine-grained tokens"
   - Token name: `Wiki Anonymous Edits`
   - Expiration: 90 days
   - Repository access: Only select repositories → Your wiki repo
   - Permissions:
     - Contents: Read and write ✅
     - Pull requests: Read and write ✅
   - Click "Generate token"
   - **COPY THE TOKEN** (you won't see it again)

3. **Add bot as collaborator**
   - Go to your wiki repo
   - Settings → Collaborators
   - Add `@yourwiki-bot` with **Write** access
   - Bot must accept the invitation (check bot account email)

## Step 2: Set Up Server (3 minutes)

1. **Install dependencies**
   ```bash
   cd server-example
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file**
   ```env
   BOT_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx  # Your bot token
   REPO_OWNER=YourUsername                      # Your GitHub username
   REPO_NAME=YourWikiRepo                       # Your repo name
   BASE_BRANCH=main
   PORT=3001
   ALLOWED_ORIGIN=http://localhost:5173         # Your wiki URL
   ```

4. **Start server**
   ```bash
   npm start
   ```

   You should see:
   ```
   ============================================================
   Anonymous Edit Server
   ============================================================
   Server running on port 3001
   Repository: YourUsername/YourWikiRepo
   ```

## Step 3: Enable in Wiki Config (2 minutes)

Edit `wiki-config.json`:

```json
{
  "features": {
    "editRequestCreator": {
      "mode": "auto",
      "forks": {
        "enabled": true,
        "autoSync": true
      },
      "anonymous": {
        "enabled": true,
        "serverEndpoint": "http://localhost:3001/api/anonymous-edit",
        "attributionFormat": "Contributed anonymously via wiki editor"
      },
      "permissions": {
        "requireAuth": false,
        "fallbackToFork": true
      }
    }
  }
}
```

**Don't forget to restart your wiki dev server:**
```bash
npm run dev
```

## Step 4: Test It (2 minutes)

1. **Open wiki in incognito/private window**
   - This ensures you're not logged in
   - Go to `http://localhost:5173`

2. **Try to edit a page**
   - Navigate to any page
   - Click "Edit" button
   - You should see two options:
     - **Sign In to Edit** (left card)
     - **Edit Anonymously** (right card)

3. **Click "Edit Anonymously"**
   - You should see amber banner: "Editing Anonymously"
   - Make a small edit
   - Add edit summary: "Testing anonymous edit"
   - Click "Submit Edit Request"

4. **Check GitHub**
   - Go to your repo's Pull Requests
   - You should see a new PR created by `@yourwiki-bot`
   - Title: "Update [Page Title]"
   - Body includes: "Anonymous Page Edit"
   - Label: `anonymous` (if labels exist)

## Success! 🎉

Your anonymous editing is now working!

## What's Next?

### For Local Development
Everything is set up! Anonymous editing works locally.

### For Production Deployment

You need to deploy the backend server. Choose one:

**Option A: Simple VPS (DigitalOcean, Linode, etc.)**
```bash
# On your server
git clone your-repo
cd server-example
npm install
npm install -g pm2

# Set up environment
cp .env.example .env
nano .env  # Edit with production values

# Start with PM2
pm2 start anonymous-edit-server.js --name wiki-anon
pm2 save
pm2 startup
```

**Option B: Serverless (Vercel, Netlify)**
- Convert to serverless function (see README.md)
- Deploy with one click
- Set environment variables in dashboard

**Option C: Docker**
```bash
docker build -t wiki-anon-server ./server-example
docker run -p 3001:3001 --env-file .env wiki-anon-server
```

### Update Production Config

In your deployed wiki's `wiki-config.json`:
```json
{
  "anonymous": {
    "enabled": true,
    "serverEndpoint": "https://your-server.com/api/anonymous-edit"
  }
}
```

### Security Checklist

- [ ] Bot token is in `.env` file (not committed to git)
- [ ] `.env` file is in `.gitignore`
- [ ] Server uses HTTPS in production
- [ ] `ALLOWED_ORIGIN` matches your wiki URL
- [ ] Rate limiting is enabled (default: 5/hour)
- [ ] Consider adding CAPTCHA for public wikis
- [ ] Review anonymous PRs before merging
- [ ] Rotate bot token every 90 days

### Monitoring

Check server logs:
```bash
# If using PM2
pm2 logs wiki-anon

# Check for:
# - Successful submissions
# - Rate limit hits
# - Failed authentication
# - Errors
```

## Troubleshooting

### "Failed to submit anonymous edit"
- Check server is running: `curl http://localhost:3001/health`
- Check console for errors
- Verify `serverEndpoint` in wiki-config.json is correct

### "Authentication failed"
- Verify bot token is correct
- Check token hasn't expired
- Ensure token has `repo` scope

### "Resource not accessible"
- Bot account needs **Write** access to repository
- Check bot accepted collaborator invitation

### CORS errors
- Update `ALLOWED_ORIGIN` in `.env` to match your wiki URL
- Restart server after changing `.env`

### Not seeing "Edit Anonymously" option
- Check `requireAuth: false` in wiki-config.json
- Check `anonymous.enabled: true` in config
- Try hard refresh (Ctrl+Shift+R)
- Check browser console for errors

## FAQ

**Q: Will anonymous edits count for prestige?**
A: No, anonymous edits don't earn prestige. Contributors must sign in to earn prestige.

**Q: Can I see who made anonymous edits?**
A: No, anonymous edits are truly anonymous. Consider logging IP addresses on your server for moderation.

**Q: Can anonymous users update existing PRs?**
A: No, each anonymous edit creates a new PR. Only authenticated users can update their existing PRs.

**Q: What if someone abuses anonymous editing?**
A: Rate limiting (5 edits/hour/IP) helps prevent spam. You can also:
- Add CAPTCHA
- Review all anonymous PRs before merging
- Temporarily disable anonymous mode
- Block abusive IP addresses

**Q: Can I use the same bot account for multiple wikis?**
A: Yes! Just give the bot write access to all repositories and run the server for each wiki.

**Q: Does this work with private repositories?**
A: Yes, as long as the bot account has access to the private repository.

## Need Help?

- Check full [README.md](./README.md) for advanced configuration
- Review [EDIT_REQUEST_MODES.md](../EDIT_REQUEST_MODES.md) for all modes
- Open an issue on GitHub
- Check server logs: `pm2 logs` or console output

---

**Ready to go live?** Deploy your backend server and update the wiki config with your production URL!
