/**
 * Shared Utilities for Serverless Functions
 * Used by both Netlify and Cloudflare implementations
 */

/**
 * Valid data types supported by the system
 */
export const VALID_DATA_TYPES = ['skill-builds', 'battle-loadouts', 'my-spirits', 'spirit-builds', 'engraving-builds', 'skill-stone-builds', 'grid-submission', 'display-names'];

/**
 * Configuration for each data type
 */
export const DATA_TYPE_CONFIGS = {
  'skill-builds': {
    label: 'skill-builds',
    titlePrefix: '[Skill Build]',
    itemsName: 'builds',
    maxItems: 50,
  },
  'battle-loadouts': {
    label: 'battle-loadouts',
    titlePrefix: '[Battle Loadout]',
    itemsName: 'loadouts',
    maxItems: 50,
  },
  'my-spirits': {
    label: 'my-spirits',
    titlePrefix: '[My Spirits]',
    itemsName: 'spirits',
    maxItems: 500,
  },
  'spirit-builds': {
    label: 'spirit-builds',
    titlePrefix: '[Spirit Build]',
    itemsName: 'builds',
    maxItems: 50,
  },
  'engraving-builds': {
    label: 'engraving-builds',
    titlePrefix: '[Soul Weapon Engraving]',
    itemsName: 'builds',
    maxItems: 50,
  },
  'skill-stone-builds': {
    label: 'skill-stone-builds',
    titlePrefix: '[Skill Stone Build]',
    itemsName: 'builds',
    maxItems: 50,
  },
  'grid-submission': {
    label: 'soul-weapon-grids',
    titlePrefix: '[Soul Weapon Grid]',
    itemsName: 'submissions',
    maxItems: null, // No limit - stored as comments
  },
  'display-names': {
    label: 'display-names',
    titlePrefix: '[Display Names]',
    itemsName: 'displayNames',
    maxItems: null, // Single registry issue for all display names
  },
};

/**
 * Valid actions for GitHub bot operations
 */
export const VALID_BOT_ACTIONS = [
  'create-comment',
  'update-issue',
  'list-issues',
  'get-comment',
  'create-comment-issue',
  'create-admin-issue',
  'update-admin-issue'
];

/**
 * Validate data type
 * @param {string} type - The data type to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateDataType(type) {
  if (!type) {
    return { valid: false, error: 'Missing required parameter: type' };
  }

  if (!VALID_DATA_TYPES.includes(type)) {
    return { valid: false, error: `Invalid type. Must be one of: ${VALID_DATA_TYPES.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Validate required fields for save operation
 * @param {Object} data - Data object to validate
 * @param {string} type - Data type
 * @returns {{valid: boolean, error?: string}}
 */
export function validateSaveData(data, type) {
  const { username, userId, item } = data;

  if (!username || !userId || !item) {
    return { valid: false, error: 'Missing required fields: username, userId, item' };
  }

  if (!item.id) {
    return { valid: false, error: 'Item must have an id field' };
  }

  // Grid submissions need weaponId
  if (type === 'grid-submission' && !data.weaponId) {
    return { valid: false, error: 'Grid submissions require weaponId' };
  }

  return { valid: true };
}

/**
 * Validate required fields for load operation
 * @param {Object} data - Data object to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateLoadData(data) {
  const { type, userId } = data;

  if (!type || !userId) {
    return { valid: false, error: 'Missing required parameters: type, userId' };
  }

  return { valid: true };
}

/**
 * Validate required fields for delete operation
 * @param {Object} data - Data object to validate
 * @param {string} type - Data type
 * @returns {{valid: boolean, error?: string}}
 */
export function validateDeleteData(data, type) {
  const { username, userId } = data;
  const deleteId = type === 'my-spirits' ? data.spiritId : data.itemId;

  if (!username || !userId || !deleteId) {
    return {
      valid: false,
      error: `Missing required fields: username, userId, ${type === 'my-spirits' ? 'spiritId' : 'itemId'}`
    };
  }

  return { valid: true };
}

/**
 * Validate bot action
 * @param {string} action - The action to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateBotAction(action) {
  if (!action) {
    return { valid: false, error: 'Missing required parameter: action' };
  }

  if (!VALID_BOT_ACTIONS.includes(action)) {
    return { valid: false, error: `Invalid action. Must be one of: ${VALID_BOT_ACTIONS.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Parse items from issue body
 * @param {string} body - Issue body content
 * @returns {Array} - Parsed items array
 */
export function parseItemsFromIssue(body) {
  try {
    const items = JSON.parse(body || '[]');
    return Array.isArray(items) ? items : [];
  } catch (e) {
    console.error('[parseItemsFromIssue] Failed to parse:', e);
    return [];
  }
}

/**
 * Create error response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {{statusCode: number, body: string}}
 */
export function createErrorResponse(statusCode, message) {
  return {
    statusCode,
    body: JSON.stringify({ error: message })
  };
}

/**
 * Create success response object
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {{statusCode: number, body: string}}
 */
export function createSuccessResponse(data, statusCode = 200) {
  return {
    statusCode,
    body: JSON.stringify({ success: true, ...data })
  };
}

/**
 * Hash email address for privacy-preserving identification
 * Uses SHA-256 to create a consistent hash for rate limiting and user linking
 * @param {string} email - Email address to hash
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
export async function hashEmail(email) {
  const encoder = new TextEncoder();
  const data = encoder.encode(email);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get environment configuration
 * @param {Object} env - Environment object (process.env for Netlify, context.env for Cloudflare)
 * @returns {{botToken?: string, owner?: string, repo?: string, error?: string}}
 */
export function getEnvConfig(env) {
  const botToken = env.WIKI_BOT_TOKEN;
  const owner = env.WIKI_REPO_OWNER || env.VITE_WIKI_REPO_OWNER;
  const repo = env.WIKI_REPO_NAME || env.VITE_WIKI_REPO_NAME;

  if (!botToken) {
    return { error: 'WIKI_BOT_TOKEN not configured' };
  }

  if (!owner || !repo) {
    return { error: 'Repository configuration missing' };
  }

  return { botToken, owner, repo };
}
