/**
 * Anonymous Edit Service - Re-exports from framework
 *
 * This file maintains backward compatibility for parent project imports.
 * All functionality is now in the framework.
 */

export {
  sendVerificationCode,
  verifyCode,
  checkRateLimit,
  submitAnonymousEdit,
  getCachedVerificationToken,
  cacheVerificationToken,
  clearCachedVerificationToken,
} from '../../wiki-framework/src/services/anonymousEditService.js';
