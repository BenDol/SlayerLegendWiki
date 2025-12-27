import SkillCard from '../components/SkillCard';
import EquipmentCard from '../components/EquipmentCard';
import DataInjector from '../components/DataInjector';
import SpiritSprite from '../components/SpiritSprite';
import SpiritCard from '../components/SpiritCard';
import ContributionBanner from '../components/ContributionBanner';
import Emoticon from '../components/Emoticon';
import BattleLoadoutCard from '../components/BattleLoadoutCard';
import { VideoGuideCard } from '../../wiki-framework/src/components/contentCreators';

/**
 * Process game-specific syntax in markdown content
 * Converts both {{...}} and <!-- ... --> formats into internal {{...}} markers
 * Mode/template is optional, defaults to 'detailed' for skills/equipment/spirits and 'card' for data
 *
 * Supported syntax ({{...}} is preferred):
 * - {{skill:Fire Slash}} or <!-- skill:Fire Slash --> (defaults to detailed)
 * - {{skill:Fire Slash:compact}} or <!-- skill:Fire Slash:compact -->
 * - {{equipment:Common Sword:detailed}} or <!-- equipment:Common Sword:detailed -->
 * - {{spirit:Loar}} or <!-- spirit:Loar --> (defaults to detailed, level 0, inline)
 * - {{spirit:Loar:compact:4}} or <!-- spirit:Loar:compact:4 --> (compact, level 4, inline)
 * - {{spirit:Loar:compact:4:block}} or <!-- spirit:Loar:compact:4:block --> (compact, level 4, block)
 * - {{data:spirits:1}} or <!-- data:spirits:1 --> (defaults to card template)
 * - {{data:spirits:1:inline}} or <!-- data:spirits:1:inline -->
 * - {{spirit-sprite:1:0}} or <!-- spirit-sprite:1:0 -->
 * - {{contribution-banner:ai-generated}} or <!-- contribution-banner:ai-generated -->
 * - {{emoticon:1}} or {{emoticon:Hello}} - Emoticon by ID or name (defaults to large size)
 * - {{emoticon:1:medium}} or {{emoticon:Hello:small}} - Emoticon with custom size
 * - {{emoticon:Sleep:original}} - Emoticon at native resolution (no scaling)
 * - Size options: small (24px), medium (32px), large (48px), xlarge (64px), original (native)
 *
 * @param {string} content - Markdown content
 * @returns {string} - Processed content with internal markers
 */
