import React, { useEffect } from 'react';
import DonationPrompt from './DonationPrompt';
import { useDonationPrompt } from '../hooks/useDonationPrompt';

/**
 * DonationSystem component
 *
 * Manages the donation prompt display logic and navigation
 * Exposes global trigger function for components to call on useful actions
 *
 * Configuration is done via wiki-config.json under features.donation
 */
const DonationSystem = () => {
  // Get donation config from wiki-config.json features.donation
  // For now using defaults - enhance this to read from config if needed
  const config = {
    enabled: true,
    cooldownHours: 24, // 24 hours between prompts
    triggerChance: 0.3, // 30% chance to trigger
    minInteractionsBeforeEligible: 2, // Must interact twice first
  };

  const { shouldShow, handleClose, handleDonate, triggerPrompt } = useDonationPrompt(config);

  const handleDonateClick = () => {
    handleDonate();
    // Use hash navigation since DonationSystem is outside Router context
    window.location.hash = '#/donate';
  };

  // Extract messages from shouldShow (can be true or array of messages)
  const messages = Array.isArray(shouldShow) ? shouldShow : null;

  // Expose trigger function globally for easy access from any component
  useEffect(() => {
    // Make it available on window object
    // Usage: window.triggerDonationPrompt({ messages: ['msg1', 'msg2', 'msg3'] })
    window.triggerDonationPrompt = (options = {}) => {
      return triggerPrompt(options);
    };

    // Also expose force trigger for testing
    window.forceDonationPrompt = (messages = null) => {
      return triggerPrompt({ force: true, messages });
    };

    // Cleanup
    return () => {
      delete window.triggerDonationPrompt;
      delete window.forceDonationPrompt;
    };
  }, [triggerPrompt]);

  // Listen for custom events (allows components to trigger without direct import)
  useEffect(() => {
    const handleCustomTrigger = (event) => {
      const options = event.detail || {};
      triggerPrompt(options);
    };

    window.addEventListener('donation-trigger', handleCustomTrigger);

    return () => {
      window.removeEventListener('donation-trigger', handleCustomTrigger);
    };
  }, [triggerPrompt]);

  if (!shouldShow) return null;

  return (
    <DonationPrompt
      onClose={handleClose}
      onDonate={handleDonateClick}
      messages={messages}
    />
  );
};

export default DonationSystem;

/**
 * Helper function to trigger donation prompt from any component
 * Can be called without importing anything
 *
 * Usage in any component:
 * window.triggerDonationPrompt?.(); // Safe call with optional chaining
 *
 * Or with options:
 * window.triggerDonationPrompt?.({ force: true }); // For testing
 *
 * Or via custom event:
 * window.dispatchEvent(new CustomEvent('donation-trigger'));
 */
