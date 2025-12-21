import { useState, useEffect } from 'react';
import dataRegistry from '../utils/dataRegistry';
import { createLogger } from '../utils/logger';

const logger = createLogger('DataInjector');

/**
 * DataInjector - Component that renders injected data from databases
 * Supports both full object rendering and specific field extraction
 *
 * @param {string} source - Data source key (e.g., 'spirits', 'skills')
 * @param {string|number} id - Item identifier
 * @param {string} fieldOrTemplate - Either a template ('card', 'inline', 'table') or field path ('name', 'skill.cooldown')
 * @param {boolean} showId - Whether to show the ID number (default: true, only affects inline template)
 */
const DataInjector = ({ source, id, fieldOrTemplate = 'card', showId = true }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine if this is a template or field path
  const templates = ['card', 'inline', 'table'];
  const isTemplate = templates.includes(fieldOrTemplate);
  const isFieldPath = !isTemplate;

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const loadData = async () => {
      try {
        if (!isMounted) return;

        setLoading(true);
        setError(null);

        const item = await dataRegistry.findItem(source, id);

        if (!isMounted) return;

        if (!item) {
          const errorMsg = `Item "${id}" not found in "${source}" database`;
          logger.error('${errorMsg}');
          setError(errorMsg);
          setLoading(false);
          return;
        }

        setData(item);
        setLoading(false);
      } catch (err) {
        logger.error('Error loading data (attempt ${retryCount + 1}):', { error: err });
        logger.error('Error details - source: "${source}", id: "${id}"', { error: err });

        if (!isMounted) return;

        // Retry on fetch failures
        if (retryCount < maxRetries && err.message.includes('fetch')) {
          retryCount++;
          logger.debug('Retrying in ${retryCount * 500}ms...');
          setTimeout(() => {
            if (isMounted) loadData();
          }, retryCount * 500); // Exponential backoff: 500ms, 1000ms, 1500ms
        } else {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [source, id]);

  if (loading) {
    return (
      <div className="inline-block p-2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
      </div>
    );
  }

  if (error) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
        <span>❌</span>
        <span>{error}</span>
      </span>
    );
  }

  if (!data) {
    return null;
  }

  // If field path, extract and render just that field
  if (isFieldPath) {
    const fieldValue = dataRegistry.getNestedValue(data, fieldOrTemplate);

    if (fieldValue === null || fieldValue === undefined) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-400">
          <span>⚠️</span>
          <span>Field "{fieldOrTemplate}" not found</span>
        </span>
      );
    }

    return <FieldTemplate value={fieldValue} field={fieldOrTemplate} source={source} id={id} />;
  }

  // Otherwise, render based on template type
  switch (fieldOrTemplate) {
    case 'inline':
      return <InlineTemplate data={data} source={source} showId={showId} />;
    case 'table':
      return <TableTemplate data={data} source={source} />;
    case 'card':
    default:
      return <CardTemplate data={data} source={source} />;
  }
};

// Field template - Display a single field value inline
const FieldTemplate = ({ value, field, source, id }) => {
  // Format the value based on type
  const formatValue = (val) => {
    if (typeof val === 'object') {
      if (Array.isArray(val)) return `[${val.length} items]`;
      return '[Object]';
    }
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  const displayValue = formatValue(value);

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-sm font-medium"
      title={`${source}:${id}:${field}`}
    >
      {displayValue}
    </span>
  );
};

