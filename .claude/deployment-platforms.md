# Deployment Platform Comparison

This document compares Netlify and Cloudflare Pages for deploying the Slayer Legend Wiki, with special focus on video upload capabilities.

## Quick Comparison

| Feature | Netlify | Cloudflare Pages |
|---------|---------|------------------|
| **Video Upload Limit** | 500MB (production) | 100MB (hard limit) |
| **Local Dev Upload** | 6MB | 100MB |
| **Git LFS Support** | Full (500MB) | Limited (100MB) |
| **Function Timeout** | 10s (free), 26s (pro) | 50ms CPU (free), 30s (paid) |
| **Function Memory** | 1024MB | 128MB |
| **Request Body Size** | Large (with streaming) | 100MB max |
| **Build Time** | 15 min (free), unlimited (pro) | Unlimited |
| **Bandwidth** | 100GB/month (free) | Unlimited |
| **Best For** | Video uploads, heavy processing | Fast static sites, global edge |

## Platform Details

### Netlify

**Strengths:**
- ✅ Large file upload support (up to 500MB with Git LFS)
- ✅ Generous function memory (1024MB)
- ✅ Longer function timeouts
- ✅ Better for processing heavy payloads
- ✅ Easy integration with GitHub

**Limitations:**
- ⚠️ 6MB limit in local dev (Netlify CLI issue)
- ⚠️ 100GB/month bandwidth on free tier
- ⚠️ Slower cold starts than Cloudflare

**Video Upload Configuration:**
```toml
# netlify.toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

  # No special config needed - supports large files by default
```

**Environment Variables:**
```bash
CDN_REPO_TOKEN=ghp_xxxxxxxxxxxx
WIKI_BOT_TOKEN=ghp_xxxxxxxxxxxx
```

### Cloudflare Pages

**Strengths:**
- ✅ 100MB upload limit (vs 6MB local on Netlify)
- ✅ Fast global edge network
- ✅ Unlimited bandwidth
- ✅ No cold starts (always warm)
- ✅ Excellent for static content

**Limitations:**
- ❌ **100MB request body limit** (cannot be increased)
- ❌ 128MB memory limit (can cause issues with large files)
- ❌ 50ms CPU time on free tier (paid: 30s)
- ❌ Videos 100-500MB won't work

**Video Upload Configuration:**
```toml
# wrangler.toml
[functions]
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# Note: 100MB limit cannot be changed
# For larger files, use Netlify or implement client-side upload
```

**Environment Variables:**
```bash
# Use wrangler secrets
wrangler secret put CDN_REPO_TOKEN
wrangler secret put WIKI_BOT_TOKEN
```

## Video Upload Architecture

### Current Implementation (Server-Side Upload)

```
Client → Serverless Function → GitHub LFS → CDN
         (Platform limits here)
```

**Flow:**
1. User uploads video file
2. File sent to serverless function (Netlify/Cloudflare)
3. Function calculates SHA256
4. Function uploads to GitHub LFS API
5. Function commits LFS pointer file
6. Function creates PRs

**Platform Impact:**
- Video must pass through serverless function
- Subject to platform's request body limit
- **Netlify:** 500MB works ✅
- **Cloudflare:** 100MB max ❌ (for files 100-500MB)

### Alternative: Client-Side Upload (Future)

```
Client → GitHub LFS API directly → CDN
         (No platform limits)
```

**Flow:**
1. User uploads video file
2. Client requests LFS upload URL from backend
3. Client uploads directly to GitHub LFS
4. Client notifies backend to create pointer + PRs

**Benefits:**
- Bypasses serverless function limits
- Works on both Netlify and Cloudflare
- Faster upload (no intermediate hop)

**Tradeoffs:**
- More complex client code
- Requires careful token handling
- Less server-side validation

## Recommendation

### For Current Implementation

**Use Netlify** if you need:
- Video uploads larger than 100MB
- Full 500MB Git LFS support
- Server-side file processing

**Use Cloudflare** if:
- Videos are always < 100MB
- You prioritize global edge performance
- You want unlimited bandwidth

### For Future Implementation

If you implement **client-side direct LFS upload**:
- Both platforms work equally well
- Choose based on other factors (bandwidth, edge performance, cost)

## Migration Path

### From Cloudflare to Netlify (for 500MB support)

1. **Update deployment target:**
   ```bash
   # Remove Cloudflare deployment
   # Add Netlify deployment
   ```

2. **Update environment variables:**
   - Export secrets from Cloudflare dashboard
   - Add to Netlify environment variables

3. **Update build command:**
   ```bash
   # Netlify automatically uses netlify.toml
   # No changes needed to code
   ```

4. **Test video upload:**
   - Deploy to Netlify
   - Test with 100MB+ video
   - Verify LFS upload works

### From Netlify to Cloudflare (for edge performance)

**Only if videos < 100MB:**

