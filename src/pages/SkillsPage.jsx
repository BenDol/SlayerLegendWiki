import React, { useState, useEffect } from 'react';
import SkillCard from '../components/SkillCard';
import LoadingSpinner from '../wiki-framework/src/components/common/LoadingSpinner';

/**
 * SkillsPage - Showcase page for all skills using SkillCard component
 */
const SkillsPage = () => {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAttribute, setSelectedAttribute] = useState('All');
  const [selectedGrade, setSelectedGrade] = useState('All');

  useEffect(() => {
    const loadSkills = async () => {
      try {
        const response = await fetch('/data/skills.json');
        if (!response.ok) {
          throw new Error('Failed to load skills');
        }
        const data = await response.json();
        setSkills(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadSkills();
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
  const attributes = ['All', ...new Set(skills.map(s => s.attribute))];
  const grades = ['All', ...new Set(skills.map(s => s.grade))];

  // Filter skills
  const filteredSkills = skills.filter(skill => {
    const matchesAttribute = selectedAttribute === 'All' || skill.attribute === selectedAttribute;
    const matchesGrade = selectedGrade === 'All' || skill.grade === selectedGrade;
    return matchesAttribute && matchesGrade;
  });

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
          Skill Gallery
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Browse all skills in Slayer Legend. Filter by element and grade.
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
            Showing <span className="font-semibold">{filteredSkills.length}</span> of{' '}
            <span className="font-semibold">{skills.length}</span> skills
          </p>
        </div>
      </div>

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No skills match your filters. Try adjusting your selection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSkills.map(skill => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SkillsPage;
