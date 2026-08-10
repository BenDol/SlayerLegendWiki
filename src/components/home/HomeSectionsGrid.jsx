import React from 'react';
import { Link } from 'react-router-dom';
import { useWikiConfig } from '../../../wiki-framework/src/hooks/useWikiConfig';

/**
 * HomeSectionsGrid
 *
 * Wiki section cards for the custom home page ({{home:sections}} in home.md).
 * Mirrors the framework's default homepage sections grid.
 */
const HomeSectionsGrid = () => {
  const { config } = useWikiConfig();

  if (!config?.sections?.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8">
      {config.sections.map((section) => (
        <Link
          key={section.id}
          to={`/${section.path}`}
          className="group p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all"
        >
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 p-3 bg-blue-100 dark:bg-blue-900 rounded-lg group-hover:bg-blue-500 transition-colors">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {section.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Explore {section.title.toLowerCase()} documentation
              </p>
            </div>

            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default HomeSectionsGrid;
