import { createLogger } from '../../../src/utils/logger.js';

/**
 * PayPal Webhook Handler (Platform-Agnostic)
 * Handles PayPal webhook events for automated donator badge assignment
 *
 * POST /api/paypal-webhook
 * Headers: {
 *   paypal-transmission-id: <webhook-id>,
 *   paypal-transmission-time: <timestamp>,
 *   paypal-transmission-sig: <signature>,
 *   paypal-cert-url: <cert-url>,
 *   paypal-auth-algo: <algorithm>
 * }
 * Body: {
 *   event_type: 'PAYMENT.SALE.COMPLETED',
 *   resource: { ... payment data ... }
 * }
 *
 * SECURITY: Verifies PayPal signature before processing
 * USER IDENTIFICATION: Extracts GitHub username from custom field or matches email
 */

import { Octokit } from '@octokit/rest';

const logger = createLogger('PayPalWebhook');

/**
 * Verify PayPal webhook signature
 * @param {string} transmissionId - PayPal transmission ID
 * @param {string} transmissionTime - PayPal transmission time
 * @param {string} webhookId - Your webhook ID from PayPal
 * @param {string} eventBody - Raw webhook event body
 * @param {string} certUrl - PayPal cert URL
 * @param {string} transmissionSig - PayPal signature
 * @param {string} authAlgo - Auth algorithm (e.g., 'SHA256withRSA')
 * @returns {Promise<boolean>} True if signature is valid
 */
async function verifyPayPalSignature(
  transmissionId,
  transmissionTime,
  webhookId,
  eventBody,
  certUrl,
  transmissionSig,
  authAlgo
) {
  try {
    // Hash event body using Web Crypto API
    const bodyEncoder = new TextEncoder();
    const bodyData = bodyEncoder.encode(eventBody);
    const bodyHashBuffer = await crypto.subtle.digest('SHA-256', bodyData);
    const bodyHashArray = Array.from(new Uint8Array(bodyHashBuffer));
    const bodyHashBase64 = btoa(String.fromCharCode(...bodyHashArray));

    // Build expected signature string according to PayPal spec
    const expectedString = `${transmissionId}|${transmissionTime}|${webhookId}|${bodyHashBase64}`;

    logger.debug('Verifying PayPal signature', { transmissionId, certUrl });

    // Fetch PayPal certificate
    const certResponse = await fetch(certUrl);
    if (!certResponse.ok) {
      logger.error('Failed to fetch PayPal certificate', { status: certResponse.status });
      return false;
    }

    const certPEM = await certResponse.text();

    // Extract certificate content (remove PEM headers/footers)
    const pemHeader = '-----BEGIN CERTIFICATE-----';
    const pemFooter = '-----END CERTIFICATE-----';
    const pemContents = certPEM
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');

    // Convert base64 cert to ArrayBuffer
    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    // Import the certificate as a public key using Web Crypto API
    const publicKey = await crypto.subtle.importKey(
      'spki',
      binaryDer.buffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    );

    // Convert signature from base64 to ArrayBuffer
    const signatureBytes = Uint8Array.from(atob(transmissionSig), c => c.charCodeAt(0));

    // Convert expected string to ArrayBuffer
    const dataBytes = new TextEncoder().encode(expectedString);

    // Verify signature using Web Crypto API
    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureBytes,
      dataBytes
    );

    logger.debug('PayPal signature verification', { isValid });
    return isValid;
  } catch (error) {
    logger.error('PayPal signature verification error', { error: error.message, stack: error.stack });
    return false;
  }
}

/**
 * Extract GitHub username from PayPal payment
 * Tries multiple methods based on API version:
 * 1. Orders API v2: custom_id field (from Smart Payment Buttons)
 * 2. Legacy: custom or note fields (from older integrations)
 * @param {Object} paymentResource - PayPal payment resource
 * @param {Object} event - Full webhook event (for purchase_units access)
 * @returns {string|null} GitHub username or null
 */
