import SkillCard from '../components/SkillCard';
import EquipmentCard from '../components/EquipmentCard';
import DataInjector from '../components/DataInjector';
import SpiritSprite from '../components/SpiritSprite';
import SpiritCard from '../components/SpiritCard';

/**
 * Process game-specific syntax in markdown content
 * Converts both {{...}} and <!-- ... --> formats into internal {{...}} markers
 * Mode/template is optional, defaults to 'detailed' for skills/equipment/spirits and 'card' for data
 *
 * Supported syntax ({{...}} is preferred):
 * - {{skill:Fire Slash}} or <!-- skill:Fire Slash --> (defaults to detailed)
 * - {{skill:Fire Slash:compact}} or <!-- skill:Fire Slash:compact -->
 * - {{equipment:Common Sword:detailed}} or <!-- equipment:Common Sword:detailed -->
 * - {{spirit:Loar}} or <!-- spirit:Loar --> (defaults to detailed)
 * - {{spirit:Loar:compact}} or <!-- spirit:Loar:compact -->
 * - {{data:spirits:1}} or <!-- data:spirits:1 --> (defaults to card template)
 * - {{data:spirits:1:inline}} or <!-- data:spirits:1:inline -->
 * - {{spirit-sprite:1:0}} or <!-- spirit-sprite:1:0 -->
 *
 * @param {string} content - Markdown content
 * @returns {string} - Processed content with internal markers
 */
