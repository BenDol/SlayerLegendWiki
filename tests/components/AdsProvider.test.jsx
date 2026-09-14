// @vitest-environment jsdom
/**
 * AdsProvider - route gating for the loader and for Auto ads.
 *
 * On a route without publisher content (an account screen, a shared build)
 * the AdSense loader must not be injected, and if it is already on the page
 * from an eligible route, Auto ads must be paused there and resumed on the
 * next eligible route. The pause flag is shared with the consent flow, so
 * the provider only ever clears a pause it set itself.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

const mockConfig = vi.fn();
const mockPathname = vi.fn();

vi.mock('../../wiki-framework/src/hooks/useWikiConfig', () => ({
  useWikiConfig: () => ({ config: mockConfig(), loading: false, error: null }),
}));
vi.mock('../../wiki-framework/src/hooks/useDonatorStatus', () => ({
  useDonatorStatus: () => ({ isDonator: false, loading: false }),
}));
vi.mock('../../wiki-framework/src/store/authStore', () => ({
  useAuthStore: (selector) => (selector ? selector({ user: null }) : { user: null }),
}));
vi.mock('../../src/utils/crawlerDetection', () => ({
  isCrawler: () => false,
  isAdNetworkCrawler: () => false,
}));
vi.mock('../../src/hooks/usePathname', () => ({
  usePathname: () => mockPathname(),
}));

const { default: AdsProvider, useAds, areAdsRuntimeEnabled } = await import('../../src/components/ads/AdsProvider.jsx');
const { ADSENSE_SCRIPT_ID } = await import('../../src/config/adsConfig.js');

// import.meta.env.DEV is true under vitest, so the dev override must be on.
const adsConfig = {
  features: { ads: { enabled: true, showInDevelopment: true, adsense: { client: 'ca-pub-1234567890' } } },
};

let lastAds = null;
const Probe = () => {
  lastAds = useAds();
  return null;
};

const renderAt = (pathname) => {
  mockPathname.mockReturnValue(pathname);
  return render(
    <AdsProvider>
      <Probe />
    </AdsProvider>
  );
};

const loaderScript = () => document.getElementById(ADSENSE_SCRIPT_ID);

describe('AdsProvider route gating', () => {
  beforeEach(() => {
    mockConfig.mockReset().mockReturnValue(adsConfig);
    mockPathname.mockReset();
    document.head.innerHTML = '';
    delete window.adsbygoogle;
    lastAds = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('injects the loader on a content route and marks ads enabled', () => {
    renderAt('/skills/skills');
    expect(loaderScript()).not.toBeNull();
    expect(loaderScript().src).toContain('client=ca-pub-1234567890');
    expect(lastAds.adsEnabled).toBe(true);
    expect(areAdsRuntimeEnabled()).toBe(true);
    expect(window.adsbygoogle?.pauseAdRequests ?? 0).toBe(0);
  });

  it('withholds the loader and pauses Auto ads on an excluded route', () => {
    renderAt('/my-collections');
    expect(loaderScript()).toBeNull();
    expect(lastAds.adsEnabled).toBe(false);
    expect(areAdsRuntimeEnabled()).toBe(false);
    expect(window.adsbygoogle.pauseAdRequests).toBe(1);
  });

  it('resumes Auto ads when navigating from an excluded route back to content', () => {
    const view = renderAt('/build');
    expect(window.adsbygoogle.pauseAdRequests).toBe(1);

    mockPathname.mockReturnValue('/guides');
    act(() => {
      view.rerender(
        <AdsProvider>
          <Probe />
        </AdsProvider>
      );
    });
    expect(window.adsbygoogle.pauseAdRequests).toBe(0);
    expect(loaderScript()).not.toBeNull();
  });

  it('never clears a pause it did not set (the consent flow owns that one)', () => {
    window.adsbygoogle = [];
    window.adsbygoogle.pauseAdRequests = 1; // set by the consent flow before any route
    renderAt('/skills/skills');
    expect(window.adsbygoogle.pauseAdRequests).toBe(1);
  });

  it('does nothing to the queue when ads are not configured', () => {
    mockConfig.mockReturnValue({ features: {} });
    renderAt('/my-collections');
    expect(window.adsbygoogle).toBeUndefined();
    expect(loaderScript()).toBeNull();
  });
});
