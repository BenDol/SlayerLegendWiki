# AdSense Approval Plan (2026-09-14)

Companion to `.claude/adsense-rejection-audit-2026-09-14.md`. Every task below cites the finding it
closes, the exact place in the code, how it is verified, and what "done" means. Status: every code,
content and test workstream (A-C, E, and the section 9 extension) was implemented on 2026-09-14 -
see the status tables in sections 8 and 9. What remains is workstream D, the operational steps only
the maintainer can take (custom domain, Search Console, outside readers, the waiting period, the
resubmission itself).

## 0. Definition of done - when we are comfortable pressing "Request review"

All of the following are true, measured by the audit harness in workstream E against production:

| Gate | Measure | Target |
|---|---|---|
| G1 Rendered content | Every sitemap URL's **rendered** main content (headless Chrome, JS on) contains ≥ 250 words of prose, and never contains "No pages yet", "Create markdown files", "Sign In to Save" as the only text, or "No video guides yet". | 72 / 72 |
| G2 Title stability | Rendered `<title>` equals the prerendered `<title>` on every sitemap URL, across 3 consecutive renders. | 216 / 216 |
| G3 Mobile first paint | At 390×844 the sidebar `<aside>` is off-canvas (`translate-x-full`) and no overlay is present on load, on every sitemap URL. | 72 / 72 |
| G4 Images | Every `<img src>` in the crawler HTML of every sitemap URL returns `image/*` with HTTP 200. | 0 broken |
| G5 Junk URLs | Every `/<section>/<page>/edit`, `/history`, `/<section>/new`, `/404` returns a `noindex` document; Edit/History links carry `rel="nofollow"`; robots.txt has no crawler-specific groups. | 100 % |
| G6 Host | `https://www.slayerlegend.wiki/` returns 301 → apex (or 200 with canonical apex). | pass |
| G7 Honesty | No sitemap URL promises content it lacks: `/creators` out of the sitemap and `noindex` until it has ≥ 3 approved items; Andy's TOC lists only pages that exist; no "work in progress" / "still being migrated" on an indexed page. | pass |
| G8 Search Console | "Crawled - currently not indexed" contains no `/edit`, `/history` or stale-verdict URLs; the 4 stale pages and `/changelog` re-crawled after the deploy; both `www` 404s gone. | pass |
| G9 Time | ≥ 14 days between the last content/delivery deploy and the review request, with G1-G8 green for the whole window. | pass |
| G10 Outside opinion | Two players not involved with the wiki browsed 5 pages each on a phone and reported no confusion (Google's own recommended step). | 2 / 2 |

## 1. Workstream A - framework (`wiki-framework`, branch in the GithubWiki repo)

These change generic framework code; they are correct for any wiki built on it, not just this one.

### A1. Section pages render their `index.md` (closes audit finding 1)

- **Where:** `wiki-framework/src/pages/SectionPage.jsx` (lines 17-18 declare `indexContent`/`indexMetadata` and never set them).
- **What:** in `loadSectionData`, load the section's index page through the same path content pages use -
  `loadDynamicPage(sectionId, 'index', config, branch, false)` (signature verified at
  `dynamicPageLoader.js:221`; it already handles cache → GitHub → static fallback and returns
  `{ content, metadata }`). Render it above the card list with `<PageViewer content={...} metadata={...} />`
  (the same component `PageViewerPage.jsx:709` uses), so custom renderers, ad injection and the table
  of contents behave exactly as on a content page. Keep the card list below as "Pages in this section".
- **Empty-section state:** show the "No pages yet" box **only** to users who can create pages
  (`canCreatePage`); anonymous visitors see the index prose alone. The "Create markdown files in
  `/public/content/...`" instruction is a developer message and must never render publicly.
- **Loading order:** loading state first, then content (the CLAUDE.md rendering-order rule), so the
  section never flashes the empty box while the index is in flight.
- **Why not a parent-side route override:** React Router 6.30 scores the framework's index child
  (`computeScore` adds `indexRouteValue` for index routes, `@remix-run/router` `router.cjs.js:909`)
  above any parent route with the same static path, so a parent `path: 'guides'` route would lose.
  The `spirits/viewer` override only works because static beats `:pageId`.
- **Verify:** rendered `/getting-started` contains the phrase "Slayer Legend is a pixel-art idle RPG by
  GEAR2"; rendered `/guides` and `/tools` contain their index prose and no "No pages yet"; unit test in
  the framework for the anonymous vs contributor empty-state branch.

### A2. Sidebar closed by default on small screens (closes finding 3)

- **Where:** `wiki-framework/src/store/uiStore.js:21` (`sidebarOpen: true`), `onRehydrateStorage` (line ~106).
- **What:** initialise `sidebarOpen` to `window.innerWidth >= 1024` (guarding `typeof window`), and in
  `onRehydrateStorage` force `state.sidebarOpen = false` when `window.innerWidth < 1024`, so a
  persisted desktop `true` never re-opens the drawer on a phone. Keep persistence for desktop.
- **Verify:** headless Chrome at 390×844 on `/`, a content page and a stage page: `<aside>` has
  `-translate-x-full` and no `.bg-opacity-50` overlay exists at load; desktop unchanged.

### A3. Stop `App.jsx` overwriting Helmet's title (closes finding 5)

- **Where:** `wiki-framework/src/App.jsx:147` (`document.title = config.wiki.title`).
- **What:** make the effect a fallback: return early when a Helmet-managed title exists
  (`document.querySelector('title[data-rh]')` - react-helmet-async stamps `data-rh="true"`,
  verified in `react-helmet-async/lib/index.js:104`). Optionally drop the effect entirely: the
  prerendered `<title>` is already correct before hydration and `SeoManager` sets it after.
- **Verify:** 3 consecutive headless renders of `/getting-started/first-steps`, `/companions/luna`,
  `/getting-started` all return the per-page title (gate G2).

### A4. `noindex` on editor, history and 404 screens; `nofollow` on their links (closes finding 2, app side)

- **Where:** `PageEditorPage.jsx`, `PageHistoryPage.jsx`, `NotFoundPage.jsx` (none emit `MetaTags`);
  `PageViewerPage.jsx:647` and `:657` (Edit / History links).
- **What:** render `<MetaTags robots="noindex, nofollow" title=... />` in the three pages (the prop
  already exists, `MetaTags.jsx:36`); add `rel="nofollow"` to the Edit and History `<Link>`s and to the
  "Create New Page" link in `SectionPage.jsx`.
- **Verify:** rendered DOM of `/getting-started/first-steps/edit` contains `<meta name="robots" content="noindex, nofollow">`; the Edit link on a content page has `rel="nofollow"`.

### A5. 404 page links are config-driven (closes finding 9)

- **Where:** `wiki-framework/src/pages/NotFoundPage.jsx` (hard-coded `/getting-started`, `/guides`, `/reference`).
- **What:** render the first three `config.sections` (or `config.wiki.notFoundLinks` if present) instead
  of hard-coded paths, so a framework consumer can never ship a dead link from its own 404 page.
- **Verify:** link scan (`scratchpad/linkscan.cjs` logic, to be moved into `tests/`) reports 0 dead routes.

## 2. Workstream B - parent delivery (this repo)

### B1. `robots.txt` with one rule set (closes finding 2, crawler side)

- **Where:** `public/robots.txt`.
- **What:** a single `User-agent: *` group: `Allow: /`, `Disallow: /api/`, `Sitemap:` line. Delete the
  `Googlebot`, `Mediapartners-Google`, `AdsBot-Google*`, `Bingbot`, social-bot groups and every
  `Crawl-delay`. Drop the page-level `Disallow`s (`/search`, `/profile`, `/my-*`, `/*/edit$` ...): every
  one of those screens is (or becomes, via B2 and A4) a `noindex` document, and Google's own guidance
  is that a page must be crawlable for `noindex` to be honoured - a robots block would leave the two
  `/edit` URLs Google already crawled stuck as "indexed, blocked by robots".
- **Verify:** Search Console robots.txt tester (or `google-robotstxt` parser) shows `/getting-started/first-steps/edit` *allowed* for Googlebot and `/api/x` *disallowed*; `curl https://slayerlegend.wiki/robots.txt` contains exactly one non-Cloudflare `User-agent` group.

### B2. Prerender: image URLs, junk-route stubs, `/404` (closes findings 2 and 7)

- **Where:** `scripts/prerender.js`; tests in `tests/prerender.test.js` (19 cases today).
- **What:**
  1. **Image rewrite.** After `renderMarkdown`, rewrite every `src="/images/content/<rel>"` to the CDN
     URL using the same mapping as the framework's `imageResolver.js:buildCdnUrl` -
     `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{basePath}/images/{rel}` or the
     `raw.githubusercontent.com` form - read from `wiki-config.json` `features.gameAssets`. Expose the
     serving mode as a prerender option; **recommended: `raw` for crawler HTML**, because the CDN repo
     exceeds jsDelivr's 50 MB package limit and uncached files 403 there (`src/utils/cdnFallback.js`
     header), while raw always serves. Percent-encode the path so the 8 space-named references
     resolve (verified: both CDNs return `image/png` for `altar/DragonStat%201.png`).
  2. **Junk-route stubs.** For every content page emit `dist/<section>/<page>/edit.html` and
     `history.html`, and for every section `dist/<section>/new.html`, plus `dist/404.html`-style
     `dist/404.html` **only if** decision D-1 below chooses the Cloudflare `404.html` route; otherwise a
     flat `dist/404.html` is not emitted and `/404` gets a normal noindex stub. Each stub: unique
     title ("Edit: <page>"), `<meta name="robots" content="noindex, nofollow">`, canonical to the
     parent page, one sentence of body. ~121 files × ~12 KB.
  3. **Homepage shell.** Leave `dist/index.html` as is; the catch-all still serves it for genuinely
     unknown URLs (decision D-1).
