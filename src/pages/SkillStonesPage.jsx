import React from 'react';
import SkillStoneBuilder from '../components/SkillStoneBuilder';
import ToolPageAd from '../components/ads/ToolPageAd';

/**
 * SkillStonesPage Component
 *
 * Standalone page for the Skill Stone Builder
 * Simple wrapper that renders the SkillStoneBuilder component in page mode
 */
const SkillStonesPage = () => {
  return (
    <>
      <ToolPageAd />
      <SkillStoneBuilder
        isModal={false}
        initialBuild={null}
        onSave={null}
        allowSavingBuilds={true}
      />
    </>
  );
};

export default SkillStonesPage;
