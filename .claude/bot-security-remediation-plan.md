# Bot Security - Remediation Plan

**Date:** 2026-09-09
**Companion to:** `.claude/bot-token-client-exposure-audit.md` (the findings)
**Branch:** `security/bot-client-exposure-audit`

> **Status (2026-09-09, final):** every plan item that lives in this repository or the framework submodule is implemented on this branch, all suites green (parent 659/659 across 30 files; framework 256/256).
>
> **Done:** §1 env rework + `postbuild` secret guard. **Layer A (§2):** owner/repo pinned to server env; `update-issue`/`create-comment` scoped to bot-authored `build-share-index`/`wiki-comments` issues; reserved label + title denylists completed. **Layer B (§2):** framework `botService` now forwards the logged-in user's token and the dev-only client "direct API" bot path is removed; the server verifies a supplied token (401 if invalid), applies the bot-managed ban list (403), and hard-requires identity only behind `features.botSecurity.requireIdentity` (added to `wiki-config.json`, default `false` - keep it off until every caller of the three verbs is login-gated; build sharing currently is not). **P1** PayPal cert-host allowlist. **P2** image-upload extension derived from magic bytes + WebP fourCC check + fail-closed image moderation; `admin-actions` donator authorization; the per-request `process.env.GITHUB_TOKEN` mutation removed via a generic explicit-token parameter on `getOctokit`/`getAuthenticatedUser` threaded through `getCurrentUserAdminStatus` (server reads now fall back to the bot token instead of the anonymous 60/h limit). **P3** grid-submission replace requires a signed-in owner and only touches the caller's own submission (client button gated to match); display-name/profile-picture canonical `userId`; DELETE tokens moved to the `Authorization` header (clients updated; legacy query/body still accepted for one release with a deprecation warning); read-path registry caching with write invalidation; fail-closed name moderation via the local word list. **P4** OAuth `client_id` pinned to server config; `VITE_` server-side fallbacks dropped; token prefix/length logging removed.
>
> **Extra hardening (beyond the plan):** the two dynamic `import.meta.env[key]` lookups in the framework client (`botService.js`, `auth.js`) were replaced with static member reads, and the remaining client-side `VITE_WIKI_BOT_TOKEN` fallbacks in `buildShare.js` / `donatorRegistry.js` were removed - a dynamic index forces Vite to inline the *entire* env object, which is the mechanism that carried the token into the bundle. (Bare `import.meta.env` references still exist in framework utilities such as `apiEndpoints.js`, so the env object is still emitted; the build guard remains the enforced control.)
>
> **Debug endpoint (P3):** verified **untracked** - never committed, never deployed - so no repository change is warranted; do not add it to the branch. **Deferred by design:** durable per-user/IP rate limiting needs a KV binding (none is configured); the in-memory limiter was not extended because it would be misleading. **Owner:** rotate the token (§0) after merge.

This plan fixes every issue from the audit. It is ordered so the highest-severity,
lowest-risk, non-breaking changes land first. Each item says **where** it lives
(parent repo `functions/...` - editable here; or **framework** `wiki-framework/...` -
a separate coordinated PR, never edited from the parent) and whether it is
**breaking**.

---

## 0. Token rotation (owner does this - AFTER the code fixes land)

The `slayer-wiki-bot` PAT currently baked into the local `dist/` is compromised and
must be rotated. Per your instruction this is the last step, once the fixes below
are merged. When you rotate:
- Issue a **fine-grained** PAT scoped to only the wiki (and CDN) repos, with
  **Issues + Contents + Pull requests: Read and write**. Drop the `workflow`
  scope unless a workflow genuinely needs it (the current token has it).
- Update `WIKI_BOT_TOKEN` in: `.dev.vars` (local), the GitHub Actions secret, and
  the Cloudflare Pages secret. If `CDN_REPO_TOKEN` is the same value, rotate it too.
- Delete the old token on GitHub.

---

## 1. DONE this turn (parent repo, non-breaking)

These are implemented on this branch - the two items you delegated, plus the guard
that keeps them enforced.

1. **`.env.local` reworked** (local file, not tracked): `VITE_WIKI_BOT_TOKEN`
   removed; the server-side `WIKI_BOT_TOKEN` retained; a comment explains why a
   `VITE_`-prefixed bot token must never come back. Dev still works: the default
   `npm run dev` runs Wrangler, and the client's dev "direct API" path simply
   falls back to the Functions proxy, which reads `WIKI_BOT_TOKEN` from `.dev.vars`.
   *(The client direct-call path lives in the framework and is a dev-only
   convenience; removing the token is enough - no framework change needed to close
   the leak.)*
2. **`.env.example` updated**: the `VITE_WIKI_BOT_TOKEN` line is gone, replaced with
   a prominent "server-only, never `VITE_`" security block and fine-grained-token
   setup instructions.
