import dataRegistry from './dataRegistry';
import { createLogger } from './logger';

const logger = createLogger('DataAutocompleteSearch');

/**
 * Fuzzy match score - returns 0-100 based on how well query matches text
 * @param {string} query - Search query
 * @param {string} text - Text to search in
 * @returns {number} Match score 0-100
 */
const fuzzyMatchScore = (query, text) => {
  if (!query || !text) return 0;

  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact match - highest score
  if (t === q) return 100;

  // Starts with query - very high score
  if (t.startsWith(q)) return 90;

  // Contains query - high score
  if (t.includes(q)) return 70;

  // Fuzzy character matching
  let score = 0;
  let qIndex = 0;
  let lastMatchIndex = -1;

  for (let i = 0; i < t.length && qIndex < q.length; i++) {
    if (t[i] === q[qIndex]) {
      score += 10;
      // Bonus for consecutive matches
      if (lastMatchIndex === i - 1) {
        score += 5;
      }
      lastMatchIndex = i;
      qIndex++;
    }
  }

  // Must match all characters
  if (qIndex !== q.length) return 0;

  // Bonus for shorter strings (better match)
  const lengthRatio = q.length / t.length;
  score += lengthRatio * 20;

  return Math.min(score, 100);
};

/**
 * Search across all data sources for autocomplete suggestions
 * Enhanced scoring: when primary field matches, boost ALL fields from that item
 * @param {string} query - Search query from user input
 * @param {number} limit - Maximum results to return
 * @returns {Promise<Array>} Array of suggestion objects
 */
export const searchDataForAutocomplete = async (query, limit = 20) => {
  const suggestions = [];
  const sources = dataRegistry.getSources();

  // Track items with primary matches for boosting their fields
  const primaryMatchItems = new Set();

  // Search each data source
  for (const [sourceKey, sourceConfig] of Object.entries(sources)) {
    try {
      // Load data for this source
      const items = await dataRegistry.fetchData(sourceKey);

      if (!Array.isArray(items)) continue;

      // Search through items
      for (const item of items) {
        const displayInfo = dataRegistry.getDisplayInfo(sourceKey, item);
        const itemKey = `${sourceKey}:${displayInfo.id}`;

        // Score matches for primary field
        const primaryScore = fuzzyMatchScore(query, displayInfo.primary);

        // If primary matches, add full object suggestion AND mark item for field boosting
        if (primaryScore > 0) {
          primaryMatchItems.add(itemKey);

          suggestions.push({
            type: 'full-object',
            sourceKey,
            sourceLabel: sourceConfig.label,
            icon: sourceConfig.icon || '📊',
            itemId: displayInfo.id,
            primaryDisplay: displayInfo.primary,
            fieldPath: null,
            previewValue: displayInfo.secondary.map(s => `${s.field}: ${s.value}`).join(', ').substring(0, 100),
            insertSyntax: `{{data:${sourceKey}:${displayInfo.id}}}`,
            matchScore: primaryScore,
            hasPrimaryMatch: true,
            sortKey: `0_${100 - primaryScore}_${sourceConfig.label}_${displayInfo.primary}`
          });
        }

        // Score matches for secondary fields
        displayInfo.secondary.forEach(sec => {
          const fieldScore = fuzzyMatchScore(query, sec.field);
          const valueScore = fuzzyMatchScore(query, String(sec.value));
          const maxScore = Math.max(fieldScore, valueScore);

          // Show field if:
          // 1. It matches the query (maxScore > 0), OR
          // 2. Its parent item had a primary match (show all fields from matched items)
          const hasPrimaryMatch = primaryMatchItems.has(itemKey);
          const shouldShow = maxScore > 0 || hasPrimaryMatch;

          if (shouldShow) {
            // Boost score if parent item matched
            const boostedScore = hasPrimaryMatch ? Math.max(maxScore, 85) : maxScore;

            // Priority sorting:
            // - Tier 0: Full objects with primary match
            // - Tier 1: Fields from items with primary match (boosted)
            // - Tier 2: Fields that directly match the query
            const tier = hasPrimaryMatch ? '1' : '2';

            suggestions.push({
              type: 'field',
              sourceKey,
              sourceLabel: sourceConfig.label,
              icon: sourceConfig.icon || '📊',
              itemId: displayInfo.id,
              primaryDisplay: displayInfo.primary,
              fieldPath: sec.field,
              previewValue: String(sec.value).substring(0, 100),
              insertSyntax: `{{data:${sourceKey}:${displayInfo.id}:${sec.field}}}`,
              matchScore: boostedScore,
              hasPrimaryMatch: hasPrimaryMatch,
              sortKey: `${tier}_${100 - boostedScore}_${sourceConfig.label}_${displayInfo.primary}_${sec.field}`
            });
          }
        });

        // Also search in searchable fields if defined
        if (sourceConfig.searchFields && Array.isArray(sourceConfig.searchFields)) {
          sourceConfig.searchFields.forEach(fieldPath => {
            const value = getNestedValue(item, fieldPath);
            if (value) {
              const valueScore = fuzzyMatchScore(query, String(value));
              const hasPrimaryMatch = primaryMatchItems.has(itemKey);

              // Show if matches query OR parent item matched
              const shouldShow = valueScore > 30 || hasPrimaryMatch;

              if (shouldShow) {
                const boostedScore = hasPrimaryMatch ? Math.max(valueScore, 85) : valueScore;
                const tier = hasPrimaryMatch ? '1' : '2';

                // Avoid duplicate suggestions (check if this field was already added in secondary)
                const isDuplicate = displayInfo.secondary.some(s => s.field === fieldPath);
                if (!isDuplicate) {
                  suggestions.push({
                    type: 'field',
                    sourceKey,
                    sourceLabel: sourceConfig.label,
                    icon: sourceConfig.icon || '📊',
                    itemId: displayInfo.id,
                    primaryDisplay: displayInfo.primary,
                    fieldPath: fieldPath,
                    previewValue: String(value).substring(0, 100),
                    insertSyntax: `{{data:${sourceKey}:${displayInfo.id}:${fieldPath}}}`,
                    matchScore: boostedScore,
                    hasPrimaryMatch: hasPrimaryMatch,
                    sortKey: `${tier}_${100 - boostedScore}_${sourceConfig.label}_${displayInfo.primary}_${fieldPath}`
                  });
                }
              }
            }
          });
        }
      }
    } catch (err) {
      logger.error(`[DataAutocomplete] Failed to search ${sourceKey}:`, err);
    }
  }

  // Sort by tier and match score (sortKey handles this)
  suggestions.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // Return top results
  return suggestions.slice(0, limit);
};

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to search in
 * @param {string} path - Path like "skill.name"
 * @returns {any} Value or undefined
 */
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};
