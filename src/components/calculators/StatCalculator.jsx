import React, { useState } from 'react';
import Button from '../../wiki-framework/src/components/common/Button';

const StatCalculator = () => {
  const [baseAttack, setBaseAttack] = useState('');
  const [baseHP, setBaseHP] = useState('');
  const [promotionTier, setPromotionTier] = useState('stone');
  const [result, setResult] = useState(null);

  const promotionMultipliers = {
    stone: { name: 'Stone', multiplier: 1 },
    bronze: { name: 'Bronze', multiplier: 1.2 },
    silver: { name: 'Silver', multiplier: 1.5 },
    gold: { name: 'Gold', multiplier: 2 },
    mithril: { name: 'Mithril', multiplier: 2.5 },
    dragonos: { name: 'Dragonos', multiplier: 3.5 },
    warfrost: { name: 'Warfrost', multiplier: 5 },
    blueabyss: { name: 'Blue Abyss', multiplier: 7 },
    cyclos: { name: 'Cyclos', multiplier: 10 },
    ancienkennine: { name: 'Ancient Kennine', multiplier: 15 },
    gigalock: { name: 'Gigalock', multiplier: 20 },
    eisenhardt: { name: 'Eisenhardt', multiplier: 30 },
    diadd: { name: 'Diadd', multiplier: 45 },
    eldinwood: { name: 'Eldinwood', multiplier: 70 },
  };

  const calculate = () => {
    const atk = parseFloat(baseAttack) || 0;
    const hp = parseFloat(baseHP) || 0;
    const promo = promotionMultipliers[promotionTier];

    if (atk === 0 && hp === 0) {
      alert('Enter at least one base stat');
      return;
    }

    const finalAttack = Math.floor(atk * promo.multiplier);
    const finalHP = Math.floor(hp * promo.multiplier);

    setResult({
      promotion: promo.name,
      multiplier: promo.multiplier,
      attack: {
        base: atk.toFixed(0),
        final: finalAttack.toLocaleString(),
        gain: (finalAttack - atk).toLocaleString(),
      },
      hp: {
        base: hp.toFixed(0),
        final: finalHP.toLocaleString(),
        gain: (finalHP - hp).toLocaleString(),
      },
    });

    // Trigger donation prompt on successful calculation
    window.triggerDonationPrompt?.({
      messages: [
        "Crunching those numbers! 🧮",
        "Math is fun... right? 📊",
        "Stats looking good! 💪",
        "Calculating like a scientist! 🔬",
      ]
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Character Stat Calculator</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Calculate your stats after character promotion
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Promotion Tier
          </label>
          <select
            value={promotionTier}
            onChange={(e) => setPromotionTier(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(promotionMultipliers).map(([key, value]) => (
              <option key={key} value={key}>
                {value.name} ({value.multiplier}x)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Base Attack
          </label>
          <input
            type="number"
            value={baseAttack}
            onChange={(e) => setBaseAttack(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
            placeholder="Enter base attack"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Base HP
          </label>
          <input
            type="number"
            value={baseHP}
            onChange={(e) => setBaseHP(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
            placeholder="Enter base HP"
          />
        </div>
      </div>

      <Button onClick={calculate} className="w-full">
        Calculate
      </Button>

      {result && (
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <h3 className="font-semibold text-lg mb-3">
            Stats at {result.promotion} ({result.multiplier}x)
          </h3>
          <div className="space-y-4">
            {parseFloat(result.attack.base) > 0 && (
              <div>
                <div className="font-medium mb-1">Attack</div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Base:</span>
                  <span>{result.attack.base}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Final:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {result.attack.final}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Gain:</span>
                  <span className="text-green-600 dark:text-green-400">
                    +{result.attack.gain}
                  </span>
                </div>
              </div>
            )}
            {parseFloat(result.hp.base) > 0 && (
              <div>
                <div className="font-medium mb-1">HP</div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Base:</span>
                  <span>{result.hp.base}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Final:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {result.hp.final}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Gain:</span>
                  <span className="text-green-600 dark:text-green-400">
                    +{result.hp.gain}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatCalculator;
