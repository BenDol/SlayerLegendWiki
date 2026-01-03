/**
 * Client-Side Validation Utilities
 * Mirrors server-side validation for consistency
 *
 * NOTE: These limits must match functions/_shared/validationRules.js
 * Client-side validation is for UX only - server-side is the source of truth
 */

/**
 * String length limits (must match server-side)
 */
export const STRING_LIMITS = {
  BUILD_NAME_MIN: 1,
  BUILD_NAME_MAX: 100,
  USERNAME_MIN: 1,
  USERNAME_MAX: 39,
  WEAPON_NAME_MIN: 1,
  WEAPON_NAME_MAX: 100,
  COMPLETION_EFFECT_MIN: 1,
  COMPLETION_EFFECT_MAX: 500,
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 50,
  EDIT_REASON_MAX: 500,
  PAGE_CONTENT_MAX: 1048576, // 1MB
};

/**
 * Validation patterns (must match server-side)
 */
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  NAME_PATTERN: /^[a-zA-Z0-9\s\-_.'()]+$/,
};

/**
 * Validation error messages (must match server-side)
 */
export const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: (field) => `${field} is required`,
  TOO_SHORT: (field, min) => `${field} must be at least ${min} characters`,
  TOO_LONG: (field, max) => `${field} must be no more than ${max} characters`,
  INVALID_FORMAT: (field) => `${field} has an invalid format`,
  BUILD_NAME_REQUIRED: 'Build name is required',
  BUILD_NAME_TOO_LONG: `Build name must be no more than ${STRING_LIMITS.BUILD_NAME_MAX} characters`,
  BUILD_NAME_INVALID_CHARS: 'Build name contains invalid characters. Only letters, numbers, spaces, and basic punctuation are allowed.',
  EMAIL_INVALID: 'Invalid email address format',
  DISPLAY_NAME_TOO_SHORT: `Display name must be at least ${STRING_LIMITS.DISPLAY_NAME_MIN} characters`,
  DISPLAY_NAME_TOO_LONG: `Display name must be no more than ${STRING_LIMITS.DISPLAY_NAME_MAX} characters`,
  CONTENT_TOO_LARGE: `Content is too large (max ${STRING_LIMITS.PAGE_CONTENT_MAX / 1024}KB)`,
};

/**
 * Validation result type
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {*} [sanitized] - Sanitized value
 */

/**
 * Validate string length
 * @param {string} value - Value to validate
 * @param {number} min - Minimum length
 * @param {number} max - Maximum length
 * @param {string} fieldName - Field name for error messages
 * @returns {ValidationResult}
 */
export function validateStringLength(value, min, max, fieldName) {
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `${fieldName} must be a string`,
    };
  }

  const trimmed = value.trim();

  if (min > 0 && trimmed.length < min) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.TOO_SHORT(fieldName, min),
    };
  }

  if (trimmed.length > max) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.TOO_LONG(fieldName, max),
    };
  }

  return {
    valid: true,
    sanitized: trimmed,
  };
}

/**
 * Validate build name (for all builders)
 * @param {string} name - Build name
 * @returns {ValidationResult}
 */
export function validateBuildName(name) {
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.BUILD_NAME_REQUIRED,
    };
  }

  const result = validateStringLength(
    name,
    STRING_LIMITS.BUILD_NAME_MIN,
    STRING_LIMITS.BUILD_NAME_MAX,
    'Build name'
  );

  if (!result.valid) return result;

  // Check for valid characters
  if (!VALIDATION_PATTERNS.NAME_PATTERN.test(result.sanitized)) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.BUILD_NAME_INVALID_CHARS,
    };
  }

  return result;
}

/**
 * Validate weapon name (for grid submissions)
 * @param {string} name - Weapon name
 * @returns {ValidationResult}
 */
export function validateWeaponName(name) {
  return validateStringLength(
    name,
    STRING_LIMITS.WEAPON_NAME_MIN,
    STRING_LIMITS.WEAPON_NAME_MAX,
    'Weapon name'
  );
}

/**
 * Validate email address
 * @param {string} email - Email address
 * @returns {ValidationResult}
 */
export function validateEmail(email) {
  if (!email || email.trim().length === 0) {
    return {
      valid: false,
      error: 'Email is required',
    };
  }

  const trimmed = email.trim();

  if (!VALIDATION_PATTERNS.EMAIL.test(trimmed)) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.EMAIL_INVALID,
    };
  }

  return {
    valid: true,
    sanitized: trimmed,
  };
}

/**
 * Validate display name (for anonymous edits)
 * @param {string} name - Display name
 * @returns {ValidationResult}
 */
export function validateDisplayName(name) {
  const result = validateStringLength(
    name,
    STRING_LIMITS.DISPLAY_NAME_MIN,
    STRING_LIMITS.DISPLAY_NAME_MAX,
    'Display name'
  );

  if (!result.valid) return result;

  // Strip HTML tags for safety
  const sanitized = result.sanitized.replace(/<[^>]*>/g, '');

  if (sanitized.length < STRING_LIMITS.DISPLAY_NAME_MIN) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.DISPLAY_NAME_TOO_SHORT,
    };
  }

  return {
    valid: true,
    sanitized,
  };
}

/**
 * Check if build name would be valid (for real-time feedback)
 * Returns error message or null if valid
 * @param {string} name - Build name
 * @returns {string|null} - Error message or null
 */
export function getBuildNameError(name) {
  const result = validateBuildName(name);
  return result.valid ? null : result.error;
}

/**
 * Format character count for display
 * @param {number} current - Current character count
 * @param {number} max - Maximum character count
 * @returns {string} - Formatted count (e.g., "45/100")
 */
export function formatCharCount(current, max) {
  return `${current}/${max}`;
}

/**
 * Check if character count is near limit (for warning styling)
 * @param {number} current - Current character count
 * @param {number} max - Maximum character count
 * @param {number} warningThreshold - Percentage threshold (default 80%)
 * @returns {boolean} - True if near limit
 */
export function isNearLimit(current, max, warningThreshold = 0.8) {
  return current / max >= warningThreshold;
}

/**
 * Check if character count exceeds limit (for error styling)
 * @param {number} current - Current character count
 * @param {number} max - Maximum character count
 * @returns {boolean} - True if over limit
 */
export function isOverLimit(current, max) {
  return current > max;
}

/**
 * Validate completion effect percentage
 * Accepts formats: "2%", "2.5%", "2", "2.5"
 * @param {string} value - Percentage value
 * @param {string} fieldName - Field name for error messages
 * @returns {ValidationResult}
 */
export function validateCompletionEffect(value, fieldName = 'Completion effect') {
  if (!value || value.trim().length === 0) {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }

  const trimmed = value.trim();

  // Remove % sign if present
  const numericValue = trimmed.replace('%', '').trim();

  // Check if it's a valid number
  if (!/^\d+(\.\d+)?$/.test(numericValue)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number (e.g., 2.5 or 2.5%)`,
    };
  }

  const parsed = parseFloat(numericValue);

  // Reasonable range check (min 0.1%)
  if (parsed < 0.1) {
    return {
      valid: false,
      error: `${fieldName} must be at least 0.1%`,
    };
  }

  // Check decimal places (max 2)
  if (numericValue.includes('.')) {
    const decimalPart = numericValue.split('.')[1];
    if (decimalPart && decimalPart.length > 2) {
      return {
        valid: false,
        error: `${fieldName} can have at most 2 decimal places`,
      };
    }
  }

  return {
    valid: true,
    sanitized: parsed, // Return numeric value without % sign
  };
}