- **Verify:** unit tests for the URL rewrite (jsDelivr and raw modes, encoding, absolute URLs
  untouched); `curl -A Googlebot` on `/companions/zeke` shows only CDN image URLs; HEAD on each
  returns `image/*`; `/getting-started/first-steps/edit` returns the stub with `noindex`.

### B3. Image proxy function as the safety net (finding 7, long tail)

- **Where:** new `functions/images/content/[[path]].js` (the directory exists, empty, untracked; the
  `_redirects` comment already promises it).
- **What:** 301 to the raw CDN URL for the requested path (percent-encoded), `Cache-Control: public,
  max-age=86400`. Covers external embeds, old links, Discord previews and anything the prerender
  does not touch. Function invocations stay low because the app rewrites image URLs client-side.
- **Verify:** `curl -I https://slayerlegend.wiki/images/content/goods/Goods_Emerald.png` → 301 to a
  URL that returns `image/png`; integration test under `tests/integration`.

### B4. Space-named image references (finding 7)

- **Where:** 13 pages listed in the audit (`character/class.md`, `equipment/*`, `resources/*`,
  `skills/skills.md`, `spirits/index.md`, `stages/rewards.md`).
- **What:** replace the 8 references with percent-encoded paths (`DragonStat%201.png`) so they are
  valid in HTML without relying on browser auto-encoding. Add a frontmatter/content test that fails on
  an unencoded space inside `src=`/`](`.

