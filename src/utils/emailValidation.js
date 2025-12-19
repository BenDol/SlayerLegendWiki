/**
 * Email Validation Utilities
 * Provides client-side email validation functions
 */

// RFC 5322 compliant email regex (simplified version)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Common disposable email domains (subset for client-side checking)
const DISPOSABLE_DOMAINS = [
  'tempmail.com',
  'throwaway.email',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'maildrop.cc',
  'temp-mail.org',
  'trashmail.com',
  'yopmail.com',
  'fakeinbox.com'
];

/**
 * Validate email format using regex
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email format is valid
 */
export const validateEmailFormat = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Trim whitespace
  email = email.trim();

  // Check length (RFC 5321: max 254 characters)
  if (email.length > 254) {
    return false;
  }

  // Check format
  if (!EMAIL_REGEX.test(email)) {
    return false;
  }

  // Additional checks
  const parts = email.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domain] = parts;

  // Local part max length: 64 characters
  if (localPart.length > 64) {
    return false;
  }

  // Domain must have at least one dot
  if (!domain.includes('.')) {
    return false;
  }

  // Domain parts must not start or end with hyphen
  const domainParts = domain.split('.');
  for (const part of domainParts) {
    if (part.length === 0 || part.startsWith('-') || part.endsWith('-')) {
      return false;
    }
  }

  return true;
};

/**
 * Check if email domain is a known disposable email provider
 * @param {string} email - Email address to check
 * @returns {boolean} True if domain is disposable
 */
export const isDisposableEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  return DISPOSABLE_DOMAINS.includes(domain);
};

/**
 * Validate email using external API (server-side validation)
 * This should be called via the serverless function for security
 * @param {string} email - Email address to validate
 * @returns {Promise<{valid: boolean, reason?: string}>}
 */
export const validateEmailAPI = async (email) => {
  // This will be implemented in the serverless function
  // Client-side code just validates format and disposable domains
  return {
    valid: validateEmailFormat(email) && !isDisposableEmail(email),
    reason: !validateEmailFormat(email)
      ? 'Invalid email format'
      : isDisposableEmail(email)
        ? 'Disposable email addresses are not allowed'
        : undefined
  };
};

/**
 * Get user-friendly error message for email validation
 * @param {string} email - Email address
 * @returns {string|null} Error message or null if valid
 */
export const getEmailValidationError = (email) => {
  if (!email || !email.trim()) {
    return 'Email address is required';
  }

  if (!validateEmailFormat(email)) {
    return 'Please enter a valid email address';
  }

  if (isDisposableEmail(email)) {
    return 'Disposable email addresses are not allowed';
  }

  return null;
};
