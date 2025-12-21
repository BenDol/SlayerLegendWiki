import React from 'react';
import SkillBuilder from '../components/SkillBuilder';
import MetaTags from '../components/MetaTags';

/**
 * Skill Builder Page
 *
 * Standalone page for the skill builder
 * Accessible at /#/skill-builder
 */
const SkillBuilderPage = () => {
  return (
    <>
      <MetaTags
        title="Skill Builder"
        description="Create and optimize skill builds for Slayer Legend. Plan your skill combinations, test different elements, and share builds with the community."
        image="/images/tools/skill-builder.png"
        url="/skill-builder"
        keywords={['skill builder', 'skills', 'builds', 'planner', 'simulator', 'skill combinations']}
      />
      <SkillBuilder />
    </>
  );
};

export default SkillBuilderPage;
