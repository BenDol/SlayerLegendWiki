/**
 * Logger utility - Re-exports from framework
 *
 * This file maintains backward compatibility for parent project imports.
 * All logging functionality is now in the framework.
 */

export {
  createLogger,
  isDevMode,
  isProdMode,
  getMinLogLevel,
  isLevelEnabled,
  LogLevel
} from '../../wiki-framework/src/utils/logger.js';

export { default } from '../../wiki-framework/src/utils/logger.js';
