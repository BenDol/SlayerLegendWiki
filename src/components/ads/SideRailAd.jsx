import React from 'react';
import AdSlot from './AdSlot';
import { AD_PLACEMENT } from '../../config/adsConfig';

/**
 * SideRailAd
 *
 * The persistent 160x600 skyscraper for the right-hand page aside. Registered into
 * the framework's page-aside slot from main.jsx, so it renders below the table of
 * contents inside the aside's sticky group and stays in view as the reader scrolls.
 *
 * Positioning notes (all inherited, nothing to manage here):
 * - The aside is `hidden xl:block`, so this never renders below 1280px viewports.
 * - Stickiness comes from the aside's sticky group in the framework.
 * - AdSlot handles route exclusions, donator hiding, the empty-slot collapse, and
 *   lazy loading, exactly as with every other unit.
 *
 * IMPORTANT: with this unit live, Google's "side rails" Auto ads format must stay
 * OFF in the AdSense dashboard - running both doubles up side ads on wide screens.
 * See .claude/google-ads-setup.md.
 */
const SideRailAd = () => (
  <AdSlot placement={AD_PLACEMENT.SIDE_RAIL} className="text-center" />
);

export default SideRailAd;
