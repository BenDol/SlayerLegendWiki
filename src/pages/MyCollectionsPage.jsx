import React from 'react';
import { Link } from 'react-router-dom';
import { Ghost, BookOpen, Folder } from 'lucide-react';
import MetaTags from '../components/MetaTags';

/**
 * My Collections Page
 *
 * Landing page that displays a grid of collection types available to the user.
 * Each collection type is presented as a feature card with description and navigation.
 */
const MyCollectionsPage = () => {
  // Collection cards configuration
  const collections = [
    {
      id: 'my-spirits',
      title: 'My Spirit Collection',
      description: 'Track and manage your spirit characters. View your collected spirits, mark favorites, and monitor your collection progress across all spirit types and elements.',
      icon: Ghost,
      path: '/my-spirits',
      color: 'from-purple-500 to-pink-500',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400'
    },
    // Future collections can be added here:
    // {
    //   id: 'my-skills',
    //   title: 'My Skill Collection',
    //   description: 'Track your unlocked skills, favorites, and build presets.',
    //   icon: BookOpen,
    //   path: '/my-skills',
    //   color: 'from-blue-500 to-cyan-500',
    //   iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    //   iconColor: 'text-blue-600 dark:text-blue-400'
    // },
  ];

  return (
    <>
      <MetaTags
        title="My Collections"
        description="Manage and track your personal game collections. View your spirits, skills, equipment, and unlocked content across different collection types."
        image="/images/tools/my-collections.png"
        url="/my-collections"
        keywords={['collections', 'my collection', 'tracker', 'progress', 'inventory']}
      />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Folder className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              My Collections
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Manage and track your personal game collections. View your progress, favorites, and unlocked content across different collection types.
            </p>
          </div>
        </div>
      </div>

      {/* Collections Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection) => {
            const IconComponent = collection.icon;

            return (
              <Link
                key={collection.id}
                to={collection.path}
                className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-transparent"
              >
                {/* Gradient accent bar */}
                <div className={`h-2 bg-gradient-to-r ${collection.color}`} />

                {/* Card content */}
                <div className="p-6">
                  {/* Icon */}
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl ${collection.iconBg} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <IconComponent className={`w-8 h-8 ${collection.iconColor}`} />
                  </div>

                  {/* Title */}
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {collection.title}
                  </h2>

                  {/* Description */}
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                    {collection.description}
                  </p>

                  {/* View button */}
                  <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium group-hover:translate-x-1 transition-transform duration-300">
                    <span>View Collection</span>
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Hover gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${collection.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`} />
              </Link>
            );
          })}
        </div>

        {/* Empty state / Coming soon */}
        {collections.length === 1 && (
          <div className="mt-8 text-center">
            <div className="inline-block p-6 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              <BookOpen className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">More Collections Coming Soon</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">Additional collection types will be added as new features become available</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default MyCollectionsPage;
