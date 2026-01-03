/**
 * Validation Rules and Limits
 * Centralized validation configuration for all user inputs
 *
 * IMPORTANT: These limits are enforced on BOTH client and server side
 */

/**
 * String length limits
 */
export const STRING_LIMITS = {
  // Build names (skill-builds, spirit-builds, battle-loadouts)
  BUILD_NAME_MIN: 1,
  BUILD_NAME_MAX: 100,

  // User identifiers
  USERNAME_MIN: 1,
  USERNAME_MAX: 39, // GitHub username max length
  USER_ID_MAX: 20, // GitHub user IDs are numeric but we store as string/number

  // Grid submission fields
  WEAPON_NAME_MIN: 1,
  WEAPON_NAME_MAX: 100,
  WEAPON_ID_MIN: 1,
  WEAPON_ID_MAX: 50,
  COMPLETION_EFFECT_MIN: 1,
  COMPLETION_EFFECT_MAX: 500,
  GRID_TYPE_MIN: 1,
  GRID_TYPE_MAX: 50,

  // Item IDs (generated IDs like "spirit-builds-1234567890-abc123def")
  ITEM_ID_MIN: 1,
  ITEM_ID_MAX: 100,

  // Spirit IDs (from data files like "ares_emperor_iii")
  SPIRIT_ID_MIN: 1,
  SPIRIT_ID_MAX: 100,

  // GitHub issue/comment fields
  ISSUE_TITLE_MIN: 1,
  ISSUE_TITLE_MAX: 256, // GitHub limit
  ISSUE_BODY_MAX: 65536, // GitHub body max is 65536 characters
  COMMENT_BODY_MAX: 65536,

  // Anonymous editing
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 50,
  EDIT_REASON_MAX: 500,
  PAGE_CONTENT_MAX: 1048576, // 1MB max for markdown content
  PAGE_TITLE_MIN: 1,
  PAGE_TITLE_MAX: 200,
  PAGE_ID_MIN: 1,
  PAGE_ID_MAX: 100,
  SECTION_NAME_MIN: 1,
  SECTION_NAME_MAX: 100,

  // Email
  EMAIL_MIN: 3,
  EMAIL_MAX: 254, // RFC 5321
};

/**
 * Array/Object limits
 */
export const COLLECTION_LIMITS = {
  // Build slots
  MAX_SPIRIT_SLOTS: 10, // Reasonable max for spirit builds
  MAX_SKILL_SLOTS: 50, // Reasonable max for skill builds
  MAX_INVENTORY_SLOTS: 20, // Soul weapon grid inventory

  // Grid cells
  MAX_GRID_CELLS: 500, // Soul weapon grid max cells

  // Labels array
  MAX_LABELS: 20,
  LABEL_LENGTH_MAX: 50,
};

/**
 * Data size limits (in bytes)
 */
export const DATA_SIZE_LIMITS = {
  // JSON payload limits
  MAX_REQUEST_BODY_SIZE: 2097152, // 2MB max request body
  MAX_BUILD_DATA_SIZE: 524288, // 512KB max for a single build
  MAX_SPIRIT_DATA_SIZE: 10240, // 10KB max for a single spirit config
};

/**
 * Rate limiting (handled separately but documented here)
 */
export const RATE_LIMITS = {
  ANONYMOUS_EDITS_PER_HOUR: 5,
  ANONYMOUS_EDITS_WINDOW_MINUTES: 60,
};

/**
 * Regex patterns for validation
 */
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Alphanumeric with hyphens, underscores (common for IDs)
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  // Alphanumeric with spaces and basic punctuation (for names)
  NAME_PATTERN: /^[a-zA-Z0-9\s\-_.'()]+$/,
  // GitHub username pattern
  GITHUB_USERNAME: /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/,
};

/**
 * Validation error messages
 */
export const VALIDATION_MESSAGES = {
  // Generic
  REQUIRED_FIELD: (field) => `${field} is required`,
  TOO_SHORT: (field, min) => `${field} must be at least ${min} characters`,
  TOO_LONG: (field, max) => `${field} must be no more than ${max} characters`,
  INVALID_FORMAT: (field) => `${field} has an invalid format`,
  INVALID_TYPE: (field, expectedType) => `${field} must be a ${expectedType}`,

  // Specific
  BUILD_NAME_REQUIRED: 'Build name is required',
  BUILD_NAME_TOO_LONG: `Build name must be no more than ${STRING_LIMITS.BUILD_NAME_MAX} characters`,
  EMAIL_INVALID: 'Invalid email address format',
  DISPLAY_NAME_TOO_SHORT: `Display name must be at least ${STRING_LIMITS.DISPLAY_NAME_MIN} characters`,
  DISPLAY_NAME_TOO_LONG: `Display name must be no more than ${STRING_LIMITS.DISPLAY_NAME_MAX} characters`,
  CONTENT_TOO_LARGE: `Content is too large (max ${STRING_LIMITS.PAGE_CONTENT_MAX / 1024}KB)`,
  REQUEST_TOO_LARGE: `Request body is too large (max ${DATA_SIZE_LIMITS.MAX_REQUEST_BODY_SIZE / 1024 / 1024}MB)`,
  TOO_MANY_SLOTS: (max) => `Too many slots (maximum ${max})`,
  PROFANITY_DETECTED: (field) => `${field} contains inappropriate language`,
};
