import SpellCard from '../components/SpellCard';
import EquipmentCard from '../components/EquipmentCard';

/**
 * Process game-specific syntax in markdown content
 * Converts <!-- spell:NAME:MODE --> and <!-- equipment:NAME:MODE --> into special markers
 * Mode is optional, defaults to 'detailed'
 *
 * Supported syntax:
 * - <!-- spell:Fire Slash --> (defaults to detailed)
 * - <!-- spell:Fire Slash:compact -->
 * - <!-- spell:Fire Slash:detailed -->
 * - <!-- spell:Fire Slash:advanced -->
 *
 * @param {string} content - Markdown content
 * @returns {string} - Processed content with markers
 */
export const processGameSyntax = (content) => {
  if (!content) return content;

  // Replace <!-- spell:NAME:MODE --> with {{SPELL:NAME:MODE}} marker
  // Mode is optional, captured in group 2
  let processed = content.replace(/<!--\s*spell:\s*([^:]+?)(?::(\w+?))?\s*-->/gi, (match, name, mode) => {
    const modeStr = mode || 'detailed';
    console.log('[Game Content] Converting spell:', match, '→', `{{SPELL:${name}:${modeStr}}}`);
    return `{{SPELL:${name}:${modeStr}}}`;
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
 * Custom paragraph renderer that detects and renders spell/equipment cards
 * Use this with ReactMarkdown's components prop
 *
 * Parses markers like:
 * - {{SPELL:Fire Slash:compact}}
 * - {{SPELL:Fire Slash:detailed}}
 * - {{EQUIPMENT:Sword:advanced}}
 */
export const CustomParagraph = ({ node, children, ...props }) => {
  const content = String(children).trim();

  // Check for spell marker with optional mode
  const spellMatch = content.match(/^\{\{SPELL:([^:]+?)(?::(\w+?))?\}\}$/);
  if (spellMatch) {
    const spellIdentifier = spellMatch[1].trim();
    const mode = spellMatch[2] || 'detailed';
    const isId = /^\d+$/.test(spellIdentifier);
    console.log('[Game Content] Rendering SpellCard:', spellIdentifier, 'mode:', mode, 'isId:', isId);

    // Render SpellCard with name or id prop and mode
    const cardProps = isId
      ? { id: parseInt(spellIdentifier), mode }
      : { name: spellIdentifier, mode };
    return <SpellCard {...cardProps} />;
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
 * Render a spell card preview for SpellPicker
 * @param {object} params - { spell, mode }
 * @returns {JSX.Element} - SpellCard component
 */
export const renderSpellPreview = ({ spell, mode }) => {
  return <SpellCard spell={spell} mode={mode} />;
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
