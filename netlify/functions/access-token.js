/**
 * Netlify Function: GitHub Device Flow - Access Token
 * Proxies GitHub device flow token polling request
 *
 * POST /.netlify/functions/access-token
 * Body: {
 *   client_id: string,
 *   device_code: string,
 *   grant_type: string
 * }
 */

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse request body
    const { client_id, device_code, grant_type } = JSON.parse(event.body);

    if (!client_id || !device_code) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing client_id or device_code' }),
      };
    }

    // Proxy request to GitHub
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

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('[access-token] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
