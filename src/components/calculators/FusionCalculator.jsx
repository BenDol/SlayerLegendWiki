import React, { useState } from 'react';
import Button from '../../wiki-framework/src/components/common/Button';

const FusionCalculator = () => {
  const [targetGrade, setTargetGrade] = useState('advanced');
  const [result, setResult] = useState(null);

  const grades = [
    { id: 'common', name: 'Common', tier: 1 },
    { id: 'advanced', name: 'Advanced', tier: 2 },
    { id: 'rare', name: 'Rare', tier: 3 },
    { id: 'hero', name: 'Hero', tier: 4 },
    { id: 'legendary', name: 'Legendary', tier: 5 },
    { id: 'mythic', name: 'Mythic', tier: 6 },
    { id: 'immortal', name: 'Immortal', tier: 7 },
  ];

  const calculate = () => {
    const target = grades.find((g) => g.id === targetGrade);
    if (!target || target.tier === 1) {
      alert('Select a valid target grade');
      return;
    }

    // Calculate items needed at each tier
    // 5:1 fusion ratio means you need 5 items of tier N to get 1 item of tier N+1
    const breakdown = [];
    let currentTier = target.tier;
    let quantity = 1;

    while (currentTier > 1) {
      const prevTier = currentTier - 1;
      const prevGrade = grades.find((g) => g.tier === prevTier);
      quantity *= 5;

      breakdown.push({
        grade: prevGrade.name,
        quantity: quantity,
      });

      currentTier = prevTier;
    }

    setResult({
      targetGrade: target.name,
      breakdown: breakdown.reverse(),
    });

    // Trigger donation prompt on successful calculation
    window.triggerDonationPrompt?.({
      messages: [
        "Fusion math figured out! ⚗️",
        "Planning that grind! 💪",
        "Optimization 101! 📚",
        "Now you know what you need! 🎯",
      ]
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Fusion Calculator</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Calculate how many items you need to fuse to your target grade (5:1 ratio)
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Target Grade
          </label>
          <select
            value={targetGrade}
            onChange={(e) => setTargetGrade(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
          >
            {grades.filter((g) => g.tier > 1).map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button onClick={calculate} className="w-full">
        Calculate
      </Button>

      {result && (
        <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <h3 className="font-semibold text-lg mb-3">
            Materials Needed for 1x {result.targetGrade}
          </h3>
          <div className="space-y-2">
            {result.breakdown.map((item, index) => (
              <div key={index} className="flex justify-between items-center">
                <span>{item.grade}:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {item.quantity} items
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Fusion Ratio: 5 items → 1 item of next grade
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FusionCalculator;
