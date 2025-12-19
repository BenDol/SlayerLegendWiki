/**
 * Email Verification Modal Component
 * Displays a modal for entering the 6-digit verification code sent via email
 */

import { useState, useEffect, useRef } from 'react';

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;

export default function EmailVerificationModal({
  isOpen,
  onClose,
  onVerify,
  onResend,
  email,
  loading = false,
  error = null
}) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [timeRemaining, setTimeRemaining] = useState(CODE_EXPIRY_MINUTES * 60); // seconds
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Focus first input on open
  useEffect(() => {
    if (isOpen && inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setCode(['', '', '', '', '', '']);
      setTimeRemaining(CODE_EXPIRY_MINUTES * 60);
      setCanResend(false);
      setResendCooldown(0);
    }
  }, [isOpen]);

  const handleInputChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-advance to next input
    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (value && index === CODE_LENGTH - 1 && newCode.every(digit => digit !== '')) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Handle left arrow
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Handle right arrow
    if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');

    if (pastedData.length === CODE_LENGTH) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[CODE_LENGTH - 1]?.focus();

      // Auto-submit
      handleSubmit(pastedData);
    }
  };

  const handleSubmit = (codeString = code.join('')) => {
    if (codeString.length !== CODE_LENGTH) return;
    onVerify(codeString);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setCode(['', '', '', '', '', '']);
    setTimeRemaining(CODE_EXPIRY_MINUTES * 60);
    setCanResend(false);
    setResendCooldown(60); // 60 second cooldown
    inputRefs.current[0]?.focus();

    await onResend();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Verify Your Email
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Email display */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          We sent a 6-digit code to <strong>{email}</strong>
        </p>

        {/* Code inputs */}
        <div className="flex justify-center gap-2 mb-6">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={loading}
              className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg
                       border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700
                       text-gray-900 dark:text-white
                       focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all"
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Timer */}
        <div className="text-center mb-4">
          {timeRemaining > 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Code expires in <span className="font-bold text-gray-900 dark:text-white">{formatTime(timeRemaining)}</span>
            </p>
          ) : (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              Code expired
            </p>
          )}
        </div>

        {/* Submit button */}
        <button
          onClick={() => handleSubmit()}
          disabled={loading || code.some(digit => !digit) || timeRemaining === 0}
          className="w-full py-3 px-4 rounded-lg font-medium
                   bg-blue-600 hover:bg-blue-700 text-white
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors mb-3"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </span>
          ) : (
            'Verify Code'
          )}
        </button>

        {/* Resend button */}
        <div className="text-center">
          {resendCooldown > 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Resend code in {resendCooldown}s
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={loading}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              Didn't receive the code? Resend
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
