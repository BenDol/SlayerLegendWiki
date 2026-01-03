/**
 * Validation Utilities
 * Shared validation functions for both client and server side
 */

import {
  STRING_LIMITS,
  COLLECTION_LIMITS,
  DATA_SIZE_LIMITS,
  VALIDATION_PATTERNS,
  VALIDATION_MESSAGES,
} from './validationRules.js';

/**
 * Validation result type
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {*} [sanitized] - Sanitized value (trimmed, normalized)
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
      error: VALIDATION_MESSAGES.INVALID_TYPE(fieldName, 'string'),
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
 * Validate build name
 * @param {string} name - Build name
 * @returns {ValidationResult}
 */
export function validateBuildName(name) {
  const result = validateStringLength(
    name,
    STRING_LIMITS.BUILD_NAME_MIN,
    STRING_LIMITS.BUILD_NAME_MAX,
    'Build name'
  );

  if (!result.valid) return result;

  // Additional validation: check for valid characters
  if (!VALIDATION_PATTERNS.NAME_PATTERN.test(result.sanitized)) {
    return {
      valid: false,
      error: 'Build name contains invalid characters. Only letters, numbers, spaces, and basic punctuation are allowed.',
    };
  }

  return result;
}

/**
 * Validate username
 * @param {string} username - GitHub username
 * @returns {ValidationResult}
 */
export function validateUsername(username) {
  const result = validateStringLength(
    username,
    STRING_LIMITS.USERNAME_MIN,
    STRING_LIMITS.USERNAME_MAX,
    'Username'
  );

  if (!result.valid) return result;

  // GitHub username pattern validation
  if (!VALIDATION_PATTERNS.GITHUB_USERNAME.test(result.sanitized)) {
    return {
      valid: false,
      error: 'Invalid GitHub username format',
    };
  }

  return result;
}

/**
 * Validate user ID
 * @param {number|string} userId - GitHub user ID
 * @returns {ValidationResult}
 */
export function validateUserId(userId) {
  const numericId = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  if (isNaN(numericId) || numericId <= 0) {
    return {
      valid: false,
      error: 'User ID must be a positive number',
    };
  }

  if (numericId.toString().length > STRING_LIMITS.USER_ID_MAX) {
    return {
      valid: false,
      error: 'User ID is too large',
    };
  }

  return {
    valid: true,
    sanitized: numericId,
  };
}

/**
 * Validate email address
 * @param {string} email - Email address
 * @returns {ValidationResult}
 */
export function validateEmail(email) {
  const result = validateStringLength(
    email,
    STRING_LIMITS.EMAIL_MIN,
    STRING_LIMITS.EMAIL_MAX,
    'Email'
  );

  if (!result.valid) return result;

  if (!VALIDATION_PATTERNS.EMAIL.test(result.sanitized)) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.EMAIL_INVALID,
    };
  }

  return result;
}

/**
 * Validate item ID (generic ID string)
 * @param {string} id - Item ID
 * @param {string} fieldName - Field name for error messages
 * @returns {ValidationResult}
 */