1. Update `wiki-config.json`:
   ```json
   {
     "cdn": {
       "github": {
         "maxFileSizeMB": 100  // Reduce from 500
       }
     }
   }
   ```

2. Update UI to show 100MB limit

3. Deploy to Cloudflare Pages

## Cloudflare-Specific Workarounds for Large Files

If you need 100-500MB support on Cloudflare, you have three options:

### Option 1: Cloudflare R2 with Pre-Signed URLs

**Setup:**
1. Create R2 bucket
2. Generate pre-signed upload URL from Worker
3. Client uploads directly to R2
4. Worker creates GitHub PR with R2 URL

**Benefits:**
- No file size limits
- S3-compatible
- Very cheap storage

**Implementation:**
```javascript
// Worker generates pre-signed URL
const url = await r2.createPresignedUrl(key, { expiresIn: 3600 });

// Client uploads directly
await fetch(url, { method: 'PUT', body: videoFile });
```

### Option 2: Client-Side GitHub LFS Upload

**Setup:**
1. Worker provides LFS batch API response
2. Client uploads directly to GitHub LFS
3. Worker commits pointer file

**Benefits:**
- Uses existing GitHub LFS
- No additional storage costs

**Complexity:**
- More client-side code
- Token security considerations

### Option 3: Hybrid Approach

**For files < 100MB:**
- Current server-side upload through Worker

**For files > 100MB:**
- Detect size client-side
- Switch to R2 or direct LFS upload
- Show different UI flow

## Cost Comparison

### Netlify Pricing (with video uploads)

| Tier | Price | Function Runs | Bandwidth | Build Minutes |
|------|-------|---------------|-----------|---------------|
| Free | $0 | 125k/month | 100GB | 300 min |
| Pro | $19/month | 1M/month | 1TB | 25,000 min |

**Estimated cost for video uploads:**
- 10 uploads/day × 100MB = 30GB/month bandwidth
- Well within free tier ✅

### Cloudflare Pages Pricing

| Tier | Price | Requests | Bandwidth | CPU Time |
|------|-------|----------|-----------|----------|
| Free | $0 | 100k/day | Unlimited | 10ms/request |
| Paid | $5/month | Unlimited | Unlimited | 50ms/request |

**Estimated cost for video uploads:**
- 10 uploads/day < 1k requests/day
- Free tier works ✅ (if files < 100MB)

### GitHub LFS Pricing

| Tier | Storage | Bandwidth | Cost |
|------|---------|-----------|------|
| Free | 1GB | 1GB/month | $0 |
| Data Pack | 50GB | 50GB/month | $5/month |

**Estimated usage:**
- 10 videos × 100MB = 1GB storage
- 100 views/video × 100MB = 1TB bandwidth ⚠️
- **Likely need paid plan** ($5-10/month)

## Testing Strategy

### Local Development

**Netlify CLI:**
```bash
netlify dev  # 6MB limit
```

**Cloudflare Wrangler:**
```bash
wrangler pages dev  # 100MB limit
```

**Recommendation:**
- Test small files (< 6MB) locally on either platform
- Test medium files (6-100MB) with Cloudflare local or production
- Test large files (100-500MB) on Netlify production only

### Production Testing

1. **Deploy to staging branch**
2. **Test video upload flow:**
   - Small file (1MB)
   - Medium file (50MB)
   - Large file (200MB) - Netlify only
3. **Verify PRs created correctly**
4. **Check LFS storage usage**
5. **Test video playback from jsDelivr**

## Troubleshooting

### "Video file too large" on Cloudflare

**Problem:** Trying to upload > 100MB
**Solution:**
- Use Netlify instead, or
- Implement client-side upload, or
- Use smaller videos

### "Stream body too big" on Netlify Local

**Problem:** Netlify CLI 6MB limit
**Solution:**
- Use smaller test file, or
- Test in production, or
- Use Cloudflare local (100MB limit)

### LFS bandwidth exceeded

**Problem:** Too many video downloads
**Solution:**
- Upgrade GitHub LFS plan ($5/month for 50GB)
- Consider migration to R2 (unlimited bandwidth)

### Worker timeout on Cloudflare

**Problem:** 50ms CPU time on free tier
**Solution:**
- Upgrade to paid plan (30s CPU time)
- Optimize function (less processing)
- Move heavy work to separate service

## Conclusion

**Current Recommendation: Netlify**

For the current server-side upload implementation with full 500MB LFS support, **Netlify is the better choice** because:

1. ✅ Supports 500MB video uploads
2. ✅ Simpler configuration
3. ✅ Better for file processing
4. ✅ Within free tier for moderate usage

**Future: Consider Cloudflare**

After implementing client-side direct upload, Cloudflare becomes more attractive:

1. ✅ Unlimited bandwidth
2. ✅ Global edge performance
3. ✅ No cold starts
4. ✅ Lower latency

The platform choice ultimately depends on whether you implement client-side upload to bypass the 100MB Worker limit.
