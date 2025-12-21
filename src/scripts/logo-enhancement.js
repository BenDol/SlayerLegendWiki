/**
 * Logo Enhancement Script
 * Automatically adds id="logo" to the header logo image for smoke effect
 * This allows the smoke effect to work without modifying framework files
 */

(function initLogoEnhancements() {
  'use strict';

  // Configuration
  const CONFIG = {
    // Selector to find the logo image
    logoSelector: 'header a[href="/"] img, header a[href*="/#/"] img',

    // ID to add to the logo
    logoId: 'logo',

    // Enable debug logging
    debug: false,

    // Retry attempts if logo not found immediately
    maxRetries: 10,
    retryDelay: 100, // milliseconds
  };

  /**
   * Debug logger
   */
  function log(...args) {
    if (CONFIG.debug) {
      logger.debug('Logo enhancement', ...args);
    }
  }

  /**
   * Add id="logo" to the logo image and wrap it for smoke effect
   */
  function addLogoId() {
    const logoImage = document.querySelector(CONFIG.logoSelector);

    if (!logoImage) {
      log('Logo image not found yet');
      return false;
    }

    // Check if already enhanced
    if (logoImage.getAttribute('data-enhanced') === 'true') {
      log('Logo already enhanced');
      return true;
    }

    // Add the ID
    logoImage.id = CONFIG.logoId;
    log('✅ Logo ID added successfully:', logoImage);

    // Create a wrapper div for the smoke effect to position correctly
    const wrapper = document.createElement('div');
    wrapper.className = 'logo-smoke-wrapper';
    wrapper.style.cssText = 'position: relative; display: inline-flex;';

    // Wrap the logo image
    const parent = logoImage.parentNode;
    parent.insertBefore(wrapper, logoImage);
    wrapper.appendChild(logoImage);

    log('✅ Logo wrapper added for smoke effect');

    // Add a data attribute to track that we enhanced it
    logoImage.setAttribute('data-enhanced', 'true');

    // Dispatch custom event for other scripts that might need to know
    window.dispatchEvent(new CustomEvent('logo-enhanced', {
      detail: { element: logoImage, wrapper: wrapper }
    }));

    return true;
  }

  /**
   * Try to add logo ID with retries
   */
  function tryAddLogoId(attempt = 1) {
    const success = addLogoId();

    if (success) {
      log(`Logo enhanced successfully on attempt ${attempt}`);
      return;
    }

    if (attempt >= CONFIG.maxRetries) {
      logger.warn('Failed to find logo after attempts', {
        maxRetries: CONFIG.maxRetries,
        selector: CONFIG.logoSelector,
        message: 'Smoke effect may not work'
      });
      return;
    }

    // Retry after delay
    log(`Retrying... (attempt ${attempt + 1}/${CONFIG.maxRetries})`);
    setTimeout(() => tryAddLogoId(attempt + 1), CONFIG.retryDelay);
  }

  /**
   * Setup MutationObserver to handle dynamic logo changes
   * This ensures the ID persists even if React re-renders the header
   */
  function setupLogoObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check if any nodes were added
        if (mutation.addedNodes.length > 0) {
          const logoImage = document.querySelector(CONFIG.logoSelector);
          if (logoImage && logoImage.id !== CONFIG.logoId) {
            log('Logo re-rendered, reapplying ID');
            addLogoId();
          }
        }
      }
    });

    // Observe the header for changes
    const header = document.querySelector('header');
    if (header) {
      observer.observe(header, {
        childList: true,
        subtree: true,
      });
      log('MutationObserver setup complete');
    }
  }

  /**
   * Initialize on DOM ready
   */
  function init() {
    // Try to add logo ID immediately
    tryAddLogoId();

    // Setup observer for dynamic changes
    setupLogoObserver();

    log('Logo enhancement initialized');
  }

  // Run on different load events to ensure it works
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also try after a short delay (for React apps)
  setTimeout(init, 50);

  // Expose configuration for debugging
  if (CONFIG.debug) {
    window.logoEnhancement = {
      config: CONFIG,
      addLogoId,
      checkLogo: () => {
        const logo = document.querySelector(CONFIG.logoSelector);
        logger.debug('Logo element:', { data: logo });
        logger.trace('Has ID', { hasId: logo?.id === CONFIG.logoId });
        return logo;
      }
    };
    log('Debug utilities available at window.logoEnhancement');
  }
})();
