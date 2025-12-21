import React, { useState, useEffect, useCallback } from 'react';
import DonationSystem from './DonationSystem';
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
            logger.info('User logged in successfully - triggering donation prompt');

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

  // Track current page path - only set for markdown content pages
  useEffect(() => {
    logger.trace('Page tracking effect initialized');
    let updatePagePathRef = null;

    const updatePagePath = () => {
      const hash = window.location.hash;
      logger.trace('updatePagePath called', { hash });

      // Only track content pages (format: #/section/page-name or #/getting-started, etc.)
      // Exclude special pages like #/skill-builder, #/donate, #/search
      const specialPages = [
        'skill-builder', 'spirit-builder', 'battle-loadouts',
        'soul-weapon-engraving', 'my-spirits', 'my-collections',
        'spirits/viewer', 'donate', 'search', 'profile', 'maintenance',
        'page-history', 'contributor-highscore', 'my-edits'
      ];

      if (hash && hash.startsWith('#/')) {
        const path = hash.slice(2); // Remove #/

        // Check if it's a special page
        const isSpecialPage = specialPages.some(sp => path.startsWith(sp));

        if (!isSpecialPage && path) {
          logger.debug('Tracking content page', { path });
          setCurrentPagePath(path);
        } else {
          logger.trace('Not tracking special page', { path });
          setCurrentPagePath(null);
        }
      } else {
        logger.trace('No hash or invalid hash, not tracking');
        setCurrentPagePath(null);
      }
    };

    updatePagePathRef = updatePagePath;

    // Update on hash change
    window.addEventListener('hashchange', updatePagePath);
    logger.trace('hashchange listener attached');

    // Initial update - call immediately
    updatePagePath();

    // Also poll for hash changes as backup (in case event listener breaks)
    let lastHash = window.location.hash;
    const pollInterval = setInterval(() => {
      if (window.location.hash !== lastHash) {
        logger.trace('Hash changed detected by polling');
        lastHash = window.location.hash;
        updatePagePathRef();
      }
    }, 500); // Check every 500ms

    // Cleanup
    return () => {
      logger.trace('Cleaning up hashchange listener and poll interval');
      window.removeEventListener('hashchange', updatePagePath);
      clearInterval(pollInterval);
    };
  }, []);

  // Memoize the scroll trigger callback to prevent effect from re-running on every render
  const handleScrollTrigger = useCallback(() => {
    logger.info('Scroll depth reached - attempting to trigger donation prompt');
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
      {children}

      {/* Donation system - shows animated spirit prompts */}
      <DonationSystem />
    </>
  );
};

export default AppWrapper;