export const processGameSyntax = (content) => {
  if (!content) return content;

  console.log('[Game Content] processGameSyntax called, content length:', content.length);

  let processed = content;

  // Process {{skill:...}} format (already in final format, convert to uppercase marker)
  processed = processed.replace(/\{\{\s*skill:\s*([^:}]+?)\s*(?::\s*(\w+?)\s*)?\}\}/gi, (match, name, mode) => {
    const modeStr = mode || 'detailed';
    console.log('[Game Content] Converting {{skill}}:', match, '→', `{{SKILL:${name}:${modeStr}}}`);
    return `{{SKILL:${name}:${modeStr}}}`;
  });

  // Process <!-- skill:... --> format (legacy support)
  processed = processed.replace(/<!--\s*skill:\s*([^:]+?)(?::(\w+?))?\s*-->/gi, (match, name, mode) => {
    const modeStr = mode || 'detailed';
    console.log('[Game Content] Converting <!-- skill -->:', match, '→', `{{SKILL:${name}:${modeStr}}}`);
    return `{{SKILL:${name}:${modeStr}}}`;
  });

  // Process {{equipment:...}} format
  processed = processed.replace(/\{\{\s*equipment:\s*([^:}]+?)\s*(?::\s*(\w+?)\s*)?\}\}/gi, (match, name, mode) => {
    const modeStr = mode || 'detailed';
    console.log('[Game Content] Converting {{equipment}}:', match, '→', `{{EQUIPMENT:${name}:${modeStr}}}`);
    return `{{EQUIPMENT:${name}:${modeStr}}}`;
  });

  // Process <!-- equipment:... --> format (legacy)
  processed = processed.replace(/<!--\s*equipment:\s*([^:]+?)(?::(\w+?))?\s*-->/gi, (match, name, mode) => {
    const modeStr = mode || 'detailed';
    console.log('[Game Content] Converting <!-- equipment -->:', match, '→', `{{EQUIPMENT:${name}:${modeStr}}}`);
    return `{{EQUIPMENT:${name}:${modeStr}}}`;
  });

  // Process {{spirit:...}} format
  processed = processed.replace(/\{\{\s*spirit:\s*([^:}]+?)\s*(?::\s*(\w+?)\s*)?(?::\s*(\d+?)\s*)?\}\}/gi, (match, name, mode, level) => {
    const modeStr = mode || 'detailed';
    const levelStr = level || '0';
    console.log('[Game Content] Converting {{spirit}}:', match, '→', `{{SPIRIT:${name}:${modeStr}:${levelStr}}}`);
    return `{{SPIRIT:${name}:${modeStr}:${levelStr}}}`;
  });

  // Process <!-- spirit:... --> format (legacy)
  processed = processed.replace(/<!--\s*spirit:\s*([^:]+?)(?::(\w+?))?(?::(\d+?))?\s*-->/gi, (match, name, mode, level) => {
    const modeStr = mode || 'detailed';
    const levelStr = level || '0';
    console.log('[Game Content] Converting <!-- spirit -->:', match, '→', `{{SPIRIT:${name}:${modeStr}:${levelStr}}}`);
    return `{{SPIRIT:${name}:${modeStr}:${levelStr}}}`;
  });

  // Process {{data:...}} format (this is the autocomplete output, needs uppercase conversion)
  // Match lowercase 'data:' and convert to uppercase 'DATA:'
  let dataConversions = 0;
  processed = processed.replace(/\{\{\s*data:\s*([^:}]+?)\s*:\s*([^:}]+?)\s*(?::\s*([^:}]+?)\s*)?(?::\s*([^}]+?)\s*)?\}\}/gi, (match, source, id, fieldOrTemplate, showId) => {
    const thirdParam = (fieldOrTemplate || 'card').trim();
    const fourthParam = showId !== undefined ? showId.trim() : 'true';
    console.log('[Game Content] Converting {{data}}:', match, '→', `{{DATA:${source}:${id}:${thirdParam}:${fourthParam}}}`);
    dataConversions++;
    return `{{DATA:${source}:${id}:${thirdParam}:${fourthParam}}}`;
  });

  // Process <!-- data:... --> format (legacy)
  processed = processed.replace(/<!--\s*data:\s*([^:]+?):([^:]+?)(?::([^:]+?))?(?::([^-]+?))?\s*-->/gi, (match, source, id, fieldOrTemplate, showId) => {
    const thirdParam = (fieldOrTemplate || 'card').trim();
    const fourthParam = showId !== undefined ? showId.trim() : 'true';
    console.log('[Game Content] Converting <!-- data -->:', match, '→', `{{DATA:${source}:${id}:${thirdParam}:${fourthParam}}}`);
    dataConversions++;
    return `{{DATA:${source}:${id}:${thirdParam}:${fourthParam}}}`;
  });

  // Process {{spirit-sprite:...}} format
  let spriteConversions = 0;
  processed = processed.replace(/\{\{\s*spirit-sprite:\s*(\d+)\s*(?::\s*(\d+)\s*)?(?::\s*([^:}]+?)\s*)?(?::\s*([^:}]+?)\s*)?(?::\s*([^:}]+?)\s*)?(?::\s*([^:}]+?)\s*)?(?::\s*([^}]+?)\s*)?\}\}/gi,
    (match, id, level, size, animated, showInfo, fps, animationType) => {
      const params = [
        id,
        level || '0',
        size || '',
        animated || '',
        showInfo || '',
        fps || '',
        animationType || ''
      ].join(':');
      console.log('[Game Content] Converting {{spirit-sprite}}:', match, '→', `{{SPIRIT_SPRITE:${params}}}`);
      spriteConversions++;
      return `{{SPIRIT_SPRITE:${params}}}`;
    }
  );

  // Process <!-- spirit-sprite:... --> format (legacy)
  processed = processed.replace(/<!--\s*spirit-sprite:\s*(\d+)(?::(\d+))?(?::([^:]+))?(?::([^:]+))?(?::([^:]+))?(?::([^:]+))?(?::([^-]+?))?\s*-->/gi,
    (match, id, level, size, animated, showInfo, fps, animationType) => {
      const params = [
        id,
        level || '0',
        size || '',
        animated || '',
        showInfo || '',
        fps || '',
        animationType || ''
      ].join(':');
      console.log('[Game Content] Converting <!-- spirit-sprite -->:', match, '→', `{{SPIRIT_SPRITE:${params}}}`);
      spriteConversions++;
      return `{{SPIRIT_SPRITE:${params}}}`;
    }
  );

  console.log('[Game Content] Conversion complete - converted', dataConversions, 'data markers and', spriteConversions, 'spirit-sprite markers');
  const hasConvertedMarkers = processed.includes('{{DATA:') || processed.includes('{{SKILL:') || processed.includes('{{EQUIPMENT:') || processed.includes('{{SPIRIT_SPRITE:') || processed.includes('{{SPIRIT:');
  console.log('[Game Content] Processed content contains converted markers:', hasConvertedMarkers);

  return processed;
};

