/**
 * Multipart Form Data Parser
 * Handles parsing of multipart/form-data for file uploads in serverless functions
 */

const { createLogger } = require('../../wiki-framework/src/utils/logger');
const logger = createLogger('MultipartParser');

/**
 * Parse multipart/form-data from serverless event
 *
 * @param {Object} event - Serverless event object
 * @returns {Promise<Object>} Parsed form data
 * @returns {Object} result.fields - Text form fields
 * @returns {Object} result.files - File uploads
 */
async function parseMultipartFormData(event) {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';

  if (!contentType.includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data');
  }

  // Extract boundary from Content-Type header
  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) {
    throw new Error('No boundary found in Content-Type header');
  }

  const boundary = boundaryMatch[1];
  logger.debug('Parsing multipart data', { boundary });

  // Get body as buffer
  let body;
  if (event.isBase64Encoded) {
    body = Buffer.from(event.body, 'base64');
  } else if (typeof event.body === 'string') {
    body = Buffer.from(event.body, 'binary');
  } else if (Buffer.isBuffer(event.body)) {
    body = event.body;
  } else {
    throw new Error('Invalid body format');
  }

  // Parse multipart data
  const parts = parseMultipartBody(body, boundary);

  logger.info('Total parts parsed', { count: parts.length });

  // Separate fields and files
  const fields = {};
  const files = {};

  for (const part of parts) {
    if (part.filename) {
      // It's a file
      files[part.name] = {
        filename: part.filename,
        contentType: part.contentType,
        data: part.data,
        size: part.data.length,
      };
      logger.debug('File parsed', {
        name: part.name,
        filename: part.filename,
        size: part.data.length,
      });
    } else {
      // It's a text field
      const value = part.data.toString('utf-8').trim(); // Trim whitespace and CRLF
      fields[part.name] = value;
      logger.debug('Field parsed', {
        name: part.name,
        value: value.substring(0, 100), // Log first 100 chars
        length: value.length
      });
    }
  }

  return { fields, files };
}

/**
 * Parse multipart body into parts
 * @private
 */
function parseMultipartBody(body, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

  let position = 0;

  // Find first boundary
  position = body.indexOf(boundaryBuffer, position);
  if (position === -1) {
    throw new Error('No boundary found in body');
  }

  position += boundaryBuffer.length;

  while (position < body.length) {
    // Skip CRLF after boundary
    if (body[position] === 0x0d && body[position + 1] === 0x0a) {
      position += 2;
    }

    // Find next boundary
    const nextBoundary = body.indexOf(boundaryBuffer, position);
    if (nextBoundary === -1) {
      break;
    }

    // Extract part between boundaries
    const partBuffer = body.slice(position, nextBoundary);

    // Parse part FIRST (before checking for end boundary)
    try {
      const part = parsePart(partBuffer);
      if (part) {
        parts.push(part);
      }
    } catch (error) {
      logger.warn('Failed to parse part', { error: error.message });
    }

    // Move to next boundary
    position = nextBoundary + boundaryBuffer.length;

    // Check if the CURRENT boundary (that we just moved to) is the end boundary
    if (body.slice(nextBoundary, nextBoundary + endBoundaryBuffer.length).equals(endBoundaryBuffer)) {
      break;
    }
  }

  logger.debug('Multipart parsing complete', { partCount: parts.length });
  return parts;
}

/**
 * Parse a single multipart part
 * @private
 */
function parsePart(partBuffer) {
  // Find the blank line that separates headers from body
  const crlfcrlfIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
  if (crlfcrlfIndex === -1) {
    throw new Error('Invalid part: no blank line found');
  }

  // Extract headers and body
  const headersBuffer = partBuffer.slice(0, crlfcrlfIndex);
  const bodyBuffer = partBuffer.slice(crlfcrlfIndex + 4); // Skip \r\n\r\n

  // Parse headers
  const headersText = headersBuffer.toString('utf-8');
  const headers = parseHeaders(headersText);

  // Extract Content-Disposition info
  const disposition = headers['content-disposition'];
  if (!disposition) {
    throw new Error('No Content-Disposition header found');
  }

  const nameMatch = disposition.match(/name="([^"]+)"/);
  if (!nameMatch) {
    throw new Error('No name found in Content-Disposition');
  }

  const name = nameMatch[1];
  const filenameMatch = disposition.match(/filename="([^"]+)"/);
  const filename = filenameMatch ? filenameMatch[1] : null;

  const contentType = headers['content-type'] || 'text/plain';

  return {
    name,
    filename,
    contentType,
    data: bodyBuffer,
  };
}

/**
 * Parse headers from text
 * @private
 */
function parseHeaders(headersText) {
  const headers = {};
  const lines = headersText.split('\r\n');

  for (const line of lines) {
    if (!line) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    headers[key] = value;
  }

  return headers;
}

export {
  parseMultipartFormData,
};
