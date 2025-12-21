import React from 'react';
import SpiritBuilder from '../components/SpiritBuilder';
import MetaTags from '../components/MetaTags';

/**
 * SpiritBuilderPage Component
 *
 * Page wrapper for the Spirit Builder
 * Accessible at /#/spirit-builder
 */
const SpiritBuilderPage = () => {
  return (
    <>
      <MetaTags
        title="Spirit Builder"
        description="Build and customize your spirit team for Slayer Legend. Select spirits, plan upgrades, and share your spirit configurations with other players."
        image="/images/tools/spirit-builder.png"
        url="/spirit-builder"
        keywords={['spirit builder', 'spirits', 'team builder', 'spirit planner', 'spirit upgrades']}
      />
      <SpiritBuilder isModal={false} allowSavingBuilds={true} />
    </>
  );
};

export default SpiritBuilderPage;
