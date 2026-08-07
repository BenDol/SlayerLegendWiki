import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useWikiConfig } from '../../../wiki-framework/src/hooks/useWikiConfig';
import { useDonatorStatus } from '../../../wiki-framework/src/hooks/useDonatorStatus';
import { useAuthStore } from '../../../wiki-framework/src/store/authStore';
import { isCrawler, isAdNetworkCrawler } from '../../utils/crawlerDetection';
import {
  ADSENSE_SCRIPT_BASE_URL,
  ADSENSE_SCRIPT_ID,
  getAdClientId,
  isAdsConfigured,
} from '../../config/adsConfig';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdsProvider');

const AdsContext = createContext({ adsEnabled: false, clientId: '', scriptReady: false });

/**
 * Module-level mirror of `adsEnabled` so non-React code (the markdown content
 * processor, which runs outside the React tree) can ask the same question.
 */
let adsRuntimeEnabled = false;

/**
 * Whether ads should render right now. Safe to call outside React.
 * @returns {boolean}
 */
export function areAdsRuntimeEnabled() {
  return adsRuntimeEnabled;
}

/**
 * Access ad state from any component below AdsProvider.
 * @returns {{adsEnabled: boolean, clientId: string, scriptReady: boolean}}
 */
export function useAds() {
  return useContext(AdsContext);
}

/**
 * Inject the AdSense loader script exactly once.
 *
 * This single script powers both the manual `<ins>` units we place ourselves and
 * Google's Auto ads overlay formats (anchor / side rail / vignette), which are
 * toggled in the AdSense dashboard rather than in code.
 *
 * @param {string} clientId - AdSense publisher ID (ca-pub-...)
 * @param {function} onReady - Called once the script has loaded
 * @returns {function} Cleanup that cancels the pending callback
 */
function loadAdSenseScript(clientId, onReady) {
  if (typeof document === 'undefined') return () => {};

  let cancelled = false;
  const done = () => {
    if (!cancelled) onReady();
  };

  const existing = document.getElementById(ADSENSE_SCRIPT_ID);
  if (existing) {
    if (existing.dataset.loaded === 'true') {
      done();
    } else {
      existing.addEventListener('load', done, { once: true });
    }
    return () => {
      cancelled = true;
    };
  }

  const script = document.createElement('script');
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `${ADSENSE_SCRIPT_BASE_URL}?client=${encodeURIComponent(clientId)}`;
  script.addEventListener('load', () => {
    script.dataset.loaded = 'true';
    logger.info('AdSense script loaded');
    done();
  }, { once: true });
  script.addEventListener('error', () => {
    // Almost always an ad blocker. Not an error worth alarming on.
    logger.debug('AdSense script blocked or failed to load');
  }, { once: true });

  document.head.appendChild(script);
  return () => {
    cancelled = true;
  };
}

/**
 * AdsProvider
 *
 * Decides whether ads run for this visitor and loads the AdSense script if so.
 * Ads are suppressed for:
 * - Crawlers, EXCEPT Google's ad crawlers (they should index content, not ad shells)
 * - Donators (ad-free browsing is a donation perk, and doubles as a donation hook)
 * - Local development, unless features.ads.showInDevelopment is true
 * - Any config state where ads are off or the publisher ID is missing
 */
const AdsProvider = ({ children }) => {
  const { config } = useWikiConfig();
  const user = useAuthStore(state => state.user);
  const { isDonator } = useDonatorStatus(user?.login || null, user?.id || null);
  const [scriptReady, setScriptReady] = useState(false);

  const configured = isAdsConfigured(config);
  const clientId = getAdClientId(config);
  const hideForDonators = config?.features?.ads?.hideForDonators !== false;

  // Evaluated once per session - the user agent cannot change mid-session.
  // Google's own ad crawlers are exempt: they must see the same ad code a human
  // does, or contextual targeting degrades and AdSense review sees a bare page.
  const [crawler] = useState(() => isCrawler() && !isAdNetworkCrawler());

  const adsEnabled = configured && !crawler && !(hideForDonators && isDonator);

  useEffect(() => {
    adsRuntimeEnabled = adsEnabled;
  }, [adsEnabled]);

  useEffect(() => {
    if (!adsEnabled) return undefined;
    return loadAdSenseScript(clientId, () => setScriptReady(true));
  }, [adsEnabled, clientId]);

  const value = useMemo(
    () => ({ adsEnabled, clientId, scriptReady }),
    [adsEnabled, clientId, scriptReady]
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
};

export default AdsProvider;
