import React from 'react';
import SoulWeaponEngravingBuilder from '../components/SoulWeaponEngravingBuilder';
import MetaTags from '../components/MetaTags';
import ToolPageAd from '../components/ads/ToolPageAd';

/**
 * Page wrapper for Soul Weapon Engraving
 */
const SoulWeaponEngravingBuilderPage = () => {
  return (
    <>
      <MetaTags
        title="Soul Weapon Engraving"
        description="Plan and visualize soul weapon engraving layouts for Slayer Legend. Design optimal grid patterns, maximize stat bonuses, and share your engraving builds."
        image="/images/content/tools/soul-weapon-engraving.png"
        url="/soul-weapon-engraving"
        keywords={['soul weapon', 'engraving', 'grid builder', 'engraving planner', 'soul weapon stats']}
      />
      <div className="container mx-auto">
        <ToolPageAd />
        <SoulWeaponEngravingBuilder />
      </div>
    </>
  );
};

export default SoulWeaponEngravingBuilderPage;
