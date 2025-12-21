import { useEffect, useRef } from 'react';

/**
 * Hook to trigger donation prompt when user scrolls to a certain depth
 * Tracks by unique page identifier to reset between different content pages
 *
 * @param {number} threshold - Scroll depth percentage (0-100) to trigger at
 * @param {function} onTrigger - Callback function to execute when threshold is reached
 * @param {string} pageIdentifier - Unique identifier for current page (resets trigger when changed)
 */
const useScrollDepthTrigger = (threshold = 65, onTrigger, pageIdentifier = null) => {
  const hasTriggeredRef = useRef(false);
  const previousPageRef = useRef(null);
  const lastMilestoneRef = useRef(null);

  useEffect(() => {
    // Skip if no page identifier provided (means we don't want scroll tracking on this page)
    if (pageIdentifier === null) {
      console.log('[ScrollDepth] Skipping - no page identifier (not a content page)');
      return;
    }

    console.log(`[ScrollDepth] Effect running for page: "${pageIdentifier}" (previous: "${previousPageRef.current}")`);

    // Reset trigger state when page identifier changes
    if (previousPageRef.current !== pageIdentifier) {
      console.log(`[ScrollDepth] ✨ Page changed from "${previousPageRef.current}" to "${pageIdentifier}" - RESETTING trigger state`);
      hasTriggeredRef.current = false;
      lastMilestoneRef.current = null;
      previousPageRef.current = pageIdentifier;
    } else {
      console.log(`[ScrollDepth] Same page - reattaching listener (trigger state: ${hasTriggeredRef.current})`);
    }

    const handleScroll = () => {
      // Skip if already triggered for this page
      if (hasTriggeredRef.current) {
        return;
      }

      // Calculate scroll depth percentage
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;

      // Calculate how far down the page we've scrolled (percentage)
      const scrollableHeight = documentHeight - windowHeight;
      const scrollPercentage = scrollableHeight > 0
        ? (scrollTop / scrollableHeight) * 100
        : 0;

      // Debug logging every 10% milestone
      const milestone = Math.floor(scrollPercentage / 10) * 10;
      if (!lastMilestoneRef.current || lastMilestoneRef.current !== milestone) {
        lastMilestoneRef.current = milestone;
        console.log(`[ScrollDepth] [${pageIdentifier}] Scroll: ${scrollPercentage.toFixed(1)}% (threshold: ${threshold}%, triggered: ${hasTriggeredRef.current})`);
      }

      // Trigger when reaching the threshold
      if (scrollPercentage >= threshold) {
        console.log(`[ScrollDepth] ✅ [${pageIdentifier}] Reached ${threshold}% scroll depth - TRIGGERING DONATION PROMPT`);
        hasTriggeredRef.current = true;
        onTrigger?.();
      }
    };

    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    console.log(`[ScrollDepth] ✓ Scroll listener attached for page: "${pageIdentifier}"`);

    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
      console.log(`[ScrollDepth] ✗ Scroll listener removed for page: "${pageIdentifier}"`);
    };
  }, [threshold, onTrigger, pageIdentifier]);
};

export default useScrollDepthTrigger;
