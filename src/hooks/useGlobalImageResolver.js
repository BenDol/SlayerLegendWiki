import { useEffect } from 'react';
import { resolveImageUrl } from '../services/imageService';
import { createLogger } from '../utils/logger';

const logger = createLogger('GlobalImageResolver');

// Cache resolved URLs to avoid redundant resolutions
const resolvedCache = new Map();

// Track images we've already processed to avoid reprocessing
const processedImages = new WeakSet();

/**
 * Global image resolver hook
 * Automatically resolves all <img> src attributes that point to /images/content/*
 *
 * This hook uses MutationObserver to watch for img elements being added to the DOM
 * and automatically resolves their src attributes to CDN URLs.
 *
 * Usage: Add this hook to your main App component
 */
export function useGlobalImageResolver() {
  useEffect(() => {
    logger.debug('Initializing global image resolver');

    // Resolve an img element's src if it points to /images/content/*
    const resolveImgSrc = async (img) => {
      const src = img.getAttribute('src');

      // Skip if already a CDN URL (already resolved)
      if (src && (src.startsWith('https://cdn.jsdelivr.net') || src.startsWith('https://raw.githubusercontent.com'))) {
        return;
      }

      // Only process /images/content/* paths
      if (!src || !src.startsWith('/images/content/')) {
        return;
      }

      // Skip if already processed (same element instance)
      if (processedImages.has(img)) {
        return;
      }

      // Mark as processed immediately to prevent reprocessing
      processedImages.add(img);

      // Check cache first - if cached, update synchronously without logging
      if (resolvedCache.has(src)) {
        const resolvedUrl = resolvedCache.get(src);
        img.src = resolvedUrl;
        return;
      }

      try {
        // Resolve to CDN URL
        const resolvedUrl = await resolveImageUrl(src);

        // Cache the result
        resolvedCache.set(src, resolvedUrl);

        // Update img src
        logger.debug('Resolved new image to CDN', { src });
        img.src = resolvedUrl;
      } catch (error) {
        logger.error('Failed to resolve image URL', { src, error });
      }
    };

    // Process all existing img elements on mount
    const processExistingImages = () => {
      const images = document.querySelectorAll('img[src^="/images/content/"]');
      logger.debug('Processing existing images', { count: images.length });
      images.forEach(resolveImgSrc);
    };

    // Process existing images
    processExistingImages();

    // Watch for new img elements being added to the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Only check added nodes, not attribute changes
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the node itself is an img
            if (node.tagName === 'IMG') {
              resolveImgSrc(node);
            }
            // Check for img descendants
            if (node.querySelectorAll) {
              const images = node.querySelectorAll('img[src^="/images/content/"]');
              images.forEach(resolveImgSrc);
            }
          }
        });
      });
    });

    // Start observing the document body - only watch for new elements, not attribute changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    logger.debug('Global image resolver started');

    // Cleanup on unmount
    return () => {
      observer.disconnect();
      logger.debug('Global image resolver stopped');
    };
  }, []);
}