function extractGitHubUsername(paymentResource, event) {
  // Method 1: Orders API v2 - custom_id on resource (from Smart Payment Buttons)
  if (paymentResource.custom_id) {
    const username = paymentResource.custom_id;
    if (username && username !== 'anonymous') {
      logger.debug('Found username in resource.custom_id', { username });
      return username;
    }
  }

  // Method 2: Orders API v2 - custom_id in supplementary_data
  if (paymentResource.supplementary_data?.related_ids?.custom_id) {
    const username = paymentResource.supplementary_data.related_ids.custom_id;
    if (username && username !== 'anonymous') {
      logger.debug('Found username in supplementary_data.related_ids.custom_id', { username });
      return username;
    }
  }

  // Method 3: Purchase units custom_id (for order-level webhooks)
  if (paymentResource.purchase_units && Array.isArray(paymentResource.purchase_units)) {
    for (const unit of paymentResource.purchase_units) {
      if (unit.custom_id) {
        const username = unit.custom_id;
        if (username && username !== 'anonymous') {
          logger.debug('Found username in purchase_units[].custom_id', { username });
          return username;
        }
      }
    }
  }

  // Method 4: Check event-level purchase_units (for CHECKOUT.ORDER webhooks)
  if (event.resource?.purchase_units && Array.isArray(event.resource.purchase_units)) {
    for (const unit of event.resource.purchase_units) {
      if (unit.custom_id) {
        const username = unit.custom_id;
        if (username && username !== 'anonymous') {
          logger.debug('Found username in event.resource.purchase_units[].custom_id', { username });
          return username;
        }
      }
    }
  }

  // Method 3: Legacy - custom field (older PayPal integrations)
  if (paymentResource.custom) {
    const custom = paymentResource.custom;
    // Custom field format: "github:username" or just "username"
    if (custom.startsWith('github:')) {
      return custom.substring(7);
    }
    return custom;
  }

  // Method 4: Legacy - note field (alternative custom field)
  if (paymentResource.note) {
    const note = paymentResource.note;
    if (note.startsWith('github:')) {
      return note.substring(7);
    }
    return note;
  }

  logger.debug('No GitHub username found in payment');
  return null;
}

/**
 * Get donator badge config from wiki config
 * @param {ConfigAdapter} configAdapter - Config adapter
 * @param {PlatformAdapter} adapter - Platform adapter
 * @returns {Object} Badge config
 */
function getDonatorBadgeConfig(configAdapter, adapter) {
  try {
    const wikiConfig = configAdapter.getWikiConfig(adapter);

    // Default badge config
    const defaultConfig = {
      badge: '💎',
      color: '#ffd700',
      title: 'Donator',
    };

    // Check if donation badge is configured
    if (wikiConfig?.features?.donation?.badge) {
      return {
        badge: wikiConfig.features.donation.badge.badge || defaultConfig.badge,
        color: wikiConfig.features.donation.badge.color || defaultConfig.color,
        title: wikiConfig.features.donation.badge.title || defaultConfig.title,
      };
    }

    return defaultConfig;
  } catch (error) {
    logger.warn('Failed to load badge config, using defaults', { error: error.message });
    return {
      badge: '💎',
      color: '#ffd700',
      title: 'Donator',
    };
  }
}

/**
 * Handle PayPal webhook request
 * @param {PlatformAdapter} adapter - Platform adapter instance
 * @param {ConfigAdapter} configAdapter - Config adapter instance
 * @returns {Promise<Object>} Platform-specific response
 */
