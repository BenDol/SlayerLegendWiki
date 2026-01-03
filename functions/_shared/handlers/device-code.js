/**
 * Device Code Handler (Platform-Agnostic)
 * Handles GitHub Device Flow initiation
 *
 * POST /api/device-code or /.netlify/functions/device-code
 * Body: {
 *   client_id: string,
 *   scope: string
 * }
 */

import { initiateDeviceFlow } from '../oauth.js';

/**
 * Handle device code request
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @returns {Promise<Object>} Platform-specific response
 */
export async function handleDeviceCode(adapter) {
  // Only allow POST
  if (adapter.getMethod() !== 'POST') {
    return adapter.createJsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    // Parse request body
    const { client_id, scope } = await adapter.getJsonBody();

    // Initiate device flow
    const result = await initiateDeviceFlow({
      client_id,
      scope
    });

    // Return success response
    return adapter.createResponse(
      result.statusCode,
      result.body,
      {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    );
  } catch (error) {
    console.error('[device-code] Error:', error);
    return adapter.createJsonResponse(500, {
      error: error.message || 'Internal server error'
    });
  }
}