3. **Build guard added**: `scripts/checkBundleSecrets.cjs` scans `dist/` for GitHub
   token material and inlined secret variables and **fails the build** if any are
   found (value masked in its output). Wired into `postbuild`, `postbuild:netlify`,
   and `postbuild:cloudflare`, so it runs after every `vite build` including CI and
   `preview:cloudflare`. Tested: fails on a token, passes on a clean bundle.

**Verification once merged:** a local `npm run build` must (a) succeed and (b) print
`[checkBundleSecrets] OK`. Confirm the live bundle stays clean (it already is).

---

## 2. AUTH-MODEL DECISION for the unprotected bot actions

**The actions:** `create-comment`, `update-issue`, `create-comment-issue` in
`functions/_shared/handlers/github-bot.js` (dispatch at ~line 528; handlers at
605 / 639 / 744). Today they take no `Authorization` and read `owner`/`repo`/
`issueNumber` from the request body.

**Key insight:** authentication alone does not fix this. The real defect is
*arbitrary target + arbitrary content with a privileged token* - even a logged-in
user must not be able to rewrite the admin-list issue. So the chosen model is
**"pin the target, then prove the identity"** - capability-scoping first,
authentication second - applied in two layers.

### Decision: layered "capability-scoped + authenticated" model

**Layer A - capability hardening (server-only, parent repo, NON-BREAKING). Ship first.**
This alone eliminates the Critical admin-takeover and the cross-repo blast radius,
with zero client changes, because it only *narrows* what the existing calls may do
and every legitimate call already stays inside the narrowed set.

- **A1. Pin `owner`/`repo` from server env** (`WIKI_REPO_OWNER` / `WIKI_REPO_NAME`,
  with the `VITE_`-prefixed fallbacks already used elsewhere). Ignore body values.
  Caps every bot write to the wiki repo. Do this for all bot actions, matching what
  `admin-actions.js` already does.
- **A2. Constrain `update-issue` and `create-comment` to managed issues.** Before
  writing, fetch the target issue and require **both**: author `== WIKI_BOT_USERNAME`
  **and** at least one label in a `MANAGED_ISSUE_LABELS` allowlist =
  `{ build-share-index, wiki-comments }` (the only issues these verbs legitimately
  touch - verified against `buildShare.js` and `comments.js`). Anything else → 403.
  This closes the admin-list / donator / snapshot rewrite path.
- **A3. Complete the `create-comment-issue` guards.** The reserved-**label** denylist
  (`findReservedLabel`, line 57) is missing the labels the trusted records actually
  use - add `wiki-admin-list`, `wiki-ban-list`, `donator`, `prestige-cache`
  (and broaden the `wiki-admin:` prefix to also catch `wiki-admin`/`wiki-ban`). Add a
  reserved-**title** denylist too (`[Admin List]`, `[Banned Users]`, `[Donator]`,
  `[User Snapshot]`, `[Achievements]`, `[Top Contributor]`, highscore/prestige
  caches), so a record cannot be forged by title even with a permitted label.
- **A4. Do not weaken the create path for real containers.** `build-share-index` and
  `wiki-comments` must remain creatable - they are not in the denylist, keep it so.

**Layer B - identity + abuse control (needs a coordinated FRAMEWORK change). Ship second.**
Adds "who" on top of "what," to stop griefing/spam of the managed issues (e.g. an
anonymous client rewriting the shared build-share index map, or mass-creating
comment containers).

- **B1. Require a caller identity** on the three actions: a verified GitHub user
  token (Bearer → `octokit.rest.users.getAuthenticated()`, the exact pattern
  `check-achievements` uses at line 2119+) **or**, for flows that must work without a
  GitHub login, a valid anonymous email-JWT (the same token `create-anonymous-pr`
  already verifies via `functions/_shared/jwt.js`). Reject otherwise.
- **B2. Ban check + rate limit.** Reuse the ban list for identified users; add a
  per-user / per-IP throttle backed by KV (`SLAYER_WIKI_DATA`), not the current
  per-isolate in-memory map.
- **B3. FRAMEWORK change (separate PR against `BenDol/GithubWiki`):** the helpers
  `createCommentIssueWithBot`, `createCommentOnIssueWithBot`, `updateIssueWithBot`
  (`wiki-framework/src/services/github/botService.js`, lines 135 / 531 / 606) must
  forward the logged-in user's token. `callBotService` already sends
  `Authorization: Bearer` when given a token (line 657); these three helpers just
  need to pass `getToken()` through. Comments already require login to submit
  (`Comments.jsx`), so this does not regress UX.

**Rollout / non-breaking guarantee:** Layer A ships now in the parent repo and is
safe because it only removes illegitimate capability. Layer B's server enforcement
is gated so it does not 401 real users before the framework helpers ship the token:
enforce identity only when a token is present until the framework PR is released,
then flip to required (a one-line config/flag flip). This avoids a
parent/framework release-ordering break.

**Why not "just require auth on the endpoint":** it would (a) still allow any
logged-in user to rewrite the admin issue (no target scoping), and (b) instantly
break comments and build-share in production, because the framework client does not
send a token yet. The layered model fixes the worst issue immediately and safely.

