import React from 'react';
import { getSkillImage, getGenericSkillIcon } from '../services/imageService';
import { getGradeBackgroundColor } from '../../wiki-framework/src/utils/rarityColors';

/**
 * SkillCard component - Displays skill information in a card format
 * Can be used directly in markdown pages via the editor
 *
 * Usage in markdown:
 * <SkillCard name="Fire Slash" />
 * <SkillCard id={1} />
 * <SkillCard skill={{...skillData}} />
 * <SkillCard name="Fire Slash" mode="compact" />
 * <SkillCard name="Fire Slash" mode="detailed" />
 * <SkillCard name="Fire Slash" mode="advanced" />
 *
 * @param {string} mode - Display mode: 'compact', 'detailed' (default), 'advanced'
 */
const SkillCard = ({ id, name, skill, mode = 'detailed' }) => {
  const [skillData, setSkillData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    // If skill object provided directly, use it
    if (skill) {
      setSkillData(skill);
      setLoading(false);
      return;
    }

    // Otherwise, fetch from skills.json
    const loadSkill = async () => {
      try {
        const response = await fetch('/data/skills.json');
        if (!response.ok) {
          throw new Error('Failed to load skills data');
        }
        const skills = await response.json();

        // Find skill by id or name
        let foundSkill;
        if (id !== undefined) {
          foundSkill = skills.find(s => s.id === parseInt(id));
        } else if (name) {
          foundSkill = skills.find(s => s.name === name);
        }

        if (!foundSkill) {
          throw new Error(`Skill not found: ${name || `ID ${id}`}`);
        }

        setSkillData(foundSkill);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadSkill();
  }, [id, name, skill]);

  if (loading) {
    return (
      <div className="not-prose bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="not-prose bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200 text-sm m-0">Error: {error}</p>
      </div>
    );
  }

  if (!skillData) return null;

  // Attribute color mapping
  const attributeColors = {
    Fire: 'from-red-500 to-orange-500',
    Water: 'from-blue-500 to-cyan-500',
    Wind: 'from-green-400 to-emerald-500',
    Earth: 'from-yellow-600 to-amber-600',
  };

  const attributeGradient = attributeColors[skillData.attribute] || 'from-gray-500 to-gray-600';
  const gradeColor = getGradeBackgroundColor(skillData.grade);
  const skillIcon = skillData.icon || getGenericSkillIcon();

  // Calculate damage at max level
  const maxLevelDamage = skillData.baseValue + (skillData.upgradeValue * (skillData.maxLevel - 1));

  // Render based on mode
  if (mode === 'compact') {
    return (
      <div className="not-prose inline-flex items-center gap-2 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 px-2 py-1.5 my-1 max-w-fit">
        {/* Icon */}
        <img
          src={skillIcon}
          alt={skillData.name}
          className="w-8 h-8 rounded bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 p-0.5 m-0"
          onError={(e) => { e.target.src = getGenericSkillIcon(); }}
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate m-0">{skillData.name}</h4>
            <span className={`${gradeColor} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0`}>
              {skillData.grade}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
            <span>💧 {skillData.mpCost}</span>
            <span>⏱️ {skillData.cooldown}s</span>
            <span>📏 {skillData.range === 0 ? 'Self' : skillData.range}</span>
          </div>
        </div>

        {/* Attribute Badge */}
        <span className={`bg-gradient-to-r ${attributeGradient} text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0`}>
          {skillData.attribute}
        </span>
      </div>
    );
  }

  if (mode === 'advanced') {
    return (
      <div className="not-prose bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 my-2">
        {/* Compact Header */}
        <div className={`bg-gradient-to-r ${attributeGradient} p-2.5 text-white`}>
          <div className="flex items-start gap-3">
            {/* Skill Icon */}
            <img
              src={skillIcon}
              alt={skillData.name}
              className="w-14 h-14 rounded-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20"
              onError={(e) => { e.target.src = getGenericSkillIcon(); }}
            />

            {/* Skill Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold mb-0.5">{skillData.name}</h3>
              <p className="text-xs opacity-90 line-clamp-2">{skillData.basicDescription}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-col gap-1 items-end flex-shrink-0">
              <span className={`${gradeColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full`}>
                {skillData.grade}
              </span>
              <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                {skillData.attribute}
              </span>
            </div>
          </div>
        </div>

        {/* Compact Content */}
        <div className="p-3 space-y-2">
          {/* Description */}
          <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            {skillData.specificDescription}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5 text-center">
              <div className="text-[9px] text-gray-500 dark:text-gray-500">MP Cost</div>
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {skillData.mpCost}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5 text-center">
              <div className="text-[9px] text-gray-500 dark:text-gray-500">Cooldown</div>
              <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                {skillData.cooldown}s
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5 text-center">
              <div className="text-[9px] text-gray-500 dark:text-gray-500">Range</div>
              <div className="text-sm font-bold text-green-600 dark:text-green-400">
                {skillData.range === 0 ? 'Self' : skillData.range}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5 text-center">
              <div className="text-[9px] text-gray-500 dark:text-gray-500">Unlocks</div>
              <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                Lv {skillData.enterLevel}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5 text-center">
              <div className="text-[9px] text-gray-500 dark:text-gray-500">Max Lv</div>
              <div className="text-sm font-bold text-red-600 dark:text-red-400">
                {skillData.maxLevel}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-1.5 text-center">
              <div className="text-[9px] text-gray-500 dark:text-gray-500">Base</div>
              <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">
                {skillData.baseValue}%
              </div>
            </div>
          </div>

          {/* Upgrade Summary */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-2 flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-500">Per Level: </span>
              <span className="font-bold text-gray-800 dark:text-gray-200">+{skillData.upgradeValue}%</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-500">Max: </span>
              <span className="font-bold text-green-600 dark:text-green-400">{maxLevelDamage}%</span>
            </div>
          </div>

          {/* Damage Scaling Table */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-2">
            <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1.5">
              Damage Scaling
            </div>
            <div className="grid grid-cols-5 gap-1 text-[10px]">
              {[1, Math.floor(skillData.maxLevel / 4), Math.floor(skillData.maxLevel / 2), Math.floor(skillData.maxLevel * 3 / 4), skillData.maxLevel].map((level) => {
                const damage = skillData.baseValue + (skillData.upgradeValue * (level - 1));
                return (
                  <div key={level} className="bg-white dark:bg-gray-800 rounded p-1 text-center border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Lv {level}</div>
                    <div className="font-bold text-gray-900 dark:text-white text-xs">{damage}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: detailed mode (compact version - about half the size)
  return (
    <div className="not-prose bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 my-2">
      {/* Compact Header */}
      <div className={`bg-gradient-to-r ${attributeGradient} p-2 text-white`}>
        <div className="flex items-center gap-2">
          {/* Skill Icon */}
          <img
            src={skillIcon}
            alt={skillData.name}
            className="w-12 h-12 rounded-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20"
            onError={(e) => { e.target.src = getGenericSkillIcon(); }}
          />

          {/* Skill Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold">{skillData.name}</h3>
            <p className="text-xs opacity-90 truncate">{skillData.basicDescription}</p>
          </div>

          {/* Badges */}
          <div className="flex gap-1 items-center flex-shrink-0">
            <span className={`${gradeColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full`}>
              {skillData.grade}
            </span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {skillData.attribute}
            </span>
          </div>
        </div>
      </div>

      {/* Compact Content */}
      <div className="p-3">
        {/* Stats Grid - Only essential stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500 dark:text-gray-500">MP</div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {skillData.mpCost}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500 dark:text-gray-500">CD</div>
            <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
              {skillData.cooldown}s
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500 dark:text-gray-500">Power</div>
            <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">
              {skillData.baseValue}%
            </div>
          </div>
        </div>

        {/* Quick Info */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>📏 Range: {skillData.range === 0 ? 'Self' : skillData.range}</span>
          <span>🔓 Lv {skillData.enterLevel}</span>
          <span>⬆️ Max Lv {skillData.maxLevel}</span>
        </div>
      </div>
    </div>
  );
};

export default SkillCard;
