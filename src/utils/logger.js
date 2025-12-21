/**
 * Centralized Logging Utility - Slayer Legend Wiki
 *
 * Environment-aware logging with structured prefixes and level filtering.
 * Integrates with framework's devStore remote logging infrastructure.
 *
 * Log Levels (lowest to highest verbosity):
 * - ERROR (0): Always visible - System failures, API errors, exceptions
 * - WARN (1): Always visible - Fallbacks, deprecations, missing optional data
 * - INFO (2): Selective in prod - Critical user actions + all dev info
 * - DEBUG (3): Dev only - Cache operations, validations, internal state
 * - TRACE (4): Dev only - Verbose lifecycle, polling, scroll tracking
 *
 * Usage:
 * ```javascript
 * import { createLogger } from '../utils/logger';
 * const logger = createLogger('ComponentName');
 *
 * logger.error('Failed to load data', { error });        // Always visible
 * logger.warn('Using fallback value', { key });          // Always visible
 * logger.info('User saved build', { buildId });          // Critical action (prod + dev)
 * logger.info('Component mounted');                      // Dev only
 * logger.debug('Cache hit', { key, value });             // Dev only
 * logger.trace('Effect running', { deps });              // Dev only
 * ```
 *
 * Critical Actions (INFO level, logged in production):
 * - Authentication: login, logout, authenticate
 * - Data operations: save, delete, create, update
 * - Sharing: share, export, import
 * - Monetization: donate, payment
 */

// Environment detection (works in both ES modules and CommonJS)
let isDev, isProd;
try {
  // ES module environment (Vite/browser)
  isDev = import.meta.env.DEV;
  isProd = import.meta.env.PROD;
} catch (e) {
  // CommonJS environment (Node.js/serverless)
  isDev = process.env.NODE_ENV === 'development';
  isProd = process.env.NODE_ENV === 'production';
}

// Log level enumeration
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Keywords that trigger production logging for INFO level
const CRITICAL_ACTION_KEYWORDS = [
  // Authentication
  'login', 'logout', 'authenticate', 'sign in', 'sign out',

  // Data persistence
  'save', 'delete', 'create', 'update', 'remove', 'add',

  // Sharing & export
  'share', 'export', 'import', 'copy', 'copied',

  // Monetization
  'donate', 'payment', 'purchase',

  // Critical state changes
  'success', 'complete', 'finish'
];

// Global configuration
const Config = {
  // Minimum log level to display
  minLevel: isProd ? LogLevel.INFO : LogLevel.TRACE,

  // In production, only log INFO messages that contain critical action keywords
  prodCriticalOnly: true
};

/**
 * Check if a message contains critical action keywords
 * Used to determine if INFO logs should appear in production
 *
 * @param {string} message - Log message to check
 * @returns {boolean} - True if message contains critical keywords
 */
function isCriticalAction(message) {
  if (!isProd) return false; // All INFO messages visible in dev

  const lowerMsg = String(message).toLowerCase();
  return CRITICAL_ACTION_KEYWORDS.some(keyword => lowerMsg.includes(keyword));
}

/**
 * Logger class with prefix support and level filtering
 */
class Logger {
  /**
   * @param {string} prefix - Logger prefix (e.g., 'ComponentName' or 'Parent:Child')
   */
  constructor(prefix = '') {
    this.prefix = prefix;
  }

  /**
   * Format message with prefix
   * @private
   */
  _format(message, data = null) {
    const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
    const msgStr = String(message);

    if (data !== null && data !== undefined) {
      if (typeof data === 'object') {
        // Return array for console spread: ['[Prefix] message', { object }]
        return [prefixStr + msgStr, data];
      }
      // Primitive data types - append to message
      return [prefixStr + msgStr + ' ' + String(data)];
    }

    return [prefixStr + msgStr];
  }

  /**
   * Core logging method with level filtering
   * @private
   */
  _log(level, message, data = null) {
    // Skip if below minimum level
    if (level > Config.minLevel) {
      return;
    }

    // In production, only log INFO messages that are critical actions
    if (isProd && Config.prodCriticalOnly && level === LogLevel.INFO) {
      if (!isCriticalAction(message)) {
        return;
      }
    }

    const formatted = this._format(message, data);

    // Route to appropriate console method
    // devStore will intercept these calls for remote logging
    switch (level) {
      case LogLevel.ERROR:
        console.error(...formatted);
        break;

      case LogLevel.WARN:
        console.warn(...formatted);
        break;

      case LogLevel.INFO:
        console.info(...formatted);
        break;

      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        console.log(...formatted);
        break;
    }
  }

