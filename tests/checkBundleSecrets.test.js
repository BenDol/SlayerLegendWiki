/**
 * Tests for the postbuild secret guard. It is the last line of defence against
 * re-inlining a bot token into the client bundle, so it must actually fail.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, '../scripts/checkBundleSecrets.cjs');

/** Run the guard against a scan dir; returns { code, output }. */
function runGuard(dir) {
  try {
    const output = execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' });
    return { code: 0, output };
  } catch (err) {
    return { code: err.status ?? 1, output: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

describe('checkBundleSecrets guard', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-guard-'));
    fs.mkdirSync(path.join(dir, 'assets'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('exits non-zero when a GitHub token is present in the output', () => {
    // A fake, well-shaped classic PAT (ghp_ + 36 chars). Not a real secret.
    fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'const t="ghp_' + 'A'.repeat(36) + '";');
    const { code } = runGuard(dir);
    expect(code).toBe(1);
  });

  it('exits non-zero when a secret variable is inlined with a value', () => {
    fs.writeFileSync(path.join(dir, 'assets', 'env.js'), 'const e={VITE_WIKI_BOT_TOKEN:"' + 'x'.repeat(20) + '"};');
    const { code } = runGuard(dir);
    expect(code).toBe(1);
  });

  it('exits zero for a clean bundle', () => {
    fs.writeFileSync(path.join(dir, 'assets', 'clean.js'), 'const ok=true;const name="slayer-wiki-bot";');
    const { code } = runGuard(dir);
    expect(code).toBe(0);
  });

  it('exits non-zero when the scan directory does not exist', () => {
    const { code } = runGuard(path.join(dir, 'does-not-exist'));
    expect(code).toBe(1);
  });
});
