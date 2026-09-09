# Bot Token - Client-Side Exposure Audit

**Date:** 2026-09-09
**Question asked:** Can the GitHub bot be invoked or its token be leaked from the client side, letting someone drive the bot in unintended ways? The bot should only be reachable through server-side API calls.
**Scope:** the built client bundle (`dist/` + live production), the client source (`src/`, `wiki-framework/src/`, `main.jsx`), the Vite build config, the serverless handlers under `functions/` and the Netlify mirror, deploy workflows, and local env/secret hygiene.
**Method:** static read of the code paths, a scan of the local and live JS bundles for token material, a read-only GitHub `GET /user` to identify any token found, and three parallel deep audits of the serverless handlers.

---

## Conclusion (one paragraph)

The **production website does not leak the bot token** - the live bundle at `slayerlegend.wiki` contains no credential, no source map, and the legacy Netlify/GitHub-Pages targets are dead. **But there are two real ways the bot can be driven or its token obtained that match the concern:**

1. **Any locally-produced build bakes a live bot Personal Access Token into the JavaScript.** `.env.local` on the dev machine holds `VITE_WIKI_BOT_TOKEN`, and the client bot module reads `import.meta.env` dynamically, so Vite inlines the entire env - token included - into `dist/`. The token currently sitting in the local `dist/` is **live**, belongs to `slayer-wiki-bot`, and has `repo` + `workflow` scope with **no expiry**. Production escapes this only because it is built in GitHub Actions, which never sets that variable. This is one `wrangler pages deploy` (or any static host of a local `dist/`) away from full public exposure.

2. **Three server endpoints let an anonymous browser make the bot write to GitHub with no authentication.** `POST /api/github-bot` with `action` of `update-issue`, `create-comment`, or `create-comment-issue` performs a bot-authenticated write, taking the target `owner`/`repo`/`issueNumber` straight from the request body. This is a classic confused-deputy: the token never leaves the server, yet an attacker steers it. `update-issue` can rewrite the body of any issue, including the admin-list issue that the app trusts to decide who is an admin.

Both are fixable without redesigning the bot. Details and a prioritized fix list follow.

---

## FINDING 1 - Local builds inline a live bot token (Critical; production currently unaffected)

**What happens.** The client bot module resolves env vars *dynamically*:

```js
// wiki-framework/src/services/github/botService.js
const getEnv = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key];
  ...
};
```

Vite cannot tree-shake a dynamic `import.meta.env[key]` lookup, so it inlines the **whole** env object. With `VITE_WIKI_BOT_TOKEN` present in `.env.local`, every `vite build` on this machine emits, verbatim, into `dist/assets/index-*.js`:

```
VITE_WIKI_BOT_TOKEN:"ghp_FSC...redacted...U19", VITE_WIKI_BOT_USERNAME:"slayer-wiki-bot", ...
```

**Confirmed live.** A read-only `GET https://api.github.com/user` with that token returned `200 OK`, login `slayer-wiki-bot`, `X-OAuth-Scopes: repo, workflow`, no expiration header. So the token in the local `dist/` is valid and highly privileged (read/write to every repo the bot can reach, plus Actions workflows).

**Why production is safe today.**
- The live bundle (`https://slayerlegend.wiki/assets/index-*.js`) was fetched and scanned: **zero** token-like strings; `define_process_env_default={}`; the inlined `import.meta.env` contains only public values (OAuth client id, PayPal client id, reCAPTCHA site key, bot *username*).
- The production build runs in `.github/workflows/conditional-deploy.yml`, whose build step sets only public `VITE_*` vars - `VITE_WIKI_BOT_TOKEN` is never passed. `.claude/cloudflare-pages-deployment.md` explicitly forbids adding it to the dashboard.
- No production source map is served (the `.map` URL returns the SPA fallback, and the local map has `sourcesContent:0`).
- Legacy `slayerlegend-wiki.netlify.app` and `bendol.github.io/SlayerLegendWiki` both return 404 - no stale bundle is hosting the token.
- Git history: the token was never committed; `.env.local`, `.dev.vars`, and `dist/` are all gitignored and were never added.

