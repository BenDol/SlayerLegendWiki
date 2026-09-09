/**
 * Image Processing Utilities
 * Handles image validation and moderation for profile pictures
 * Note: Image processing (resize, crop, format conversion) is done client-side
 */

import { createLogger } from '../../wiki-framework/src/utils/logger.js';

const logger = createLogger('ImageUtils');

// Magic bytes for image format validation
const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header (WEBP fourCC checked separately at offset 8)
  'image/gif': [0x47, 0x49, 0x46, 0x38],
};

// Canonical extension for each detectable format. jpeg -> jpg for storage.
const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Detect an image's true format from its magic bytes (never from a filename or a
 * client-supplied Content-Type). WebP requires both the RIFF header and the
 * `WEBP` fourCC at offset 8, so a plain RIFF container (wav/avi) is not accepted.
 * @param {Buffer} buffer - Image file buffer
 * @returns {{ mime: string, ext: string } | null} the detected format, or null.
 */
export function detectImageFormat(buffer) {
  try {
    if (!buffer || buffer.length < 12) return null;

    // WebP: "RIFF" (0..3) + "WEBP" (8..11)
    if (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      return { mime: 'image/webp', ext: 'webp' };
    }

    for (const [mime, magic] of Object.entries(MAGIC_BYTES)) {
      if (mime === 'image/webp') continue; // handled above
      let matches = true;
      for (let i = 0; i < magic.length; i++) {
        if (buffer[i] !== magic[i]) { matches = false; break; }
      }
      if (matches) return { mime, ext: MIME_TO_EXT[mime] };
    }

    return null;
  } catch (error) {
    logger.error('Failed to detect image format', { error });
    return null;
  }
}

/**
 * Validate image file format using magic bytes.
 * Prevents extension/Content-Type spoofing attacks. For WebP this also verifies
 * the `WEBP` fourCC at offset 8, not just the RIFF header.
 * @param {Buffer} buffer - Image file buffer
 * @param {string} mimeType - Expected MIME type
 * @returns {boolean} True if the content matches the claimed MIME type.
 */
export function validateImageFile(buffer, mimeType) {
  try {
    const expected = MAGIC_BYTES[mimeType];
    if (!expected) {
      logger.warn('Unknown MIME type', { mimeType });
      return false;
    }

    const detected = detectImageFormat(buffer);
    if (!detected) {
      logger.warn('Image content did not match any known format', { mimeType });
      return false;
    }

    // The detected format must match the claimed MIME type (webp<->webp, etc.).
    // jpeg is claimed as image/jpeg while detect maps it to ext 'jpg'.
    if (detected.mime !== mimeType) {
      logger.warn('Magic bytes do not match claimed MIME type', { mimeType, detected: detected.mime });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to validate image file', { error });
    return false;
  }
}

/**
 * Validate image data
 * Client should have already processed image to 512x512 WebP
 * @param {Buffer} imageBuffer - Pre-processed image buffer from client
 * @returns {Object} Image data { buffer, base64, extension, mimeType }
 */
export function validateProcessedImage(imageBuffer) {
  try {
    logger.debug('Validating pre-processed image', { size: imageBuffer.length });

    // Generate base64 for moderation API
    const base64 = imageBuffer.toString('base64');

    return {
      buffer: imageBuffer,
      base64,
      extension: 'webp',
      mimeType: 'image/webp',
    };
  } catch (error) {
    logger.error('Failed to validate image', { error: error.message });
    throw new Error('Image validation failed');
  }
}

/**
 * Check image for inappropriate content using OpenAI Vision API.
 * Fails CLOSED: if the API errors or is unreachable it returns
 * `{ flagged: true, moderationUnavailable: true }` rather than allowing the
 * image. Callers should branch on `moderationUnavailable` to tell the user it
 * is a temporary outage (503) rather than a content rejection. When no API key
 * is configured, moderation is skipped entirely by the callers (returns
 * `{ flagged: false }` here).
 * @param {string} imageBase64 - Base64-encoded image
 * @param {string} openaiApiKey - OpenAI API key
 * @returns {Promise<{flagged: boolean, moderationUnavailable?: boolean}>} Moderation result
 */
export async function checkImageModeration(imageBase64, openaiApiKey) {
  if (!openaiApiKey) {
    logger.debug('OpenAI moderation disabled (no API key)');
    return { flagged: false };
  }

  try {
    logger.debug('Checking image moderation with OpenAI Vision');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Vision-capable model
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Is this image appropriate for a profile picture? Answer with only "yes" or "no". Flag images containing: nudity, violence, hate symbols, or illegal content.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/webp;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenAI Vision API error', { status: response.status, error: errorText });
      // Fail closed: when moderation cannot run, reject rather than publish an
      // unreviewed image to the public CDN. There is no local fallback for images.
      return { flagged: true, moderationUnavailable: true };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.toLowerCase() || '';
    const flagged = answer.includes('no');

    logger.debug('OpenAI Vision moderation result', { flagged, answer });

    return { flagged };
  } catch (error) {
    logger.error('OpenAI Vision API failed', { error: error.message });
    // Fail closed: reject when moderation cannot run (see above).
    return { flagged: true, moderationUnavailable: true };
  }
}

