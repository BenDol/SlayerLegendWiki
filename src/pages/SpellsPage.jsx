import React, { useState, useEffect } from 'react';
import SpellCard from '../components/SpellCard';
import LoadingSpinner from '../wiki-framework/src/components/common/LoadingSpinner';

/**
 * SpellsPage - Showcase page for all spells using SpellCard component
 */
const SpellsPage = () => {
  const [spells, setSpells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAttribute, setSelectedAttribute] = useState('All');
  const [selectedGrade, setSelectedGrade] = useState('All');

  useEffect(() => {
    const loadSpells = async () => {
      try {
        const response = await fetch('/data/skills.json');
        if (!response.ok) {
          throw new Error('Failed to load spells');
        }
        const data = await response.json();
        setSpells(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadSpells();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error: {error}</p>
        </div>
      </div>
    );
  }

  // Get unique attributes and grades
  const attributes = ['All', ...new Set(spells.map(s => s.attribute))];
  const grades = ['All', ...new Set(spells.map(s => s.grade))];

  // Filter spells
  const filteredSpells = spells.filter(spell => {
    const matchesAttribute = selectedAttribute === 'All' || spell.attribute === selectedAttribute;
    const matchesGrade = selectedGrade === 'All' || spell.grade === selectedGrade;
    return matchesAttribute && matchesGrade;
  });

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
          Spell Gallery
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Browse all spells and skills in Slayer Legend. Filter by element and grade.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Attribute Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Filter by Element
            </label>
            <div className="flex flex-wrap gap-2">
              {attributes.map(attr => (
                <button
                  key={attr}
                  onClick={() => setSelectedAttribute(attr)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedAttribute === attr
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {attr}
                </button>
              ))}
            </div>
          </div>

          {/* Grade Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Filter by Grade
            </label>
            <div className="flex flex-wrap gap-2">
              {grades.map(grade => (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(grade)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedGrade === grade
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing <span className="font-semibold">{filteredSpells.length}</span> of{' '}
            <span className="font-semibold">{spells.length}</span> spells
          </p>
        </div>
      </div>

      {/* Spells Grid */}
      {filteredSpells.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No spells match your filters. Try adjusting your selection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSpells.map(spell => (
            <SpellCard key={spell.id} spell={spell} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SpellsPage;