/**
 * Helper function to extract text content from ReactMarkdown children
 * Handles strings, arrays, and nested React elements
 */
const extractTextContent = (children) => {
  if (typeof children === 'string') {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map(child => extractTextContent(child)).join('');
  }

  if (children?.props?.children) {
    return extractTextContent(children.props.children);
  }

  return String(children || '');
};

/**
 * Custom paragraph renderer that detects and renders skill/equipment cards and data injections
 * Use this with ReactMarkdown's components prop
 *
 * Parses markers like:
 * - {{SKILL:Fire Slash:compact}}
 * - {{SKILL:Fire Slash:detailed}}
 * - {{EQUIPMENT:Sword:advanced}}
 * - {{DATA:spirits:1:card}}
 * - {{DATA:skills:Fire Slash:inline}}
 *
 * Supports both standalone markers (entire paragraph) and inline markers (mixed with text)
 */
export const CustomParagraph = ({ node, children, ...props }) => {
  // Extract full text content including markers from potentially nested children
  const content = extractTextContent(children).trim();

  console.log('[Game Content] CustomParagraph called, raw children:', children);
  console.log('[Game Content] CustomParagraph extracted content:', content);

  // Check for standalone skill marker (entire paragraph is just a marker)
  const skillMatch = content.match(/^\{\{SKILL:([^:]+?)(?::(\w+?))?\}\}$/);
  if (skillMatch) {
    const skillIdentifier = skillMatch[1].trim();
    const mode = skillMatch[2] || 'detailed';
    const isId = /^\d+$/.test(skillIdentifier);
    console.log('[Game Content] Rendering standalone SkillCard:', skillIdentifier, 'mode:', mode, 'isId:', isId);

    // Render SkillCard with name or id prop and mode
    const cardProps = isId
      ? { id: parseInt(skillIdentifier), mode }
      : { name: skillIdentifier, mode };
    return <SkillCard {...cardProps} />;
  }

  // Check for standalone equipment marker
  const equipmentMatch = content.match(/^\{\{EQUIPMENT:([^:]+?)(?::(\w+?))?\}\}$/);
  if (equipmentMatch) {
    const equipmentIdentifier = equipmentMatch[1].trim();
    const mode = equipmentMatch[2] || 'detailed';
    const isId = /^\d+$/.test(equipmentIdentifier);
    console.log('[Game Content] Rendering standalone EquipmentCard:', equipmentIdentifier, 'mode:', mode, 'isId:', isId);

    // Render EquipmentCard with name or id prop and mode
    const cardProps = isId
      ? { id: parseInt(equipmentIdentifier), mode }
      : { name: equipmentIdentifier, mode };
    return <EquipmentCard {...cardProps} />;
  }

  // Check for standalone spirit marker
  const spiritMatch = content.match(/^\{\{SPIRIT:([^:]+?)(?::(\w+?))?(?::(\d+?))?\}\}$/);
  if (spiritMatch) {
    const spiritIdentifier = spiritMatch[1].trim();
    const mode = spiritMatch[2] || 'detailed';
    const level = spiritMatch[3] ? parseInt(spiritMatch[3]) : 0;
    const isId = /^\d+$/.test(spiritIdentifier);
    console.log('[Game Content] Rendering standalone SpiritCard:', spiritIdentifier, 'mode:', mode, 'level:', level, 'isId:', isId);

    // Render SpiritCard with name or id prop, mode, and level
    const cardProps = isId
      ? { id: parseInt(spiritIdentifier), mode, level }
      : { name: spiritIdentifier, mode, level };
    return <SpiritCard {...cardProps} />;
  }

  // Check for standalone data injection marker
  const dataMatch = content.match(/^\{\{DATA:([^:]+?):([^:]+?)(?::([^:]+?))?(?::([^}]+?))?\}\}$/);
  if (dataMatch) {
    const source = dataMatch[1].trim();
    const id = dataMatch[2].trim();
    const fieldOrTemplate = (dataMatch[3] || 'card').trim();
    const showId = dataMatch[4] !== undefined ? dataMatch[4].trim() === 'true' : true;
    console.log('[Game Content] Rendering standalone DataInjector:', source, id, 'field/template:', fieldOrTemplate, 'showId:', showId);

    return <DataInjector source={source} id={id} fieldOrTemplate={fieldOrTemplate} showId={showId} />;
  }

  // Check for standalone spirit sprite marker
  const spriteMatch = content.match(/^\{\{SPIRIT_SPRITE:([^}]+)\}\}$/);
  if (spriteMatch) {
    const params = spriteMatch[1].split(':');
    const spiritId = parseInt(params[0]);
    const level = parseInt(params[1] || '0');
    const size = params[2] || 'large';
    const animated = params[3] ? params[3] === 'true' : true;
    const showInfo = params[4] ? params[4] === 'true' : true;
    const fps = params[5] ? parseInt(params[5]) : 8;
    const animationType = params[6] || 'idle';

    console.log('[Game Content] Rendering standalone SpiritSprite:', {
      spiritId, level, size, animated, showInfo, fps, animationType
    });

    return (
      <div className="my-4 flex justify-center">
        <SpiritSprite
          spiritId={spiritId}
          level={level}
          size={size}
          animated={animated}
          showInfo={showInfo}
          fps={fps}
          animationType={animationType}
        />
      </div>
    );
  }

  // Check for inline markers (markers mixed with text)
  if (content.includes('{{')) {
    console.log('[Game Content] Processing inline markers in paragraph:', content);

    const parts = [];
    let lastIndex = 0;

    // Match all markers in the content
    const markerRegex = /\{\{(SKILL|EQUIPMENT|SPIRIT|DATA|SPIRIT_SPRITE):([^}]+)\}\}/g;
    let match;

    while ((match = markerRegex.exec(content)) !== null) {
      // Add text before the marker
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      const type = match[1];
      const params = match[2];

      // Process based on type
      if (type === 'SKILL') {
        const [skillIdentifier, mode = 'detailed'] = params.split(':');
        const isId = /^\d+$/.test(skillIdentifier);
        const cardProps = isId
          ? { id: parseInt(skillIdentifier), mode }
          : { name: skillIdentifier, mode };
        parts.push(<SkillCard key={match.index} {...cardProps} />);
      } else if (type === 'EQUIPMENT') {
        const [equipmentIdentifier, mode = 'detailed'] = params.split(':');
        const isId = /^\d+$/.test(equipmentIdentifier);
        const cardProps = isId
          ? { id: parseInt(equipmentIdentifier), mode }
          : { name: equipmentIdentifier, mode };
        parts.push(<EquipmentCard key={match.index} {...cardProps} />);
      } else if (type === 'SPIRIT') {
        const paramParts = params.split(':');
        const spiritIdentifier = paramParts[0];
        const mode = paramParts[1] || 'detailed';
        const level = paramParts[2] ? parseInt(paramParts[2]) : 0;
        const isId = /^\d+$/.test(spiritIdentifier);
        const cardProps = isId
          ? { id: parseInt(spiritIdentifier), mode, level }
          : { name: spiritIdentifier, mode, level };
        parts.push(<SpiritCard key={match.index} {...cardProps} />);
      } else if (type === 'DATA') {
        const paramParts = params.split(':');
        const source = paramParts[0]?.trim();
        const id = paramParts[1]?.trim();
        const fieldOrTemplate = (paramParts[2] || 'card').trim();
        const showId = paramParts[3] !== undefined ? paramParts[3].trim() === 'true' : true;

        if (source && id) {
          parts.push(<DataInjector key={match.index} source={source} id={id} fieldOrTemplate={fieldOrTemplate} showId={showId} />);
        }
      } else if (type === 'SPIRIT_SPRITE') {
        const paramParts = params.split(':');
        const spiritId = parseInt(paramParts[0]);
        const level = parseInt(paramParts[1] || '0');
        const size = paramParts[2] || 'small';
        const animated = paramParts[3] ? paramParts[3] === 'true' : true;
        const showInfo = paramParts[4] ? paramParts[4] === 'true' : false;
        const fps = paramParts[5] ? parseInt(paramParts[5]) : 8;
        const animationType = paramParts[6] || 'idle';

        if (!isNaN(spiritId)) {
          parts.push(
            <span key={match.index} className="inline-block align-middle mx-1">
              <SpiritSprite
                spiritId={spiritId}
                level={level}
                size={size}
                animated={animated}
                showInfo={showInfo}
                fps={fps}
                animationType={animationType}
              />
            </span>
          );
        }
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return <p {...props}>{parts.length === 1 ? parts[0] : parts}</p>;
  }

  // Regular paragraph (no markers)
  return <p {...props}>{children}</p>;
};

