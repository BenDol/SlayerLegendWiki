import React from 'react';
import FamiliarBuilder from '../components/FamiliarBuilder';

/**
 * FamiliarBuilderPage
 *
 * Page wrapper for the familiar builder interface
 * Route: /familiar-builder
 */
const FamiliarBuilderPage = () => {
  return (
    <FamiliarBuilder
      isModal={false}
      allowSavingBuilds={true}
    />
  );
};

export default FamiliarBuilderPage;
