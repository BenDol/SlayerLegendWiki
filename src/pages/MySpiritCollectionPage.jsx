import React from 'react';
import MySpiritCollection from '../components/MySpiritCollection';
import MetaTags from '../components/MetaTags';

const MySpiritCollectionPage = () => {
  return (
    <>
      <MetaTags
        title="My Spirit Collection"
        description="Track and manage your spirit collection in Slayer Legend. View your owned spirits, plan upgrades, and organize your spirit roster."
        image="/images/tools/my-spirits.png"
        url="/my-spirits"
        keywords={['spirit collection', 'my spirits', 'spirit tracker', 'spirit manager', 'collection']}
      />
      <MySpiritCollection />
    </>
  );
};

export default MySpiritCollectionPage;
