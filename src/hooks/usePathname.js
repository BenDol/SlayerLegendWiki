import { useEffect, useState } from 'react';

/** Poll interval for pushState navigations, which fire no browser event. */
export const PATHNAME_POLL_INTERVAL_MS = 500;

/**
 * One poller and one popstate listener for every subscriber, rather than a
 * timer per consumer: SeoManager and AdsProvider both watch the same value.
 */
const subscribers = new Set();
let pollHandle = null;
let lastPathname = null;

function currentPathname() {
  return typeof window !== 'undefined' ? window.location.pathname : '/';
}

function notifyIfChanged() {
  const next = currentPathname();
  if (next === lastPathname) return;
  lastPathname = next;
  subscribers.forEach((listener) => listener(next));
}

function subscribe(listener) {
  subscribers.add(listener);
  if (subscribers.size === 1) {
    lastPathname = currentPathname();
    window.addEventListener('popstate', notifyIfChanged);
    pollHandle = setInterval(notifyIfChanged, PATHNAME_POLL_INTERVAL_MS);
  }
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) {
      window.removeEventListener('popstate', notifyIfChanged);
      clearInterval(pollHandle);
      pollHandle = null;
      lastPathname = null;
    }
  };
}

/**
 * Current pathname, reactive to SPA navigation, for components mounted
 * outside the router (AppWrapper wraps the RouterProvider, so useLocation
 * is unavailable there). popstate plus a light poll covers pushState.
 *
 * @returns {string} window.location.pathname ("/" during SSR)
 */
export function usePathname() {
  const [pathname, setPathname] = useState(currentPathname);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    // Catch a navigation that happened between the initial render and this effect.
    setPathname((current) => (current === window.location.pathname ? current : window.location.pathname));
    return subscribe(setPathname);
  }, []);

  return pathname;
}
