import React from 'react';
import './SkillStone.css';

/**
 * SkillStone Component
 *
 * Renders a skill stone with geometric shape, glowing border, and element styling
 *
 * @param {string} stoneType - Type of stone: 'cooldown', 'time', or 'heat'
 * @param {string} element - Element type: 'fire', 'water', 'wind', or 'earth'
 * @param {string} tier - Tier: 'A' or 'B'
 * @param {object} data - Skill stones data from skill_stones.json (optional, will fetch if not provided)
 * @param {string} size - Size: 'small', 'medium', 'large' (default: 'medium')
 */
const SkillStone = ({ stoneType, element, tier = 'A', data, size = 'medium' }) => {
  const [stoneData, setStoneData] = React.useState(data);

  React.useEffect(() => {
    if (!data) {
      fetch('/data/skill_stones.json')
        .then(res => res.json())
        .then(setStoneData)
        .catch(err => console.error('Failed to load skill stones data:', err));
    }
  }, [data]);

  if (!stoneData) {
    return <div className="skill-stone-loading">Loading...</div>;
  }

  const stone = stoneData.stoneTypes[stoneType];
  const elementData = stoneData.elements[element];

  if (!stone || !elementData) {
    return <div className="skill-stone-error">Invalid stone configuration</div>;
  }

  const bonus = stone.bonuses[tier];
  const bonusText = stone.bonusFormat.replace('{value}', bonus);

  return (
    <div
      className={`skill-stone skill-stone--${size} skill-stone--${stone.shape} skill-stone--${element}`}
      style={{
        '--element-color': elementData.color,
        '--element-glow': elementData.glowColor
      }}
    >
      {/* Glowing border */}
      <div className="skill-stone__border"></div>

      {/* Background with gradient */}
      <div className="skill-stone__background"></div>

      {/* Center circle glow */}
      <div className="skill-stone__center-glow"></div>

      {/* Icon */}
      <div className="skill-stone__icon">
        <StoneIcon type={stone.icon} />
      </div>

      {/* Element badge (top-right) */}
      <div className="skill-stone__element-badge">
        <ElementIcon element={element} />
      </div>

      {/* Tier badge (bottom) */}
      <div className="skill-stone__tier-badge">
        {tier}
      </div>

      {/* Tooltip */}
      <div className="skill-stone__tooltip">
        <div className="skill-stone__tooltip-title">
          {elementData.name} {stone.name} ({tier})
        </div>
        <div className="skill-stone__tooltip-effect">
          {stone.description}: {bonusText}
        </div>
      </div>
    </div>
  );
};

/**
 * Stone Icon Component
 * Renders the main icon based on stone type
 */
const StoneIcon = ({ type }) => {
  switch (type) {
    case 'hourglass-down':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          {/* Hourglass with down arrow */}
          <path d="M6 2h12v6l-6 6 6 6v6H6v-6l6-6-6-6V2zm2 2v3.17L12 11l4-3.83V4H8zm4 9.17L8 16.83V20h8v-3.17L12 13.17z"/>
          <path d="M12 14l-2 3h4l-2-3z" fill="currentColor" opacity="0.8"/>
        </svg>
      );
    case 'lightning-up':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          {/* Lightning bolt */}
          <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>
        </svg>
      );
    case 'sword-down':
      return <img src="/images/ui/sword.png" alt="sword" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
    default:
      return null;
  }
};

/**
 * Element Icon Component
 * Renders the element icon for the badge using existing game assets
 */
const ElementIcon = ({ element }) => {
  const iconMap = {
    fire: '/images/icons/typeicon_fire_1.png',
    water: '/images/icons/typeicon_water_1.png',
    wind: '/images/icons/typeicon_wind_1.png',
    earth: '/images/icons/typeicon_earth s_1.png'
  };

  const iconSrc = iconMap[element];
  if (!iconSrc) return null;

  return <img src={iconSrc} alt={element} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
};

export default SkillStone;