// Card template - Rich display with all info
const CardTemplate = ({ data, source }) => {
  const sourceConfig = dataRegistry.getSource(source);
  const displayInfo = dataRegistry.getDisplayInfo(source, data);
  const imageUrl = data.image || (data.sprites && data.sprites[0]?.image);

  return (
    <div className="my-4 p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-16 h-16 object-contain flex-shrink-0" style={{ margin: 0 }} />
          ) : (
            displayInfo?.icon && <span className="text-2xl">{displayInfo.icon}</span>
          )}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {displayInfo?.primary || data.name || data.title}
          </h3>
        </div>
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
          {sourceConfig?.label || source}
        </span>
      </div>

      {/* Secondary fields */}
      {displayInfo?.secondary && displayInfo.secondary.length > 0 && (
        <div className="space-y-2 mb-4">
          {displayInfo.secondary.map((sec, idx) => (
            <div key={idx} className="text-sm flex">
              <span className="font-medium text-gray-700 dark:text-gray-300 capitalize min-w-[120px]">
                {sec.field.replace(/_/g, ' ').replace(/\./g, ' ')}
              </span>
              <span className="ml-4 text-gray-600 dark:text-gray-400">
                : {String(sec.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Badges */}
      {displayInfo?.badges && displayInfo.badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {displayInfo.badges.map((badge, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
            >
              {String(badge.value)}
            </span>
          ))}
        </div>
      )}

      {/* All fields */}
      <div className="space-y-2">
        {Object.entries(data).filter(([key]) => !key.startsWith('_') && key !== 'image' && key !== 'sprites').map(([key, value]) => {
          // Handle nested objects (like skill)
          if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
              return (
                <div key={key} className="text-sm flex">
                  <span className="font-medium text-gray-700 dark:text-gray-300 capitalize min-w-[120px]">
                    {key.replace(/_/g, ' ').replace(/\./g, ' ')}
                  </span>
                  <span className="ml-4 text-gray-600 dark:text-gray-400">
                    : {value.length} items
                  </span>
                </div>
              );
            }

            // Render nested object fields (like skill.type, skill.name, etc.)
            return (
              <div key={key} className="text-sm">
                <div className="font-medium text-gray-700 dark:text-gray-300 capitalize mb-2">
                  {key.replace(/_/g, ' ').replace(/\./g, ' ')}:
                </div>
                <div className="ml-4 space-y-1.5">
                  {Object.entries(value).map(([subKey, subValue]) => {
                    if (typeof subValue === 'object') return null;
                    return (
                      <div key={subKey} className="flex">
                        <span className="font-medium text-gray-600 dark:text-gray-400 capitalize min-w-[100px]">
                          {subKey.replace(/_/g, ' ').replace(/\./g, ' ')}
                        </span>
                        <span className="ml-3 text-gray-600 dark:text-gray-400">
                          : {String(subValue)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <div key={key} className="text-sm flex">
              <span className="font-medium text-gray-700 dark:text-gray-300 capitalize min-w-[120px]">
                {key.replace(/_/g, ' ').replace(/\./g, ' ')}
              </span>
              <span className="ml-4 text-gray-600 dark:text-gray-400">
                : {String(value)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Data source: <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">{source}:{data._id}</code>
        </p>
      </div>
    </div>
  );
};

// Inline template - Compact single-line display with hover tooltip
const InlineTemplate = ({ data, source, showId = true }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const sourceConfig = dataRegistry.getSource(source);
  const displayInfo = dataRegistry.getDisplayInfo(source, data);
  const imageUrl = data.image || (data.sprites && data.sprites[0]?.image);

  return (
    <span className="relative inline-block">
      <span
        className="inline-flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-sm cursor-help transition-all hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:shadow-sm"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-5 h-5 object-contain flex-shrink-0" style={{ maxHeight: '20px', margin: 0 }} />
        ) : (
          displayInfo?.icon && <span>{displayInfo.icon}</span>
        )}
        <span className="font-medium">{displayInfo?.primary || data.name || data.title}</span>
        {showId && data._id && <span className="text-xs opacity-75">#{data._id}</span>}
      </span>

      {/* Tooltip with compact card view */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 w-72 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-700 rounded-lg shadow-xl overflow-hidden">
            {/* Header section with image and title */}
            <div className="flex p-2 border-b border-gray-200 dark:border-gray-700">
              {/* Image */}
              {imageUrl ? (
                <div className="flex-shrink-0">
                  <img src={imageUrl} alt="" className="w-12 h-12 object-contain" style={{ margin: 0 }} />
                </div>
              ) : (
                displayInfo?.icon && <span className="text-2xl flex-shrink-0">{displayInfo.icon}</span>
              )}

              {/* Title and badge */}
              <div className="flex flex-col justify-center min-w-0">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight mb-1" style={{ marginTop: 0 }}>
                  {displayInfo?.primary || data.name || data.title}
                </h4>
                <span className="inline-block px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded w-fit">
                  {sourceConfig?.label || source}
                </span>
              </div>
            </div>

            {/* Content section */}
            <div className="p-2">
              {/* Secondary fields */}
              {displayInfo?.secondary && displayInfo.secondary.length > 0 && (
                <div className="space-y-1 mb-2">
                  {displayInfo.secondary.slice(0, 3).map((sec, idx) => (
                    <div key={idx} className="text-xs flex">
                      <span className="font-medium text-gray-700 dark:text-gray-300 capitalize min-w-[100px]">
                        {sec.field.replace(/_/g, ' ').replace(/\./g, ' ')}
                      </span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">
                        : {String(sec.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Badges */}
              {displayInfo?.badges && displayInfo.badges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {displayInfo.badges.map((badge, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                    >
                      {String(badge.value)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
              <div className="border-8 border-transparent border-t-blue-200 dark:border-t-blue-700"></div>
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full">
                <div className="border-[7px] border-transparent border-t-white dark:border-t-gray-800"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
};

// Table template - Row format for tables
const TableTemplate = ({ data, source }) => {
  const sourceConfig = dataRegistry.getSource(source);

  return (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {Object.entries(data).filter(([key]) => !key.startsWith('_')).map(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              return null;
            }

            return (
              <tr key={key}>
                <td className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {key.replace(/_/g, ' ').replace(/\./g, ' ')}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                  {String(value)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default DataInjector;