export function validateItemId(id, fieldName = 'Item ID') {
  const result = validateStringLength(
    id,
    STRING_LIMITS.ITEM_ID_MIN,
    STRING_LIMITS.ITEM_ID_MAX,
    fieldName
  );

  if (!result.valid) return result;

  // IDs should be alphanumeric with dashes and underscores
  if (!VALIDATION_PATTERNS.ID_PATTERN.test(result.sanitized)) {
    return {
      valid: false,
      error: `${fieldName} contains invalid characters`,
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
 * Validate completion effect percentage value
 * @param {number|string} value - Percentage value
 * @param {string} fieldName - Field name for error messages
 * @returns {ValidationResult}
 */
function validatePercentageValue(value, fieldName) {
  // Convert to number if string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  // Reasonable range check (min 0.1%)
  if (numValue < 0.1) {
    return {
      valid: false,
      error: `${fieldName} must be at least 0.1%`,
    };
  }

  // Check decimal places (max 2)
  const valueStr = numValue.toString();
  if (valueStr.includes('.')) {
    const decimalPart = valueStr.split('.')[1];
    if (decimalPart && decimalPart.length > 2) {
      return {
        valid: false,
        error: `${fieldName} can have at most 2 decimal places`,
      };
    }
  }

  return {
    valid: true,
    sanitized: numValue,
  };
}

/**
 * Validate completion effect (for grid submissions)
 * Expects object with { atk, hp } properties
 * @param {Object} effect - Completion effect object
 * @returns {ValidationResult}
 */
export function validateCompletionEffect(effect) {
  if (!effect || typeof effect !== 'object') {
    return {
      valid: false,
      error: 'Completion effect must be an object with atk and hp properties',
    };
  }

  // Validate ATK
  if (effect.atk === undefined || effect.atk === null) {
    return {
      valid: false,
      error: 'ATK completion effect is required',
    };
  }

  const atkResult = validatePercentageValue(effect.atk, 'ATK completion effect');
  if (!atkResult.valid) return atkResult;

  // Validate HP
  if (effect.hp === undefined || effect.hp === null) {
    return {
      valid: false,
      error: 'HP completion effect is required',
    };
  }

  const hpResult = validatePercentageValue(effect.hp, 'HP completion effect');
  if (!hpResult.valid) return hpResult;

  return {
    valid: true,
    sanitized: {
      atk: atkResult.sanitized,
      hp: hpResult.sanitized,
    },
  };
}

/**
 * Validate grid type (for grid submissions)
 * @param {string} type - Grid type
 * @returns {ValidationResult}
 */
export function validateGridType(type) {
  return validateStringLength(
    type,
    STRING_LIMITS.GRID_TYPE_MIN,
    STRING_LIMITS.GRID_TYPE_MAX,
    'Grid type'
  );
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

  // Strip HTML tags
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
 * Validate edit reason (for anonymous edits)
 * @param {string} reason - Edit reason
 * @returns {ValidationResult}
 */
export function validateEditReason(reason) {
  if (!reason) {
    return { valid: true, sanitized: '' }; // Reason is optional
  }

  const result = validateStringLength(
    reason,
    0,
    STRING_LIMITS.EDIT_REASON_MAX,
    'Edit reason'
  );

  if (!result.valid) return result;

  // Strip HTML tags
  const sanitized = result.sanitized.replace(/<[^>]*>/g, '');

  return {
    valid: true,
    sanitized,
  };
}

/**
 * Validate page content (for anonymous edits)
 * @param {string} content - Page content
 * @returns {ValidationResult}
 */
export function validatePageContent(content) {
  if (typeof content !== 'string') {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.INVALID_TYPE('Content', 'string'),
    };
  }

  // Check byte size (not character length, as some chars are multi-byte)
  const byteSize = new TextEncoder().encode(content).length;

  if (byteSize > STRING_LIMITS.PAGE_CONTENT_MAX) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.CONTENT_TOO_LARGE,
    };
  }

  return {
    valid: true,
    sanitized: content, // Don't trim page content
  };
}

/**
 * Validate page title
 * @param {string} title - Page title
 * @returns {ValidationResult}
 */
export function validatePageTitle(title) {
  return validateStringLength(
    title,
    STRING_LIMITS.PAGE_TITLE_MIN,
    STRING_LIMITS.PAGE_TITLE_MAX,
    'Page title'
  );
}

/**
 * Validate page ID
 * @param {string} pageId - Page ID
 * @returns {ValidationResult}
 */
export function validatePageId(pageId) {
  return validateItemId(pageId, 'Page ID');
}

/**
 * Validate section name
 * @param {string} section - Section name
 * @returns {ValidationResult}
 */
export function validateSectionName(section) {
  return validateStringLength(
    section,
    STRING_LIMITS.SECTION_NAME_MIN,
    STRING_LIMITS.SECTION_NAME_MAX,
    'Section'
  );
}

/**
 * Validate issue title
 * @param {string} title - Issue title
 * @returns {ValidationResult}
 */
export function validateIssueTitle(title) {
  return validateStringLength(
    title,
    STRING_LIMITS.ISSUE_TITLE_MIN,
    STRING_LIMITS.ISSUE_TITLE_MAX,
    'Issue title'
  );
}

/**
 * Validate issue/comment body
 * @param {string} body - Issue or comment body
 * @param {string} fieldName - Field name for error messages
 * @returns {ValidationResult}
 */
export function validateIssueBody(body, fieldName = 'Body') {
  if (typeof body !== 'string') {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.INVALID_TYPE(fieldName, 'string'),
    };
  }

  // Check byte size
  const byteSize = new TextEncoder().encode(body).length;

  if (byteSize > STRING_LIMITS.ISSUE_BODY_MAX) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.TOO_LONG(fieldName, STRING_LIMITS.ISSUE_BODY_MAX),
    };
  }

  return {
    valid: true,
    sanitized: body, // Don't trim issue bodies
  };
}