### B5. Sitemap and `/creators` honesty (finding 4, part; gate G7)

- **Where:** `scripts/generate-sitemap.js` `STATIC_ROUTES`, `src/content/tool-pages/creators.md`.
- **What:** remove `/creators` from `STATIC_ROUTES` and set `robots: noindex` in its prerender data
  until the approved-creator index (issue #260) holds ≥ 3 items; rewrite its copy to describe what the
  page *is* (a submission portal) rather than a library. Re-add both when content exists (decision D-2).

### B6. Tool pages carry their own explanatory text (finding 4)

- **Where:** parent tool pages registered in `main.jsx` (`SkillBuildSimulatorPage`, `SpiritBuilderPage`,
  `FamiliarBuilderPage`, `BattleLoadoutsPage`, `SoulWeaponEngravingBuilderPage`, `SkillStonesPage`,
  `SpiritSpriteDemoPage`); copy lives in `src/content/tool-pages/*.md` (moved from scripts/prerender-data/routes) and
  `public/content/spirits/viewer.md`.
- **What:** move the tool copy to `src/content/tool-pages/<route>.md` (single source of truth), point
  `PRERENDER_DATA_DIR` at it, and add a `ToolIntro` component that imports the file at build time
  (`import.meta.glob('../content/tool-pages/*.md', { query: '?raw' })`; `vite.config.js:77` already
  allows `..`) and renders it below the tool through the app's markdown pipeline, collapsed on
  mobile behind an "About this tool" disclosure (Google explicitly allows accordion-hidden content).
  `SpiritSpriteDemoPage` renders `public/content/spirits/viewer.md` the same way so the URL keeps its
  754-word article after hydration.
- **Design:** must match the app's existing card/typography system (Tailwind, dark palette, the
  `.prose` styles PageViewer uses) - no new visual language.
