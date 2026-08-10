import React from 'react';
import SkillStoneBuilder from '../components/SkillStoneBuilder';
import MetaTags from '../components/MetaTags';
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
      <MetaTags
        title="Skill Stone Builder"
        description="Plan skill stone setups for Slayer Legend. Compare skill stone options, build loadouts, and share your configurations with other players."
        url="/skill-stone-builder"
        keywords={['skill stones', 'skill stone builder', 'skill stone planner', 'loadout']}
      />
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
