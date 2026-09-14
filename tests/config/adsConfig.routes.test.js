import { describe, it, expect } from 'vitest';
import { isAdAllowedPath, setAdRequestsPaused } from '../../src/config/adsConfig.js';

describe('isAdAllowedPath', () => {
  it.each([
    '/',
    '/getting-started',
    '/getting-started/first-steps',
    '/stages/stages-1-200',
    '/skill-builder',
    '/spirits/viewer',
    '/meta/about',
    '/community',
  ])('allows publisher-content route %s', (path) => {
    expect(isAdAllowedPath(path)).toBe(true);
  });

  it.each([
    '/getting-started/first-steps/edit',
    '/getting-started/first-steps/history',
    '/skills/new',
    '/search',
    '/search?q=x',
    '/meta/privacy-policy',
    '/donate',
    '/donation-success',
    '/profile',
    '/profile/someone',
    '/admin',
    '/dev-tools',
    '/debug/network',
    '/404',
    '/my-collections',
    '/my-spirits',
    '/my-familiars',
    '/my-edits',
    '/build',
    '/highscore',
    '/changelog',
    '/creators',
    '/creators/',
  ])('excludes app/utility screen %s', (path) => {
    expect(isAdAllowedPath(path)).toBe(false);
  });

  it('does not over-match content routes that merely share a prefix', () => {
    expect(isAdAllowedPath('/builds-guide')).toBe(true);
    expect(isAdAllowedPath('/my')).toBe(true);
    expect(isAdAllowedPath('/skills/skill-refinement')).toBe(true);
  });

  it('rejects an empty path', () => {
    expect(isAdAllowedPath('')).toBe(false);
    expect(isAdAllowedPath(undefined)).toBe(false);
  });
});

describe('setAdRequestsPaused', () => {
  it('creates the adsbygoogle queue and sets the pause flag', () => {
    const win = {};
    expect(setAdRequestsPaused(win, true)).toBe(true);
    expect(Array.isArray(win.adsbygoogle)).toBe(true);
    expect(win.adsbygoogle.pauseAdRequests).toBe(1);
  });

  it('resumes on an existing queue without dropping queued pushes', () => {
    const win = { adsbygoogle: [{ pushed: true }] };
    win.adsbygoogle.pauseAdRequests = 1;
    setAdRequestsPaused(win, false);
    expect(win.adsbygoogle.pauseAdRequests).toBe(0);
    expect(win.adsbygoogle).toHaveLength(1);
  });

  it('is a no-op without a window', () => {
    expect(setAdRequestsPaused(null, true)).toBe(false);
  });
});
