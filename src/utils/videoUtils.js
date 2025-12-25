/**
 * Video Utils - Re-exports from framework
 *
 * This file maintains backward compatibility for parent project imports.
 * All video utility functionality is now in the framework.
 */

export {
  createLFSBatchRequest,
  generateVideoId,
  validateVideoFile
} from '../../wiki-framework/src/utils/videoUtils.js';
