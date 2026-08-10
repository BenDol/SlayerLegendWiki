import React from 'react';
import FamiliarBuilder from '../components/FamiliarBuilder';
import MetaTags from '../components/MetaTags';
import ToolPageAd from '../components/ads/ToolPageAd';

/**
 * FamiliarBuilderPage
 *
 * Page wrapper for the familiar builder interface
 * Route: /familiar-builder
 */
const FamiliarBuilderPage = () => {
  return (
    <>
      <MetaTags
        title="Familiar Builder"
        description="Create and customize familiar builds for Slayer Legend. Plan familiar teams, compare stats, and share your setups with other players."
        url="/familiar-builder"
        keywords={['familiar builder', 'familiars', 'team builder', 'familiar planner']}
      />
      <ToolPageAd />
      <FamiliarBuilder
        isModal={false}
        allowSavingBuilds={true}
      />
    </>
  );
};

export default FamiliarBuilderPage;
