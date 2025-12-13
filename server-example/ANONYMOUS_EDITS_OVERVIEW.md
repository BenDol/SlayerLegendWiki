# Anonymous Edit System - Complete Overview

Welcome! This document provides a complete overview of the anonymous editing system for your wiki.

## What is Anonymous Editing?

Anonymous editing allows users to contribute to your wiki **without signing in** to GitHub. This lowers the barrier to entry for casual contributors while maintaining quality through pull request reviews.

### How It Works (User Perspective)

1. User visits your wiki (not logged in)
2. Clicks "Edit" button on any page
3. Sees two options:
   - **Sign In to Edit** - Get credited, earn prestige
   - **Edit Anonymously** - Quick contribution, no credit
4. Chooses anonymous mode
5. Makes edits in the editor
6. Submits edit request
7. Edit becomes a pull request for review
8. Once merged, changes appear on wiki

### Behind the Scenes

Anonymous edits are submitted as **pull requests** created by either:
- **Server Mode**: Your bot account via Express server
- **Serverless Mode**: `github-actions[bot]` via GitHub Actions

All edits go through the same review process as authenticated edits.

## Two Modes Available

### 🌟 Serverless Mode (Recommended for Most)

**How it works:**
```
User submits → GitHub Issue created → Actions workflow runs → PR created → User notified
```

**Pros:**
- ✅ No external server needed
- ✅ Zero cost (public repos)
- ✅ Zero maintenance
- ✅ 5 minute setup

**Cons:**
- ❌ 15-40 second delay
- ❌ Creates temporary issues

**Best for:**
- Small to medium wikis
- Open source projects
- Anyone who wants zero maintenance

**Setup:** [SERVERLESS_SETUP.md](./SERVERLESS_SETUP.md)

### 🚀 Server Mode (Real-Time)

**How it works:**
```
User submits → Express server receives → Bot creates PR → User notified immediately
```

**Pros:**
- ✅ Real-time (< 2 seconds)
- ✅ Custom rate limiting
- ✅ Custom features

**Cons:**
- ❌ Requires hosting ($5-20/month)
- ❌ Server maintenance
- ❌ More complex setup

**Best for:**
- High-traffic wikis
- When you need instant response
- When you have existing hosting

**Setup:** [QUICKSTART.md](./QUICKSTART.md) or [README.md](./README.md)

## Decision Guide

**Not sure which to use?**

See [CHOOSING_MODE.md](./CHOOSING_MODE.md) for a detailed comparison.

**Quick recommendation:**

| Your Situation | Use This Mode |
|---------------|--------------|
| Just starting out | **Serverless** |
| Small wiki (< 100 contributors) | **Serverless** |
| Open source project | **Serverless** |
| Want zero costs | **Serverless** |
| Want zero maintenance | **Serverless** |
| Need real-time response | **Server** |
| High traffic (> 1000 anon edits/month) | **Server** |
| Already have hosting | **Server** |
| Corporate/internal wiki | **Server** |

## Feature Comparison

| Feature | Serverless | Server |
|---------|-----------|--------|
| Response time | 15-40s | < 2s |
| Setup time | 5 min | 15 min |
| Monthly cost | $0 | $5-20 |
| Maintenance | None | Regular |
| Rate limiting | GitHub limits | Custom (5/hour default) |
| Custom CAPTCHA | Harder | Easy |
| Best for | Most wikis | High-traffic wikis |

## Security

Both modes are secure:

- ✅ No bot token exposed to client
- ✅ Input validation & sanitization
- ✅ Rate limiting
- ✅ CORS protection
- ✅ Content size limits
- ✅ Path traversal prevention
- ✅ All edits reviewed before merge

**Server mode security:**
- Bot token in environment variables only
- Express server with CORS protection
- IP-based rate limiting (5/hour)

**Serverless mode security:**
- Uses built-in `GITHUB_TOKEN` (no secrets)
- GitHub Actions workflow validation
- Label-based access control
- Automatic rate limiting by GitHub

