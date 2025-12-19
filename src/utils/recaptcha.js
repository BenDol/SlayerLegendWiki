/**
 * Google reCAPTCHA v3 Integration Utilities
 * Handles loading and executing reCAPTCHA for anonymous edit submissions
 */

let recaptchaLoaded = false;
let recaptchaLoadPromise = null;

/**
 * Load reCAPTCHA v3 script
 * @param {string} siteKey - reCAPTCHA site key
 * @returns {Promise<void>}
 */
export const loadRecaptcha = (siteKey) => {
  // Return existing promise if already loading
  if (recaptchaLoadPromise) {
    return recaptchaLoadPromise;
  }

  // Return resolved promise if already loaded
  if (recaptchaLoaded && window.grecaptcha) {
    return Promise.resolve();
  }

  recaptchaLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.grecaptcha && window.grecaptcha.execute) {
      recaptchaLoaded = true;
      resolve();
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // Wait for grecaptcha to be available
      const checkReady = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.execute) {
          clearInterval(checkReady);
          recaptchaLoaded = true;
          console.log('[reCAPTCHA] Loaded successfully');
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkReady);
        if (!recaptchaLoaded) {
          reject(new Error('reCAPTCHA failed to load'));
        }
      }, 10000);
    };

    script.onerror = () => {
      reject(new Error('Failed to load reCAPTCHA script'));
    };

    document.head.appendChild(script);
  });

  return recaptchaLoadPromise;
};

/**
 * Execute reCAPTCHA v3 and get token
 * @param {string} siteKey - reCAPTCHA site key
 * @param {string} action - Action name (e.g., 'anonymous_edit')
 * @returns {Promise<string>} reCAPTCHA token
 */
export const executeRecaptcha = async (siteKey, action = 'anonymous_edit') => {
  try {
    // Ensure reCAPTCHA is loaded
    await loadRecaptcha(siteKey);

    // Execute reCAPTCHA
    if (!window.grecaptcha || !window.grecaptcha.execute) {
      throw new Error('reCAPTCHA not available');
    }

    const token = await window.grecaptcha.execute(siteKey, { action });

    if (!token) {
      throw new Error('reCAPTCHA did not return a token');
    }

    console.log('[reCAPTCHA] Token generated successfully');
    return token;
  } catch (error) {
    console.error('[reCAPTCHA] Execution failed:', error);
    throw new Error('CAPTCHA verification failed. Please try again.');
  }
};

/**
 * Reset reCAPTCHA (for retries)
 */
export const resetRecaptcha = () => {
  if (window.grecaptcha && window.grecaptcha.reset) {
    window.grecaptcha.reset();
  }
};

/**
 * Check if reCAPTCHA is loaded and ready
 * @returns {boolean}
 */
export const isRecaptchaReady = () => {
  return recaptchaLoaded && window.grecaptcha && window.grecaptcha.execute;
};

/**
 * Show reCAPTCHA v2 challenge (fallback for low scores)
 * @param {string} siteKey - reCAPTCHA site key
 * @param {string} containerId - DOM element ID to render challenge
 * @returns {Promise<string>} reCAPTCHA token from v2 challenge
 */
export const showRecaptchaV2Challenge = (siteKey, containerId) => {
  return new Promise((resolve, reject) => {
    try {
      if (!window.grecaptcha || !window.grecaptcha.render) {
        reject(new Error('reCAPTCHA v2 not available'));
        return;
      }

      const widgetId = window.grecaptcha.render(containerId, {
        sitekey: siteKey,
        callback: (token) => {
          resolve(token);
        },
        'error-callback': () => {
          reject(new Error('reCAPTCHA v2 challenge failed'));
        },
        'expired-callback': () => {
          reject(new Error('reCAPTCHA v2 challenge expired'));
        }
      });

      console.log('[reCAPTCHA] v2 challenge rendered');
    } catch (error) {
      reject(error);
    }
  });
};
