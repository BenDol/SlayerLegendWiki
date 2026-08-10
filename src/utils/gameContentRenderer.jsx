import React from 'react';
import SkillCard from '../components/SkillCard';
import EquipmentCard from '../components/EquipmentCard';
import DataInjector from '../components/DataInjector';
import SpiritSprite from '../components/SpiritSprite';
import SpiritCard from '../components/SpiritCard';
import ContributionBanner from '../components/ContributionBanner';
import Emoticon from '../components/Emoticon';
import BattleLoadoutCard from '../components/BattleLoadoutCard';
import SkillBuildCard from '../components/SkillBuildCard';
import SpiritBuildCard from '../components/SpiritBuildCard';
import { VideoGuideCard } from '../../wiki-framework/src/components/contentCreators';
import AdSlot from '../components/ads/AdSlot';
import { HOME_WIDGETS } from '../components/home';

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
 * - {{data:spirits:1:inline}} or <!-- data:spirits:1:inline --> (inline template with ID)
 * - {{data:promotions:13:classATK}} or <!-- data:promotions:13:classATK --> (specific field, styled)
 * - {{data:promotions:13:classATK:true:true}} (specific field, no styling for custom table styles)
 * - {{spirit-sprite:1:0}} or <!-- spirit-sprite:1:0 -->
 * - {{contribution-banner:auto-generated}} or <!-- contribution-banner:auto-generated -->
 * - {{emoticon:1}} or {{emoticon:Hello}} - Emoticon by ID or name (defaults to large size)
 * - {{emoticon:1:medium}} or {{emoticon:Hello:small}} - Emoticon with custom size
 * - {{emoticon:Sleep:original}} - Emoticon at native resolution (no scaling)
 * - Size options: small (24px), medium (32px), large (48px), xlarge (64px), original (native)
 *
 * Data injection parameters:
 * - source: Data source (e.g., 'spirits', 'promotions')
 * - id: Item identifier
 * - fieldOrTemplate: Template name ('card', 'inline', 'table') or field path ('name', 'skill.cooldown')
 * - showId (optional): Show ID number (default: true, only for inline template)
 * - noStyle (optional): Remove styling from field values (default: false, only for field paths)
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
  // Syntax: {{data:source:id:fieldOrTemplate:showId:noStyle}}
  processed = processed.replace(/\{\{\s*data:\s*([^:}]+?)\s*:\s*([^:}]+?)\s*(?::\s*([^:}]+?)\s*)?(?::\s*([^:}]+?)\s*)?(?::\s*([^}]+?)\s*)?\}\}/gi, (match, source, id, fieldOrTemplate, showId, noStyle) => {
    const thirdParam = (fieldOrTemplate || 'card').trim();
    const fourthParam = showId !== undefined ? showId.trim() : 'true';
    const fifthParam = noStyle !== undefined ? noStyle.trim() : 'false';
    return `{{DATA:${source}:${id}:${thirdParam}:${fourthParam}:${fifthParam}}}`;
  });

  // Process <!-- data:... --> format (legacy)
  processed = processed.replace(/<!--\s*data:\s*([^:]+?):([^:]+?)(?::([^:]+?))?(?::([^:]+?))?(?::([^-]+?))?\s*-->/gi, (match, source, id, fieldOrTemplate, showId, noStyle) => {
    const thirdParam = (fieldOrTemplate || 'card').trim();
    const fourthParam = showId !== undefined ? showId.trim() : 'true';
    const fifthParam = noStyle !== undefined ? noStyle.trim() : 'false';
    return `{{DATA:${source}:${id}:${thirdParam}:${fourthParam}:${fifthParam}}}`;
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
    const typeStr = type || 'auto-generated';
    return `{{CONTRIBUTION_BANNER:${typeStr}}}`;
  });

  // Process <!-- contribution-banner:... --> format (legacy)
  processed = processed.replace(/<!--\s*contribution-banner:\s*([^-]+?)\s*-->/gi, (match, type) => {
    const typeStr = type || 'auto-generated';
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
  // Syntax: {{battle-loadout:userId:loadoutId:mode}} or {{battle-loadout:checksum:mode}}
  // Examples: {{battle-loadout:1935706:battle-loadouts-123:detailed}}, {{battle-loadout:abc123:compact}}
  processed = processed.replace(/\{\{\s*battle-loadout:\s*(.+?)\s*\}\}/gi, (match, content) => {
    const parts = content.split(':').map(p => p.trim());
    const validModes = ['compact', 'detailed', 'advanced'];

    let identifier, mode;
    const lastPart = parts[parts.length - 1];

    if (validModes.includes(lastPart)) {
      // Last part is the mode
      mode = lastPart;
      identifier = parts.slice(0, -1).join(':');
    } else {
      // No mode specified
      identifier = content.trim();
      mode = 'detailed';
    }

    return `{{BATTLE_LOADOUT:${identifier}:${mode}}}`;
  });

  // Process <!-- battle-loadout:... --> format (legacy)
  processed = processed.replace(/<!--\s*battle-loadout:\s*([^:]+?)(?::(\w+?))?\s*-->/gi, (match, identifier, mode) => {
    const modeStr = mode || 'detailed';
    return `{{BATTLE_LOADOUT:${identifier}:${modeStr}}}`;
  });

  // Process {{skill-build:...}} format
  // Syntax: {{skill-build:userId:buildId:mode}}
  // Examples: {{skill-build:1935706:skill-builds-123:detailed}}, {{skill-build:1935706:skill-builds-456:compact}}
  processed = processed.replace(/\{\{\s*skill-build:\s*(.+?)\s*\}\}/gi, (match, content) => {
    const parts = content.split(':').map(p => p.trim());
    const validModes = ['compact', 'detailed', 'advanced'];

    let identifier, mode;
    const lastPart = parts[parts.length - 1];

    if (validModes.includes(lastPart)) {
      // Last part is the mode
      mode = lastPart;
      identifier = parts.slice(0, -1).join(':');
    } else {
      // No mode specified
      identifier = content.trim();
      mode = 'detailed';
    }

    return `{{SKILL_BUILD:${identifier}:${mode}}}`;
  });

  // Process {{spirit-build:...}} format
  // Syntax: {{spirit-build:userId:buildId:mode}}
  // Examples: {{spirit-build:1935706:spirit-builds-123:detailed}}, {{spirit-build:1935706:spirit-builds-456:compact}}
  processed = processed.replace(/\{\{\s*spirit-build:\s*(.+?)\s*\}\}/gi, (match, content) => {
    const parts = content.split(':').map(p => p.trim());
    const validModes = ['compact', 'detailed', 'advanced'];

    let identifier, mode;
    const lastPart = parts[parts.length - 1];

    if (validModes.includes(lastPart)) {
      // Last part is the mode
      mode = lastPart;
      identifier = parts.slice(0, -1).join(':');
    } else {
      // No mode specified
      identifier = content.trim();
      mode = 'detailed';
    }

    return `{{SPIRIT_BUILD:${identifier}:${mode}}}`;
  });

  // Process {{home:...}} format - homepage building blocks used by public/content/home.md
  // Syntax: {{home:hero}}, {{home:creators}}, {{home:sections}}
  processed = processed.replace(/\{\{\s*home:\s*(\w+)\s*\}\}/gi, (match, widget) => {
    return `{{HOME:${widget.toLowerCase()}}}`;
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
 * Helper function to recursively process children while preserving React element structure
 * This preserves formatting elements like <strong>, <em> while processing markers
 */
const processChildrenWithMarkers = (children) => {
  if (typeof children === 'string') {
    // Process markers in text
    if (!children.includes('{{')) {
      return children;
    }

    const parts = [];
    let lastIndex = 0;

    // Match all markers in the content
    const markerRegex = /\{\{(SKILL|EQUIPMENT|DATA|SPIRIT_SPRITE|EMOTICON):([^}]+)\}\}/g;
    let match;

    while ((match = markerRegex.exec(children)) !== null) {
      if (match.index > lastIndex) {
        parts.push(children.substring(lastIndex, match.index));
      }

      const type = match[1];
      const params = match[2];

      // Process marker based on type
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
        const showId = paramParts[3] !== undefined ? paramParts[3].trim() === 'true' : true;
        const noStyle = paramParts[4] !== undefined ? paramParts[4].trim() === 'true' : false;

        if (source && id) {
          parts.push(<DataInjector key={match.index} source={source} id={id} fieldOrTemplate={fieldOrTemplate} showId={showId} noStyle={noStyle} />);
        }
      } else if (type === 'SPIRIT_SPRITE') {
        const paramParts = params.split(':');
        const spiritId = parseInt(paramParts[0]);
        const level = parseInt(paramParts[1] || '0');
        const size = paramParts[2] || 'small';

        if (!isNaN(spiritId)) {
          parts.push(
            <span key={match.index} className="inline-block align-middle mx-1">
              <SpiritSprite spiritId={spiritId} level={level} size={size} showInfo={false} />
            </span>
          );
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

    if (lastIndex < children.length) {
      parts.push(children.substring(lastIndex));
    }

    return parts.length === 1 ? parts[0] : parts;
  }

  if (Array.isArray(children)) {
    return children.map((child, idx) => processChildrenWithMarkers(child));
  }

  // If it's a React element, clone it and recursively process its children
  if (React.isValidElement(children)) {
    const processedChildren = processChildrenWithMarkers(children.props.children);

    // Clone the element with processed children
    return React.cloneElement(children, {}, processedChildren);
  }

  return children;
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

  // Check for standalone ad marker (injected automatically by injectAdMarkers)
  const adMatch = content.match(/^\{\{AD:(\w+)\}\}$/);
  if (adMatch) {
    return <AdSlot placement={adMatch[1]} />;
  }

  // Check for standalone homepage widget marker (used by public/content/home.md)
  const homeMatch = content.match(/^\{\{HOME:(\w+)\}\}$/);
  if (homeMatch) {
    const HomeWidget = HOME_WIDGETS[homeMatch[1].toLowerCase()];
    return HomeWidget ? <HomeWidget /> : null;
  }

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
  const dataMatch = content.match(/^\{\{DATA:([^:]+?):([^:]+?)(?::([^:]+?))?(?::([^:]+?))?(?::([^}]+?))?\}\}$/);
  if (dataMatch) {
    const source = dataMatch[1].trim();
    const id = dataMatch[2].trim();
    const fieldOrTemplate = (dataMatch[3] || 'card').trim();
    const showId = dataMatch[4] !== undefined ? dataMatch[4].trim() === 'true' : true;
    const noStyle = dataMatch[5] !== undefined ? dataMatch[5].trim() === 'true' : false;

    // Wrap in div to avoid <p><div> nesting warning (card/table templates render block-level divs)
    return (
      <div>
        <DataInjector source={source} id={id} fieldOrTemplate={fieldOrTemplate} showId={showId} noStyle={noStyle} />
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
      <div className="my-6">
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
      <div className="my-6">
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
  // Match format: {{BATTLE_LOADOUT:userId:loadoutId:mode}} or {{BATTLE_LOADOUT:checksum:mode}}
  const loadoutMatch = content.match(/^\{\{BATTLE_LOADOUT:(.+)\}\}$/);
  if (loadoutMatch) {
    const fullIdentifier = loadoutMatch[1].trim();

    // Split and check if last part is a valid mode
    const parts = fullIdentifier.split(':');
    const lastPart = parts[parts.length - 1];
    const validModes = ['compact', 'detailed', 'advanced'];

    let identifier, mode;
    if (validModes.includes(lastPart)) {
      // Last part is the mode, everything else is the identifier
      mode = lastPart;
      identifier = parts.slice(0, -1).join(':');
    } else {
      // No mode specified, entire thing is the identifier
      identifier = fullIdentifier;
      mode = 'detailed';
    }

    return (
      <div className="my-6">
        <BattleLoadoutCard identifier={identifier} mode={mode} />
      </div>
    );
  }

  // Check for standalone skill build marker
  // Match format: {{SKILL_BUILD:userId:buildId:mode}} or {{SKILL_BUILD:checksum:mode}}
  const skillBuildMatch = content.match(/^\{\{SKILL_BUILD:(.+)\}\}$/);
  if (skillBuildMatch) {
    const fullIdentifier = skillBuildMatch[1].trim();

    // Split and check if last part is a valid mode
    const parts = fullIdentifier.split(':');
    const lastPart = parts[parts.length - 1];
    const validModes = ['compact', 'detailed', 'advanced'];

    let identifier, mode;
    if (validModes.includes(lastPart)) {
      // Last part is the mode, everything else is the identifier
      mode = lastPart;
      identifier = parts.slice(0, -1).join(':');
    } else {
      // No mode specified, entire thing is the identifier
      identifier = fullIdentifier;
      mode = 'detailed';
    }

    return (
      <div className="my-6">
        <SkillBuildCard identifier={identifier} mode={mode} />
      </div>
    );
  }

  // Check for standalone spirit build marker
  // Match format: {{SPIRIT_BUILD:userId:buildId:mode}} or {{SPIRIT_BUILD:checksum:mode}}
  const spiritBuildMatch = content.match(/^\{\{SPIRIT_BUILD:(.+)\}\}$/);
  if (spiritBuildMatch) {
    const fullIdentifier = spiritBuildMatch[1].trim();

    // Split and check if last part is a valid mode
    const parts = fullIdentifier.split(':');
    const lastPart = parts[parts.length - 1];
    const validModes = ['compact', 'detailed', 'advanced'];

    let identifier, mode;
    if (validModes.includes(lastPart)) {
      // Last part is the mode, everything else is the identifier
      mode = lastPart;
      identifier = parts.slice(0, -1).join(':');
    } else {
      // No mode specified, entire thing is the identifier
      identifier = fullIdentifier;
      mode = 'detailed';
    }

    return (
      <div className="my-6">
        <SpiritBuildCard identifier={identifier} mode={mode} />
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
        const noStyle = paramParts[4] !== undefined ? paramParts[4].trim() === 'true' : false;

        if (source && id) {
          parts.push(<DataInjector key={match.index} source={source} id={id} fieldOrTemplate={fieldOrTemplate} showId={showId} noStyle={noStyle} />);
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
  // Extract text to check for markers
  const content = extractTextContent(children).trim();

  // Check if contains markers
  if (!content.includes('{{')) {
    return <td {...props}>{children}</td>;
  }

  // Process children recursively while preserving formatting (bold, italic, etc.)
  const processedChildren = processChildrenWithMarkers(children);

  return <td {...props}>{processedChildren}</td>;
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
        const noStyle = paramParts[4] !== undefined ? paramParts[4].trim() === 'true' : false;

        if (source && id) {
          parts.push(<DataInjector key={match.index} source={source} id={id} fieldOrTemplate={fieldOrTemplate} showId={showId} noStyle={noStyle} />);
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
  // Extract text to check for markers
  const content = extractTextContent(children).trim();

  // Check if contains markers
  if (!content.includes('{{')) {
    return <th {...props}>{children}</th>;
  }

  // Process children recursively while preserving formatting (bold, italic, etc.)
  const processedChildren = processChildrenWithMarkers(children);

  return <th {...props}>{processedChildren}</th>;
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
