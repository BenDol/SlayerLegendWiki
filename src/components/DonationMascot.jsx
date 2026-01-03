import { useState, useEffect } from 'react';
import SpiritSprite from './SpiritSprite';
import spiritData from '../../public/data/spirit-characters.json';

/**
 * Custom donation mascot component for Slayer Legend Wiki
 * Uses random spirit characters from the game
 */
const DonationMascot = () => {
  const [randomSpirit, setRandomSpirit] = useState(null);

  useEffect(() => {
    const spirits = spiritData.spirits;
    const randomSpiritIndex = Math.floor(Math.random() * spirits.length);
    const randomSpiritData = spirits[randomSpiritIndex];

    // Map spirit ID from data (id field in JSON)
    setRandomSpirit({
      id: randomSpiritData.id,
      level: Math.floor(Math.random() * 3) + 4, // Random evolution level 4-6
      name: randomSpiritData.name
    });
  }, []);

  if (!randomSpirit) return null;

  return (
    <SpiritSprite
      spiritId={randomSpirit.id}
      level={randomSpirit.level}
      animationType="idle"
      animated={true}
      size="large"
      showInfo={false}
      bare={true}
    />
  );
};

export default DonationMascot;
