import React, { useState, useEffect, useCallback } from 'react';
import DonationSystem from '../../wiki-framework/src/components/donation/DonationSystem';
import DonationMascot from './DonationMascot';
import NetworkDebugBanner from '../../wiki-framework/src/components/common/NetworkDebugBanner';
import useScrollDepthTrigger from '../hooks/useScrollDepthTrigger';
import { createLogger } from '../utils/logger';

const logger = createLogger('AppWrapper');

/**
 * AppWrapper Component
 *
 * Wraps the main App with additional features like donation prompts
 * This keeps the framework clean while adding parent-project-specific features
 */
const AppWrapper = ({ children }) => {
  const [currentPagePath, setCurrentPagePath] = useState(null);

  // Track authentication state changes to trigger donation prompt on login
  useEffect(() => {
    let unsubscribe = null;
    let previousAuthState = false;

    const setupAuthListener = async () => {
      try {
        const { useAuthStore } = await import('../../wiki-framework/src/store/authStore');

        // Get initial state
        previousAuthState = useAuthStore.getState().isAuthenticated;

        // Subscribe to all state changes
        unsubscribe = useAuthStore.subscribe((state) => {
          // Check if auth state changed from false to true (user just logged in)
          if (state.isAuthenticated && !previousAuthState) {
            logger.debug('User logged in successfully - triggering donation prompt');

            // Small delay so prompt doesn't interfere with login UI closing
            setTimeout(() => {
              window.triggerDonationPrompt?.({
                messages: [
                  "Welcome back! Great to see you! 🎉",
                  "You're logged in! Ready to contribute? ✨",
                  "Hey there! Thanks for signing in! 👋",
                  "Logged in and ready to go! 🚀",
                ]
              });
            }, 1500);
          }

          // Update previous state
          previousAuthState = state.isAuthenticated;
        });
      } catch (error) {
        logger.warn('Could not subscribe to auth changes', { error });
      }
    };

    setupAuthListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Initialize network debug mode if enabled
  useEffect(() => {
    // Prevent double-initialization from React StrictMode
    if (window.__networkDebugInitialized__) {
      logger.debug('Network debug already initialized (StrictMode double-mount), skipping');
      return;
    }

    // Mark as initialized IMMEDIATELY to prevent race condition with second mount
    window.__networkDebugInitialized__ = true;

    const initDebug = async () => {
      try {
        // Wait for config to be available (with timeout)
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        while (!window.__WIKI_CONFIG__ && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!window.__WIKI_CONFIG__) {
          logger.warn('Wiki config not available after waiting, skipping network debug init');
          return;
        }

        const { isNetworkDebugEnabled } = await import('../../wiki-framework/src/utils/networkDebugConfig');
        if (isNetworkDebugEnabled()) {
          logger.info('Network debug mode enabled - initializing');
          const { initializeNetworkDebug } = await import('../../wiki-framework/src/utils/networkDebugInit');
          await initializeNetworkDebug();
          // Note: initializeNetworkDebug now handles initial route setup
        }
      } catch (error) {
        logger.error('Failed to initialize network debug mode', { error });
      }
    };

    initDebug();
  }, []);

  // Track current page path - only set for markdown content pages
  useEffect(() => {
    logger.trace('Page tracking effect initialized');
    let updatePagePathRef = null;

    const updatePagePath = () => {
      const pathname = window.location.pathname;
      logger.trace('updatePagePath called', { pathname });

      // Exclude special tool pages from content tracking
      const specialPages = [
        '/skill-builder', '/spirit-builder', '/battle-loadouts',
        '/soul-weapon-engraving', '/my-spirits', '/my-collections',
        '/spirits/viewer', '/donate', '/search', '/profile', '/maintenance',
        '/page-history', '/contributor-highscore', '/my-edits', '/debug/network'
      ];

      // Check if it's a special page
      const isSpecialPage = specialPages.some(sp => pathname.startsWith(sp));

      // Notify network debug store for ALL pages (including homepage and special pages)
      if (window.__networkDebugStore__) {
        logger.debug('Calling handleRouteChange', { pathname });
        const store = window.__networkDebugStore__.getState();
        store.handleRouteChange(pathname);
      } else {
        logger.debug('Network debug store not available yet');
      }

      // For content tracking (editor features), only track non-special pages
      if (pathname && pathname !== '/') {
        const path = pathname.startsWith('/') ? pathname.slice(1) : pathname;

        if (!isSpecialPage && path) {
          logger.debug('Tracking content page', { path });
          setCurrentPagePath(path);
        } else {
          logger.debug('Not tracking special page for content', { path });
          setCurrentPagePath(null);
        }
      } else {
        logger.debug('Homepage - not tracking for content');
        setCurrentPagePath(null);
      }
    };

    updatePagePathRef = updatePagePath;

    // Update on navigation (popstate for back/forward)
    window.addEventListener('popstate', updatePagePath);
    logger.trace('popstate listener attached');

    // Initial update - call immediately
    updatePagePath();

    // Also poll for path changes as backup (in case event listener breaks)
    let lastPath = window.location.pathname;
    const pollInterval = setInterval(() => {
      if (window.location.pathname !== lastPath) {
        logger.trace('Path changed detected by polling');
        lastPath = window.location.pathname;
        updatePagePathRef();
      }
    }, 500); // Check every 500ms

    // Cleanup
    return () => {
      logger.trace('Cleaning up popstate listener and poll interval');
      window.removeEventListener('popstate', updatePagePath);
      clearInterval(pollInterval);
    };
  }, []);

  // Memoize the scroll trigger callback to prevent effect from re-running on every render
  const handleScrollTrigger = useCallback(() => {
    logger.debug('Scroll depth reached - attempting to trigger donation prompt');
    const result = window.triggerDonationPrompt?.({
      messages: [
        "Learning something useful? 📖",
        "Hope this guide is helping! 🎓",
        "Deep dive into the wiki! 🤿",
        "Knowledge is power! 💡",
      ],
      isScrollTrigger: true
    });
    logger.debug('Donation prompt trigger result', { result });
  }, []);

  // Trigger donation prompt when user scrolls 65% down a content page
  useScrollDepthTrigger(65, handleScrollTrigger, currentPagePath);

  return (
    <>
      {/* Network debug banner - shows when debug mode is active */}
      <NetworkDebugBanner />

      {children}

      {/* Donation system - shows animated spirit prompts with custom mascot */}
      <DonationSystem MascotComponent={DonationMascot} />
    </>
  );
};

export default AppWrapper;