/**
 * Render a skill card preview for SkillPicker
 * @param {object} params - { skill, mode }
 * @returns {JSX.Element} - SkillCard component
 */
export const renderSkillPreview = ({ skill, mode }) => {
  return <SkillCard skill={skill} mode={mode} />;
};

/**
 * Render an equipment card preview for EquipmentPicker
 * @param {object} params - { equipment, mode }
 * @returns {JSX.Element} - EquipmentCard component
 */
export const renderEquipmentPreview = ({ equipment, mode }) => {
  return <EquipmentCard equipment={equipment} mode={mode} />;
};

/**
 * Helper function to process content with markers and return React elements
 */
const processInlineMarkers = (content) => {
  if (!content || typeof content !== 'string' || !content.includes('{{')) {
    return content;
  }

  const parts = [];
  let lastIndex = 0;

  // Match all markers in the content
  const markerRegex = /\{\{(SKILL|EQUIPMENT|DATA|SPIRIT_SPRITE):([^}]+)\}\}/g;
  let match;

  while ((match = markerRegex.exec(content)) !== null) {
    // Add text before the marker
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const type = match[1];
    const params = match[2];

    // Process based on type
    if (type === 'SKILL') {
      const [skillIdentifier, mode = 'detailed'] = params.split(':');
      const isId = /^\d+$/.test(skillIdentifier);
      const cardProps = isId
        ? { id: parseInt(skillIdentifier), mode }
        : { name: skillIdentifier, mode };
      parts.push(<SkillCard key={match.index} {...cardProps} />);
    } else if (type === 'EQUIPMENT') {
      const [equipmentIdentifier, mode = 'detailed'] = params.split(':');
      const isId = /^\d+$/.test(equipmentIdentifier);
      const cardProps = isId
        ? { id: parseInt(equipmentIdentifier), mode }
        : { name: equipmentIdentifier, mode };
      parts.push(<EquipmentCard key={match.index} {...cardProps} />);
    } else if (type === 'DATA') {
      const paramParts = params.split(':');
      const source = paramParts[0]?.trim();
      const id = paramParts[1]?.trim();
      const fieldOrTemplate = (paramParts[2] || 'card').trim();

      if (source && id) {
        parts.push(<DataInjector key={match.index} source={source} id={id} fieldOrTemplate={fieldOrTemplate} />);
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
};

// Note: ReactMarkdown doesn't have a 'text' component type, so we handle
// inline markers in the parent components (p, td, th) instead

/**
 * Custom table cell renderer to support inline markers in tables
 */
export const CustomTableCell = ({ node, children, ...props }) => {
  // Handle different types of children
  let content;
  if (Array.isArray(children)) {
    content = children.map(c => String(c)).join('').trim();
  } else {
    content = String(children).trim();
  }

  console.log('[Game Content] CustomTableCell called with content:', content);

  // Check if contains markers
  if (!content.includes('{{')) {
    console.log('[Game Content] No markers found in table cell');
    return <td {...props}>{children}</td>;
  }

  console.log('[Game Content] Processing markers in table cell');

  // Split by markers and process each part
  const parts = [];
  let lastIndex = 0;

  // Match all markers in the content
  const markerRegex = /\{\{(SKILL|EQUIPMENT|DATA|SPIRIT_SPRITE):([^}]+)\}\}/g;
  let match;

  while ((match = markerRegex.exec(content)) !== null) {
    // Add text before the marker
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const type = match[1];
    const params = match[2];

    // Process based on type
    if (type === 'SKILL') {
      const [skillIdentifier, mode = 'detailed'] = params.split(':');
      const isId = /^\d+$/.test(skillIdentifier);
      const cardProps = isId
        ? { id: parseInt(skillIdentifier), mode }
        : { name: skillIdentifier, mode };
      parts.push(<SkillCard key={`skill-${match.index}`} {...cardProps} />);
    } else if (type === 'EQUIPMENT') {
      const [equipmentIdentifier, mode = 'detailed'] = params.split(':');
      const isId = /^\d+$/.test(equipmentIdentifier);
      const cardProps = isId
        ? { id: parseInt(equipmentIdentifier), mode }
        : { name: equipmentIdentifier, mode };
      parts.push(<EquipmentCard key={`equipment-${match.index}`} {...cardProps} />);
    } else if (type === 'DATA') {
      const paramParts = params.split(':');
      const source = paramParts[0]?.trim();
      const id = paramParts[1]?.trim();
      const fieldOrTemplate = (paramParts[2] || 'card').trim();

      if (source && id) {
        parts.push(<DataInjector key={`data-${match.index}`} source={source} id={id} fieldOrTemplate={fieldOrTemplate} />);
      }
    } else if (type === 'SPIRIT_SPRITE') {
      const paramParts = params.split(':');
      const spiritId = parseInt(paramParts[0]);
      const level = parseInt(paramParts[1] || '0');

      if (!isNaN(spiritId)) {
        parts.push(
          <span key={`sprite-${match.index}`} className="inline-block align-middle mx-1">
            <SpiritSprite spiritId={spiritId} level={level} size="small" showInfo={false} />
          </span>
        );
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return <td {...props}>{parts.length === 1 ? parts[0] : parts}</td>;
};

/**
 * Custom list item renderer to support inline markers in lists
 */
export const CustomListItem = ({ node, children, ...props }) => {
  // Extract full text content including markers from potentially nested children
  const content = extractTextContent(children).trim();

  console.log('[Game Content] CustomListItem called, raw children:', children);
  console.log('[Game Content] CustomListItem extracted content:', content);

  // Check for inline markers (markers mixed with text)
  if (content.includes('{{')) {
    console.log('[Game Content] Processing inline markers in list item:', content);

    const parts = [];
    let lastIndex = 0;

    // Match all markers in the content
    const markerRegex = /\{\{(SKILL|EQUIPMENT|SPIRIT|DATA|SPIRIT_SPRITE):([^}]+)\}\}/g;
    let match;

    while ((match = markerRegex.exec(content)) !== null) {
      // Add text before the marker
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      const type = match[1];
      const params = match[2];

      // Process based on type
      if (type === 'SKILL') {
        const [skillIdentifier, mode = 'detailed'] = params.split(':');
        const isId = /^\d+$/.test(skillIdentifier);
        const cardProps = isId
          ? { id: parseInt(skillIdentifier), mode }
          : { name: skillIdentifier, mode };
        parts.push(<SkillCard key={match.index} {...cardProps} />);
      } else if (type === 'EQUIPMENT') {
        const [equipmentIdentifier, mode = 'detailed'] = params.split(':');
        const isId = /^\d+$/.test(equipmentIdentifier);
        const cardProps = isId
          ? { id: parseInt(equipmentIdentifier), mode }
          : { name: equipmentIdentifier, mode };
        parts.push(<EquipmentCard key={match.index} {...cardProps} />);
      } else if (type === 'SPIRIT') {
        const paramParts = params.split(':');
        const spiritIdentifier = paramParts[0];
        const mode = paramParts[1] || 'detailed';
        const level = paramParts[2] ? parseInt(paramParts[2]) : 0;
        const isId = /^\d+$/.test(spiritIdentifier);
        const cardProps = isId
          ? { id: parseInt(spiritIdentifier), mode, level }
          : { name: spiritIdentifier, mode, level };
        parts.push(<SpiritCard key={match.index} {...cardProps} />);
      } else if (type === 'DATA') {
        const paramParts = params.split(':');
        const source = paramParts[0]?.trim();
        const id = paramParts[1]?.trim();
        const fieldOrTemplate = (paramParts[2] || 'card').trim();
        const showId = paramParts[3] !== undefined ? paramParts[3].trim() === 'true' : true;

        if (source && id) {
          parts.push(<DataInjector key={match.index} source={source} id={id} fieldOrTemplate={fieldOrTemplate} showId={showId} />);
        }
      } else if (type === 'SPIRIT_SPRITE') {
        const paramParts = params.split(':');
        const spiritId = parseInt(paramParts[0]);
        const level = parseInt(paramParts[1] || '0');
        const size = paramParts[2] || 'small';
        const animated = paramParts[3] ? paramParts[3] === 'true' : true;
        const showInfo = paramParts[4] ? paramParts[4] === 'true' : false;
        const fps = paramParts[5] ? parseInt(paramParts[5]) : 8;
        const animationType = paramParts[6] || 'idle';

        if (!isNaN(spiritId)) {
          parts.push(
            <span key={match.index} className="inline-block align-middle mx-1">
              <SpiritSprite
                spiritId={spiritId}
                level={level}
                size={size}
                animated={animated}
                showInfo={showInfo}
                fps={fps}
                animationType={animationType}
              />
            </span>
          );
        }
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return <li {...props}>{parts.length === 1 ? parts[0] : parts}</li>;
  }

  // Regular list item (no markers)
  return <li {...props}>{children}</li>;
};

/**
 * Custom table header cell renderer to support inline markers
 */
export const CustomTableHeaderCell = ({ node, children, ...props }) => {
  // Handle different types of children
  let content;
  if (Array.isArray(children)) {
    content = children.map(c => String(c)).join('').trim();
  } else {
    content = String(children).trim();
  }

  console.log('[Game Content] CustomTableHeaderCell called with content:', content);

  // Check if contains markers
  if (!content.includes('{{')) {
    console.log('[Game Content] No markers found in table header cell');
    return <th {...props}>{children}</th>;
  }

  console.log('[Game Content] Processing markers in table header cell');

  // Split by markers and process each part
  const parts = [];
  let lastIndex = 0;

  // Match all markers in the content
  const markerRegex = /\{\{(SKILL|EQUIPMENT|DATA|SPIRIT_SPRITE):([^}]+)\}\}/g;
  let match;

  while ((match = markerRegex.exec(content)) !== null) {
    // Add text before the marker
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const type = match[1];
    const params = match[2];

    // Process based on type (same as table cell)
    if (type === 'SKILL') {
      const [skillIdentifier, mode = 'detailed'] = params.split(':');
      const isId = /^\d+$/.test(skillIdentifier);
      const cardProps = isId
        ? { id: parseInt(skillIdentifier), mode }
        : { name: skillIdentifier, mode };
      parts.push(<SkillCard key={`skill-${match.index}`} {...cardProps} />);
    } else if (type === 'EQUIPMENT') {
      const [equipmentIdentifier, mode = 'detailed'] = params.split(':');
      const isId = /^\d+$/.test(equipmentIdentifier);
      const cardProps = isId
        ? { id: parseInt(equipmentIdentifier), mode }
        : { name: equipmentIdentifier, mode };
      parts.push(<EquipmentCard key={`equipment-${match.index}`} {...cardProps} />);
    } else if (type === 'DATA') {
      const paramParts = params.split(':');
      const source = paramParts[0]?.trim();
      const id = paramParts[1]?.trim();
      const fieldOrTemplate = (paramParts[2] || 'card').trim();

      if (source && id) {
        parts.push(<DataInjector key={`data-${match.index}`} source={source} id={id} fieldOrTemplate={fieldOrTemplate} />);
      }
    } else if (type === 'SPIRIT_SPRITE') {
      const paramParts = params.split(':');
      const spiritId = parseInt(paramParts[0]);
      const level = parseInt(paramParts[1] || '0');

      if (!isNaN(spiritId)) {
        parts.push(
          <span key={`sprite-${match.index}`} className="inline-block align-middle mx-1">
            <SpiritSprite spiritId={spiritId} level={level} size="small" showInfo={false} />
          </span>
        );
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return <th {...props}>{parts.length === 1 ? parts[0] : parts}</th>;
};

/**
 * Get custom ReactMarkdown components for game content
 * Use this object with PageViewer's customComponents prop
 */
export const getGameComponents = () => ({
  p: CustomParagraph,
  li: CustomListItem,
  td: CustomTableCell,
  th: CustomTableHeaderCell,
});
