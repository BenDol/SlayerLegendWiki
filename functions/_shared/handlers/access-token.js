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
    const { client_id: requestedClientId, device_code, grant_type } = await adapter.getJsonBody();

    // SECURITY: pin the OAuth client to the server's configured app (must match
    // the device-code step). See device-code.js for rationale.
    const configuredClientId = adapter.getEnv('GITHUB_CLIENT_ID') || adapter.getEnv('VITE_GITHUB_CLIENT_ID');
    if (!configuredClientId) {
      console.warn('[access-token] No server GITHUB_CLIENT_ID configured; using the request-supplied client_id');
    }
    const client_id = configuredClientId || requestedClientId;

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
