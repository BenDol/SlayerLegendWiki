import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { getSkillGradeColor } from '../../wiki-framework/src/utils/rarityColors';

/**
 * SkillSelector Component
 *
 * Modal for selecting skills from the skills database
 * Features:
 * - Search by name
 * - Filter by attribute (Fire/Water/Wind/Earth)
 * - Filter by grade (rarity)
 * - Grid display with icons
 */
const SkillSelector = ({ isOpen, onClose, onSelectSkill, skills, currentBuild }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAttribute, setSelectedAttribute] = useState('All');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [filteredSkills, setFilteredSkills] = useState([]);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!skills) return;

    let filtered = skills.filter(skill => {
      // Skip skills without icons (passive skills usually)
      if (!skill.icon) return false;

      // Skip non-equippable skills (e.g., Mantra - passive effects only)
      if (skill.equippable === false) return false;

      // Search by name
      if (searchQuery && !skill.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Filter by attribute
      if (selectedAttribute !== 'All' && skill.attribute !== selectedAttribute) {
        return false;
      }

      // Filter by grade
      if (selectedGrade !== 'All' && skill.grade !== selectedGrade) {
        return false;
      }

      return true;
    });

    // Sort by rarity (Common -> Great -> Rare -> Epic -> Legendary -> Mythic)
    const rarityOrder = { 'Common': 0, 'Great': 1, 'Rare': 2, 'Epic': 3, 'Legendary': 4, 'Mythic': 5 };
    filtered.sort((a, b) => {
      const orderA = rarityOrder[a.grade] ?? 999;
      const orderB = rarityOrder[b.grade] ?? 999;
      return orderA - orderB;
    });

    setFilteredSkills(filtered);
  }, [skills, searchQuery, selectedAttribute, selectedGrade]);

  if (!isOpen) return null;

  const attributes = ['All', 'Fire', 'Water', 'Wind', 'Earth'];
  const grades = ['All', 'Common', 'Great', 'Rare', 'Epic', 'Legendary', 'Mythic'];

  // Get element icon
  const getElementIcon = (element) => {
    const icons = {
      Fire: '/images/icons/typeicon_fire_1.png',
      Water: '/images/icons/typeicon_water_1.png',
      Wind: '/images/icons/typeicon_wind_1.png',
      Earth: '/images/icons/typeicon_earth s_1.png'
    };
    return icons[element];
  };

  return (
    <div className={`fixed inset-0 z-50 flex ${isMobile ? 'items-start' : 'items-center justify-center p-4'}`}>
      <style>{`
        /* Webkit scrollbar (Chrome, Safari, Edge) */
        .skill-grid-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .skill-grid-scroll::-webkit-scrollbar-track {
          background: rgb(243 244 246);
        }
        .skill-grid-scroll::-webkit-scrollbar-thumb {
          background: rgb(209 213 219);
          border-radius: 0.5rem;
        }
        .skill-grid-scroll::-webkit-scrollbar-thumb:hover {
          background: rgb(156 163 175);
        }
        .dark .skill-grid-scroll::-webkit-scrollbar-track {
          background: rgb(31 41 55);
        }
        .dark .skill-grid-scroll::-webkit-scrollbar-thumb {
          background: rgb(75 85 99);
        }
        .dark .skill-grid-scroll::-webkit-scrollbar-thumb:hover {
          background: rgb(107 114 128);
        }

        /* Firefox scrollbar */
        .skill-grid-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgb(209 213 219) rgb(243 244 246);
        }
        .dark .skill-grid-scroll {
          scrollbar-color: rgb(75 85 99) rgb(31 41 55);
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full bg-white dark:bg-gray-900 shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 ${
        isMobile
          ? 'h-full'
          : 'max-w-4xl rounded-lg max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className="bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
            <img src="/images/skills/Icon_skillCard.png" alt="" className="w-7 h-7 sm:w-8 sm:h-8" />
            <span>Select a Skill</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex-shrink-0"
          >
            <X className="w-6 h-6 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
          {/* Search */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Attribute Filter */}
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Element:</label>
            <div className="flex gap-2 flex-wrap">
              {attributes.map((attr) => (
                <button
                  key={attr}
                  onClick={() => setSelectedAttribute(attr)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedAttribute === attr
                      ? getAttributeActiveColor(attr)
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {attr}
                </button>
              ))}
            </div>
          </div>

          {/* Grade Filter */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Rarity:</label>
            <div className="flex gap-2 flex-wrap">
              {grades.map((grade) => (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(grade)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedGrade === grade
                      ? getGradeActiveColor(grade)
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Skills Grid */}
        <div className="skill-grid-scroll p-3 sm:p-4 overflow-y-auto flex-1 min-h-0 bg-white dark:bg-gray-900">
          {filteredSkills.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No skills found matching your filters.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {filteredSkills.map((skill) => {
                const gradeColors = getSkillGradeColor(skill.grade);
                const isEquipped = currentBuild?.slots?.some(slot => slot.skill?.id === skill.id);
                return (
                  <button
                    key={skill.id}
                    onClick={() => {
                      if (isEquipped) {
                        alert('This skill is already equipped!');
                        return;
                      }
                      onSelectSkill(skill);
                      onClose();
                    }}
                    disabled={isEquipped}
                    className={`group relative flex flex-col items-center p-3 rounded-lg transition-all shadow-sm ${
                      isEquipped
                        ? 'bg-gray-200 dark:bg-gray-700 opacity-50 cursor-not-allowed border border-gray-300 dark:border-gray-600'
                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md'
                    }`}
                  >
                    {/* Skill Icon */}
                    <div className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 ${gradeColors.border} ${gradeColors.glow}`}>
                      <img
                        src={skill.icon}
                        alt={skill.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = '/images/skills/skill_deam.png';
                        }}
                      />

                      {/* Element Icon Overlay */}
                      {getElementIcon(skill.attribute) && (
                        <img
                          src={getElementIcon(skill.attribute)}
                          alt={skill.attribute}
                          className="absolute -top-1 -right-1 w-7 h-7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                        />
                      )}

                      {/* Equipped Badge */}
                      {isEquipped && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white text-xs font-bold bg-green-600 px-2 py-1 rounded">
                            Equipped
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Skill Name */}
                    <div className="mt-2 text-xs text-center text-gray-900 dark:text-white font-semibold line-clamp-2 w-full px-1">
                      {skill.name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {filteredSkills.length} skill{filteredSkills.length !== 1 ? 's' : ''} available
          </div>
          <button
            onClick={onClose}
            className="px-3 sm:px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper functions for styling
const getAttributeActiveColor = (attr) => {
  switch (attr) {
    case 'Fire':
      return 'bg-red-600 text-white';
    case 'Water':
      return 'bg-blue-600 text-white';
    case 'Wind':
      return 'bg-cyan-600 text-white';
    case 'Earth':
      return 'bg-yellow-600 text-white';
    default:
      return 'bg-blue-600 text-white';
  }
};

const getGradeActiveColor = (grade) => {
  const colors = getSkillGradeColor(grade);
  return `${colors.background} text-white`;
};

export default SkillSelector;
