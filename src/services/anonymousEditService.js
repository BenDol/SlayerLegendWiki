/**
 * Anonymous Edit Service
 * Client-side service for anonymous wiki edits
 * Handles email verification, rate limiting, and PR submission
 */

import { getGithubBotEndpoint } from '../utils/apiEndpoints';
import { cacheName } from '../../wiki-framework/src/utils/storageManager';

/**
 * Send verification code to email
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} email - Email address
 * @returns {Promise<{success: boolean, issueNumber?: number, error?: string}>}
 */
export const sendVerificationCode = async (owner, repo, email) => {
  try {
    const response = await fetch(getGithubBotEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'send-verification-email',
        owner,
        repo,
        email,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send verification code');
    }

    return {
      success: true,
      issueNumber: data.issueNumber,
    };
  } catch (error) {
    console.error('[AnonymousEdit] Failed to send verification code:', error);
    return {
      success: false,
      error: error.message || 'Failed to send verification code',
    };
  }
};

/**
 * Verify email code and get verification token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} email - Email address
 * @param {string} code - Verification code
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
export const verifyCode = async (owner, repo, email, code) => {
  try {
    const response = await fetch(getGithubBotEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'verify-email',
        owner,
        repo,
        email,
        code,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Verification failed');
    }

    return {
      success: true,
      token: data.token,
    };
  } catch (error) {
    console.error('[AnonymousEdit] Verification failed:', error);
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
};

/**
 * Check rate limit status
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<{allowed: boolean, remaining?: number, remainingMs?: number, error?: string}>}
 */
export const checkRateLimit = async (owner, repo) => {
  try {
    const response = await fetch(getGithubBotEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'check-rate-limit',
        owner,
        repo,
        maxEdits: 5,
        windowMinutes: 60,
      }),
    });

    const data = await response.json();

    if (response.status === 429) {
      return {
        allowed: false,
        remainingMs: data.remainingMs,
        message: data.message,
      };
    }

    if (!response.ok) {
      throw new Error(data.error || 'Rate limit check failed');
    }

    return {
      allowed: true,
      remaining: data.remaining,
    };
  } catch (error) {
    console.error('[AnonymousEdit] Rate limit check failed:', error);
    return {
      allowed: true, // Default to allowing if check fails
      error: error.message,
    };
  }
};

/**
 * Submit anonymous edit and create PR
 * @param {Object} params - Edit parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.section - Section ID
 * @param {string} params.pageId - Page ID
 * @param {string} params.pageTitle - Page title
 * @param {string} params.content - Markdown content
 * @param {string} params.email - Email address
 * @param {string} params.displayName - Display name
 * @param {string} params.reason - Edit reason (optional)
 * @param {string} params.verificationToken - Email verification token
 * @param {string} params.captchaToken - reCAPTCHA token
 * @returns {Promise<{success: boolean, pr?: Object, error?: string}>}
 */
export const submitAnonymousEdit = async ({
  owner,
  repo,
  section,
  pageId,
  pageTitle,
  content,
  email,
  displayName,
  reason = '',
  verificationToken,
  captchaToken,
}) => {
  try {
    const response = await fetch(getGithubBotEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create-anonymous-pr',
        owner,
        repo,
        section,
        pageId,
        pageTitle,
        content,
        email,
        displayName,
        reason,
        verificationToken,
        captchaToken,
      }),
    });

    const data = await response.json();

    if (response.status === 429) {
      // Rate limit exceeded
      return {
        success: false,
        rateLimited: true,
        remainingMs: data.remainingMs,
        error: data.message || 'Rate limit exceeded',
      };
    }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit edit');
    }

    return {
      success: true,
      pr: data.pr,
    };
  } catch (error) {
    console.error('[AnonymousEdit] Failed to submit edit:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit edit',
    };
  }
};

/**
 * Get cached verification token from localStorage
 * @param {string} email - Email address
 * @returns {string|null} Verification token or null if not found/expired
 */
export const getCachedVerificationToken = (email) => {
  try {
    const key = cacheName('anon_edit_token', email);
    const cached = localStorage.getItem(key);

    if (!cached) return null;

    const { token, timestamp } = JSON.parse(cached);
    const twentyFourHours = 24 * 60 * 60 * 1000;

    // Check if token is expired (24 hours)
    if (Date.now() - timestamp > twentyFourHours) {
      localStorage.removeItem(key);
      return null;
    }

    return token;
  } catch (error) {
    console.error('[AnonymousEdit] Failed to get cached token:', error);
    return null;
  }
};

/**
 * Cache verification token in localStorage
 * @param {string} email - Email address
 * @param {string} token - Verification token
 */
export const cacheVerificationToken = (email, token) => {
  try {
    const key = cacheName('anon_edit_token', email);
    localStorage.setItem(
      key,
      JSON.stringify({
        token,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error('[AnonymousEdit] Failed to cache token:', error);
  }
};

/**
 * Clear cached verification token
 * @param {string} email - Email address
 */
export const clearCachedVerificationToken = (email) => {
  try {
    const key = cacheName('anon_edit_token', email);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[AnonymousEdit] Failed to clear token:', error);
  }
};
