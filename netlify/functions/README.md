# Netlify Serverless Functions

This directory contains serverless functions that run on Netlify to proxy GitHub OAuth requests.

## Why These Functions Are Needed

GitHub's OAuth endpoints don't allow direct cross-origin requests from browsers due to CORS security policies. These functions act as a backend proxy to:

1. Receive requests from the frontend
2. Forward them to GitHub's OAuth endpoints
3. Return the response with proper CORS headers

## Functions

### `device-code.js`
Proxies requests to `https://github.com/login/device/code` for initiating OAuth Device Flow.

**Endpoint:** `/.netlify/functions/device-code`

### `access-token.js`
Proxies requests to `https://github.com/login/oauth/access_token` for exchanging device codes for access tokens.

**Endpoint:** `/.netlify/functions/access-token`

## Local Testing

To test these functions locally with Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

This will run both your Vite dev server and Netlify Functions locally.
