import React from 'react';
import MetaTags from '../components/MetaTags';
import SkillStoneExample from '../components/SkillStoneExample';

const SkillStonesPage = () => {
  return (
    <div className="page-container">
      <MetaTags
        title="Skill Stones Showcase"
        description="Interactive showcase of all skill stone types, elements, and tiers"
      />
      <SkillStoneExample />
    </div>
  );
};

export default SkillStonesPage;
