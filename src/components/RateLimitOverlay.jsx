/**
 * Rate Limit Overlay Component
 * Full-screen overlay displayed when user hits anonymous edit rate limit
 */

import { useState, useEffect } from 'react';

export default function RateLimitOverlay({
  isRateLimited,
  remainingMs,
  onSignIn
}) {
  const [timeLeft, setTimeLeft] = useState(remainingMs);

  useEffect(() => {
    setTimeLeft(remainingMs);
  }, [remainingMs]);

  useEffect(() => {
    if (!isRateLimited || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          // Reload page when timer expires
          window.location.reload();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRateLimited, timeLeft]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getProgressPercentage = () => {
    const oneHourMs = 60 * 60 * 1000;
    return ((oneHourMs - timeLeft) / oneHourMs) * 100;
  };

  if (!isRateLimited) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 p-8 text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Rate Limit Reached
        </h2>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
          You've reached the limit of <strong>5 anonymous edits per hour</strong>.
        </p>

        {/* Timer */}
        <div className="mb-8">
          <div className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
            {formatTime(timeLeft)}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            until you can edit again
          </p>

          {/* Progress bar */}
          <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-yellow-500 h-full transition-all duration-1000 ease-linear"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>

        {/* Sign in CTA */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            Want to make unlimited edits?
          </p>
          <button
            onClick={onSignIn}
            className="w-full py-3 px-6 rounded-lg font-medium text-white
                     bg-gradient-to-r from-blue-600 to-blue-700
                     hover:from-blue-700 hover:to-blue-800
                     transition-all shadow-lg hover:shadow-xl
                     transform hover:scale-105"
          >
            Sign In with GitHub
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Authenticated users have no rate limits
          </p>
        </div>

        {/* Info */}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This limit helps prevent spam and abuse. Thank you for contributing to the wiki!
        </p>
      </div>
    </div>
  );
}
