import { useState, useEffect, useCallback } from 'react';
import { persistName, cacheName, configName } from '../../wiki-framework/src/utils/storageManager';
import { createLogger } from '../utils/logger';

const logger = createLogger('DonationPrompt');

// Storage keys following conventions
const STORAGE_KEYS = {
  lastShown: configName('donation_prompt_last_shown'),
  dismissed: configName('donation_prompt_dismissed'),
  donated: persistName('user_donated'),
  donationDate: persistName('donation_date'),
  sessionShown: cacheName('donation_prompt_session_shown'),
};

// Default configuration
const DEFAULT_CONFIG = {
  enabled: true,
  cooldownHours: 24, // 24 hours between prompts
  triggerChance: 0.3, // 30% chance to trigger on useful actions
  minInteractionsBeforeEligible: 2, // Must interact at least twice before becoming eligible
  scrollTriggerChance: 0.3, // 30% chance for scroll triggers (same as action triggers)
};

/**
 * Hook to manage event-based donation prompt display
 *
 * Shows donation prompt when users interact with useful features like:
 * - Share buttons on builds
 * - Auto-solve on engraving builder
 * - Best weapon finder
 * - Other helpful tools
 *
 * Features:
 * - Random chance to trigger (configurable)
 * - 24-hour cooldown
 * - Once per session maximum
 * - Respects user donations and dismissals
 * - Tracks useful interactions
 *
 * @param {Object} options - Configuration options
 * @returns {Object} - { shouldShow, handleClose, handleDonate, triggerPrompt, canTrigger }
 */
export const useDonationPrompt = (options = {}) => {
  const config = { ...DEFAULT_CONFIG, ...options };

  const [shouldShow, setShouldShow] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);

  // Check if user has donated
  const hasDonated = useCallback(() => {
    return localStorage.getItem(STORAGE_KEYS.donated) === 'true';
  }, []);

  // Check if within cooldown period
  const isInCooldown = useCallback(() => {
    const lastShown = localStorage.getItem(STORAGE_KEYS.lastShown);
    if (!lastShown) return false;

    const hoursSinceLastShown = (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60);
    return hoursSinceLastShown < config.cooldownHours;
  }, [config.cooldownHours]);

  // Check if already shown this session
  const shownThisSession = useCallback(() => {
    const key = STORAGE_KEYS.sessionShown;
    const value = sessionStorage.getItem(key);
    logger.debug('Session storage check', { key, value, result: value === 'true' });
    return value === 'true';
  }, []);

  // Check if user has dismissed recently
  const hasRecentDismissal = useCallback(() => {
    const dismissed = localStorage.getItem(STORAGE_KEYS.dismissed);
    if (!dismissed) return false;

    const hoursSinceDismiss = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60);
    return hoursSinceDismiss < config.cooldownHours;
  }, [config.cooldownHours]);

  // Check if eligible to show prompt
  const canTrigger = useCallback(() => {
    if (!config.enabled) return false;
    if (hasDonated()) return false;
    if (isInCooldown()) return false;
    if (shownThisSession()) return false;
    if (hasRecentDismissal()) return false;
    if (interactionCount < config.minInteractionsBeforeEligible) return false;

    return true;
  }, [
    config.enabled,
    config.minInteractionsBeforeEligible,
    hasDonated,
    isInCooldown,
    shownThisSession,
    hasRecentDismissal,
    interactionCount
  ]);

  // Random chance logic
  const rollChance = useCallback(() => {
    return Math.random() < config.triggerChance;
  }, [config.triggerChance]);

  /**
   * Attempt to trigger the donation prompt
   * Call this when user performs a useful action
   *
   * @param {Object} options - Trigger options
   * @param {boolean} options.force - Force show bypassing ALL checks (for testing)
   * @param {Array<string>} options.messages - Array of context-specific messages (min 3) to show in speech bubble
   * @param {boolean} options.isScrollTrigger - Whether this is a scroll-based trigger (uses higher chance)
   * @returns {boolean} - Whether prompt was triggered
   */
  const triggerPrompt = useCallback((triggerOptions = {}) => {
    const { force = false, messages = null, isScrollTrigger = false } = triggerOptions;

    // If forced, bypass ALL checks and show immediately
    if (force) {
      logger.info('Force triggered donation prompt (bypassing all checks)');
      setShouldShow(messages || true); // Pass messages or true
      return true;
    }

    // Normal flow: increment interaction count (helps with eligibility)
    setInteractionCount(prev => prev + 1);

    // Log detailed eligibility check
    logger.debug('Eligibility check', {
      isScrollTrigger,
      enabled: config.enabled,
      donated: hasDonated(),
      cooldown: isInCooldown(),
      sessionShown: shownThisSession(),
      dismissed: hasRecentDismissal(),
      interactions: `${interactionCount}/${config.minInteractionsBeforeEligible}`
    });

    if (!canTrigger()) {
      const reasons = [];
      if (!config.enabled) reasons.push('disabled');
      if (hasDonated()) reasons.push('already donated');
      if (isInCooldown()) reasons.push('in cooldown');
      if (shownThisSession()) reasons.push('shown this session');
      if (hasRecentDismissal()) reasons.push('recently dismissed');
      if (interactionCount < config.minInteractionsBeforeEligible) reasons.push(`need ${config.minInteractionsBeforeEligible} interactions (have ${interactionCount})`);

      logger.debug('Cannot trigger', { reasons: reasons.join(', ') });
      return false;
    }

    // Random chance check - use higher chance for scroll triggers
    const chance = isScrollTrigger ? config.scrollTriggerChance : config.triggerChance;
    const roll = Math.random();
    const passed = roll < chance;

    logger.debug('Random roll', {
      roll: (roll * 100).toFixed(1) + '%',
      needed: (chance * 100) + '%',
      passed
    });

    if (!passed) {
      return false;
    }

    // Show the prompt with context-specific messages!
    setShouldShow(messages || true); // Pass messages or true for default messages
    sessionStorage.setItem(STORAGE_KEYS.sessionShown, 'true');
    localStorage.setItem(STORAGE_KEYS.lastShown, Date.now().toString());

    logger.info('Donation prompt triggered successfully');
    return true;
  }, [canTrigger, rollChance, config, interactionCount, hasDonated, isInCooldown, shownThisSession, hasRecentDismissal]);

  // Handle user closing the prompt
  const handleClose = useCallback(() => {
    setShouldShow(false);
    localStorage.setItem(STORAGE_KEYS.dismissed, Date.now().toString());
    logger.info('User dismissed donation prompt');
  }, []);

  // Handle user clicking donate
  const handleDonate = useCallback(() => {
    setShouldShow(false);
    logger.info('User clicked donate button');
  }, []);

  // Track interaction count in session
  useEffect(() => {
    const storedCount = sessionStorage.getItem('donationInteractionCount');
    if (storedCount) {
      setInteractionCount(parseInt(storedCount));
    }
  }, []);

  // Save interaction count
  useEffect(() => {
    sessionStorage.setItem('donationInteractionCount', interactionCount.toString());
  }, [interactionCount]);

  return {
    shouldShow,
    handleClose,
    handleDonate,
    triggerPrompt, // Call this on useful actions
    canTrigger: canTrigger(), // Check if eligible before showing UI hints
    interactionCount, // For debugging
  };
};

