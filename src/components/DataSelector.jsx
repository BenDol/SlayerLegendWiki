/**
 * DataSelector Component - Slayer Legend Wiki customization
 *
 * Wraps the framework's DataSelector with game-specific category configuration
 */

import React from 'react';
import FrameworkDataSelector from '../../wiki-framework/src/components/common/DataSelector.jsx';

const DataSelector = ({ onSelect, onClose }) => {
  // Game-specific category configuration
  const categories = {
    'Characters & Companions': [
      'spirits', 'spirit-upgrades', 'companion-characters', 'companions',
      'familiars', 'classes', 'promotions', 'appearance-clothing'
    ],
    'Combat & Skills': [
      'skills'
    ],
    'Equipment & Items': [
      'equipment', 'relics', 'equipment-drops'
    ],
    'Content & Progression': [
      'adventures', 'campaigns', 'quests'
    ],
    'Game Systems': [
      'formulas', 'drop-tables'
    ]
  };

  return (
    <FrameworkDataSelector
      onSelect={onSelect}
      onClose={onClose}
      categories={categories}
    />
  );
};

export default DataSelector;
