import { useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('useFamiliarsData');

/**
 * Load familiars database from JSON file
 * @returns {Promise<Array>} Array of familiar objects
 */
export const loadFamiliarsDatabase = async () => {
  try {
    const response = await fetch('/data/familiars.json');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error('Failed to load familiars database', { error });
    return [];
  }
};

/**
 * Load Prime Familiars database from JSON file
 * @returns {Promise<Array>} Array of Prime Familiar objects
 */
export const loadPrimeFamiliarsDatabase = async () => {
  try {
    const response = await fetch('/data/prime-familiars.json');
    const data = await response.json();
    return data.primeFamiliars || [];
  } catch (error) {
    logger.error('Failed to load Prime Familiars database', { error });
    return [];
  }
};

/**
 * Load familiar categories from JSON file
 * @returns {Promise<Object>} Categories object
 */
export const loadFamiliarCategories = async () => {
  try {
    const response = await fetch('/data/familiar-categories.json');
    const data = await response.json();
    return data || {};
  } catch (error) {
    logger.error('Failed to load familiar categories', { error });
    return { categories: {}, familiarCategories: [], categoryMappings: {} };
  }
};

/**
 * Load familiar progression data from JSON file
 * @returns {Promise<Array>} Array of star level progression objects
 */
export const loadFamiliarProgression = async () => {
  try {
    const response = await fetch('/data/familiar-progression.json');
    const data = await response.json();
    return data.starLevels || [];
  } catch (error) {
    logger.error('Failed to load familiar progression', { error });
    return [];
  }
};

/**
 * Custom hook to load and cache all familiar-related data
 * @returns {{
 *   familiarsData: Array,
 *   primeFamiliarsData: Array,
 *   categoriesData: Object,
 *   progressionData: Array,
 *   loading: boolean,
 *   error: string|null
 * }}
 */
export const useFamiliarsData = () => {
  const [familiarsData, setFamiliarsData] = useState([]);
  const [primeFamiliarsData, setPrimeFamiliarsData] = useState([]);
  const [categoriesData, setCategoriesData] = useState({});
  const [progressionData, setProgressionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        logger.debug('Loading familiar data...');

        // Load all data in parallel
        const [familiars, primeFamiliars, categories, progression] = await Promise.all([
          loadFamiliarsDatabase(),
          loadPrimeFamiliarsDatabase(),
          loadFamiliarCategories(),
          loadFamiliarProgression()
        ]);

        setFamiliarsData(familiars);
        setPrimeFamiliarsData(primeFamiliars);
        setCategoriesData(categories);
        setProgressionData(progression);
        setError(null);

        logger.info('Familiar data loaded successfully', {
          familiarsCount: familiars.length,
          primeFamiliarsCount: primeFamiliars.length,
          progressionLevels: progression.length
        });
      } catch (err) {
        logger.error('Failed to load familiar data', { error: err });
        setError(err.message || 'Failed to load familiar data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return {
    familiarsData,
    primeFamiliarsData,
    categoriesData,
    progressionData,
    loading,
    error
  };
};

/**
 * Custom hook to load only base familiars data (lighter weight)
 * @returns {{familiarsData: Array, loading: boolean, error: string|null}}
 */
export const useFamiliars = () => {
  const [familiarsData, setFamiliarsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await loadFamiliarsDatabase();
        setFamiliarsData(data);
        setError(null);
      } catch (err) {
        logger.error('Failed to load familiars', { error: err });
        setError(err.message || 'Failed to load familiars');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return { familiarsData, loading, error };
};