  /**
   * ERROR level - Always visible (prod + dev)
   * Use for: API failures, exceptions, data corruption, critical errors
   *
   * @param {string} message - Error message
   * @param {*} data - Optional error object or additional data
   */
  error(message, data = null) {
    this._log(LogLevel.ERROR, message, data);
  }

  /**
   * WARN level - Always visible (prod + dev)
   * Use for: Fallbacks, deprecations, missing optional data, non-critical issues
   *
   * @param {string} message - Warning message
   * @param {*} data - Optional warning context
   */
  warn(message, data = null) {
    this._log(LogLevel.WARN, message, data);
  }

  /**
   * INFO level - Critical actions in prod, all in dev
   * Use for: User actions (save/share/login), component lifecycle, completions
   *
   * @param {string} message - Info message
   * @param {*} data - Optional context data
   */
  info(message, data = null) {
    this._log(LogLevel.INFO, message, data);
  }

  /**
   * DEBUG level - Dev only
   * Use for: Cache operations, validations, eligibility checks, internal state
   *
   * @param {string} message - Debug message
   * @param {*} data - Optional debug data
   */
  debug(message, data = null) {
    this._log(LogLevel.DEBUG, message, data);
  }

  /**
   * TRACE level - Dev only (most verbose)
   * Use for: Lifecycle events, polling, scroll tracking, verbose state dumps
   *
   * @param {string} message - Trace message
   * @param {*} data - Optional trace data
   */
  trace(message, data = null) {
    this._log(LogLevel.TRACE, message, data);
  }

  /**
   * Create a child logger with nested prefix
   *
   * @param {string} suffix - Suffix to append to current prefix
   * @returns {Logger} - New logger with combined prefix
   *
   * @example
   * const logger = createLogger('SoulWeapon');
   * const cacheLogger = logger.child('Cache');
   * cacheLogger.debug('Hit'); // Outputs: [SoulWeapon:Cache] Hit
   */
  child(suffix) {
    const newPrefix = this.prefix
      ? `${this.prefix}:${suffix}`
      : suffix;
    return new Logger(newPrefix);
  }

  /**
   * Create a grouped console section (dev only)
   * Useful for grouping related logs together
   *
   * @param {string} label - Group label
   */
  group(label) {
    if (!isDev) return;

    const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
    if (console.group) {
      console.group(prefixStr + label);
    }
  }

  /**
   * Create a collapsed group (dev only)
   *
   * @param {string} label - Group label
   */
  groupCollapsed(label) {
    if (!isDev) return;

    const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
    if (console.groupCollapsed) {
      console.groupCollapsed(prefixStr + label);
    }
  }

  /**
   * End a console group (dev only)
   */
  groupEnd() {
    if (!isDev) return;

    if (console.groupEnd) {
      console.groupEnd();
    }
  }
}

/**
 * Create a new logger with the specified prefix
 *
 * @param {string} prefix - Logger prefix (typically component/module name)
 * @returns {Logger} - Logger instance
 *
 * @example
 * import { createLogger } from '../utils/logger';
 * const logger = createLogger('MyComponent');
 * logger.info('Component initialized');
 */
export function createLogger(prefix) {
  return new Logger(prefix);
}

/**
 * Default logger without prefix
 * Use for one-off logs or when prefix isn't needed
 */
export default new Logger();

/**
 * Utility: Check if currently in development mode
 * @returns {boolean}
 */
export function isDevMode() {
  return isDev;
}

/**
 * Utility: Check if currently in production mode
 * @returns {boolean}
 */
export function isProdMode() {
  return isProd;
}

/**
 * Utility: Get current minimum log level
 * @returns {number} - Current minimum level (0-4)
 */
export function getMinLogLevel() {
  return Config.minLevel;
}

/**
 * Utility: Check if a specific level is enabled
 *
 * @param {string} level - Level name ('ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE')
 * @returns {boolean} - True if level is enabled
 */
export function isLevelEnabled(level) {
  const levelValue = LogLevel[level.toUpperCase()];
  if (levelValue === undefined) return false;
  return levelValue <= Config.minLevel;
}

// Export log levels for external use
export { LogLevel };
