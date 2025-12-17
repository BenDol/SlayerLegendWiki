import { useState } from 'react';
import SpiritSprite from '../components/SpiritSprite';
import spiritData from '../../public/data/spirit-characters.json';
import Button from '../../wiki-framework/src/components/common/Button';

/**
 * Demo page for SpiritSprite component
 * Shows various ways to use the animated spirit sprites
 */
const SpiritSpriteDemoPage = () => {
  const [selectedSpirit, setSelectedSpirit] = useState(1);
  const [selectedLevel, setSelectedLevel] = useState(0);
  const [animationType, setAnimationType] = useState('idle');
  const [fps, setFps] = useState(8);
  const [size, setSize] = useState('medium');
  const [animated, setAnimated] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [availableAnimations, setAvailableAnimations] = useState({});
  const [copied, setCopied] = useState(false);
  const [showFullSyntax, setShowFullSyntax] = useState(true);

  const spirit = spiritData.spirits.find(s => s.id === selectedSpirit);

  // Generate markdown syntax for current configuration
  // Format: ID:LEVEL:SIZE:ANIMATED:SHOWINFO:FPS:ANIMATIONTYPE
  const markdownSyntax = `<!-- spirit-sprite:${selectedSpirit}:${selectedLevel}:${size}:${animated}:${showInfo}:${fps}:${animationType} -->`;

  // Generate minimal markdown (only ID and level)
  const markdownSyntaxMinimal = `<!-- spirit-sprite:${selectedSpirit}:${selectedLevel} -->`;

  // Get the appropriate markdown syntax
  const currentSyntax = showFullSyntax ? markdownSyntax : markdownSyntaxMinimal;

  // Copy markdown to clipboard
  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(currentSyntax);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle animation types detection from SpiritSprite component
  const handleAnimationTypesDetected = (types) => {
    setAvailableAnimations(types);

    // If current animation type is not available, switch to first available one
    if (types[animationType] && !types[animationType].available) {
      const firstAvailable = Object.keys(types).find(key => types[key].available);
      if (firstAvailable) {
        setAnimationType(firstAvailable);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Spirit Viewer
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Interactive viewer for all 12 spirits and their 8 evolution levels. Explore animations, compare spirits, and view evolution progressions.
        </p>
      </div>

      {/* Interactive Viewer */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Spirit Preview
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Preview */}
          <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg p-8">
            <SpiritSprite
              spiritId={selectedSpirit}
              level={selectedLevel}
              animationType={animationType}
              fps={fps}
              size={size}
              animated={animated}
              showInfo={showInfo}
              onAnimationTypesDetected={handleAnimationTypesDetected}
            />

            {/* Spirit Details */}
            {spirit && (
              <div className="mt-6 text-center max-w-md">
                <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  {spirit.skill.type}
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {spirit.skill.name}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {spirit.skill.description}
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {/* Spirit Selection */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                Spirit ({selectedSpirit}/12)
              </label>
              <select
                value={selectedSpirit}
                onChange={(e) => setSelectedSpirit(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {spiritData.spirits.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.id}. {s.name} - {s.skill.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Level Selection */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                Evolution Level ({selectedLevel}/7)
              </label>
              <input
                type="range"
                min="0"
                max="7"
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Level 0</span>
                <span>Level 7</span>
              </div>
            </div>

            {/* Animation Type Selection */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                Animation Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'idle', label: 'Idle' },
                  { value: 'attack', label: 'Attack' },
                  { value: 'sideAttack', label: 'Side Attack' },
                  { value: 'movement', label: 'Movement' }
                ].map(type => {
                  const isAvailable = availableAnimations[type.value]?.available !== false;
                  const frameCount = availableAnimations[type.value]?.frameCount || 0;
                  const isSelected = animationType === type.value;

                  return (
                    <button
                      key={type.value}
                      onClick={() => isAvailable && setAnimationType(type.value)}
                      disabled={!isAvailable}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        !isAvailable
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                          : isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span>{type.label}</span>
                        {frameCount > 0 && (
                          <span className="text-xs opacity-75">({frameCount} frames)</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FPS Control */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                Animation Speed ({fps} FPS)
              </label>
              <input
                type="range"
                min="4"
                max="30"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>

            {/* Size Selection */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                Size
              </label>
              <div className="flex gap-2">
                {['small', 'medium', 'large'].map(s => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      size === s
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={animated}
                  onChange={(e) => setAnimated(e.target.checked)}
                  className="w-5 h-5"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Animated
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInfo}
                  onChange={(e) => setShowInfo(e.target.checked)}
                  className="w-5 h-5"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Show Info
                </span>
              </label>
            </div>

            {/* Markdown Copy Section */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-white">
                  Markdown Syntax
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showFullSyntax}
                      onChange={(e) => setShowFullSyntax(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">Full syntax</span>
                  </label>
                  <Button
                    onClick={copyMarkdown}
                    variant={copied ? 'success' : 'secondary'}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <code className="block p-3 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                {currentSyntax}
              </code>
              <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                <p>
                  {showFullSyntax ? (
                    <>
                      <strong>Full syntax:</strong> Includes all options (size, animated, showInfo, fps, animationType).
                      Use this when you need precise control over the sprite appearance.
                    </>
                  ) : (
                    <>
                      <strong>Minimal syntax:</strong> Only includes ID and level. Other options use defaults.
                      Use this for simpler, cleaner markdown.
                    </>
                  )}
                </p>
                <p>
                  Format: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">ID:LEVEL:SIZE:ANIMATED:SHOWINFO:FPS:ANIMATIONTYPE</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spirit Gallery */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          All Spirits Gallery
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {spiritData.spirits.map(s => (
            <div
              key={s.id}
              onClick={() => setSelectedSpirit(s.id)}
              className={`cursor-pointer transition-all ${
                selectedSpirit === s.id
                  ? 'ring-4 ring-blue-500 rounded-lg'
                  : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600 rounded-lg'
              }`}
            >
              <SpiritSprite
                spiritId={s.id}
                level={0}
                size="small"
                showInfo={true}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Evolution Showcase */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Evolution Progression: {spirit?.name}
        </h2>
        <div className="flex flex-wrap gap-4 justify-center">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(level => (
            <div
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`cursor-pointer transition-all ${
                selectedLevel === level
                  ? 'ring-4 ring-blue-500 rounded-lg'
                  : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600 rounded-lg'
              }`}
            >
              <SpiritSprite
                spiritId={selectedSpirit}
                level={level}
                size="small"
                showInfo={false}
              />
              <div className="text-center text-xs text-gray-600 dark:text-gray-400 mt-1">
                Lvl {level}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">
          💡 Viewer Tips
        </h3>
        <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
          <li><strong>Hover over sprites</strong> to see animation controls (play/pause, reset, frame counter)</li>
          <li><strong>Click gallery sprites</strong> to quickly switch between different spirits</li>
          <li><strong>Click evolution levels</strong> to see how spirits transform as they grow</li>
          <li><strong>Adjust animation speed</strong> with the FPS slider to see details or smooth motion</li>
          <li><strong>Disabled animation buttons</strong> indicate frame types not available for that evolution level</li>
        </ul>
      </div>
    </div>
  );
};

export default SpiritSpriteDemoPage;
