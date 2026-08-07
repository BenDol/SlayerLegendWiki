/**
 * Ad components
 *
 * In-page units are placed manually via <AdSlot>. Overlay units (anchor, side rail,
 * vignette) come from Google Auto ads and are toggled in the AdSense dashboard -
 * there is deliberately no component for them here.
 *
 * See .claude/google-ads-setup.md for the full setup + tuning guide.
 */

export { default as AdSlot } from './AdSlot';
export { default as AdsProvider, useAds, areAdsRuntimeEnabled } from './AdsProvider';
export { default as ToolPageAd } from './ToolPageAd';
