import React from 'react';
import AdSlot from './AdSlot';
import { AD_PLACEMENT } from '../../config/adsConfig';

/** Keeps the tool-page banner from ever dominating the builder it sits above. */
const TOOL_AD_MAX_HEIGHT_CLASS = 'max-h-[110px]';

/**
 * ToolPageAd
 *
 * A single responsive banner for the interactive tool pages (builders, collections).
 * Those pages are app-like rather than article-like, so they get one clearly separated
 * unit at the top instead of in-content injection.
 */
const ToolPageAd = () => (
  <AdSlot
    placement={AD_PLACEMENT.TOOL_TOP}
    className={`mx-auto mt-0 mb-4 ${TOOL_AD_MAX_HEIGHT_CLASS}`}
  />
);

export default ToolPageAd;
