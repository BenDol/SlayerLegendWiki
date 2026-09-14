/**
 * Emoticon Component
 *
 * Displays Slayer Legend emoticons by ID or name
 * Can be used in both React and markdown
 *
 * Usage in React:
 *   <Emoticon id={1} />
 *   <Emoticon name="Hello" />
 *   <Emoticon id={1001} size="large" />
 *   <Emoticon id={1001} size="original" /> // Native resolution, no scaling
 *
 * Usage in Markdown:
 *   {{emoticon:1}}
 *   {{emoticon:Hello}}
 *   {{emoticon:1001:large}}
 *   {{emoticon:Sleep:original}}
 *
 * Size options: small (24px), medium (32px), large (48px), xlarge (64px), original (native)
 */

import React from 'react';
import PropTypes from 'prop-types';
import { createLogger } from '../utils/logger';
import { resolveImagePath } from '../../wiki-framework/src/utils/imageResolver';

const logger = createLogger('Emoticon');

// The catalogue lives in src/data/emoticons.js (pure data) so the build-time
// prerenderer can render the same emoticons without importing React.
import { EMOTICON_MAP, EMOTICON_NAME_TO_ID, emoticonImagePath } from '../data/emoticons.js';

export { EMOTICON_MAP, EMOTICON_NAME_TO_ID };

// Size presets
const SIZE_MAP = {
  small: '24px',
  medium: '32px',
  large: '48px',
  xlarge: '64px',
  original: null, // No scaling - use native resolution
};

const Emoticon = ({ id, name, size = 'large', alt, className = '', style = {} }) => {
  // Determine the emoticon ID
  let emoticonId = id;

  if (!emoticonId && name) {
    emoticonId = EMOTICON_NAME_TO_ID[name.toLowerCase()];
  }

  // Validate emoticon ID
  if (!emoticonId || !EMOTICON_MAP[emoticonId]) {
    logger.error('Invalid emoticon ID or name', { id, name });
    return (
      <span
        className={`inline-block text-red-500 text-sm ${className}`}
        title={`Unknown emoticon: ${id || name}`}
      >
        [?]
      </span>
    );
  }

  // Get emoticon name for alt text
  const emoticonName = EMOTICON_MAP[emoticonId];
  const imagePath = resolveImagePath(emoticonImagePath(emoticonId));
  const altText = alt || emoticonName;

  // Determine size
  const sizeValue = SIZE_MAP[size] !== undefined ? SIZE_MAP[size] : size;

  // Build style object - omit width/height for 'original' size
  const imgStyle = {
    display: 'inline',
    objectFit: 'contain',
    verticalAlign: 'middle',
    margin: 0,
    padding: 0,
    lineHeight: 0,
    ...style,
  };

  // Only add width/height if not using original size
  if (sizeValue !== null) {
    imgStyle.width = sizeValue;
    imgStyle.height = sizeValue;
  }

  return (
    <img
      src={imagePath}
      alt={altText}
      title={emoticonName}
      className={className}
      style={imgStyle}
      loading="lazy"
    />
  );
};

Emoticon.propTypes = {
  id: PropTypes.number,
  name: PropTypes.string,
  size: PropTypes.oneOfType([
    PropTypes.oneOf(['small', 'medium', 'large', 'xlarge', 'original']),
    PropTypes.string,
  ]),
  alt: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
};

export default Emoticon;