**The gap.** Nothing prevents a local `dist/` (which contains the token) from being deployed. `npm run preview:cloudflare` builds and serves it; a manual `wrangler pages deploy dist` would publish it. The dev machine's `dist/assets/index-C74WH1KZ.js` holds the token right now.

**Impact.** If a token-bearing bundle is ever served publicly, anyone can extract the PAT and act as `slayer-wiki-bot` (create/close/edit issues and PRs, push commits, edit Actions workflows) across the bot's repos until the token is revoked.

**Fixes (do the first two now):**
1. **Rotate the `slayer-wiki-bot` PAT** - assume the value in local `dist/` is burned. Replace it with a **fine-grained** token scoped to just the wiki (and CDN) repos with only Issues/Contents/PR write, and drop the `workflow` scope unless a workflow genuinely needs it.
2. **Stop client builds from ever inlining it.** Remove `VITE_WIKI_BOT_TOKEN` from `.env.local` (the dev-only direct-API path is a convenience, not required - the dev server proxies to the real Functions). If the local direct path is kept, load the token from `.dev.vars` / a non-`VITE_` name so Vite cannot inline it.
3. **Add a build guard**: a `postbuild` check that greps `dist/` for `ghp_`/`github_pat_` and fails the build. Cheap, permanent regression protection.
4. Never run `preview:cloudflare` or `wrangler pages deploy` against a locally-built `dist/` while any secret can reach `import.meta.env`.

---

## FINDING 2 - Unauthenticated bot writes: the confused-deputy path (Critical, server-side)

This is the exact concern raised: the client cannot see the token, but it can still make the bot act.

`functions/_shared/handlers/github-bot.js` (`handleGithubBot`, from line 498) initializes Octokit with `WIKI_BOT_TOKEN` and dispatches on `action`. For three actions there is **no `Authorization` check**, and `owner`/`repo`/`issueNumber` come from the JSON body:

| action | handler | client controls | guard |
|---|---|---|---|
| `update-issue` | line 639 | `owner, repo, issueNumber, body` | size check only - **no auth, no ownership, no label check** |
| `create-comment` | line 605 | `owner, repo, issueNumber, body` | size check only - **no auth** |
| `create-comment-issue` | line 744 | `owner, repo, title, body, labels[]` | reserved-label guard (added 2026-09-09) - **but no auth, and the guard is incomplete, see below** |