---

## 3. Remaining server fixes (parent repo unless noted)

Prioritized; each is independent of the others.

### P1 - Critical

- **PayPal webhook signature forgery** - `functions/_shared/handlers/paypal-webhook.js`
  fetches the verification cert from the attacker-supplied `paypal-cert-url` header
  (line 62) with no host check. **Fix:** before fetching, require
  `new URL(certUrl).protocol === 'https:'` and the hostname to end in `.paypal.com`
  (and `...paypalobjects.com` if PayPal serves certs there); reject otherwise. Prefer
  migrating to PayPal's `/v1/notifications/verify-webhook-signature` API with
  server API credentials. Also confirm `PAYPAL_SKIP_SIGNATURE_VERIFICATION` is unset
  in prod (line 266) and gate the handler on the donation feature flag.

### P2 - High

- **Image upload can host HTML/JS on the CDN** - `functions/_shared/handlers/image-upload.js`
  derives the stored extension from the client filename (line 353) and commits to
  CDN `main`. **Fix:** derive the extension from the server-validated MIME/magic-byte
  result against the `allowedFormats` allowlist; reject anything else; never trust the
  filename. Strengthen the WebP magic-byte check to verify `WEBP` at offset 8, not
  just `RIFF`.
- **`admin-actions.js` missing authorization on donator badges** - the POST switch
  authenticates the caller but there is **no** `isAdmin`/owner check before
  `assign-donator-badge` / `remove-donator-badge` (lines ~179-250), so any logged-in
  user can self-grant a badge. **Fix:** gate both behind `isAdmin(currentUsername, ...)`
  / repo-owner, exactly as `add-admin`/`ban-user` are.
- **`admin-actions.js` mutates shared `process.env`** - sets
  `process.env.GITHUB_TOKEN` / `WIKI_BOT_TOKEN` per request (lines 57, 65; cleared in
  `finally` 266-267). In a shared Worker isolate this leaks tokens across concurrent
  requests. **Fix:** pass the token explicitly (`new Octokit({ auth })` per request,
  or `getOctokit(token)`); never write request tokens to `process.env`. Requires a
  small change so the admin.js callee accepts an explicit octokit/token instead of
  reading the global - verify whether that call site is framework or parent before
  implementing.

### P3 - Medium

- **Production debug endpoint** - `functions/api/debug/save-network-data.js` deploys
  to prod, is unauthenticated, and builds a filename from unsanitized client input.
  **Fix:** gate on `NODE_ENV==='development'` (return 404 otherwise) or remove it from
  `functions/api/`; sanitize `sessionId`/`date` to `[A-Za-z0-9_-]`.
- **`grid-submission` is unauthenticated & unthrottled** - `save-data.js:75` skips
  auth for grid submissions and its `replace:true` path can overwrite the primary
  layout. **Fix:** require a verified token (bind `userId`), restrict overwrite to the
  original submitter or an admin, validate `weaponId`/`id`, add rate limiting.
- **Unauthenticated N+1 amplification** - `display-name.js` and `profile-picture.js`
  load the whole registry (one `getComment` per user) on every anonymous GET/validate.
  **Fix:** cache/consolidate the registry and rate-limit the anonymous paths.
- **`userId` `Number()` coercion aliasing** - canonicalize to `String(user.id)` from
  the verified token for all registry keys and file paths; reject `userId` not equal
  to the token's own id.

### P4 - Low / hygiene

- Move Bearer tokens out of query strings (`display-name.js:129`,
  `profile-picture.js:271`) into the `Authorization` header.
- Fail **closed** on moderation errors (display name + image), instead of allowing.
- Drop the `VITE_WIKI_BOT_TOKEN` server-side fallback reads in
  `image-upload.js`/`image-upload-request.js` (`getEnv('WIKI_BOT_TOKEN') ||
  getEnv('VITE_WIKI_BOT_TOKEN')`) - server should only read the non-`VITE_` name.
- Pin `client_id` in the OAuth device-flow proxy to the server's configured app.
- Stop logging user token prefix/length.

---

## 4. Framework-repo (`BenDol/GithubWiki`) coordination items

These cannot be done from the parent repo and need a separate PR:
- **B3 above:** forward the user token from the three `botService.js` helpers.
- **Optional hardening:** remove the dev-only client "direct API" bot path entirely
  (`createIssueDirectly` etc.) so a bot token can never be read from `import.meta.env`
  even in dev - belt-and-suspenders on top of the `.env.local` fix.

---

## 5. Suggested landing order

1. **Now (this branch):** Section 1 (done) + Layer A (§2) + P1 PayPal + P2 admin-actions
   authz - all parent-repo, the highest severity, all non-breaking.
2. **Next:** P2 image extension, P3 items.
3. **Framework PR:** B3 helper token forwarding; then flip Layer B enforcement to
   required and add ban/rate-limit (§2 Layer B).
4. **Owner:** rotate the token (§0) once the above is merged.