## User Experience

### When Anonymous Mode is Enabled

**Unauthenticated users see:**
1. "Choose Edit Mode" screen
2. Two cards:
   - 👤 Sign In to Edit (with prestige benefits)
   - 🕶️ Edit Anonymously (quick, no prestige)
3. If they choose anonymous:
   - Amber banner: "Editing Anonymously"
   - Normal editor experience
   - Submit creates PR

**Authenticated users:**
- Normal edit workflow (not affected)
- Can use fork workflow if no write access
- Earn prestige for contributions

### Attribution

Anonymous edits show in PR as:
```
## Anonymous Page Edit

**Page:** Getting Started
**Section:** getting-started
**Page ID:** first-steps

### Changes

Fixed typo in introduction

---

Contributed anonymously via wiki editor

🤖 Generated with [GitHub Wiki Framework](...)
```

## Configuration

Edit `wiki-config.json`:

### Enable Serverless Mode

```json
{
  "features": {
    "editRequestCreator": {
      "mode": "auto",
      "anonymous": {
        "enabled": true,
        "mode": "serverless",
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

### Enable Server Mode

```json
{
  "features": {
    "editRequestCreator": {
      "mode": "auto",
      "anonymous": {
        "enabled": true,
        "mode": "server",
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

### Disable Anonymous Mode

```json
{
  "features": {
    "editRequestCreator": {
      "anonymous": {
        "enabled": false
      },
      "permissions": {
        "requireAuth": true
      }
    }
  }
}
```

## Integration with Other Features

### Fork Workflow

Anonymous mode works alongside the fork workflow:

- **Authenticated users with write access**: Direct branch
- **Authenticated users without write access**: Fork workflow
- **Unauthenticated users**: Anonymous mode (if enabled)

All three modes coexist perfectly!

### Prestige System

- **Anonymous edits don't earn prestige** (by design)
- Encourages users to sign in for recognition
- Prestige still works normally for authenticated edits

### Comments System

- Anonymous users can edit but not comment
- Comments require authentication
- Keeps discussion quality high

## Moderation

All anonymous edits go through pull request review:

**Recommended workflow:**
1. Anonymous edit creates PR
2. Bot adds `anonymous` label
3. Maintainers review PR
4. Approve or request changes
5. Merge when ready

**Optional: Draft PRs**

Modify workflow/server to create draft PRs:
- All anonymous PRs start as draft
- Maintainer promotes to ready for review
- Adds moderation step

**Optional: Auto-Close**

Configure rules to auto-close PRs that:
- Contain spam keywords
- Are from blocked IPs (server mode)
- Violate content policies

## Rate Limiting

### Serverless Mode

GitHub provides automatic rate limiting:
- Per-user limits (authenticated)
- Per-IP limits (anonymous)
- Per-repository workflow limits

No configuration needed.

### Server Mode

Default rate limiting:
- **5 edits per hour per IP**
- Configurable in `anonymous-edit-server.js`

```javascript
const MAX_REQUESTS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
```

Can be enhanced with Redis for distributed rate limiting.

## Abuse Prevention

**Built-in protections:**
1. Rate limiting (both modes)
2. Input validation (both modes)
3. Content sanitization (both modes)
4. Path traversal prevention (both modes)
5. Pull request review (both modes)

**Additional options:**
1. Add CAPTCHA (server mode easier)
2. Enable branch protection
3. Require PR reviews
4. Add CODEOWNERS file
5. Monitor for spam patterns
6. Use GitHub's abuse reporting

## Troubleshooting

### Anonymous Edit Button Not Showing

**Check:**
1. `anonymous.enabled: true` in config
2. `requireAuth: false` in config
3. User is not logged in (test in incognito)
4. Section has `allowContributions: true`
5. Clear browser cache

### "Failed to submit anonymous edit"

**Serverless mode:**
1. Check Issues are enabled
2. Check `anonymous-edit-request` label exists
3. Check Actions workflow is present
4. Review Actions logs for errors

**Server mode:**
1. Check server is running
2. Verify `serverEndpoint` URL is correct
3. Check server logs
4. Verify bot token is valid
5. Check CORS settings

### PR Not Created

**Serverless mode:**
- Check Actions tab for workflow run
- Review workflow logs for errors
- Check issue was created and closed
- Verify workflow has correct permissions

**Server mode:**
- Check server logs
- Verify bot has write access to repo
- Check bot token hasn't expired
- Verify branch doesn't already exist

### Timeout / Slow Response

**Serverless mode:**
- Normal: 15-40 seconds
- If longer: Check Actions queue (many workflows running?)
- Increase polling timeout if needed

**Server mode:**
- Should be < 2 seconds
- If slow: Check server resources
- Check network latency
- Review server logs

## Costs

### Serverless Mode

**Public repositories:**
- ✅ $0/month (unlimited Actions minutes)

**Private repositories:**
- Free tier: 2000 minutes/month
- Each edit: ~2-5 minutes
- Supports: 400-1000 edits/month free
- Paid plans: $4/month for 3000 min, $21/month for 50k min

### Server Mode

**Hosting costs:**
- VPS: $5-20/month
- Serverless functions: $0-10/month (depending on traffic)
- Docker container: $5-15/month

**Bot account:**
- Free (no costs)

## Switching Modes

You can switch anytime:

### From Serverless → Server

1. Set up backend server ([QUICKSTART.md](./QUICKSTART.md))
2. Update config: `mode: "server"`
3. Add `serverEndpoint`
4. Restart wiki

### From Server → Serverless

1. Update config: `mode: "serverless"`
2. Remove `serverEndpoint`
3. Restart wiki
4. (Optional) Shut down server

**No code changes needed!** Just update configuration.

## Documentation Index

- **[CHOOSING_MODE.md](./CHOOSING_MODE.md)** - Decision guide: Server vs Serverless
- **[SERVERLESS_SETUP.md](./SERVERLESS_SETUP.md)** - Complete serverless setup guide
- **[QUICKSTART.md](./QUICKSTART.md)** - 10-minute server setup guide
- **[README.md](./README.md)** - Detailed server documentation
- **This file** - Overview of both modes

## Getting Started

**Ready to enable anonymous editing?**

### Option 1: Serverless (Recommended)

1. Read [SERVERLESS_SETUP.md](./SERVERLESS_SETUP.md)
2. Update wiki-config.json (set `mode: "serverless"`)
3. Test in incognito window
4. Done! (5 minutes total)

### Option 2: Server (Real-Time)

1. Read [QUICKSTART.md](./QUICKSTART.md)
2. Create bot account & token
3. Deploy server (or use provided scripts)
4. Update wiki-config.json (set `mode: "server"`)
5. Test in incognito window
6. Done! (15 minutes total)

### Still Deciding?

Read [CHOOSING_MODE.md](./CHOOSING_MODE.md) for help deciding.

## Support

- Check the relevant documentation above
- Review GitHub Actions logs (serverless) or server logs (server)
- Check wiki browser console for errors
- Open an issue on GitHub

## Contributing

Contributions welcome! The anonymous edit system consists of:

**Frontend:**
- `wiki-framework/src/pages/PageEditorPage.jsx` - Main editor logic
- `wiki-framework/src/services/github/anonymousEdits.js` - Serverless service

**Serverless:**
- `.github/workflows/anonymous-edit.yml` - GitHub Actions workflow

**Server:**
- `server-example/anonymous-edit-server.js` - Express server
- `server-example/package.json` - Dependencies

---

**Questions? Comments? Feedback?**

Open an issue or discussion on GitHub. We'd love to hear from you!

🎉 **Enjoy your anonymous editing system!**