export async function handlePayPalWebhook(adapter, configAdapter) {
  // Only accept POST requests
  if (adapter.getMethod() !== 'POST') {
    return adapter.createJsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    // Get webhook headers
    const headers = adapter.getHeaders();
    const transmissionId = headers['paypal-transmission-id'];
    const transmissionTime = headers['paypal-transmission-time'];
    const transmissionSig = headers['paypal-transmission-sig'];
    const certUrl = headers['paypal-cert-url'];
    const authAlgo = headers['paypal-auth-algo'];

    // Get webhook ID from environment
    const webhookId = adapter.getEnv('PAYPAL_WEBHOOK_ID');

    if (!webhookId) {
      logger.error('PAYPAL_WEBHOOK_ID not configured');
      return adapter.createJsonResponse(500, { error: 'Server configuration error' });
    }

    // Get raw request body for signature verification
    const rawBody = await adapter.getBody();

    // Allow skipping signature verification in development/sandbox (NOT RECOMMENDED for production)
    const skipVerification = adapter.getEnv('PAYPAL_SKIP_SIGNATURE_VERIFICATION') === 'true';

    if (skipVerification) {
      logger.warn('⚠️ PayPal signature verification SKIPPED (development mode)', { transmissionId });
    } else {
      // Verify PayPal signature (SECURITY: Critical to prevent fake webhooks)
      const isValid = await verifyPayPalSignature(
        transmissionId,
        transmissionTime,
        webhookId,
        rawBody,
        certUrl,
        transmissionSig,
        authAlgo
      );

      if (!isValid) {
        logger.error('Invalid PayPal webhook signature', { transmissionId });
        return adapter.createJsonResponse(401, { error: 'Invalid signature' });
      }

      logger.info('PayPal webhook signature verified', { transmissionId });
    }

    // Parse webhook event
    const event = JSON.parse(rawBody);
    const eventType = event.event_type;
    const resource = event.resource;

    logger.info('Received PayPal webhook', { eventType, transmissionId });
    logger.debug('Webhook event structure', {
      eventType,
      resourceKeys: Object.keys(resource || {}),
      hasCustomId: !!resource.custom_id,
      hasPurchaseUnits: !!resource.purchase_units,
      supplementaryDataKeys: resource.supplementary_data ? Object.keys(resource.supplementary_data) : [],
    });

    // Handle payment completion and order completion events
    const validEventTypes = [
      'PAYMENT.SALE.COMPLETED',     // Legacy Payments API
      'PAYMENT.CAPTURE.COMPLETED',  // Orders API v2 - Capture
      'CHECKOUT.ORDER.COMPLETED',   // Orders API v2 - Order (has full order data with custom_id)
    ];

    if (!validEventTypes.includes(eventType)) {
      logger.debug('Ignoring non-payment event', { eventType });
      return adapter.createJsonResponse(200, { success: true, message: 'Event ignored' });
    }

    // Extract GitHub username from payment
    const githubUsername = extractGitHubUsername(resource, event);

    if (!githubUsername) {
      logger.warn('No GitHub username found in payment', {
        transmissionId,
        eventType,
        checkedFields: {
          'resource.custom_id': resource.custom_id || 'NOT_FOUND',
          'resource.supplementary_data': resource.supplementary_data ? 'EXISTS' : 'NOT_FOUND',
          'resource.purchase_units': resource.purchase_units ? `ARRAY[${resource.purchase_units.length}]` : 'NOT_FOUND',
          'resource.custom': resource.custom || 'NOT_FOUND',
          'resource.note': resource.note || 'NOT_FOUND',
        }
      });
      // Still return 200 to acknowledge webhook (manual assignment can be done later)
      return adapter.createJsonResponse(200, {
        success: true,
        message: 'Payment received but no GitHub username provided',
      });
    }

    logger.info('Processing donator badge assignment', {
      username: githubUsername,
      amount: resource.amount?.total,
      currency: resource.amount?.currency,
      transactionId: resource.id,
    });

    // Get bot token from environment
    const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
    if (!botToken) {
      logger.error('WIKI_BOT_TOKEN not configured');
      return adapter.createJsonResponse(500, { error: 'Server configuration error' });
    }

    // Get repo info from environment
    const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
    const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

    if (!owner || !repo) {
      logger.error('Repository config missing');
      return adapter.createJsonResponse(500, { error: 'Server configuration error' });
    }

    // Initialize Octokit with bot token
    const octokit = new Octokit({ auth: botToken });

    // Get user ID from GitHub (required for donator registry)
    let userId;
    try {
      const { data: githubUser } = await octokit.rest.users.getByUsername({
        username: githubUsername,
      });
      userId = githubUser.id;
    } catch (error) {
      logger.error('Failed to fetch GitHub user', { username: githubUsername, error: error.message });
      return adapter.createJsonResponse(200, {
        success: false,
        message: 'Failed to fetch GitHub user',
      });
    }

    // Import donatorRegistry service dynamically (ESM module)
    const { saveDonatorStatus } = await import(
      '../../../wiki-framework/src/services/github/donatorRegistry.js'
    );

    // Get badge config
    const badgeConfig = getDonatorBadgeConfig(configAdapter, adapter);

    // Build donator status object
    const donatorStatus = {
      isDonator: true,
      donatedAt: new Date().toISOString(),
      amount: parseFloat(resource.amount?.total) || undefined,
      badge: badgeConfig.badge,
      color: badgeConfig.color,
      assignedBy: 'paypal-webhook',
      // Store only last 8 characters of transaction ID for privacy (issue is public)
      transactionId: resource.id ? `...${resource.id.slice(-8)}` : undefined,
    };

    // Save donator status to registry (pass bot token from environment)
    await saveDonatorStatus(owner, repo, githubUsername, userId, donatorStatus, botToken);

    logger.info('Donator badge assigned successfully', {
      username: githubUsername,
      userId,
      transactionId: resource.id,
    });

    return adapter.createJsonResponse(200, {
      success: true,
      message: 'Donator badge assigned',
      username: githubUsername,
    });
  } catch (error) {
    logger.error('PayPal webhook error', { error: error.message, stack: error.stack });
    // Return 200 to prevent PayPal retries (log error for manual investigation)
    return adapter.createJsonResponse(200, {
      success: false,
      error: 'Internal error',
    });
  }
}
