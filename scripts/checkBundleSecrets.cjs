#!/usr/bin/env node
/**
 * Build guard: fail the build if any secret material reached the client bundle.
 *
 * Vite inlines every `VITE_`-prefixed environment variable into `dist/`. If a
 * secret is ever given a `VITE_` name (e.g. `VITE_WIKI_BOT_TOKEN`), the bot
 * token would be published to every visitor. This script scans the built output
 * for GitHub token material and for known secret variable names, and exits
 * non-zero so the token can never ship silently.
 *
 * Wired into every `postbuild*` script, so it runs after `vite build` on all
 * paths (local, CI, `preview:cloudflare`). Zero dependencies (runs before
 * anything is installed beyond Node).
 */

const fs = require('fs');
const path = require('path');

// Scan `dist/` by default; a path argument (used by the test suite) overrides it.
const DIST_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..', 'dist');

// File extensions worth scanning. The bundle is JS, but a secret could also
// land in HTML, JSON, source maps, or CSS, so scan all text-ish output.
const SCAN_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.html', '.json', '.map', '.css', '.txt', '.xml',
]);

// Skip files that are expected to be huge and are not code (none today, but
// keeps the guard fast if large data assets are ever emitted into dist).
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Secret patterns. Each has a label and a RegExp. The RegExp must be global so
 * we can count and de-duplicate matches. We never print the matched value.
 */
const SECRET_PATTERNS = [
  { label: 'GitHub PAT (classic ghp_)', re: /ghp_[A-Za-z0-9]{36}/g },
  { label: 'GitHub OAuth token (gho_)', re: /gho_[A-Za-z0-9]{36}/g },
  { label: 'GitHub user-to-server token (ghu_)', re: /ghu_[A-Za-z0-9]{36}/g },
  { label: 'GitHub server-to-server token (ghs_)', re: /ghs_[A-Za-z0-9]{36}/g },
  { label: 'GitHub refresh token (ghr_)', re: /ghr_[A-Za-z0-9]{36}/g },
  { label: 'GitHub fine-grained PAT (github_pat_)', re: /github_pat_[A-Za-z0-9_]{22,}/g },
  // Any secret env var that was inlined with an actual value assigned to it.
  // Matches e.g.  VITE_WIKI_BOT_TOKEN:"..."  or  WIKI_BOT_TOKEN="..."
  // A value of "" (empty) or an undefined reference does not match.
  {
    label: 'inlined secret variable',
    re: /\b(?:VITE_)?(?:WIKI_BOT_TOKEN|CDN_REPO_TOKEN|SENDGRID_API_KEY|OPENAI_API_KEY|PAYPAL_SECRET|EMAIL_VERIFICATION_SECRET|RECAPTCHA_SECRET_KEY|EMAIL_VALIDATION_API_KEY|GITHUB_TOKEN)\b\s*[:=]\s*["'][^"']+["']/g,
  },
  // Value-shaped patterns for the non-GitHub providers in .env.example, since a
  // secret inlined as a bare `import.meta.env.VITE_X` literal carries no variable
  // name in the output.
  { label: 'SendGrid API key (SG.)', re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g },
  { label: 'OpenAI API key (sk-)', re: /\bsk-[A-Za-z0-9_-]{20,}/g },
];

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

/** Mask a matched secret so the guard's own output never leaks it. */
function mask(sample) {
  const s = String(sample);
  if (s.length <= 10) return `${s.slice(0, 2)}***`;
  return `${s.slice(0, 6)}***${s.slice(-2)} (len ${s.length})`;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    // Fail closed: a missing/renamed output dir must not read as a clean scan,
    // or a misconfigured build silently disables the guard.
    console.error(`[checkBundleSecrets] dist/ directory not found at ${DIST_DIR}; refusing to pass.`);
    process.exit(1);
  }

  const files = walk(DIST_DIR);
  const findings = [];

  for (const file of files) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    if (stat.size > MAX_FILE_BYTES) continue;

    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const { label, re } of SECRET_PATTERNS) {
      re.lastIndex = 0;
      // Cheap presence test first; only materialise the match array on a hit.
      if (!re.test(content)) continue;
      re.lastIndex = 0;
      const matches = content.match(re);
      if (matches && matches.length > 0) {
        const unique = [...new Set(matches)];
        findings.push({
          file: path.relative(path.resolve(__dirname, '..'), file),
          label,
          count: matches.length,
          sample: mask(unique[0]),
        });
      }
    }
  }

  if (findings.length === 0) {
    console.log(`[checkBundleSecrets] OK - scanned ${files.length} file(s) in dist/, no secret material found.`);
    return;
  }

  console.error('\n[checkBundleSecrets] SECURITY: secret material found in the build output.\n');
  for (const f of findings) {
    console.error(`  ✘ ${f.file}`);
    console.error(`      ${f.label} - ${f.count} occurrence(s), e.g. ${f.sample}`);
  }
  console.error('\nThe client bundle must never contain a token. Most likely a secret was');
  console.error('given a VITE_ prefix (Vite inlines those into dist/). Remove it from the');
  console.error('client env, keep the token server-side (.dev.vars / platform secret named');
  console.error('WIKI_BOT_TOKEN), and rebuild. See .claude/bot-security-remediation-plan.md.\n');
  process.exit(1);
}

main();