- **Verify:** rendered `/skill-builder` ≥ 250 words of prose; rendered `/spirits/viewer` contains the
  article's first sentence; 7 tool routes pass gate G1.

### B7. Audit-driven tests

- Move the link-integrity, repeated-paragraph and image-reference scans from the session scratchpad
  into `tests/content-integrity.test.js` so they run in CI (`prebuild` runs the test suite on main).

## 3. Workstream C - content (this repo, markdown only)

### C1. Andy's guide (finding 8, gate G7)

- **Where:** `public/content/andy/overview-introduction.md`.
- **What (decision D-3):** either (a) trim the table of contents to the two sections that exist and
  reword the editor's note as a scope statement ("this page is the introduction; the stage-by-stage
  material lives in ..." with links), or (b) migrate the remaining 13 sections. (a) is a 20-minute
  edit and closes the finding; (b) is the better wiki but is weeks of work and must not gate review.

### C2. `character/class.md:106` "work in progress" (finding 8)

- Rewrite as a scoped statement of what the page covers and a contributor invitation without the
  phrase "work in progress"; move the constellation stub to a `## Constellations` section with real
  content or remove the heading.

### C3. Thin-prose pages (finding 10)

Bring each to ≥ 350 prose words (tables excluded), in the wiki's voice, with recommendations the
tables alone cannot give:

| Page | Prose today | Add |
|---|---|---|
| `database/skills.md` | 215 | how to read the table, grade-by-grade "what to level first", cross-links to the builder |
| `resources/index.md` | 231 | the resource economy in one page: what to farm when |
| `character/promotions.md` | 262 | the promotion cadence, common walls, what to do when stuck |
| `companions/index.md` | 276 | which companion first and why, advancement order |
| `spirits/information.md` | 301 | farming vs boss lineups explained in prose |
| `meta/emoticons.md` | 255 | acceptable as is (utility page) - add `noindex` in frontmatter instead |

### C4. `/creators` content (decision D-2)

- Option: seed 3-5 genuine community video guides (there are public Slayer Legend guide channels)
  and one approved streamer before re-adding the page to the sitemap. Not a gate.

## 4. Workstream D - operations (only you can do these)

