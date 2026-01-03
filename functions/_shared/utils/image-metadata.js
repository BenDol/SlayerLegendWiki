/**
 * Image Metadata Builder
 *
 * Utility for building and validating image metadata for user-uploaded content images.
 */

import { createLogger } from '../../../wiki-framework/src/utils/logger.js';
const logger = createLogger('ImageMetadata');

/**
 * Generate a unique image ID (UUID v4 without dashes)
 * @returns {string} UUID v4 without dashes
 */
export function generateImageId() {
  // Generate UUID v4 without external dependencies
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (without dashes)
  const crypto = globalThis.crypto || require('crypto');

  if (crypto.randomUUID) {
    // Modern browsers and Node.js 19+
    return crypto.randomUUID().replace(/-/g, '');
  }

  // Fallback for older environments
  const bytes = crypto.getRandomValues ?
    crypto.getRandomValues(new Uint8Array(16)) :
    Array.from(crypto.randomBytes(16));

  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

  // Convert to hex string
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build complete metadata object for an uploaded image
 * @param {Object} params - Metadata parameters
 * @param {string} params.name - Image name/title (required)
 * @param {string} params.description - Image description (optional)
 * @param {string} params.category - Image category (required)
 * @param {string[]} params.tags - Image tags (optional)
 * @param {Object} params.dimensions - Image dimensions { width, height }
 * @param {string} params.uploadedBy - Username of uploader or 'anonymous'
 * @param {string} params.uploadedAt - ISO timestamp of upload
 * @param {string} params.filename - Original filename
 * @param {number} params.fileSize - File size in bytes
 * @param {string} params.format - File format (jpg, png, etc.)
 * @returns {Object} Complete metadata object
 */
export function buildMetadata({
  name,
  description = '',
  category,
  tags = [],
  dimensions = { width: 0, height: 0 },
  uploadedBy,
  uploadedAt,
  filename,
  fileSize,
  format
}) {
  return {
    name: sanitizeString(name, 100),
    description: sanitizeString(description, 500),
    category: sanitizeCategory(category),
    tags: sanitizeTags(tags),
    dimensions,
    uploadedBy,
    uploadedAt,
    uploadDate: uploadedAt, // Alias for backward compatibility
    filename,
    fileSize,
    format
  };
}

/**
 * Validate metadata fields
 * @param {string} name - Image name
 * @param {string} category - Image category
 * @param {string} description - Image description
 * @param {string[]} tags - Image tags
 * @param {Object} config - Wiki configuration
 * @throws {Error} If validation fails
 */
export function validateMetadata(name, category, description, tags, config) {
  // Name validation (required)
  if (!name || typeof name !== 'string') {
    throw new Error('Image name is required');
  }
  if (name.trim().length === 0) {
    throw new Error('Image name cannot be empty');
  }
  if (name.length > 100) {
    throw new Error('Image name cannot exceed 100 characters');
  }

  // Category validation (required)
  if (!category || typeof category !== 'string') {
    throw new Error('Category is required');
  }

  const allowedCategories = config?.features?.imageUploads?.categories || [];

  // Debug: Log category validation
  logger.debug('Validating category', {
    category,
    categoryLength: category.length,
    allowedCategories,
    hasConfig: !!config,
    hasFeatures: !!config?.features,
    hasImageUploads: !!config?.features?.imageUploads,
    hasCategoriesArray: !!config?.features?.imageUploads?.categories
  });

  if (!allowedCategories.includes(category)) {
    throw new Error(`Invalid category. Allowed: ${allowedCategories.join(', ')}`);
  }

  // Description validation (optional)
  if (description && typeof description !== 'string') {
    throw new Error('Description must be a string');
  }
  if (description && description.length > 500) {
    throw new Error('Description cannot exceed 500 characters');
  }

  // Tags validation (optional)
  if (tags && !Array.isArray(tags)) {
    throw new Error('Tags must be an array');
  }
  if (tags && tags.length > 10) {
    throw new Error('Cannot have more than 10 tags');
  }
  if (tags) {
    for (const tag of tags) {
      if (typeof tag !== 'string') {
        throw new Error('Each tag must be a string');
      }
      if (tag.length > 20) {
        throw new Error('Each tag cannot exceed 20 characters');
      }
    }
  }
}

/**
 * Sanitize string by trimming and encoding HTML entities
 * @param {string} str - Input string
 * @param {number} maxLength - Maximum length
 * @returns {string} Sanitized string
 */
function sanitizeString(str, maxLength) {
  if (!str) return '';

  // Trim and limit length
  let sanitized = str.trim().substring(0, maxLength);

  // Basic HTML entity encoding
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return sanitized;
}

/**
 * Sanitize category name
 * @param {string} category - Category name
 * @returns {string} Sanitized category
 */
function sanitizeCategory(category) {
  if (!category) return 'other';

  // Remove any path traversal attempts
  return category
    .trim()
    .toLowerCase()
    .replace(/\.\./g, '')
    .replace(/[\/\\]/g, '')
    .substring(0, 50);
}

/**
 * Sanitize tags array
 * @param {string[]} tags - Tags array
 * @returns {string[]} Sanitized tags
 */
function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];

  return tags
    .filter(tag => tag && typeof tag === 'string')
    .map(tag => sanitizeString(tag, 20))
    .filter(tag => tag.length > 0)
    .slice(0, 10); // Max 10 tags
}

/**
 * Extract file extension from filename
 * @param {string} filename - Original filename
 * @returns {string} File extension without dot (e.g., 'jpg')
 */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';

  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Get upload path components based on category and current date
 * @param {string} category - Image category
 * @returns {Object} Path components { category, year, month }
 */
export function getUploadPath(category) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  return {
    category: sanitizeCategory(category),
    year,
    month
  };
}
