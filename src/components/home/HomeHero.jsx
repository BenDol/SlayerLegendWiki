import React from 'react';
import { useWikiConfig } from '../../../wiki-framework/src/hooks/useWikiConfig';

/**
 * HomeHero
 *
 * Hero banner for the custom home page ({{home:hero}} in home.md).
 * Mirrors the framework's default homepage hero so switching to the
 * markdown-driven home page is visually seamless.
 */
const HomeHero = () => {
  const { config } = useWikiConfig();

  if (!config) return null;

  return (
    <div className="text-center mb-10">
      <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
        {config.wiki.title}
      </h1>
      <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
        {config.wiki.description}
      </p>
    </div>
  );
};

export default HomeHero;