| # | Action | Closes | When |
|---|---|---|---|
| D1 | Cloudflare Pages → Custom domains: add `www.slayerlegend.wiki` and a Bulk Redirect / Redirect Rule `www` → apex (301). | finding 6, gate G6 | now |
| D2 | Search Console → Sitemaps: resubmit `sitemap.xml` after the deploy. | G8 | deploy day |
| D3 | Search Console → URL Inspection → "Request indexing" for `/character/training-diary`, `/character/promotions`, `/character/stats`, `/getting-started/ui-guide`, `/changelog`, and the 10 "Discovered - currently not indexed" URLs. | G8 | deploy day |
| D4 | Search Console → Pages → "Validate fix" on Soft 404 and Not found. | G8 | deploy day |
| D5 | Ask two uninvolved players to browse 5 pages each on a phone; note anything confusing. | G10 | week 1 |
| D6 | Weekly: re-run the audit harness against production; watch "Crawled - currently not indexed" and Indexed counts. | G1-G8 | weeks 1-3 |
| D7 | AdSense → Sites → "I confirm I have fixed the issues" → Request review. **Once.** | - | day ≥ 14 with all gates green |

## 5. Workstream E - verification harness

- **New:** `scripts/audit-adsense.mjs` (Node, no extra dependencies beyond the repo's; uses the
  installed Chrome via `--headless=new --dump-dom` and `--screenshot`, as this audit did). For every
  sitemap URL it records: crawler-HTML title/canonical/robots/word count/image statuses; rendered
  title/word count/forbidden phrases; mobile drawer state; junk-route `noindex`; www redirect. Exits
  non-zero when any gate G1-G7 fails and writes `audit-report.json` + a markdown summary.
- Run it three ways: on a local `wrangler pages dev dist` build before merge, on the Cloudflare
  preview URL from the branch, and against production after deploy (D6). Keep the report in the PR.
- Add `npm run audit:adsense` to `package.json`.

## 6. Sequencing and branches

| Step | Branch / worktree | Depends on | Est. effort |
|---|---|---|---|
| 1 | Framework: `fix/section-index-mobile-drawer-title` in GithubWiki (A1-A5), with framework unit tests | - | 1 day |
| 2 | Parent: `fix/adsense-delivery` (B1-B5, B7, E) + bump the submodule pointer to step 1 | step 1 | 1 day |
| 3 | Parent: `feat/tool-page-intros` (B6) | step 2 (prerender dir move) | 0.5 day |
| 4 | Parent: `content/adsense-thin-pages` (C1-C3) | - (parallel) | 0.5-1 day |
| 5 | Ops D1 now; D2-D4 on deploy day; D5-D6 weekly | steps 2-4 deployed | - |
| 6 | D7 review request | G1-G10 | day ≥ 14 |

Steps 1-4 can be built in parallel worktrees; merge order is 1 → 2 → 3, with 4 whenever ready.
Every merge to `main` deploys (conditional-deploy runs on each push), so batch 2 + 3 + 4 into as few
pushes as practical and run the harness on the preview URL first.

## 7. Decisions needed from you

| # | Decision | Recommendation |
|---|---|---|
| D-1 | Unknown URLs: keep the `/* /index.html 200` catch-all + `noindex` stubs for the known junk families (soft-404s remain only for garbage URLs), **or** ship `dist/404.html` so Cloudflare returns a real 404 for anything not prerendered. | **Keep the catch-all.** A real 404 would also hit `/profile/<user>` and `/build?...`, which are legitimate app screens (framework routes `profile/:username`, `build`), and Google already treats the rendered "404 Page Not Found" as a soft-404 that it does not index. Revisit after approval. |
| D-2 | `/creators`: `noindex` + out of sitemap now, or seed real content first. | `noindex` now (B5); seed content afterwards (C4) and re-add. |
| D-3 | Andy's guide: trim the TOC or migrate the 13 sections. | Trim now (C1a); migrate later on its own timeline. |
| D-4 | Crawler-HTML image host: `raw.githubusercontent.com` or jsDelivr. | `raw` for prerendered HTML (always serves); the app keeps jsDelivr + fallback for users. |

