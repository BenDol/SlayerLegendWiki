# AdSense Acceptance Plan

**Date:** 2026-08-26 · **Status:** Rejected twice for "Low value content" (2026-08-16, 2026-08-26)
**Verdict of this audit:** The markdown content is no longer the problem - the delivery is. Google's review pipeline cannot see the content we wrote.

This plan is the output of five parallel research passes over the policy pages linked in the rejection email (plus every substantive page they link to, two levels deep), real-world rejection case studies, and a live audit of slayerlegend.wiki as Google's crawlers see it.

---

## 1. Diagnosis

### 1.1 What Google's reviewer actually sees (verified live, 2026-08-26)

| Check | Result |
|---|---|
| `curl -A Googlebot https://slayerlegend.wiki/progression/leveling` | **4.9KB shell, completely empty `<body>`** - zero article text; the word "leveling" appears nowhere in the HTML |
| `<title>` / meta description on every route | Identical generic homepage values ("Slayer Legend Wiki") - per-page meta only exists after JS runs (react-helmet) |
| Prerendering / SSR / SSG in the build | **None.** `index.html` ships `<div id="root"></div>` + a module script; no `<noscript>` fallback |
| `/*  /index.html  200` catch-all in `_redirects` | Every URL - including garbage like `/zzz-fake-page` - returns **HTTP 200 with the empty shell** (site-wide soft-404s) |
| `site:slayerlegend.wiki` | No pages from the domain surfaced (verify properly in Search Console) |
| Trust pages | Privacy Policy exists; **no About page, no Contact page**; footer links only Privacy Policy |
| robots.txt / ads.txt / SSL | ✅ All correct (Mediapartners-Google, AdsBot, Googlebot allowed; `pub-7343903229728203` in ads.txt; static AdSense meta in `<head>`) |
| Content on disk | ✅ 51 pages, most 400-1,800 words, committed (`ed5da1c7`) and deployed since 2026-08-18 |

**The existing "crawler detection" dynamic-rendering layer does not help here.** It only decides whether the *JavaScript app* loads content from the bundle or from GitHub - the crawler still has to execute JS to see anything. A non-rendering fetch gets nothing on every route.

### 1.2 How the AdSense review actually works (research synthesis)

- **Review pipeline** (observed via server logs in a documented case): Googlebot → Googlebot Smartphone → AdsBot-Google → Mediapartners-Google → **human reviewer**. The automated stages feed indexing/quality signals; the human samples a handful of pages.
- **JS is rendered, but fragilely.** Google's ad pipeline uses the Web Rendering Service (it can execute JS), but rendering is two-step (HTML as Mediapartners-Google, resources as Googlebot) and **any slow, blocked, or failed runtime fetch produces a blank render with no fallback**. A documented React-app case (Kobadoo) was rejected repeatedly with "no content" verdicts even after migrating to SSR; only conventional, crawler-readable article HTML flipped the decision.
- **"Low value content" maps to a named policy**: *Inventory value → "Google-served ads on screens without publisher-content or with low-value content."* The official glossary defines low-value content as "unintelligible content that has no value to the user (e.g., filler text)" - and defines publisher-content to **exclude navigation and related-content links**. Judgment is **per-screen, not site-average**: one strong guide does not offset twenty empty-looking screens.
- **Under our current delivery, every route on the site is formally a "screen without publisher-content."** That is the literal policy behind the rejection string we received - twice.
- **Review mechanics**: approval reviews take a few days to **2-4 weeks**; a site "reviewed and rejected several times recently" gets its *Start review* button **deactivated** for a period. Resubmit once, after everything is fixed - not iteratively.

### 1.3 Ranked causes of rejection #2

