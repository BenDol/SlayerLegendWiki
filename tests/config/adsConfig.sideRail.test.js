import { describe, it, expect } from 'vitest';
import {
  AD_FORMAT,
  AD_PLACEMENT,
  AD_PLACEMENT_FORMAT,
  AD_RESERVED_HEIGHT,
  SKYSCRAPER_HEIGHT,
  SKYSCRAPER_WIDTH,
  getAdSlotId,
  isAdAllowedPath,
} from '../../src/config/adsConfig.js';

/**
 * Coverage for the sideRail placement (sticky skyscraper in the page aside) and
 * the config invariants every placement must satisfy for AdSlot to render safely.
 */
describe('adsConfig - sideRail placement', () => {
  it('exposes the sideRail placement mapped to the fixed skyscraper format', () => {
    expect(AD_PLACEMENT.SIDE_RAIL).toBe('sideRail');
    expect(AD_PLACEMENT_FORMAT[AD_PLACEMENT.SIDE_RAIL]).toBe(AD_FORMAT.SKYSCRAPER);
  });

  it('uses standard IAB 160x600 skyscraper dimensions', () => {
    expect(SKYSCRAPER_WIDTH).toBe(160);
    expect(SKYSCRAPER_HEIGHT).toBe(600);
    expect(AD_RESERVED_HEIGHT[AD_FORMAT.SKYSCRAPER]).toBe(SKYSCRAPER_HEIGHT);
  });

  it('maps every placement to a format with a reserved height (CLS guarantee)', () => {
    for (const placement of Object.values(AD_PLACEMENT)) {
      const format = AD_PLACEMENT_FORMAT[placement];
      expect(format, `placement ${placement} has no format`).toBeTruthy();
      expect(
        AD_RESERVED_HEIGHT[format],
        `format ${format} has no reserved height`
      ).toBeGreaterThan(0);
    }
  });

  it('reads the sideRail slot ID from wiki-config and treats blank as unconfigured', () => {
    const configured = { features: { ads: { adsense: { slots: { sideRail: ' 123456 ' } } } } };
    const unconfigured = { features: { ads: { adsense: { slots: { sideRail: '' } } } } };

    expect(getAdSlotId(AD_PLACEMENT.SIDE_RAIL, configured)).toBe('123456');
    expect(getAdSlotId(AD_PLACEMENT.SIDE_RAIL, unconfigured)).toBe('');
    expect(getAdSlotId(AD_PLACEMENT.SIDE_RAIL, {})).toBe('');
  });

  it('keeps the route exclusions intact for the aside unit', () => {
    // The side rail renders through AdSlot, which enforces these - a regression
    // here would put a sticky ad on the editor or the privacy policy.
    expect(isAdAllowedPath('/meta/privacy-policy')).toBe(false);
    expect(isAdAllowedPath('/getting-started/first-steps/edit')).toBe(false);
    expect(isAdAllowedPath('/donate')).toBe(false);
    expect(isAdAllowedPath('/getting-started/first-steps')).toBe(true);
    expect(isAdAllowedPath('/stages')).toBe(true);
  });
});
