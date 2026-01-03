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
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
  'image/gif': [0x47, 0x49, 0x46, 0x38],
};

/**
 * Validate image file format using magic bytes
 * Prevents extension spoofing attacks
 * @param {Buffer} buffer - Image file buffer
 * @param {string} mimeType - Expected MIME type
 * @returns {boolean} True if valid, false otherwise
 */
export function validateImageFile(buffer, mimeType) {
  try {
    const expected = MAGIC_BYTES[mimeType];
    if (!expected) {
      logger.warn('Unknown MIME type', { mimeType });
      return false;
    }

    // Check if buffer starts with expected magic bytes
    for (let i = 0; i < expected.length; i++) {
      if (buffer[i] !== expected[i]) {
        logger.warn('Magic bytes mismatch', { mimeType, expected, actual: buffer.slice(0, expected.length) });
        return false;
      }
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
 * Check image for inappropriate content using OpenAI Vision API
 * @param {string} imageBase64 - Base64-encoded image
 * @param {string} openaiApiKey - OpenAI API key
 * @returns {Promise<Object>} Moderation result { flagged: boolean }
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
      // Fail open: Allow upload if moderation fails
      return { flagged: false };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.toLowerCase() || '';
    const flagged = answer.includes('no');

    logger.debug('OpenAI Vision moderation result', { flagged, answer });

    return { flagged };
  } catch (error) {
    logger.error('OpenAI Vision API failed', { error: error.message });
    // Fail open: Allow upload if moderation fails
    return { flagged: false };
  }
}

