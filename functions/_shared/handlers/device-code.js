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
    const { client_id: requestedClientId } = await adapter.getJsonBody();

    // SECURITY: pin the OAuth client to the server's configured app so this
    // proxy cannot be used as an open relay to GitHub's device endpoints for
    // arbitrary client_ids. The request value is used only when the server has
    // no client id configured (keeps local setups working) - logged so that
    // fallback is visible.
    const configuredClientId = adapter.getEnv('GITHUB_CLIENT_ID') || adapter.getEnv('VITE_GITHUB_CLIENT_ID');
    if (!configuredClientId) {
      console.warn('[device-code] No server GITHUB_CLIENT_ID configured; using the request-supplied client_id');
    }
    const client_id = configuredClientId || requestedClientId;

    // SECURITY: pin the scope too. Forwarding a client-supplied scope would let
    // an attacker start a device flow for THIS app with an over-broad scope
    // (repo, workflow, ...) and phish a user into approving it. The wiki only
    // needs read access plus the user's public identity.
    const scope = adapter.getEnv('GITHUB_OAUTH_SCOPE') || 'public_repo read:user user:email';

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