1. **(Critical)** Crawlers and the review's automated stages see an empty, identical page at every URL → no content, no unique titles, no indexing → "low value content" regardless of the markdown's quality.
2. **(High)** No Google index footprint - multiple documented cases tie "applied while unindexed" to this exact rejection.
3. **(High)** Missing About/Contact pages and authorship signals - E-E-A-T scaffolding every successful remediation account added; the helpful-content guidance weights "trust" highest.
4. **(Medium)** Sitemap fronts tool/utility screens (`skill-builder`, `highscore`, `donate`, `changelog`...) that carry little text - "screens without publisher-content" candidates the reviewer may sample.
5. **(Medium)** Soft-404s site-wide + thin homepage prose (186 words in `home.md`) + a few sub-400-word pages.
6. **(Low)** Resubmission cadence - rejection #2 came ~10 days after fixes with (probably) no recrawl of substance in between, because the crawler-visible site never changed.

---

## 2. Remediation plan

### Phase 1 - Make the content visible: build-time prerendering (P0, the unlock)

**Goal:** every content route serves real HTML - article text, unique `<title>`, meta description, canonical, Open Graph, JSON-LD - with zero JavaScript required. Verified by `curl`.

**Approach: post-build prerender script** (deterministic, no headless browser, fits the content model):

1. New `scripts/prerender.js`, run after `vite build` (append to the `build` script or a `postbuild` hook).
2. Walk `public/content/**/*.md` (same traversal as `scripts/generate-sitemap.js` - reuse its route mapping: `section/page.md` → `/section/page`, `index.md` → `/section`).
3. For each route:
   - Parse frontmatter (`gray-matter`, already a dependency) for title/description.
   - Render markdown → HTML with the unified/remark/rehype stack already in `package.json` (same plugins as the app where practical: `remark-gfm`, `rehype-sanitize` etc.). Strip or no-op the custom `{{...}}` renderer tokens (`{{AD:*}}`, `{{home:*}}`, contribution banners) - replace with nothing or a minimal static equivalent.
   - Take the built `dist/index.html` as the template and emit `dist/<route>/index.html` with:
     - Per-page `<title>` and `<meta name="description">` (from frontmatter),
     - `<link rel="canonical" href="https://slayerlegend.wiki/<route>">`,
     - Per-page Open Graph/Twitter tags and JSON-LD `Article`/`TechArticle`,
     - The rendered article HTML **inside `<div id="root">`**, wrapped in a semantic `<main><article>` with heading structure intact.
4. React 18 `createRoot(...).render(...)` replaces the prerendered DOM on load - users get the full app, crawlers get real HTML. (No hydration mismatch risk because we don't hydrate; content-to-content swap is visually acceptable. Style the prerendered article with the app's base typography classes so pre-JS paint looks clean, not unstyled.)
5. **Tool routes too** (`/skill-builder`, `/spirit-builder`, `/battle-loadouts`, etc.): prerender each with its title/meta and a genuine descriptive section (what the tool does, how to use it, tips) - this simultaneously fixes their "screen without publisher-content" exposure. The utility/account routes already disallowed in robots.txt (`/search`, `/profile`, `/my-*`, `/donation-success`) get prerendered stubs with `<meta name="robots" content="noindex">`.
6. Cloudflare Pages serves static assets before the `/* → /index.html` catch-all, so emitted files take precedence automatically; the catch-all remains as the safety net for un-prerendered app routes. **Verify this precedence on a preview deploy before merging.**

