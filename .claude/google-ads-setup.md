# Google AdSense Setup & Targeting Guide

How ads work on this wiki: what the code does, what you have to do in the AdSense
dashboard, and what can (and can't) be controlled about *which* ads show up.

---

## 1. Turning ads on

Everything is off until a publisher ID is filled in. Three steps:

1. **Get approved for AdSense** at <https://adsense.google.com> and add `slayerlegend.wiki` as a site.
2. **Create four ad units** in AdSense → *Ads* → *By ad unit*, and copy each unit's slot ID
   (the 10-digit `data-ad-slot` number):

   | Create this unit type | Name it | Goes into config as |
   |---|---|---|
   | Display ad (responsive) | `wiki-content-top` | `contentTop` |
   | In-article ad | `wiki-in-article` | `inArticle` |
   | Multiplex ad | `wiki-content-bottom` | `contentBottom` |
   | Display ad (responsive) | `wiki-tool-top` | `toolTop` |
   | Display ad (**fixed 160x600**, not responsive) | `wiki-side-rail` | `sideRail` |

3. **Fill in the root `wiki-config.json`** (never `public/wiki-config.json`):

```json
"ads": {
  "enabled": true,
  "adsense": {
    "client": "ca-pub-XXXXXXXXXXXXXXXX",
    "slots": {
      "contentTop": "1234567890",
      "inArticle": "2345678901",
      "contentBottom": "3456789012",
      "toolTop": "4567890123",
      "sideRail": "5678901234"
    }
  }
}
```

`public/ads.txt` is generated automatically from `adsense.client` on every build
(`scripts/generateAdsTxt.js`). Without it, programmatic buyers treat the inventory as
unauthorised and bid less - so don't hand-edit or delete it.

To preview ads locally, set `"showInDevelopment": true`. Never leave that on in a commit -
clicking your own ads on localhost is still invalid traffic.

---

## 2. Where the ads actually appear

**The homepage** (`/`) is a markdown-driven custom home page (`public/content/home.md`,
enabled via `features.customHomePage`) with one hand-placed `{{AD:contentTop}}` unit after
the intro copy - so the first pageview of a session carries an ad. Pages containing
hand-placed `{{AD:...}}` markers are skipped by automatic injection entirely.

**Wiki article pages** (anything rendered from markdown) get ads injected automatically -
no `{{AD:...}}` markers needed in the content:

| Position | Format | Rule |
|---|---|---|
| After the intro, before an `##` heading | Responsive display | Only after ≥120 words read |
| Mid-article, before a later `##` heading | Native in-article | Only after ≥350 more words |
| End of the article | Multiplex (native grid) | Long pages only |

That's **3 in-page units on a long guide, 0 on a short stub.** Pages under 250 words get
nothing at all. Injection is driven by *words read*, not line count, so a page never gets
two ads stacked near each other.

**Tool pages** (skill builder, spirit builder, familiar builder, battle loadouts, soul
weapon engraving, skill stones) get **one** responsive banner above the tool. They're
app-like rather than article-like, so in-content injection doesn't apply.

**Never shown on:** the page editor and its live preview, page history, search results,
`/donate`, profiles, admin, dev tools, 404, maintenance.

**Never shown to:** crawlers (they index content, not ad shells), donators (see below), or
anyone in local dev.

Tune all of this in `wiki-config.json` under `features.ads.placement`:

| Key | Default | Effect |
|---|---|---|
| `minWords` | 250 | Pages shorter than this get no ads |
| `minWordsBeforeFirstAd` | 120 | How much is read before ad #1 |
| `minWordsBetweenAds` | 350 | Spacing between in-body ads |
| `maxInArticleAds` | 2 | Cap on injected in-body ads |
| `contentBottomAd` | true | Trailing multiplex grid |

**Resist the urge to raise `maxInArticleAds`.** Past ~3-4 units per page, RPM usually goes
*down*: more units dilute the auction, hurt viewability, slow the page (Core Web Vitals →
lower search ranking → less traffic), and push readers toward ad blockers.

---

## 3. Enable the overlay formats in the dashboard

Anchor, side rail and vignette ads **cannot be hand-coded** - they only come from Auto ads,
which is why there's no component for them. The loader script this project already injects
is all the code they need. Turn them on at AdSense → *Ads* → *By site* → edit
`slayerlegend.wiki`:

| Setting | Recommendation | Why |
|---|---|---|
| **Anchor ads** | ✅ On | Sticky, dismissible, highest viewability of any format. The single best RPM addition. Mostly mobile - which is where a mobile-game audience lives. |
| **Side rails** | ❌ Off | Replaced by the manual sticky rail in the page aside (`sideRail` slot, `<SideRailAd>`), which reaches all ≥1280px desktops instead of only ultra-wide monitors and reports under its own slot ID. Never run both - wide screens would get double side ads. |
| **Vignette ads** | ⚠️ Start off | Full-screen between pageviews. Highest RPM, highest bounce risk. Google [expanded the triggers in Feb 2026](https://www.adwaitx.com/google-adsense-vignette-ad-triggers-2026/), so they fire more than they used to. Turn on later and compare sessions/user + total revenue over 2 weeks. |
| **In-page / banner** | ❌ Off | This project places in-page units manually. Leaving Auto ads on for these means Google adds *more* on top of ours. |
| **Multiplex** | ❌ Off | Same reason - the trailing grid is already placed manually. |
| **Ad load slider** | ~50-60% | The slider only affects Auto ads placements. Middle keeps overlays present without stacking. |

Net result per long article on desktop: **up to 3 manual in-page units + the sticky
side rail in the aside + 1 anchor.** That is the "noticeable but not spammy" band.

---

## 4. Getting mobile-game advertisers (the targeting question)

**The thing to know up front: no publisher - on AdSense or any other network - can say
"only show me mobile game ads."** There is no vertical whitelist. Ads are chosen by an
auction using three signals, and you influence them indirectly:

### a) Contextual targeting - what you have the most control over

Google's crawler (`Mediapartners-Google`) reads each page and matches ads to its content.
For this site that's already ideal: every page is about a mobile idle RPG, so game
advertisers match on it naturally.

Two things were fixed to protect this:

- `public/robots.txt` now explicitly allows `Mediapartners-Google`, `AdsBot-Google` and
  `AdsBot-Google-Mobile`.
- `src/utils/crawlerDetection.js` was matching named bots *after* a "not a crawler"
  list containing `Chrome`/`Safari`. Modern Googlebot and Mediapartners-Google both
  advertise Chrome and Safari in their User-Agent, so they were being classified as humans
  and served the dynamically-loaded content path. Named crawlers are now matched first.

To strengthen it further: keep page titles, descriptions and headings explicit about the
game ("idle RPG", "auto battler", "gacha", "mobile game", "Slayer Legend"). The crawler
reads those. Vague titles produce vague ads.

### b) Interest-based targeting - automatic, and the biggest lever in your favour

Google matches ads to the *visitor's* profile, not just the page. Your visitors are people
who play mobile idle RPGs, so they carry mobile-gaming interest signals into every session.
This alone means a large share of served ads will be game and app-install creatives. You
don't configure it; it's why gaming-audience sites see game ads.

### c) Placement targeting - advertisers picking you

Advertisers can hand-pick sites to run on. The site enters that inventory automatically.
What makes it attractive: consistent traffic, a clear category, and a valid `ads.txt`.

### d) Blocking controls - subtraction only, and use it sparingly

AdSense → *Brand safety* → *Content* lets you block by **advertiser URL**, **general
category**, **sensitive category**, and **ad network**, per site. There is no "prioritise"
option - only blocking, which shifts spend to whatever is left.

For this audience:

- **Do not block anything game-related.** Mobile game advertisers are among the highest
  bidders in this vertical. Blocking them is the fastest way to tank RPM.
- **Consider blocking** sensitive categories that sit badly with a young player base -
  Gambling & Betting, Dating, Get Rich Quick. This is a brand/audience call, not a revenue
  optimisation; each block costs some revenue.
- **Block nothing else at first.** Broad blocking is the most common self-inflicted RPM
  wound. Run 4-6 weeks, then use the **Ad review center** to block specific bad creatives
  individually rather than whole categories.

### e) Format choice, which matters more than people expect

Mobile game advertisers buy heavily into native and app-install style creatives, because
that's what they run in-app. The **multiplex** unit at the end of articles renders as a
native grid that those creatives fit into naturally - it's usually the strongest performer
on a gaming audience after the anchor. Keep it enabled.

---

## 5. Consent (required for EU/UK traffic)

Google requires a certified CMP for EEA/UK/Switzerland visitors. Use Google's built-in one:
AdSense → *Privacy & messaging* → *European regulations* → create and publish the GDPR
message. No code needed - it's delivered by the same loader script.

While you're there, publish the **CCPA** message for California traffic too.

A privacy policy page disclosing ad cookies is an AdSense program requirement. There isn't
one on the wiki yet - worth adding before enabling ads.

---

## 6. Donators browse ad-free

`hideForDonators: true` (default) suppresses every ad for anyone with the donator badge.
This costs very little revenue (donators are a small slice of traffic) and turns the
existing donation prompt into a concrete offer - "support the wiki, browse without ads" -
which converts noticeably better than a plain ask. Consider saying so on `/donate`.

---

## 7. When to move beyond AdSense

AdSense is the right starting point - no traffic minimum, instant setup. But it is a
generalist network. Gaming-vertical networks carry direct demand from game publishers,
which is what actually delivers "mobile game advertisers" as a reliable outcome, typically
at 2-4× AdSense RPM. Rough entry requirements:

| Network | Minimum | Notes |
|---|---|---|
| [Ezoic](https://www.ezoic.com) | ~10k monthly sessions | Easiest step up; heavy automation. Reported $8-20 RPM. |
| [Nitro (NitroPay)](https://nitropay.com) | ~100k monthly visitors / 300k PV | Built for gaming sites and wikis specifically. |
| [Snigel](https://www.snigel.com) | ~100k monthly PV | Hands-on, expects publisher involvement. |
| [Venatus](https://www.venatus.com) | No published minimum | Gaming/esports specialist, strong UK demand. |
| [Playwire](https://www.playwire.com) | 500k monthly PV | Gaming-exclusive, strong video/outstream CPMs. |

Check monthly pageviews in Google Analytics. Once past ~100k, apply to Nitro and Venatus -
the placement architecture in this repo (config-driven slots in `src/config/adsConfig.js`)
means swapping networks is a component change, not a rewrite.

---

## 8. Implementation reference

| File | Role |
|---|---|
| `src/config/adsConfig.js` | Placements, formats, excluded routes, config readers |
| `src/components/ads/AdsProvider.jsx` | Loads the AdSense script; decides if ads run at all |
| `src/components/ads/AdSlot.jsx` | One ad unit - lazy load, CLS reservation, SPA-safe refill |
| `src/components/ads/ToolPageAd.jsx` | The single banner used on builder pages |
| `src/utils/adInjection.js` | Injects `{{AD:...}}` markers into markdown |
| `src/utils/gameContentRenderer.jsx` | Renders `{{AD:...}}` markers as `<AdSlot>` |
| `scripts/generateAdsTxt.js` | Writes `public/ads.txt` from the publisher ID |
| `tests/utils/adInjection.test.js` | Injection rules (spacing, caps, code fences, exclusions) |

Notes on the tricky parts, since AdSense in a React SPA has sharp edges:

- Each unit is keyed by route so navigation produces a **fresh `<ins>`** - AdSense refuses
  to refill an element it has already claimed.
- Pushes are guarded against React StrictMode's double-invoked effects, which otherwise
  throw `All ins elements in the DOM with class=adsbygoogle already have ads in them`.
- Slots reserve their height before loading, so filling an ad doesn't shift the page (CLS).
- When Google reports a slot `unfilled`, the container removes itself instead of leaving a
  blank gap. The same happens for every slot when the loader script is blocked (ad
  blockers) - no labelled empty boxes for adblock users.
- Units load ~400px before entering the viewport: good for viewability *and* page speed.
