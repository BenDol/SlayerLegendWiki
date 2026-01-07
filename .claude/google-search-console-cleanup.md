# Google Search Console Cleanup Guide

## Problem Summary

Google Search Console has **old hash-based URLs** (`/#/path`) indexed, but your site now uses **clean URLs** (`/path`) with browser routing. This happened when the site migrated from HashRouter to BrowserRouter.

**Why server-side redirects won't work:**
- Hash fragments (`#/path`) are **NOT sent to the server**
- The server only sees `https://slayerlegend.wiki/` (without the `#/path` part)
- Only **client-side redirects** can handle hash fragments

**What's already implemented:**
- Client-side redirect in `wiki-framework/src/main.jsx:13-18`
- Automatically converts `#/path` → `/path` for users
- Updated sitemap with clean URLs at `https://slayerlegend.wiki/sitemap.xml`

---

## Solution: Clean Up Google Search Console

### Step 1: Submit Updated Sitemap

1. Go to **Google Search Console**
2. Navigate to **Sitemaps** (left sidebar)
3. Remove old sitemap if present
4. Add sitemap URL: `https://slayerlegend.wiki/sitemap.xml`
5. Click **Submit**

This tells Google about your new clean URLs.

---

### Step 2: Request Removal of Old Hash URLs (Bulk)

**Option A: Use Removals Tool (Temporary)**

1. Go to **Removals** (left sidebar)
2. Click **New Request**
3. Select **Remove all URLs with this prefix**
4. Enter: `https://slayerlegend.wiki/#/`
5. Click **Next** → **Submit**

**⚠️ Note:** This is temporary (6 months). Google will eventually drop old URLs naturally.

---

**Option B: Wait for Natural Recrawl (Recommended)**

Google will naturally discover the updated sitemap and drop old URLs over time (2-8 weeks). The client-side redirect ensures users never see broken links.

---

### Step 3: Request Indexing of Important Pages

Prioritize your most important pages:

1. Go to **URL Inspection** (top of GSC)
2. Enter a NEW clean URL (e.g., `https://slayerlegend.wiki/getting-started`)
3. Click **Request Indexing**
4. Repeat for 5-10 key pages

**Priority URLs to request:**
- `https://slayerlegend.wiki/` (homepage)
- `https://slayerlegend.wiki/getting-started`
- `https://slayerlegend.wiki/skills`
- `https://slayerlegend.wiki/equipment`
- `https://slayerlegend.wiki/battle-loadouts`
- `https://slayerlegend.wiki/skill-builder`

---

### Step 4: Monitor Progress

1. Go to **Pages** report (left sidebar)
2. Check **"Not found (404)"** - Should decrease over 2-4 weeks
3. Check **"Page with redirect"** - Should resolve as Google learns new URLs
4. Check **"Indexed"** - Should increase as new clean URLs are crawled

---

## Expected Timeline

| Action | Timeline |
|--------|----------|
| Sitemap submitted | Immediate |
| Google discovers new URLs | 2-7 days |
| Old URLs drop from index | 2-8 weeks (natural) |
| New URLs fully indexed | 4-12 weeks |

---

## Additional Optimizations (Optional)

### Improve Crawl Budget

If you want faster indexing, ensure:

1. **Dynamic page loading is disabled for better SEO:**
   - Edit `wiki-config.json`
   - Set `features.dynamicPageLoading.enabled: false`
   - Redeploy to Cloudflare Pages

2. **Check robots.txt allows crawling:**
   - Visit `https://slayerlegend.wiki/robots.txt`
   - Ensure `Allow: /` is present

3. **Monitor Core Web Vitals:**
   - Go to **Core Web Vitals** in GSC
   - Fix any issues that may slow crawling

---

## Troubleshooting

### "Why are old URLs still showing after 2 weeks?"

Google's index updates slowly. The removals are **temporary** (6 months), but eventually, Google will naturally drop old URLs as it recrawls and sees the updated sitemap.

### "Can I add 301 redirects?"

No. Hash fragments (`#/`) are **client-side only** and cannot be redirected server-side. The client-side redirect in `wiki-framework/src/main.jsx` is the only solution.

### "Why do some pages show 'Discovered - currently not indexed'?"

This is normal for new sites or after major routing changes. Google crawls pages gradually based on:
- **Crawl budget** (how often Google visits your site)
- **Page importance** (determined by internal links, sitemap priority)
- **Content quality** (unique, valuable content ranks higher)

**Solution:** Be patient. Continue adding quality content and internal links.

---

## Dynamic Page Loading and SEO

**Current setting:** `dynamicPageLoading.enabled: true`

**✅ GOOD NEWS:** The site now has **automatic crawler detection** that serves static content to search engines while keeping dynamic loading for regular users.

### How It Works

When a crawler (like Googlebot) visits your site:
1. The User-Agent is checked against a list of known crawlers
2. If crawler detected → serves static bundled content (fast, SEO-friendly)
3. If regular user → serves dynamic content from GitHub (always up-to-date)

This is called **dynamic rendering** and is [recommended by Google](https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering).

### Implementation Details

- **Crawler detection:** `src/utils/crawlerDetection.js`
- **Wrapper module:** `src/services/dynamicPageLoaderWrapper.js`
- **Vite alias:** `vite.config.js` intercepts framework imports

Supported crawlers include:
- Google (Googlebot, Google-InspectionTool, etc.)
- Bing (bingbot, msnbot)
- Social media (Facebook, Twitter, Discord, LinkedIn)
- Other search engines (DuckDuckGo, Yahoo, Baidu, Yandex)

### Alternative: Disable Dynamic Loading Entirely

If you prefer to disable dynamic loading for all users:

```json
{
  "features": {
    "dynamicPageLoading": {
      "enabled": false  // All users get static content
    }
  }
}
```

Then rebuild and redeploy:
```bash
npm run build:cloudflare
# Push to GitHub to trigger Cloudflare Pages deployment
```

---

## Summary

✅ **Already fixed:**
- Client-side redirect for old hash URLs
- Updated sitemap with clean URLs
- SPA fallback configured correctly

⏳ **Action required:**
1. Submit sitemap to Google Search Console
2. (Optional) Request removal of `/#/` prefix
3. Request indexing of 5-10 key pages
4. Wait 2-8 weeks for Google to recrawl

🚀 **Optional improvement:**
- Disable dynamic page loading for better SEO
- Monitor GSC weekly for progress

---

## Need Help?

If issues persist after 8 weeks:
1. Check **Coverage** report in GSC for specific errors
2. Use **URL Inspection** to debug individual pages
3. Verify sitemap is accessible at `https://slayerlegend.wiki/sitemap.xml`
