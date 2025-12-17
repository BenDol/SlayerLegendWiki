/**
 * Dynamic Data Registry - Central registry for all data sources
 * Supports multiple data structure patterns and provides rich metadata display
 *
 * Supported Patterns:
 * 1. Flat arrays: [{id, name, ...}]
 * 2. Nested arrays: {key: [{id, name, ...}]}
 * 3. Nested objects: {key: {subkey: {...}}}
 * 4. Arrays without IDs: [{level, ...}] - uses index as ID
 *
 * Usage in markdown:
 * <!-- data:SOURCE:ID:TEMPLATE -->
 * <!-- data:spirits:1:card -->
 * <!-- data:stages:50:inline -->
 */

const dataRegistry = {
  // Registered data sources
  sources: {},

  /**
   * Register a data source with enhanced configuration
   * @param {string} key - Unique identifier (e.g., 'spirits', 'skills')
   * @param {Object} config - Configuration object
   * @param {string} config.file - Path to JSON file
   * @param {string} config.label - Display name for UI
   * @param {string|null} [config.idField='id'] - Field for ID, or null to use array index
   * @param {Object} config.display - Display configuration
   * @param {string} config.display.primary - Primary display field (shown bold)
   * @param {string[]} [config.display.secondary] - Secondary fields (shown as subtitle)
   * @param {string[]} [config.display.badges] - Badge fields (shown as tags)
   * @param {string} [config.dataPath] - Path to data in JSON (null = root array)
   * @param {string[]} [config.searchFields] - Fields to search (defaults to display fields)
   * @param {Function} [config.filter] - Custom filter function
   * @param {string} [config.type='array'] - Data type: 'array', 'object', 'nested'
   * @param {string} [config.icon] - Optional icon/emoji for UI
   * @param {string} [config.description] - Description for UI tooltip
   */
  register(key, config) {
    // Validate required fields
    if (!config.file || !config.label) {
      throw new Error(`Data source "${key}" must have file and label`);
    }

    if (!config.display || !config.display.primary) {
      throw new Error(`Data source "${key}" must have display.primary field`);
    }

    this.sources[key] = {
      key,
      file: config.file,
      label: config.label,
      idField: config.idField !== undefined ? config.idField : 'id',
      display: {
        primary: config.display.primary,
        secondary: config.display.secondary || [],
        badges: config.display.badges || [],
      },
      dataPath: config.dataPath,
      searchFields: config.searchFields || [
        config.display.primary,
        ...(config.display.secondary || []),
      ],
      filter: config.filter,
      type: config.type || 'array',
      icon: config.icon,
      description: config.description,
      cache: null,
      cacheTime: null,
    };
  },

  /**
   * Get all registered sources
   * @returns {Object} Map of source key to config
   */
  getSources() {
    return this.sources;
  },

  /**
   * Get a specific source config
   * @param {string} key - Source key
   * @returns {Object|null} Source config or null
   */
  getSource(key) {
    return this.sources[key] || null;
  },

  /**
   * Fetch and normalize data from a source
   * Converts all data types into a uniform array format for the UI
   * @param {string} key - Source key
   * @returns {Promise<Array>} Array of normalized data items
   */
  async fetchData(key) {
    const source = this.sources[key];
    if (!source) {
      throw new Error(`Data source "${key}" not registered`);
    }

    // Check cache (5 minute TTL)
    const now = Date.now();
    if (source.cache && source.cacheTime && (now - source.cacheTime) < 5 * 60 * 1000) {
      return source.cache;
    }

    // Fetch from file
    const response = await fetch(source.file);
    if (!response.ok) {
      throw new Error(`Failed to fetch data from ${source.file}`);
    }

    const data = await response.json();

    // Extract and normalize data based on type
    let items = this.normalizeData(data, source);

    // Cache the result
    source.cache = items;
    source.cacheTime = now;

    return items;
  },

  /**
   * Normalize data into array format
   * Handles different data structures and adds metadata
   * @param {*} data - Raw data from JSON
   * @param {Object} source - Source configuration
   * @returns {Array} Normalized array of items
   */
  normalizeData(data, source) {
    let rawData = data;

    // Extract data if dataPath specified
    if (source.dataPath) {
      const path = source.dataPath.split('.');
      for (const key of path) {
        rawData = rawData?.[key];
      }
    }

    // Handle different data types
    if (source.type === 'array' || Array.isArray(rawData)) {
      return this.normalizeArray(rawData, source);
    } else if (source.type === 'object' || typeof rawData === 'object') {
      return this.normalizeObject(rawData, source);
    }

    throw new Error(`Unable to normalize data from ${source.file}`);
  },

  /**
   * Normalize array data
   * @param {Array} data - Array data
   * @param {Object} source - Source configuration
   * @returns {Array} Normalized items
   */
  normalizeArray(data, source) {
    if (!Array.isArray(data)) {
      throw new Error(`Expected array data for ${source.key}`);
    }

    return data.map((item, index) => {
      // Use specified ID field, or fallback to index
      const id = source.idField ? item[source.idField] : index;

      return {
        ...item,
        _id: id, // Normalized ID
        _index: index,
        _source: source.key,
      };
    });
  },

  /**
   * Normalize object data (key-value pairs)
   * Converts object entries into array items
   * @param {Object} data - Object data
   * @param {Object} source - Source configuration
   * @returns {Array} Normalized items
   */
  normalizeObject(data, source) {
    if (typeof data !== 'object' || data === null) {
      throw new Error(`Expected object data for ${source.key}`);
    }

    return Object.entries(data).map(([key, value], index) => {
      // For object data, use the key as the ID
      const id = source.idField ? value[source.idField] : key;

      return {
        ...value,
        _id: id,
        _key: key, // Original object key
        _index: index,
        _source: source.key,
      };
    });
  },

  /**
   * Find a specific item in a data source
   * @param {string} key - Source key
   * @param {string|number} id - Item identifier
   * @returns {Promise<Object|null>} Found item or null
   */
  async findItem(key, id) {
    const source = this.sources[key];
    if (!source) {
      return null;
    }

    const items = await this.fetchData(key);
    const item = items.find(item => {
      // Try matching against _id (normalized ID)
      return item._id === id || String(item._id) === String(id);
    });

    return item || null;
  },

  /**
   * Search items in a data source
   * Searches across all configured search fields
   * @param {string} key - Source key
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching items
   */
  async searchItems(key, query) {
    const source = this.sources[key];
    if (!source) {
      return [];
    }

    const items = await this.fetchData(key);

    if (!query) {
      return items;
    }

    const lowerQuery = query.toLowerCase();

    // Use custom filter if provided
    if (source.filter) {
      return items.filter(item => source.filter(item, lowerQuery));
    }

    // Search across all configured search fields
    return items.filter(item => {
      return source.searchFields.some(field => {
        const value = this.getNestedValue(item, field);
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(lowerQuery);
      });
    });
  },

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Object to search
   * @param {string} path - Dot-separated path (e.g., 'skill.name')
   * @returns {*} Value or null
   */
  getNestedValue(obj, path) {
    if (!path) return null;
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      if (value === null || value === undefined) return null;
      value = value[key];
    }
    return value;
  },

  /**
   * Get display info for an item
   * Returns formatted display strings for UI
   * @param {string} key - Source key
   * @param {Object} item - Data item
   * @returns {Object} Display info
   */
  getDisplayInfo(key, item) {
    const source = this.sources[key];
    if (!source) return null;

    const primary = this.getNestedValue(item, source.display.primary);
    const secondary = source.display.secondary.map(field => ({
      field,
      value: this.getNestedValue(item, field),
    })).filter(s => s.value !== null && s.value !== undefined);

    const badges = source.display.badges.map(field => ({
      field,
      value: this.getNestedValue(item, field),
    })).filter(b => b.value !== null && b.value !== undefined);

    return {
      id: item._id,
      primary,
      secondary,
      badges,
      icon: source.icon,
    };
  },

  /**
   * Clear cache for a source or all sources
   * @param {string} [key] - Optional source key. If omitted, clears all caches.
   */
  clearCache(key) {
    if (key) {
      const source = this.sources[key];
      if (source) {
        source.cache = null;
        source.cacheTime = null;
      }
    } else {
      Object.values(this.sources).forEach(source => {
        source.cache = null;
        source.cacheTime = null;
      });
    }
  }
};

export default dataRegistry;
