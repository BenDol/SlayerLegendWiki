import React, { useState } from 'react';
import Button from '../../wiki-framework/src/components/common/Button';

const EnhancementCalculator = () => {
  const [currentLevel, setCurrentLevel] = useState('');
  const [targetLevel, setTargetLevel] = useState('');
  const [grade, setGrade] = useState('common');
  const [result, setResult] = useState(null);

  // Cost formulas (estimated based on common RPG patterns)
  const calculateCost = (level, gradeMultiplier) => {
    return Math.floor(100 * Math.pow(1.15, level) * gradeMultiplier);
  };

  const gradeMultipliers = {
    common: 1,
    advanced: 1.5,
    rare: 2,
    hero: 3,
    legendary: 5,
    mythic: 8,
    immortal: 12,
  };

  const calculate = () => {
    const current = parseInt(currentLevel) || 0;
    const target = parseInt(targetLevel) || 0;

    if (target <= current) {
      alert('Target level must be higher than current level');
      return;
    }

    if (target > 200) {
      alert('Max level is 200');
      return;
    }

    const multiplier = gradeMultipliers[grade];
    let totalGold = 0;

    for (let i = current; i < target; i++) {
      totalGold += calculateCost(i, multiplier);
    }

    setResult({
      levels: target - current,
      totalGold: totalGold.toLocaleString(),
      avgPerLevel: Math.floor(totalGold / (target - current)).toLocaleString(),
    });

    // Trigger donation prompt on successful calculation
    window.triggerDonationPrompt?.({
      messages: [
        "That's a lot of gold! 💰",
        "Time to start grinding! ⚡",
        "Enhancement costs calculated! 📈",
        "Budget your resources like a pro! 🎯",
      ]
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Enhancement Cost Calculator</h2>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Equipment Grade
          </label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="common">Common</option>
            <option value="advanced">Advanced</option>
            <option value="rare">Rare</option>
            <option value="hero">Hero</option>
            <option value="legendary">Legendary</option>
            <option value="mythic">Mythic</option>
            <option value="immortal">Immortal</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Current Level
          </label>
          <input
            type="number"
            value={currentLevel}
            onChange={(e) => setCurrentLevel(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 50"
            min="0"
            max="200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Target Level
          </label>
          <input
            type="number"
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 100"
            min="0"
            max="200"
          />
        </div>
      </div>

      <Button onClick={calculate} className="w-full">
        Calculate Cost
      </Button>

      {result && (
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h3 className="font-semibold text-lg mb-3">Total Cost</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Levels to Enhance:</span>
              <span className="font-semibold">{result.levels}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Gold Needed:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {result.totalGold}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Average per Level:</span>
              <span>{result.avgPerLevel}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancementCalculator;