## 8. Implementation status (2026-09-14, branch `docs/adsense-rejection-3-audit`)

Everything in workstreams A, B, C and E is implemented in this worktree (parent + framework
submodule worktree on the same branch name) and verified locally; nothing is committed, merged or
deployed yet. Decisions D-1 to D-4 were taken as recommended (catch-all kept, `/creators` noindex,
Andy's TOC trimmed, raw GitHub for crawler images).

| Item | Status | Verified by |
|---|---|---|
| A1 Section pages render `index.md` | Done - `wiki-framework/src/pages/SectionPage.jsx` + `src/utils/sectionIndex.js` | 21 framework tests; local render of `/guides`, `/tools`, `/getting-started` shows 471-742 words, no "No pages yet" |
| A2 Drawer closed below 1024px | Done - `uiStore.js` (`getInitialSidebarOpen`, rehydrate override) **plus** `FirstTimeTutorial.jsx`, which was force-opening the drawer on mobile 1 s after every first visit (the actual cause on production) | `tests/store/uiStore.test.js`, `tests/components/FirstTimeTutorial.test.jsx`; headless mobile render of local build: drawer closed, no overlay |
| A3 Title guard | Done - `App.jsx` skips `document.title` when a Helmet title exists | harness title-runs=3 |
| A4 noindex + nofollow on app screens | Done - `PageEditorPage`, `PageHistoryPage`, `NotFoundPage` emit `MetaTags robots="noindex, nofollow"`; Edit/History/Create links `rel="nofollow"` | `NotFoundPage.test.jsx`, `SectionPage.test.jsx` |
| A5 404 links from config | Done | `NotFoundPage.test.jsx` |
| A6 (new) GitHub rate-limit banner | Shown to signed-in users only - anonymous readers behind shared IPs hit the 60/h API limit and saw "GitHub rate limit reached" on every page | manual review |
| B1 robots.txt | Done - single `*` group, `Disallow: /api/` only | harness `robots.txt` gate |
| B2 Prerender | Done - CDN image rewrite (raw, percent-encoded), 129 noindex stubs for edit/history/new with canonical to the parent page, tool copy from `src/content/tool-pages` | `tests/prerender-crawler.test.js` (18); build emits 204 routes |
| B3 Image function | Done - `functions/images/content/[[path]].js` 301 → raw GitHub, shared mapping in `functions/_shared/utils/imageCdn.js` | `tests/handlers/images-content.test.js`, `tests/utils/imageCdn.test.js`; `wrangler pages dev` returns 301 |
| B4 Space-named images | Done - 18 references in 13 pages percent-encoded | `tests/content-integrity.test.js` |
| B5 Sitemap / creators | Done - `/creators` removed from `STATIC_ROUTES`, `robots: noindex`, copy rewritten honestly; `guides/index.md` no longer promises a video library | `tests/sitemap-routes.test.js` |
| B6 Tool intros | Done - `src/components/ToolIntro.jsx` under 6 builders + Spirit Viewer, single-source markdown | local render of `/skill-builder` 431 words, `/spirits/viewer` 1,052 |
| B7 Integrity tests | Done - links, under-construction wording, image spaces, repeated paragraphs, tool copy | 76 tests |
| C1-C3 Content | Done - Andy TOC → coverage table, class page "Constellations" stub replaced, 5 pages expanded (+80 to +170 prose words each) | integrity tests |
| E Harness | Done - `scripts/audit-adsense.mjs`, `npm run audit:adsense[:local]` | smoke run on local build |
| SeoManager | Section routes now take title/description from the index page so rendered title == prerendered title | local render |
| Docs | CLAUDE.md section "Keeping the site AdSense-ready" | - |

Test totals after the change (including section 9): parent 800 → 873 passing (41 files), framework
293 → 309 passing (21 files).

**Local harness result (final, 2026-09-14, `npm run preview:audit` + `npm run audit:adsense:local --title-runs=3`):**
0 problems across all 75 sitemap routes - every route's rendered title identical to its prerendered
title in 3 of 3 runs, mobile drawer closed on all 75, minimum rendered main content 314 words, 0 broken
images in crawler HTML, 8 sampled editor/history/new stubs all `noindex`, robots.txt a single `*`
group. Gates G1-G5 green locally; G6 (www) needs D1; G7 holds by the integrity tests; G8-G10 are
post-deploy.

**Still yours (workstream D):** D1 attach `www` in Cloudflare; commit the framework worktree first
(`wiki-framework` on branch `docs/adsense-rejection-3-audit`), then the parent pointer + files;
after the deploy run `npm run audit:adsense -- --title-runs=3` against production (expect only the
www gate to fail until D1 is done); D2-D4 Search Console actions; D5 two outside readers; D7 request
review once, ≥ 14 days later with the harness green.

## 9. Extension - findings from the second audit (Pebble terminal, `audit-adsense-thin-content`)

A parallel investigation (report under `docs/audits/2026-09-14-adsense/` on the
`audit-adsense-thin-content` branch) reached the same core diagnosis independently and added a
handful of findings. Each was re-verified here against the code and the live site before being
accepted; the verdict and what was done follow.

| Pebble finding | Verdict | Action (this branch) |
|---|---|---|
| F9 Section routes drop `index.md`; `/guides`, `/tools`, `/community` render an empty state | **Valid, duplicate of A1.** Extension: `/community`, `/database`, `/andy`, `/meta` have no `index.md`, so they were not prerendered (crawlers got the homepage fallback) and `/community`'s configured `/creators` route was never listed. | Four new `index.md` pages (300-430 words each, now prerendered and in the sitemap); `SectionPage` also lists `sections[].pages` custom routes as cards and counts them in the "index already links these" check; integrity test requires an `index.md` per configured section. |
| F10 Search index emits `/section/index` URLs; client navigation and direct load take different paths | **Valid.** `scripts/buildSearchIndex.js:92` built `/${section}/${pageId}` for the index too. | `pageUrl()` maps `index` to the section route (test pins it to the sitemap/prerender mapping); `SeoManager` looks the section entry up under its root; `PageViewerPage` redirects a stale `/section/index` link to `/section`. |
| F11 `new RegExp(query)` in `SearchResults.jsx` throws on `skills(` / `class[` | **Valid, reproduced.** Also found the global-flag `.test()` bug that skipped every other highlight. | Literal escaping + non-global matcher; 6 framework tests. |
| F12 `Google-Display-Ads-Bot` (AdSense site-verification crawler) missing from the ad-crawler list | **Valid** per Google's crawler page (answer 99376). Impact unproven (verification is the static meta tag), but classification was inconsistent. | Added to both crawler lists; `tests/utils/crawlerDetection.test.js`. |
| F7 noindex ≠ ad exclusion; loader runs on every route, Auto ads could fill utility screens | **Valid.** `AdsProvider` only gated by config/visitor; `AD_EXCLUDED_PATH_PATTERNS` omitted `/creators`, `/highscore`, `/changelog`, `/my-*`, `/build`. | Loader withheld on excluded routes and `adsbygoogle.pauseAdRequests` toggled on client navigation onto one; exclusion list extended; shared `usePathname` hook; tests. Auto ads page exclusions in the dashboard remain yours (D8). |
| F4 `stages-1361-1660` repeats the same "no figures" paragraph under 15 headings | **Valid.** 742 → 292 prose words once the repetition is removed - the page is honest and short rather than padded. | Generator emits unverified chapters in the summary table only (a heading only for chapters with real area structure); notice reworded; generator now compares line-ending-normalised content so Windows checkouts do not bump `date:` on unchanged pages. |
| F5 Coverage/synchronisation claims exceed the pipeline (2,000 stages; "fix once, fixes everywhere"; in-game verification of every number) | **Valid as wording.** The tools do read the data files, but the reference tables are hand-written from them. | Reworded on the homepage, About (three passages), Core Mechanics; the stage-data limit (verified to 1,376, named to 1,660) is now stated where coverage is claimed. |
| F13 Privacy policy over-promises what declining consent does | **Valid.** "You will still see ads, but they will be non-personalised" is broader than Google's limited-ads behaviour. | Reworded to describe limited/non-personalised ads and defer to the consent message. Verifying the actual CMP configuration is yours (D9). |
| Comments: links are `noopener noreferrer` but not qualified as UGC | **Valid** per Google's outbound-link guidance. | `rel="ugc nofollow noopener noreferrer"` on comment-body links and commenter profile links. Comment moderation/reporting process is a policy item for you (D10). |
| F8 Emoticon gallery loses its previews in crawler HTML (19 empty cells) | **Valid, low.** | Prerenderer renders `{{emoticon:...}}` as the same `<img>` the app uses (catalogue moved to `src/data/emoticons.js`, shared by the component); 5 tests. |
| F6 extras: `/my-familiars`, `/build`, `/characters` fall through to the homepage | **Valid.** | Added to the utility stubs (`/characters` canonical → `/character`). |
| F1/F2/F3, `www` 404, editor/history exposure, robots grouping, Search Console mapping | **Valid, already covered** by findings 1-8 / tasks A-D above. | No further action. |
| "Route registry" refactor (one declaration of purpose/indexing/ads per route) | Reasonable architecture, not required for approval. | Deferred; the integrity tests now catch the drift it was meant to prevent. |
| Sticky side-rail height / tablet width, ad density, CMP accept/reject paths, comment moderation | Valid post-approval checks, not causes of the current verdict. | Listed as D8-D10 below. |
| PageSpeed/Core Web Vitals | Not measured by either audit (API quota). | Optional D11: run Lighthouse on 3 pages after deploy. |

Additional operations items from the extension:

| # | Action | When |
|---|---|---|
| D8 | AdSense → Ads → By site → edit `slayerlegend.wiki`: after approval, add page exclusions for `/search`, `/profile`, `/my-*`, `/donate`, `/highscore`, `/changelog`, `/creators`, `/*/edit`, `/*/history`, `/*/new` so Auto ads match the code's exclusion list. | after approval |
| D9 | AdSense → Privacy & messaging: publish the GDPR message; test accept, reject and change-choice paths in an EEA locale and confirm the privacy policy wording matches. | before serving |
| D10 | Decide the comment moderation process (who reviews `wiki-comments` threads, how a reader reports one) and note it on the Guidelines page. | before serving |
| D11 | Lighthouse on `/`, one content page, one stage page (mobile + desktop). | after deploy |

## 10. Risks

- **Framework change cadence:** A1-A5 land in GithubWiki first; the parent pointer bump must follow
  or the delivery PR ships against the old `SectionPage`. The harness catches this (G1 fails).
- **Ad injection on section pages:** once A1 renders index prose through `PageViewer`, the content
  processor will inject ad markers there too when the prose exceeds the thresholds. That is
  acceptable (they become content pages), but confirm no ad is placed above the card list on short
  index pages (`minWordsBeforeFirstAd`).
- **Review cadence:** AdSense deactivates "Request review" after repeated recent rejections. Do not
  resubmit until every gate is green and the 14-day window has passed; one more premature attempt
  could cost weeks.
- **Cloudflare managed robots.txt:** it prepends its own `*` group with `Allow: /` and `Content-Signal`.
  Google merges same-agent groups, so B1's single `*` group still applies; verify with the tester.
