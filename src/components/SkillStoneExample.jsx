import React from 'react';
import SkillStone from './SkillStone';
import './SkillStoneExample.css';

/**
 * Example component showcasing all skill stone variants
 * This can be used for documentation or testing
 */
const SkillStoneExample = () => {
  const stoneTypes = ['cooldown', 'time', 'heat'];
  const elements = ['fire', 'water', 'wind', 'earth'];
  const tiers = ['A', 'B'];

  return (
    <div className="skill-stone-example">
      <h2>Skill Stones</h2>

      {stoneTypes.map(stoneType => (
        <div key={stoneType} className="skill-stone-example__section">
          <h3>{stoneType.charAt(0).toUpperCase() + stoneType.slice(1)} Stone</h3>

          {tiers.map(tier => (
            <div key={tier} className="skill-stone-example__tier">
              <h4>Tier {tier}</h4>
              <div className="skill-stone-example__grid">
                {elements.map(element => (
                  <div key={element} className="skill-stone-example__item">
                    <SkillStone
                      stoneType={stoneType}
                      element={element}
                      tier={tier}
                      size="medium"
                    />
                    <div className="skill-stone-example__label">
                      {element}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="skill-stone-example__section">
        <h3>Size Variants</h3>
        <div className="skill-stone-example__sizes">
          <div className="skill-stone-example__item">
            <SkillStone stoneType="time" element="fire" tier="A" size="small" />
            <div className="skill-stone-example__label">Small</div>
          </div>
          <div className="skill-stone-example__item">
            <SkillStone stoneType="time" element="water" tier="A" size="medium" />
            <div className="skill-stone-example__label">Medium</div>
          </div>
          <div className="skill-stone-example__item">
            <SkillStone stoneType="time" element="wind" tier="A" size="large" />
            <div className="skill-stone-example__label">Large</div>
          </div>
        </div>
      </div>

      <div className="skill-stone-example__usage">
        <h3>Usage</h3>
        <pre>{`import SkillStone from './components/SkillStone';

// Basic usage
<SkillStone
  stoneType="time"      // 'cooldown', 'time', or 'heat'
  element="fire"        // 'fire', 'water', 'wind', or 'earth'
  tier="A"              // 'A' or 'B'
  size="medium"         // 'small', 'medium', or 'large'
/>

// With hover tooltip
<SkillStone
  stoneType="cooldown"
  element="water"
  tier="B"
/>
`}</pre>
      </div>
    </div>
  );
};

export default SkillStoneExample;
