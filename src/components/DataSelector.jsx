import { useState, useEffect } from 'react';
import dataRegistry from '../utils/dataRegistry';

/**
 * Dynamic DataSelector - UI component for selecting data to inject into markdown
 * Supports both full objects and individual field selection
 *
 * @param {Function} onSelect - Callback when data is selected: (source, id, field, template) => void
 * @param {Function} onClose - Callback to close the selector
 */
const DataSelector = ({ onSelect, onClose }) => {
  const [selectedSource, setSelectedSource] = useState(null);
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedField, setSelectedField] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('card');
  const [availableFields, setAvailableFields] = useState([]);

  const sources = dataRegistry.getSources();
  const sourceKeys = Object.keys(sources);

  // Categorize sources based on their labels/descriptions
  const categorizedSources = {
    'Characters & Companions': sourceKeys.filter(key =>
      ['spirits', 'spirit-upgrades', 'companion-characters', 'companions', 'familiars', 'classes', 'promotions', 'appearance-clothing'].includes(key)
    ),
    'Combat & Skills': sourceKeys.filter(key =>
      ['skills'].includes(key)
    ),
    'Equipment & Items': sourceKeys.filter(key =>
      ['equipment', 'relics', 'equipment-drops'].includes(key)
    ),
    'Content & Progression': sourceKeys.filter(key =>
      ['adventures', 'campaigns', 'quests'].includes(key)
    ),
    'Game Systems': sourceKeys.filter(key =>
      ['formulas', 'drop-tables'].includes(key)
    )
  };

  // Filter sources based on search
  const getFilteredSources = () => {
    if (!sourceSearchQuery.trim()) {
      return categorizedSources;
    }

    const query = sourceSearchQuery.toLowerCase();
    const filtered = {};

    Object.entries(categorizedSources).forEach(([category, keys]) => {
      const matchingKeys = keys.filter(key => {
        const source = sources[key];
        return source.label.toLowerCase().includes(query) ||
               source.description?.toLowerCase().includes(query);
      });
      if (matchingKeys.length > 0) {
        filtered[category] = matchingKeys;
      }
    });

    return filtered;
  };

  const filteredSourceCategories = getFilteredSources();

  // Load items when source changes
  useEffect(() => {
    if (!selectedSource) {
      setItems([]);
      setFilteredItems([]);
      return;
    }

    const loadItems = async () => {
      setLoading(true);
      try {
        const data = await dataRegistry.fetchData(selectedSource);
        setItems(data);
        setFilteredItems(data);
      } catch (err) {
        console.error('Failed to load data:', err);
        setItems([]);
        setFilteredItems([]);
      }
      setLoading(false);
    };

    loadItems();
    setSelectedItem(null);
    setSelectedField(null);
  }, [selectedSource]);

  // Filter items when search changes
  useEffect(() => {
    if (!selectedSource || !items.length) {
      return;
    }

    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setFilteredItems(items);
        return;
      }

      const results = await dataRegistry.searchItems(selectedSource, searchQuery);
      setFilteredItems(results);
    };

    performSearch();
  }, [searchQuery, items, selectedSource]);

  // Extract available fields when item is selected
  useEffect(() => {
    if (!selectedItem) {
      setAvailableFields([]);
      return;
    }

    const fields = extractFields(selectedItem);
    setAvailableFields(fields);
  }, [selectedItem]);

  /**
   * Extract all fields from an object recursively
   * Returns array of {path, value, type} objects
   */
  const extractFields = (obj, prefix = '') => {
    const fields = [];
    const excludeKeys = ['_id', '_index', '_source', '_key']; // Internal metadata

    const traverse = (current, path) => {
      if (current === null || current === undefined) return;

      const type = Array.isArray(current) ? 'array' : typeof current;

      // Add current value
      if (path && !excludeKeys.includes(path.split('.').pop())) {
        fields.push({
          path,
          value: current,
          type,
          displayValue: formatValue(current),
        });
      }

      // Recurse for objects (but not too deep to avoid huge lists)
      if (type === 'object' && path.split('.').length < 4) {
        Object.keys(current).forEach(key => {
          if (!excludeKeys.includes(key)) {
            const newPath = path ? `${path}.${key}` : key;
            traverse(current[key], newPath);
          }
        });
      }

      // Handle arrays (show first few items)
      if (type === 'array' && path.split('.').length < 3) {
        current.slice(0, 3).forEach((item, idx) => {
          const newPath = `${path}[${idx}]`;
          traverse(item, newPath);
        });
      }
    };

    traverse(obj, prefix);

    // Sort by path length (simpler fields first)
    return fields.sort((a, b) => {
      const aDepth = a.path.split(/[.\[]/).length;
      const bDepth = b.path.split(/[.\[]/).length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.path.localeCompare(b.path);
    });
  };

  /**
   * Format value for display
   */
  const formatValue = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return `Array(${value.length})`;
      return 'Object';
    }
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return String(value);
  };

  /**
   * Get icon for field type
   */
  const getTypeIcon = (type) => {
    switch (type) {
      case 'string': return '📝';
      case 'number': return '🔢';
      case 'boolean': return '✓';
      case 'array': return '📋';
      case 'object': return '📦';
      default: return '•';
    }
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setSelectedField(null);
  };

  const handleFieldSelect = (field) => {
    setSelectedField(field);
  };

  const handleInsert = () => {
    if (!selectedSource || !selectedItem) return;

    if (selectedField) {
      // Insert specific field
      onSelect(selectedSource, selectedItem._id, selectedField.path, 'field');
    } else {
      // Insert whole object with template
      onSelect(selectedSource, selectedItem._id, null, selectedTemplate);
    }
  };

  const templates = [
    { value: 'card', label: 'Card', description: 'Rich display with all information' },
    { value: 'inline', label: 'Inline', description: 'Compact single-line display' },
    { value: 'table', label: 'Table', description: 'Table row format' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full h-[94vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Insert Data from Database
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select a data source, item, and optionally a specific field to inject dynamic content.
          </p>

          {/* Breadcrumb */}
          {(selectedSource || selectedItem || selectedField) && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4 flex-wrap">
              {selectedSource && (
                <>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {sources[selectedSource].label}
                  </span>
                  {selectedItem && <span>›</span>}
                </>
              )}
              {selectedItem && (
                <>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {dataRegistry.getDisplayInfo(selectedSource, selectedItem).primary}
                  </span>
                  {selectedField && <span>›</span>}
                </>
              )}
              {selectedField && (
                <span className="font-medium text-blue-600 dark:text-blue-400 font-mono text-xs">
                  {selectedField.path}
                </span>
              )}
            </div>
          )}

          {/* Source Selector with Search */}
          {!selectedItem && (
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data Source
              </label>

              {/* Search for sources */}
              <input
                type="text"
                value={sourceSearchQuery}
                onChange={(e) => setSourceSearchQuery(e.target.value)}
                placeholder="Search data sources..."
                className="w-full mb-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* Categorized source list - compact scrollable */}
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
                {Object.entries(filteredSourceCategories).map(([category, keys]) => (
                  <div key={category} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                    {/* Category Header */}
                    <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide sticky top-0 z-10">
                      {category}
                    </div>

                    {/* Source Buttons in Category - 3 columns */}
                    <div className="grid grid-cols-3 gap-1.5 p-2">
                      {keys.map(key => {
                        const source = sources[key];
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              setSelectedSource(key);
                              setSearchQuery('');
                              setSourceSearchQuery('');
                            }}
                            className={`px-3 py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                              selectedSource === key
                                ? 'bg-blue-500 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                            title={source.description || source.label}
                          >
                            {source.icon && <span className="text-sm flex-shrink-0">{source.icon}</span>}
                            <span className="truncate">{source.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {sourceSearchQuery && Object.keys(filteredSourceCategories).length === 0 && (
                <div className="text-center py-3 text-sm text-gray-500 dark:text-gray-400">
                  No matches for "{sourceSearchQuery}"
                </div>
              )}
            </div>
          )}

          {/* Template Selector - Only show when no field selected */}
          {selectedItem && !selectedField && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Display Template (for full object)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {templates.map(template => (
                  <button
                    key={template.value}
                    onClick={() => setSelectedTemplate(template.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      selectedTemplate === template.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    title={template.description}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search - Only show when selecting item */}
          {selectedSource && !selectedItem && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Items
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${sources[selectedSource].label.toLowerCase()}...`}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Item Selection */}
          {selectedSource && !selectedItem && (
            <>
              {loading && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Loading items...
                  </p>
                </div>
              )}

              {!loading && filteredItems.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No items match your search' : 'No items found'}
                  </p>
                </div>
              )}

              {!loading && filteredItems.length > 0 && (
                <div className="grid grid-cols-1 gap-3">
                  {filteredItems.map((item) => {
                    const displayInfo = dataRegistry.getDisplayInfo(selectedSource, item);

                    return (
                      <button
                        key={item._index}
                        onClick={() => handleSelectItem(item)}
                        className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-left group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {displayInfo.icon && (
                              <span className="text-lg flex-shrink-0">{displayInfo.icon}</span>
                            )}
                            <div className="font-semibold text-gray-900 dark:text-white truncate">
                              {displayInfo.primary}
                            </div>
                          </div>

                          {displayInfo.secondary.length > 0 && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
                              {displayInfo.secondary.slice(0, 2).map((sec, idx) => (
                                <div key={idx} className="truncate">
                                  <span className="font-medium capitalize">{sec.field}: </span>
                                  <span>{String(sec.value)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                            ID: {displayInfo.id}
                          </div>
                        </div>

                        <div className="ml-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Field Selection */}
          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Select Field (or insert full object)
                </h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ← Back to items
                </button>
              </div>

              {/* Full Object Option */}
              <button
                onClick={() => setSelectedField(null)}
                className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                  !selectedField
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📦</span>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      Full Object ({selectedTemplate} template)
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Insert complete data with rich display
                    </div>
                  </div>
                </div>
              </button>

              {/* Individual Fields */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Or select a specific field:
                </div>
                {availableFields.map((field, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleFieldSelect(field)}
                    className={`w-full p-3 rounded-lg border transition-colors text-left ${
                      selectedField?.path === field.path
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg flex-shrink-0">{getTypeIcon(field.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-gray-900 dark:text-white">
                          {field.path}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                          {field.displayValue}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                        {field.type}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No source selected */}
          {!selectedSource && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Select a data source to begin
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {selectedSource && !selectedItem && (
                <span>
                  {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} available
                </span>
              )}
              {selectedItem && (
                <span className="font-mono">
                  {selectedField
                    ? `${selectedSource}:${selectedItem._id}:${selectedField.path}`
                    : `${selectedSource}:${selectedItem._id}:${selectedTemplate}`
                  }
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              {selectedItem && (
                <button
                  onClick={handleInsert}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                >
                  Insert
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataSelector;
