import SkillCard from '../components/SkillCard';
import EquipmentCard from '../components/EquipmentCard';

/**
 * Process game-specific syntax in markdown content
 * Converts <!-- skill:NAME:MODE --> and <!-- equipment:NAME:MODE --> into special markers
 * Mode is optional, defaults to 'detailed'
 *
 * Supported syntax:
 * - <!-- skill:Fire Slash --> (defaults to detailed)
 * - <!-- skill:Fire Slash:compact -->
 * - <!-- skill:Fire Slash:detailed -->
 * - <!-- skill:Fire Slash:advanced -->
 *
 * @param {string} content - Markdown content
 * @returns {string} - Processed content with markers
 */
export const processGameSyntax = (content) => {
  if (!content) return content;

  // Replace <!-- skill:NAME:MODE --> with {{SKILL:NAME:MODE}} marker
  // Mode is optional, captured in group 2
  let processed = content.replace(/<!--\s*skill:\s*([^:]+?)(?::(\w+?))?\s*-->/gi, (match, name, mode) => {
    const modeStr = mode || 'detailed';
    console.log('[Game Content] Converting skill:', match, '→', `{{SKILL:${name}:${modeStr}}}`);
    return `{{SKILL:${name}:${modeStr}}}`;
  });

  // Replace <!-- equipment:NAME:MODE --> with {{EQUIPMENT:NAME:MODE}} marker
  processed = processed.replace(/<!--\s*equipment:\s*([^:]+?)(?::(\w+?))?\s*-->/gi, (match, name, mode) => {
    const modeStr = mode || 'detailed';
    console.log('[Game Content] Converting equipment:', match, '→', `{{EQUIPMENT:${name}:${modeStr}}}`);
    return `{{EQUIPMENT:${name}:${modeStr}}}`;
  });

  return processed;
};

/**
 * Custom paragraph renderer that detects and renders skill/equipment cards
 * Use this with ReactMarkdown's components prop
 *
 * Parses markers like:
 * - {{SKILL:Fire Slash:compact}}
 * - {{SKILL:Fire Slash:detailed}}
 * - {{EQUIPMENT:Sword:advanced}}
 */
export const CustomParagraph = ({ node, children, ...props }) => {
  const content = String(children).trim();

  // Check for skill marker with optional mode
  const skillMatch = content.match(/^\{\{SKILL:([^:]+?)(?::(\w+?))?\}\}$/);
  if (skillMatch) {
    const skillIdentifier = skillMatch[1].trim();
    const mode = skillMatch[2] || 'detailed';
    const isId = /^\d+$/.test(skillIdentifier);
    console.log('[Game Content] Rendering SkillCard:', skillIdentifier, 'mode:', mode, 'isId:', isId);

    // Render SkillCard with name or id prop and mode
    const cardProps = isId
      ? { id: parseInt(skillIdentifier), mode }
      : { name: skillIdentifier, mode };
    return <SkillCard {...cardProps} />;
  }

  // Check for equipment marker with optional mode
  const equipmentMatch = content.match(/^\{\{EQUIPMENT:([^:]+?)(?::(\w+?))?\}\}$/);
  if (equipmentMatch) {
    const equipmentIdentifier = equipmentMatch[1].trim();
    const mode = equipmentMatch[2] || 'detailed';
    const isId = /^\d+$/.test(equipmentIdentifier);
    console.log('[Game Content] Rendering EquipmentCard:', equipmentIdentifier, 'mode:', mode, 'isId:', isId);

    // Render EquipmentCard with name or id prop and mode
    const cardProps = isId
      ? { id: parseInt(equipmentIdentifier), mode }
      : { name: equipmentIdentifier, mode };
    return <EquipmentCard {...cardProps} />;
  }

  // Regular paragraph
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
 * Get custom ReactMarkdown components for game content
 * Use this object with PageViewer's customComponents prop
 */
export const getGameComponents = () => ({
  p: CustomParagraph,
});