/**
 * Utility function to mark user as having donated
 * Call this on successful donation
 */
export const markUserAsDonated = () => {
  localStorage.setItem(STORAGE_KEYS.donated, 'true');
  localStorage.setItem(STORAGE_KEYS.donationDate, Date.now().toString());
  logger.info('User marked as donated');
};

/**
 * Utility function to reset donation prompt status (for testing)
 */
export const resetDonationPromptStatus = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  sessionStorage.removeItem('donationInteractionCount');
  logger.debug('Donation prompt status reset for testing');
};

/**
 * Utility function to force trigger (for testing)
 * Returns a function you can call from browser console
 */
export const getDebugTrigger = () => {
  return () => {
    resetDonationPromptStatus();
    // Trigger will happen on next useful action, or you can dispatch custom event
    window.dispatchEvent(new CustomEvent('donation-debug-trigger', { detail: { force: true } }));
    logger.debug('Debug trigger dispatched - perform a useful action or use force option');
  };
};

/**
 * Get current prompt status (for debugging)
 */
export const getDonationPromptStatus = () => {
  const lastShown = localStorage.getItem(STORAGE_KEYS.lastShown);
  const dismissed = localStorage.getItem(STORAGE_KEYS.dismissed);
  const donated = localStorage.getItem(STORAGE_KEYS.donated);
  const sessionShown = sessionStorage.getItem(STORAGE_KEYS.sessionShown);

  return {
    hasDonated: donated === 'true',
    lastShownTimestamp: lastShown ? new Date(parseInt(lastShown)).toISOString() : null,
    dismissedTimestamp: dismissed ? new Date(parseInt(dismissed)).toISOString() : null,
    shownThisSession: sessionShown === 'true',
    hoursSinceLastShown: lastShown ? (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60) : null,
    hoursSinceDismiss: dismissed ? (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60) : null,
  };
};

// Export storage keys for use in other components
export { STORAGE_KEYS };
