import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAds } from './AdsProvider';
import {
  AD_FORMAT,
  AD_LAZY_LOAD_MARGIN,
  AD_PLACEMENT_FORMAT,
  AD_RESERVED_HEIGHT,
  DEFAULT_AD_LABEL,
  getAdSlotId,
  isAdAllowedPath,
} from '../../config/adsConfig';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdSlot');

/**
 * Per-format attributes for the AdSense `<ins>` element.
 * These are the shapes AdSense generates in its "Get code" dialog.
 */
const FORMAT_ATTRIBUTES = {
  [AD_FORMAT.DISPLAY]: {
    'data-ad-format': 'auto',
    'data-full-width-responsive': 'true',
  },
  [AD_FORMAT.IN_ARTICLE]: {
    'data-ad-layout': 'in-article',
    'data-ad-format': 'fluid',
  },
  [AD_FORMAT.MULTIPLEX]: {
    'data-ad-format': 'autorelaxed',
  },
};

const FORMAT_STYLES = {
  [AD_FORMAT.DISPLAY]: { display: 'block' },
  [AD_FORMAT.IN_ARTICLE]: { display: 'block', textAlign: 'center' },
  [AD_FORMAT.MULTIPLEX]: { display: 'block' },
};

/**
 * AdSlot
 *
 * A single AdSense unit. Handles the things that go wrong in a React SPA:
 * - Only pushes once per mounted `<ins>` (React StrictMode double-invokes effects)
 * - Remounts on route change so the unit refills instead of going stale
 * - Defers the push until the slot is near the viewport (better viewability, better CWV)
 * - Reserves height up front so filling the ad doesn't shift the page (CLS)
 * - Collapses itself when AdSense reports the slot as unfilled or the loader script
 *   is blocked (ad blockers), so no blank gap is left
 *
 * @param {string} placement - One of AD_PLACEMENT; selects the slot ID from wiki-config
 * @param {string} [format] - Override the placement's default AD_FORMAT
 * @param {string} [className] - Extra classes on the outer container
 * @param {boolean} [showLabel=true] - Render the "Advertisement" label
 */
const AdSlot = ({ placement, format, className = '', showLabel = true }) => {
  const { adsEnabled, scriptReady, scriptFailed, clientId } = useAds();
  const location = useLocation();
  const containerRef = useRef(null);
  const insRef = useRef(null);
  const pushedRef = useRef(false);
  const [inView, setInView] = useState(false);
  const [unfilled, setUnfilled] = useState(false);

  const resolvedFormat = format || AD_PLACEMENT_FORMAT[placement] || AD_FORMAT.DISPLAY;
  const slotId = getAdSlotId(placement);
  const pathAllowed = isAdAllowedPath(location.pathname);
  const shouldRender = adsEnabled && pathAllowed && Boolean(slotId);

  // Start loading shortly before the slot scrolls into view
  useEffect(() => {
    if (!shouldRender || inView) return undefined;

    const node = containerRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: AD_LAZY_LOAD_MARGIN }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRender, inView]);

  // Hand the unit to AdSense exactly once
  useEffect(() => {
    if (!shouldRender || !scriptReady || !inView || pushedRef.current) return;

    const ins = insRef.current;
    // AdSense stamps this attribute on units it has already claimed; pushing again throws
    if (!ins || ins.getAttribute('data-adsbygoogle-status')) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
      logger.debug('Ad unit requested', { placement, format: resolvedFormat });
    } catch (error) {
      logger.warn('Failed to request ad unit', { placement, error: error?.message });
    }
  }, [shouldRender, scriptReady, inView, placement, resolvedFormat]);

  // Collapse the reserved space when Google reports no ad was available
  useEffect(() => {
    if (!shouldRender) return undefined;

    const ins = insRef.current;
    if (!ins || typeof MutationObserver === 'undefined') return undefined;

    const check = () => {
      if (ins.getAttribute('data-ad-status') === 'unfilled') setUnfilled(true);
    };

    const observer = new MutationObserver(check);
    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    check();

    return () => observer.disconnect();
  }, [shouldRender]);

  // scriptFailed: an ad blocker (or network failure) stopped the loader - collapse
  // instead of holding an empty labelled box open forever.
  if (!shouldRender || unfilled || scriptFailed) return null;

  const reservedHeight = AD_RESERVED_HEIGHT[resolvedFormat];

  return (
    <div
      ref={containerRef}
      className={`ad-slot ad-slot--${placement} my-6 w-full overflow-hidden ${className}`}
      data-ad-placement={placement}
    >
      {showLabel && (
        <div className="mb-1 text-center text-[10px] font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {DEFAULT_AD_LABEL}
        </div>
      )}
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ ...FORMAT_STYLES[resolvedFormat], minHeight: `${reservedHeight}px` }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        {...FORMAT_ATTRIBUTES[resolvedFormat]}
      />
    </div>
  );
};

/**
 * Wrapper that forces a fresh `<ins>` on every navigation. AdSense will not refill an
 * element it has already claimed, so the unit has to be a new node per route.
 */
const KeyedAdSlot = props => {
  const location = useLocation();
  return <AdSlot key={`${props.placement}-${location.pathname}`} {...props} />;
};

export default KeyedAdSlot;
