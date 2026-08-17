/**
 * Tests for the jsDelivr → raw.githubusercontent.com CDN fallback
 */

import { describe, it, expect, vi } from 'vitest';

// Stub the logger so this test doesn't pull framework/browser code into a node environment
vi.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const { jsdelivrToRaw, setImageSrcWithCdnFallback } = await import('../../src/utils/cdnFallback.js');

describe('jsdelivrToRaw', () => {
  it('converts a jsDelivr GitHub URL to its raw equivalent', () => {
    expect(
      jsdelivrToRaw('https://cdn.jsdelivr.net/gh/BenDol/SlayerLegendCDN@main/game-assets/images/equipment/soul-weapons/SoulGem_5_1.png')
    ).toBe(
      'https://raw.githubusercontent.com/BenDol/SlayerLegendCDN/main/game-assets/images/equipment/soul-weapons/SoulGem_5_1.png'
    );
  });

  it('preserves non-main branch refs', () => {
    expect(
      jsdelivrToRaw('https://cdn.jsdelivr.net/gh/owner/repo@v1.2.3/path/file.json')
    ).toBe('https://raw.githubusercontent.com/owner/repo/v1.2.3/path/file.json');
  });

  it('returns null for raw.githubusercontent.com URLs (no retry loop)', () => {
    expect(
      jsdelivrToRaw('https://raw.githubusercontent.com/BenDol/SlayerLegendCDN/main/game-assets/images/icon.png')
    ).toBeNull();
  });

  it('returns null for non-GitHub jsDelivr URLs', () => {
    expect(jsdelivrToRaw('https://cdn.jsdelivr.net/npm/react@18.2.0/index.js')).toBeNull();
  });

  it('returns null for relative paths and empty input', () => {
    expect(jsdelivrToRaw('/images/content/icons/fire.png')).toBeNull();
    expect(jsdelivrToRaw('')).toBeNull();
    expect(jsdelivrToRaw(null)).toBeNull();
    expect(jsdelivrToRaw(undefined)).toBeNull();
  });
});

describe('setImageSrcWithCdnFallback', () => {
  const JSDELIVR_URL = 'https://cdn.jsdelivr.net/gh/BenDol/SlayerLegendCDN@main/game-assets/images/a.png';
  const RAW_URL = 'https://raw.githubusercontent.com/BenDol/SlayerLegendCDN/main/game-assets/images/a.png';

  it('sets the primary URL immediately', () => {
    const img = { onerror: null, src: '' };
    setImageSrcWithCdnFallback(img, JSDELIVR_URL);
    expect(img.src).toBe(JSDELIVR_URL);
  });

  it('retries via raw on first failure without invoking the caller handler', () => {
    const callerOnError = vi.fn();
    const img = { onerror: callerOnError, src: '' };

    setImageSrcWithCdnFallback(img, JSDELIVR_URL);
    img.onerror(); // simulate jsDelivr failure

    expect(img.src).toBe(RAW_URL);
    expect(callerOnError).not.toHaveBeenCalled();
  });

  it('restores the caller handler so a raw failure reaches it', () => {
    const callerOnError = vi.fn();
    const img = { onerror: callerOnError, src: '' };

    setImageSrcWithCdnFallback(img, JSDELIVR_URL);
    img.onerror(); // jsDelivr failed → retried via raw
    expect(img.onerror).toBe(callerOnError);

    img.onerror(); // raw failed too
    expect(callerOnError).toHaveBeenCalledTimes(1);
  });

  it('leaves non-jsDelivr URLs untouched', () => {
    const callerOnError = vi.fn();
    const img = { onerror: callerOnError, src: '' };

    setImageSrcWithCdnFallback(img, RAW_URL);

    expect(img.src).toBe(RAW_URL);
    expect(img.onerror).toBe(callerOnError);
  });
});
