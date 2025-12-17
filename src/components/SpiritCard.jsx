import React from 'react';
import SpiritSprite from './SpiritSprite';

/**
 * SpiritCard component - Displays Spirit character information in a card format
 * Can be used directly in markdown pages via the editor
 *
 * Usage in markdown:
 * <SpiritCard name="Loar" />
 * <SpiritCard id={4} />
 * <SpiritCard spirit={{...spiritData}} />
 * <SpiritCard name="Loar" mode="compact" />
 * <SpiritCard name="Loar" mode="compact" inline={false} />
 * <SpiritCard name="Loar" mode="detailed" />
 * <SpiritCard name="Loar" mode="advanced" />
 * <SpiritCard name="Loar" level={4} />
 *
 * @param {number} id - Spirit ID (1-12)
 * @param {string} name - Spirit name
 * @param {object} spirit - Direct spirit data object
 * @param {string} mode - Display mode: 'compact', 'detailed' (default), 'advanced'
 * @param {number} level - Evolution level (0-7, default: 0)
 * @param {boolean} inline - For compact mode: true (default) for inline, false for block-level
 */
const SpiritCard = ({ id, name, spirit, mode = 'detailed', level = 0, inline = true }) => {
  const [spiritData, setSpiritData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    // If spirit object provided directly, use it
    if (spirit) {
      setSpiritData(spirit);
      setLoading(false);
      return;
    }

    // Otherwise, fetch from spirit-characters.json
    const loadSpirit = async () => {
      try {
        const response = await fetch('/data/spirit-characters.json');
        if (!response.ok) {
          throw new Error('Failed to load spirit data');
        }
        const data = await response.json();

        // Find spirit by id or name
        let foundSpirit;
        if (id !== undefined) {
          foundSpirit = data.spirits.find(s => s.id === parseInt(id));
        } else if (name) {
          foundSpirit = data.spirits.find(s => s.name.toLowerCase() === name.toLowerCase());
        }

        if (!foundSpirit) {
          throw new Error(`Spirit not found: ${name || `ID ${id}`}`);
        }

        setSpiritData(foundSpirit);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadSpirit();
  }, [id, name, spirit]);

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

  if (!spiritData) return null;

  // Spirit-specific color mapping based on sprite coloration
  const spiritColors = {
    'Sala': 'from-red-500 via-red-500/40 to-transparent',          // Red
    'Ark': 'from-blue-500 via-blue-500/40 to-transparent',          // Blue
    'Herh': 'from-green-500 via-green-500/40 to-transparent',        // Green
    'Loar': 'from-amber-600 via-amber-600/40 to-transparent',        // Sienna (brown-orange)
    'Mum': 'from-red-500 via-red-500/40 to-transparent',           // Red
    'Todd': 'from-blue-500 via-blue-500/40 to-transparent',         // Blue (same as Ark)
    'Zappy': 'from-green-500 via-green-500/40 to-transparent',       // Green
    'Radon': 'from-amber-600 via-amber-600/40 to-transparent',       // Sienna (brown-orange)
    'Bo': 'from-red-500 via-red-500/40 to-transparent',            // Red
    'Luga': 'from-blue-500 via-blue-500/40 to-transparent',         // Blue (same as Ark)
    'Kart': 'from-green-500 via-green-500/40 to-transparent',        // Green
    'Noah': 'from-amber-600 via-amber-600/40 to-transparent',        // Sienna (brown-orange)
  };

  const typeGradient = spiritColors[spiritData.name] || 'from-gray-500 to-gray-600';

  // Render based on mode
  if (mode === 'compact') {
    const displayClass = inline ? 'inline-flex' : 'flex';
    return (
      <div className={`not-prose ${displayClass} items-center gap-2 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 my-1 max-w-fit`}>
        {/* Animated Spirit Sprite - Compact Size */}
        <div className="w-8 h-8 flex-shrink-0">
          <SpiritSprite
            spiritId={spiritData.id}
            level={level}
            animationType="idle"
            animated={true}
            fps={8}
            size="32px"
            showInfo={false}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate m-0">{spiritData.name}</h4>
            <span className={`bg-gradient-to-br ${typeGradient} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0`}>
              Lv {level}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-400">
            <span title="Spirit ID">#{spiritData.id}</span>
            <span title="Skill Type">{spiritData.skill.type}</span>
            {spiritData.skill.cooldown && (
              <span title="Cooldown">⏱️ {spiritData.skill.cooldown}s</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'advanced') {
    return (
      <div className="not-prose bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 my-2">
        {/* Header */}
        <div className={`bg-gradient-to-br ${typeGradient} p-3 text-white`}>
          <div className="flex items-start gap-3">
            {/* Animated Spirit Sprite */}
            <div className="w-20 h-20 flex-shrink-0">
              <SpiritSprite
                spiritId={spiritData.id}
                level={level}
                animationType="idle"
                animated={true}
                fps={8}
                size="80px"
                showInfo={false}
              />
            </div>

            {/* Title & Type */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold m-0 truncate">{spiritData.name}</h3>
                <span className="text-xs bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full font-semibold">
                  Lv {level}
                </span>
              </div>
              <p className="text-sm text-white/90 m-0">{spiritData.skill.type}</p>
            </div>

            {/* ID Badge - Right Side */}
            <div className="flex-shrink-0">
              <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded opacity-80">
                #{spiritData.id}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Skill Info */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2 m-0">
              <span>✨</span>
              {spiritData.skill.name}
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 m-0">
              {spiritData.skill.description}
            </p>

            {spiritData.skill.cooldown && (
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <span>⏱️</span>
                  <span>Cooldown: {spiritData.skill.cooldown}s</span>
                </span>
              </div>
            )}
          </div>

          {/* Skill Levels */}
          {spiritData.skill.levels && spiritData.skill.levels.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 m-0">
                Evolution Levels
              </h4>
              <div className="space-y-1.5">
                {spiritData.skill.levels.map((levelData, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded px-3 py-1.5 text-xs"
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Level {levelData.level}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {levelData.effect}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evolution Count */}
          {spiritData.sprites && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
              {spiritData.sprites.length} Evolution Forms Available
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default: detailed mode
  return (
    <div className="not-prose bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 my-2">
      {/* Header */}
      <div className={`bg-gradient-to-br ${typeGradient} p-3 text-white`}>
        <div className="flex items-center gap-3">
          {/* Animated Spirit Sprite */}
          <div className="w-16 h-16 flex-shrink-0">
            <SpiritSprite
              spiritId={spiritData.id}
              level={level}
              animationType="idle"
              animated={true}
              fps={8}
              size="64px"
              showInfo={false}
            />
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold m-0">{spiritData.name}</h3>
            <p className="text-sm text-white/90 m-0">{spiritData.skill.type}</p>
          </div>

          {/* Badges */}
          <div className="flex flex-col gap-1 items-end flex-shrink-0">
            <span className="text-xs bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full font-semibold">
              Lv {level}
            </span>
            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded opacity-80">
              #{spiritData.id}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Skill */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 m-0">
            {spiritData.skill.name}
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 m-0">
            {spiritData.skill.description}
          </p>
        </div>

        {/* Stats */}
        {spiritData.skill.cooldown && (
          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="flex items-center gap-1">
              <span>⏱️</span>
              <span>{spiritData.skill.cooldown}s cooldown</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpiritCard;
