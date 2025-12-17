import React from 'react';
import SpiritBuilder from '../components/SpiritBuilder';

/**
 * SpiritBuilderPage Component
 *
 * Page wrapper for the Spirit Builder
 * Accessible at /#/spirit-builder
 */
const SpiritBuilderPage = () => {
  return <SpiritBuilder isModal={false} allowSavingBuilds={true} />;
};

export default SpiritBuilderPage;
