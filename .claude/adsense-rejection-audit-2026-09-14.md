# AdSense Rejection #3 Audit - "Low value content" (2026-09-14)

**Rejection wording (AdSense → Sites, screenshot 2026-09-14):** *"We found some policy violations - Low
value content. Your site does not yet meet the criteria of use in the Google publisher network."*
Review #3 was requested roughly 2026-09-07, i.e. after the prerender deploy of 2026-08-26/28. The
four resources the rejection links are mapped one by one in section 2. Search Console → Security &
Manual Actions reports **No issues detected**, so the "thin content" manual action itself is not in
play; its tests are still the right lens (section 2.3). Section 5 checks every finding against the
Search Console per-URL exports.

**Method (everything below was verified on 2026-09-14, nothing assumed):**

| Check | Tool |
|---|---|
| Crawler HTML (what a non-JS fetch gets) | `curl -A "Googlebot/2.1"` against production |
| Rendered DOM (what Google's renderer and a human reviewer get) | `chrome.exe --headless=new --dump-dom --virtual-time-budget=15000` against production, repeated 3x for the title race |
| Desktop visual | Dock browser screenshots of `/`, `/guides`, `/getting-started/first-steps/edit` |
| Mobile visual | Headless Chrome `--screenshot`, 390x844, iPhone UA, on `/`, `/getting-started/first-steps`, `/stages/stages-1-200` |
| Content metrics | Word counts (prose vs table rows) and 5-gram near-duplicate scan over all 65 markdown files |
| Link integrity | 540 internal links from content, prerender data, config nav and the 404 page checked against the 108 real routes |
| Image integrity | All 146 image URLs referenced by content fetched with a Googlebot-Image UA; content type inspected |
| Repeated text / keyword density | Paragraph-level (≥25 words) duplication scan; "slayer legend" mentions per 100 words |
| Off-site duplication | Web searches for distinctive sentences from Andy's guide and the promotion pages |
| Host variants | `curl` on http/https × apex/www, DNS lookup |
| Policy text | Fetched verbatim: the four linked pages, the "screens without publisher-content" detail page, the spam policies, the robots.txt spec |
| Search Console | Coverage export + the five per-reason drill-down exports of 2026-09-14 |

---

## 1. The one-paragraph answer

The markdown is not the problem. Google's renderer and the human reviewer judge the page **after
JavaScript runs**, and on that view a large share of the URLs Google can reach are UI shells, login
prompts, or a developer placeholder: 11 section index pages lose their prose (two of them show "No
pages yet - create markdown files"), 8 tool/app routes replace their how-to text with widgets, and
about 120 edit/history/new URLs return the homepage with HTTP 200 and render "Sign in to edit".
On a phone, every page first paints with the navigation drawer covering the article. The rendered
`<title>` collapses to the homepage title on a random subset of content pages on every load. Every
image URL in the crawler HTML returns an HTML document instead of an image. And `www.slayerlegend.wiki`
returns a bare 404. AdSense's "low value content" verdict is per screen, and those screens are what
it sampled. Search Console's per-URL lists (section 5) line up with this.

## 2. The four linked resources, mapped one-to-one

### 2.1 "Minimum content requirements" (support.google.com/adsense/answer/9335564#minimum_content_requirements)

The anchor no longer exists: Google consolidated this into the **Google Publisher Policies** page.
The operative section is *Inventory value → Google-served ads on screens without publisher-content*:

> We do not allow Google-served ads on screens: without publisher-content or with low-value
> content, that are under construction, that are used for alerts, navigation or other behavioral
> purposes.

The linked detail page (publisherpolicies/answer/11112688) adds:

> The content you provide should be of value to the user and be the focal point for users visiting
> your site or app. For this reason, we may limit or disable ad serving on pages with low value
> content and/or still being constructed until changes are made. [...] Ads should not be placed on
> "dead end" or no content screens (e.g., Thank You, Exit, Error pages, etc.) [...] Don't place ads on
> automatically generated content without manual review or curation.

| Requirement | Site status (rendered view) | Where |
|---|---|---|
| Screens without publisher-content | **Fail.** 11 section routes render only a card list; 6 builders + `/spirits/viewer` render widgets + "Sign in"; `/creators` renders "0 guides / No streamers yet"; ~121 edit/history/new URLs render the editor gate. | Findings 1, 2, 4 |
| Screens under construction | **Fail.** `/tools` and `/guides` render "No pages yet - Create markdown files in /public/content/...". Andy's guide and `character/class.md` say the content is still being migrated / work in progress. | Findings 1, 8 |
| Screens used for navigation | **Fail.** Section routes are navigation screens after hydration; they sit in the sitemap at priority 0.7-1.0. | Finding 1 |
| Content is the focal point | **Fail on mobile.** First paint on a 390px viewport is the open navigation drawer plus a black overlay covering the article, on every page. | Finding 3 |
| Automatically generated content without curation | **Pass.** The 8 stage pages are generated, but every one carries 713-1,039 words of hand-written prose from `scripts/stage-pages.config.json` and the data is capped at the verified stage. | Section 4 |

### 2.2 "Make sure your site has unique high quality content and a good user experience" (adsense/answer/10015918)

Verbatim requirements and status:

| Google's text | Status | Evidence |
|---|---|---|
| "make sure that your pages have enough unique content so that we can determine what your site is about" | Pass for content pages; **fail for the 30 rendered-shell URLs** in section 2.1. | Rendered word counts, finding 1 and 4 tables |
| "do not use cloaking and doorway pages, pages with little to no content, or pages optimized for specific keywords" | Cloaking: no intent, but crawler HTML and rendered DOM diverge on 19 sitemap URLs. Keyword optimisation: pass (max 0.83 "slayer legend" mentions per 100 words). | Finding 1, keyword scan |
| "Check that the content on your site is unique and that fragments are not copied from other sites" | **Pass.** Searches for distinctive sentences returned no copies. | Web search |
| "ensure that the same content is not duplicated in the same page or across multiple pages" | **Pass** for text. **Fail** for titles: the rendered `<title>` is the homepage's on a random subset of pages. | Paragraph and n-gram scans; finding 5 |
| "instead of including lengthy copyright text on the bottom of every page, include a very brief summary" | Pass. Footer is one line plus three links. | `Footer.jsx:86` |
| "Alignment - Are all the navigational elements lined up correctly across all devices?" | **Fail on mobile** (drawer open on load). | Finding 3 |
| "Functionality - Do your drop-down lists work correctly? Are all navigational elements clickable?" | Pass, with a note: a "Welcome Slayer!" tooltip overlays the header/sidebar on first visit on every page until dismissed. | Desktop and mobile screenshots |
| "Accuracy - Are the elements bringing the user to the right content?" | **Partial fail.** Homepage link "system guides" → `/guides` → "No pages yet". Sitemap `/creators` → empty page. 404 page's "Reference" link → `/reference`, which has no route and serves the homepage. | Findings 1, 4; link scan |
| "Make sure that your site provides the information and service promised and does not have links that lead to: false claims of downloadable or streaming content, missing pages, irrelevant or misleading pages" | **Fail.** `/creators` promises "a library of video guides you can actually search" and "live Twitch and YouTube channels" with zero of either; Andy's guide lists 15 sections of which 2 exist. Missing page: `/reference` from the 404 view. `www.slayerlegend.wiki` is a missing page for the whole site. | Findings 4, 6, 8; link scan |
| "Ensure that your site appears correctly in different browsers" | **Fail without JavaScript** (every image is an HTML document), fail on mobile Chrome (drawer). Desktop Chrome correct. | Findings 3, 7 |
| "make sure that you update your site regularly" | Pass. 13 pages updated 2026-08-28, 37 on 2026-08-16; dates are visible on pages and honest in the sitemap. | `sitemap.xml` lastmod |

### 2.3 "Webmaster quality guidelines for thin content" (webmasters/answer/9044175#thin-content)

The manual-actions page. Its recommended actions, with results:

| Google's step | Result |
|---|---|
| "Check for content on your site that duplicates content found elsewhere." | Pass - none found off-site; none repeated on-site. |
| "Check for thin content pages with affiliate links on your site." | Pass - zero affiliate or tracking links in `public/content`. |
| "Check for doorway pages on your site." | **Partial fail** - the 11 section routes are, after hydration, intermediate pages that only funnel to real pages; two are empty. |
| "think about whether your site provides significant added value for your users" | Content pages yes; ~150 reachable screens no (section 2.1). |

Search Console reports no manual action, which is consistent: this is an AdSense inventory-value
decision, not a Search penalty.

### 2.4 "Webmaster quality guidelines" (adsense/answer/1348737)

This page is the AdSense summary of the Search spam policies. Its three highlighted rules:

| Rule | Status |
|---|---|
| "Avoid unnecessary, repeated use of keywords" | Pass (keyword scan). |
| "Your sites should not claim that they provide content or services that they do not have" (→ *misleading functionality*) | **Fail** - `/creators` (empty video library and streamer list, in the sitemap), `/guides` and `/tools` (rendered as "No pages yet"), Andy's phantom table of contents. |
| "Don't create doorway pages created just for search engines, or other cookie cutter approaches" | Partial - see 2.3. |

## 3. Findings, ranked

### Finding 1 (critical): section index pages lose their content after hydration; `/tools` and `/guides` show an under-construction box

`scripts/prerender.js` emits each section's `index.md` as real HTML, so a non-JS fetch of
`/getting-started` returns 681 words of prose. But the framework's section route renders
`wiki-framework/src/pages/SectionPage.jsx`, which **never loads `index.md`** - it declares
`indexContent` state on line 17 and never sets it. It fetches `search-index.json`, filters out
`pageId === 'index'` (line 36), and renders a card list, or, when a section has no other pages, this
yellow box (lines 158-186):

> **No pages yet** - This section doesn't have any pages yet. Create markdown files to populate this
> section. Create markdown files in `/public/content/guides/` to populate this section.

Live rendered DOM, main-content word counts:

| Route (in sitemap) | Crawler HTML | Rendered app | What renders |
|---|---|---|---|
| `/getting-started` | 681 words | 178 | "Browse all pages in this section" + cards |
| `/character` | 676 | 141 | cards |
| `/stages` | 1,331 | 418 | cards |
| `/tools` | 422 | 60 | **"No pages yet ... Create markdown files in /public/content/tools/"** |
| `/guides` | 694 | 60 | **"No pages yet ... Create markdown files in /public/content/guides/"** |

All 11 section routes (`/character`, `/companions`, `/equipment`, `/getting-started`, `/guides`,
`/progression`, `/resources`, `/skills`, `/spirits`, `/stages`, `/tools`) are in the sitemap.
`/guides` is linked from the homepage prose and from the 404 page's "Popular sections". The
340-1,330 words written per section page for rejection #2 are invisible to the review.

### Finding 2 (critical): every unknown URL returns the homepage with HTTP 200, and Google is allowed to crawl ~120 of them

`public/_redirects` ends with `/*  /index.html  200`. Since the prerenderer patches `dist/index.html`
in place with the homepage article, **every un-prerendered URL returns the full homepage**: 554
words, `<title>Slayer Legend Wiki</title>`, `<link rel="canonical" href="https://slayerlegend.wiki/">`,
no `noindex`, status 200. Verified live:

| URL | Status | Title | Canonical | Rendered app shows |
|---|---|---|---|---|
| `/getting-started/first-steps/edit` | 200 | Slayer Legend Wiki | `/` | "Choose Edit Mode - Sign In with GitHub / Continue Anonymously" |
| `/getting-started/first-steps/history` | 200 | Slayer Legend Wiki | `/` | page history UI |
| `/character/class/new` | 200 | Slayer Legend Wiki | `/` | editor |
| `/zzz-not-a-real-page` | 200 | Slayer Legend Wiki | `/` | 404 page (client-side redirect to `/404`) |

Every content page renders `✏️ Edit` and `📜 History` links (`PageViewerPage.jsx` lines 647 and 657),
so Googlebot discovers 106 edit/history URLs from the 53 content pages, plus 15 `/<section>/new`
routes. `PageEditorPage.jsx`, `PageHistoryPage.jsx` and `NotFoundPage.jsx` emit no `MetaTags`, so
nothing marks them `noindex`. Search Console has already crawled three of them (section 5).

**`robots.txt` does not protect these for Google.** `public/robots.txt` ends with dedicated groups:

```
User-agent: Googlebot
Allow: /
Crawl-delay: 0

User-agent: Mediapartners-Google
Allow: /

User-agent: AdsBot-Google
Allow: /
```

Google's robots.txt specification: *"Only one group is valid for a particular crawler. Google's
crawlers determine the correct group of rules by finding in the robots.txt file the group with the
most specific user agent that matches the crawler's user agent"* and *"User agent specific groups and
global groups (\*) are not combined."* `Crawl-delay` is not supported. So for Googlebot,
Mediapartners-Google and AdsBot-Google the only rule that exists is `Allow: /`; the `Disallow` lines
for `/search`, `/profile`, `/admin`, `/my-*`, `/404`, `/*/edit$`, `/*/history$`, `/*/new$` apply to
Bing and everyone else, not to Google. Cloudflare's managed prefix (Content-Signal, GPTBot, ClaudeBot,
Google-Extended) is harmless for Search and AdSense.

### Finding 3 (critical): on phones, every page first paints with the navigation drawer covering the article

`wiki-framework/src/store/uiStore.js:21` initialises `sidebarOpen: true` unconditionally and persists
it. `Sidebar.jsx` renders the drawer `fixed ... translate-x-0` whenever `sidebarOpen` is true, plus a
full-screen `bg-black bg-opacity-50 lg:hidden` overlay (lines 413-418). The only code that closes it
below 1024px is `handleNavigate` (lines 193-198), which runs after the user taps a link. So a first
visit on a phone - or any deep link from Search - shows the drawer over the content until the user
dismisses it. Headless Chrome at 390x844 with an iPhone user agent confirmed this on `/`,
`/getting-started/first-steps` and `/stages/stages-1-200`; the article is visible only as a sliver on
the right edge. The "Welcome Slayer!" tooltip is stacked on top of the drawer.

This is the direct counterpart of "Alignment - are all the navigational elements lined up correctly
across all devices?" and of "the content you provide should be the focal point". A mobile reviewer
sees navigation first on every screen.

### Finding 4 (high): tool and app routes replace their prerendered prose with UI shells

The prerenderer writes 150-300 words of how-to text for each tool route from
`scripts/prerender-data/routes/*.md`, but React replaces that DOM on load, and the app components
carry no such text. Rendered word counts:

| Route | Crawler HTML | Rendered | Rendered content |
|---|---|---|---|
| `/skill-builder` | 298 | 157 | tool UI + "Sign In to Save Builds" |
| `/spirits/viewer` | 754 | 314 | `SpiritSpriteDemoPage` (the custom route in `main.jsx` shadows `spirits/viewer.md`) |
| `/creators` | 168 | 73 | **"0 guides - No video guides yet" / "No streamers yet"** |

`/creators` is in the sitemap (`robots: index`), its prerendered text promises "a library of video
guides you can actually search" and "live Twitch and YouTube channels", and the live page is empty:
`public/data/video-guides.json` has zero entries and the `[Content Creator Index]` issue (#260) has
empty Approved and Pending lists. That is the spam policies' *misleading functionality* and the
content-quality page's "false claims of streaming content" in one URL. `/spirits/viewer` is already
in Search Console's "Crawled - currently not indexed" list (section 5).

### Finding 5 (high): the rendered `<title>` is a race, and the homepage title wins on a random subset of content pages

`wiki-framework/src/App.jsx:147` runs `document.title = config.wiki.title` whenever config loads.
react-helmet sets the per-page title from `SeoManager`/`MetaTags`; whichever effect fires last wins.
Three consecutive headless renders of the same URLs:

| URL | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| `/getting-started/first-steps` | Slayer Legend Wiki | Slayer Legend Wiki | Your First Steps \| Slayer Legend Wiki |
| `/companions/luna` | Slayer Legend Wiki | Luna \| Slayer Legend Wiki | Luna \| Slayer Legend Wiki |
| `/companions/zeke` | Zeke \| ... | Zeke \| ... | Zeke \| ... |

Section pages, `/creators`, `/highscore`, `/donate`, edit/history routes and 404s lose every time
(nothing re-asserts their title). The meta description survives; only the title is clobbered. Google
indexes the rendered title, so on any given crawl a random slice of content pages carries the
homepage's title - a duplicate-title signal that Search Console's declined list reflects (section 5).

### Finding 6 (high): `www.slayerlegend.wiki` returns a bare 404

DNS for `www` resolves to Cloudflare, `http://www.slayerlegend.wiki/` 301s to https, and
`https://www.slayerlegend.wiki/` returns **HTTP 404 "Not Found - Request ID: ..."** from Cloudflare
Pages - the hostname is not attached to the Pages project, so no redirect to the apex exists. Search
Console lists both `http://www.slayerlegend.wiki/` and `https://www.slayerlegend.wiki/` under
"Not found (404)", last crawled 2026-08-24. Anyone typing `www` - reviewers included - gets a blank
error page. This is a Cloudflare dashboard fix (add the custom domain or a redirect rule), not a
code change.

### Finding 7 (high): every image in the crawler HTML is an HTML document

Content markdown references images as `/images/content/...` (146 unique URLs). `public/_redirects`
says these are "handled by functions/images/content/[[path]].js", but **that function does not
exist**: `functions/images/content/` is an empty directory with nothing tracked in git (the API
functions under `functions/api/` are deployed and respond correctly). So every `/images/content/*`
request falls through to the `/* /index.html 200` catch-all and returns the prerendered homepage:

```
/images/content/companions/zeke/warrior_01.png   HTTP 200  text/html  11,826 bytes
/images/content/goods/Goods_Emerald.png          HTTP 200  text/html  11,826 bytes
```

In the running app, the framework's `imageResolver.js` rewrites these to
`cdn.jsdelivr.net/gh/BenDol/SlayerLegendCDN@main/...` (which serves real PNGs, verified), so users
and Google's renderer see images. But `scripts/prerender.js` does not apply that rewrite, so the
crawler HTML, Googlebot-Image, any non-JS fetch, and the pre-hydration paint all get 146 broken
images, each returning a 200 HTML page (a soft-404 signature for image search). Eight of the
references also contain literal spaces (`altar/DragonStat 1.png`, `goods/EnchantCube 1_1.png`,
`skills/icons/09_IceAge 1.png`, ...) across 13 pages; they resolve on the CDN only because browsers
percent-encode them.

### Finding 8 (medium): under-construction statements on indexed pages

- `public/content/andy/overview-introduction.md`: a 15-entry table of contents (Early Progression,
  Diamond gain methods, Stage 0-340 ... Stage 1200-1300) of which only this introduction exists,
  followed by an editor's note that "the remaining sections of Andy's guide are still being
  migrated". The homepage and `/guides` present this as "the wiki's flagship walkthrough". It is in
  Search Console's declined list (section 5).
- `public/content/character/class.md:106`: "This part of the guide is still a work in progress".

### Finding 9 (low): the framework 404 page links to a route that does not exist

`wiki-framework/src/pages/NotFoundPage.jsx` offers "Popular sections: Getting Started, Guides,
Reference". `/reference` is not a section; it falls into the catch-all and serves the homepage. This
was the only broken internal link out of 540 checked.

### Finding 10 (low): thinnest pages by prose

Tables and link lists do not count as publisher content, so prose-only counts matter:

| Page | Prose words |
|---|---|
| `database/skills.md` | 215 |
| `resources/index.md` | 231 |
| `meta/emoticons.md` | 255 |
| `character/promotions.md` | 262 |
| `companions/index.md` | 276 |
| `spirits/information.md` | 301 |

`database/skills` and `character/promotions` are both in Search Console's declined list.

## 4. What checked out clean

- Prerendered crawler HTML is live and correct on every sampled route (article text present, unique
  title, canonical, JSON-LD, correct `noindex` on the 8 utility stubs).
- No UA-conditional serving anywhere: no Pages Functions middleware, and Cloudflare returned the same
  HTML to a Googlebot UA as to a browser.
- The 8 generated stage pages (`stages/stages-*.md`): 232 table rows each, but 713-1,039 words of
  distinct prose per page, and the highest cross-page 5-gram overlap is 9.2%.
- No affiliate links; no text copied from elsewhere; no paragraph repeated across pages; keyword
  density under 1%.
- 539 of 540 internal links resolve to real routes.
- `ads.txt` correct, AdSense verification meta static in `<head>`, HTTPS, About/Contact/Privacy live
  and in the footer, privacy policy carries the Google partner-sites link and the third-party cookie
  disclosure, sitemap has 72 URLs with honest `lastmod`.
- The API Pages Functions are deployed and respond (`/api/load-data` 400 JSON, `/api/github-bot` 405 JSON).
- The ad loader is suppressed for non-ad crawlers and no slot IDs are set, so no ad requests fire
  during review.

## 5. Search Console: every non-indexed URL, matched to a finding

Coverage export (data through 2026-09-03): **41 indexed, 28 not indexed**. Indexed pages rose
20 → 29 on 2026-08-21 and 29 → 41 on 2026-08-28, immediately after the prerender deploy - proof the
crawler-HTML fix worked for what it was meant to do. Impressions run around 1,000/day. The five
drill-down exports give the URLs:

**Crawled - currently not indexed (13)** - Google fetched, rendered, and declined:

| URL | Last crawled | Matches |
|---|---|---|
| `/spirits/viewer` | 2026-09-04 | Finding 4 - custom route shadows the article; rendered view is the sprite demo |
| `/companions/zeke` | 2026-09-01 | Finding 5 (title race) + finding 7 (6 images, all HTML in crawler view) |
| `/companions/luna` | 2026-09-01 | Finding 5 (lost its title in 1 of 3 renders) + finding 7; 367 prose words |
| `/companions/miho` | 2026-09-01 | Finding 5 (generic title in the dump) + finding 7; 330 prose words |
| `/companions/promotion-option` | 2026-09-01 | Finding 7; otherwise clean (881 rendered words, correct title) |
| `/database/skills` | 2026-09-01 | Finding 10 - 215 prose words, 7 tables |
| `/andy/overview-introduction` | 2026-08-28 | Finding 8 - phantom table of contents, "still being migrated" |
| `/getting-started/core-mechanics/edit` | 2026-08-21 | Finding 2 - editor gate, crawlable because of the robots.txt Googlebot group |
| `/character/latent-power/edit` | 2026-06-12 | Finding 2 |
| `/character/training-diary` | 2026-06-16 | Stale: last crawled before the 2026-08-16 content fill and the prerender - Google still holds the empty-shell verdict |
| `/character/promotions` | 2026-04-27 | Stale (as above); also finding 10 (262 prose words) |
| `/character/stats` | 2026-04-26 | Stale (as above) |
| `/getting-started/ui-guide` | 2026-04-12 | Stale (as above) |

**Discovered - currently not indexed (10)** - known from the sitemap, never fetched:
`/equipment/black-orbs`, `/equipment/enhancement`, `/equipment/fusion`, `/equipment/relics`,
`/meta/contact`, `/resources/farming`, `/resources/gold`, `/resources/materials`,
`/skills/skill-refinement`, `/skills/skills`. All are real, filled pages (434-549 words, dated
2026-08-16). Google has had a month and has not spent crawl on them while it did spend crawl on
`/edit` and `/history` URLs - finding 2 in action, and a site-level crawl-demand signal.

**Soft 404 (2):** `/getting-started/early-game-roadmap/history` (finding 2 - history UI on a 200)
and `/changelog` (crawled 2026-05-05 as an empty SPA shell; now a `noindex` stub, needs a recrawl).

**Not found (404) (2):** `http://www.slayerlegend.wiki/` and `https://www.slayerlegend.wiki/`
(finding 6).

**Page with redirect (1):** `http://slayerlegend.wiki/` → https. Normal.

Note what is *not* in these lists: the 11 section routes, the 6 builders and `/creators` are all
indexed (they are not among the 28), so Google indexed them from the crawler HTML even though the
rendered view is a shell. That is exactly the divergence findings 1 and 4 describe - and it is the
rendered view that the AdSense reviewer sees.

## 6. Recommended fixes (nothing changed yet)

1. **Render `index.md` on section routes.** Framework fix in `SectionPage.jsx`, or parent-side:
   `registerCustomRoutes` entries are spread *before* the section routes in
   `wiki-framework/src/router.jsx`, so a parent route with `path: 'guides'` etc. shadows the
   framework page (the existing `spirits/viewer` custom route proves the precedence). Render the
   index prose above the card list; never show the "Create markdown files" box to anonymous users.
2. **Close the drawer by default below 1024px** (`uiStore` initial state from `window.innerWidth`,
   and do not persist `sidebarOpen` for mobile), so content is the first paint on phones.
3. **Fix `robots.txt`:** delete the Googlebot/Mediapartners/AdsBot groups (the `*` group already
   allows everything they need) or repeat every Disallow inside each of them. Drop `Crawl-delay`.
4. **Stop serving the homepage on unknown URLs:** `noindex` prerendered stubs (or a real 404 status
   via a Pages Function) for `/*/edit`, `/*/history`, `/<section>/new`, `/404`; `rel="nofollow"` on
   the Edit/History links; `noindex` via `MetaTags` on the editor, history and 404 pages.
5. **Guard the title:** make the `document.title` effect in `App.jsx` a fallback only (skip when a
   Helmet-managed `<title>` is present), or drop it - `MetaTags` already sets the site title on `/`.
6. **Attach `www.slayerlegend.wiki`** to the Cloudflare Pages project (or add a redirect rule to the
   apex) - dashboard action.
7. **Serve images to crawlers:** either ship the missing `functions/images/content/[[path]].js` proxy,
   or (simpler and cacheable) have `scripts/prerender.js` rewrite `/images/content/` to the CDN URL
   the app uses. Rename the 8 space-named image references.
8. **Give tool routes real on-page text** (render the prerender-data copy inside the app), and
   remove `/creators` from the sitemap (or `noindex` it) until it has content. Fix the 404 page's
   `/reference` link.
9. **Resolve the under-construction text** in `andy/overview-introduction.md` (drop the phantom TOC
   entries or add the sections) and `character/class.md`. Expand `database/skills` and
   `character/promotions` prose.
10. After deploying: URL-inspect and request indexing for the four stale-verdict pages
    (`/character/training-diary`, `/character/promotions`, `/character/stats`,
    `/getting-started/ui-guide`) and `/changelog`, then wait for "Crawled - currently not indexed"
    to shrink before resubmitting AdSense **once**.
