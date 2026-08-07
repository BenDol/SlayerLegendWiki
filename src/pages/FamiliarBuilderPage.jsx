import React from 'react';
import FamiliarBuilder from '../components/FamiliarBuilder';
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
      <ToolPageAd />
      <FamiliarBuilder
        isModal={false}
        allowSavingBuilds={true}
      />
    </>
  );
};

export default FamiliarBuilderPage;
