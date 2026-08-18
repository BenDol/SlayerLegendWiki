/**
 * Ad components
 *
 * In-page units are placed manually via <AdSlot>, including the sticky side rail
 * in the page aside (<SideRailAd>). Overlay units (anchor, vignette) come from
 * Google Auto ads and are toggled in the AdSense dashboard - there is deliberately
 * no component for them here. Google's own "side rails" Auto format must stay OFF
 * now that the manual side rail exists.
 *
 * See .claude/google-ads-setup.md for the full setup + tuning guide.
 */

export { default as AdSlot } from './AdSlot';
export { default as AdsProvider, useAds, areAdsRuntimeEnabled } from './AdsProvider';
export { default as ToolPageAd } from './ToolPageAd';
export { default as SideRailAd } from './SideRailAd';
