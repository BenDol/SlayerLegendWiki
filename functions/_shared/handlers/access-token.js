/**
 * Access Token Handler (Platform-Agnostic)
 * Handles GitHub Device Flow access token polling
 *
 * POST /api/access-token or /.netlify/functions/access-token
 * Body: {
 *   client_id: string,
 *   device_code: string,
 *   grant_type: string
 * }
 */

import { pollAccessToken } from '../oauth.js';

/**
 * Handle access token polling request
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @returns {Promise<Object>} Platform-specific response
 */
export async function handleAccessToken(adapter) {
  // Only allow POST
  if (adapter.getMethod() !== 'POST') {
    return adapter.createJsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    // Parse request body
    const { client_id, device_code, grant_type } = await adapter.getJsonBody();

    // Poll for access token
    const result = await pollAccessToken({
      client_id,
      device_code,
      grant_type
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
    console.error('[access-token] Error:', error);
    return adapter.createJsonResponse(500, {
      error: error.message || 'Internal server error'
    });
  }
}
