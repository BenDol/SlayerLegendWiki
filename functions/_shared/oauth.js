/**
 * Shared OAuth Operations
 * Handles GitHub OAuth device flow
 * Used by both Netlify and Cloudflare implementations
 */

import { createErrorResponse, createSuccessResponse } from './utils.js';

/**
 * Initiate GitHub device flow
 * @param {Object} config - Configuration object
 * @param {string} config.client_id - GitHub OAuth client ID
 * @param {string} config.scope - OAuth scope
 * @returns {Promise<Object>}
 */
export async function initiateDeviceFlow({ client_id, scope }) {
  if (!client_id) {
    return createErrorResponse(400, 'Missing client_id');
  }

  try {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id,
        scope: scope || 'public_repo read:user user:email',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return createErrorResponse(response.status, data.error_description || data.error || 'Failed to initiate device flow');
    }

    return {
      statusCode: response.status,
      body: data
    };
  } catch (error) {
    console.error('[initiateDeviceFlow] Error:', error);
    return createErrorResponse(500, error.message || 'Internal server error');
  }
}

/**
 * Poll for access token (device flow completion)
 * @param {Object} config - Configuration object
 * @param {string} config.client_id - GitHub OAuth client ID
 * @param {string} config.device_code - Device code from initiation
 * @param {string} config.grant_type - Grant type
 * @returns {Promise<Object>}
 */
export async function pollAccessToken({ client_id, device_code, grant_type }) {
  if (!client_id || !device_code) {
    return createErrorResponse(400, 'Missing client_id or device_code');
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id,
        device_code,
        grant_type: grant_type || 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = await response.json();

    // Note: GitHub returns 200 even for polling errors (authorization_pending, slow_down, etc.)
    // The error is in the response body
    return {
      statusCode: response.status,
      body: data
    };
  } catch (error) {
    console.error('[pollAccessToken] Error:', error);
    return createErrorResponse(500, error.message || 'Internal server error');
  }
}
