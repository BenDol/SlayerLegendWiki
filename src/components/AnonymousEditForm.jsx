/**
 * Anonymous Edit Form Component
 * Collects user information for anonymous wiki edits
 * Handles email verification, reCAPTCHA, and submission
 */

import { useState, useEffect } from 'react';
import EmailVerificationModal from './EmailVerificationModal';
import RateLimitOverlay from './RateLimitOverlay';
import { validateEmailFormat, getEmailValidationError } from '../utils/emailValidation';
import { executeRecaptcha, loadRecaptcha } from '../utils/recaptcha';
import {
  sendVerificationCode,
  verifyCode,
  checkRateLimit,
  submitAnonymousEdit,
  getCachedVerificationToken,
  cacheVerificationToken,
  clearCachedVerificationToken,
} from '../services/anonymousEditService';

export default function AnonymousEditForm({
  owner,
  repo,
  section,
  pageId,
  pageTitle,
  content,
  onSuccess,
  onCancel,
  config,
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [reason, setReason] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');
  const [generalError, setGeneralError] = useState('');

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [verificationToken, setVerificationToken] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState('');

  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitRemaining, setRateLimitRemaining] = useState(0);

  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  // Load reCAPTCHA on mount
  useEffect(() => {
    if (recaptchaSiteKey) {
      loadRecaptcha(recaptchaSiteKey).catch((error) => {
        console.error('[AnonymousEdit] Failed to load reCAPTCHA:', error);
      });
    }
  }, [recaptchaSiteKey]);

  // Check for cached verification token
  useEffect(() => {
    if (email) {
      const cached = getCachedVerificationToken(email);
      if (cached) {
        setVerificationToken(cached);
      }
    }
  }, [email]);

  // Check rate limit on mount
  useEffect(() => {
    checkRateLimit(owner, repo).then((result) => {
      if (!result.allowed) {
        setIsRateLimited(true);
        setRateLimitRemaining(result.remainingMs || 0);
      }
    });
  }, [owner, repo]);

  const validateForm = () => {
    let isValid = true;

    // Validate email
    const emailErr = getEmailValidationError(email);
    if (emailErr) {
      setEmailError(emailErr);
      isValid = false;
    } else {
      setEmailError('');
    }

    // Validate display name
    if (!displayName.trim()) {
      setDisplayNameError('Display name is required');
      isValid = false;
    } else if (displayName.trim().length < 2) {
      setDisplayNameError('Display name must be at least 2 characters');
      isValid = false;
    } else if (displayName.length > 50) {
      setDisplayNameError('Display name must be less than 50 characters');
      isValid = false;
    } else {
      setDisplayNameError('');
    }

    // Check terms agreement
    if (!agreedToTerms) {
      setGeneralError('You must agree to the terms to continue');
      isValid = false;
    } else {
      setGeneralError('');
    }

    return isValid;
  };

  const handleSendVerification = async () => {
    if (!validateForm()) return;

    setGeneralError('');
    setVerifying(true);

    try {
      const result = await sendVerificationCode(owner, repo, email);

      if (result.success) {
        setShowVerificationModal(true);
      } else {
        setGeneralError(result.error || 'Failed to send verification code');
      }
    } catch (error) {
      setGeneralError('Failed to send verification code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyCode = async (code) => {
    setVerifying(true);
    setVerificationError('');

    try {
      const result = await verifyCode(owner, repo, email, code);

      if (result.success) {
        setVerificationToken(result.token);
        cacheVerificationToken(email, result.token);
        setShowVerificationModal(false);
        setVerificationError('');

        // Auto-submit after verification
        await handleSubmit(result.token);
      } else {
        setVerificationError(result.error || 'Verification failed');
      }
    } catch (error) {
      setVerificationError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setVerificationError('');
    return handleSendVerification();
  };

  const handleSubmit = async (token = verificationToken) => {
    if (!validateForm()) return;

    if (!token) {
      // Need to verify email first
      await handleSendVerification();
      return;
    }

    setIsSubmitting(true);
    setGeneralError('');

    try {
      // Step 1: Execute reCAPTCHA
      setSubmitProgress('Verifying security...');
      const captchaToken = await executeRecaptcha(recaptchaSiteKey, 'anonymous_edit');

      // Step 2: Submit edit
      setSubmitProgress('Submitting your edit...');
      const result = await submitAnonymousEdit({
        owner,
        repo,
        section,
        pageId,
        pageTitle,
        content,
        email,
        displayName,
        reason,
        verificationToken: token,
        captchaToken,
      });

      if (result.success) {
        // Clear cached token
        clearCachedVerificationToken(email);

        // Show success and call onSuccess callback
        onSuccess(result.pr);
      } else if (result.rateLimited) {
        // Rate limited
        setIsRateLimited(true);
        setRateLimitRemaining(result.remainingMs || 0);
      } else {
        setGeneralError(result.error || 'Failed to submit edit. Please try again.');
      }
    } catch (error) {
      console.error('[AnonymousEdit] Submit failed:', error);
      setGeneralError(error.message || 'Failed to submit edit. Please try again.');
    } finally {
      setIsSubmitting(false);
      setSubmitProgress('');
    }
  };

  const handleSignIn = () => {
    // Redirect to sign-in page or trigger sign-in flow
    window.location.href = '/'; // Or trigger auth modal
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Submit as Guest
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Provide your information to submit this edit anonymously. A maintainer will review your contribution.
          </p>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>One-time verification:</strong> Once you verify your email, you can make multiple edits for 24 hours without re-verifying.
            </p>
          </div>
        </div>

        {/* Email field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => {
              const error = getEmailValidationError(email);
              setEmailError(error || '');
            }}
            placeholder="your@email.com"
            disabled={isSubmitting || verifying}
            className={`w-full px-4 py-2 rounded-lg border
              ${emailError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'}
              bg-white dark:bg-gray-700
              text-gray-900 dark:text-white
              focus:ring-2 focus:ring-blue-500/20
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors`}
          />
          {emailError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{emailError}</p>
          )}
          {verificationToken && (
            <p className="mt-1 text-sm text-green-600 dark:text-green-400 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Email verified (valid for 24 hours)
            </p>
          )}
        </div>

        {/* Display name field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Display Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How should we credit you?"
            disabled={isSubmitting || verifying}
            className={`w-full px-4 py-2 rounded-lg border
              ${displayNameError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'}
              bg-white dark:bg-gray-700
              text-gray-900 dark:text-white
              focus:ring-2 focus:ring-blue-500/20
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors`}
          />
          {displayNameError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{displayNameError}</p>
          )}
        </div>

        {/* Reason field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for Edit <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe your changes (e.g., 'Fixed typo in introduction')"
            rows={3}
            maxLength={500}
            disabled={isSubmitting || verifying}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-700
                     text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500/20
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors resize-none"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {reason.length}/500 characters
          </p>
        </div>

        {/* Terms checkbox */}
        <div className="mb-6">
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              disabled={isSubmitting || verifying}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              I agree that my contribution will be licensed under the same terms as the wiki content,
              and I understand that it will be reviewed before being published.
            </span>
          </label>
        </div>

        {/* General error */}
        {generalError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-300">{generalError}</p>
          </div>
        )}

        {/* Submit progress */}
        {submitProgress && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {submitProgress}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting || verifying || !agreedToTerms}
            className="flex-1 py-3 px-6 rounded-lg font-medium text-white
                     bg-blue-600 hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </span>
            ) : (
              'Submit Edit'
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={isSubmitting || verifying}
            className="px-6 py-3 rounded-lg font-medium
                     text-gray-700 dark:text-gray-300
                     bg-gray-100 dark:bg-gray-700
                     hover:bg-gray-200 dark:hover:bg-gray-600
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Info notice */}
        <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Anonymous users are limited to <strong>5 edits per hour</strong>.
            Sign in with GitHub for unlimited edits and instant publishing.
          </p>
        </div>
      </div>

      {/* Email verification modal */}
      <EmailVerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onVerify={handleVerifyCode}
        onResend={handleResendCode}
        email={email}
        loading={verifying}
        error={verificationError}
      />

      {/* Rate limit overlay */}
      <RateLimitOverlay
        isRateLimited={isRateLimited}
        remainingMs={rateLimitRemaining}
        onSignIn={handleSignIn}
      />
    </>
  );
}