/**
 * Validate array length
 * @param {Array} array - Array to validate
 * @param {number} max - Maximum length
 * @param {string} fieldName - Field name for error messages
 * @returns {ValidationResult}
 */
export function validateArrayLength(array, max, fieldName) {
  if (!Array.isArray(array)) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.INVALID_TYPE(fieldName, 'array'),
    };
  }

  if (array.length > max) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.TOO_MANY_SLOTS(max),
    };
  }

  return {
    valid: true,
    sanitized: array,
  };
}

/**
 * Validate spirit build slots
 * @param {Array} slots - Spirit slots array
 * @returns {ValidationResult}
 */
export function validateSpiritSlots(slots) {
  // Validate array length
  const lengthResult = validateArrayLength(slots, COLLECTION_LIMITS.MAX_SPIRIT_SLOTS, 'Spirit slots');
  if (!lengthResult.valid) return lengthResult;

  // Validate each slot structure
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot) continue; // Empty slot is valid

    // Validate type field (must be "collection" or "base")
    if (slot.type && slot.type !== "collection" && slot.type !== "base") {
      return {
        valid: false,
        error: `Invalid slot type at index ${i}: must be "collection" or "base"`
      };
    }

    // If type is "collection", must have mySpiritId
    if (slot.type === "collection") {
      if (!slot.mySpiritId || typeof slot.mySpiritId !== 'string') {
        return {
          valid: false,
          error: `Collection spirit slot at index ${i} must have valid mySpiritId`
        };
      }
    }

    // If type is "base" or no type (old format), should have spiritId (or null for empty)
    if (slot.type === "base" || !slot.type) {
      if (slot.spiritId !== null && slot.spiritId !== undefined && typeof slot.spiritId !== 'number') {
        return {
          valid: false,
          error: `Base spirit slot at index ${i} must have valid spiritId (number or null)`
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate skill build slots
 * @param {Array} slots - Skill slots array
 * @returns {ValidationResult}
 */
export function validateSkillSlots(slots) {
  return validateArrayLength(slots, COLLECTION_LIMITS.MAX_SKILL_SLOTS, 'Skill slots');
}

/**
 * Validate labels array
 * @param {Array<string>} labels - Labels array
 * @returns {ValidationResult}
 */
export function validateLabels(labels) {
  if (!Array.isArray(labels)) {
    // Convert single label to array
    labels = [labels];
  }

  const result = validateArrayLength(labels, COLLECTION_LIMITS.MAX_LABELS, 'Labels');
  if (!result.valid) return result;

  // Validate each label
  for (const label of labels) {
    const labelResult = validateStringLength(
      label,
      1,
      COLLECTION_LIMITS.LABEL_LENGTH_MAX,
      'Label'
    );
    if (!labelResult.valid) return labelResult;
  }

  return result;
}

/**
 * Validate request body size
 * @param {string} body - Request body (JSON string)
 * @returns {ValidationResult}
 */
export function validateRequestBodySize(body) {
  if (typeof body !== 'string') {
    body = JSON.stringify(body);
  }

  const byteSize = new TextEncoder().encode(body).length;

  if (byteSize > DATA_SIZE_LIMITS.MAX_REQUEST_BODY_SIZE) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.REQUEST_TOO_LARGE,
    };
  }

  return {
    valid: true,
  };
}

/**
 * Sanitize HTML (strip all tags)
 * @param {string} input - Input string
 * @returns {string} - Sanitized string
 */
export function sanitizeHtml(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Validate and sanitize build data
 * @param {Object} data - Build data
 * @param {string} type - Data type (skill-builds, spirit-builds, etc.)
 * @returns {ValidationResult}
 */
export function validateBuildData(data, type) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: 'Build data must be an object',
    };
  }

  // Validate name (required for non-spirit builds)
  if (type !== 'my-spirits' && !data.name) {
    return {
      valid: false,
      error: VALIDATION_MESSAGES.BUILD_NAME_REQUIRED,
    };
  }

  if (data.name) {
    const nameResult = validateBuildName(data.name);
    if (!nameResult.valid) return nameResult;
  }

  // Validate slots if present
  if (data.slots) {
    let slotsResult;
    if (type === 'skill-builds') {
      slotsResult = validateSkillSlots(data.slots);
    } else if (type === 'spirit-builds') {
      slotsResult = validateSpiritSlots(data.slots);
    } else if (type === 'battle-loadouts') {
      // Battle loadouts can have embedded skill build (backward compatibility)
      if (data.skillBuild && data.skillBuild.slots) {
        slotsResult = validateSkillSlots(data.skillBuild.slots);
      }
    }

    if (slotsResult && !slotsResult.valid) return slotsResult;
  }

  // Validate battle loadout build references (new format)
  if (type === 'battle-loadouts') {
    // Validate skillBuildId if present (new format)
    if (data.skillBuildId !== undefined && data.skillBuildId !== null) {
      if (typeof data.skillBuildId !== 'string') {
        return {
          valid: false,
          error: 'skillBuildId must be a string'
        };
      }
    }

    // Validate spiritBuildId if present (new format)
    if (data.spiritBuildId !== undefined && data.spiritBuildId !== null) {
      if (typeof data.spiritBuildId !== 'string') {
        return {
          valid: false,
          error: 'spiritBuildId must be a string'
        };
      }
    }

    // Validate embedded spirit build slots if present (backward compatibility)
    if (data.spiritBuild && data.spiritBuild.slots) {
      const spiritSlotsResult = validateSpiritSlots(data.spiritBuild.slots);
      if (!spiritSlotsResult.valid) return spiritSlotsResult;
    }
  }

  // Validate JSON size
  const jsonSize = new TextEncoder().encode(JSON.stringify(data)).length;
  if (jsonSize > DATA_SIZE_LIMITS.MAX_BUILD_DATA_SIZE) {
    return {
      valid: false,
      error: `Build data is too large (max ${DATA_SIZE_LIMITS.MAX_BUILD_DATA_SIZE / 1024}KB)`,
    };
  }

  return {
    valid: true,
    sanitized: data,
  };
}