export const processGameSyntax = (content) => {
  if (!content) return content;

  let processed = content;

  // Process {{skill:...}} format (already in final format, convert to uppercase marker)
  processed = processed.replace(/\{\{\s*skill:\s*([^:}]+?)\s*(?::\s*(\w+?)\s*)?\}\}/gi, (match, name, mode) => {
    const modeStr = mode || 'detailed';
    return `{{SKILL:${name}:${modeStr}}}`;
  });

  // Process <!-- skill:... --> format (legacy support)
  processed = processed.replace(/<!--\s*skill:\s*([^:]+?)(?::(\w+?))?\s*-->/gi, (match, name, mode) => {
    const modeStr = mode || 'detailed';
    return `{{SKILL:${name}:${modeStr}}}`;
  });

  // Process {{equipment:...}} format
  processed = processed.replace(/\{\{\s*equipment:\s*([^:}]+?)\s*(?::\s*(\w+?)\s*)?\}\}/gi, (match, name, mode) => {
    const modeStr = mode || 'detailed';
    return `{{EQUIPMENT:${name}:${modeStr}}}`;
  });

  // Process <!-- equipment:... --> format (legacy)
  processed = processed.replace(/<!--\s*equipment:\s*([^:]+?)(?::(\w+?))?\s*-->/gi, (match, name, mode) => {
    const modeStr = mode || 'detailed';
    return `{{EQUIPMENT:${name}:${modeStr}}}`;
  });

  // Process {{spirit:...}} format
  // Syntax: {{spirit:NAME:MODE:LEVEL:DISPLAY}}
  // Example: {{spirit:Loar:compact:4:inline}} or {{spirit:Loar:compact:4:block}}
  processed = processed.replace(/\{\{\s*spirit:\s*([^:}]+?)\s*(?::\s*(\w+?)\s*)?(?::\s*(\d+?)\s*)?(?::\s*(inline|block)\s*)?\}\}/gi, (match, name, mode, level, display) => {
    const modeStr = mode || 'detailed';
    const levelStr = level || '0';
    const displayStr = display || 'inline';
    return `{{SPIRIT:${name}:${modeStr}:${levelStr}:${displayStr}}}`;
  });

  // Process <!-- spirit:... --> format (legacy)
  processed = processed.replace(/<!--\s*spirit:\s*([^:]+?)(?::(\w+?))?(?::(\d+?))?(?::(inline|block))?\s*-->/gi, (match, name, mode, level, display) => {
    const modeStr = mode || 'detailed';
    const levelStr = level || '0';
    const displayStr = display || 'inline';
    return `{{SPIRIT:${name}:${modeStr}:${levelStr}:${displayStr}}}`;
  });

  // Process {{data:...}} format (this is the autocomplete output, needs uppercase conversion)
  // Match lowercase 'data:' and convert to uppercase 'DATA:'
  processed = processed.replace(/\{\{\s*data:\s*([^:}]+?)\s*:\s*([^:}]+?)\s*(?::\s*([^:}]+?)\s*)?(?::\s*([^}]+?)\s*)?\}\}/gi, (match, source, id, fieldOrTemplate, showId) => {
    const thirdParam = (fieldOrTemplate || 'card').trim();
    const fourthParam = showId !== undefined ? showId.trim() : 'true';
    return `{{DATA:${source}:${id}:${thirdParam}:${fourthParam}}}`;
  });

  // Process <!-- data:... --> format (legacy)
  processed = processed.replace(/<!--\s*data:\s*([^:]+?):([^:]+?)(?::([^:]+?))?(?::([^-]+?))?\s*-->/gi, (match, source, id, fieldOrTemplate, showId) => {
    const thirdParam = (fieldOrTemplate || 'card').trim();
    const fourthParam = showId !== undefined ? showId.trim() : 'true';
    return `{{DATA:${source}:${id}:${thirdParam}:${fourthParam}}}`;
  });

  // Process {{spirit-sprite:...}} format
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
      return `{{SPIRIT_SPRITE:${params}}}`;
    }
  );

  // Process {{contribution-banner:...}} format
  processed = processed.replace(/\{\{\s*contribution-banner:\s*([^}]+?)\s*\}\}/gi, (match, type) => {
    const typeStr = type || 'ai-generated';
    return `{{CONTRIBUTION_BANNER:${typeStr}}}`;
  });

  // Process <!-- contribution-banner:... --> format (legacy)
  processed = processed.replace(/<!--\s*contribution-banner:\s*([^-]+?)\s*-->/gi, (match, type) => {
    const typeStr = type || 'ai-generated';
    return `{{CONTRIBUTION_BANNER:${typeStr}}}`;
  });

  // Process {{video-guide:...}} format
  // Syntax: {{video-guide:ID}} or {{video-guide:TITLE}}
  processed = processed.replace(/\{\{\s*video-guide:\s*([^}]+?)\s*\}\}/gi, (match, identifier) => {
    return `{{VIDEO_GUIDE:${identifier}}}`;
  });

  // Process <!-- video-guide:... --> format (legacy)
  processed = processed.replace(/<!--\s*video-guide:\s*([^-]+?)\s*-->/gi, (match, identifier) => {
    return `{{VIDEO_GUIDE:${identifier}}}`;
  });

  // Process {{battle-loadout:...}} format
  // Syntax: {{battle-loadout:IDENTIFIER:MODE}}
  // Examples: {{battle-loadout:loadout-123:detailed}}, {{battle-loadout:abc123:compact}}
  processed = processed.replace(/\{\{\s*battle-loadout:\s*([^:}]+?)\s*(?::\s*(\w+?)\s*)?\}\}/gi, (match, identifier, mode) => {
    const modeStr = mode || 'detailed';
    return `{{BATTLE_LOADOUT:${identifier}:${modeStr}}}`;
  });

  // Process <!-- battle-loadout:... --> format (legacy)
  processed = processed.replace(/<!--\s*battle-loadout:\s*([^:]+?)(?::(\w+?))?\s*-->/gi, (match, identifier, mode) => {
    const modeStr = mode || 'detailed';
    return `{{BATTLE_LOADOUT:${identifier}:${modeStr}}}`;
  });

  // Process {{emoticon:...}} format
  // Syntax: {{emoticon:ID:SIZE}} or {{emoticon:NAME:SIZE}}
  // Examples: {{emoticon:1}}, {{emoticon:Hello}}, {{emoticon:1001:large}}, {{emoticon:Happy:small}}
  processed = processed.replace(/\{\{\s*emoticon:\s*([^:}]+?)\s*(?::\s*([^}]+?)\s*)?\}\}/gi, (match, idOrName, size) => {
    const sizeStr = size || 'large';
    return `{{EMOTICON:${idOrName}:${sizeStr}}}`;
  });

  // Process <!-- emoticon:... --> format (legacy)
  processed = processed.replace(/<!--\s*emoticon:\s*([^:]+?)(?::([^-]+?))?\s*-->/gi, (match, idOrName, size) => {
    const sizeStr = size || 'large';
    return `{{EMOTICON:${idOrName}:${sizeStr}}}`;
  });

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

  // Check for standalone skill marker (entire paragraph is just a marker)
  const skillMatch = content.match(/^\{\{SKILL:([^:]+?)(?::(\w+?))?\}\}$/);
  if (skillMatch) {
    const skillIdentifier = skillMatch[1].trim();
    const mode = skillMatch[2] || 'detailed';
    const isId = /^\d+$/.test(skillIdentifier);

    // Render SkillCard with name or id prop and mode
    const cardProps = isId
      ? { id: parseInt(skillIdentifier), mode }
      : { name: skillIdentifier, mode };

    // Wrap in div to avoid <p><div> nesting warning (cards render block-level divs)
    return (
      <div>
        <SkillCard {...cardProps} />
      </div>
    );
  }

  // Check for standalone equipment marker
  const equipmentMatch = content.match(/^\{\{EQUIPMENT:([^:]+?)(?::(\w+?))?\}\}$/);
  if (equipmentMatch) {
    const equipmentIdentifier = equipmentMatch[1].trim();
    const mode = equipmentMatch[2] || 'detailed';
    const isId = /^\d+$/.test(equipmentIdentifier);

    // Render EquipmentCard with name or id prop and mode
    const cardProps = isId
      ? { id: parseInt(equipmentIdentifier), mode }
      : { name: equipmentIdentifier, mode };

    // Wrap in div to avoid <p><div> nesting warning (cards render block-level divs)
    return (
      <div>
        <EquipmentCard {...cardProps} />
      </div>
    );
  }

  // Check for standalone spirit marker
  const spiritMatch = content.match(/^\{\{SPIRIT:([^:]+?)(?::(\w+?))?(?::(\d+?))?(?::(inline|block))?\}\}$/);
  if (spiritMatch) {
    const spiritIdentifier = spiritMatch[1].trim();
    const mode = spiritMatch[2] || 'detailed';
    const level = spiritMatch[3] ? parseInt(spiritMatch[3]) : 0;
    const display = spiritMatch[4] || 'inline';
    const inline = display === 'inline';
    const isId = /^\d+$/.test(spiritIdentifier);

    // Render SpiritCard with name or id prop, mode, level, and inline
    const cardProps = isId
      ? { id: parseInt(spiritIdentifier), mode, level, inline }
      : { name: spiritIdentifier, mode, level, inline };

    // Wrap in div to avoid <p><div> nesting warning (cards render block-level divs)
    return (
      <div>
        <SpiritCard {...cardProps} />
      </div>
    );
  }

  // Check for standalone data injection marker
  const dataMatch = content.match(/^\{\{DATA:([^:]+?):([^:]+?)(?::([^:]+?))?(?::([^}]+?))?\}\}$/);
  if (dataMatch) {
    const source = dataMatch[1].trim();
    const id = dataMatch[2].trim();
    const fieldOrTemplate = (dataMatch[3] || 'card').trim();
    const showId = dataMatch[4] !== undefined ? dataMatch[4].trim() === 'true' : true;

    // Wrap in div to avoid <p><div> nesting warning (card/table templates render block-level divs)
    return (
      <div>
        <DataInjector source={source} id={id} fieldOrTemplate={fieldOrTemplate} showId={showId} />
      </div>
    );
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

  // Check for standalone contribution banner marker
  const bannerMatch = content.match(/^\{\{CONTRIBUTION_BANNER:([^}]+)\}\}$/);
  if (bannerMatch) {
    const type = bannerMatch[1].trim();
    return (
      <div>
        <ContributionBanner type={type} />
      </div>
    );
  }

  // Check for standalone video guide marker
  const videoGuideMatch = content.match(/^\{\{VIDEO_GUIDE:([^}]+)\}\}$/);
  if (videoGuideMatch) {
    const identifier = videoGuideMatch[1].trim();

    // Simple heuristic: if alphanumeric+dashes, assume ID; otherwise, title
    const isId = /^[a-z0-9-]+$/.test(identifier);

    return (
      <div>
        <VideoGuideCard
          identifier={identifier}
          findBy={isId ? 'id' : 'title'}
          mode="embed"
          showId={false}
        />
      </div>
    );
  }

  // Check for standalone battle loadout marker
  const loadoutMatch = content.match(/^\{\{BATTLE_LOADOUT:([^:]+?)(?::(\w+?))?\}\}$/);
  if (loadoutMatch) {
    const identifier = loadoutMatch[1].trim();
    const mode = loadoutMatch[2] || 'detailed';

    return (
      <div>
        <BattleLoadoutCard identifier={identifier} mode={mode} />
      </div>
    );
  }

  // Check for inline markers (markers mixed with text)
  if (content.includes('{{')) {
    const parts = [];
    let lastIndex = 0;

    // Match all markers in the content
    const markerRegex = /\{\{(SKILL|EQUIPMENT|SPIRIT|DATA|SPIRIT_SPRITE|EMOTICON|VIDEO_GUIDE|BATTLE_LOADOUT):([^}]+)\}\}/g;
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
      } else if (type === 'EMOTICON') {
        const [idOrName, size = 'large'] = params.split(':');
        const isId = /^\d+$/.test(idOrName);
        const emoticonProps = isId
          ? { id: parseInt(idOrName), size }
          : { name: idOrName, size };
        parts.push(
          <span key={match.index} className="inline-block align-middle">
            <Emoticon {...emoticonProps} />
          </span>
        );
      } else if (type === 'VIDEO_GUIDE') {
        const identifier = params.trim();

        // Simple heuristic: if alphanumeric+dashes, assume ID; otherwise, title
        const isId = /^[a-z0-9-]+$/.test(identifier);

        parts.push(
          <span key={match.index} className="inline-block">
            <VideoGuideCard
              identifier={identifier}
              findBy={isId ? 'id' : 'title'}
              mode="card"
              showId={false}
            />
          </span>
        );
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
 * @param {object} params - { equipment, mode, type }
 * @returns {JSX.Element} - EquipmentCard component
 */
export const renderEquipmentPreview = ({ equipment, mode, type }) => {
  return <EquipmentCard equipment={equipment} mode={mode} type={type} />;
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
  const markerRegex = /\{\{(SKILL|EQUIPMENT|DATA|SPIRIT_SPRITE|EMOTICON):([^}]+)\}\}/g;
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
    } else if (type === 'EMOTICON') {
      const [idOrName, size = 'medium'] = params.split(':');
      const isId = /^\d+$/.test(idOrName);
      const emoticonProps = isId
        ? { id: parseInt(idOrName), size }
        : { name: idOrName, size };
      parts.push(<Emoticon key={match.index} {...emoticonProps} />);
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

  // Check if contains markers
  if (!content.includes('{{')) {
    return <td {...props}>{children}</td>;
  }

  // Split by markers and process each part
  const parts = [];
  let lastIndex = 0;

  // Match all markers in the content
  const markerRegex = /\{\{(SKILL|EQUIPMENT|DATA|SPIRIT_SPRITE|EMOTICON):([^}]+)\}\}/g;
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
    } else if (type === 'EMOTICON') {
      const [idOrName, size = 'medium'] = params.split(':');
      const isId = /^\d+$/.test(idOrName);
      const emoticonProps = isId
        ? { id: parseInt(idOrName), size }
        : { name: idOrName, size };
      parts.push(<Emoticon key={`emoticon-${match.index}`} {...emoticonProps} />);
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

  // Check for inline markers (markers mixed with text)
  if (content.includes('{{')) {

    const parts = [];
    let lastIndex = 0;

    // Match all markers in the content
    const markerRegex = /\{\{(SKILL|EQUIPMENT|SPIRIT|DATA|SPIRIT_SPRITE|EMOTICON|VIDEO_GUIDE|BATTLE_LOADOUT):([^}]+)\}\}/g;
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
      } else if (type === 'VIDEO_GUIDE') {
        const identifier = params.trim();

        // Simple heuristic: if alphanumeric+dashes, assume ID; otherwise, title
        const isId = /^[a-z0-9-]+$/.test(identifier);

        parts.push(
          <span key={match.index} className="inline-block">
            <VideoGuideCard
              identifier={identifier}
              findBy={isId ? 'id' : 'title'}
              mode="card"
              showId={false}
            />
          </span>
        );
      } else if (type === 'EMOTICON') {
        const [idOrName, size = 'large'] = params.split(':');
        const isId = /^\d+$/.test(idOrName);
        const emoticonProps = isId
          ? { id: parseInt(idOrName), size }
          : { name: idOrName, size };
        parts.push(<Emoticon key={match.index} {...emoticonProps} />);
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

  // Check if contains markers
  if (!content.includes('{{')) {
    return <th {...props}>{children}</th>;
  }

  // Split by markers and process each part
  const parts = [];
  let lastIndex = 0;

  // Match all markers in the content
  const markerRegex = /\{\{(SKILL|EQUIPMENT|DATA|SPIRIT_SPRITE|EMOTICON):([^}]+)\}\}/g;
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
    } else if (type === 'EMOTICON') {
      const [idOrName, size = 'medium'] = params.split(':');
      const isId = /^\d+$/.test(idOrName);
      const emoticonProps = isId
        ? { id: parseInt(idOrName), size }
        : { name: idOrName, size };
      parts.push(<Emoticon key={`emoticon-${match.index}`} {...emoticonProps} />);
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
