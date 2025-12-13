# Anonymous Edit Modes - Which Should I Use?

Quick guide to help you choose between **Server** and **Serverless** modes for anonymous editing.

## TL;DR - Quick Decision

Choose **Serverless** if you want:
- ✅ Zero setup (just copy workflow file)
- ✅ Zero cost ($0/month)
- ✅ Zero maintenance
- ❌ Can tolerate 15-40 second delay

Choose **Server** if you need:
- ✅ Real-time response (< 2 seconds)
- ✅ Custom rate limiting
- ✅ Custom validation/CAPTCHA
- ❌ Willing to pay ~$5-20/month
- ❌ Can manage a server/deployment

## Detailed Comparison

### Response Time

| Mode | Time | User Experience |
|------|------|----------------|
| **Serverless** | 15-40s | "Processing your edit..." (progress bar) |
| **Server** | < 2s | Instant "Edit Request Created!" |

**Verdict:** Server wins for UX, but serverless is acceptable for anonymous edits (they're infrequent anyway).

### Setup Complexity

| Mode | Steps | Time | Difficulty |
|------|-------|------|-----------|
| **Serverless** | 2 | 5 min | Easy (copy workflow + config) |
| **Server** | 4 | 15 min | Medium (bot account + deploy + config) |

**Verdict:** Serverless is significantly easier.

### Cost

| Mode | Free Tier | Paid | Scaling |
|------|-----------|------|---------|
| **Serverless** | Unlimited (public) | 2000 min/month (private) | Free for most |
| **Server** | No | $5-20/month | Constant cost |

**Example costs:**
- 100 anonymous edits/month: Serverless = $0, Server = $5-20
- 1000 anonymous edits/month: Serverless = $0, Server = $5-20
- 10,000 anonymous edits/month: Both viable, Server better

**Verdict:** Serverless is cheaper for 99% of wikis.

### Maintenance

| Mode | Updates | Monitoring | Debugging |
|------|---------|-----------|-----------|
| **Serverless** | GitHub maintains | Actions tab | Workflow logs |
| **Server** | You maintain | Custom setup | Server logs |

**Verdict:** Serverless requires zero maintenance.

### Security

| Mode | Token Storage | Rate Limiting | Abuse Prevention |
|------|--------------|---------------|------------------|
| **Serverless** | Built-in GITHUB_TOKEN | GitHub limits | PR reviews |
| **Server** | Environment variables | Custom (5/hour default) | Custom |

**Both are secure** when configured properly.

**Verdict:** Tie - both are secure, different approaches.

### Features

| Feature | Serverless | Server |
|---------|-----------|--------|
| Real-time | ❌ | ✅ |
| Custom rate limits | ❌ | ✅ |
| Custom CAPTCHA | ⚠️ (harder) | ✅ |
| Audit trail | ✅ (Issues) | ⚠️ (logs) |
| Moderation queue | ✅ (Draft PRs) | ⚠️ (custom) |
| Content filtering | ⚠️ (in workflow) | ✅ |
| IP blocking | ❌ | ✅ |

**Verdict:** Server offers more customization.

## Use Case Recommendations

### Small Wiki (< 50 contributors)

**Recommendation: Serverless** 🌟

**Why:**
- You'll get < 20 anonymous edits/month
- 40 second delay is fine for rare events
- Save time on setup and maintenance
- Save $60-240/year on hosting

### Medium Wiki (50-500 contributors)

**Recommendation: Serverless** 🌟

**Why:**
- Still likely < 100 anonymous edits/month
- Cost savings add up ($60-240/year)
- Zero maintenance is valuable
- Anonymous edits are low priority (users should sign in for prestige)

**Consider Server if:**
- You already have hosting infrastructure
- You want to encourage anonymous contributions
- 40 second delay hurts user experience significantly

### Large Wiki (500+ contributors)

**Recommendation: Server or Serverless** 🤷

**Why Server:**
- Better UX for high traffic
- More control over rate limiting
- Custom abuse prevention

**Why Serverless Still Works:**
- Even large wikis rarely get > 500 anonymous edits/month
- Public repos = unlimited Actions minutes
- Less code to maintain

**Decision factors:**
- Do you already have backend infrastructure? → Server
- Do you want minimal maintenance? → Serverless
- Do you expect > 1000 anonymous edits/month? → Server

### Open Source Project Wiki

**Recommendation: Serverless** 🌟

**Why:**
- Public repo = unlimited Actions minutes
- Community wikis benefit from low barrier to entry
- Zero hosting costs matter for OSS
- Issues provide good audit trail

### Corporate/Internal Wiki

**Recommendation: Server** 🏢

**Why:**
- Private repo Actions minutes may run out
- Real-time response expected internally
- You likely have infrastructure already
- Custom compliance/audit requirements

## Migration Path

You can start with one and switch later:

### Start Serverless → Migrate to Server Later

1. Start with serverless (zero cost)
2. Monitor anonymous edit volume
3. If traffic grows, deploy server
4. Switch config mode
5. No code changes needed!

**When to migrate:**
- > 500 anonymous edits/month
- User complaints about delays
- Need custom features

### Start Server → Migrate to Serverless Later

1. Start with server (you already have hosting)
2. Monitor maintenance burden
3. If low traffic, switch to serverless
4. Decommission server
5. Save hosting costs!

**When to migrate:**
- < 50 anonymous edits/month
- Want to reduce costs
- Want zero maintenance

## Feature Matrix

| Feature | Serverless | Server | Notes |
|---------|-----------|--------|-------|
| **Anonymous edits** | ✅ | ✅ | Both work |
| **Real-time response** | ❌ | ✅ | Server: < 2s, Serverless: 15-40s |
| **Custom rate limiting** | ❌ | ✅ | Serverless uses GitHub limits |
| **Custom CAPTCHA** | ⚠️ | ✅ | Possible but harder in serverless |
| **IP blocking** | ❌ | ✅ | Server can block IPs |
| **Content filtering** | ⚠️ | ✅ | Both can filter, Server easier |
| **Audit trail** | ✅ | ⚠️ | Serverless: Issues, Server: Logs |
| **Moderation queue** | ✅ | ⚠️ | Both can do, different approaches |
| **Zero cost** | ✅ | ❌ | Public repos only |
| **Zero maintenance** | ✅ | ❌ | Serverless is hands-off |
| **Scalability** | ✅ | ⚠️ | Both scale, different limits |

Legend: ✅ Yes, ❌ No, ⚠️ Partial/Complex

## Real-World Examples

### Example 1: Game Wiki (Public)

**Stats:**
- 150 contributors
- 25 anonymous edits/month
- Public repository

**Choice: Serverless** ✅
- $0/month hosting
- 5 minutes setup
- Zero maintenance
- Delay is fine for low-traffic anonymous edits

**Outcome:** Saves $100+/year, works perfectly

### Example 2: SaaS Product Docs (Private)

**Stats:**
- 500 employees
- 200 anonymous edits/month (from contractors)
- Private repository
- Already have backend infrastructure

**Choice: Server** ✅
- Real-time response valued internally
- Already paying for hosting
- Custom rate limits per department
- 200 edits × 5 min = 1000 Actions minutes (close to free tier)

**Outcome:** Better UX, worth the cost

### Example 3: Open Source Library Docs (Public)

**Stats:**
- 5000+ contributors
- 50 anonymous edits/month
- Public repository
- All volunteers

**Choice: Serverless** ✅
- Unlimited Actions minutes (public repo)
- No hosting costs for volunteer project
- Easy for new maintainers
- Low anonymous edit volume

**Outcome:** Perfect fit, no costs, low maintenance

## Decision Tree

```
Do you need real-time (< 2s) response?
├─ Yes → Can you tolerate $5-20/month hosting?
│   ├─ Yes → Use SERVER
│   └─ No → Use SERVERLESS (delay acceptable)
└─ No → Use SERVERLESS

Do you expect > 1000 anonymous edits/month?
├─ Yes → Use SERVER (better for high volume)
└─ No → Use SERVERLESS

Is your repository private AND you expect > 500 anonymous edits/month?
├─ Yes → Consider SERVER (Actions minutes)
└─ No → Use SERVERLESS

Do you need custom rate limiting / CAPTCHA / IP blocking?
├─ Yes → Use SERVER
└─ No → Use SERVERLESS
```

## Bottom Line

**For 90% of wikis: Use Serverless**

It's free, requires zero maintenance, and works great for typical anonymous edit volumes.

**Only use Server if:**
- You need real-time response (< 2s)
- You have very high traffic (> 1000 anon edits/month)
- You need advanced features (custom CAPTCHA, IP blocking)
- You already have backend infrastructure

**Still unsure?**

Start with **Serverless** because:
1. Zero cost to try
2. 5 minute setup
3. Can always switch to Server later
4. No risk, no commitment

You can literally enable it right now and see if it works for you. If the 40 second delay bothers users, switch to Server later. No code changes needed!

---

## Quick Start Commands

### Enable Serverless Mode

```json
{
  "anonymous": {
    "enabled": true,
    "mode": "serverless"
  }
}
```

That's it! (Workflow file is already in repo)

### Enable Server Mode

```json
{
  "anonymous": {
    "enabled": true,
    "mode": "server",
    "serverEndpoint": "http://localhost:3001/api/anonymous-edit"
  }
}
```

Then follow [QUICKSTART.md](./QUICKSTART.md)

---

**Decision made? Great!**

- **Serverless** → See [SERVERLESS_SETUP.md](./SERVERLESS_SETUP.md)
- **Server** → See [QUICKSTART.md](./QUICKSTART.md)
- **Both?** → Can't run both simultaneously, choose one