/**
 * Validate grid submission data
 * @param {Object} data - Grid submission data
 * @returns {ValidationResult}
 */
export function validateGridSubmission(data) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: 'Grid submission data must be an object',
    };
  }

  // Validate required fields
  const requiredFields = ['weaponId', 'weaponName', 'gridType', 'completionEffect', 'activeSlots'];
  for (const field of requiredFields) {
    if (!data[field]) {
      return {
        valid: false,
        error: `Grid submission missing required field: ${field}`,
      };
    }
  }

  // Validate weapon ID
  const weaponIdResult = validateItemId(data.weaponId, 'Weapon ID');
  if (!weaponIdResult.valid) return weaponIdResult;

  // Validate weapon name
  const weaponNameResult = validateWeaponName(data.weaponName);
  if (!weaponNameResult.valid) return weaponNameResult;

  // Validate weapon name override (optional)
  if (data.weaponNameOverride) {
    const overrideResult = validateWeaponName(data.weaponNameOverride);
    if (!overrideResult.valid) {
      return {
        valid: false,
        error: `Weapon name override: ${overrideResult.error}`,
      };
    }
  }

  // Validate grid type
  const gridTypeResult = validateGridType(data.gridType);
  if (!gridTypeResult.valid) return gridTypeResult;

  // Validate completion effect
  const effectResult = validateCompletionEffect(data.completionEffect);
  if (!effectResult.valid) return effectResult;

  // Validate activeSlots array
  if (!Array.isArray(data.activeSlots)) {
    return {
      valid: false,
      error: 'Active slots must be an array',
    };
  }

  if (data.activeSlots.length > COLLECTION_LIMITS.MAX_GRID_CELLS) {
    return {
      valid: false,
      error: `Too many grid cells (max ${COLLECTION_LIMITS.MAX_GRID_CELLS})`,
    };
  }

  return {
    valid: true,
    sanitized: data,
  };
}
