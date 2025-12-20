import { useState, useEffect } from 'react';
import { loadSpiritsDatabase } from '../utils/spiritSerialization';

/**
 * Custom hook to load and cache spirits database
 * @returns {{spiritsData: Array, loading: boolean, error: string|null}}
 */
export const useSpiritsData = () => {
  const [spiritsData, setSpiritsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await loadSpiritsDatabase();
        setSpiritsData(data);
        setError(null);
      } catch (err) {
        console.error('[useSpiritsData] Failed to load spirits data:', err);
        setError(err.message || 'Failed to load spirits data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return { spiritsData, loading, error };
};
