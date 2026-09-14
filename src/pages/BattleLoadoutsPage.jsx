import React from 'react';
import BattleLoadouts from '../components/BattleLoadouts';
import MetaTags from '../components/MetaTags';
import ToolPageAd from '../components/ads/ToolPageAd';
import ToolIntro from '../components/ToolIntro';

/**
 * Battle Loadouts Page
 *
 * Standalone page for the battle loadouts system
 * Accessible at /battle-loadouts
 */
const BattleLoadoutsPage = () => {
  return (
    <>
      <MetaTags
        title="Battle Loadouts"
        description="Configure and save complete battle loadouts for Slayer Legend. Organize your skills, equipment, spirits, and companions for different battle scenarios."
        image="/images/content/tools/battle-loadouts.png"
        url="/battle-loadouts"
        keywords={['battle loadouts', 'loadout manager', 'equipment sets', 'skill sets', 'battle configuration']}
      />
      <ToolPageAd />
      <BattleLoadouts />
      <ToolIntro route="battle-loadouts" />
    </>
  );
};

export default BattleLoadoutsPage;