**Interaction with conditional deploys (important):** with dynamic page loading enabled, content-only commits currently *skip* Cloudflare builds. Once crawler HTML is baked at build time, a skipped build means crawlers see stale content while users see fresh - a slow drift toward divergence (and Google's cloaking rule is about *divergent* content). Mitigation, pick one:
- (a) simplest: disable the deploy-skip (content commits are infrequent now; free tier allows 500 builds/month), or
- (b) keep the skip but add a scheduled (e.g. weekly) deploy-hook trigger so prerendered HTML never drifts more than a few days.

**Acceptance test for this phase:**
```
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  https://slayerlegend.wiki/progression/leveling | grep -c "Leveling"   # must be > 0
```
Plus: unique `<title>` per route, canonical present, JS disabled in a browser still shows readable article.

### Phase 2 - Trust & E-E-A-T scaffolding (P0, cheap)

1. **`public/content/meta/about.md`** - who runs the wiki and why; that maintainers actively play the game and verify data in-game (version-stamped); the community/Discord behind it; fan-site status and non-affiliation/fair-use disclaimer for game assets; how content is moderated (PR review, sanitization).
2. **`public/content/meta/contact.md`** - real contact channels in crawler-readable text (email, Discord invite, GitHub issues). No iframe-only contact (a documented rejection cause).
3. **Footer**: extend `wiki.footerLinks` in root `wiki-config.json` to About · Contact · Privacy Policy (every page, crawler-visible once Phase 1 lands).
4. **Authorship signals**: attribution lines on guides (Andy's guide is already attributed - extend the pattern), "maintained by the Slayer Legend community" site-wide.
5. **Privacy policy check**: confirm it discloses third-party ad cookies and links Google's "How Google uses data when you use our partners' sites or apps" page. (Post-approval, EEA/UK traffic needs a certified CMP - note for later, not an approval blocker.)

### Phase 3 - Content quality sweep (P1)

1. **Homepage**: expand `home.md` prose (~186 words) to a proper introduction - what the game is, what the wiki covers, what's unique here (tools, tested data). The hero/section grids don't count as text.
2. **Thinnest pages** (sub-450 words): `character/training-diary` (343), `spirits/viewer` (350), `guides/index` (390), `progression/index` (395), `getting-started/index` (406), `andy/overview-introduction` (417), `character/index` (435). Expand each with genuine guidance or consolidate. Section index pages especially - nav links don't count as content, so an index page needs real prose framing its section.
3. **Verify zero placeholder residue**: `grep -r "contribution-banner:auto-generated" public/content` must return nothing indexable; no "coming soon"/TBD sections on indexed pages.
4. **Differentiation pass** (the "why read this here?" test): every data-heavy page should carry commentary the official game and other sources don't have - recommendations, priorities, tested numbers, comparisons. Google's stated remedy for near-identical reference pages: expand each or consolidate into one comprehensive page.
5. **Tool page copy** (written in Phase 1's prerender work): 150-300 words of genuine how-to per tool.

### Phase 4 - Technical hygiene (P1)

1. **Sitemap curation**: remove or noindex `donate`, `changelog`, `highscore` (and reconsider `creators`) unless given substantive content; keep `lastmod` honest (no fake freshness).
2. **Soft-404 mitigation**: prerendered routes now return real content; app's 404 view should render a clear "not found" message (Google's soft-404 detection reads rendered text). Full status-404s would require dropping the catch-all - not worth breaking client routes; document as accepted trade-off.
3. **Canonicals**: emitted per page by the prerenderer (one canonical URL per page; https + apex host consistently).
4. **Search Console**: submit the sitemap, URL-inspect 5-10 key pages, confirm the **rendered HTML** contains article text, request indexing. Confirm zero manual actions listed.
5. **Lighthouse/mobile pass** on 2-3 content pages: no layout breakage, ad slots (empty during review) cause no CLS, mobile nav works.

### Phase 5 - Verification, indexing window, resubmission (P0 process)

1. Deploy everything above; run the Phase 1 curl acceptance tests against production.
2. Search Console: request indexing for the homepage + top guides; wait until a healthy share of content pages report as indexed (check weekly).
3. Get 1-2 **unaffiliated people** (not wiki contributors - e.g. Discord players) to browse and give honest "is this useful?" feedback - this is Google's own prescribed step for thin-content remediation.
4. **Wait ≥2-4 weeks after the fixes are live** before resubmitting. Both the case-study record and Google's own review-cadence rules punish rapid unchanged-looking resubmissions (the review button can be deactivated after several recent rejections).
5. Resubmit **once** in the AdSense console. Review can take up to 2-4 weeks. Keep slot IDs empty until approval (already the case).

---

## 3. Pre-resubmission checklist

Every box must be checked before pressing "Request review":

- [ ] `curl -A Googlebot` on 5 sample content pages returns the article text in HTML
- [ ] Every prerendered route has a unique `<title>`, meta description, and canonical
- [ ] Browsing with JavaScript disabled shows readable content on content routes
- [ ] About + Contact pages live, linked in the footer on every page
- [ ] Privacy Policy mentions third-party ad cookies + links Google's partner-data page
- [ ] No placeholder/"coming soon"/auto-generated-banner text on any indexed page
- [ ] All sitemap URLs resolve to prerendered pages with substantive content (tools included)
- [ ] Utility routes (`/search`, `/profile`, `/my-*`, `/donation-success`) noindexed
- [ ] Search Console: sitemap submitted, key pages indexed, rendered HTML verified, no manual actions
- [ ] Unaffiliated-reader feedback collected and addressed
- [ ] ≥2 weeks elapsed since the fixes went live
- [ ] Ad slot IDs still empty (no live ad requests during review)

---

## 4. Policy reference (condensed from the five research reports)

**The rejection maps to:** Publisher Policies → Inventory value → *"Google-served ads on screens without publisher-content or with low-value content"* (+ "under construction"). Glossary: low-value content = "unintelligible content that has no value to the user"; publisher-content **excludes ads, navigation, and related-content links**; a "screen" = each route.

**The spam-policy tips the email highlighted:** no keyword stuffing; don't claim content/services you don't have (nav links to empty sections count); no doorway/"cookie-cutter" pages. Related spam policies with teeth for a wiki: **scaled content abuse** (many templated pages without per-page value - explicitly "no matter how created", AI included), **scraping/replicated content** (in-game text or others' content reproduced without "additional commentary, curation, or otherwise adding value"), **thin affiliation's cookie-cutter test** (same skeleton, swapped names).

**What earns "value" in Google's own vocabulary** (helpful-content self-assessment): original research/analysis; substantial-complete-comprehensive coverage per page; insight beyond the obvious; substantial value *compared to other pages in search results*; written by "an expert or **enthusiast who demonstrably knows the topic well**" (fan-wiki maintainers qualify - say so on the About page); clear authorship and sourcing; readers don't need to search again afterward. Interactive builders/calculators are first-class original value - surface them with descriptive text.

**Ad-side rules that matter at review time:** no more ads than content per screen (headers/footers/nav/whitespace don't count as content); Better Ads mobile density < 30% of vertical height; no ads on error/login/thank-you/empty screens; UGC on ad-bearing pages is fully the publisher's responsibility (our PR-review + sanitization pipeline is the right answer - keep it demonstrable).

**Review mechanics:** AdSense participation never affects Search ranking; reviews sample per-screen; 2-4 week review windows; repeated recent rejections deactivate the review button; new approvals commonly get a <30-day ad-serving limit while traffic quality is assessed.

**Key case-study lessons:** a React game site was rejected repeatedly until crawler-readable article HTML existed (SSR alone didn't flip it); a 316-article blog was rejected over purely technical defects (broken sitemap, duplicate ghost URLs, iframe-only contact page, ~50-word homepage) and approved after fixing them; a 3-time-rejected blog was approved 48h after deleting thin pages, deepening the rest, and adding About/Contact/ToS/author bios, then waiting 2 weeks.

**Primary sources:** the five rejection-email links and their linked pages (support.google.com/adsense/answer/10502938, /10015918, /9061852, /7299563, /9724, /12176698; support.google.com/publisherpolicies/answer/11035931, /10502938, /11112688, /11190248, /11169917, table/10563033; support.google.com/webmasters/answer/9044175; developers.google.com/search/docs/essentials + /essentials/spam-policies + /fundamentals/creating-helpful-content + /crawling-indexing/javascript/dynamic-rendering); case studies: jangwook.net, blog.arturocalvo.com (Kobadoo), katesdigest.com, ricosblog.com, merj.com (AdSense WRS rendering).
