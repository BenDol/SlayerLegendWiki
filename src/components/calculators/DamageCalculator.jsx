import React, { useState } from 'react';
import Button from '../../wiki-framework/src/components/common/Button';

const DamageCalculator = () => {
  const [attack, setAttack] = useState('');
  const [critDamage, setCritDamage] = useState('');
  const [critChance, setCritChance] = useState('');
  const [elementalBonus, setElementalBonus] = useState('');
  const [result, setResult] = useState(null);

  const calculateDamage = () => {
    const atk = parseFloat(attack) || 0;
    const critDmg = parseFloat(critDamage) || 0;
    const critCh = parseFloat(critChance) || 0;
    const elemBonus = parseFloat(elementalBonus) || 0;

    // Base damage
    const baseDamage = atk;

    // Critical multiplier (average damage considering crit chance)
    const avgCritMultiplier = 1 + (critCh / 100) * (critDmg / 100);

    // Elemental bonus
    const elemMultiplier = 1 + (elemBonus / 100);

    // Total average damage
    const avgDamage = baseDamage * avgCritMultiplier * elemMultiplier;

    // Max damage (full crit)
    const maxDamage = baseDamage * (1 + critDmg / 100) * elemMultiplier;

    setResult({
      baseDamage: baseDamage.toFixed(0),
      avgDamage: avgDamage.toFixed(0),
      maxDamage: maxDamage.toFixed(0),
      critMultiplier: avgCritMultiplier.toFixed(2),
    });

    // Trigger donation prompt on successful calculation
    window.triggerDonationPrompt?.({
      messages: [
        "Those are some big numbers! 💥",
        "Damage optimized! 🎯",
        "Time to hit like a truck! 🚛",
        "Crit city, baby! ⚡",
      ]
    });
  };

  const reset = () => {
    setAttack('');
    setCritDamage('');
    setCritChance('');
    setElementalBonus('');
    setResult(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Damage Calculator</h2>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Attack Power
          </label>
          <input
            type="number"
            value={attack}
            onChange={(e) => setAttack(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
            placeholder="Enter attack power"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Critical Damage (%)
          </label>
          <input
            type="number"
            value={critDamage}
            onChange={(e) => setCritDamage(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 150"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Critical Chance (%)
          </label>
          <input
            type="number"
            value={critChance}
            onChange={(e) => setCritChance(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 25"
            max="100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Elemental Bonus (%)
          </label>
          <input
            type="number"
            value={elementalBonus}
            onChange={(e) => setElementalBonus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 50"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={calculateDamage} className="flex-1">
          Calculate
        </Button>
        <Button onClick={reset} variant="secondary">
          Reset
        </Button>
      </div>

      {result && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-lg mb-3">Results</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Base Damage:</span>
              <span className="font-semibold">{result.baseDamage}</span>
            </div>
            <div className="flex justify-between">
              <span>Average Damage:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {result.avgDamage}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Max Damage (Full Crit):</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {result.maxDamage}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Crit Multiplier:</span>
              <span>{result.critMultiplier}x</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DamageCalculator;
