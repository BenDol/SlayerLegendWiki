import React, { useState, useEffect } from 'react';
import { formatCharCount, isNearLimit, isOverLimit } from '../utils/validation';

/**
 * ValidatedInput Component
 *
 * A text input with built-in validation, character counter, and error display
 *
 * @param {object} props
 * @param {string} props.value - Input value
 * @param {function} props.onChange - Change handler (receives event)
 * @param {function} props.validator - Validation function that returns { valid, error, sanitized }
 * @param {string} props.placeholder - Placeholder text
 * @param {number} props.maxLength - Maximum character length
 * @param {boolean} props.required - Whether field is required
 * @param {boolean} props.showCounter - Show character counter (default: true for maxLength)
 * @param {boolean} props.validateOnBlur - Only validate after blur (default: false)
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.label - Optional label for the input
 */
const ValidatedInput = ({
  value,
  onChange,
  validator,
  placeholder = '',
  maxLength,
  required = false,
  showCounter = !!maxLength,
  validateOnBlur = false,
  className = '',
  label = null,
  ...rest
}) => {
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState(null);

  // Validate on value change (if not validateOnBlur mode)
  useEffect(() => {
    if (!validateOnBlur && touched && validator) {
      const result = validator(value);
      setError(result.valid ? null : result.error);
    }
  }, [value, validator, touched, validateOnBlur]);

  const handleBlur = () => {
    setTouched(true);
    if (validator) {
      const result = validator(value);
      setError(result.valid ? null : result.error);
    }
  };

  const handleChange = (e) => {
    // If validateOnBlur is false, clear error while typing
    if (!validateOnBlur) {
      setTouched(true);
    }
    onChange(e);
  };

  const currentLength = value?.length || 0;
  const isNear = maxLength && isNearLimit(currentLength, maxLength);
  const isOver = maxLength && isOverLimit(currentLength, maxLength);

  // Input styling based on validation state
  const inputClasses = `
    px-3 py-2
    bg-white dark:bg-gray-800
    border rounded-lg
    text-gray-900 dark:text-white text-sm
    focus:outline-none focus:ring-2
    placeholder-gray-400
    ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'}
    ${isOver && !error ? 'border-red-500' : ''}
    ${className}
  `.trim();

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          className={inputClasses}
          {...rest}
        />

        {/* Character counter */}
        {showCounter && maxLength && (
          <div
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${
              isOver ? 'text-red-500 font-semibold' :
              isNear ? 'text-yellow-600 dark:text-yellow-500' :
              'text-gray-400'
            }`}
          >
            {formatCharCount(currentLength, maxLength)}
          </div>
        )}
      </div>

      {/* Error message */}
      {touched && error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Warning message for near limit */}
      {touched && !error && isNear && !isOver && (
        <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-500">
          Approaching character limit
        </p>
      )}
    </div>
  );
};

export default ValidatedInput;