**Worst case - admin takeover via `update-issue`:**
1. The repo is public, so the admin-list issue is discoverable (browse issues, or call the unauthenticated `list-issues` action).
2. `POST /api/github-bot {"action":"update-issue","owner":"BenDol","repo":"SlayerLegendWiki","issueNumber":<N>,"body":"...```json\n[{\"username\":\"attacker\",\"userId\":<id>}]\n```..."}`.
3. `admin.isAdmin()` decides admin status by reading exactly that JSON block out of the `[Admin List]` issue (`wiki-framework/src/services/github/admin.js`, `parseUserListFromIssue`). The attacker is now "admin" to the app.

A forged admin cannot add/remove admins (those server actions require the real GitHub **repo owner**, which is not forgeable), but they can reach the admin-gated actions that trust the list - e.g. **ban/unban users**. Independently, `update-issue` can blank or rewrite *any* issue: donator records, user snapshots (fabricate achievements), the build-share / user-index / email-verification index issues (data-store poisoning), or comment threads.

**The reserved-label guard added on 2026-09-09 helps but has holes.** `findReservedLabel` (line 57) blocks `create-comment-issue` from minting records with labels like `achievements`, `user-snapshot`, `highscore-cache`, `top-contributor`, `soul-weapon-grids`, the data-type labels, and prefixes `user-id:`, `data-version:`, `wiki-admin:`, `weapon-id:`. It does **not** cover the labels the admin/ban/donator records actually use:
- `wiki-admin-list` and `wiki-ban-list` - the prefix `wiki-admin:` (colon) does **not** match `wiki-admin-list` (dash).
- `donator`, `prestige-cache`, `wiki-comments`.

So `create-comment-issue` can still forge a `[Admin List]` / `[Donator]` issue with the matching label; and `update-issue`/`create-comment` have **no** guard at all.

**Why this is fixable cleanly.** Every legitimate caller already runs with a logged-in user:
- `comments.js` creates the page comment issue only from an authenticated comment submit.
- `buildShare.js` creates/updates the index issue and comments during an authenticated share.

None of them rely on the endpoint being anonymous. So requiring a verified user token on these actions will not break real flows.

**Fixes:**
1. **Require a verified user OAuth token** on `update-issue`, `create-comment`, `create-comment-issue` (resolve the caller via `GET /user`, as the achievements/link-edits actions already do).
2. **Authorize the write:** restrict `update-issue`/`create-comment` to issues the caller owns (creator, or `user-id:<callerId>` label) or to repo admins; the wiki's own comment/index issues should be updated through purpose-built server logic, not a generic "update any issue" verb.
3. **Pin `owner`/`repo` server-side** from `WIKI_REPO_OWNER`/`WIKI_REPO_NAME` (as `admin-actions.js` already does) instead of trusting the body - this alone caps the blast radius to the wiki repo.
4. **Complete the reserved-label denylist**: add `wiki-admin-list`, `wiki-ban-list`, `donator`, `prestige-cache`, `wiki-comments`, and switch the `wiki-admin:` prefix to also catch `wiki-admin`/`wiki-ban`.
5. Add per-user / per-IP rate limiting to all mutating actions (only the anonymous-PR path is throttled today, and its limiter is per-isolate in-memory).

---

## FINDING 3 - `admin-actions.js`: missing authorization + per-request token globals (High)

- **`assign-donator-badge` / `remove-donator-badge` have no admin check.** The POST block (from line ~115) authenticates the caller (`getAuthenticated()`), then the switch calls `saveDonatorStatus(...)`/`removeDonatorStatus(...)` with the bot token. There is **no `isAdmin`/`isRepositoryOwner`/permission call anywhere in the file**. `add-admin`/`ban-user` delegate their authorization into `admin.js` (which verifies repo owner/admin), but the donator cases do not - so **any authenticated GitHub user can self-assign a donator badge**. Impact is cosmetic (a badge + colour), so this is High-for-authz, not Critical, but it should be gated.
- **Per-request mutation of shared `process.env`.** Lines 57 and 65 do `process.env.GITHUB_TOKEN = token` and `process.env.WIKI_BOT_TOKEN = botToken`, cleaned up in a `finally` (266-267). `getOctokit()` reads the token from that process-global. In a Cloudflare Worker isolate serving concurrent requests these globals are shared across in-flight requests, with `await`s in between - request A can observe request B's token, and the `finally delete` can wipe a token mid-flight. **Fix:** pass the token explicitly (`new Octokit({auth})` per request); never store request tokens in `process.env`.

---

## FINDING 4 - Upload / webhook paths (from the serverless audit)

- **PayPal webhook signature is forgeable (Critical).** `functions/_shared/handlers/paypal-webhook.js` fetches the verification certificate from the attacker-supplied `paypal-cert-url` header (line 62) with no host allowlist. An attacker serves their own cert, signs their own payload, passes verification, and makes the bot grant donator status to any username (also a blind SSRF). **Fix:** require the cert host to end in `.paypal.com` over https, or use PayPal's `verify-webhook-signature` API.
- **Image upload can host HTML/JS on the CDN (High).** `functions/_shared/handlers/image-upload.js` derives the stored file extension from the client filename (line 353) and commits to CDN `main`; the magic-byte check only requires the content to *start* with image bytes. A `GIF89a...<script>` payload named `x.html` is committed and served as `text/html` from `cdn.jsdelivr.net/gh/BenDol/SlayerLegendCDN` - stored XSS / malware hosting under the project's CDN. **Fix:** derive the stored extension from the validated MIME allowlist, never the filename.
- **Production debug endpoint (Medium).** `functions/api/debug/save-network-data.js` deploys to production, is unauthenticated, and builds a filename from unsanitized client `date`/`sessionId` (path traversal). It uses no bot token and is inert on Cloudflare's read-only FS, so impact is bounded, but it should be gated to development or removed.

---

## FINDING 5 - Data endpoints (from the storage audit)

- **`grid-submission` on `POST /api/save-data` is intentionally unauthenticated** (line 75) and lets anyone make the bot create issues/labels/comments with no rate limit, and its `replace:true` path can overwrite the "primary" grid layout shown to all users. All other `save-data`/`delete-data`/`display-name`/`profile-picture` writes correctly bind the target to the caller's verified GitHub id - **no cross-user overwrite is possible there**.
- **Unauthenticated N+1 amplification.** `GET /api/display-name` and `/api/profile-picture` load the whole registry (one `getComment` per registered user) per request, so ~100 anonymous requests can exhaust the bot's 5,000/hour quota and take down every bot-backed feature. **Fix:** cache/consolidate the registry; rate-limit the anonymous read/validate paths.
- **`userId` compared with `Number()` coercion** lets `"0123"`/`"00123"` alias one identity, bypassing the display-name cooldown/ban and bloating the CDN. **Fix:** canonicalize to `String(user.id)` from the token.

---

## What was verified SAFE / clean

- **Production bundle carries no token** and no usable source map; `define_process_env_default={}`; only public `VITE_*` values are inlined.
- **Legacy hosts are dead** (Netlify + GitHub Pages both 404); no stale bundle is serving the token.
- **The token was never committed** to git; secret files are gitignored and were never tracked.
- **User-token endpoints are correct**: `check-achievements`, `check-single-achievement`, `link-anonymous-edits`, and all `save-data`/`delete-data`/`display-name`/`profile-picture` writes verify the caller against `GET /user` and act only on that identity; a random/revoked token is rejected.
- **The admin/ban/donator/highscore/prestige records are read with a bot-authorship check** - forging them requires getting the bot to author the content, which is exactly what Finding 2 must close.
- **Anonymous PR creation is well-gated** (email-JWT + reCAPTCHA + rate limit + profanity + path bounded to `public/content/...`).
- **No handler returns the bot token, env values, or stack traces** to the client; Octokit redacts `Authorization` in its error objects.
- **The dev-only direct-Octokit paths are tree-shaken out of production** (`Direct API calls are disabled in production builds` remains as dead guards; the code that reads the token does not execute client-side in prod).
- **`initializeBotOctokit()` in `main.jsx` is called with no argument** and deliberately refuses to read `import.meta.env`, so the client never constructs a bot Octokit in production.

---

## Priority order

1. **Rotate the `slayer-wiki-bot` PAT now** (assume the local-`dist/` copy is compromised); reissue as a fine-grained, repo-scoped token.
2. **Remove `VITE_WIKI_BOT_TOKEN` from `.env.local`** (or move it to a non-`VITE_` name) and add a `postbuild` secret-scan of `dist/`.
3. **Add authentication + authorization** to `update-issue`, `create-comment`, `create-comment-issue`; pin `owner`/`repo` server-side; complete the reserved-label denylist.
4. **Gate `assign-donator-badge`/`remove-donator-badge`** behind an admin check; stop writing request tokens into `process.env`.
5. **Validate the PayPal cert host**; derive upload extensions from the MIME allowlist; gate/remove the production debug endpoint.
6. Rate-limit the remaining mutating and registry-reading endpoints.
