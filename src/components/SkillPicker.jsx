import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { getSkillGradeColor } from '../../wiki-framework/src/utils/rarityColors';

/**
 * SkillPicker Modal - Select a skill to insert into markdown
 * Features:
 * - Browse skills with card grid
 * - Search and filter by element/grade
 * - Preview panel with skill details and image
 * - Display mode selection (compact/detailed/advanced)
 * - Pagination for large skill lists
 */
const SkillPicker = ({ isOpen, onClose, onSelect, renderPreview = null }) => {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAttribute, setSelectedAttribute] = useState('All');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [displayMode, setDisplayMode] = useState('detailed');
  const [alignment, setAlignment] = useState('none');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const skillsPerPage = 12;

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
    if (!isOpen) return;

    const loadSkills = async () => {
      try {
        setLoading(true);
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
  }, [isOpen]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
    }
  }, [searchTerm, selectedAttribute, selectedGrade, isOpen]);

  if (!isOpen) return null;

  // Get unique attributes and grades
  const attributes = ['All', ...new Set(skills.map(s => s.attribute))];
  const grades = ['All', ...new Set(skills.map(s => s.grade))];

  // Filter skills
  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          skill.basicDescription.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAttribute = selectedAttribute === 'All' || skill.attribute === selectedAttribute;
    const matchesGrade = selectedGrade === 'All' || skill.grade === selectedGrade;
    return matchesSearch && matchesAttribute && matchesGrade;
  });

  // Pagination
  const totalPages = Math.ceil(filteredSkills.length / skillsPerPage);
  const startIndex = (currentPage - 1) * skillsPerPage;
  const endIndex = startIndex + skillsPerPage;
  const currentSkills = filteredSkills.slice(startIndex, endIndex);

  const handleSkillSelect = (skill) => {
    setSelectedSkill(skill);
  };

  const handleInsert = () => {
    if (!selectedSkill) return;
    onSelect({ skill: selectedSkill, mode: displayMode, alignment });
    onClose();
  };

  // Attribute colors for visual indicators
  const attributeColors = {
    Fire: 'text-red-600 dark:text-red-400',
    Water: 'text-blue-600 dark:text-blue-400',
    Wind: 'text-green-600 dark:text-green-400',
    Earth: 'text-yellow-600 dark:text-yellow-400',
  };

  if (!isOpen) return null;

  const modal = (
    <div className={`fixed inset-0 ${isMobile ? 'z-[9999]' : 'z-50'} flex ${isMobile ? 'items-start' : 'items-center justify-center p-4'} ${isMobile ? 'p-0' : ''}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full bg-white dark:bg-gray-800 shadow-2xl overflow-hidden flex flex-col ${
        isMobile
          ? 'h-full'
          : 'max-w-6xl rounded-lg max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Insert Skill Card
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search skills..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={selectedAttribute}
                onChange={(e) => setSelectedAttribute(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="All">All Elements ({skills.length})</option>
                {attributes.slice(1).map(attr => {
                  const count = skills.filter(s => s.attribute === attr).length;
                  return <option key={attr} value={attr}>{attr} ({count})</option>;
                })}
              </select>

              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="All">All Grades</option>
                {grades.slice(1).map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-3"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading skills...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-red-600 dark:text-red-400">
                <p className="font-semibold mb-2">Error loading skills</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <p className="font-semibold mb-1">No skills found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {currentSkills.map(skill => {
                const gradeColor = getSkillGradeColor(skill.grade);
                return (
                  <button
                    key={skill.id}
                    onClick={() => handleSkillSelect(skill)}
                    className={`group relative rounded-md overflow-hidden border-2 transition-all ${
                      selectedSkill?.id === skill.id
                        ? 'border-blue-500 ring-2 ring-blue-500 scale-105'
                        : `${gradeColor.border} ${gradeColor.glow} ${gradeColor.glowHover}`
                    }`}
                  >
                    <div className="aspect-square p-1.5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex flex-col items-center justify-center">
                      {skill.icon && (
                        <img
                          src={skill.icon}
                          alt={skill.name}
                          className="w-10 h-10 object-contain mb-1"
                        />
                      )}
                      <h3 className="text-[9px] font-semibold text-center text-gray-900 dark:text-white line-clamp-2 leading-tight px-0.5">
                        {skill.name}
                      </h3>
                    </div>
                    {/* Selected checkmark */}
                    {selectedSkill?.id === skill.id && (
                      <div className="absolute top-0.5 right-0.5 bg-blue-500 rounded-full p-0.5">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Skill Preview Panel (if selected) */}
        {selectedSkill && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
            <div className="flex flex-col gap-4">
              {/* Top: Display Mode & Alignment Selection */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Display Mode */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide whitespace-nowrap">
                    Display:
                  </label>
                  <div className="flex gap-1">
                    {[
                      { value: 'compact', label: 'Compact' },
                      { value: 'detailed', label: 'Detailed' },
                      { value: 'advanced', label: 'Advanced' }
                    ].map(mode => (
                      <button
                        key={mode.value}
                        onClick={() => setDisplayMode(mode.value)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                          displayMode === mode.value
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alignment */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide whitespace-nowrap">
                    Align:
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setAlignment('none')}
                      title="No Alignment"
                      className={`px-2.5 py-1 rounded transition-all flex items-center justify-center ${
                        alignment === 'none'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setAlignment('left')}
                      title="Align Left"
                      className={`px-2.5 py-1 rounded transition-all flex items-center justify-center ${
                        alignment === 'left'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setAlignment('center')}
                      title="Align Center"
                      className={`px-2.5 py-1 rounded transition-all flex items-center justify-center ${
                        alignment === 'center'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setAlignment('right')}
                      title="Align Right"
                      className={`px-2.5 py-1 rounded transition-all flex items-center justify-center ${
                        alignment === 'right'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom: Preview */}
              <div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 max-h-64 overflow-y-auto">
                  {renderPreview ? (
                    renderPreview({ skill: selectedSkill, mode: displayMode })
                  ) : (
                    <div className="flex items-start gap-3">
                      {selectedSkill.icon && (
                        <img
                          src={selectedSkill.icon}
                          alt={selectedSkill.name}
                          className="w-20 h-20 flex-shrink-0 object-contain bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 dark:text-white text-lg">{selectedSkill.name}</h3>
                          <span className={`${getSkillGradeColor(selectedSkill.grade).background} text-white text-xs px-2 py-0.5 rounded-full`}>
                            {selectedSkill.grade}
                          </span>
                          <span className={`bg-gradient-to-r ${attributeColors[selectedSkill.attribute].replace('text-', 'from-').replace(' dark:', ' to-')} text-white text-xs px-2 py-0.5 rounded-full`}>
                            {selectedSkill.attribute}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{selectedSkill.basicDescription}</p>
                        <div className="flex gap-3 text-xs text-gray-600 dark:text-gray-400">
                          <span>💧 MP: {selectedSkill.mpCost}</span>
                          <span>⏱️ CD: {selectedSkill.cooldown}s</span>
                          <span>📏 Range: {selectedSkill.range === 0 ? 'Self' : selectedSkill.range}</span>
                          <span>⚡ Power: {selectedSkill.baseValue}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {/* Pagination */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages || 1} • {filteredSkills.length} skills
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={!selectedSkill}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Insert Skill
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default SkillPicker;
